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
  switch (status) {
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
    default:
      return 'RUNNING';
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
  let iwfWorkflowType = '';
  if (workflow.searchAttributes && workflow.searchAttributes['IwfWorkflowType']) {
    iwfWorkflowType = extractStringValue(workflow.searchAttributes['IwfWorkflowType']);
  }
  
  // Get the workflow type name from Temporal
  let temporalWorkflowType = '';
  if (workflow.workflowType) {
    if (typeof workflow.workflowType === 'string') {
      temporalWorkflowType = workflow.workflowType;
    } else if (typeof workflow.workflowType === 'object' && workflow.workflowType !== null) {
      temporalWorkflowType = workflow.workflowType.name || 'Unknown Type';
    }
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
    // Prefer the IwfWorkflowType from search attributes if available, otherwise fall back to Temporal's type
    workflowType: iwfWorkflowType || temporalWorkflowType,
    workflowStatus: mapTemporalStatus(workflow.status.name),
    historySizeInBytes: workflow.historySize || 0,
    historyLength: workflow.historyLength || 0,
    startTime: workflow.startTime.getTime(),
    closeTime: workflow.closeTime ? workflow.closeTime.getTime() : undefined,
    taskQueue: workflow.taskQueue,
    customSearchAttributes: searchAttributes,
  };
};

// Mock data for fallback when Temporal connection fails
const mockWorkflowExecutions = [
  {
    workflowId: "workflow-1",
    workflowRunId: "run-1",
    workflowType: "ProcessOrder",
    workflowStatus: "RUNNING",
    historySizeInBytes: 1024,
    historyLength: 10,
    startTime: Date.now() - 3600000, // 1 hour ago
    closeTime: 0, // Not closed yet
    taskQueue: "default",
    customSearchAttributes: [
      {
        key: "customer_id",
        stringValue: "cust-123",
        valueType: "KEYWORD"
      },
      {
        key: "priority",
        integerValue: 1,
        valueType: "INT"
      },
      {
        key: "is_premium",
        boolValue: true,
        valueType: "BOOL"
      }
    ]
  },
  {
    workflowId: "workflow-2",
    workflowRunId: "run-2",
    workflowType: "ProcessPayment",
    workflowStatus: "COMPLETED",
    historySizeInBytes: 2048,
    historyLength: 15,
    startTime: Date.now() - 7200000, // 2 hours ago
    closeTime: Date.now() - 3600000, // 1 hour ago
    taskQueue: "payment",
    customSearchAttributes: [
      {
        key: "payment_id",
        stringValue: "pay-456",
        valueType: "KEYWORD"
      },
      {
        key: "amount",
        doubleValue: 99.99,
        valueType: "DOUBLE"
      }
    ]
  },
  {
    workflowId: "workflow-3",
    workflowRunId: "run-3",
    workflowType: "ShipOrder",
    workflowStatus: "FAILED",
    historySizeInBytes: 512,
    historyLength: 5,
    startTime: Date.now() - 10800000, // 3 hours ago
    closeTime: Date.now() - 9000000, // 2.5 hours ago
    taskQueue: "shipping",
    customSearchAttributes: [
      {
        key: "order_id",
        stringValue: "ord-789",
        valueType: "KEYWORD"
      },
      {
        key: "shipping_dates",
        stringArrayValue: ["2025-02-20", "2025-02-25"],
        valueType: "KEYWORD_ARRAY"
      }
    ]
  }
];

// Filter mock data based on the query
const filterMockWorkflows = (query: string) => {
  if (!query) {
    return mockWorkflowExecutions;
  }
  
  const queryLower = query.toLowerCase();
  
  return mockWorkflowExecutions.filter(workflow => {
    // Search in workflowId, workflowType, or workflowStatus
    if (
      workflow.workflowId.toLowerCase().includes(queryLower) ||
      (workflow.workflowType && workflow.workflowType.toLowerCase().includes(queryLower)) ||
      (workflow.workflowStatus && workflow.workflowStatus.toLowerCase().includes(queryLower)) ||
      (workflow.taskQueue && workflow.taskQueue.toLowerCase().includes(queryLower))
    ) {
      return true;
    }
    
    // Search in custom search attributes
    if (workflow.customSearchAttributes && workflow.customSearchAttributes.some(attr => {
      if (attr.key && attr.key.toLowerCase().includes(queryLower)) return true;
      if (attr.stringValue && attr.stringValue.toLowerCase().includes(queryLower)) return true;
      if (attr.stringArrayValue && attr.stringArrayValue.some(val => val.toLowerCase().includes(queryLower))) return true;
      if (attr.valueType && attr.valueType.toLowerCase().includes(queryLower)) return true;
      
      // Convert numeric and boolean values to string for searching
      if (attr.integerValue !== undefined && attr.integerValue.toString().includes(queryLower)) return true;
      if (attr.doubleValue !== undefined && attr.doubleValue.toString().includes(queryLower)) return true;
      if (attr.boolValue !== undefined && attr.boolValue.toString().toLowerCase().includes(queryLower)) return true;
      
      return false;
    })) {
      return true;
    }
    
    return false;
  });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, pageSize = 10, nextPageToken = "" } = body;

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
      
      // Build query for Temporal - correct format based on examples
      let queryString = '';
      if (query) {
        // Include search within the iWF-specific workflow type attribute
        queryString = `WorkflowId = '${query}' OR WorkflowType = '${query}' OR TaskQueue = '${query}' OR IwfWorkflowType = '${query}'`;
      }

      // Use the ListWorkflowExecutions method from service client
      const listResponse = await service.listWorkflowExecutions({
        namespace: temporalConfig.namespace,
        pageSize: Number(pageSize),
        nextPageToken: nextPageToken ? Buffer.from(nextPageToken, 'base64') : undefined,
        query: queryString || undefined,
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
          workflowId: execution.execution?.workflowId || '',
          runId: execution.execution?.runId || '',
          workflowType: { name: workflowTypeStr },
          status: { name: execution.status?.toString() || 'RUNNING' },
          historyLength: execution.historyLength?.toString() ? parseInt(execution.historyLength.toString()) : 0,
          historySize: execution.historySizeBytes?.toString() ? parseInt(execution.historySizeBytes.toString()) : 0,
          startTime: execution.startTime ? new Date(Number(execution.startTime.seconds) * 1000) : new Date(),
          closeTime: execution.closeTime ? new Date(Number(execution.closeTime.seconds) * 1000) : undefined,
          searchAttributes: searchAttributes,
          taskQueue: execution?.taskQueue || ''
        } as unknown as WorkflowExecutionInfo;
        
        return convertTemporalWorkflow(clientWorkflow);
      });

      // Build and return response
      return NextResponse.json({
        workflowExecutions: mappedWorkflows,
        nextPageToken: listResponse.nextPageToken?.toString() || '',
      }, { status: 200 });
      
    } catch (temporalError) {
      // If Temporal connection fails, fall back to mock data
      console.warn('Failed to connect to Temporal, using mock data:', temporalError);
      
      const filteredWorkflows = filterMockWorkflows(query);
      
      return NextResponse.json({
        workflowExecutions: filteredWorkflows,
        nextPageToken: '',
        _mockData: true, // Flag to indicate mock data is being used
      }, { status: 200 });
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