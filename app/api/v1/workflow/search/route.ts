import { NextRequest, NextResponse } from 'next/server';

// Mock data for workflow executions
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
      }
    ]
  }
];

// Filter mock data based on the query
const filterWorkflows = (query: string) => {
  if (!query) {
    return mockWorkflowExecutions;
  }
  
  return mockWorkflowExecutions.filter(workflow => {
    // Search in workflowId, workflowType, or workflowStatus
    return (
      workflow.workflowId.toLowerCase().includes(query.toLowerCase()) ||
      workflow.workflowType.toLowerCase().includes(query.toLowerCase()) ||
      workflow.workflowStatus.toLowerCase().includes(query.toLowerCase()) ||
      // Also search in custom search attributes
      workflow.customSearchAttributes.some(attr => 
        attr.stringValue?.toLowerCase().includes(query.toLowerCase())
      )
    );
  });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, pageSize = 10, nextPageToken = "" } = body;
    
    const filteredWorkflows = filterWorkflows(query);
    
    // Mock pagination
    const response = {
      workflowExecutions: filteredWorkflows,
      nextPageToken: "" // No more pages in our mock
    };
    
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error processing workflow search request:", error);
    return NextResponse.json(
      { detail: "Failed to process request" },
      { status: 400 }
    );
  }
}