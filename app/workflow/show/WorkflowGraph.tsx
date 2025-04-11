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

  // Initialize ReactFlow graph when workflowData changes
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
        eventType: 'WorkflowStarted',
        eventData: {
          workflowType: workflowData.workflowType,
          workflowStartedTimestamp: workflowData.workflowStartedTimestamp
        },
        className: 'bg-blue-50 border-blue-300',
        timezone: timezone
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
            
            // No need for expanded details with popup approach
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
            
            // No need for expanded details with popup approach
          }
          break;
          
        case 'WorkflowClosed':
          if (event.workflowClosed) {
            label = 'Workflow Completed';
            details = {
              'Closed At': event.workflowClosed.workflowClosedTimestamp ? 
                formatTimestamp(event.workflowClosed.workflowClosedTimestamp * 1000, timezone) : 'Unknown'
            };
            
            // No need for expanded details with popup approach
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
          eventType: event.eventType,
          eventData: 
            event.eventType === 'StateWaitUntil' ? event.stateWaitUntil :
            event.eventType === 'StateExecute' ? event.stateExecute :
            event.eventType === 'WorkflowClosed' ? event.workflowClosed :
            event.eventType === 'SignalReceived' ? event.signalReceived :
            event.eventType === 'RpcExecution' ? event.rpcExecution :
            event,
          className: getEventColor(event.eventType),
          timezone: timezone
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
    
  }, [workflowData, timezone]);

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