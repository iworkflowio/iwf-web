'use client';

import { useState, useEffect } from 'react';
import { WorkflowSearchResponse, WorkflowSearchResponseEntry, WorkflowStatus } from './ts-api/src/api-gen/api';

export default function WorkflowSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkflowSearchResponseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to fetch workflows
  const fetchWorkflows = async (searchQuery: string = '') => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/v1/workflow/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data: WorkflowSearchResponse = await response.json();
      setResults(data.workflowExecutions || []);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Load all workflows on initial page load
  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleSearch = () => {
    fetchWorkflows(query);
  };

  // Function to format timestamp
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // Function to get a status badge with appropriate color
  const getStatusBadge = (status?: WorkflowStatus) => {
    if (!status) return null;
    
    let bgColor = '';
    switch (status) {
      case 'RUNNING':
        bgColor = 'bg-blue-500';
        break;
      case 'COMPLETED':
        bgColor = 'bg-green-500';
        break;
      case 'FAILED':
        bgColor = 'bg-red-500';
        break;
      case 'TIMEOUT':
        bgColor = 'bg-yellow-500';
        break;
      case 'TERMINATED':
        bgColor = 'bg-gray-500';
        break;
      case 'CANCELED':
        bgColor = 'bg-orange-500';
        break;
      case 'CONTINUED_AS_NEW':
        bgColor = 'bg-purple-500';
        break;
      default:
        bgColor = 'bg-gray-400';
    }
    
    return (
      <span className={`${bgColor} text-white px-2 py-1 rounded-full text-xs font-medium`}>
        {status}
      </span>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Workflow Search</h1>
      
      <div className="flex mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter search query"
          className="flex-grow border rounded-l px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : results.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border text-left">Workflow ID</th>
                <th className="py-2 px-4 border text-left">Run ID</th>
                <th className="py-2 px-4 border text-left">Type</th>
                <th className="py-2 px-4 border text-left">Status</th>
                <th className="py-2 px-4 border text-left">Start Time</th>
                <th className="py-2 px-4 border text-left">Close Time</th>
                <th className="py-2 px-4 border text-left">Task Queue</th>
              </tr>
            </thead>
            <tbody>
              {results.map((workflow) => (
                <tr key={`${workflow.workflowId}-${workflow.workflowRunId}`} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border">{workflow.workflowId}</td>
                  <td className="py-2 px-4 border">{workflow.workflowRunId}</td>
                  <td className="py-2 px-4 border">{workflow.workflowType || 'N/A'}</td>
                  <td className="py-2 px-4 border">{getStatusBadge(workflow.workflowStatus)}</td>
                  <td className="py-2 px-4 border">{formatTimestamp(workflow.startTime)}</td>
                  <td className="py-2 px-4 border">{formatTimestamp(workflow.closeTime)}</td>
                  <td className="py-2 px-4 border">{workflow.taskQueue || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No workflows found. Try a different search query.
        </div>
      )}
    </div>
  );
}