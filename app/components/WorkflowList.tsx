'use client';

import { WorkflowSearchResponseEntry } from '../ts-api/src/api-gen/api';
import { ColumnDef, FilterSpec } from './types';
import { useAppConfig } from './ConfigContext';

/**
 * WorkflowList Component - Displays the workflows in a table format
 * 
 * 🔰 BEGINNER'S GUIDE TO REACT CONCEPTS:
 * 
 * 1. Complex State Management:
 *    useState with object structure for complex component state:
 *    Example: const [popup, setPopup] = useState<{ show: boolean; title: string; content: React.ReactNode; }>({...})
 *    - Creates a state object with multiple properties
 *    - React.ReactNode type allows storing any valid JSX content
 *    - When updating object state, must spread existing properties: setPopup({ ...popup, show: false })
 * 
 * 2. Advanced Prop Patterns:
 *    This component demonstrates handling a large set of props:
 *    - TypeScript interface defines exactly what props the component expects
 *    - Destructuring in function signature unpacks all needed values
 *    - Props represent a mixture of data, callbacks, and UI state
 *    - Illustrates "prop drilling" pattern (many props passed through component tree)
 * 
 * 3. HTML5 Drag and Drop API:
 *    React wrapper around the native HTML5 drag/drop functionality:
 *    - draggable attribute enables element dragging
 *    - onDragStart, onDragOver, onDragEnd handlers manage the drag lifecycle
 *    - Events call props.handleDragX functions defined in parent component
 *    - State data transferred via drag events enables column reordering
 * 
 * 4. Nested Conditional Rendering:
 *    Multiple layers of conditional logic in JSX:
 *    Example 1: {results.length > 0 ? (...) : (...)} - Ternary for rows vs. empty state
 *    Example 2: {popup.show && (...)} - Logical AND for conditional popup
 *    Example 3: {visibleColumns.map(...)} - Array mapping only happens if array exists
 *    In React, mastering conditional rendering is essential for dynamic UIs.
 * 
 * 5. Compound Components Pattern:
 *    This component combines multiple UI sections that work together:
 *    - Table header with controls and filter indicators
 *    - Data table with dynamic columns and rows
 *    - Pagination controls that respond to data state
 *    - Popup component for additional information display
 *    Each section could be its own component, but they're combined for cohesion.
 * 
 * 6. Pagination Implementation:
 *    Client-side pagination controls:
 *    - Page size selection (controlled via state)
 *    - Navigation buttons (First, Previous, Current, Next)
 *    - Dynamic disabling of buttons based on current state
 *    - Result count display showing the current range
 * 
 * 7. Dynamic Styling with Tailwind and Inline Styles:
 *    Multiple approaches to styling based on state:
 *    - Template literals with conditional classes: `${currentPage === 1 ? 'bg-gray-100' : 'bg-blue-50'}`
 *    - Direct inline styles: style={{ backgroundColor: '#dbeafe' }}
 *    - Fixed Tailwind classes: className="mt-4 flex items-center justify-between"
 * 
 * 8. Accessor Pattern for Data Display:
 *    Using functions to extract and format data from objects:
 *    Example: {column.accessor(workflow)} in the table cell
 *    - Accessor functions handle formatting logic separately from UI code
 *    - Makes data display consistent across the application
 *    - Allows custom rendering for different data types (dates, status, etc.)
 * 
 * COMPONENT BEHAVIOR:
 * This component is responsible for displaying workflow data in a table,
 * handling column visibility, sorting, filtering, and showing workflow details.
 * It's the main data visualization component of the application.
 * 
 * Features:
 * - Sortable and reorderable columns (drag & drop)
 * - Toggleable column visibility
 * - Filter interface for each column
 * - Pagination controls with page size options
 * - Empty state handling
 * - Applied filters indication
 * 
 * ADVANCED PATTERNS:
 * - Drag and drop: Uses HTML5 drag and drop API for column reordering
 * - Dynamic tables: Columns can be added, removed, and reordered
 * - Accessor pattern: Uses functions to access and format data for display
 * - Compound component: Combines many small UI elements into a cohesive unit
 * 
 * @param props.results - Array of workflow objects to display
 * @param props.columns - Column definitions for the table (includes visibility flag)
 * @param props.handleDragStart - Function for starting column drag
 * @param props.handleDragOver - Function for handling drag over another column
 * @param props.handleDragEnd - Function for finishing drag operation
 * @param props.openFilterForColumn - Function to open filter dialog for a column
 * @param props.appliedFilters - Currently applied column filters
 * @param props.showSearchAttributes - Function to display search attributes
 * @param props.setShowColumnSelector - Function to open column selector
 * @param props.setCurrentPage - Function to update current page
 * @param props.pageSize - Number of items per page
 * @param props.changePageSize - Function to change page size
 * @param props.currentPage - Current page number
 * @param props.hasMoreResults - Whether there are more results available
 * @param props.goToFirstPage - Function to navigate to first page
 * @param props.goToPrevPage - Function to navigate to previous page
 * @param props.goToNextPage - Function to navigate to next page
 * @param props.clearAllFilters - Function to clear all applied filters
 */
interface WorkflowListProps {
  results: WorkflowSearchResponseEntry[];
  columns: ColumnDef[];
  handleDragStart: (columnId: string) => void;
  handleDragOver: (e: React.DragEvent, columnId: string) => void;
  handleDragEnd: () => void;
  openFilterForColumn: (columnId: string) => void;
  appliedFilters: Record<string, FilterSpec>;
  showSearchAttributes: (attributes: any) => void;
  setShowColumnSelector: (show: boolean) => void;
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  changePageSize: (size: number) => void;
  hasMoreResults: boolean;
  goToFirstPage: () => void;
  goToPrevPage: () => void;
  goToNextPage: () => void;
  clearAllFilters: () => void;
}

const WorkflowList = ({
  results,
  columns,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  openFilterForColumn,
  appliedFilters,
  showSearchAttributes,
  setShowColumnSelector,
  currentPage,
  pageSize,
  changePageSize,
  hasMoreResults,
  goToFirstPage,
  goToPrevPage,
  goToNextPage,
  clearAllFilters
}: WorkflowListProps) => {
  // Get configuration from context
  const { temporalWebUI, temporalNamespace } = useAppConfig();
  
  // Calculate visible columns (those marked as visible)
  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="relative">
      {/* Table header with column controls */}
      <div className="mb-2 flex justify-between items-center">
        <div className="flex items-center">
          <p className="text-sm text-gray-500 mr-4">
            {visibleColumns.length} columns displayed 
            {columns.some(c => c.id.startsWith('attr_')) && 
              ` (${columns.filter(c => c.id.startsWith('attr_')).length} search attributes)`}
          </p>
          
          {/* Filter indicators */}
          {Object.keys(appliedFilters).length > 0 && (
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">
                Filters applied: {Object.keys(appliedFilters).length}
              </span>
              <button 
                onClick={clearAllFilters}
                className="text-red-600 text-xs hover:text-red-800 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
        
        {/* Column customization buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => setShowColumnSelector(true)}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-3 rounded text-sm flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Customize Table
          </button>
        </div>
      </div>
      
      {/* Workflow data table with nowrap */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border whitespace-nowrap">
          {/* Table header with column titles */}
          <thead>
            <tr className="bg-gray-100">
              {visibleColumns.map(column => (
                <th 
                  key={column.id}
                  className="py-2 px-4 border text-left cursor-move"
                  // Enable drag-and-drop column reordering
                  draggable
                  onDragStart={() => handleDragStart(column.id)}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragEnd={handleDragEnd}
                  style={{ userSelect: 'none', position: 'relative' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {/* Drag handle indicator */}
                      <span className="mr-1">≡</span> {column.label}
                    </div>
                    
                    {/* Filter button (not shown for search attributes column) */}
                    {column.id !== 'customSearchAttributes' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openFilterForColumn(column.id);
                        }}
                        // Highlight active filters
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

          {/* Table body with workflow data rows */}
          <tbody>
            {results.length > 0 ? (
              results.map((workflow) => {
                // Create the URL for workflow navigation
                const getWorkflowUrl = () => {
                  if (workflow.isIwf) {
                    // URL for iWF workflows
                    return `/workflow/show?workflowId=${encodeURIComponent(workflow.workflowId)}${workflow.workflowRunId ? `&runId=${encodeURIComponent(workflow.workflowRunId)}` : ''}`;
                  } else {
                    // URL for raw Temporal workflows
                    return `${temporalWebUI}/namespaces/${temporalNamespace}/workflows/${encodeURIComponent(workflow.workflowId)}/${encodeURIComponent(workflow.workflowRunId)}/history`;
                  }
                };
                
                // Determine if a column should be clickable
                const isClickableColumn = (columnId: string) => {
                  return columnId === 'workflowId' || columnId === 'workflowRunId' || columnId === 'workflowType';
                };
                
                return (
                  <tr 
                    key={`${workflow.workflowId}-${workflow.workflowRunId}`} 
                    className="hover:bg-gray-50"
                  >
                    {visibleColumns.map(column => (
                      <td key={column.id} className={`py-2 px-4 border ${isClickableColumn(column.id) ? 'cursor-pointer' : ''}`}>
                        {column.id === 'customSearchAttributes' ? (
                          <button
                            onClick={() => showSearchAttributes(workflow.customSearchAttributes)}
                            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs"
                          >
                            {workflow.customSearchAttributes?.length || 0} attributes
                          </button>
                        ) : isClickableColumn(column.id) ? (
                          // Clickable link for workflowId, runId, and workflowType using anchor tag
                          <a 
                            href={getWorkflowUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline inline-block"
                          >
                            {column.accessor(workflow)}
                          </a>
                        ) : (
                          column.accessor(workflow)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={visibleColumns.length} className="text-center py-12 text-gray-500">
                  No workflows found. Try a different search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination controls - only shown when there are results */}
      {results.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          {/* Page size selector */}
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
          
          {/* Pagination buttons and info */}
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
      )}
      
      {/* Popup handled by parent component (WorkflowSearchPage) */}
    </div>
  );
};

export default WorkflowList;