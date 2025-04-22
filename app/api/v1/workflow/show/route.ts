import {NextRequest, NextResponse} from 'next/server';
import {WorkflowClient} from '@temporalio/client';
import {
  ContinueAsNewDumpResponse,
  EncodedObject, ExecuteRpcSignalRequest,
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
import {createWorkflowClient} from '../clientManager';

// Helper function to extract stateId from stateExecutionId
function extractStateIdFromExecutionId(stateExecutionId: string): string {
  // StateExecutionId format is typically "stateId-number"
  const lastDashIndex = stateExecutionId.lastIndexOf('-');
  return lastDashIndex > 0 ? stateExecutionId.substring(0, lastDashIndex) : stateExecutionId;
}

// Helper function to parse Golang time.Time format to Unix timestamp in seconds
function parseGoTimeToUnixSeconds(goTime: string): number {
  try {
    // Example format: 2025-04-22T17:41:00.910017909Z
    const date = new Date(goTime);
    return Math.floor(date.getTime() / 1000); // Convert to seconds
  } catch (error) {
    console.error('Error parsing Golang time format:', error);
    return 0;
  }
}

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

// Common handler implementation for both GET and POST
async function handleWorkflowShowRequest(params: WorkflowShowRequest) {
  try {
    // Create a client to interact with Temporal using the shared utility
    const client = await createWorkflowClient();

    // Get workflow details
    const workflowDetails = await handleDescribeWorkflowExecution(client, params);
    
    // Check for error response
    if (workflowDetails.error) {
      return NextResponse.json(workflowDetails.error, { status: workflowDetails.status });
    }
    
    const { workflowType, startTimeSeconds, statusCode } = workflowDetails;

    // Now fetch history and get the other fields
    // TODO support configuring data converter(for encryption)
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
    // Make sure remove the key/value from startingStateLookup after reading
    let startingStateLookup: Map<string, IndexAndStateOption[]> = new Map();
    const continueAsNewActivityScheduleIds = new Map<number, boolean>();

    // 0 is always the started event
    // -1 (or <0) is unknown.
    const historyEvents: IwfHistoryEvent[] = []

    // Extract and process history events
    // Convert the raw input to InterpreterWorkflowInput type
    const workflowInput: InterpreterWorkflowInput = startInputs[0] as InterpreterWorkflowInput

    const startEvent:IwfHistoryEvent = {
      eventType: "WorkflowStarted",
      workflowStarted: {
        workflowStartedTimestamp: startTimeSeconds,
        workflowType: workflowType,
        input: workflowInput,
      }
    }
    historyEvents.push(startEvent);

    // Build the response
    const response: WorkflowShowResponse = {
      workflowStartedTimestamp: startTimeSeconds,
      workflowType: workflowType,
      status: statusCode ? mapTemporalStatus(String(statusCode)):undefined,
      historyEvents: historyEvents,
      runId: workflowDetails.runId
    };

    if(workflowInput.isResumeFromContinueAsNew){
      const continueAsNewResult = handleResumeFromContinueAsNew(
        rawHistories,
        dataConverter,
        startEvent,
        stateExecutionIdToWaitUntilIndex,
        startingStateLookup,
        continueAsNewActivityScheduleIds
      );
      
      // Check if we should return early
      if (continueAsNewResult.shouldReturn) {
        return NextResponse.json(response, { status: 200 });
      }
      
    } else {
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
        processWorkflowSignalEvent(event, dataConverter, historyEvents);
      } else if (event.activityTaskFailedEventAttributes) {
        // TODO process the activity failed event (with stateApiFailure policy)
      } else if (event.workflowExecutionCompletedEventAttributes ||
          event.workflowExecutionFailedEventAttributes ||
          event.workflowExecutionCanceledEventAttributes ||
          event.workflowExecutionContinuedAsNewEventAttributes ||
          event.workflowExecutionTerminatedEventAttributes ||
          event.workflowExecutionTimedOutEventAttributes) {
        
        processWorkflowClosedEvent(event, statusCode, dataConverter, historyEvents);
      }else if(event.markerRecordedEventAttributes){
        processLocalActivityEvent(
          event,
          dataConverter,
          historyEvents,
          stateExecutionIdToWaitUntilIndex,
          startingStateLookup
        );
      }else if(event.workflowExecutionUpdateCompletedEventAttributes){
        // TODO workflow update event for rpc locking
      }else if(event.activityTaskStartedEventAttributes){
        // TODO process activity task started event for last failure details
      }
      // ignore all remaining events:
      //    upsert search attributes,
      //    update accepted & admitted,
      //    cancel requested,
      //    timer started/fired/canceled,
      //    activity canceled.
      //
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Server error:', error);

    return NextResponse.json({
      detail: "Error retrieving workflow details: "+ error.message,
      error: error.message,
      errorType: "SERVER_API_ERROR"
    }, { status: 400 });
  }
}


// Helper function to handle describeWorkflowExecution call
async function handleDescribeWorkflowExecution(client: WorkflowClient, params: WorkflowShowRequest) {
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
  } else {
    return {
      error: {
        detail: "Not an iWF workflow execution",
        error: `unsupported temporal workflow type ${workflowInfo.type}`,
        errorType: "TEMPORAL_API_ERROR"
      },
      status: 400
    };
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

  return {
    workflowType,
    startTimeSeconds,
    statusCode: workflowInfo.status,
    runId: workflowInfo.execution.runId
  };
}

// Helper function to handle resume from continue as new logic
function handleResumeFromContinueAsNew(
  rawHistories: any,
  dataConverter: LoadedDataConverter,
  startEvent: IwfHistoryEvent,
  stateExecutionIdToWaitUntilIndex: Map<string, number>,
  startingStateLookup: Map<string, IndexAndStateOption[]>,
  continueAsNewActivityScheduleIds: Map<number, boolean>
) {
  let currentChecksum = "";
  let jsonData = "";
  let continueAsNewSnapshot: ContinueAsNewDumpResponse | undefined;
  let shouldReturn = false;
  
  // Extract continueAsNew data from history events
  for (let i = 1; i < rawHistories.events.length; i++) {
    const event = rawHistories.events[i];
    if (event.activityTaskScheduledEventAttributes) {
      if(event.activityTaskScheduledEventAttributes.activityType.name != "DumpWorkflowInternal"){
        break;
      }
      continueAsNewActivityScheduleIds.set(event.eventId.toNumber(), true);
    }
    if (event.activityTaskCompletedEventAttributes) {
      // just assuming it's continueAsNew and try to decode it
      const result = event.activityTaskCompletedEventAttributes.result?.payloads;
      // Decode the response from the payload
      const responseData = arrayFromPayloads(dataConverter.payloadConverter, result);
      // this must be a continueAsNew dump activity completed event,
      // because there shouldn't any other activity before continueAsNew dump is completed.
      const dump = responseData[0] as WorkflowDumpResponse;
      if(dump.checksum != currentChecksum){
        // always reset when checksum changed
        currentChecksum = dump.checksum;
        jsonData = "";
      }
      jsonData += dump.jsonData;
    }
  }
  
  // Parse the JSON data, or return early if parsing fails
  try {
    continueAsNewSnapshot = JSON.parse(jsonData) as ContinueAsNewDumpResponse;
  } catch (error) {
    shouldReturn = true;
    return { continueAsNewSnapshot, shouldReturn };
  }
  
  // Update startEvent with the snapshot
  startEvent.workflowStarted.continueAsNewSnapshot = continueAsNewSnapshot;

  // Update stateExecutionIdToWaitUntilIndex
  for(const key in continueAsNewSnapshot.StateExecutionsToResume){
    stateExecutionIdToWaitUntilIndex.set(key, 0);
  }

  // Update startingStateLookup
  const length: number = continueAsNewSnapshot.StatesToStartFromBeginning ? 
    continueAsNewSnapshot.StatesToStartFromBeginning.length : 0;
    
  for (let i = 0; i < length; i++) {
    const stateMovement = continueAsNewSnapshot.StatesToStartFromBeginning[i];
    const stateId = stateMovement.stateId;
    let lookup: IndexAndStateOption[] = startingStateLookup.get(stateId);
    
    // Check if lookup is undefined or empty
    if (!lookup || lookup.length === 0) {
      startingStateLookup.set(stateId, [{
        index: 0,
        option: stateMovement.stateOptions,
        input: stateMovement.stateInput
      }]);
    } else {
      lookup.push({
        index: 0,
        option: stateMovement.stateOptions,
        input: stateMovement.stateInput
      });
    }
  }
  
  return { shouldReturn };
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
    // activity for RPC locking can be ignored because the input/output can be found in update events
  } else if (activityType === "DumpWorkflowInternal") {
    // activity for continueAsNew can be ignored because they are already processed
  }else{
    throw new Error("unsupported activity type: " + activityType)
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

  // TODO add number of attempts for the activity

  if (historyEvents[indexToUpdate].eventType === "StateWaitUntil") {
    processStateWaitUntilCompleted(event, dataConverter, historyEvents, indexToUpdate);
  } else if (historyEvents[indexToUpdate].eventType === "StateExecute") {
    processStateExecuteCompleted(event, dataConverter, historyEvents, indexToUpdate, startingStateLookup);
  } else {
    // activity for RPC locking can be ignored because the input/output can be found in update events
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



// Process local activity marker events
function processLocalActivityEvent(
  event: temporal.api.history.v1.IHistoryEvent,
  dataConverter: LoadedDataConverter,
  historyEvents: IwfHistoryEvent[],
  stateExecutionIdToWaitUntilIndex: Map<string, number>,
  startingStateLookup: Map<string, IndexAndStateOption[]>
) {
  const markerAttributes = event.markerRecordedEventAttributes;
  
  // First, check if the marker name is LocalActivity
  if (markerAttributes.markerName === 'LocalActivity') {
    // Ignore if the "failure" field is not empty (failed local activities)
    if (!markerAttributes.failure) {
      try {
        // Process "details" field as a map of key to encoded payload
        const details = markerAttributes.details;
        if (details) {
          // Decode the "data" field, which contains an object with 'ActivityType' field
          const dataPayload = details['data']?.payloads;
          if (dataPayload) {
            const dataValue = arrayFromPayloads(dataConverter.payloadConverter, dataPayload)[0] as any;
            
            // Decode the "result" field, which contains an object
            const resultPayload = details['result']?.payloads;
            if (resultPayload) {
              const resultValue = arrayFromPayloads(dataConverter.payloadConverter, resultPayload)[0] as any;
              
              // Extract stateExecutionId from localActivityInput
              const localActivityInput = resultValue['localActivityInput'];
              let stateExecutionId = '';
              
              if (typeof localActivityInput === 'string' && localActivityInput.startsWith('stateExeId:')) {
                stateExecutionId = localActivityInput.substring('stateExeId:'.length).trim();
              }
              
              // Determine if this is a WaitUntil or Execute event based on the ActivityType field
              const activityType = dataValue['ActivityType'];
              
              if (activityType === 'StateApiWaitUntil' || resultValue['commandRequest']) {
                // Create StateWaitUntil event for commandRequest (WorkflowStateStartResponse)
                processLocalActivityWaitUntil(
                  dataValue,
                  resultValue,
                  stateExecutionId,
                  event,
                  historyEvents,
                  stateExecutionIdToWaitUntilIndex,
                  startingStateLookup
                );
              } else if (activityType === 'StateApiExecute' || resultValue['stateDecision']) {
                // Create StateExecute event for stateDecision (WorkflowStateDecideResponse)
                processLocalActivityExecute(
                  dataValue,
                  resultValue,
                  stateExecutionId,
                  event,
                  historyEvents,
                  stateExecutionIdToWaitUntilIndex,
                  startingStateLookup
                );
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing local activity marker:', error);
      }
    }
  }
}

// Process local activity wait until events
function processLocalActivityWaitUntil(
  dataValue: any,
  resultValue: any,
  stateExecutionId: string,
  event: temporal.api.history.v1.IHistoryEvent,
  historyEvents: IwfHistoryEvent[],
  stateExecutionIdToWaitUntilIndex: Map<string, number>,
  startingStateLookup?: Map<string, IndexAndStateOption[]>
) {
  // Extract stateId from stateExecutionId
  const stateId = extractStateIdFromExecutionId(stateExecutionId);
  
  // Initialize default values
  let fromEventId = 0;
  let input = undefined;
  let stateOptions = undefined;
  
  // Use startingStateLookup to look up source state info if available
  if (startingStateLookup && stateId) {
    const lookup = startingStateLookup.get(stateId);
    if (lookup && lookup.length > 0) {
      const from = lookup[0];
      lookup.shift();
      
      // Remove entry if empty
      if (lookup.length === 0) {
        startingStateLookup.delete(stateId);
      } else {
        startingStateLookup.set(stateId, lookup);
      }
      
      // Use values from lookup
      fromEventId = from.index;
      input = from.input;
      stateOptions = from.option;
    }
  }
  
  const waitUntilDetail: StateWaitUntilDetails = {
    stateExecutionId: stateExecutionId,
    stateId: stateId,
    fromEventId: fromEventId,
    input: input,
    stateOptions: stateOptions,
    response: resultValue['commandRequest'],
    completedTimestamp: event.eventTime.seconds.toNumber(),
    firstAttemptStartedTimestamp: dataValue['ReplayTime'] ? parseGoTimeToUnixSeconds(dataValue['ReplayTime']) : 0
  };
  
  const iwfEvent: IwfHistoryEvent = {
    eventType: "StateWaitUntil",
    stateWaitUntil: waitUntilDetail
  };
  
  historyEvents.push(iwfEvent);
  
  // If this is a StateWaitUntil, add to the stateExecutionIdToWaitUntilIndex map
  if (stateExecutionId) {
    stateExecutionIdToWaitUntilIndex.set(stateExecutionId, historyEvents.length - 1);
  }
}

// Process local activity execute events
function processLocalActivityExecute(
  dataValue: any,
  resultValue: any,
  stateExecutionId: string,
  event: temporal.api.history.v1.IHistoryEvent,
  historyEvents: IwfHistoryEvent[],
  stateExecutionIdToWaitUntilIndex: Map<string, number>,
  startingStateLookup: Map<string, IndexAndStateOption[]>
) {
  // Extract stateId from stateExecutionId
  const stateId = extractStateIdFromExecutionId(stateExecutionId);
  
  // Initialize default values
  let fromEventId = -1;
  let input = undefined;
  let stateOptions = undefined;
  
  // First, try to find the source from stateExecutionIdToWaitUntilIndex
  if (stateExecutionId && stateExecutionIdToWaitUntilIndex.has(stateExecutionId)) {
    const waitUntilIndex = stateExecutionIdToWaitUntilIndex.get(stateExecutionId);
    fromEventId = waitUntilIndex;
    
    // Copy input and stateOptions from the referenced waitUntil event
    const waitUntilEvent = historyEvents[waitUntilIndex];
    if (waitUntilEvent && waitUntilEvent.stateWaitUntil) {
      input = waitUntilEvent.stateWaitUntil.input;
      stateOptions = waitUntilEvent.stateWaitUntil.stateOptions;
    }
  } 
  // If not found in stateExecutionIdToWaitUntilIndex, try startingStateLookup
  else if (startingStateLookup && stateId) {
    const lookup = startingStateLookup.get(stateId);
    if (lookup && lookup.length > 0) {
      const from = lookup[0];
      lookup.shift();
      
      // Remove entry if empty
      if (lookup.length === 0) {
        startingStateLookup.delete(stateId);
      } else {
        startingStateLookup.set(stateId, lookup);
      }
      
      // Use values from lookup
      fromEventId = from.index;
      input = from.input;
      stateOptions = from.option;
    }
  }
  
  const executeDetail: StateExecuteDetails = {
    stateExecutionId: stateExecutionId,
    stateId: stateId,
    fromEventId: fromEventId,
    input: input,
    stateOptions: stateOptions,
    response: resultValue['stateDecision'],
    completedTimestamp: event.eventTime.seconds.toNumber(),
    firstAttemptStartedTimestamp: dataValue['ReplayTime'] ? parseGoTimeToUnixSeconds(dataValue['ReplayTime']) : 0
  };
  
  const iwfEvent: IwfHistoryEvent = {
    eventType: "StateExecute",
    stateExecute: executeDetail
  };
  
  historyEvents.push(iwfEvent);
  
  // Process next states if available
  const nextStates = resultValue['stateDecision']?.nextStates;
  if (nextStates) {
    for (const stateMovement of nextStates) {
      const indexOption: IndexAndStateOption = {
        index: historyEvents.length - 1,  // Current event index as the source
        option: stateMovement.stateOptions,
        input: stateMovement.stateInput
      };
      
      if (startingStateLookup.has(stateMovement.stateId)) {
        const existingOptions = startingStateLookup.get(stateMovement.stateId);
        existingOptions.push(indexOption);
        startingStateLookup.set(stateMovement.stateId, existingOptions);
      } else {
        startingStateLookup.set(stateMovement.stateId, [indexOption]);
      }
    }
  }
}

// Process workflow signal events
function processWorkflowSignalEvent(
  event: temporal.api.history.v1.IHistoryEvent,
  dataConverter: LoadedDataConverter,
  historyEvents: IwfHistoryEvent[]
) {
  const attributes = event.workflowExecutionSignaledEventAttributes;
  
  if (!attributes) {
    console.error("No signal attributes found in the event");
    return;
  }
  
  const signalName = attributes.signalName;
  const timestamp = event.eventTime.seconds.toNumber();
  
  // Check if this is an RPC execution
  if (signalName === "__IwfSystem_ExecuteRpc") {
    try {
      // This is an RPC signal, decode the input data
      const payload = attributes.input?.payloads;
      const rpcData = payload ? arrayFromPayloads(dataConverter.payloadConverter, payload)[0] : undefined;
      
      // Create RPC execution event
      const rpcEvent: IwfHistoryEvent = {
        eventType: "RpcExecution",
        rpcExecution: {
          response: rpcData as ExecuteRpcSignalRequest,
          completedTimestamp: timestamp
        }
      };
      
      historyEvents.push(rpcEvent);
    } catch (error) {
      console.error("Failed to process RPC execution signal:", error);
    }
  } else {
    // This is a regular signal
    try {
      // Decode the signal input data
      const payload = attributes.input?.payloads;
      const signalData = payload ? arrayFromPayloads(dataConverter.payloadConverter, payload)[0] : undefined;
      
      // Create signal received event
      const signalEvent: IwfHistoryEvent = {
        eventType: "SignalReceived",
        signalReceived: {
          signalName: signalName,
          value: signalData as any, // Cast to EncodedObject
          completedTimestamp: timestamp
        }
      };
      
      historyEvents.push(signalEvent);
    } catch (error) {
      console.error("Failed to process signal event:", error);
    }
  }
}
