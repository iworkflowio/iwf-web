'use client';

import { IwfHistoryEvent, IwfHistoryEventType } from '../../ts-api/src/api-gen/api';
import { formatTimestamp } from '../../components/utils';
import { TimezoneOption } from '../../components/types';

interface EventDetailsRendererProps {
  eventType: IwfHistoryEventType;
  eventData: any;
  timezone: TimezoneOption;
  className?: string;
}

export const getEventData = (event: IwfHistoryEvent) => {
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

// Function to determine event color based on event type
export const getEventTypeColor = (eventType: IwfHistoryEventType) => {
  switch (eventType) {
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
export const getBadgeColor = (eventType: IwfHistoryEventType) => {
  switch (eventType) {
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
export const getEventIcon = (eventType: IwfHistoryEventType) => {
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

// Function to format timestamp with timezone
export const formatWithTimezone = (timestamp: number, timezone: TimezoneOption) => {
  return formatTimestamp(timestamp * 1000, timezone);
};

// Reusable component for rendering event details
export default function EventDetailsRenderer({ 
  eventType, 
  eventData, 
  timezone, 
  className = ""
}: EventDetailsRendererProps) {
  
  // Format event details based on event type
  const renderEventDetails = () => {
    switch(eventType) {
      case 'WorkflowStarted':
        return (
          <div className={`p-4 text-sm ${className}`}>
            <div><span className="font-semibold">Workflow Type:</span> {eventData.workflowType}</div>
            {eventData.workflowStartedTimestamp && (
              <div>
                <span className="font-semibold">Started:</span> 
                {formatWithTimezone(eventData.workflowStartedTimestamp, timezone)}
              </div>
            )}
            {eventData.input && (
              <div>
                <div className="font-semibold mt-3">Input:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.input, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {eventData.continueAsNewSnapshot && (
              <div>
                <div className="font-semibold mt-3">Continue As New:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.continueAsNewSnapshot, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
        
      case 'StateWaitUntil':
        return (
          <div className={`p-4 text-sm ${className}`}>
            <div><span className="font-semibold">State ID:</span> {eventData.stateId}</div>
            <div><span className="font-semibold">State WExecution ID:</span> {eventData.stateExecutionId}</div>
            {eventData.firstAttemptStartedTimestamp && (
              <div>
                <span className="font-semibold">Started:</span> 
                {formatWithTimezone(eventData.firstAttemptStartedTimestamp, timezone)}
              </div>
            )}
            {eventData.completedTimestamp && (
              <div>
                <span className="font-semibold">Completed:</span> 
                {formatWithTimezone(eventData.completedTimestamp, timezone)}
              </div>
            )}
            {eventData.fromEventId !== undefined && (
              <div><span className="font-semibold">From Event:</span> {eventData.fromEventId}</div>
            )}
            {eventData.input && (
              <div>
                <div className="font-semibold mt-3">Input:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.input, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {eventData.response && (
              <div>
                <div className="font-semibold mt-3">Response:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
        
      case 'StateExecute':
        return (
          <div className={`p-4 text-sm ${className}`}>
            <div><span className="font-semibold">State ID:</span> {eventData.stateId}</div>
            <div><span className="font-semibold">State Execution ID:</span> {eventData.stateExecutionId}</div>
            {eventData.firstAttemptStartedTimestamp && (
              <div>
                <span className="font-semibold">Started:</span> 
                {formatWithTimezone(eventData.firstAttemptStartedTimestamp, timezone)}
              </div>
            )}
            {eventData.completedTimestamp && (
              <div>
                <span className="font-semibold">Completed:</span> 
                {formatWithTimezone(eventData.completedTimestamp, timezone)}
              </div>
            )}
            {eventData.fromEventId !== undefined && (
              <div><span className="font-semibold">From Event:</span> {eventData.fromEventId}</div>
            )}
            {eventData.input && (
              <div>
                <div className="font-semibold mt-3">Input:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.input, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {eventData.response && (
              <div>
                <div className="font-semibold mt-3">Response:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
        
      case 'SignalReceived':
        return (
          <div className={`p-4 text-sm ${className}`}>
            <div><span className="font-semibold">Signal Name:</span> {eventData.signalName}</div>
            {eventData.completedTimestamp && (
              <div>
                <span className="font-semibold">Received At:</span> 
                {formatWithTimezone(eventData.completedTimestamp, timezone)}
              </div>
            )}
            {eventData.value && (
              <div>
                <div className="font-semibold mt-3">Signal Value:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.value, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      case 'RpcExecution':
        return (
          <div className={`p-4 text-sm ${className}`}>
            {eventData.scheduledTimestamp && (
              <div>
                <span className="font-semibold">Scheduled At:</span> 
                {formatWithTimezone(eventData.scheduledTimestamp, timezone)}
              </div>
            )}
            {eventData.completedTimestamp && (
              <div>
                <span className="font-semibold">Completed At:</span> 
                {formatWithTimezone(eventData.completedTimestamp, timezone)}
              </div>
            )}
            {eventData.response && (
              <div>
                <div className="font-semibold mt-3">RPC Result:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
        
      case 'WorkflowClosed':
        return (
          <div className={`p-4 text-sm ${className}`}>
            {eventData.closedType && (
              <div>
                <span className="font-semibold">Closed Type:</span> 
                <span className={`ml-2 px-2 py-1 text-xs rounded ${
                  eventData.closedType === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                  eventData.closedType === 'CANCELLED' ? 'bg-orange-100 text-orange-800' :
                  eventData.closedType === 'FAILED' ? 'bg-red-100 text-red-800' :
                  eventData.closedType === 'TERMINATED' ? 'bg-gray-100 text-gray-800' :
                  eventData.closedType === 'CONTINUED_AS_NEW' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {eventData.closedType}
                </span>
              </div>
            )}
            {eventData.workflowClosedTimestamp && (
              <div className="mt-2">
                <span className="font-semibold">Closed At:</span> 
                {formatWithTimezone(eventData.workflowClosedTimestamp, timezone)}
              </div>
            )}
            {eventData.output && (
              <div>
                <div className="font-semibold mt-3">Output:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-60 border border-gray-200">
                    {JSON.stringify(eventData.output, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {eventData.failure && (
              <div>
                <div className="font-semibold mt-3 text-red-600">Failure:</div>
                <div className="relative">
                  <pre className="text-xs mt-1 bg-red-50 p-2 rounded overflow-auto max-h-60 border border-red-200 text-red-800">
                    {JSON.stringify(eventData.failure, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
        
      default:
        return (
          <div className={`p-4 text-sm ${className}`}>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-[500px] resize-y border border-gray-200">
              {JSON.stringify(eventData, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return renderEventDetails();
}