'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  Node, 
  Edge, 
  MarkerType,
  Position,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { IwfHistoryEvent, IwfHistoryEventType, WorkflowShowResponse } from '../../ts-api/src/api-gen/api';
import { formatTimestamp } from '../../components/utils';
import { TimezoneOption } from '../../components/types';
import WorkflowEventNode, { WorkflowEventNodeData } from './WorkflowEventNode';

// Define the custom node type with its data
type CustomNode = Node<WorkflowEventNodeData>;

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
    case 'WorkflowStarted':
      return 'bg-blue-50 border-blue-300';
    default:
      return 'bg-gray-50 border-gray-300';
  }
};

interface WorkflowGraphProps {
  workflowData: WorkflowShowResponse;
  timezone: TimezoneOption;
  timezoneTrigger: number;
}

export default function WorkflowGraph({ workflowData, timezone, timezoneTrigger }: WorkflowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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

    const newNodes: CustomNode[] = [];
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
            
            // Add output if available and node is expanded
            if (expandedNodes.has(nodeId) && event.workflowClosed.output) {
              details['Output'] = JSON.stringify(event.workflowClosed.output).substring(0, 50) + '...';
            }
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

  return (
    <div className="h-[700px] border border-gray-200 rounded-lg">
      {(workflowData.historyEvents && workflowData.historyEvents.length > 0) ? (
        <ReactFlow
          key={`xyflow-${timezoneTrigger}`} // Force re-render when timezone changes
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
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
          <Background />
        </ReactFlow>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500">No workflow history events available for graph visualization</p>
        </div>
      )}
    </div>
  );
}