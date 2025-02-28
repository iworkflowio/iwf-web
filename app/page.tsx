'use client';

import { useState, useEffect, useRef } from 'react';
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

// Define table column configuration
interface ColumnDef {
  id: string;
  label: string;
  accessor: (workflow: WorkflowSearchResponseEntry) => React.ReactNode;
  visible: boolean;
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

  // Column management
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: 'workflowId', label: 'Workflow ID', accessor: (w) => w.workflowId, visible: true },
    { id: 'workflowRunId', label: 'Run ID', accessor: (w) => w.workflowRunId, visible: true },
    { id: 'workflowType', label: 'Type', accessor: (w) => w.workflowType || 'N/A', visible: true },
    { id: 'workflowStatus', label: 'Status', accessor: (w) => getStatusBadge(w.workflowStatus), visible: true },
    { id: 'startTime', label: 'Start Time', accessor: (w) => formatTimestamp(w.startTime), visible: true },
    { id: 'closeTime', label: 'Close Time', accessor: (w) => formatTimestamp(w.closeTime), visible: true },
    { id: 'taskQueue', label: 'Task Queue', accessor: (w) => w.taskQueue || 'N/A', visible: true },
    { id: 'historySizeInBytes', label: 'History Size', accessor: (w) => formatBytes(w.historySizeInBytes), visible: true },
    { id: 'historyLength', label: 'History Length', accessor: (w) => w.historyLength?.toString() || 'N/A', visible: true },
    { 
      id: 'customSearchAttributes', 
      label: 'Search Attributes', 
      accessor: (w) => (
        <button
          onClick={() => showSearchAttributes(w.customSearchAttributes)}
          className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs"
          style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.25rem' }}
        >
          {w.customSearchAttributes?.length || 0} attributes
        </button>
      ),
      visible: true 
    },
    { 
      id: 'customTags', 
      label: 'Tags', 
      accessor: (w) => (
        <button
          onClick={() => showCustomTags(w.customTags)}
          className="bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded text-xs"
          style={{ backgroundColor: '#22c55e', color: 'white', borderRadius: '0.25rem' }}
        >
          {w.customTags?.length || 0} tags
        </button>
      ),
      visible: true
    },
  ]);

  // Show column selector popup
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // For drag and drop functionality
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const draggedOverColumnId = useRef<string | null>(null);

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

  // Toggle column visibility
  const toggleColumnVisibility = (columnId: string) => {
    setColumns(columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  // Reset column visibility (show all)
  const resetColumnVisibility = () => {
    setColumns(columns.map(col => ({ ...col, visible: true })));
  };

  // Handler for starting column drag
  const handleDragStart = (columnId: string) => {
    setDraggedColumnId(columnId);
  };

  // Handler for dragging over another column
  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    draggedOverColumnId.current = columnId;
  };

  // Handler for ending column drag
  const handleDragEnd = () => {
    if (draggedColumnId && draggedOverColumnId.current) {
      // Reorder columns
      const draggedColIndex = columns.findIndex(col => col.id === draggedColumnId);
      const dropColIndex = columns.findIndex(col => col.id === draggedOverColumnId.current);
      
      if (draggedColIndex !== -1 && dropColIndex !== -1) {
        const newColumns = [...columns];
        const [draggedCol] = newColumns.splice(draggedColIndex, 1);
        newColumns.splice(dropColIndex, 0, draggedCol);
        setColumns(newColumns);
      }
    }
    
    // Reset drag state
    setDraggedColumnId(null);
    draggedOverColumnId.current = null;
  };

  // Component for column selector popup
  const ColumnSelector = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', width: '100%', maxWidth: '28rem' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Customize Columns</h3>
          <button 
            onClick={() => setShowColumnSelector(false)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Select columns to display:</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {columns.map(column => (
              <div key={column.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`column-${column.id}`}
                  checked={column.visible}
                  onChange={() => toggleColumnVisibility(column.id)}
                  className="mr-2"
                />
                <label htmlFor={`column-${column.id}`}>{column.label}</label>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={resetColumnVisibility}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm"
          >
            Show All
          </button>
          <button
            onClick={() => setShowColumnSelector(false)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  // Get visible columns
  const visibleColumns = columns.filter(col => col.visible);

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
        <div className="relative">
          <div className="mb-2 flex justify-end">
            <button
              onClick={() => setShowColumnSelector(true)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded text-sm flex items-center"
              style={{ backgroundColor: '#e5e7eb', borderRadius: '0.25rem' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Customize
            </button>
          </div>
          
          <div className="overflow-x-auto" style={{ overflowX: 'auto' }}>
            <table className="min-w-full bg-white border" style={{ width: '100%', minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-100">
                  {visibleColumns.map(column => (
                    <th 
                      key={column.id}
                      className="py-2 px-4 border text-left cursor-move"
                      draggable
                      onDragStart={() => handleDragStart(column.id)}
                      onDragOver={(e) => handleDragOver(e, column.id)}
                      onDragEnd={handleDragEnd}
                      style={{ userSelect: 'none' }}
                    >
                      <div className="flex items-center">
                        <span className="mr-1">≡</span> {column.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((workflow) => (
                  <tr key={`${workflow.workflowId}-${workflow.workflowRunId}`} className="hover:bg-gray-50">
                    {visibleColumns.map(column => (
                      <td key={column.id} className="py-2 px-4 border">
                        {column.accessor(workflow)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Popup for column selection */}
      {showColumnSelector && <ColumnSelector />}
    </div>
  );
}