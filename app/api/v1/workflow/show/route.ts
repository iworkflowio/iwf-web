import { NextRequest, NextResponse } from 'next/server';
import { Connection, WorkflowClient } from '@temporalio/client';
import { 
  WorkflowShowRequest, 
  WorkflowShowResponse,
  InterpreterWorkflowInput,
  ContinueAsNewDumpResponse,
  IwfHistoryEvent 
} from '../../../../ts-api/src/api-gen/api';
import { temporalConfig, mapTemporalStatus, extractStringValue } from '../utils';


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