'use client';

import { useState, useEffect } from 'react';
import { WorkflowSearchResponse, WorkflowSearchResponseEntry, WorkflowStatus, SearchAttribute } from './ts-api/src/api-gen/api';

// Popup component for displaying arrays
interface PopupProps {
  title: string;
  content: React.ReactNode;
  onClose: () => void;
}

function Popup({ title, content, onClose }: PopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', width: '100%', maxWidth: '42rem' }}>
        <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="text-lg font-bold">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            style={{ color: '#6b7280' }}
          >
            ✕
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
          {content}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkflowSearchResponseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState<{
    show: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    show: false,
    title: '',
    content: null,
  });

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

  // Function to format size in bytes
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return 'N/A';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Function to get a status badge with appropriate color
  const getStatusBadge = (status?: WorkflowStatus) => {
    if (!status) return null;
    
    let badgeClass = 'badge ';
    let bgColor = '';
    
    switch (status) {
      case 'RUNNING':
        badgeClass += 'badge-blue';
        bgColor = 'bg-blue-500';
        break;
      case 'COMPLETED':
        badgeClass += 'badge-green';
        bgColor = 'bg-green-500';
        break;
      case 'FAILED':
        badgeClass += 'badge-red';
        bgColor = 'bg-red-500';
        break;
      case 'TIMEOUT':
        badgeClass += 'badge-yellow';
        bgColor = 'bg-yellow-500';
        break;
      case 'TERMINATED':
        badgeClass += 'badge-gray';
        bgColor = 'bg-gray-500';
        break;
      case 'CANCELED':
        badgeClass += 'badge-orange';
        bgColor = 'bg-orange-500';
        break;
      case 'CONTINUED_AS_NEW':
        badgeClass += 'badge-purple';
        bgColor = 'bg-purple-500';
        break;
      default:
        badgeClass += 'badge-gray';
        bgColor = 'bg-gray-400';
    }
    
    return (
      <span className={`${badgeClass} ${bgColor} text-white px-2 py-1 rounded-full text-xs font-medium`}>
        {status}
      </span>
    );
  };

  // Function to show custom search attributes in a popup
  const showSearchAttributes = (attributes?: SearchAttribute[]) => {
    if (!attributes || attributes.length === 0) {
      setPopup({
        show: true,
        title: 'Custom Search Attributes',
        content: <p className="text-gray-500">No custom search attributes available</p>,
      });
      return;
    }

    setPopup({
      show: true,
      title: 'Custom Search Attributes',
      content: (
        <div className="space-y-4">
          {attributes.map((attr, index) => {
            let value: string | number | boolean | string[] | null = null;
            if (attr.stringValue !== undefined) value = attr.stringValue;
            else if (attr.integerValue !== undefined) value = attr.integerValue;
            else if (attr.doubleValue !== undefined) value = attr.doubleValue;
            else if (attr.boolValue !== undefined) value = attr.boolValue ? 'true' : 'false';
            else if (attr.stringArrayValue) value = attr.stringArrayValue;

            let displayValue: React.ReactNode;
            if (Array.isArray(value)) {
              displayValue = (
                <ul className="list-disc pl-5">
                  {value.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              );
            } else {
              displayValue = <span>{value?.toString() || 'null'}</span>;
            }

            return (
              <div key={index} className="border p-3 rounded">
                <div className="font-medium mb-1">{attr.key} <span className="text-xs text-gray-500">({attr.valueType})</span></div>
                <div>{displayValue}</div>
              </div>
            );
          })}
        </div>
      ),
    });
  };

  // Function to show custom tags in a popup
  const showCustomTags = (tags?: string[]) => {
    if (!tags || tags.length === 0) {
      setPopup({
        show: true,
        title: 'Custom Tags',
        content: <p className="text-gray-500">No custom tags available</p>,
      });
      return;
    }

    setPopup({
      show: true,
      title: 'Custom Tags',
      content: (
        <div className="space-y-2">
          {tags.map((tag, index) => (
            <div key={index} className="bg-gray-100 p-2 rounded">
              {tag}
            </div>
          ))}
        </div>
      ),
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Workflow Search</h1>
      
      <div className="flex mb-4" style={{ display: 'flex' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter search query"
          className="flex-grow border rounded-l px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ flexGrow: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {error && (
        <div className="alert alert-error bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-10" style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem 0' }}>
          <div className="spinner animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : results.length > 0 ? (
        <div className="overflow-x-auto" style={{ overflowX: 'auto' }}>
          <table className="min-w-full bg-white border" style={{ width: '100%', minWidth: '100%' }}>
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border text-left">Workflow ID</th>
                <th className="py-2 px-4 border text-left">Run ID</th>
                <th className="py-2 px-4 border text-left">Type</th>
                <th className="py-2 px-4 border text-left">Status</th>
                <th className="py-2 px-4 border text-left">Start Time</th>
                <th className="py-2 px-4 border text-left">Close Time</th>
                <th className="py-2 px-4 border text-left">Task Queue</th>
                <th className="py-2 px-4 border text-left">History Size</th>
                <th className="py-2 px-4 border text-left">History Length</th>
                <th className="py-2 px-4 border text-left">Search Attributes</th>
                <th className="py-2 px-4 border text-left">Tags</th>
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
                  <td className="py-2 px-4 border">{formatBytes(workflow.historySizeInBytes)}</td>
                  <td className="py-2 px-4 border">{workflow.historyLength || 'N/A'}</td>
                  <td className="py-2 px-4 border">
                    <button
                      onClick={() => showSearchAttributes(workflow.customSearchAttributes)}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs"
                      style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.25rem' }}
                    >
                      {workflow.customSearchAttributes?.length || 0} attributes
                    </button>
                  </td>
                  <td className="py-2 px-4 border">
                    <button
                      onClick={() => showCustomTags(workflow.customTags)}
                      className="bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded text-xs"
                      style={{ backgroundColor: '#22c55e', color: 'white', borderRadius: '0.25rem' }}
                    >
                      {workflow.customTags?.length || 0} tags
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500" style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>
          No workflows found. Try a different search query.
        </div>
      )}

      {/* Popup for displaying search attributes or custom tags */}
      {popup.show && (
        <Popup
          title={popup.title}
          content={popup.content}
          onClose={() => setPopup({ ...popup, show: false })}
        />
      )}
    </div>
  );
}