'use client';

import { IwfHistoryEvent } from '../../ts-api/src/api-gen/api';
import { formatTimestamp } from '../../components/utils';
import { useTimezoneManager } from '../../components/TimezoneManager';
import WorkflowEventDetails from './WorkflowEventDetails';

interface TimelineProps {
  workflowStartedTimestamp: number;
  historyEvents: IwfHistoryEvent[];
}

export default function WorkflowTimeline({ workflowStartedTimestamp, historyEvents }: TimelineProps) {
  const { timezone } = useTimezoneManager();

  // Function to get timestamp for an event
  const getEventTimestamp = (event: IwfHistoryEvent): number | undefined => {
    if (event.stateWaitUntil?.firstAttemptStartedTimestamp) {
      return event.stateWaitUntil.firstAttemptStartedTimestamp;
    }
    if (event.stateExecute?.firstAttemptStartedTimestamp) {
      return event.stateExecute.firstAttemptStartedTimestamp;
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

  return (
    <div>
      <div className="flex mb-6">
        <div className="w-36 pr-4 font-medium text-right">
          {formatTimestamp(workflowStartedTimestamp * 1000, timezone)}
        </div>
        <div className="flex-1">
          <div className="bg-blue-100 border border-blue-300 rounded-md p-3 shadow-sm">
            <div className="font-medium">Workflow Started</div>
            <div className="text-sm text-gray-600">
              Start timestamp: {workflowStartedTimestamp}
            </div>
          </div>
        </div>
      </div>

      {historyEvents.map((event, index) => {
        const timestamp = getEventTimestamp(event);
        const relativePosition = timestamp 
          ? ((timestamp - startTimestamp) / totalDuration) * 100
          : null;
          
        return (
          <div className="flex mb-6" key={`event-${index}`}>
            <div className="w-36 pr-4 text-right">
              {timestamp ? (
                <div className="font-medium">
                  {formatTimestamp(timestamp * 1000, timezone)}
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
              <WorkflowEventDetails event={event} index={index} />
            </div>
          </div>
        );
      })}
    </div>
  );
}