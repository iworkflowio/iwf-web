'use client';

import { useState } from 'react';
import ClearButton from './ClearButton';
import { SavedQuery } from './types';
import { formatQueryForDisplay } from './utils';

/**
 * SearchBox Component - Main search interface for workflow queries
 * 
 * 🔰 BEGINNER'S GUIDE TO REACT CONCEPTS:
 * 
 * 1. Component Composition:
 *    React's power comes from composing smaller components into larger UIs.
 *    Example: <ClearButton query={query} onClear={() => setQuery('')} />
 *    - SearchBox embeds ClearButton, passing it props
 *    - This creates a reusable, modular architecture
 *    - Each component focuses on one responsibility (Single Responsibility Principle)
 * 
 * 2. Controlled Components:
 *    React manages form inputs through state, making the React state the "single source of truth".
 *    Example: <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *    - input value is set from React state (query)
 *    - onChange handler updates that state when user types
 *    - This creates a complete loop where React controls the input entirely
 * 
 * 3. Event Handlers in JSX:
 *    React uses camelCase event handlers that receive event objects.
 *    - onChange: Fires when input value changes, gives event with target.value
 *    - onKeyDown: Captures keyboard events, includes e.key for key pressed
 *    - onClick: Handles click events on elements
 *    Example: onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
 * 
 * 4. Lists and Keys:
 *    When rendering arrays of elements, React needs a unique "key" prop to track items efficiently.
 *    Example: {recentSearches.map((savedQuery, index) => (<button key={index}>...</button>))}
 *    - The key helps React identify which items changed, were added, or removed
 *    - Using index as key works for static lists; unique IDs are better for dynamic lists
 *    - Without keys, React might re-render the entire list unnecessarily
 * 
 * 5. Conditional Rendering Patterns:
 *    Different ways to conditionally show UI elements:
 *    - Logical AND: {recentSearches.length > 0 && <div>...</div>}
 *      Only renders when condition is true
 *    - Ternary: {loading ? 'Searching...' : 'Search'}
 *      Chooses between two options based on condition
 *    - Enhanced JSX class names: className={`${savedQuery.name ? 'bg-blue-50' : 'bg-gray-100'}`}
 *      Conditionally applies different styles
 * 
 * 6. State Lifting and Prop Drilling:
 *    State is often managed in a parent component and passed down via props.
 *    - SearchBox receives query/setQuery from parent instead of managing it internally
 *    - This allows multiple components to share the same state
 *    - Props "flow down" the component tree (parent to child)
 *    - Events "flow up" through callback functions (child to parent)
 * 
 * 7. TypeScript Interface for Props:
 *    Clear type definitions for component props create self-documenting code.
 *    - Makes it obvious what data each prop expects
 *    - Provides editor autocomplete and type checking
 *    - Serves as documentation for other developers
 * 
 * COMPONENT BEHAVIOR:
 * This component handles the search input field, search execution,
 * and displays recent/saved search queries for quick access.
 * 
 * Features:
 * - Search input with clear button
 * - Keyboard support (Enter key to search)
 * - Search button with loading state
 * - Recent searches list with saved queries
 * - "Show all searches" to view full search history
 * 
 * @param props.query - Current search query text
 * @param props.setQuery - Function to update the query text (state setter from parent)
 * @param props.loading - Whether a search is currently in progress
 * @param props.handleSearch - Function to execute the search
 * @param props.recentSearches - Array of recent search objects
 * @param props.allSearches - Array of all saved search objects
 * @param props.fetchWorkflows - Function to load workflows for a saved query
 * @param props.showAllSearches - Function to open the full search history dialog
 * @param props.appliedFilters - Currently applied filters
 * @param props.setAppliedFilters - Function to update applied filters
 */
interface SearchBoxProps {
  query: string;
  setQuery: (query: string) => void;
  loading: boolean;
  handleSearch: () => void;
  recentSearches: SavedQuery[];
  allSearches: SavedQuery[];
  fetchWorkflows: (query: string | SavedQuery) => void;
  showAllSearches: () => void;
  appliedFilters: Record<string, {value: string, operator: string}>;
  setAppliedFilters: (filters: Record<string, {value: string, operator: string}>) => void;
}

const SearchBox = ({
  query,
  setQuery,
  loading,
  handleSearch,
  recentSearches,
  allSearches,
  fetchWorkflows,
  showAllSearches,
  appliedFilters,
  setAppliedFilters
}: SearchBoxProps) => {
  return (
    <div className="mb-4">
      {/* Search input and button */}
      <div className="flex" style={{ display: 'flex' }}>
        {/* Search input with clear button */}
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
          {/* Clear button - only shows when there's text */}
          <ClearButton 
            query={query} 
            onClear={() => {
              setQuery('');
              setAppliedFilters({});
            }} 
          />
        </div>
        
        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {/* Recent searches section */}
      {recentSearches.length > 0 && (
        <div className="mt-2">
          {/* Header with "Show all" link */}
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
          
          {/* Recent search pills */}
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((savedQuery, index) => (
              <button
                key={index}
                onClick={() => {
                  fetchWorkflows(savedQuery);
                }}
                // Highlight named queries with blue background
                className={`${savedQuery.name ? 'bg-blue-50 hover:bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} text-xs py-1 px-2 rounded flex items-center`}
                title={savedQuery.query}
              >
                {/* Show pin icon for named queries */}
                {savedQuery.name && (
                  <span className="mr-1 text-xs">📌</span>
                )}
                {/* Format query for display (truncate long queries) */}
                {formatQueryForDisplay(savedQuery)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBox;