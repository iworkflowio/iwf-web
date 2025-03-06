'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import Link from 'next/link';
import { useTimezoneManager } from '../../components/TimezoneManager';
import { formatTimestamp } from '../../components/utils';
import { WorkflowShowResponse } from '../../ts-api/src/api-gen/api';
import WorkflowTimeline from './WorkflowTimeline';

// Custom node for workflow events
const CustomEventNode = ({ data }: { data: any }) => (
  <div className={`p-3 border rounded-md shadow-md ${data.className}`}>
    <div className="font-semibold mb-1">{data.label}</div>
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
  </div>
);

// Custom node types mapping
const nodeTypes = {
  eventNode: CustomEventNode,
};

export default function WorkflowShow() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('workflowId');
  const runId = searchParams.get('runId');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowData, setWorkflowData] = useState<WorkflowShowResponse | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'graph'>('timeline');
  
  const { timezone } = useTimezoneManager();

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
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Workflow Details
            </h1>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {workflowData && (
          <>
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Workflow ID</div>
                  <div className="mt-1 text-gray-900 truncate">{workflowId}</div>
                </div>
                {runId && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Run ID</div>
                    <div className="mt-1 text-gray-900 truncate">{runId}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-500">Type</div>
                  <div className="mt-1 text-gray-900">{workflowData.workflowType}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Status</div>
                  <div className="mt-1 text-gray-900">{workflowData.status}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Started</div>
                  <div className="mt-1 text-gray-900">
                    {formatTimestamp(workflowData.workflowStartedTimestamp * 1000, timezone)}
                  </div>
                </div>
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
                  <WorkflowTimeline 
                    workflowStartedTimestamp={workflowData.workflowStartedTimestamp}
                    historyEvents={workflowData.historyEvents}
                  />
                </div>
              )}
              
              {viewMode === 'graph' && (
                <div className="h-[600px] border border-gray-200 rounded-lg">
                  {/* We'll implement ReactFlow here */}
                  <div className="h-full flex items-center justify-center">
                    <p className="text-gray-500">Graph view is coming soon</p>
                  </div>
                </div>
              )}
              
              {(!workflowData.historyEvents || workflowData.historyEvents.length === 0) && (
                <div className="flex items-center justify-center h-40 border border-gray-200 rounded-lg">
                  <p className="text-gray-500">No workflow history events available</p>
                </div>
              )}
            </div>
            
            {workflowData.input && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Workflow Input</h2>
                <pre className="bg-gray-50 p-3 rounded-lg overflow-auto max-h-96 text-sm">
                  {JSON.stringify(workflowData.input, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}