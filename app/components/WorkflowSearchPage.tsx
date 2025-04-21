'use client';

import { useState, useEffect, useRef } from 'react';
import { SearchAttribute } from '../ts-api/src/api-gen/api';
import { SavedQuery, AppConfig, CustomSearchAttributesPopupState, FilterSpec } from './types';
import { 
  formatTimestamp, 
  formatFilterForQuery,
  updateUrlWithParams
} from './utils';
import { useColumnManager} from './ColumnManager';
import { useTimezoneManager } from './TimezoneManager';
import { useAppConfig } from './ConfigContext';

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
import {useSearchHistoryManager} from "./SearchHistoryManager";
import {useSearchManager, initialQueryParams} from "./SearchManager";

/**
 * WorkflowSearchPage Component - Main application component
 * 
 * REACT CONCEPTS DEMONSTRATED:
 * - useState: Manages multiple pieces of application state
 * - useEffect: Handles side effects like data fetching, localStorage, and UI updates
 * - useRef: Stores mutable values that persist across renders
 * - Component composition: Assembles many smaller components into a complete app
 * - Props drilling: Passes state and handlers down to child components
 * - Conditional rendering: Shows different UI based on loading/error states
 * - Event handling: Complex event handlers for search, filtering, and pagination
 * - API integration: Fetches data from backend APIs
 * - Form handling: Search input, filters, and other user inputs
 * - localStorage: Persists user preferences across sessions
 * - URL state management: Syncs application state with URL parameters
 * 
 * ADVANCED REACT PATTERNS:
 * - State lifting: Manages state at the top level and passes it down
 * - React hooks: Uses multiple hooks for state, effects, and refs
 * - URL synchronization: Keeps app state in sync with browser URL
 * - Derived state: Calculates values from existing state (e.g., visibleColumns)
 * - Debounced operations: Uses setTimeout for delayed operations
 * - Hydration-safe code: Handles server/client rendering differences
 * - Compound components: Creates a cohesive UI from smaller parts
 * 
 * This component is the main container that ties together all the other components.
 * It manages the application state, API calls, and coordinates between components.
 * It serves as an excellent example of a complex React application structure.
 */
export default function WorkflowSearchPage() {
  // Use search history manager hook
  const {allSearches,
    setAllSearches,
    showAllSearchesPopup,
    setShowAllSearchesPopup,
    saveRecentSearch,
    updateQueryName} = useSearchHistoryManager();

  // Filter state
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<string>('=');
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterSpec>>({});

  // use search manager hook
  const {
    query, setQuery,
    results, setResults,
    loading, setLoading,
    error, setError,
    syncFiltersWithQuery,
    fetchWorkflows,

    //pagination
    pageSize, setPageSize,
    nextPageToken, setNextPageToken,
    currentPage, setCurrentPage,
    pageHistory, setPageHistory,
    goToNextPage, goToPrevPage,
    goToFirstPage, changePageSize
  } = useSearchManager(saveRecentSearch, setAppliedFilters)
  
  // Get app configuration from context
  const appConfig = useAppConfig();
  
  // Use the timezone manager hook
  const { 
    timezone, 
    setTimezone, 
    showTimezoneSelector, 
    setShowTimezoneSelector
  } = useTimezoneManager();
  
  // UI state for popups/dialogs
  const [showConfigPopup, setShowConfigPopup] = useState(false);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Popup state for displaying custom search attributes
  const [customSearchAttributesPopup, setCustomSearchAttributesPopup] = useState<CustomSearchAttributesPopupState>({
    show: false,
    title: '',
    content: null,
  });
  
  const {
    columns, 
    setColumns, 
    toggleColumnVisibility,
    resetColumnVisibility,
    handleDragStart,
    handleDragOver,
    handleDragEnd
  } = useColumnManager(timezone);

  
  // Show popup to display search attributes
  const showSearchAttributes = (attributes?: SearchAttribute[]) => {
    if (!attributes || attributes.length === 0) {
      setCustomSearchAttributesPopup({
        show: true,
        title: 'Custom Search Attributes',
        content: <p className="text-gray-500">No custom search attributes available</p>,
      });
      return;
    }

    // Force this component to update whenever timezone changes
    const currentTimezone = timezone.value;

    setCustomSearchAttributesPopup({
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
  
  // Sync applied filters with the current query before searching
  const handleSearch = () => {
    // Before searching, parse the current query to update applied filters
    syncFiltersWithQuery(query);
    
    // Then execute the search (which will also update URL parameters)
    fetchWorkflows(query);
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
    
    // Execute the search with the updated query (which also updates URL)
    setTimeout(() => {
      fetchWorkflows(updatedQuery);
    }, 50);
  };
  
  // Format date for ISO string for filter - exported to utils.ts if needed by multiple components
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
    
    // Automatically execute the search with empty query and update URL
    setTimeout(() => {
      fetchWorkflows('');
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
  
  
  // Initialize workflows
  useEffect(() => {
    // Sync applied filters with query from URL parameters
    if (initialQueryParams.query) {
      syncFiltersWithQuery(initialQueryParams.query);
    }
    
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
  
  // Visible columns are now calculated within the WorkflowList component
  
  return (
    <div className="max-w-[95%] 2xl:max-w-[90%] mx-auto p-4">
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
      
      {/* Search box component */}
      <SearchBox 
        query={query}
        setQuery={setQuery}
        loading={loading}
        handleSearch={handleSearch}
        allSearches={allSearches}
        fetchWorkflows={fetchWorkflows}
        showAllSearches={() => setShowAllSearchesPopup(true)}
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
          showSearchAttributes={showSearchAttributes}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragEnd={handleDragEnd}
          openFilterForColumn={openFilterForColumn}
          appliedFilters={appliedFilters}
          setShowColumnSelector={setShowColumnSelector}
          currentPage={currentPage}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
          changePageSize={changePageSize}
          hasMoreResults={!!nextPageToken}
          goToFirstPage={goToFirstPage}
          goToPrevPage={goToPrevPage}
          goToNextPage={goToNextPage}
          clearAllFilters={clearAllFilters}
        />
      )}
      
      {/* Popup for displaying search attributes */}
      {customSearchAttributesPopup.show && (
        <Popup
          title={customSearchAttributesPopup.title}
          content={customSearchAttributesPopup.content}
          onClose={() => setCustomSearchAttributesPopup({ title: customSearchAttributesPopup.title, content: customSearchAttributesPopup.content, show: false })}
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
          timezone={timezone}
          setTimezone={setTimezone}
          onClose={() => setShowTimezoneSelector(false)}
        />
      )}
      
      {/* Popup for configuration */}
      {showConfigPopup && (
        <ConfigPopup 
          config={{
            temporalHostPort: appConfig.temporalHostPort || '', 
            temporalNamespace: appConfig.temporalNamespace || '',
            temporalWebUI: appConfig.temporalWebUI || '',
          }}
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
        />
      )}
    </div>
  );
}