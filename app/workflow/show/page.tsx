'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  Node, 
  Edge, 
  MarkerType,
  NodeProps,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import Link from 'next/link';
import { useTimezoneManager } from '../../components/TimezoneManager';
import { formatTimestamp } from '../../components/utils';
import { WorkflowShowResponse, IwfHistoryEvent, IwfHistoryEventType } from '../../ts-api/src/api-gen/api';
import WorkflowTimeline from './WorkflowTimeline';
import WorkflowConfigPopup from './WorkflowConfigPopup';

// Custom node for workflow events
const WorkflowEventNode = ({ data }: NodeProps) => (
  <div className={`p-4 border rounded-md shadow-md ${data.className} mb-2`}>
    <div className="font-semibold mb-2">{data.label}</div>
    {data.details && (
      <div className="text-xs text-gray-600">
        {Object.entries(data.details).map(([key, value]) => (
          <div key={key} className="flex">
            <span className="font-medium mr-1">{key}:</span>
            <span>{String(value)}</span>
          </div>
        ))}
      </div>
    )}
    {data.expandable && (
      <button 
        className="text-xs mt-3 text-blue-500 hover:text-blue-700"
        onClick={data.onExpand}
      >
        {data.expanded ? 'Show less' : 'Show more'}
      </button>
    )}
  </div>
);

// Custom node types mapping
const nodeTypes = {
  workflowEvent: WorkflowEventNode,
};

// Get color for event type
const getEventColor = (eventType: IwfHistoryEventType): string => {
  switch (eventType) {
    case 'StateWaitUntil':
      return 'bg-yellow-50 border-yellow-300';
    case 'StateExecute':
      return 'bg-green-50 border-green-300';
    case 'RpcExecution':
      return 'bg-purple-50 border-purple-300';
    case 'SignalReceived':
      return 'bg-blue-50 border-blue-300';
    case 'WorkflowClosed':
      return 'bg-gray-50 border-gray-300';
    default:
      return 'bg-gray-50 border-gray-300';
  }
};

export default function WorkflowShow() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('workflowId');
  const runId = searchParams.get('runId');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowData, setWorkflowData] = useState<WorkflowShowResponse | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'graph'>('timeline');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  const { timezone } = useTimezoneManager();

  // Fetch workflow data
  useEffect(() => {
    if (!workflowId) {
      setError('Workflow ID is required');
      setLoading(false);
      return;
    }

    const fetchWorkflowData = async () => {
      try {
        const url = `/api/v1/workflow/show?workflowId=${encodeURIComponent(workflowId)}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch workflow data');
        }
        
        const data: WorkflowShowResponse = await response.json();
        setWorkflowData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching workflow data:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while fetching workflow data');
        setLoading(false);
      }
    };

    fetchWorkflowData();
  }, [workflowId, runId]);

  // Toggle expanded state for a node
  const toggleNodeExpanded = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Initialize ReactFlow graph when workflowData changes or when expandedNodes changes
  useEffect(() => {
    if (!workflowData || !workflowData.historyEvents || workflowData.historyEvents.length === 0) {
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Start node for workflow
    const startNodeId = 'workflow-start';
    newNodes.push({
      id: startNodeId,
      type: 'workflowEvent',
      position: { x: 250, y: 0 },
      data: {
        label: 'Workflow Started',
        details: {
          'Type': workflowData.workflowType || 'Unknown',
          'Started': formatTimestamp(workflowData.workflowStartedTimestamp * 1000, timezone)
        },
        className: 'bg-blue-50 border-blue-300'
      },
      // Add source position to improve edge routing
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    let lastNodeId = startNodeId;
    // Track execution IDs for proper edge connections
    let stateExecutionIdMap = new Map<string, string>();
    let yPosition = 100;
    const xPosition = 250;
    const yStep = 160; // Increased vertical spacing between nodes

    // Create nodes and edges for each history event
    workflowData.historyEvents.forEach((event, index) => {
      const nodeId = `event-${index}`;
      let label = '';
      let details: Record<string, any> = {};
      let sourceNodeId = lastNodeId;
      
      // Get event type and details based on event type
      switch (event.eventType) {
        case 'StateWaitUntil':
          if (event.stateWaitUntil) {
            label = `WaitUntil: ${event.stateWaitUntil.stateId}`;
            
            // Basic details for collapsed view
            details = {
              'State ID': event.stateWaitUntil.stateId,
              'Execution ID': event.stateWaitUntil.stateExecutionId?.substring(0, 8) + '...',
            };

            // Store the node ID for this execution ID for future reference
            if (event.stateWaitUntil.stateExecutionId) {
              stateExecutionIdMap.set(event.stateWaitUntil.stateExecutionId, nodeId);
            }
            
            // If this event has a fromEventId reference, connect from that event instead
            if (event.stateWaitUntil.fromEventId !== undefined && event.stateWaitUntil.fromEventId >= 0) {
              sourceNodeId = `event-${event.stateWaitUntil.fromEventId}`;
            }
            
            // Add expanded details if node is expanded
            if (expandedNodes.has(nodeId)) {
              details = {
                ...details,
                'Started': event.stateWaitUntil.firstAttemptStartedTimestamp ? 
                  formatTimestamp(event.stateWaitUntil.firstAttemptStartedTimestamp * 1000, timezone) : 'Unknown',
                'Completed': event.stateWaitUntil.completedTimestamp ? 
                  formatTimestamp(event.stateWaitUntil.completedTimestamp * 1000, timezone) : 'Unknown',
                'From Event': event.stateWaitUntil.fromEventId !== undefined ? 
                  event.stateWaitUntil.fromEventId : 'Unknown',
                'Input': event.stateWaitUntil.input ? 
                  JSON.stringify(event.stateWaitUntil.input).substring(0, 50) + '...' : 'None',
                'Response': event.stateWaitUntil.response ? 
                  JSON.stringify(event.stateWaitUntil.response).substring(0, 50) + '...' : 'None'
              };
            }
          }
          break;
          
        case 'StateExecute':
          if (event.stateExecute) {
            label = `Execute: ${event.stateExecute.stateId}`;
            
            // Basic details for collapsed view
            details = {
              'State ID': event.stateExecute.stateId,
              'Execution ID': event.stateExecute.stateExecutionId?.substring(0, 8) + '...',
            };

            // If this event came from a waitUntil event, connect from that node
            if (event.stateExecute.stateExecutionId && stateExecutionIdMap.has(event.stateExecute.stateExecutionId)) {
              sourceNodeId = stateExecutionIdMap.get(event.stateExecute.stateExecutionId) as string;
            } 
            // Otherwise if it has a fromEventId, use that
            else if (event.stateExecute.fromEventId !== undefined && event.stateExecute.fromEventId >= 0) {
              sourceNodeId = `event-${event.stateExecute.fromEventId}`;
            }
            
            // Add expanded details if node is expanded
            if (expandedNodes.has(nodeId)) {
              details = {
                ...details,
                'Started': event.stateExecute.firstAttemptStartedTimestamp ? 
                  formatTimestamp(event.stateExecute.firstAttemptStartedTimestamp * 1000, timezone) : 'Unknown',
                'Completed': event.stateExecute.completedTimestamp ? 
                  formatTimestamp(event.stateExecute.completedTimestamp * 1000, timezone) : 'Unknown',
                'From Event': event.stateExecute.fromEventId !== undefined ? 
                  event.stateExecute.fromEventId : 'Unknown',
              };
              
              // Add state decision details if present
              if (event.stateExecute.response?.stateDecision) {
                const nextStates = event.stateExecute.response.stateDecision.nextStates || [];
                details['Next States'] = nextStates.length > 0 ? 
                  nextStates.map(s => s.stateId).join(', ') : 'None';
              }
            }
          }
          break;
          
        case 'WorkflowClosed':
          if (event.workflowClosed) {
            label = 'Workflow Completed';
            details = {
              'Closed At': event.workflowClosed.workflowClosedTimestamp ? 
                formatTimestamp(event.workflowClosed.workflowClosedTimestamp * 1000, timezone) : 'Unknown'
            };
          }
          break;
          
        default:
          label = `${event.eventType || 'Unknown Event'}`;
          details = { 'Event Index': index };
      }
      
      // Create node
      newNodes.push({
        id: nodeId,
        type: 'workflowEvent',
        position: { x: xPosition, y: yPosition },
        data: {
          label,
          details,
          className: getEventColor(event.eventType),
          expandable: true,
          expanded: expandedNodes.has(nodeId),
          onExpand: () => toggleNodeExpanded(nodeId)
        },
        // Add source and target positions to improve edge routing
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });
      
      // Create edge from source node to this node
      if (sourceNodeId) {
        newEdges.push({
          id: `edge-${sourceNodeId}-${nodeId}`,
          source: sourceNodeId,
          target: nodeId,
          type: 'step', // Use step edge type for angled connections
          animated: true,
          style: { stroke: '#555', strokeWidth: 2 }, // Add explicit styling
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#555',
          },
          // Add some edge labels for events that have specific relationships
          label: event.eventType === 'StateExecute' && event.stateExecute?.stateExecutionId ? 'executes' : '',
          labelStyle: { fontSize: 12, fill: '#555' },
          labelBgStyle: { fill: 'rgba(255, 255, 255, 0.75)', fillOpacity: 0.8 },
        });
      }
      
      lastNodeId = nodeId;
      yPosition += yStep;
    });

    // Update the nodes and edges
    setNodes(newNodes);
    setEdges(newEdges);
  }, [workflowData, timezone, expandedNodes, toggleNodeExpanded]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-500 text-lg mb-3">Error loading workflow</div>
          <div className="text-red-700">{error}</div>
          <div className="mt-4">
            <Link href="/" className="text-blue-500 hover:underline">
              Return to workflow search
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Workflow Details
            </h1>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {workflowData && (
          <>
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Workflow Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Workflow ID</div>
                  <div className="mt-1 text-gray-900 truncate">{workflowId}</div>
                </div>
                {runId && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Run ID</div>
                    <div className="mt-1 text-gray-900 truncate">{runId}</div>
                  </div>
                )}
                {workflowData.input?.continuedAsNewInput?.previousInternalRunId && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Continued From Run ID</div>
                    <div className="mt-1 text-gray-900 truncate">{workflowData.input.continuedAsNewInput.previousInternalRunId}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-500">Type</div>
                  <div className="mt-1 text-gray-900">{workflowData.workflowType}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Status</div>
                  <div className="mt-1 text-gray-900">{workflowData.status}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Started</div>
                  <div className="mt-1 text-gray-900">
                    {formatTimestamp(workflowData.workflowStartedTimestamp * 1000, timezone)}
                  </div>
                </div>
                {workflowData.status === 'COMPLETED' && workflowData.historyEvents?.some(e => e.eventType === 'WorkflowClosed') && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Closed</div>
                    <div className="mt-1 text-gray-900">
                      {formatTimestamp(
                        workflowData.historyEvents.find(e => e.eventType === 'WorkflowClosed')?.workflowClosed?.workflowClosedTimestamp * 1000,
                        timezone
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                <WorkflowConfigPopup workflowInput={workflowData.input} />
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">Workflow History</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`px-3 py-1 rounded ${
                      viewMode === 'timeline' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => setViewMode('graph')}
                    className={`px-3 py-1 rounded ${
                      viewMode === 'graph' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Graph
                  </button>
                </div>
              </div>
              
              {viewMode === 'timeline' && workflowData.historyEvents && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <WorkflowTimeline 
                    workflowStartedTimestamp={workflowData.workflowStartedTimestamp}
                    historyEvents={workflowData.historyEvents}
                  />
                </div>
              )}
              
              {viewMode === 'graph' && (
                <div className="h-[700px] border border-gray-200 rounded-lg">
                  {(workflowData.historyEvents && workflowData.historyEvents.length > 0) ? (
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      nodeTypes={nodeTypes}
                      fitView
                      minZoom={0.1}
                      maxZoom={2}
                      attributionPosition="bottom-right"
                      defaultEdgeOptions={{
                        type: 'step',
                        style: { strokeWidth: 2 },
                      }}
                    >
                      <Controls position="top-right" />
                      <MiniMap
                        nodeStrokeWidth={3}
                        zoomable 
                        pannable
                        nodeBorderRadius={8}
                        maskColor="rgba(240, 240, 240, 0.3)"
                      />
                    </ReactFlow>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-500">No workflow history events available for graph visualization</p>
                    </div>
                  )}
                </div>
              )}
              
              {(!workflowData.historyEvents || workflowData.historyEvents.length === 0) && (
                <div className="flex items-center justify-center h-40 border border-gray-200 rounded-lg">
                  <p className="text-gray-500">No workflow history events available</p>
                </div>
              )}
            </div>
            
            {workflowData.input && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Workflow Input</h2>
                <pre className="bg-gray-50 p-3 rounded-lg overflow-auto max-h-96 text-sm">
                  {JSON.stringify(workflowData.input, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}