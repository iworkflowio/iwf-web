'use client';

import { useState } from 'react';
import { IwfHistoryEvent } from '../../ts-api/src/api-gen/api';
import { formatTimestamp } from '../../components/utils';
import { useTimezoneManager } from '../../components/TimezoneManager';
import WorkflowEventDetails from './WorkflowEventDetails';
import {TimezoneOption} from "../../components/types";

interface TimelineProps {
  workflowStartedTimestamp: number;
  historyEvents: IwfHistoryEvent[];
  timezone: TimezoneOption
}

export default function WorkflowTimeline(
    { workflowStartedTimestamp, historyEvents , timezone }: TimelineProps) {
  const [allExpanded, setAllExpanded] = useState(false);
  
  // Create a direct formatter function to ensure we use the latest timezone
  const formatWithTimezone = (timestamp: number) => {
    return formatTimestamp(timestamp * 1000, timezone);
  };

  // Function to get timestamp for an event
  const getEventTimestamp = (event: IwfHistoryEvent): number | undefined => {
    if (event.stateWaitUntil?.firstAttemptStartedTimestamp) {
      return event.stateWaitUntil.firstAttemptStartedTimestamp;
    }
    if (event.stateExecute?.firstAttemptStartedTimestamp) {
      return event.stateExecute.firstAttemptStartedTimestamp;
    }
    if( event.workflowStarted?.workflowStartedTimestamp){
      return event.workflowStarted.workflowStartedTimestamp;
    }
    if(event.workflowClosed?.workflowClosedTimestamp){
      return event.workflowClosed.workflowClosedTimestamp
    }
    if(event.signalReceived?.completedTimestamp){
      return event.signalReceived?.completedTimestamp
    }
    if(event.rpcExecution?.completedTimestamp){
      return event.rpcExecution?.completedTimestamp
    }
    return undefined;
  };

  // Calculate rough duration of workflow so far (in seconds)
  const getLastTimestamp = (): number => {
    if (!historyEvents || historyEvents.length === 0) {
      return workflowStartedTimestamp;
    }

    let latestTimestamp = workflowStartedTimestamp;

    historyEvents.forEach(event => {
      // Check completedTimestamp first
      if (event.stateWaitUntil?.completedTimestamp && event.stateWaitUntil.completedTimestamp > latestTimestamp) {
        latestTimestamp = event.stateWaitUntil.completedTimestamp;
      } else if (event.stateExecute?.completedTimestamp && event.stateExecute.completedTimestamp > latestTimestamp) {
        latestTimestamp = event.stateExecute.completedTimestamp;
      }
      
      // If no completedTimestamp, use firstAttemptStartedTimestamp
      const startTimestamp = getEventTimestamp(event);
      if (startTimestamp && startTimestamp > latestTimestamp) {
        latestTimestamp = startTimestamp;
      }
    });

    return latestTimestamp;
  };

  const startTimestamp = workflowStartedTimestamp;
  const endTimestamp = getLastTimestamp();
  const totalDuration = endTimestamp - startTimestamp;

  const toggleAllEvents = () => {
    setAllExpanded(!allExpanded);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button 
          onClick={toggleAllEvents}
          className="px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 flex items-center transition-colors"
        >
          <span className="mr-1">{allExpanded ? '−' : '+'}</span>
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
      
      {historyEvents.map((event, index) => {
        const timestamp = getEventTimestamp(event);
        const relativePosition = timestamp 
          ? ((timestamp - startTimestamp) / totalDuration) * 100
          : null;
          
        return (
          <div className="flex mb-6" key={`event-${index}-${timezone.value}`}>
            <div className="w-36 pr-4 text-right">
              {timestamp ? (
                <div className="font-medium">
                  {formatWithTimezone(timestamp)}
                </div>
              ) : (
                <div className="text-gray-400 italic">No timestamp</div>
              )}
              {relativePosition !== null && (
                <div className="text-xs text-gray-500">
                  +{Math.round((timestamp - startTimestamp))}s
                </div>
              )}
            </div>
            <div className="flex-1">
              {/* New instance of WorkflowEventDetails every time to ensure it gets the latest timezone */}
              <WorkflowEventDetails 
                event={event} 
                index={index} 
                timezone={timezone}
                initialExpanded={allExpanded}
                globalExpandState={allExpanded}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}