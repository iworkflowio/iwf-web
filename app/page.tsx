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
  // ReferenceError: timezone is not defined
  // The Popup component can't access timezone directly, we'll need to declare it differently
  // For now, we'll just use the component without timezone tracking

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

// Type for timezone configuration
interface TimezoneOption {
  label: string;
  value: string;
  offset: number; // in minutes from UTC
}

// Define timezone options without runtime calculations
const getTimezoneOptions = (): TimezoneOption[] => {
  // Local timezone offset needs to be calculated at runtime to avoid hydration errors
  const localOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() * -1 : 0;
  
  return [
    { label: 'Local Time', value: 'local', offset: localOffset },
    { label: 'UTC', value: 'UTC', offset: 0 },
    { label: 'Pacific Time (PT)', value: 'America/Los_Angeles', offset: -420 }, // UTC-7 or UTC-8 depending on DST
    { label: 'Mountain Time (MT)', value: 'America/Denver', offset: -360 }, // UTC-6 or UTC-7 depending on DST
    { label: 'Central Time (CT)', value: 'America/Chicago', offset: -300 }, // UTC-5 or UTC-6 depending on DST
    { label: 'Eastern Time (ET)', value: 'America/New_York', offset: -240 }, // UTC-4 or UTC-5 depending on DST
    { label: 'GMT', value: 'Europe/London', offset: 60 }, // UTC+1 or UTC+0 depending on DST
    { label: 'Central European Time (CET)', value: 'Europe/Paris', offset: 120 }, // UTC+2 or UTC+1 depending on DST
    { label: 'India (IST)', value: 'Asia/Kolkata', offset: 330 }, // UTC+5:30
    { label: 'China (CST)', value: 'Asia/Shanghai', offset: 480 }, // UTC+8
    { label: 'Japan (JST)', value: 'Asia/Tokyo', offset: 540 }, // UTC+9
    { label: 'Australia Eastern (AEST)', value: 'Australia/Sydney', offset: 600 }, // UTC+10 or UTC+11 depending on DST
  ];
};

export default function WorkflowSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkflowSearchResponseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Initialize timezoneOptions in a client-safe way using useEffect
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneOption[]>([]);
  useEffect(() => {
    // Only run on the client to avoid hydration mismatch
    setTimezoneOptions(getTimezoneOptions());
  }, []);
  
  // Default timezone for server rendering - will be replaced on client
  const defaultTimezone: TimezoneOption = { label: 'Local Time', value: 'local', offset: 0 };
  
  // Initialize timezone state with a safe default
  const [timezone, setTimezone] = useState<TimezoneOption>(defaultTimezone);
  
  // Load saved timezone from localStorage after component mounts
  useEffect(() => {
    // This only runs on the client after hydration
    if (typeof window !== 'undefined') {
      const tzOptions = getTimezoneOptions();
      let selectedTz = tzOptions[0]; // Default to first option (Local Time)
      
      // Try to load from localStorage
      const savedTimezone = localStorage.getItem('selectedTimezone');
      if (savedTimezone) {
        try {
          const parsed = JSON.parse(savedTimezone);
          // Find matching timezone in our options
          const match = tzOptions.find(tz => tz.value === parsed.value);
          if (match) selectedTz = match;
        } catch (e) {
          console.error('Error parsing saved timezone:', e);
        }
      }
      
      setTimezone(selectedTz);
    }
  }, []);
  
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);
  const [popup, setPopup] = useState<{
    show: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    show: false,
    title: '',
    content: null,
  });
  
  // Save timezone to localStorage whenever it changes (except during initial load)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedTimezone', JSON.stringify({
        value: timezone.value,
        label: timezone.label
      }));
    }
  }, [timezone]);

  // Function to generate time column accessor that respects timezone
  const createTimeColumnAccessor = (timeGetter: (w: WorkflowSearchResponseEntry) => number | undefined) => {
    // Return a function that will use the current timezone setting when called
    return (w: WorkflowSearchResponseEntry) => formatTimestamp(timeGetter(w));
  };
  
  // Initialize columns when component mounts and update when timezone changes
  useEffect(() => {
    // Update column accessors whenever timezone changes
    setColumns(getColumnsWithAccessors());
    
    // Force re-render of timestamp columns when timezone changes
    if (!isInitialMount.current) {
      const newResults = [...results];
      setResults(newResults);
    }
  }, [timezone]); // Re-run when timezone changes

  // Define base column definitions without time-dependent accessors
  const baseColumns: Omit<ColumnDef, 'accessor'>[] = [
    { id: 'workflowStatus', label: 'Status', visible: true },
    { id: 'workflowType', label: 'Type', visible: true },
    { id: 'workflowId', label: 'Workflow ID', visible: true },
    { id: 'workflowRunId', label: 'Run ID', visible: true },
    { id: 'startTime', label: 'Start Time', visible: true },
    { id: 'closeTime', label: 'Close Time', visible: true },
    { id: 'taskQueue', label: 'Task Queue', visible: false },
    { id: 'historySizeInBytes', label: 'History Size', visible: false },
    { id: 'historyLength', label: 'History Length', visible: false },
    { id: 'customSearchAttributes', label: 'Search Attributes', visible: true }
  ];
  
  // Create columns with accessors that will re-evaluate when timezone changes
  const getColumnsWithAccessors = (): ColumnDef[] => {
    return baseColumns.map(col => {
      let accessor;
      
      switch (col.id) {
        case 'workflowStatus':
          accessor = (w: WorkflowSearchResponseEntry) => getStatusBadge(w.workflowStatus);
          break;
        case 'workflowId':
          accessor = (w: WorkflowSearchResponseEntry) => w.workflowId;
          break;
        case 'workflowRunId':
          accessor = (w: WorkflowSearchResponseEntry) => w.workflowRunId;
          break;
        case 'workflowType':
          accessor = (w: WorkflowSearchResponseEntry) => w.workflowType || 'N/A';
          break;
        case 'startTime':
          // Create dynamic accessor that will use the current timezone setting
          accessor = createTimeColumnAccessor(w => w.startTime);
          break;
        case 'closeTime':
          // Create dynamic accessor that will use the current timezone setting
          accessor = createTimeColumnAccessor(w => w.closeTime);
          break;
        case 'taskQueue':
          accessor = (w: WorkflowSearchResponseEntry) => w.taskQueue || 'N/A';
          break;
        case 'historySizeInBytes':
          accessor = (w: WorkflowSearchResponseEntry) => formatBytes(w.historySizeInBytes);
          break;
        case 'historyLength':
          accessor = (w: WorkflowSearchResponseEntry) => w.historyLength?.toString() || 'N/A';
          break;
        case 'customSearchAttributes':
          accessor = (w: WorkflowSearchResponseEntry) => (
            <button
              onClick={() => showSearchAttributes(w.customSearchAttributes)}
              className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs"
              style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.25rem' }}
            >
              {w.customSearchAttributes?.length || 0} attributes
            </button>
          );
          break;
        default:
          accessor = () => 'N/A';
      }
      
      return { ...col, accessor };
    });
  };
  
  // Generate columns including accessors
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  
  // Apply saved column order when initializing columns
  useEffect(() => {
    if (columns.length > 0 && columnsOrderRef.current.length > 0) {
      // Create a new array with columns in the saved order
      const orderedColumns = [...columns].sort((a, b) => {
        const aIndex = columnsOrderRef.current.indexOf(a.id);
        const bIndex = columnsOrderRef.current.indexOf(b.id);
        
        // Handle columns that aren't in the saved order (new columns)
        if (aIndex === -1) return 1; // Put at the end
        if (bIndex === -1) return -1; // Put at the end
        
        return aIndex - bIndex;
      });
      
      // Only update if order is different
      if (JSON.stringify(orderedColumns.map(c => c.id)) !== JSON.stringify(columns.map(c => c.id))) {
        setColumns(orderedColumns);
      }
    }
  }, [columns]);

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
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle API error from Temporal or other backend errors
        let errorMessage = data.detail || 'Error processing request';
        if (data.error) {
          errorMessage += `: ${data.error}`;
        }
        throw new Error(errorMessage);
      }
      
      setResults(data.workflowExecutions || []);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setResults([]); // Clear results on error
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

  // Function to format timestamp with selected timezone
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    
    if (timezone.value === 'local') {
      // Use local timezone (browser default)
      return date.toLocaleString();
    } else if (timezone.value === 'UTC') {
      // Format in UTC
      return date.toLocaleString('en-US', { timeZone: 'UTC' });
    } else {
      // Use specified timezone
      try {
        // Try to use Intl API with timezone
        return date.toLocaleString('en-US', { 
          timeZone: timezone.value,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: true
        });
      } catch (err) {
        // Fallback to manual offset calculation if timezone is not supported
        const offsetMillis = timezone.offset * 60 * 1000;
        const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
        const adjustedTime = new Date(utcTime + offsetMillis);
        return `${adjustedTime.toLocaleString()} ${timezone.label.split('(')[1]?.split(')')[0] || ''}`;
      }
    }
  };
  
  // Timezone selector component
  const TimezoneSelector = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', width: '100%', maxWidth: '28rem' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Select Timezone</h3>
          <button 
            onClick={() => setShowTimezoneSelector(false)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ✕
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Choose a timezone to display timestamp values:
        </p>
        
        <div className="border rounded-lg overflow-hidden mb-4">
          <div className="bg-gray-50 border-b py-2 px-3 grid grid-cols-12">
            <div className="col-span-1"></div>
            <div className="col-span-7 font-medium text-sm">Timezone</div>
            <div className="col-span-4 font-medium text-sm">UTC Offset</div>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {timezoneOptions.length > 0 ? (
              timezoneOptions.map((tz) => (
                <div 
                  key={tz.value} 
                  className={`grid grid-cols-12 items-center py-2 px-3 border-b last:border-b-0 hover:bg-gray-50 ${timezone.value === tz.value ? 'bg-blue-50' : ''}`}
                  onClick={() => {
                    // Update timezone and force UI update when clicking the row
                    setTimezone(tz);
                  }}
                >
                  <div className="col-span-1 flex justify-center">
                    <input
                      type="radio"
                      id={`tz-${tz.value}`}
                      name="timezone"
                      checked={timezone.value === tz.value}
                      onChange={() => {
                        // Update timezone and force UI update
                        setTimezone(tz);
                        // Leave selector open to let user see the effect in real-time
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <label htmlFor={`tz-${tz.value}`} className="col-span-7 cursor-pointer text-sm">
                    {tz.label}
                  </label>
                  <div className="col-span-4 text-gray-500 text-sm">
                    {tz.value === 'local' ? (
                      'Browser default'
                    ) : (
                      <span>
                        UTC {tz.offset >= 0 ? '+' : ''}{Math.floor(tz.offset / 60)}:
                        {Math.abs(tz.offset % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                Loading timezone options...
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-between">
          <div className="text-sm text-gray-500">
            <span>Current time: {formatTimestamp(Date.now())}</span>
          </div>
          <button
            onClick={() => setShowTimezoneSelector(false)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md text-sm"
            style={{ backgroundColor: '#f3f4f6', color: '#1f2937', borderRadius: '0.375rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

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

    // Force this component to update whenever timezone changes
    const currentTimezone = timezone.value;

    setPopup({
      show: true,
      title: 'Custom Search Attributes',
      content: (
        <div className="space-y-4" key={`attrs-${currentTimezone}`}> {/* Add key to force re-render */}
          {attributes.map((attr, index) => {
            let value: string | number | boolean | string[] | null = null;
            if (attr.stringValue !== undefined) value = attr.stringValue;
            else if (attr.integerValue !== undefined) value = attr.integerValue;
            else if (attr.doubleValue !== undefined) value = attr.doubleValue;
            else if (attr.boolValue !== undefined) value = attr.boolValue ? 'true' : 'false';
            else if (attr.stringArrayValue) value = attr.stringArrayValue;

            // Format timestamp values if this is a datetime field
            if (attr.valueType === 'DATETIME' && typeof value === 'number') {
              value = formatTimestamp(value);
            }

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

  // Function to show custom tags in a popup (removed)

  // Store column visibility state separately to preserve across timezone changes
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    // Try to load saved column visibility from localStorage
    if (typeof window !== 'undefined') {
      const savedVisibility = localStorage.getItem('columnVisibility');
      if (savedVisibility) {
        try {
          return JSON.parse(savedVisibility);
        } catch (e) {
          console.error('Error parsing saved column visibility:', e);
        }
      }
    }
    
    // Default visibility if nothing is saved
    const initialVisibility: Record<string, boolean> = {};
    baseColumns.forEach(col => {
      initialVisibility[col.id] = col.visible;
    });
    return initialVisibility;
  });

  // Update column visibility when initializing or changing timezone
  useEffect(() => {
    setColumns(getColumnsWithAccessors().map(col => ({
      ...col,
      visible: columnVisibility[col.id] ?? col.visible
    })));
  }, [timezone, columnVisibility]);
  
  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialMount.current) {
      localStorage.setItem('columnVisibility', JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  // Toggle column visibility
  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  // Reset column visibility (show all)
  const resetColumnVisibility = () => {
    const resetVisibility: Record<string, boolean> = {};
    baseColumns.forEach(col => {
      resetVisibility[col.id] = true;
    });
    setColumnVisibility(resetVisibility);
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

  // Forward declaration to fix initialization order issue
  const columnsOrderRef = useRef<string[]>(baseColumns.map(col => col.id));
  
  // Store columns order - initialize after ref is created
  const [columnsOrder, setColumnsOrder] = useState<string[]>(() => {
    // Try to load saved column order from localStorage
    if (typeof window !== 'undefined') {
      const savedOrder = localStorage.getItem('columnsOrder');
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          columnsOrderRef.current = parsed; // Update ref with parsed value
          return parsed;
        } catch (e) {
          console.error('Error parsing saved column order:', e);
        }
      }
    }
    
    // Default to base column order if nothing is saved
    return columnsOrderRef.current;
  });
  
  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialMount.current) {
      localStorage.setItem('columnsOrder', JSON.stringify(columnsOrder));
    }
  }, [columnsOrder]);
  
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
        
        // Update and save the new column order
        const newOrder = newColumns.map(col => col.id);
        columnsOrderRef.current = newOrder; // Update ref immediately
        setColumnsOrder(newOrder);
      }
    }
    
    // Reset drag state
    setDraggedColumnId(null);
    draggedOverColumnId.current = null;
  };

  // Component for column selector popup
  const ColumnSelector = () => {
    // States for search attribute columns management
    const [attributeColumns, setAttributeColumns] = useState<Map<string, boolean>>(new Map());

    // Find all unique search attribute keys in all workflows
    useEffect(() => {
      const attributeKeysMap = new Map<string, boolean>();
      
      results.forEach(workflow => {
        if (workflow.customSearchAttributes) {
          workflow.customSearchAttributes.forEach(attr => {
            if (attr.key) {
              // Check if this attribute key is already a column
              const isAlreadyColumn = columns.some(col => col.id === `attr_${attr.key}`);
              // If it's not already a column, add it to our map
              if (!isAlreadyColumn) {
                attributeKeysMap.set(attr.key, false);
              }
            }
          });
        }
      });
      
      setAttributeColumns(attributeKeysMap);
    }, [results]);

    // Format search attribute value for display
    const formatAttributeValue = (attr: SearchAttribute) => {
      if (attr.stringValue !== undefined) return attr.stringValue;
      if (attr.integerValue !== undefined) return attr.integerValue.toString();
      if (attr.doubleValue !== undefined) return attr.doubleValue.toString();
      if (attr.boolValue !== undefined) return attr.boolValue ? 'true' : 'false';
      if (attr.stringArrayValue) {
        if (attr.stringArrayValue.length === 0) return '[]';
        if (attr.stringArrayValue.length === 1) return attr.stringArrayValue[0];
        return attr.stringArrayValue.length <= 2 
          ? attr.stringArrayValue.join(', ')
          : `${attr.stringArrayValue[0]}, ${attr.stringArrayValue[1]}, ... (${attr.stringArrayValue.length})`;
      }
      return 'N/A';
    };
    
    // Get value type label
    const getValueTypeLabel = (attr?: SearchAttribute) => {
      if (!attr?.valueType) return '';
      
      switch (attr.valueType) {
        case 'KEYWORD': return 'K';
        case 'TEXT': return 'T';
        case 'DATETIME': return 'DT';
        case 'INT': return 'I';
        case 'DOUBLE': return 'D';
        case 'BOOL': return 'B';
        case 'KEYWORD_ARRAY': return 'K[]';
        default: return '';
      }
    };
    
    // Add a search attribute as a column
    const addAttributeColumn = (attributeKey: string) => {
      // Find an example attribute to get its type
      const exampleAttr = results.flatMap(w => w.customSearchAttributes || [])
                            .find(a => a.key === attributeKey);
      const valueTypeLabel = getValueTypeLabel(exampleAttr);
            
      // Create a new column for this attribute
      const newColumn: ColumnDef = {
        id: `attr_${attributeKey}`,
        label: valueTypeLabel ? `${attributeKey} (${valueTypeLabel})` : attributeKey,
        accessor: (workflow) => {
          const attr = workflow.customSearchAttributes?.find(a => a.key === attributeKey);
          if (!attr) return 'N/A';
          
          // Render different attribute types with appropriate formatting
          return formatAttributeValue(attr);
        },
        visible: true
      };
      
      // Add to columns
      setColumns([...columns, newColumn]);
      
      // Update attribute map
      const newMap = new Map(attributeColumns);
      newMap.delete(attributeKey);
      setAttributeColumns(newMap);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', width: '100%', maxWidth: '36rem' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Customize Table Columns</h3>
            <button 
              onClick={() => setShowColumnSelector(false)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            {/* Current columns section */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-2">Current Columns</h4>
              <p className="text-sm text-gray-500 mb-3">Select which columns to display in the table:</p>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto p-2">
                {columns.map(column => (
                  <div key={column.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`column-${column.id}`}
                        checked={column.visible}
                        onChange={() => toggleColumnVisibility(column.id)}
                        className="w-4 h-4 mr-2 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor={`column-${column.id}`} className="text-sm">
                        {column.label}
                      </label>
                    </div>
                    
                    {/* Show remove button for custom attribute columns */}
                    {column.id.startsWith('attr_') && (
                      <button
                        onClick={() => {
                          // Remove this column
                          setColumns(columns.filter(c => c.id !== column.id));
                          
                          // Add the attribute back to the available list
                          const attrKey = column.id.replace('attr_', '');
                          const newMap = new Map(attributeColumns);
                          newMap.set(attrKey, false);
                          setAttributeColumns(newMap);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Remove column"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Add search attribute columns section */}
            {attributeColumns.size > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">Add Search Attribute Columns</h4>
                <p className="text-sm text-gray-500 mb-3">Add custom search attributes as columns:</p>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto p-2">
                  {Array.from(attributeColumns.entries()).map(([key]) => (
                    <div key={key} className="flex items-center">
                      <button
                        onClick={() => addAttributeColumn(key)}
                        className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded-full flex items-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {key}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={resetColumnVisibility}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md text-sm"
              style={{ backgroundColor: '#f3f4f6', borderRadius: '0.375rem' }}
            >
              Show All Columns
            </button>
            <button
              onClick={() => setShowColumnSelector(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm"
              style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.375rem' }}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Get visible columns
  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="container mx-auto p-4">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">iWF Workflows</h1>
            <div className="mt-1 text-blue-100 text-sm">
              <a 
                href="https://github.com/indeedeng/iwf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Indeed Workflow Framework
              </a>
            </div>
          </div>
          
          <button
            onClick={() => setShowTimezoneSelector(true)}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-1 px-3 rounded text-sm flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timezone.label}
          </button>
        </div>
      </div>
      
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
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="font-medium">Error</p>
          </div>
          <p className="mt-2">{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-10" style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem 0' }}>
          <div className="spinner animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : results.length > 0 ? (
        <div className="relative">
          <div className="mb-2 flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {visibleColumns.length} columns displayed 
              {columns.some(c => c.id.startsWith('attr_')) && 
                ` (${columns.filter(c => c.id.startsWith('attr_')).length} search attributes)`}
            </p>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowColumnSelector(true)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-3 rounded text-sm flex items-center"
                style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '0.25rem' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Add Custom Columns
              </button>
              
              <button
                onClick={() => setShowColumnSelector(true)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-3 rounded text-sm flex items-center"
                style={{ backgroundColor: '#e5e7eb', color: '#374151', borderRadius: '0.25rem' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Customize Table
              </button>
            </div>
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
      
      {/* Popup for timezone selection */}
      {showTimezoneSelector && <TimezoneSelector />}
    </div>
  );
}