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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        style={{ width: '800px' }}
        className="bg-white rounded-lg shadow-lg max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b sticky top-0 bg-white">
          <h3 className="text-xl font-semibold">{eventType}</h3>
        </div>
        
        {/* Use the shared event details renderer */}
        <div className="overflow-auto flex-1">
          <EventDetailsRenderer 
            eventType={eventType}
            eventData={eventData}
            timezone={timezone}
          />
        </div>
        
        <div className="p-4 border-t flex justify-end sticky bottom-0 bg-white">
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
          className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors shadow-sm"
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