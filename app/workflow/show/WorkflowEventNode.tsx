'use client';

import { NodeProps, Handle, Position } from '@xyflow/react';
import { IwfHistoryEventType } from '../../ts-api/src/api-gen/api';
import { TimezoneOption } from '../../components/types';

// Define custom node data type
export type WorkflowEventNodeData = {
  label: string;
  eventType: IwfHistoryEventType;
  eventData: any; // Raw event data (stateWaitUntil, stateExecute, etc.)
  className?: string;
  timezone: TimezoneOption;
}

// Custom node for workflow events
const WorkflowEventNode = ({ data }: NodeProps) => {
  // Import event icon function from EventDetailsRenderer
  const getEventIcon = (eventType: IwfHistoryEventType) => {
    switch (eventType) {
      case 'WorkflowStarted':
        return '🚀'; // Rocket
      case 'StateWaitUntil':
        return '⏳'; // Hourglass
      case 'StateExecute':
        return '▶️'; // Play button
      case 'RpcExecution':
        return '🔄'; // Cycle arrows
      case 'SignalReceived':
        return '📡'; // Satellite antenna
      case 'WorkflowClosed':
        return '🏁'; // Checkered flag
      default:
        return '📋'; // Clipboard
    }
  };

  // Get the event icon
  const icon = getEventIcon(data.eventType);
  
  // Get event ID based on event type
  const getEventId = () => {
    switch(data.eventType) {
      case 'StateWaitUntil':
      case 'StateExecute':
        return data.eventData?.stateExecutionId ? `ID: ${data.eventData.stateExecutionId}` : '';
      default:
        return '';
    }
  };
  
  const eventId = getEventId();

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

      <div className={`p-4 border rounded-md shadow-md ${data.className} mb-2 relative cursor-pointer`}>
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={data.eventType}>{icon}</span>
          <div className="font-semibold">{data.label}</div>
        </div>
        {eventId && <div className="text-xs font-medium mt-1">{eventId}</div>}
        <div className="text-xs text-gray-500 mt-1">Click for details</div>
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