import { NextRequest, NextResponse } from 'next/server';
import { WorkflowClient, WorkflowExecutionInfo } from '@temporalio/client';
import {temporalConfig, mapTemporalStatus, extractStringValue, decodeSearchAttributes} from '../utils';
import {createWorkflowClient, convertPageToken, convertBufferToTokenString} from '../clientManager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Extract parameters with safe defaults
    const { 
      query, 
      pageSize = 10, 
      nextPageToken = "" 
    } = body;
    
    // Debug log to help diagnose token issues
    console.log("Next page token type:", typeof nextPageToken, "value:", nextPageToken);

    try {
      // Create a client to interact with Temporal using the shared utility
      const client = await createWorkflowClient();

      // Get the service client to access more advanced APIs
      const service = client.workflowService
      
      // Transform query if it contains WorkflowType search to replace with IwfWorkflowType search
      let transformedQuery = query;
      
      // Special case: If query contains WorkflowType="X" or WorkflowType='X', replace with IwfWorkflowType="X"
      if (query && query.includes('WorkflowType')) {
        // support searching for both Temporal and iWF workflow types
        transformedQuery = query
          // Replace double-quoted WorkflowType
          .replace(/WorkflowType\s*=\s*"([^"]*)"/g, '(IwfWorkflowType="$1" OR WorkflowType="$1")')
          // Replace single-quoted WorkflowType  
          .replace(/WorkflowType\s*=\s*'([^']*)'/g, "(IwfWorkflowType='$1' OR WorkflowType='$1')");
      }

      if(transformedQuery){
        // filter to exclude iWF system workflow like WaitforStateCompletionWorkflow
        transformedQuery = `WorkflowType!='WaitforStateCompletionWorkflow' AND ${transformedQuery}`  
      }else{
        transformedQuery = "WorkflowType!='WaitforStateCompletionWorkflow'"
      }
      
      // Log the transformation if it changed
      if (transformedQuery !== query) {
        console.log(`Replaced query: Original [${query}] → Transformed [${transformedQuery}]`);
      }
      
      // Convert page token using our shared utility function
      const tokenBuffer = convertPageToken(nextPageToken);
      if (tokenBuffer) {
        console.log("Successfully converted token to buffer");
      } else {
        console.log("No valid token available or conversion failed");
      }
      
      // Use the ListWorkflowExecutions method from service client
      const listResponse = await service.listWorkflowExecutions({
        namespace: temporalConfig.namespace,
        pageSize: Number(pageSize) || 20,
        nextPageToken: tokenBuffer,
        query: transformedQuery || undefined,
      });

      // Convert the Temporal workflows to our API format
      const mappedWorkflows = (listResponse.executions || []).map(execution => {
        // Extract search attributes
        let searchAttributes: Record<string, any> = {};
        
        try {
          // Use the shared utility function to decode search attributes
          searchAttributes = decodeSearchAttributes(execution.searchAttributes);
        } catch (e) {
          console.error("Error processing search attributes:", e);
        }
        
        // Convert the protobuf workflow to a client WorkflowExecutionInfo
        const workflowTypeStr = execution.type?.name || 'Unknown';
        
        const clientWorkflow = {
          type: workflowTypeStr,
          workflowId: execution.execution?.workflowId || '',
          runId: execution.execution?.runId || '',
          status: { name: String(execution.status || 1) }, // Use numeric status if available
          historyLength: execution.historyLength?.toString() ? parseInt(execution.historyLength.toString()) : 0,
          historySize: execution.historySizeBytes?.toString() ? parseInt(execution.historySizeBytes.toString()) : 0,
          startTime: execution.startTime ? new Date(Number(execution.startTime.seconds) * 1000) : new Date(),
          closeTime: execution.closeTime ? new Date(Number(execution.closeTime.seconds) * 1000) : undefined,
          searchAttributes: searchAttributes,
          taskQueue: execution?.taskQueue || ''
        } as unknown as WorkflowExecutionInfo;
        
        return convertTemporalWorkflow(clientWorkflow);
      });

      // Convert the next page token buffer to a string using our shared utility
      const nextPageTokenString = convertBufferToTokenString(listResponse.nextPageToken);
      if (nextPageTokenString) {
        console.log("Generated next page token:", nextPageTokenString.substring(0, 20) + "...");
      }
      
      // Build and return response
      return NextResponse.json({
        workflowExecutions: mappedWorkflows,
        nextPageToken: nextPageTokenString,
      }, { status: 200 });
      
    } catch (temporalError) {
      // Propagate Temporal errors to the frontend
      console.error('Temporal API error:', temporalError);
      
      // Create a user-friendly error message
      const errorMessage = temporalError instanceof Error 
        ? temporalError.message 
        : "Unknown Temporal error occurred";
      
      return NextResponse.json({
        detail: "Error processing Temporal request",
        error: errorMessage,
        errorType: "TEMPORAL_API_ERROR"
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Error processing workflow search request:", error);
    
    // Provide more detailed error message for debugging
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error occurred";
    
    return NextResponse.json(
      { detail: "Failed to process request", error: errorMessage },
      { status: 500 }
    );
  }
}

// Convert Temporal workflow info to our API format
const convertTemporalWorkflow = (workflow: WorkflowExecutionInfo) => {
  // First find the iWF workflow type from search attributes if it exists
  let isIwf = false
  let wfType = '';
  if (workflow.searchAttributes && workflow.searchAttributes['IwfWorkflowType']) {
    wfType = extractStringValue(workflow.searchAttributes['IwfWorkflowType']);
    isIwf = true
  }else{
    wfType = workflow.type
  }

  // Extract search attributes from Temporal workflow
  const searchAttributes = Object.entries(workflow.searchAttributes || {})
      .filter(([key]) => {
        // Filter out Temporal system attributes, IwfWorkflowType (since we use it separately),
        // and specified hidden attributes
        return ![
          'TemporalScheduledStartTime',
          'TemporalScheduledById',
          'IwfWorkflowType',
          'TemporalChangeVersion',
          'BuildIds'
        ].includes(key);
      })
      .map(([key, value]) => {
        // Determine the type of value and create appropriate search attribute
        let searchAttr: any = { key };

        if (Array.isArray(value)) {
          searchAttr.stringArrayValue = value.map(v => extractStringValue(v));
          searchAttr.valueType = 'KEYWORD_ARRAY';
        } else if (typeof value === 'string') {
          // Check if it looks like a date (Temporal often returns dates as strings)
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            searchAttr.stringValue = value;
            searchAttr.valueType = 'DATETIME';
          } else {
            searchAttr.stringValue = value;
            searchAttr.valueType = 'KEYWORD';
          }
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            searchAttr.integerValue = value;
            searchAttr.valueType = 'INT';
          } else {
            searchAttr.doubleValue = value;
            searchAttr.valueType = 'DOUBLE';
          }
        } else if (typeof value === 'boolean') {
          searchAttr.boolValue = value;
          searchAttr.valueType = 'BOOL';
        } else if (value === null || value === undefined) {
          searchAttr.stringValue = '';
          searchAttr.valueType = 'KEYWORD';
        } else if (typeof value === 'object') {
          // Complex object - try to extract meaningful value
          searchAttr.stringValue = extractStringValue(value);
          searchAttr.valueType = 'KEYWORD';
        }

        return searchAttr;
      });

  return {
    workflowId: workflow.workflowId,
    workflowRunId: workflow.runId,
    // Only use IwfWorkflowType from search attributes, fallback to "N/A" if empty
    workflowType: wfType || 'N/A',
    workflowStatus: mapTemporalStatus(workflow.status.name),
    historySizeInBytes: workflow.historySize || 0,
    historyLength: workflow.historyLength || 0,
    startTime: workflow.startTime.getTime(),
    closeTime: workflow.closeTime ? workflow.closeTime.getTime() : undefined,
    taskQueue: workflow.taskQueue,
    customSearchAttributes: searchAttributes,
    isIwf: isIwf
  };
};