'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTimezoneManager } from '../../components/TimezoneManager';
import { formatTimestamp } from '../../components/utils';
import { WorkflowShowResponse, IwfHistoryEvent, IwfHistoryEventType } from '../../ts-api/src/api-gen/api';
import WorkflowTimeline from './WorkflowTimeline';
import WorkflowGraph from './WorkflowGraph';
import WorkflowConfigPopup from './WorkflowConfigPopup';
import StatusBadge from '../../components/StatusBadge';
import AppHeader from '../../components/AppHeader';
import TimezoneSelector from '../../components/TimezoneSelector';
import ConfigPopup from '../../components/ConfigPopup';
import { useAppConfig } from '../../components/ConfigContext';

// This part has been moved to WorkflowGraph.tsx

// Helper functions have been moved to WorkflowGraph.tsx

export default function WorkflowShow() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('workflowId');
  const runId = searchParams.get('runId');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowData, setWorkflowData] = useState<WorkflowShowResponse | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'graph'>('timeline');
  
  // App header state
  const [showConfigPopup, setShowConfigPopup] = useState(false);
  // Use the timezone manager hook
  const {
    timezone,
    setTimezone,
    showTimezoneSelector,
    setShowTimezoneSelector
  } = useTimezoneManager();
  const [timezoneTrigger, setTimezoneTrigger] = useState(0); // Force re-renders when timezone changes
  
  const appConfig = useAppConfig();
  
  // Update the timezoneTrigger when timezone changes to force re-renders
  useEffect(() => {
    setTimezoneTrigger(prev => prev + 1);
  }, [timezone]);

  // Fetch workflow data
  useEffect(() => {
    if (!workflowId) {
      setError('Workflow ID is required');
      setLoading(false);
      return;
    }

    const fetchWorkflowData = async () => {
      try {
        const url = `/api/v1/workflow/show?workflowId=${encodeURIComponent(workflowId)}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch workflow data');
        }
        
        const data: WorkflowShowResponse = await response.json();
        setWorkflowData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching workflow data:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while fetching workflow data');
        setLoading(false);
      }
    };

    fetchWorkflowData();
  }, [workflowId, runId]);

  // No graph logic needed here anymore - moved to WorkflowGraph.tsx

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-500 text-lg mb-3">Error loading workflow</div>
          <div className="text-red-700">{error}</div>
          <div className="mt-4">
            <Link href="/" className="text-blue-500 hover:underline">
              Return to workflow search
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        {/* App header component with title and controls */}
        <AppHeader 
          config={{
            temporalHostPort: appConfig.temporalHostPort || '', 
            temporalNamespace: appConfig.temporalNamespace || '',
            temporalWebUI: appConfig.temporalWebUI || '',
          }}
          timezone={timezone}
          setShowConfigPopup={setShowConfigPopup}
          setShowTimezoneSelector={setShowTimezoneSelector}
        />
        
        {/* Config popup */}
        {showConfigPopup && (
          <ConfigPopup 
            config={appConfig}
            onClose={() => setShowConfigPopup(false)}
          />
        )}
        
        {/* Timezone selector popup */}
        {showTimezoneSelector && (
          <TimezoneSelector 
            timezone={timezone}
            setTimezone={setTimezone}
            onClose={() => setShowTimezoneSelector(false)}
          />
        )}
      
        {workflowData && (
          <>
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">Workflow Summary</h2>
                <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                  ← Back to Search
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Workflow ID</div>
                  <div className="mt-1 text-gray-900 truncate">{workflowId}</div>
                </div>
                <div className="col-span-1">
                  <div className="text-sm font-medium text-gray-500">Run ID</div>
                  {runId && (
                    <div className="mt-1 text-gray-900 break-all font-mono text-xs">
                      <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded mr-1">Current</span> 
                      {runId}
                    </div>
                  )}
                  {workflowData.historyEvents[0].workflowStarted.input?.isResumeFromContinueAsNew &&
                   workflowData.historyEvents[0].workflowStarted.input?.continueAsNewInput?.previousInternalRunId && (
                    <div className="mt-2 text-gray-900 break-all font-mono text-xs">
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded mr-1">Previous</span> 
                      <Link 
                        href={`/workflow/show?workflowId=${encodeURIComponent(workflowId)}&runId=${encodeURIComponent(workflowData.historyEvents[0].workflowStarted.input.continueAsNewInput.previousInternalRunId)}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {workflowData.historyEvents[0].workflowStarted.input.continueAsNewInput.previousInternalRunId}
                      </Link>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Status</div>
                  <div className="mt-1">
                    <StatusBadge status={workflowData.status} />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Type</div>
                  <div className="mt-1 text-gray-900">{workflowData.workflowType}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Started</div>
                  <div className="mt-1 text-gray-900">
                    {formatTimestamp(workflowData.workflowStartedTimestamp * 1000, timezone)}
                  </div>
                </div>
                {workflowData.status === 'COMPLETED' && workflowData.historyEvents?.some(e => e.eventType === 'WorkflowClosed') && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Closed</div>
                    <div className="mt-1 text-gray-900">
                      {formatTimestamp(
                        workflowData.historyEvents.find(e => e.eventType === 'WorkflowClosed')?.workflowClosed?.workflowClosedTimestamp * 1000,
                        timezone
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                <WorkflowConfigPopup 
                  workflowInput={workflowData.historyEvents[0].workflowStarted.input}
                  continueAsNewSnapshot={workflowData.historyEvents[0].workflowStarted.continueAsNewSnapshot}
                />
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">Workflow History</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`px-3 py-1 rounded ${
                      viewMode === 'timeline' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => setViewMode('graph')}
                    className={`px-3 py-1 rounded ${
                      viewMode === 'graph' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Graph
                  </button>
                </div>
              </div>
              
              {viewMode === 'timeline' && workflowData.historyEvents && (
                <div className="border border-gray-200 rounded-lg p-4">
                  {/* Using timezoneTrigger in key to force complete remounting of component when timezone changes */}
                  <WorkflowTimeline 
                    workflowStartedTimestamp={workflowData.workflowStartedTimestamp}
                    historyEvents={workflowData.historyEvents}
                    timezone={timezone}
                  />
                </div>
              )}
              
              {viewMode === 'graph' && workflowData && (
                <WorkflowGraph 
                  workflowData={workflowData}
                  timezone={timezone}
                  timezoneTrigger={timezoneTrigger}
                />
              )}
              
              {(!workflowData.historyEvents || workflowData.historyEvents.length === 0) && (
                <div className="flex items-center justify-center h-40 border border-gray-200 rounded-lg">
                  <p className="text-gray-500">No workflow history events available</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}