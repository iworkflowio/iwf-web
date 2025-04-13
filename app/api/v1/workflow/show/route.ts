import {NextRequest, NextResponse} from 'next/server';
import {Connection, WorkflowClient} from '@temporalio/client';
import {
  ContinueAsNewDumpResponse,
  EncodedObject,
  InterpreterWorkflowInput,
  IwfHistoryEvent,
  IwfHistoryEventType,
  StateDecideActivityInput,
  StateExecuteDetails,
  StateStartActivityInput,
  StateWaitUntilDetails, WorkflowDumpResponse,
  WorkflowShowRequest,
  WorkflowShowResponse,
  WorkflowStateOptions
} from '../../../../ts-api/src/api-gen/api';
import {decodeSearchAttributes, extractStringValue, mapTemporalStatus, temporalConfig} from '../utils';
import {arrayFromPayloads, defaultDataConverter, LoadedDataConverter} from "@temporalio/common";
import {temporal} from '@temporalio/proto';

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
          {detail: "Missing required query parameter: workflowId"},
          {status: 400}
      );
    }

    // Process the request with parameters from URL
    return await handleWorkflowShowRequest({workflowId, runId: runId || undefined});

  } catch (error) {
    console.error("Error processing workflow show GET request:", error);

    const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error occurred";

    return NextResponse.json(
        {detail: "Failed to process GET request", error: errorMessage},
        {status: 500}
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
          {detail: "Missing required field: workflowId"},
          {status: 400}
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
        {detail: "Failed to process POST request", error: errorMessage},
        {status: 500}
    );
  }
}

interface IndexAndStateOption {
  index: number,
  option?: WorkflowStateOptions
  input?: EncodedObject
}

// Helper function to process activity task scheduled events
function processActivityTaskScheduledEvent(
    event: temporal.api.history.v1.IHistoryEvent,
    dataConverter: LoadedDataConverter,
    historyEvents: IwfHistoryEvent[],
    historyLookupByScheduledId: Map<number, number>,
    stateExecutionIdToWaitUntilIndex: Map<string, number>,
    startingStateLookup: Map<string, IndexAndStateOption[]>,
    continueAsNewActivityScheduleIds: Map<number, boolean>
) {
  const firstAttemptStartedTimestamp = event.eventTime?.seconds;
  const activityId = event.activityTaskScheduledEventAttributes.activityId;
  const activityInputs = arrayFromPayloads(dataConverter.payloadConverter, event.activityTaskScheduledEventAttributes.input.payloads);

  const activityType = event.activityTaskScheduledEventAttributes.activityType.name;

  if (activityType === "StateApiWaitUntil") {
    processStateApiWaitUntilScheduled(
        event,
        activityInputs,
        firstAttemptStartedTimestamp,
        historyEvents,
        historyLookupByScheduledId,
        stateExecutionIdToWaitUntilIndex,
        startingStateLookup
    );
  } else if (activityType === "StateApiExecute") {
    processStateApiExecuteScheduled(
        event,
        activityInputs,
        activityId,
        firstAttemptStartedTimestamp,
        historyEvents,
        historyLookupByScheduledId,
        stateExecutionIdToWaitUntilIndex,
        startingStateLookup
    );
  } else if (activityType === "InvokeWorkerRpc") {
    throw new Error("RPC locking is not supported");
  } else {
    // NOTE: this must be continueAsNew
  }
}

// Process StateApiWaitUntil for activity task scheduled
function processStateApiWaitUntilScheduled(
    event: temporal.api.history.v1.IHistoryEvent,
    activityInputs: unknown[],
    firstAttemptStartedTimestamp: import("long"),
    historyEvents: IwfHistoryEvent[],
    historyLookupByScheduledId: Map<number, number>,
    stateExecutionIdToWaitUntilIndex: Map<string, number>,
    startingStateLookup: Map<string, IndexAndStateOption[]>
) {
  const activityInput = activityInputs[1] as StateStartActivityInput;
  const req = activityInput.Request;

  let lookup: IndexAndStateOption[] = startingStateLookup.get(req.workflowStateId);
  let from: IndexAndStateOption;

  if (!lookup || lookup.length == 0) {
    console.log(`ERROR: No source states found for workflowStateId: ${req.workflowStateId}`, startingStateLookup);
    from = {
      index: -1 // means unknown & bug
    };
  } else {
    from = lookup[0];
    lookup.shift();

    if (lookup.length === 0) {
      startingStateLookup.delete(req.workflowStateId);
    } else {
      startingStateLookup.set(req.workflowStateId, lookup);
    }
  }

  const waitUntilDetail: StateWaitUntilDetails = {
    stateExecutionId: req.context.stateExecutionId,
    stateId: req.workflowStateId,
    input: from.input,
    fromEventId: from.index,
    stateOptions: from.option,
    firstAttemptStartedTimestamp: firstAttemptStartedTimestamp.toNumber(),
  };

  const iwfEvent: IwfHistoryEvent = {
    eventType: "StateWaitUntil",
    stateWaitUntil: waitUntilDetail
  };

  const eventIndex = historyEvents.length;
  historyLookupByScheduledId.set(event.eventId.toNumber(), eventIndex);
  stateExecutionIdToWaitUntilIndex.set(req.context.stateExecutionId, eventIndex);
  historyEvents.push(iwfEvent);
}

// Process StateApiExecute for activity task scheduled
function processStateApiExecuteScheduled(
    event: temporal.api.history.v1.IHistoryEvent,
    activityInputs: unknown[],
    activityId: string,
    firstAttemptStartedTimestamp: import("long"),
    historyEvents: any[],
    historyLookupByScheduledId: Map<number, number>,
    stateExecutionIdToWaitUntilIndex: Map<string, number>,
    startingStateLookup: Map<string, IndexAndStateOption[]>
) {
  const activityInput = activityInputs[1] as StateDecideActivityInput;
  const req = activityInput.Request;

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
    // Otherwise use startingStateLookup
    let lookup: IndexAndStateOption[] = startingStateLookup.get(req.workflowStateId);

    // Check if lookup is undefined or empty
    if (!lookup || lookup.length === 0) {
      console.log(`ERROR: No source states found for workflowStateId: ${req.workflowStateId}`, startingStateLookup);
      // Use default values if no lookup found
      fromEvent = -2; // mean unknown & bug
      stateOption = undefined;
      stateInput = undefined;
    } else {
      const from: IndexAndStateOption = lookup[0];
      lookup.shift();

      if (lookup.length === 0) {
        startingStateLookup.delete(req.workflowStateId);
      } else {
        startingStateLookup.set(req.workflowStateId, lookup);
      }

      fromEvent = from.index;
      stateOption = from.option;
      stateInput = from.input;
    }
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
  historyLookupByScheduledId.set(event.eventId.toNumber(), eventIndex);
  historyEvents.push(iwfEvent);
}

// Helper function to process activity task completed events
function processActivityTaskCompletedEvent(
    event: temporal.api.history.v1.IHistoryEvent,
    dataConverter: LoadedDataConverter,
    historyEvents: IwfHistoryEvent[],
    historyLookupByScheduledId: Map<number, number>,
    startingStateLookup: Map<string, IndexAndStateOption[]>,
    continueAsNewActivityScheduleIds: Map<number, boolean>
) {
  const scheduledId = event.activityTaskCompletedEventAttributes.scheduledEventId.toNumber();
  
  if (continueAsNewActivityScheduleIds.has(scheduledId)) {
    // Skip continueAsNew and invokeRPC activity
    return;
  }
  
  const indexToUpdate = historyLookupByScheduledId.get(scheduledId);
  
  if (!historyEvents[indexToUpdate]) {
    console.log(`ERROR: No scheduled event id ${scheduledId}`);
    return;
  }
  
  if (historyEvents[indexToUpdate].eventType === "StateWaitUntil") {
    processStateWaitUntilCompleted(event, dataConverter, historyEvents, indexToUpdate);
  } else if (historyEvents[indexToUpdate].eventType === "StateExecute") {
    processStateExecuteCompleted(event, dataConverter, historyEvents, indexToUpdate, startingStateLookup);
  } else {
    // TODO: for RPC locking. We need another lookup for RPC locking
  }
}

// Process StateApiWaitUntil for activity task completed
function processStateWaitUntilCompleted(event, dataConverter, historyEvents, indexToUpdate) {
  let waitUntilDetails = historyEvents[indexToUpdate].stateWaitUntil;
  
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
}

// Process StateApiExecute for activity task completed
function processStateExecuteCompleted(event, dataConverter, historyEvents, indexToUpdate, startingStateLookup) {
  let executeDetails = historyEvents[indexToUpdate].stateExecute;
  
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
      if (startingStateLookup.has(stateMovement.stateId)) {
        // Append to existing array
        const existingOptions = startingStateLookup.get(stateMovement.stateId);
        existingOptions.push(indexOption);
        startingStateLookup.set(stateMovement.stateId, existingOptions);
      } else {
        // Create new array with this option
        startingStateLookup.set(stateMovement.stateId, [indexOption]);
      }
    }
  }
}

// Process workflow closed events
function processWorkflowClosedEvent(
    event: temporal.api.history.v1.IHistoryEvent,
    statusCode: temporal.api.enums.v1.WorkflowExecutionStatus,
    dataConverter: LoadedDataConverter,
    historyEvents: IwfHistoryEvent[]) {
  // Create and add the IwfHistoryEvent
  const iwfEvent: IwfHistoryEvent = {
    eventType: "WorkflowClosed",
    workflowClosed: {
      workflowClosedTimestamp: event.eventTime.seconds.toNumber(),
      closedType: mapTemporalStatus(String(statusCode)),
    }
  };
  
  // Extract output from workflowExecutionCompletedEventAttributes if available
  if (event.workflowExecutionCompletedEventAttributes && 
      event.workflowExecutionCompletedEventAttributes.result?.payloads) {
    // Decode the output from the payload
    const resultPayloads = event.workflowExecutionCompletedEventAttributes.result.payloads;
    try {
      const outputData = arrayFromPayloads(dataConverter.payloadConverter, resultPayloads);
      // The first element should contain the workflow output
      if (outputData && outputData.length > 0) {
        iwfEvent.workflowClosed.output = outputData[0];
      }
    } catch (error) {
      console.error('Error decoding workflow output:', error);
    }
  }

  historyEvents.push(iwfEvent);
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

    // scheduledId -> index of iWF history event.
    // This is for processing activity task started/completed event
    // to look up the event based on scheduledEventId, which inserted the iwfHistory event. So that activity task started/completed
    // can read it back and update the iWF event
    let historyLookupByScheduledId = new Map<number, number>();
    // stateExecutionId -> index of the waitUntil event.
    // This is for processing activity task scheduled event for stateExecute, which is from a waitUntil
    // (Note, if the stateExecute is not from waitUntil, it should use fromStateLookup to find the eventId)
    let stateExecutionIdToWaitUntilIndex = new Map<string, number>();
    // stateId -> a list of indexes of iWF history events that decide to this stateId
    // when the index is 0, it's the workflow starting states, or starting states from continueAsNew
    // when it's >=0, it's starting from other states, where the number is the index of historyEvents
    let startingStateLookup: Map<string, IndexAndStateOption[]> = new Map();
    let continueAsNewSnapshot: ContinueAsNewDumpResponse|undefined;
    const continueAsNewActivityScheduleIds = new Map<number, boolean>();

    // 0 is always the started event
    // -1 (or <0) is unknown.
    const historyEvents: IwfHistoryEvent[] = []

    // Extract and process history events
    // Convert the raw input to InterpreterWorkflowInput type
    const workflowInput: InterpreterWorkflowInput = startInputs[0] as InterpreterWorkflowInput
    if(workflowInput.isResumeFromContinueAsNew){
      let currentChecksum = ""
      let jsonData = ""
      for (let i = 1; i < rawHistories.events.length; i++) {
        const event = rawHistories.events[i];
        if (event.activityTaskScheduledEventAttributes) {
          if(event.activityTaskScheduledEventAttributes.activityType.name!="DumpWorkflowInternal"){
            break;
          }
          continueAsNewActivityScheduleIds.set(event.eventId.toNumber(), true)
        }
        if (event.activityTaskCompletedEventAttributes) {
          // just assuming it's continueAsNew and try to decode it
          const result = event.activityTaskCompletedEventAttributes.result?.payloads;
          // Decode the response from the payload
          const responseData = arrayFromPayloads(dataConverter.payloadConverter, result);
          // this must be a continueAsNew dump activity completed event,
          // because there shouldn't any other activity before continueAsNew dump is completed.
          const dump = responseData[0] as WorkflowDumpResponse
          if(dump.checksum != currentChecksum){
            // always reset when checksum changed
            currentChecksum = dump.checksum
            jsonData = ""
          }
          jsonData += dump.jsonData
        }
      }
      // TODO catch this error and ignore -- the history is not ready to parse yet.
      continueAsNewSnapshot = JSON.parse(jsonData) as ContinueAsNewDumpResponse
      // update stateExecutionIdToWaitUntilIndex
      continueAsNewSnapshot.StateExecutionsToResume
      for(const key in continueAsNewSnapshot.StateExecutionsToResume){
        stateExecutionIdToWaitUntilIndex.set(key, 0)
      }

      // update startingStateLookup
      const length:number = continueAsNewSnapshot.StatesToStartFromBeginning ? continueAsNewSnapshot.StatesToStartFromBeginning.length:0;
      for (let i = 0; i < length; i++) {
        const stateMovement = continueAsNewSnapshot.StatesToStartFromBeginning[i]
        const stateId = stateMovement.stateId
        let lookup: IndexAndStateOption[] = startingStateLookup.get(stateId);
        // Fix: Check if lookup is undefined or empty
        if (!lookup || lookup.length === 0) {
          startingStateLookup.set(stateId,
              [{
                index: 0,
                option: stateMovement.stateOptions,
                input: stateMovement.stateInput
              }])
        } else {
          lookup.push({
            index: 0,
            option: stateMovement.stateOptions,
            input: stateMovement.stateInput
          })
        }
      }
    }else{
      // for non continueAsNew, there can be at most only one starting state
      if(workflowInput.startStateId){
        startingStateLookup.set(workflowInput.startStateId,
            [{
              index: 0,
              option: workflowInput.stateOptions,
              input: workflowInput.stateInput
            }])
      }
    }

    const startEvent:IwfHistoryEvent = {
      eventType: "WorkflowStarted",
      workflowStarted: {
        workflowStartedTimestamp: startTimeSeconds,
        workflowType: workflowType,
        input: workflowInput,
        continueAsNewSnapshot: continueAsNewSnapshot
      }
    }
    historyEvents.push(startEvent);
    
    // Iterate through raw Temporal events starting from the second event
    // Note that we always start from 1, even it could include continueAsNew.
    // Because there could be some signals during continueAsNew activity
    for (let i = 1; i < rawHistories.events.length; i++) {
      const event = rawHistories.events[i];
      if (event.activityTaskScheduledEventAttributes) {
        processActivityTaskScheduledEvent(
          event, 
          dataConverter, 
          historyEvents, 
          historyLookupByScheduledId, 
          stateExecutionIdToWaitUntilIndex, 
          startingStateLookup, 
          continueAsNewActivityScheduleIds
        );
      } else if (event.activityTaskCompletedEventAttributes) {
        processActivityTaskCompletedEvent(
          event, 
          dataConverter, 
          historyEvents, 
          historyLookupByScheduledId, 
          startingStateLookup, 
          continueAsNewActivityScheduleIds
        );
      } else if (event.workflowExecutionSignaledEventAttributes) {
        // TODO processing RPC (regular) and signal
        console.log(`  signal received=${event}`);
      } else if (event.activityTaskFailedEventAttributes) {
        // TODO process the stateApiFailure policy
      } else if (event.workflowExecutionCompletedEventAttributes ||
          event.workflowExecutionFailedEventAttributes ||
          event.workflowExecutionCanceledEventAttributes ||
          event.workflowExecutionContinuedAsNewEventAttributes ||
          event.workflowExecutionTerminatedEventAttributes ||
          event.workflowExecutionTimedOutEventAttributes) {
        
        processWorkflowClosedEvent(event, statusCode, dataConverter, historyEvents);
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
      // input: workflowInput,
      // continueAsNewSnapshot: continueAsNewSnapshot,
      historyEvents: historyEvents
    };

    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    // Handle specific Temporal errors
    console.error('Temporal API error:', error);

    return NextResponse.json({
      detail: "Error retrieving workflow details: "+ error.message,
      error: error.message,
      errorType: "TEMPORAL_API_ERROR"
    }, { status: 400 });
  }
}