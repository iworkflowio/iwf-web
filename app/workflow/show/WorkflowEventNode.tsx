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
        <div className="font-semibold">{data.label}</div>
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