import {NextRequest, NextResponse} from 'next/server';
import {Connection, WorkflowClient} from '@temporalio/client';
import {
  EncodedObject,
  InterpreterWorkflowInput,
  IwfHistoryEvent,
  IwfHistoryEventType,
  StateDecideActivityInput,
  StateExecuteDetails,
  StateStartActivityInput,
  StateWaitUntilDetails,
  WorkflowShowRequest,
  WorkflowShowResponse,
  WorkflowStateOptions
} from '../../../../ts-api/src/api-gen/api';
import {decodeSearchAttributes, extractStringValue, mapTemporalStatus, temporalConfig} from '../utils';
import {arrayFromPayloads, defaultDataConverter} from "@temporalio/common";

// Handler for GET requests
export async function GET(request: NextRequest) {
  try {
    // Extract parameters from URL
    const url = new URL(request.url);
    const workflowId = url.searchParams.get('workflowId');
    const runId = url.searchParams.get('runId');
    
    // Validate required fields
    if (!workflowId) {
      return NextResponse.json(
        { detail: "Missing required query parameter: workflowId" },
        { status: 400 }
      );
    }
    
    // Process the request with parameters from URL
    return await handleWorkflowShowRequest({ workflowId, runId: runId || undefined });
    
  } catch (error) {
    console.error("Error processing workflow show GET request:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error occurred";
    
    return NextResponse.json(
      { detail: "Failed to process GET request", error: errorMessage },
      { status: 500 }
    );
  }
}

// Handler for POST requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as WorkflowShowRequest;
    
    // Validate required fields
    if (!body.workflowId) {
      return NextResponse.json(
        { detail: "Missing required field: workflowId" },
        { status: 400 }
      );
    }
    
    // Process the request with parameters from POST body
    return await handleWorkflowShowRequest(body);
    
  } catch (error) {
    console.error("Error processing workflow show POST request:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error occurred";
    
    return NextResponse.json(
      { detail: "Failed to process POST request", error: errorMessage },
      { status: 500 }
    );
  }
}

interface IndexAndStateOption{
  index: number,
  option? : WorkflowStateOptions
  input? : EncodedObject
}

// Common handler implementation for both GET and POST
async function handleWorkflowShowRequest(params: WorkflowShowRequest) {
  try {
    // Create connection to Temporal
    const connection = await Connection.connect({
      address: temporalConfig.hostPort,
    });

    // Create a client to interact with Temporal
    const client = new WorkflowClient({
      connection,
      namespace: temporalConfig.namespace,
    });

    // Get the workflow details
    const workflow = await client.workflowService.describeWorkflowExecution(
        {
          namespace: temporalConfig.namespace,
          execution:{
            workflowId: params.workflowId,
            runId: params.runId
          }
    });

    // Access the workflowExecutionInfo from the response
    const workflowInfo = workflow.workflowExecutionInfo;
    
    if (!workflowInfo) {
      throw new Error("Workflow execution info not found in the response");
    }
    
    // Extract search attributes and decode them properly using the utility function
    const searchAttributes = decodeSearchAttributes(workflowInfo.searchAttributes);

    // Get workflow type - preferring IwfWorkflowType search attribute 
    let workflowType = workflowInfo.type?.name || 'Unknown';
    if (searchAttributes.IwfWorkflowType) {
      // Use the IwfWorkflowType from search attributes
      workflowType = typeof searchAttributes.IwfWorkflowType === 'string' 
        ? searchAttributes.IwfWorkflowType 
        : extractStringValue(searchAttributes.IwfWorkflowType);
    }else{
      return NextResponse.json({
        detail: "Not an iWF workflow execution",
        error: `unsupported temporal workflow type ${workflowInfo.type}`,
        errorType: "TEMPORAL_API_ERROR"
      }, { status: 400 });
    }
    
    // Extract timestamp from the Temporal format (keeping in seconds)
    let startTimeSeconds = 0;
    if (workflowInfo.startTime?.seconds) {
      // Extract seconds (handling both number and Long)
      // Keep as seconds, not converting to milliseconds
      startTimeSeconds = typeof workflowInfo.startTime.seconds === 'number'
          ? workflowInfo.startTime.seconds
          : Number(workflowInfo.startTime.seconds);
    }
    
    // Map numeric status code to status enum
    const statusCode = workflowInfo.status;

    // Now fetch history and get the other fields
    // TODO support configuring data converter
    const dataConverter = defaultDataConverter
    const handle = client.getHandle(params.workflowId, params.runId)
    const rawHistories = await handle.fetchHistory()
    const startInputs = arrayFromPayloads(dataConverter.payloadConverter, rawHistories.events[0].workflowExecutionStartedEventAttributes.input.payloads)

    // Convert the raw input to InterpreterWorkflowInput type
    const workflowInput: InterpreterWorkflowInput = startInputs[0] as InterpreterWorkflowInput
    // stateId -> a list of indexes of iWF history events that decide to this stateId
    // when the index is -1, it's the starting states, or states from continueAsNew
    // TODO support continueAsNew
    let fromStateLookup = new Map<string, IndexAndStateOption[]>([
      [workflowInput.startStateId, [
          {
            index: -1,
            option: workflowInput.stateOptions,
            input: workflowInput.stateInput
          }
      ]],
    ]);
    // scheduledId -> index of iWF history event.
    // This is for processing activity task started/completed event
    // to look up the event based on scheduledEventId, which inserted the iwfHistory event. So that activity task started/completed
    // can read it back and update the iWF event
    let historyLookupByScheduledId = new Map<number, number>();
    // stateExecutionId -> index of the waitUntil event.
    // This is for processing activity task scheduled event for stateExecute, which is from a waitUntil
    // (Note, if the stateExecute is not from waitUntil, it should use fromStateLookup to find the eventId)
    let stateExecutionIdToWaitUntilIndex = new Map<string, number>();
    
    // Extract and process history events
    const historyEvents: IwfHistoryEvent[] = [];
    
    // Step 1: Iterate through raw Temporal events starting from the second event
    for (let i = 1; i < rawHistories.events.length; i++) {
      const event = rawHistories.events[i];
      if (event.activityTaskScheduledEventAttributes) {
        const firstAttemptStartedTimestamp = event.eventTime?.seconds
        const activityId = event.activityTaskScheduledEventAttributes.activityId

        const activityInputs = arrayFromPayloads(dataConverter.payloadConverter, event.activityTaskScheduledEventAttributes.input.payloads)
        if(event.activityTaskScheduledEventAttributes.activityType.name == "StateApiWaitUntil"){
          // process StateApiWaitUntil for activityTaskScheduled
          const activityInput = activityInputs[1] as StateStartActivityInput;
          const req = activityInput.Request
          let lookup: IndexAndStateOption[] = fromStateLookup.get(req.workflowStateId)
          const from:IndexAndStateOption = lookup[0]
          lookup.shift()
          if(lookup.length === 0){
            fromStateLookup.delete(req.workflowStateId)
          }else{
            fromStateLookup.set(req.workflowStateId, lookup)
          }

          const waitUntilDetail: StateWaitUntilDetails = {
            stateExecutionId: req.context.stateExecutionId,
            stateId: req.workflowStateId,
            input: from.input,
            fromEventId: from.index,
            stateOptions: from.option,

            firstAttemptStartedTimestamp: firstAttemptStartedTimestamp.toNumber(),
          }
          const iwfEvent: IwfHistoryEvent = {
            eventType: "StateWaitUntil",
            stateWaitUntil: waitUntilDetail
          }
          const eventIndex = historyEvents.length;
          historyLookupByScheduledId.set(event.eventId.toNumber(), eventIndex)
          stateExecutionIdToWaitUntilIndex[req.context.stateExecutionId] = eventIndex
          historyEvents.push(iwfEvent)
        }else if(event.activityTaskScheduledEventAttributes.activityType.name == "StateApiExecute"){
          // Process StateApiExecute for activityTaskScheduled
          const activityInput = activityInputs[1] as StateDecideActivityInput;
          const req = activityInput.Request
          
          // Look up the stateExecutionId in the waitUntil index map first
          let fromEvent: number;
          let stateOption: WorkflowStateOptions | undefined;
          let stateInput: EncodedObject | undefined;
          
          if (stateExecutionIdToWaitUntilIndex.has(req.context.stateExecutionId)) {
            // If it's coming from a waitUntil event, use that index
            fromEvent = stateExecutionIdToWaitUntilIndex.get(req.context.stateExecutionId);
            // Get the stateOptions from the referenced waitUntil event
            const waitUntilEvent = historyEvents[fromEvent];
            stateOption = waitUntilEvent.stateWaitUntil?.stateOptions;
            stateInput = waitUntilEvent.stateWaitUntil?.input;
          } else {
            // Otherwise use historyActivityIdLookup like in waitUntil processing
            let lookup: IndexAndStateOption[] = fromStateLookup.get(req.workflowStateId);
            const from: IndexAndStateOption = lookup[0];
            lookup.shift();
            if (lookup.length === 0) {
              fromStateLookup.delete(req.workflowStateId);
            } else {
              fromStateLookup.set(req.workflowStateId, lookup);
            }
            fromEvent = from.index;
            stateOption = from.option;
            stateInput = from.input;
          }

          // Build the StateExecuteDetails object
          const executeDetail = {
            stateExecutionId: req.context.stateExecutionId,
            stateId: req.workflowStateId,
            input: stateInput,
            stateLocals: req.stateLocals,
            commandResults: req.commandResults,
            fromEventId: fromEvent,
            stateOptions: stateOption,
            activityId: activityId,
            firstAttemptStartedTimestamp: firstAttemptStartedTimestamp.toNumber()
          } as StateExecuteDetails;
          
          // Create and add the IwfHistoryEvent
          const iwfEvent: IwfHistoryEvent = {
            eventType: "StateExecute",
            stateExecute: executeDetail
          };
          
          const eventIndex = historyEvents.length;
          historyLookupByScheduledId.set(event.eventId.toNumber(), eventIndex)
          historyEvents.push(iwfEvent);
        }else{
          //  rpc locking
        }

      } else if (event.activityTaskCompletedEventAttributes) {
        const scheduledId = event.activityTaskCompletedEventAttributes.scheduledEventId.toNumber()
        const indexToUpdate = historyLookupByScheduledId.get(scheduledId)
        if(historyEvents[indexToUpdate].eventType == "StateWaitUntil"){
          let waitUntilDetails = historyEvents[indexToUpdate].stateWaitUntil
          // process StateApiWaitUntil for activityTaskCompleted
          // Extract the response data from the activity result
          // Get the activity result payload
          const result = event.activityTaskCompletedEventAttributes.result?.payloads;
          // Decode the response from the payload
          const responseData = arrayFromPayloads(dataConverter.payloadConverter, result);
          // The first element contains the activity output which is the WorkflowStateStartResponse
          waitUntilDetails.response = responseData[0];

          // Add the completedTimestamp from the event time
          waitUntilDetails.completedTimestamp = event.eventTime.seconds.toNumber();
          // Update the event in the array with the added details
          historyEvents[indexToUpdate].stateWaitUntil = waitUntilDetails;
        }else if(historyEvents[indexToUpdate].eventType == "StateExecute"){
          let executeDetails = historyEvents[indexToUpdate].stateExecute;
          // process StateApiExecute for activityTaskCompleted
          
          // Get the activity result payload
          const result = event.activityTaskCompletedEventAttributes.result?.payloads;
          // Decode the response from the payload
          const responseData = arrayFromPayloads(dataConverter.payloadConverter, result);
          // The first element contains the activity output which is the WorkflowStateDecideResponse
          executeDetails.response = responseData[0];
          
          // Add the completedTimestamp from the event time
          executeDetails.completedTimestamp = event.eventTime.seconds.toNumber();
          // Update the event in the array with the added details
          historyEvents[indexToUpdate].stateExecute = executeDetails;
          
          // Check if the response has a stateDecision with nextStates
          if (executeDetails.response && 
              executeDetails.response.stateDecision && 
              executeDetails.response.stateDecision.nextStates) {
            
            const nextStates = executeDetails.response.stateDecision.nextStates;
            
            // Iterate through each next state movement from the decision
            for (const stateMovement of nextStates) {
                // Create an entry for this state in fromStateLookup
                const indexOption: IndexAndStateOption = {
                  index: indexToUpdate,  // Current event index as the source
                  option: stateMovement.stateOptions,  // StateOptions from the movement
                  input: stateMovement.stateInput  // Input from the movement
                };
                
                // Check if the state already exists in the lookup
                if (fromStateLookup.has(stateMovement.stateId)) {
                  // Append to existing array
                  const existingOptions = fromStateLookup.get(stateMovement.stateId);
                  existingOptions.push(indexOption);
                  fromStateLookup.set(stateMovement.stateId, existingOptions);
                } else {
                  // Create new array with this option
                  fromStateLookup.set(stateMovement.stateId, [indexOption]);
                }
              }
            }
        }
      } else if (event.workflowExecutionSignaledEventAttributes) {
        console.log(`  signal received=${event}`);
      } else if (event.activityTaskFailedEventAttributes) {
        // TODO do we need to process for the stateApiFailure policy?
      } else if (event.workflowExecutionCompletedEventAttributes) {
        console.log(`  Workflow completed`);
      } else if (event.workflowExecutionFailedEventAttributes) {
        console.log(`  Workflow failed`);
      }
      // TODO local activity
      // TODO activity task started event for last failure details
    }
    
    // For now, we'll return an empty array as we're just logging the events
    
    // Build the response
    const response: WorkflowShowResponse = {
      workflowStartedTimestamp: startTimeSeconds,
      workflowType: workflowType,
      status: statusCode ? mapTemporalStatus(String(statusCode)):undefined,
      // Include the decoded input in the response
      input: workflowInput,
      continueAsNewSnapshot: undefined,
      historyEvents: historyEvents
    };

    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    // Handle specific Temporal errors
    console.error('Temporal API error:', error);

    return NextResponse.json({
      detail: "Error retrieving workflow details",
      error: error.message,
      errorType: "TEMPORAL_API_ERROR"
    }, { status: 400 });
  }
}