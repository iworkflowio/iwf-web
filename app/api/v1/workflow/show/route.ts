import { NextRequest, NextResponse } from 'next/server';
import { Connection, WorkflowClient } from '@temporalio/client';
import { 
  WorkflowShowRequest, 
  WorkflowShowResponse,
  InterpreterWorkflowInput,
  ContinueAsNewDumpResponse,
  IwfHistoryEvent 
} from '../../../../ts-api/src/api-gen/api';
import {temporalConfig, mapTemporalStatus, extractStringValue, decodeSearchAttributes} from '../utils';

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
    const workflow = await client.workflowService.describeWorkflowExecution(
        {
          namespace: temporalConfig.namespace,
          execution:{
            workflowId: params.workflowId,
            runId: params.runId
          }
    });
    
    console.log("Retrieved workflow details:", workflow);
    
    // Access the workflowExecutionInfo from the response
    const workflowInfo = workflow.workflowExecutionInfo;
    
    if (!workflowInfo) {
      throw new Error("Workflow execution info not found in the response");
    }
    
    // Extract search attributes and decode them properly using the utility function
    const searchAttributes = decodeSearchAttributes(workflowInfo.searchAttributes);
    console.log("Decoded search attributes:", searchAttributes);
    
    // Get workflow type - preferring IwfWorkflowType search attribute 
    let workflowType = workflowInfo.type?.name || 'Unknown';
    if (searchAttributes.IwfWorkflowType) {
      // Use the IwfWorkflowType from search attributes
      workflowType = typeof searchAttributes.IwfWorkflowType === 'string' 
        ? searchAttributes.IwfWorkflowType 
        : extractStringValue(searchAttributes.IwfWorkflowType);
    }
    
    // Extract timestamp from the Temporal format
    let startTimeMs = 0;
    if (workflowInfo.startTime?.seconds) {
      // Convert seconds to milliseconds (handling both number and Long)
      const seconds = typeof workflowInfo.startTime.seconds === 'number' 
        ? workflowInfo.startTime.seconds 
        : Number(workflowInfo.startTime.seconds);
      const nanos = workflowInfo.startTime.nanos || 0;
      startTimeMs = seconds * 1000 + Math.floor(nanos / 1000000);
    }
    
    // Map numeric status code to status enum
    const statusCode = workflowInfo.status;
    
    // Build the response
    const response: WorkflowShowResponse = {
      workflowStartedTimestamp: startTimeMs,
      workflowType: workflowType,
      status: statusCode ? mapTemporalStatus(String(statusCode)):undefined,
      // Per requirements, set these fields to undefined
      input: undefined,
      continueAsNewSnapshot: undefined,
      historyEvents: undefined
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