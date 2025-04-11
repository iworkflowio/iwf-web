'use client';

import { useState, useEffect } from 'react';
import { IwfHistoryEvent } from '../../ts-api/src/api-gen/api';
import { TimezoneOption } from "../../components/types";
import EventDetailsRenderer, { 
  getBadgeColor, 
  getEventIcon, 
  getEventTypeColor 
} from './EventDetailsRenderer';

interface EventDetailsProps {
  event: IwfHistoryEvent;
  index: number;
  timezone: TimezoneOption;
  initialExpanded?: boolean;
  globalExpandState?: boolean;
}

export default function WorkflowEventDetails({ 
  event, 
  index, 
  timezone, 
  initialExpanded = false,
  globalExpandState
}: EventDetailsProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  
  // Respond to global expand/collapse state changes
  useEffect(() => {
    if (globalExpandState !== undefined) {
      setExpanded(globalExpandState);
    }
  }, [globalExpandState]);

  // Get event detail data based on event type
  const getEventData = () => {
    switch (event.eventType) {
      case 'WorkflowStarted':
        return event.workflowStarted;
      case 'WorkflowClosed':
        return event.workflowClosed;
      case 'StateWaitUntil':
        return event.stateWaitUntil;
      case 'StateExecute':
        return event.stateExecute;
      case 'SignalReceived':
        return event.signalReceived;
      case 'RpcExecution':
        return event.rpcExecution;
      default:
        return event;
    }
  };

  return (
    <div className={`mb-4 p-3 border rounded-md shadow-sm ${getEventTypeColor(event.eventType)}`}>
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="font-medium flex items-center">
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
        <button className={`${expanded ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} hover:opacity-80 w-6 h-6 flex items-center justify-center rounded-full font-bold text-sm transition-colors`}>
          {expanded ? '−' : '+'}
        </button>
      </div>
      
      {/* Use shared renderer when expanded */}
      {expanded && (
        <div className="mt-2 pl-2 border-l-2 border-l-blue-200">
          <EventDetailsRenderer 
            eventType={event.eventType}
            eventData={getEventData()}
            timezone={timezone}
          />
        </div>
      )}
    </div>
  );
}