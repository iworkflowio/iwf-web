'use client';

import { NodeProps } from '@xyflow/react';

// Define custom node data type
export type WorkflowEventNodeData = {
  label: string;
  details?: Record<string, any>;
  className?: string;
  expandable?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
}

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

export default WorkflowEventNode;