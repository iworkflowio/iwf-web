'use client';

import { useState } from 'react';
import ClearButton from './ClearButton';
import { SavedQuery } from './types';
import { formatQueryForDisplay } from './utils';

/**
 * SearchBox Component - Main search interface for workflow queries
 * 
 * This component handles the search input field, search execution,
 * and displays recent/saved search queries for quick access.
 * 
 * Features:
 * - Search input with clear button
 * - Search button with loading state
 * - Recent searches list with saved queries
 * - "Show all searches" to view full search history
 * 
 * @param props.query - Current search query text
 * @param props.setQuery - Function to update the query text
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