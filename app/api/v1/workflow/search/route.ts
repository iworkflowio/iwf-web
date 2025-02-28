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
    ],
    customTags: [
      "priority-high",
      "region-west",
      "customer-tier-1"
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
    ],
    customTags: [
      "payment-method-card",
      "region-east"
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
    ],
    customTags: [
      "shipping-method-express",
      "carrier-fedex",
      "international"
    ]
  },
  {
    workflowId: "workflow-4",
    workflowRunId: "run-4",
    workflowType: "InventoryUpdate",
    workflowStatus: "RUNNING",
    historySizeInBytes: 4096,
    historyLength: 20,
    startTime: Date.now() - 43200000, // 12 hours ago
    closeTime: 0, // Not closed yet
    taskQueue: "inventory",
    customSearchAttributes: [
      {
        key: "product_ids",
        stringArrayValue: ["prod-123", "prod-456", "prod-789"],
        valueType: "KEYWORD_ARRAY"
      },
      {
        key: "warehouse_id",
        stringValue: "wh-567",
        valueType: "KEYWORD"
      },
      {
        key: "last_update",
        stringValue: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
        valueType: "DATETIME"
      }
    ],
    customTags: [
      "batch-update",
      "priority-low",
      "scheduled-job"
    ]
  }
];

// Filter mock data based on the query
const filterWorkflows = (query: string) => {
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
    
    // Search in custom tags
    if (workflow.customTags && workflow.customTags.some(tag => tag.toLowerCase().includes(queryLower))) {
      return true;
    }
    
    return false;
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