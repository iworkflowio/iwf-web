'use client';

import { useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { IwfHistoryEventType } from '../../ts-api/src/api-gen/api';
import { formatTimestamp } from '../../components/utils';
import { TimezoneOption } from '../../components/types';
import EventDetailsRenderer from './EventDetailsRenderer';

// Define custom node data type
export type WorkflowEventNodeData = {
  label: string;
  eventType: IwfHistoryEventType;
  eventData: any; // Raw event data (stateWaitUntil, stateExecute, etc.)
  className?: string;
  timezone: TimezoneOption;
}

// Event details popup component
const EventDetailsPopup = ({ 
  isOpen, 
  onClose, 
  eventType, 
  eventData,
  timezone 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  eventType: IwfHistoryEventType;
  eventData: any;
  timezone: TimezoneOption;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold">{eventType}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>
        
        {/* Use the shared event details renderer */}
        <div className="overflow-auto">
          <EventDetailsRenderer 
            eventType={eventType}
            eventData={eventData}
            timezone={timezone}
          />
        </div>
        
        <div className="p-4 border-t flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Custom node for workflow events
const WorkflowEventNode = ({ data }: NodeProps) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <>
      <div className={`p-4 border rounded-md shadow-md ${data.className} mb-2`}>
        <div className="font-semibold mb-2">{data.label}</div>
        
        {/* Button to show details popup */}
        <button 
          className="text-xs text-blue-500 hover:text-blue-700"
          onClick={() => setIsPopupOpen(true)}
        >
          View Details
        </button>
      </div>
      
      {/* Event details popup */}
      <EventDetailsPopup 
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        eventType={data.eventType}
        eventData={data.eventData}
        timezone={data.timezone}
      />
    </>
  );
};

export default WorkflowEventNode;