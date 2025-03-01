'use client';

import { useState, useEffect, useRef } from 'react';
import { WorkflowSearchResponse, WorkflowSearchResponseEntry, WorkflowStatus, SearchAttribute } from './ts-api/src/api-gen/api';

// Client-side only component for the clear button
const ClearButton = ({ query, onClear }: { query: string, onClear: () => void }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted || !query) return null;
  
  return (
    <button
      onClick={onClear}
      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-0"
      title="Clear search"
    >
      ✕
    </button>
  );
};

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
  // Read initial query and pagination params from URL if present
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
  
  const [query, setQuery] = useState(initialQueryParams.query);
  const [results, setResults] = useState<WorkflowSearchResponseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
  const [config, setConfig] = useState<{
    temporalHostPort: string;
    temporalNamespace: string;
  }>({
    temporalHostPort: '',
    temporalNamespace: ''
  });
  
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
  
  // Interface for search query with optional name
  interface SavedQuery {
    query: string;
    name?: string;
    timestamp: number; // For sorting by recency
  }

  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);
  const [showConfigPopup, setShowConfigPopup] = useState(false);
  const [showAllSearchesPopup, setShowAllSearchesPopup] = useState(false);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<string>('=');
  const [appliedFilters, setAppliedFilters] = useState<Record<string, {value: string, operator: string}>>({});
  const [editingQueryIndex, setEditingQueryIndex] = useState<number | null>(null);
  const [recentSearches, setRecentSearches] = useState<SavedQuery[]>([]);
  const [allSearches, setAllSearches] = useState<SavedQuery[]>([]);
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

  // Function to format query for display
  const formatQueryForDisplay = (savedQuery: SavedQuery) => {
    // If query has a name, show that instead
    if (savedQuery.name) return savedQuery.name;
    
    // Otherwise format the query string
    const query = savedQuery.query;
    if (query.length <= 25) return query;
    return `${query.substring(0, 10)}...${query.substring(query.length - 10)}`;
  };

  // Sort saved queries by priority (named first, then by recency)
  const sortQueriesByPriority = (queries: SavedQuery[]): SavedQuery[] => {
    return [...queries].sort((a, b) => {
      // Named queries have higher priority
      if (a.name && !b.name) return -1;
      if (!a.name && b.name) return 1;
      
      // Among named queries, sort alphabetically
      if (a.name && b.name) return a.name.localeCompare(b.name);
      
      // Among unnamed queries, sort by timestamp (most recent first)
      return b.timestamp - a.timestamp;
    });
  };

  // Load recent searches from localStorage
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

  // Save recent searches to localStorage
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
  
  // Open popup to show all searches
  const showAllSearches = () => {
    setShowAllSearchesPopup(true);
  };

  // Helper to format filter value for query
  const formatFilterForQuery = (columnId: string, value: string): string => {
    // Format based on column type
    if (columnId === 'startTime' || columnId === 'closeTime') {
      return value; // Value is already in the correct format from the datepicker
    }
    
    // For string fields, add quotes if not already present
    if (!value.startsWith('"') && !value.endsWith('"')) {
      return `"${value}"`;
    }
    
    return value;
  };
  
  // We don't need the buildSearchQuery function anymore since we're directly updating the query field

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
    const updatedFilters: Record<string, {value: string, operator: string}> = {};
    
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
    if (columnId === 'startTime' || columnId === 'closeTime') {
      return ['=', '!=', '>', '<', '>=', '<='];
    }
    return ['=', '!='];
  };
  
  // Open filter popup for a column
  const openFilterForColumn = (columnId: string) => {
    // Don't allow filtering on search attributes column
    if (columnId === 'customSearchAttributes') {
      return;
    }
    
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
    
    // Debugging - add console logs to track filter application
    console.log('Applying filter for column:', activeFilterColumn);
    
    // Ensure the filter value is trimmed
    const trimmedValue = filterValue.trim();
    console.log('Trimmed filter value:', trimmedValue);
    
    // Don't proceed if value is empty
    if (!trimmedValue) {
      setShowFilterPopup(false);
      return;
    }
    
    // Create the new filter term
    let newFilterTerm = '';
    
    // Map the column to appropriate search field
    let queryField: string;
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
    
    if (!queryField) {
      setShowFilterPopup(false);
      return;
    }
    
    // Format the value properly
    const formattedValue = formatFilterForQuery(activeFilterColumn, trimmedValue);
    console.log('Formatted value:', formattedValue);
    
    // Construct new filter term with the selected operator
    newFilterTerm = `${queryField} ${filterOperator} ${formattedValue}`;
    console.log('New filter term:', newFilterTerm);
    
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
    
    console.log('Updated query:', updatedQuery);
    
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
    
    // Use setTimeout to ensure the query state is updated before searching
    setTimeout(() => {
      console.log('Executing search with query:', query);
      fetchWorkflows(updatedQuery); // Use updatedQuery directly instead of relying on state update
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
          
          <div className="flex space-x-2">
            <button
              onClick={() => setShowConfigPopup(true)}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-1 px-3 rounded text-sm flex items-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Config
            </button>
            
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
      </div>
      
      <div className="mb-4">
        <div className="flex" style={{ display: 'flex' }}>
          <div className="relative flex-grow">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter search query"
              className="w-full h-full border rounded-l px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            />
            <ClearButton 
              query={query} 
              onClear={() => {
                setQuery('');
                setAppliedFilters({});
              }} 
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {recentSearches.length > 0 && (
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <div className="text-sm text-gray-500">Recent:</div>
              {allSearches.length > 5 && (
                <button 
                  onClick={showAllSearches}
                  className="text-xs text-blue-600 font-medium hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded px-2 py-1"
                >
                  Show all ({allSearches.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((savedQuery, index) => (
                <button
                  key={index}
                  onClick={() => {
                    fetchWorkflows(savedQuery);
                  }}
                  className={`${savedQuery.name ? 'bg-blue-50 hover:bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} text-xs py-1 px-2 rounded flex items-center`}
                  title={savedQuery.query}
                >
                  {savedQuery.name && (
                    <span className="mr-1 text-xs">📌</span>
                  )}
                  {formatQueryForDisplay(savedQuery)}
                </button>
              ))}
            </div>
          </div>
        )}
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
            <div className="flex items-center">
              <p className="text-sm text-gray-500 mr-4">
                {visibleColumns.length} columns displayed 
                {columns.some(c => c.id.startsWith('attr_')) && 
                  ` (${columns.filter(c => c.id.startsWith('attr_')).length} search attributes)`}
              </p>
              
              {Object.keys(appliedFilters).length > 0 && (
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Filters applied: {Object.keys(appliedFilters).length}</span>
                  <button 
                    onClick={clearAllFilters}
                    className="text-red-600 text-xs hover:text-red-800 underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
            
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
                      style={{ userSelect: 'none', position: 'relative' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-1">≡</span> {column.label}
                        </div>
                        
                        {column.id !== 'customSearchAttributes' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForColumn(column.id);
                            }}
                            className={`ml-2 p-1 rounded-full ${appliedFilters[column.id] ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}
                            title={`Filter by ${column.label}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                        )}
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
          
          {/* Pagination controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Page Size:</span>
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                Showing {results.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0}-
                {((currentPage - 1) * pageSize) + results.length} results
              </span>
              <div className="flex space-x-1">
                <button
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded text-sm ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  First
                </button>
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded text-sm ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  Previous
                </button>
                <span className="px-2 py-1 rounded bg-blue-500 text-white text-sm">
                  {currentPage}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={!hasMoreResults}
                  className={`px-2 py-1 rounded text-sm ${!hasMoreResults ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex justify-between items-center">
            <div className="flex items-center">
              <p className="text-sm text-gray-500 mr-4">
                {visibleColumns.length} columns displayed 
                {columns.some(c => c.id.startsWith('attr_')) && 
                  ` (${columns.filter(c => c.id.startsWith('attr_')).length} search attributes)`}
              </p>
              
              {Object.keys(appliedFilters).length > 0 && (
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Filters applied: {Object.keys(appliedFilters).length}</span>
                  <button 
                    onClick={clearAllFilters}
                    className="text-red-600 text-xs hover:text-red-800 underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
            
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
                      style={{ userSelect: 'none', position: 'relative' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-1">≡</span> {column.label}
                        </div>
                        
                        {column.id !== 'customSearchAttributes' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterForColumn(column.id);
                            }}
                            className={`ml-2 p-1 rounded-full ${appliedFilters[column.id] ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}
                            title={`Filter by ${column.label}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-12 text-gray-500">
                    No workflows found. Try a different search query.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
      
      {/* Popup for configuration */}
      {showConfigPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', width: '100%', maxWidth: '28rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Temporal Configuration</h3>
              <button 
                onClick={() => setShowConfigPopup(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Temporal Host/Port</h4>
                <div className="bg-gray-50 p-2 rounded border text-sm font-mono">
                  {config.temporalHostPort}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Temporal Namespace</h4>
                <div className="bg-gray-50 p-2 rounded border text-sm font-mono">
                  {config.temporalNamespace}
                </div>
              </div>
              
              <div className="pt-2 text-xs text-gray-500">
                <p>These settings can be changed by updating the .env.local file.</p>
                <p className="mt-1">See README.md for more information.</p>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowConfigPopup(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Filter popup */}
      {showFilterPopup && activeFilterColumn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', width: '100%', maxWidth: '28rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Filter by {baseColumns.find(col => col.id === activeFilterColumn)?.label}</h3>
              <button 
                onClick={() => setShowFilterPopup(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6">
              {/* Operator selection for all filter types */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Operator
                </label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={filterOperator}
                  onChange={(e) => setFilterOperator(e.target.value)}
                >
                  {activeFilterColumn && getOperatorsForColumn(activeFilterColumn).map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>

              {/* Different input fields based on column type */}
              {activeFilterColumn === 'workflowStatus' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Status
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2 bg-white"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                  >
                    <option value="">-- Select a status --</option>
                    {workflowStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              ) : (activeFilterColumn === 'startTime' || activeFilterColumn === 'closeTime') ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Date and Time
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-3 py-2"
                      value={filterValue ? new Date(filterValue).toISOString().substring(0, 16) : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const selectedDate = new Date(e.target.value);
                          setFilterValue(formatDateForFilter(selectedDate));
                        } else {
                          setFilterValue('');
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Use the operator dropdown to select the comparison type (=, !=, &gt;, &lt;, etc.).
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Value
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    onBlur={(e) => setFilterValue(e.target.value.trim())}
                    placeholder={`Enter ${baseColumns.find(col => col.id === activeFilterColumn)?.label} value`}
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => {
                  if (activeFilterColumn && appliedFilters[activeFilterColumn]) {
                    // Remove this filter from the query
                    let currentQuery = query.trim();
                    
                    // Get the filter details
                    const filterDetails = appliedFilters[activeFilterColumn];
                    if (filterDetails) {
                      // Construct the filter term to be removed
                      let queryField = '';
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
                      }
                      
                      if (queryField) {
                        const formattedValue = formatFilterForQuery(activeFilterColumn, filterDetails.value);
                        const filterTerm = `${queryField} ${filterDetails.operator} ${formattedValue}`;
                        
                        // Remove the filter term from the query
                        // Handle different cases - filter at beginning, middle, or end
                        if (currentQuery === filterTerm) {
                          // It's the only filter
                          currentQuery = '';
                        } else if (currentQuery.startsWith(filterTerm + ' AND ')) {
                          // It's at the beginning
                          currentQuery = currentQuery.replace(filterTerm + ' AND ', '');
                        } else if (currentQuery.endsWith(' AND ' + filterTerm)) {
                          // It's at the end
                          currentQuery = currentQuery.replace(' AND ' + filterTerm, '');
                        } else {
                          // It's in the middle
                          currentQuery = currentQuery.replace(filterTerm + ' AND ', '').replace(' AND ' + filterTerm, '');
                        }
                        
                        // Update the query
                        setQuery(currentQuery);
                        
                        // Remove from applied filters
                        const newFilters = { ...appliedFilters };
                        delete newFilters[activeFilterColumn];
                        setAppliedFilters(newFilters);
                        
                        // Execute the search with updated query
                        setTimeout(() => {
                          fetchWorkflows(currentQuery);
                        }, 50);
                      }
                    }
                  }
                  
                  // Clear the input and close the popup
                  setFilterValue('');
                  setShowFilterPopup(false);
                }}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Clear Filter
              </button>
              
              <div className="space-x-2">
                <button
                  onClick={() => setShowFilterPopup(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={applyFilter}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Popup for all searches */}
      {showAllSearchesPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl" style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '1.5rem', width: '100%', maxWidth: '42rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Search History</h3>
              <button 
                onClick={() => {
                  setShowAllSearchesPopup(false);
                  setEditingQueryIndex(null);
                }}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Filter history..."
                className="w-full border rounded px-3 py-2 text-sm"
                onChange={(e) => {
                  const filter = e.target.value.toLowerCase();
                  if (filter) {
                    const filtered = allSearches.filter(s => 
                      s.query.toLowerCase().includes(filter) || 
                      (s.name && s.name.toLowerCase().includes(filter))
                    );
                    setRecentSearches(filtered.slice(0, 5));
                  } else {
                    setRecentSearches(sortQueriesByPriority(allSearches).slice(0, 5));
                  }
                }}
              />
            </div>
            
            <div className="max-h-96 overflow-y-auto" style={{ maxHeight: '24rem', overflowY: 'auto' }}>
              {allSearches.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {allSearches.map((savedQuery, index) => (
                    <div 
                      key={index}
                      className={`flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b ${savedQuery.name ? 'bg-blue-50' : ''}`}
                    >
                      {editingQueryIndex === index ? (
                        <input
                          type="text"
                          defaultValue={savedQuery.name || ''}
                          placeholder="Enter a name for this query"
                          className="flex-grow mr-2 border rounded px-2 py-1 text-sm"
                          autoFocus
                          onBlur={(e) => {
                            updateQueryName(index, e.target.value);
                            setEditingQueryIndex(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateQueryName(index, e.currentTarget.value);
                              setEditingQueryIndex(null);
                            } else if (e.key === 'Escape') {
                              setEditingQueryIndex(null);
                            }
                          }}
                        />
                      ) : (
                        <div className="flex-grow mr-2">
                          {savedQuery.name && (
                            <div className="flex items-center text-blue-700 font-medium text-sm mb-1">
                              <span className="text-xs mr-1">📌</span> {savedQuery.name}
                            </div>
                          )}
                          <div className="text-sm text-gray-600 truncate" style={{ maxWidth: 'calc(100% - 2rem)' }}>
                            {savedQuery.query}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center">
                        {editingQueryIndex !== index && (
                          <>
                            <button
                              onClick={() => setEditingQueryIndex(index)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1 px-2 rounded mr-1"
                              title="Name this query"
                            >
                              {savedQuery.name ? 'Rename' : 'Name'}
                            </button>
                            <button
                              onClick={() => {
                                fetchWorkflows(savedQuery);
                                setShowAllSearchesPopup(false);
                              }}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs py-1 px-2 rounded mr-1"
                            >
                              Search
                            </button>
                            <button
                              onClick={() => {
                                const newSearches = allSearches.filter((_, i) => i !== index);
                                const sortedSearches = sortQueriesByPriority(newSearches);
                                setAllSearches(sortedSearches);
                                setRecentSearches(sortedSearches.slice(0, 5));
                                if (typeof window !== 'undefined') {
                                  localStorage.setItem('allSearches', JSON.stringify(newSearches));
                                }
                              }}
                              className="text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 text-xs py-1 px-2 rounded"
                              title="Delete from history"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No search history found.
                </div>
              )}
            </div>
            
            <div className="flex justify-between mt-4">
              <button
                onClick={() => {
                  setAllSearches([]);
                  setRecentSearches([]);
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('allSearches');
                  }
                }}
                className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-medium text-sm py-1 px-3 rounded-md"
              >
                Clear History
              </button>
              
              <button
                onClick={() => setShowAllSearchesPopup(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}