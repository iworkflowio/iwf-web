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


    let yPosition = 100;
    const xPosition = 250;
    const yStep = 160; // Increased vertical spacing between nodes

    // Track the last node ID to create a default flow
    let lastNodeId = '';

    // Create nodes and edges for each history event
    workflowData.historyEvents.forEach((event, index) => {
      const nodeId = `event-${index}`;
      let label = '';
      let sourceNodeId = "";
      
      // Get event type and details based on event type
      switch (event.eventType) {
        case 'WorkflowStarted':
          label = 'Workflow Started: '+event.workflowStarted.workflowType;
          break;
        case 'StateWaitUntil':
          if (event.stateWaitUntil) {
            label = `StateWaitUntil: ${event.stateWaitUntil.stateExecutionId}`;
            if (event.stateWaitUntil.fromEventId !== undefined && event.stateWaitUntil.fromEventId >= 0) {
              sourceNodeId = `event-${event.stateWaitUntil.fromEventId}`;
              console.log(`StateWaitUntil node ${nodeId} has source: ${sourceNodeId} (from event ID: ${event.stateWaitUntil.fromEventId})`);
            } else {
              console.log(`StateWaitUntil node ${nodeId} has invalid fromEventId: ${event.stateWaitUntil.fromEventId}`);
            }
          }
          break;
          
        case 'StateExecute':
          if (event.stateExecute) {
            label = `Execute: ${event.stateExecute.stateExecutionId}`;
            if (event.stateExecute.fromEventId !== undefined && event.stateExecute.fromEventId >= 0) {
              sourceNodeId = `event-${event.stateExecute.fromEventId}`;
              console.log(`StateExecute node ${nodeId} has source: ${sourceNodeId} (from event ID: ${event.stateExecute.fromEventId})`);
            } else {
              console.log(`StateExecute node ${nodeId} has invalid fromEventId: ${event.stateExecute.fromEventId}`);
            }
          }
          break;
          
        case 'WorkflowClosed':
          label = 'Workflow Completed';
          // TODO fix this
          //  sourceNodeId = `event-${event.workflowClosed.fromEventId}`;
          break;
          
        default:
          label = `${event.eventType || 'Unknown Event'}`;
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
            event.eventType === 'WorkflowStarted' ? event.workflowStarted :
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
      if (sourceNodeId && sourceNodeId !== nodeId) {
        // Create edge if we have a valid source node from the event
        newEdges.push({
          id: `edge-${sourceNodeId}-${nodeId}`,
          source: sourceNodeId,
          target: nodeId,
          type: 'smoothstep', // Use smoothstep for better appearance
          animated: true,
          style: { stroke: '#2563eb', strokeWidth: 2 }, // Use blue-600 for better appearance
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color: '#2563eb', // blue-600
          },
        });
      } else if (lastNodeId && index > 0) {
        // Fallback: If no specific source node is defined but we have a previous node,
        // connect from the last node to create a sequential flow
        newEdges.push({
          id: `edge-${lastNodeId}-${nodeId}`,
          source: lastNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: false, // Non-animated for fallback connections
          style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5,5' }, // Dotted line in slate-400
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color: '#94a3b8', // slate-400
          },
        });
      }
      
      // Update the last node ID for the next iteration
      lastNodeId = nodeId;
      yPosition += yStep;
    });

    // Debug: Log information about nodes and edges
    console.log('Nodes created:', newNodes.length);
    console.log('Edges created:', newEdges.length);
    console.log('Edges data:', newEdges);
    
    // Update the nodes and edges
    setNodes(newNodes);
    setEdges(newEdges);
    
  }, [workflowData, timezone]);

  // Add some debug output for the nodes and edges
  console.log('Current nodes state:', nodes.length);
  console.log('Current edges state:', edges.length);

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
            type: 'smoothstep',
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