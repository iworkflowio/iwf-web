import { NextRequest, NextResponse } from 'next/server';
import { Connection, WorkflowClient, WorkflowExecutionInfo } from '@temporalio/client';
import { WorkflowStatus } from '../../../../ts-api/src/api-gen/api';

// Configuration for Temporal connection
const temporalConfig = {
  // Default connection parameters, can be overridden with environment variables
  hostPort: process.env.TEMPORAL_HOST_PORT || 'localhost:7233',
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
};

// Mapping Temporal workflow status to our API status
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

// Helper function to get a string value from a possible complex object
function extractStringValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    // Check for Buffer or PayloadData types
    if (value.data && typeof value.data !== 'object') {
      return String(value.data);
    }
    
    // Try toString - if it's not the default Object toString result
    const strValue = value.toString();
    if (strValue !== '[object Object]') {
      return strValue;
    }
    
    // Last resort - convert to JSON
    try {
      return JSON.stringify(value);
    } catch (e) {
      return 'Complex Value';
    }
  }
  
  return 'Unknown Value';
}

// Convert Temporal workflow info to our API format
const convertTemporalWorkflow = (workflow: WorkflowExecutionInfo) => {
  // First find the iWF workflow type from search attributes if it exists
  let wfType = '';
  if (workflow.searchAttributes && workflow.searchAttributes['IwfWorkflowType']) {
    wfType = extractStringValue(workflow.searchAttributes['IwfWorkflowType']);
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
  };
};

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
      // Create connection to Temporal
      const connection = await Connection.connect({
        address: temporalConfig.hostPort,
      });

      // Create a client to interact with Temporal
      const client = new WorkflowClient({
        connection,
        namespace: temporalConfig.namespace,
      });

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
      
      // Handle next page token with extra care to avoid deserialization issues
      let tokenBuffer = undefined;
      if (nextPageToken && typeof nextPageToken === 'string' && nextPageToken.trim() !== '') {
        try {
          // Only try to use the token if it's a non-empty string that looks like proper base64
          if (/^[A-Za-z0-9+/=]+$/.test(nextPageToken)) {
            tokenBuffer = Buffer.from(nextPageToken, 'base64');
            console.log("Successfully converted token to buffer");
          } else {
            console.log("Token is not valid base64, skipping");
          }
        } catch (err) {
          console.error("Error converting token to buffer:", err);
          // Ignore invalid tokens - just use undefined
        }
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
        const searchAttributes: Record<string, any> = {};
        
        try {
          // Try to convert indexed fields to a usable format
          if (execution.searchAttributes?.indexedFields) {
            Object.entries(execution.searchAttributes.indexedFields).forEach(([key, value]) => {
              if (value) {
                // Try to convert Buffer/data to string
                if (value.data) {
                  try {
                    const dataStr = value.data.toString();
                    try {
                      // Try to parse as JSON
                      searchAttributes[key] = JSON.parse(dataStr);
                    } catch (e) {
                      // If not valid JSON, use as string
                      searchAttributes[key] = dataStr;
                    }
                  } catch (e) {
                    // If can't convert to string, store as-is
                    searchAttributes[key] = value;
                  }
                } else {
                  // No data field, store as-is
                  searchAttributes[key] = value;
                }
              }
            });
          }
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

      // Safely convert the next page token to a string
      let nextPageTokenString = '';
      if (listResponse.nextPageToken && listResponse.nextPageToken.length > 0) {
        try {
          // Convert the Buffer to a Base64 string
          nextPageTokenString = Buffer.from(listResponse.nextPageToken).toString('base64');
          console.log("Generated next page token:", nextPageTokenString.substring(0, 20) + "...");
        } catch (err) {
          console.error("Error encoding next page token:", err);
          // Just return empty string if encoding fails
        }
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