'use client';

import { useState, useEffect, useRef } from 'react';
import { WorkflowSearchResponse, WorkflowSearchResponseEntry, WorkflowStatus, SearchAttribute } from '../ts-api/src/api-gen/api';
import { ColumnDef, TimezoneOption, SavedQuery, AppConfig, PopupState, FilterSpec } from './types';
import { 
  getTimezoneOptions, 
  formatTimestamp, 
  formatFilterForQuery,
  sortQueriesByPriority
} from './utils';
import StatusBadge from './StatusBadge';

// Import our components
import SearchBox from './SearchBox';
import WorkflowList from './WorkflowList';
import TimezoneSelector from './TimezoneSelector';
import ConfigPopup from './ConfigPopup';
import AllSearchesPopup from './AllSearchesPopup';
import FilterPopup from './FilterPopup';
import ColumnSelector from './ColumnSelector';
import AppHeader from './AppHeader';
import Popup from './Popup';

/**
 * WorkflowSearchPage Component - Main application component
 * 
 * This component is the main page that ties together all the other components.
 * It manages the application state, API calls, and coordinates between components.
 */
export default function WorkflowSearchPage() {
  // Initialize query state from URL if present (for sharing/bookmarking)
  const initialQueryParams = typeof window !== 'undefined' ? {
    query: new URLSearchParams(window.location.search).get('q') || '',
    size: parseInt(new URLSearchParams(window.location.search).get('size') || '20', 10),
    token: new URLSearchParams(window.location.search).get('token') || '',
    // If no token is provided but page > 1, reset to page 1
    page: !new URLSearchParams(window.location.search).get('token') && 
          parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10) > 1 
          ? 1 
          : parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10)
  } : {
    query: '',
    page: 1,
    size: 20,
    token: ''
  };
  
  // Search query and results state
  const [query, setQuery] = useState(initialQueryParams.query);
  const [results, setResults] = useState<WorkflowSearchResponseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Pagination state
  const [pageSize, setPageSize] = useState<number>(initialQueryParams.size);
  const [currentPage, setCurrentPage] = useState<number>(initialQueryParams.page);
  const [nextPageToken, setNextPageToken] = useState<string>(initialQueryParams.token);
  const [hasMoreResults, setHasMoreResults] = useState<boolean>(false);
  const [pageHistory, setPageHistory] = useState<string[]>(() => {
    // Initialize page history array with the correct token in place
    const history = Array(initialQueryParams.page).fill('');
    if (initialQueryParams.page > 1 && initialQueryParams.token) {
      history[initialQueryParams.page - 1] = initialQueryParams.token;
    }
    return history;
  });
  
  // App configuration state
  const [config, setConfig] = useState<AppConfig>({
    temporalHostPort: '',
    temporalNamespace: ''
  });
  
  // Timezone state
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneOption[]>([]);
  // Default timezone for server rendering - will be replaced on client
  const defaultTimezone: TimezoneOption = { label: 'Local Time', value: 'local', offset: 0 };
  const [timezone, setTimezone] = useState<TimezoneOption>(defaultTimezone);
  
  // Saved searches state  
  const [recentSearches, setRecentSearches] = useState<SavedQuery[]>([]);
  const [allSearches, setAllSearches] = useState<SavedQuery[]>([]);
  
  // UI state for popups/dialogs
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);
  const [showConfigPopup, setShowConfigPopup] = useState(false);
  const [showAllSearchesPopup, setShowAllSearchesPopup] = useState(false);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Filter state
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<string>('=');
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterSpec>>({});
  
  // Generic popup state for displaying details
  const [popup, setPopup] = useState<PopupState>({
    show: false,
    title: '',
    content: null,
  });
  
  // Track if this is the initial mount to avoid unnecessary localStorage updates
  const isInitialMount = useRef(true);
  
  // Initialize timezone options and saved timezone on client side
  useEffect(() => {
    // Only run on the client to avoid hydration mismatch
    setTimezoneOptions(getTimezoneOptions());
    
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
  
  // Save timezone to localStorage whenever it changes
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
  
  // Load saved searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSearches = localStorage.getItem('allSearches');
      if (savedSearches) {
        try {
          const searches: SavedQuery[] = JSON.parse(savedSearches);
          // Ensure all saved queries have timestamp field (backward compatibility)
          const validSearches = searches.map(s => {
            if (typeof s === 'string') {
              // Convert old format to new format
              return { query: s, timestamp: Date.now() };
            }
            return { ...s, timestamp: s.timestamp || Date.now() };
          });
          
          const sortedSearches = sortQueriesByPriority(validSearches);
          setAllSearches(sortedSearches);
          setRecentSearches(sortedSearches.slice(0, 5)); // Show only 5 highest priority
        } catch (e) {
          console.error('Error parsing saved searches:', e);
        }
      }
    }
  }, []);
  
  // Define base column definitions
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
  
  // Function to generate time column accessor that respects timezone
  const createTimeColumnAccessor = (timeGetter: (w: WorkflowSearchResponseEntry) => number | undefined) => {
    // Return a function that will use the current timezone setting when called
    return (w: WorkflowSearchResponseEntry) => formatTimestamp(timeGetter(w), timezone);
  };
  
  // Create columns with accessors that will re-evaluate when timezone changes
  const getColumnsWithAccessors = (): ColumnDef[] => {
    return baseColumns.map(col => {
      let accessor;
      
      switch (col.id) {
        case 'workflowStatus':
          accessor = (w: WorkflowSearchResponseEntry) => <StatusBadge status={w.workflowStatus} />;
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
          accessor = (w: WorkflowSearchResponseEntry) => {
            if (w.historySizeInBytes === undefined) return 'N/A';
            
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (w.historySizeInBytes === 0) return '0 Byte';
            const i = Math.floor(Math.log(w.historySizeInBytes) / Math.log(1024));
            return Math.round((w.historySizeInBytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
          };
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
  
  // Store column visibility state
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
  
  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialMount.current) {
      localStorage.setItem('columnsOrder', JSON.stringify(columnsOrder));
    }
  }, [columnsOrder]);
  
  // For drag and drop functionality
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const draggedOverColumnId = useRef<string | null>(null);
  
  // Function to toggle column visibility
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
  
  // Function to update URL with search query and pagination params
  const updateUrlWithParams = (searchQuery: string, page: number = 1, size: number = 20, token: string = '') => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      
      // Update search query parameter
      if (searchQuery) {
        url.searchParams.set('q', searchQuery);
      } else {
        url.searchParams.delete('q');
      }
      
      // Update pagination parameters
      url.searchParams.set('page', page.toString());
      url.searchParams.set('size', size.toString());
      
      // Add nextPageToken to URL if it exists
      if (token) {
        url.searchParams.set('token', token);
      } else {
        url.searchParams.delete('token');
      }
      
      window.history.pushState({}, '', url.toString());
    }
  };
  
  // Save recent search to localStorage
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery) return;
    
    // Update all searches
    setAllSearches(prevSearches => {
      // Check if this query already exists
      const existingIndex = prevSearches.findIndex(s => s.query === searchQuery);
      let newSearches = [...prevSearches];
      
      if (existingIndex >= 0) {
        // If it exists, update the timestamp and keep its name
        const existing = newSearches[existingIndex];
        newSearches.splice(existingIndex, 1);
        newSearches.unshift({
          ...existing,
          query: searchQuery,
          timestamp: Date.now()
        });
      } else {
        // Add new query
        newSearches.unshift({
          query: searchQuery,
          timestamp: Date.now()
        });
      }
      
      // Keep up to 100 searches, removing low priority ones first
      if (newSearches.length > 100) {
        // Sort by priority to decide which ones to remove
        const sorted = sortQueriesByPriority(newSearches);
        newSearches = sorted.slice(0, 100);
      }
      
      // Save all searches to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('allSearches', JSON.stringify(newSearches));
      }
      
      // Update recent searches with the highest priority ones
      const sortedSearches = sortQueriesByPriority(newSearches);
      setRecentSearches(sortedSearches.slice(0, 5));
      
      return sortedSearches;
    });
  };
  
  // Update the name of a saved query
  const updateQueryName = (index: number, name: string) => {
    setAllSearches(prevSearches => {
      const newSearches = [...prevSearches];
      if (newSearches[index]) {
        newSearches[index] = {
          ...newSearches[index],
          name: name.trim() || undefined // Remove empty names
        };
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('allSearches', JSON.stringify(newSearches));
        }
        
        // Update recent searches
        const sortedSearches = sortQueriesByPriority(newSearches);
        setRecentSearches(sortedSearches.slice(0, 5));
        
        return sortedSearches;
      }
      return prevSearches;
    });
  };
  
  // Show popup to display search attributes
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
              value = formatTimestamp(value, timezone);
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

  // Function to fetch workflows
  // Execute a search with either query string or SavedQuery
  const fetchWorkflows = async (searchInput: string | SavedQuery = '', pageToken: string = '', newPageSize?: number) => {
    try {
      setLoading(true);
      setError('');
      
      // Extract the actual query string whether input is a string or SavedQuery
      let searchQuery: string;
      if (typeof searchInput === 'string') {
        searchQuery = searchInput;
      } else {
        searchQuery = searchInput.query;
        // Set the input field value to match the selected query
        setQuery(searchInput.query);
      }
      
      // Use specified page size or current page size with fallback
      const currentPageSize = newPageSize || pageSize || 20;
      const pageNum = currentPage || 1;
      
      // Update URL with the current search query and pagination params
      updateUrlWithParams(searchQuery, pageNum, currentPageSize, pageToken);
      
      // Save to recent searches only when starting a new search
      if (searchQuery && !pageToken) {
        saveRecentSearch(searchQuery);
      }
      
      // If page token is empty and it's not the first page, reset to first page
      if (!pageToken && pageNum !== 1) {
        setCurrentPage(1);
        setPageHistory(['']);
      }
      
      const response = await fetch('/api/v1/workflow/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: searchQuery,
          pageSize: currentPageSize,
          nextPageToken: pageToken || '' // Always ensure we send empty string not undefined/null
        }),
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
      
      // Update pagination state
      setNextPageToken(data.nextPageToken || '');
      setHasMoreResults(!!data.nextPageToken);
      
      // If page size changed, update it
      if (newPageSize && newPageSize !== pageSize) {
        setPageSize(newPageSize);
      }
      
      // Sync filters with query
      syncFiltersWithQuery(searchQuery);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setResults([]); // Clear results on error
      
      // Reset pagination on error
      setNextPageToken('');
      setHasMoreResults(false);
    } finally {
      setLoading(false);
    }
  };
  
  // Sync applied filters with the current query before searching
  const handleSearch = () => {
    // Before searching, parse the current query to update applied filters
    syncFiltersWithQuery(query);
    
    // Then execute the search
    fetchWorkflows(query);
  };
  
  // Parse the query to update applied filters state
  const syncFiltersWithQuery = (currentQuery: string) => {
    // Start with empty filters
    const updatedFilters: Record<string, FilterSpec> = {};
    
    // If there's no query, just clear all filters
    if (!currentQuery.trim()) {
      setAppliedFilters({});
      return;
    }
    
    // Map field names to column IDs
    const fieldToColumnMap: Record<string, string> = {
      'ExecutionStatus': 'workflowStatus',
      'WorkflowType': 'workflowType',
      'WorkflowId': 'workflowId',
      'RunId': 'workflowRunId',
      'StartTime': 'startTime',
      'CloseTime': 'closeTime',
      'TaskQueue': 'taskQueue'
    };
    
    // Define regular expressions for different filter patterns
    // This handles: Field = "value", Field = 'value', Field != "value", etc.
    const filterRegex = /(ExecutionStatus|WorkflowType|WorkflowId|RunId|StartTime|CloseTime|TaskQueue)\s*(=|!=|>|<|>=|<=)\s*['"](.*?)['"]|['"](.*?)['"]/g;
    
    let match;
    while ((match = filterRegex.exec(currentQuery)) !== null) {
      const field = match[1];
      const operator = match[2] || '=';
      const value = match[3] || match[4];
      
      if (field && value && fieldToColumnMap[field]) {
        const columnId = fieldToColumnMap[field];
        updatedFilters[columnId] = {
          value,
          operator
        };
      }
    }
    
    // Update the applied filters state
    setAppliedFilters(updatedFilters);
  };
  
  // Open filter popup for a column
  const openFilterForColumn = (columnId: string) => {
    // Don't allow filtering on search attributes collection column
    if (columnId === 'customSearchAttributes') {
      return;
    }
    
    // Find the column label for display
    const column = columns.find(col => col.id === columnId);
    if (!column) return;
    
    setActiveFilterColumn(columnId);
    
    // Set the initial values from existing filter or defaults
    if (appliedFilters[columnId]) {
      setFilterValue(appliedFilters[columnId].value);
      setFilterOperator(appliedFilters[columnId].operator);
    } else {
      setFilterValue('');
      setFilterOperator('=');
    }
    
    setShowFilterPopup(true);
  };
  
  // Apply filter to search query
  const applyFilter = () => {
    if (!activeFilterColumn) return;
    
    // Ensure the filter value is trimmed
    const trimmedValue = filterValue.trim();
    
    // Don't proceed if value is empty
    if (!trimmedValue) {
      setShowFilterPopup(false);
      return;
    }
    
    // Map the column to appropriate search field
    let queryField: string;
    
    // Handle custom attribute columns (those starting with 'attr_')
    if (activeFilterColumn.startsWith('attr_')) {
      // Extract the attribute name from the column ID (remove 'attr_' prefix)
      const attributeName = activeFilterColumn.substring(5);
      // Use just the attribute name without "SearchAttributes." prefix
      queryField = attributeName;
    } else {
      // Handle standard columns
      switch (activeFilterColumn) {
        case 'workflowStatus':
          queryField = 'ExecutionStatus';
          break;
        case 'workflowType':
          queryField = 'WorkflowType';
          break;
        case 'workflowId':
          queryField = 'WorkflowId';
          break;
        case 'workflowRunId':
          queryField = 'RunId';
          break;
        case 'startTime':
          queryField = 'StartTime';
          break;
        case 'closeTime':
          queryField = 'CloseTime';
          break;
        case 'taskQueue':
          queryField = 'TaskQueue';
          break;
        default:
          queryField = '';
      }
    }
    
    if (!queryField) {
      console.error('Failed to map column to query field:', activeFilterColumn);
      setShowFilterPopup(false);
      return;
    }
    
    // Format the value properly based on column type and value
    const customAttrsFlat = results.flatMap(w => w.customSearchAttributes || []);
    const formattedValue = formatFilterForQuery(activeFilterColumn, trimmedValue, customAttrsFlat);
    
    // Construct new filter term with the selected operator
    const newFilterTerm = `${queryField} ${filterOperator} ${formattedValue}`;
    
    // Get the current query from the input box
    let currentQuery = query.trim();
    
    // Determine if we need to append with AND
    let updatedQuery = '';
    if (currentQuery) {
      // If there's already a query, just add AND without parentheses
      updatedQuery = `${currentQuery} AND ${newFilterTerm}`;
    } else {
      // Otherwise just use the new filter term
      updatedQuery = newFilterTerm;
    }
    
    // Update the query in the input box
    setQuery(updatedQuery);
    
    // Keep track of applied filter for UI indication
    let newFilters = { ...appliedFilters };
    newFilters[activeFilterColumn] = {
      value: trimmedValue,
      operator: filterOperator
    };
    setAppliedFilters(newFilters);
    
    // Close the popup
    setShowFilterPopup(false);
    
    // Execute the search with the updated query
    setTimeout(() => {
      fetchWorkflows(updatedQuery);
    }, 50);
  };
  
  // Format date for ISO string for filter
  const formatDateForFilter = (date: Date): string => {
    // Format as ISO string with timezone offset
    const tzOffset = date.getTimezoneOffset() * -1;
    const absOffset = Math.abs(tzOffset);
    const offsetHours = Math.floor(absOffset / 60).toString().padStart(2, '0');
    const offsetMinutes = (absOffset % 60).toString().padStart(2, '0');
    const offsetSign = tzOffset >= 0 ? '+' : '-';
    
    return date.getFullYear() + '-' + 
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0') + 'T' +
      String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0') + ':' +
      String(date.getSeconds()).padStart(2, '0') + '.' +
      String(date.getMilliseconds()).padStart(3, '0') +
      offsetSign + offsetHours + ':' + offsetMinutes;
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setAppliedFilters({});
    setQuery('');
    
    // Automatically execute the search with empty query
    setTimeout(() => {
      handleSearch();
    }, 0);
  };
  
  // Define available workflow statuses for dropdown - exact values expected by Temporal API
  const workflowStatuses = [
    'Running',
    'Completed',
    'Failed',
    'Canceled',
    'Terminated',
    'ContinuedAsNew',
    'TimedOut'
  ];
  
  // Define operators based on column type
  const getOperatorsForColumn = (columnId: string): string[] => {
    // Time-based columns support all comparison operators
    if (columnId === 'startTime' || columnId === 'closeTime') {
      return ['=', '!=', '>', '<', '>=', '<='];
    }
    
    // For custom search attribute columns, determine operators based on the attribute type
    if (columnId.startsWith('attr_')) {
      const attributeName = columnId.substring(5);
      
      // Find an example of this attribute to determine its type
      const exampleAttr = results.flatMap(w => w.customSearchAttributes || [])
                        .find(a => a.key === attributeName);
      
      if (exampleAttr) {
        // Based on attribute type, provide appropriate operators
        switch(exampleAttr.valueType) {
          case 'INT':
          case 'DOUBLE':
          case 'DATETIME':
            return ['=', '!=', '>', '<', '>=', '<='];
          case 'BOOL':
            return ['=', '!='];
          case 'KEYWORD_ARRAY':
            return ['=', '!='];
          default:
            return ['=', '!='];
        }
      }
    }
    
    // Default to equality operators for string fields
    return ['=', '!='];
  };
  
  // Navigate to the next page of results
  const goToNextPage = () => {
    if (!hasMoreResults || !nextPageToken) return;
    
    // Add the current token to history before moving to the next page
    const newHistory = [...pageHistory];
    if (currentPage >= newHistory.length) {
      newHistory.push(nextPageToken);
    } else {
      newHistory[currentPage] = nextPageToken;
    }
    
    const nextPage = currentPage + 1;
    setPageHistory(newHistory);
    setCurrentPage(nextPage);
    // Update URL with new page number and token
    updateUrlWithParams(query, nextPage, pageSize, nextPageToken);
    // Use an empty string as the token for safety with JSON serialization
    fetchWorkflows(query, nextPageToken || '');
  };
  
  // Navigate to the previous page of results
  const goToPrevPage = () => {
    if (currentPage <= 1) return;
    
    const prevPageIndex = currentPage - 2;
    const prevToken = pageHistory[prevPageIndex] || '';
    const prevPage = currentPage - 1;
    
    setCurrentPage(prevPage);
    // Update URL with new page number and token
    updateUrlWithParams(query, prevPage, pageSize, prevToken);
    // Use an empty string as the token for safety with JSON serialization
    fetchWorkflows(query, prevToken || '');
  };
  
  // Go to the first page of results
  const goToFirstPage = () => {
    if (currentPage === 1) return;
    
    setCurrentPage(1);
    // Update URL with new page number and empty token
    updateUrlWithParams(query, 1, pageSize, '');
    fetchWorkflows(query, '');
  };
  
  // Change page size and reset to first page
  const changePageSize = (newSize: number) => {
    if (newSize === pageSize) return;
    
    setPageSize(newSize);
    setCurrentPage(1);
    setPageHistory(['']);
    // Update URL with new page size and empty token
    updateUrlWithParams(query, 1, newSize, '');
    fetchWorkflows(query, '', newSize);
  };
  
  // Fetch configuration and initial workflows
  useEffect(() => {
    // Fetch configuration
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/v1/config');
        if (response.ok) {
          const configData = await response.json();
          setConfig({
            temporalHostPort: configData.temporalHostPort || 'localhost:7233',
            temporalNamespace: configData.temporalNamespace || 'default'
          });
        }
      } catch (err) {
        console.error('Error fetching config:', err);
        // Use defaults if we can't fetch
        setConfig({
          temporalHostPort: 'localhost:7233',
          temporalNamespace: 'default'
        });
      }
    };

    fetchConfig();
    // Initialize with URL parameters
    if (initialQueryParams.token) {
      // If we have a token in URL, use it directly
      fetchWorkflows(initialQueryParams.query, initialQueryParams.token, initialQueryParams.size);
    } else {
      // For any page without a token, start from page 1
      // This will handle cases where page parameter is set but no token exists
      fetchWorkflows(initialQueryParams.query, '', initialQueryParams.size);
      
      // If URL had page > 1 but no token, update URL to show page 1
      if (typeof window !== 'undefined' && 
          parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10) > 1) {
        updateUrlWithParams(initialQueryParams.query, 1, initialQueryParams.size, '');
      }
    }
  }, []);
  
  // Get visible columns for display
  const visibleColumns = columns.filter(col => col.visible);
  
  return (
    <div className="container mx-auto p-4">
      {/* App header component with title and controls */}
      <AppHeader 
        config={config}
        timezone={timezone}
        setShowConfigPopup={setShowConfigPopup}
        setShowTimezoneSelector={setShowTimezoneSelector}
      />
      
      {/* Search box component */}
      <SearchBox 
        query={query}
        setQuery={setQuery}
        loading={loading}
        handleSearch={handleSearch}
        recentSearches={recentSearches}
        allSearches={allSearches}
        fetchWorkflows={fetchWorkflows}
        showAllSearches={() => setShowAllSearchesPopup(true)}
        appliedFilters={appliedFilters}
        setAppliedFilters={setAppliedFilters}
      />
      
      {/* Error message display */}
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
      
      {/* Loading indicator */}
      {loading ? (
        <div className="flex justify-center py-10" style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem 0' }}>
          <div className="spinner animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        /* Results list component */
        <WorkflowList 
          results={results}
          columns={columns}
          visibleColumns={visibleColumns}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragEnd={handleDragEnd}
          openFilterForColumn={openFilterForColumn}
          appliedFilters={appliedFilters}
          showSearchAttributes={showSearchAttributes}
          setShowColumnSelector={setShowColumnSelector}
          currentPage={currentPage}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
          changePageSize={changePageSize}
          hasMoreResults={hasMoreResults}
          goToFirstPage={goToFirstPage}
          goToPrevPage={goToPrevPage}
          goToNextPage={goToNextPage}
          clearAllFilters={clearAllFilters}
        />
      )}
      
      {/* Popup for displaying workflow details */}
      {popup.show && (
        <Popup
          title={popup.title}
          content={popup.content}
          onClose={() => setPopup({ ...popup, show: false })}
        />
      )}

      {/* Popup for column selection */}
      {showColumnSelector && (
        <ColumnSelector 
          columns={columns}
          setColumns={setColumns}
          onClose={() => setShowColumnSelector(false)}
          results={results}
          toggleColumnVisibility={toggleColumnVisibility}
          resetColumnVisibility={resetColumnVisibility}
        />
      )}
      
      {/* Popup for timezone selection */}
      {showTimezoneSelector && (
        <TimezoneSelector 
          timezoneOptions={timezoneOptions}
          timezone={timezone}
          setTimezone={setTimezone}
          onClose={() => setShowTimezoneSelector(false)}
        />
      )}
      
      {/* Popup for configuration */}
      {showConfigPopup && (
        <ConfigPopup 
          config={config}
          onClose={() => setShowConfigPopup(false)}
        />
      )}
      
      {/* Popup for all searches */}
      {showAllSearchesPopup && (
        <AllSearchesPopup 
          allSearches={allSearches}
          onClose={() => setShowAllSearchesPopup(false)}
          updateQueryName={updateQueryName}
          fetchWorkflows={fetchWorkflows}
          setAllSearches={setAllSearches}
          setRecentSearches={setRecentSearches}
        />
      )}
      
      {/* Filter popup */}
      {showFilterPopup && activeFilterColumn && (
        <FilterPopup 
          activeFilterColumn={activeFilterColumn}
          columnLabel={columns.find(col => col.id === activeFilterColumn)?.label || 'Column'}
          filterValue={filterValue}
          setFilterValue={setFilterValue}
          filterOperator={filterOperator}
          setFilterOperator={setFilterOperator}
          appliedFilters={appliedFilters}
          onClose={() => setShowFilterPopup(false)}
          applyFilter={applyFilter}
          workflowStatuses={workflowStatuses}
          getOperatorsForColumn={getOperatorsForColumn}
          formatDateForFilter={formatDateForFilter}
          customAttributes={results.flatMap(w => w.customSearchAttributes || [])}
        />
      )}
    </div>
  );
}