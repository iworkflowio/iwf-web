import { NextRequest, NextResponse } from 'next/server';
import { Connection, WorkflowClient, WorkflowExecutionInfo } from '@temporalio/client';
import { 
  WorkflowStatus, 
  WorkflowShowRequest, 
  WorkflowShowResponse,
  InterpreterWorkflowInput,
  ContinueAsNewDumpResponse,
  IwfHistoryEvent 
} from '../../../../ts-api/src/api-gen/api';

// Configuration for Temporal connection
const temporalConfig = {
  // Default connection parameters, can be overridden with environment variables
  hostPort: process.env.TEMPORAL_HOST_PORT || 'localhost:7233',
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
};

// Map Temporal workflow status to our API status
const mapTemporalStatus = (status: string): WorkflowStatus => {
  // Normalize the status by converting to uppercase and removing any prefixes
  const normalizedStatus = (status || '').toString().toUpperCase().trim();
  
  // Sometimes status comes with 'WORKFLOW_EXECUTION_STATUS_' prefix
  const statusWithoutPrefix = normalizedStatus.replace('WORKFLOW_EXECUTION_STATUS_', '');
  
  switch (statusWithoutPrefix) {
    case 'RUNNING':
      return 'RUNNING';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELED':
      return 'CANCELED';
    case 'TERMINATED':
      return 'TERMINATED';
    case 'CONTINUED_AS_NEW':
      return 'CONTINUED_AS_NEW';
    case 'TIMED_OUT':
      return 'TIMEOUT';
    case '1': // Sometimes Temporal returns numeric status codes
      return 'RUNNING';
    case '2':
      return 'COMPLETED';
    case '3':
      return 'FAILED';
    case '4':
      return 'CANCELED';
    case '5':
      return 'TERMINATED';
    case '6':
      return 'CONTINUED_AS_NEW';
    case '7':
      return 'TIMEOUT';
    default:
      throw new Error(`Unknown workflow status: ${status} (normalized: ${statusWithoutPrefix})`);
  }
};

// Extract workflow input from history events
const extractWorkflowInput = (workflow: any): InterpreterWorkflowInput => {
  // This would need to be implemented based on how the input is stored
  // For now, we'll return a minimal object to satisfy the type
  
  // Default empty input
  const emptyInput: InterpreterWorkflowInput = {
    iwfWorkflowType: workflow?.searchAttributes?.IwfWorkflowType || workflow?.type || '',
    iwfWorkerUrl: workflow?.searchAttributes?.IwfWorkerUrl || '',
  };
  
  try {
    // In a real implementation, we would extract the input from the workflow history
    // or from special search attributes/memo fields
    
    // For now, just check if there are relevant search attributes
    if (workflow?.searchAttributes) {
      // Extract whatever workflow input details we can find
      if (workflow.searchAttributes.IwfWorkflowType) {
        emptyInput.iwfWorkflowType = workflow.searchAttributes.IwfWorkflowType;
      }
      
      if (workflow.searchAttributes.IwfWorkerUrl) {
        emptyInput.iwfWorkerUrl = workflow.searchAttributes.IwfWorkerUrl;
      }
    }
    
    return emptyInput;
  } catch (error) {
    console.error("Error extracting workflow input:", error);
    return emptyInput;
  }
};

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
    const workflow = await client.describe(params.workflowId, params.runId);
    
    // Check if this is an iWF workflow
    const isIwf = !!(workflow.searchAttributes && workflow.searchAttributes['IwfWorkflowType']);
    
    // Get workflow type - from IwfWorkflowType search attribute or fallback to Temporal workflow type
    let workflowType = workflow.type;
    if (isIwf && workflow.searchAttributes && workflow.searchAttributes['IwfWorkflowType']) {
      const iwfType = workflow.searchAttributes['IwfWorkflowType'];
      workflowType = typeof iwfType === 'string' ? iwfType : String(iwfType);
    }
    
    // Extract the workflow input
    const input = extractWorkflowInput(workflow);
    
    // Build the response
    const response: WorkflowShowResponse = {
      workflowStartedTimestamp: workflow.startTime.getTime(),
      workflowType: workflowType,
      input: input,
      status: mapTemporalStatus(workflow.status.name),
      // For the initial implementation, we won't populate these fields
      // which would require more complex processing
      continueAsNewSnapshot: undefined,
      historyEvents: []
    };
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (temporalError) {
    // Handle specific Temporal errors
    console.error('Temporal API error:', temporalError);
    
    // Create a user-friendly error message
    const errorMessage = temporalError instanceof Error 
      ? temporalError.message 
      : "Unknown Temporal error occurred";
    
    // Check if the error is "Workflow not found"
    if (errorMessage.includes("Workflow execution not found") || 
        errorMessage.includes("Entity not found")) {
      return NextResponse.json({
        detail: "Workflow not found",
        error: errorMessage,
        errorType: "WORKFLOW_NOT_FOUND"
      }, { status: 404 });
    }
    
    return NextResponse.json({
      detail: "Error retrieving workflow details",
      error: errorMessage,
      errorType: "TEMPORAL_API_ERROR"
    }, { status: 400 });
  }
}