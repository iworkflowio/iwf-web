'use client';

import { NodeProps, Handle, Position } from '@xyflow/react';
import {IwfHistoryEvent} from '../../ts-api/src/api-gen/api';
import {getBadgeColor, getEventIcon, getEventTypeColor} from "./EventDetailsRenderer";

// Define custom node data type
export type WorkflowEventNodeData = {
  index: number;
  event: IwfHistoryEvent;
}

// Custom node for workflow events
const WorkflowEventNode = ({ data }: NodeProps) => {

    const event = data.event as IwfHistoryEvent;
    const index = data.index as number;

  return (
    <>
      {/* Input handle at the top of the node */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="input"
        style={{ 
          background: '#fff',
          border: '1px solid #2563eb', // blue-600
          width: 3,
          height: 3,
          top: -1,
          boxShadow: '0 0 3px rgba(0, 0, 0, 0.2)',
          zIndex: 1,
        }}
      />

      <div className={`p-4 border rounded-md shadow-md ${getEventTypeColor(event.eventType)} mb-2 relative cursor-pointer`}>
        <span className={`${getBadgeColor(event.eventType)} text-white px-2 py-0.5 rounded-md text-xs font-bold mr-2 inline-flex items-center shadow-sm`}>
            <span className="mr-0.5">{getEventIcon(event.eventType)}</span> Event {index}
          </span>
          <span className="text-gray-800">
            {event.eventType}
              {event.eventType === 'StateWaitUntil' && event.stateWaitUntil?.stateExecutionId && (
                  <span className="text-xs text-gray-500 ml-2">({event.stateWaitUntil.stateExecutionId})</span>
              )}
              {event.eventType === 'StateExecute' && event.stateExecute?.stateExecutionId && (
                  <span className="text-xs text-gray-500 ml-2">({event.stateExecute.stateExecutionId})</span>
              )}
          </span>
      </div>

      {/* Output handle at the bottom of the node */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="output"
        style={{ 
          background: '#fff',
          border: '2px solid #2563eb', // blue-600
          width: 3,
          height: 3,
          bottom: 6,
          boxShadow: '0 0 3px rgba(0, 0, 0, 0.2)',
          zIndex: 1,
        }}
      />
    </>
  );
};

export default WorkflowEventNode;