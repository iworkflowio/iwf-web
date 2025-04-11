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
import dagre from 'dagre';
import { IwfHistoryEvent, IwfHistoryEventType, WorkflowShowResponse } from '../../ts-api/src/api-gen/api';
import { formatTimestamp } from '../../components/utils';
import { TimezoneOption } from '../../components/types';
import WorkflowEventNode, { WorkflowEventNodeData } from './WorkflowEventNode';
import EventDetailsRenderer, {getEventData, getEventIcon} from './EventDetailsRenderer';

// Define the custom node type with its data
type CustomNode = Node<WorkflowEventNodeData>;

// Custom node types mapping
const nodeTypes = {
  workflowEvent: WorkflowEventNode,
};

// This helper function uses the dagre library to automatically layout the nodes in a tree structure
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Set the direction and spacing
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 80, // Horizontal spacing between nodes
    ranksep: 100, // Vertical spacing between ranks/levels
  });

  // Add nodes to the dagre graph.
  // The width and height are required by dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: 220, // Approximate width of our nodes
      height: 80,  // Approximate height of our nodes
    });
  });

  // Add edges to the dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Let dagre do its layout magic
  dagre.layout(dagreGraph);

  // Get the new node positions from dagre
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // We need to preserve properties like width, height, id, type, and data
    return {
      ...node,
      // Position is different based on direction
      position: {
        x: nodeWithPosition.x - 110, // Center the node (half of our estimated width)
        y: nodeWithPosition.y - 40,  // Center the node (half of our estimated height)
      },
      // We also preserve source/target positions to ensure edges connect properly
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface WorkflowGraphProps {
  workflowData: WorkflowShowResponse;
  timezone: TimezoneOption;
  timezoneTrigger: number;
}

export default function WorkflowGraph({ workflowData, timezone, timezoneTrigger }: WorkflowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEvent, setSelectedEvent] = useState<{index: number, event: IwfHistoryEvent} | null>(null);

  // Initialize ReactFlow graph when workflowData changes
  useEffect(() => {
    if (!workflowData || !workflowData.historyEvents || workflowData.historyEvents.length === 0) {
      return;
    }

    const newNodes: CustomNode[] = [];
    const newEdges: Edge[] = [];

    // Track the last node ID to create a default flow
    let lastNodeId = '';

    // Create nodes and edges for each history event
    workflowData.historyEvents.forEach((event, index) => {
      const nodeId = `event-${index}`;
      let label = '';
      let sourceNodeId = "";
      
      // Get event type and details based on event type
      switch (event.eventType) {
        case 'StateWaitUntil':
          if (event.stateWaitUntil) {
            if (event.stateWaitUntil.fromEventId !== undefined && event.stateWaitUntil.fromEventId >= 0) {
              sourceNodeId = `event-${event.stateWaitUntil.fromEventId}`;
            }
          }
          break;
        case 'StateExecute':
          if (event.stateExecute) {
            if (event.stateExecute.fromEventId !== undefined && event.stateExecute.fromEventId >= 0) {
              sourceNodeId = `event-${event.stateExecute.fromEventId}`;
            }
          }
          break;
      }
      
      newNodes.push({
        id: nodeId,
        type: 'workflowEvent',
        position: { x: 0, y: 0 }, // Initial position doesn't matter, Dagre will update it
        data: {
          index: index,
          event: event,
        },
      });
      
      // Create edge from source node to this node
      if (sourceNodeId && sourceNodeId !== nodeId) {
        // Create edge if we have a valid source node from the event
        newEdges.push({
          id: `edge-${sourceNodeId}-${nodeId}`,
          source: sourceNodeId,
          target: nodeId,
          type: 'bezier', 
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
          type: 'bezier',
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
    });

    // Apply the Dagre layout to our nodes and edges
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'TB');
    
    // Update the nodes and edges with the layouted ones
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
  }, [workflowData, timezone]);

  // Handle node click to show details in side panel
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const nodeData = node.data as WorkflowEventNodeData;
    setSelectedEvent({
      index: nodeData.index,
      event: nodeData.event
    });
  }, []);

  return (
    <div className="h-[700px] border border-gray-200 rounded-lg flex">
      <div className={`flex-1 ${selectedEvent ? 'border-r border-gray-200' : ''}`}>
        {(workflowData.historyEvents && workflowData.historyEvents.length > 0) ? (
          <ReactFlow
            key={`xyflow-${timezoneTrigger}`} // Force re-render when timezone changes
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
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
      
      {/* Side Panel for Event Details */}
      {selectedEvent && (
        <div className="w-1/3 overflow-auto border-l border-gray-200">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl" role="img" aria-label={selectedEvent.event.eventType}>
                {getEventIcon(selectedEvent.event.eventType)}
              </span>
              <h3 className="text-lg font-medium">
                {selectedEvent.event.eventType}
              </h3>
            </div>
            <button 
              onClick={() => setSelectedEvent(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <EventDetailsRenderer 
              eventType={selectedEvent.event.eventType}
              eventData={getEventData(selectedEvent.event)}
              timezone={timezone}
            />
          </div>
        </div>
      )}
    </div>
  );
}