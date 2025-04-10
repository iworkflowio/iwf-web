'use client';

import { useState } from 'react';
import { IwfHistoryEvent } from '../../ts-api/src/api-gen/api';
import { formatTimestamp } from '../../components/utils';
import { useTimezoneManager } from '../../components/TimezoneManager';
import {TimezoneOption} from "../../components/types";

interface EventDetailsProps {
  event: IwfHistoryEvent;
  index: number;
  timezone: TimezoneOption
}

export default function WorkflowEventDetails({ event, index, timezone }: EventDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  // Create a direct formatter function that will always use the current timezone value
  const formatWithTimezone = (timestamp: number) => {
    // We force recalculation each time to ensure we have the latest timezone
    return formatTimestamp(timestamp * 1000, timezone);
  };

  // Function to determine event color based on event type
  const getEventTypeColor = () => {
    switch (event.eventType) {
      case 'WorkflowStarted':
        return 'bg-blue-100 border-blue-300';
      case 'StateWaitUntil':
        return 'bg-yellow-100 border-yellow-300';
      case 'StateExecute':
        return 'bg-green-100 border-green-300';
      case 'RpcExecution':
        return 'bg-purple-100 border-purple-300';
      case 'SignalReceived':
        return 'bg-blue-100 border-blue-300';
      case 'WorkflowClosed':
        return 'bg-gray-100 border-gray-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };
  
  // Function to determine badge color based on event type
  const getBadgeColor = () => {
    switch (event.eventType) {
      case 'WorkflowStarted':
        return 'bg-blue-600';
      case 'StateWaitUntil':
        return 'bg-yellow-600';
      case 'StateExecute':
        return 'bg-green-600';
      case 'RpcExecution':
        return 'bg-purple-600';
      case 'SignalReceived':
        return 'bg-blue-600';
      case 'WorkflowClosed':
        return 'bg-gray-600';
      default:
        return 'bg-gray-700';
    }
  };
  
  // Function to get an appropriate icon for each event type
  const getEventIcon = () => {
    switch (event.eventType) {
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

  // Function to render event details based on its type
  const renderEventDetails = () => {
    if (!expanded) {
      return null;
    }

    if (event.workflowStarted) {
      const details = event.workflowStarted;
      return (
        <div className="mt-2 pl-2 text-sm border-l-2 border-blue-300">
          <div><span className="font-semibold">Workflow Type:</span> {details.workflowType}</div>
          {details.workflowStartedTimestamp && (
            <div>
              <span className="font-semibold">Started:</span> 
              {formatWithTimezone(details.workflowStartedTimestamp)}
            </div>
          )}
          {details.input && (
            <div>
              <div className="font-semibold mt-1">Input:</div>
              <pre className="text-xs mt-1 bg-gray-50 p-1 rounded overflow-auto max-h-24">
                {JSON.stringify(details.input, null, 2)}
              </pre>
            </div>
          )}
          {details.continueAsNewSnapshot && (
            <div>
              <div className="font-semibold mt-1">Continue As New:</div>
              <pre className="text-xs mt-1 bg-gray-50 p-1 rounded overflow-auto max-h-24">
                {JSON.stringify(details.continueAsNewSnapshot, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (event.stateWaitUntil) {
      const details = event.stateWaitUntil;
      return (
        <div className="mt-2 pl-2 text-sm border-l-2 border-yellow-300">
          <div><span className="font-semibold">State ID:</span> {details.stateId}</div>
          <div><span className="font-semibold">Execution ID:</span> {details.stateExecutionId}</div>
          {details.firstAttemptStartedTimestamp && (
            <div>
              <span className="font-semibold">Started:</span> 
              {formatWithTimezone(details.firstAttemptStartedTimestamp)}
            </div>
          )}
          {details.completedTimestamp && (
            <div>
              <span className="font-semibold">Completed:</span> 
              {formatWithTimezone(details.completedTimestamp)}
            </div>
          )}
          {details.fromEventId !== undefined && (
            <div><span className="font-semibold">From Event:</span> {details.fromEventId}</div>
          )}
          {details.input && (
            <div>
              <div className="font-semibold mt-1">Input:</div>
              <pre className="text-xs mt-1 bg-gray-50 p-1 rounded overflow-auto max-h-24">
                {JSON.stringify(details.input, null, 2)}
              </pre>
            </div>
          )}
          {details.response && (
            <div>
              <div className="font-semibold mt-1">Response:</div>
              <pre className="text-xs mt-1 bg-gray-50 p-1 rounded overflow-auto max-h-24">
                {JSON.stringify(details.response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (event.stateExecute) {
      const details = event.stateExecute;
      return (
        <div className="mt-2 pl-2 text-sm border-l-2 border-green-300">
          <div><span className="font-semibold">State ID:</span> {details.stateId}</div>
          <div><span className="font-semibold">Execution ID:</span> {details.stateExecutionId}</div>
          {details.firstAttemptStartedTimestamp && (
            <div>
              <span className="font-semibold">Started:</span> 
              {formatWithTimezone(details.firstAttemptStartedTimestamp)}
            </div>
          )}
          {details.completedTimestamp && (
            <div>
              <span className="font-semibold">Completed:</span> 
              {formatWithTimezone(details.completedTimestamp)}
            </div>
          )}
          {details.fromEventId !== undefined && (
            <div><span className="font-semibold">From Event:</span> {details.fromEventId}</div>
          )}
          {details.input && (
            <div>
              <div className="font-semibold mt-1">Input:</div>
              <pre className="text-xs mt-1 bg-gray-50 p-1 rounded overflow-auto max-h-24">
                {JSON.stringify(details.input, null, 2)}
              </pre>
            </div>
          )}
          {details.response && details.response.stateDecision && (
            <div>
              <div className="font-semibold mt-1">State Decision:</div>
              <pre className="text-xs mt-1 bg-gray-50 p-1 rounded overflow-auto max-h-24">
                {JSON.stringify(details.response.stateDecision, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mt-2 pl-2 text-sm border-l-2 border-gray-300">
        <div className="italic text-gray-500">No detailed information available</div>
      </div>
    );
  };

  return (
    <div className={`mb-4 p-3 border rounded-md shadow-sm ${getEventTypeColor()}`}>
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="font-medium flex items-center">
          <span className={`${getBadgeColor()} text-white px-2 py-0.5 rounded-md text-xs font-bold mr-2 inline-flex items-center shadow-sm`}>
            <span className="mr-0.5">{getEventIcon()}</span> Event {index}
          </span>
          <span className="text-gray-800">{event.eventType}</span>
        </div>
        <button className={`${expanded ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} hover:opacity-80 w-6 h-6 flex items-center justify-center rounded-full font-bold text-sm transition-colors`}>
          {expanded ? '−' : '+'}
        </button>
      </div>
      {renderEventDetails()}
    </div>
  );
}