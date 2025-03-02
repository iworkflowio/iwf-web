'use client';

import { useState } from 'react';
import { SavedQuery } from './types';

/**
 * AllSearchesPopup Component - Modal for viewing and managing all saved searches
 * 
 * REACT CONCEPTS DEMONSTRATED:
 * - useState: Manages local component state for editing and filtering
 * - Controlled components: Input fields controlled by React state
 * - Event handling: onBlur, onChange, onClick, onKeyDown events
 * - Conditional rendering: Different UI based on editingQueryIndex state
 * - Lists & keys: Maps over arrays with unique keys
 * - Forms & inputs: Text inputs with focus handling and keyboard events
 * - State lifting: Uses setState functions passed from parent component
 * - Side effects: Updates localStorage when modifying searches
 * 
 * COMPONENT BEHAVIOR:
 * This component displays a modal with all saved search queries, allowing users to:
 * - Filter/search through saved queries with real-time filtering
 * - Run saved queries directly from history
 * - Name/rename saved queries with inline editing
 * - Delete individual search queries
 * - Clear all search history at once
 * - Keyboard navigation (Enter to save, Escape to cancel)
 * 
 * @param props.allSearches - Array of all saved search objects
 * @param props.onClose - Function to close the popup
 * @param props.updateQueryName - Function to update the name of a saved query
 * @param props.fetchWorkflows - Function to execute a saved query
 * @param props.setAllSearches - Function to update the full search list (setState from parent)
 * @param props.setRecentSearches - Function to update the recent searches list (setState from parent)
 */
interface AllSearchesPopupProps {
  allSearches: SavedQuery[];
  onClose: () => void;
  updateQueryName: (index: number, name: string) => void;
  fetchWorkflows: (query: SavedQuery) => void;
  setAllSearches: (searches: SavedQuery[]) => void;
  setRecentSearches: (searches: SavedQuery[]) => void;
}

const AllSearchesPopup = ({
  allSearches,
  onClose,
  updateQueryName,
  fetchWorkflows,
  setAllSearches,
  setRecentSearches
}: AllSearchesPopupProps) => {
  // Track which query is being edited (if any)
  const [editingQueryIndex, setEditingQueryIndex] = useState<number | null>(null);
  
  // Local filtered searches for search functionality
  const [filteredSearches, setFilteredSearches] = useState<SavedQuery[]>(allSearches);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div 
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl"
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Search History</h3>
          <button 
            onClick={() => {
              onClose();
              setEditingQueryIndex(null);
            }}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ✕
          </button>
        </div>
        
        {/* Search input to filter saved searches */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Filter history..."
            className="w-full border rounded px-3 py-2 text-sm"
            onChange={(e) => {
              const filter = e.target.value.toLowerCase();
              if (filter) {
                // Filter searches by query text or name
                const filtered = allSearches.filter(s => 
                  s.query.toLowerCase().includes(filter) || 
                  (s.name && s.name.toLowerCase().includes(filter))
                );
                setFilteredSearches(filtered);
              } else {
                // Show all if filter is cleared
                setFilteredSearches(allSearches);
              }
            }}
          />
        </div>
        
        {/* List of saved searches with scroll */}
        <div 
          className="max-h-96 overflow-y-auto" 
          style={{ maxHeight: '24rem', overflowY: 'auto' }}
        >
          {filteredSearches.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {filteredSearches.map((savedQuery, index) => {
                // Find the original index in allSearches for this item
                const originalIndex = allSearches.findIndex(
                  s => s.query === savedQuery.query && s.timestamp === savedQuery.timestamp
                );
                
                return (
                  <div 
                    key={`${savedQuery.query}-${savedQuery.timestamp}`}
                    // Highlight named queries with blue background
                    className={`flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b ${savedQuery.name ? 'bg-blue-50' : ''}`}
                  >
                    {editingQueryIndex === originalIndex ? (
                      // Edit mode - show input field
                      <input
                        type="text"
                        defaultValue={savedQuery.name || ''}
                        placeholder="Enter a name for this query"
                        className="flex-grow mr-2 border rounded px-2 py-1 text-sm"
                        autoFocus
                        onBlur={(e) => {
                          updateQueryName(originalIndex, e.target.value);
                          setEditingQueryIndex(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateQueryName(originalIndex, e.currentTarget.value);
                            setEditingQueryIndex(null);
                          } else if (e.key === 'Escape') {
                            setEditingQueryIndex(null);
                          }
                        }}
                      />
                    ) : (
                      // Display mode - show query details
                      <div className="flex-grow mr-2">
                        {/* Show name with pin icon if this is a named query */}
                        {savedQuery.name && (
                          <div className="flex items-center text-blue-700 font-medium text-sm mb-1">
                            <span className="text-xs mr-1">📌</span> {savedQuery.name}
                          </div>
                        )}
                        {/* Show the actual query text */}
                        <div 
                          className="text-sm text-gray-600 truncate" 
                          style={{ maxWidth: 'calc(100% - 2rem)' }}
                        >
                          {savedQuery.query}
                        </div>
                      </div>
                    )}
                    
                    {/* Row action buttons */}
                    <div className="flex items-center">
                      {editingQueryIndex !== originalIndex && (
                        <>
                          {/* Name/Rename button */}
                          <button
                            onClick={() => setEditingQueryIndex(originalIndex)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1 px-2 rounded mr-1"
                            title="Name this query"
                          >
                            {savedQuery.name ? 'Rename' : 'Name'}
                          </button>
                          
                          {/* Search button */}
                          <button
                            onClick={() => {
                              fetchWorkflows(savedQuery);
                              onClose();
                            }}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs py-1 px-2 rounded mr-1"
                          >
                            Search
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={() => {
                              // Remove this query from the list
                              const newSearches = allSearches.filter((_, i) => i !== originalIndex);
                              setAllSearches(newSearches);
                              setRecentSearches(newSearches.slice(0, 5));
                              setFilteredSearches(filteredSearches.filter((_, i) => i !== index));
                              
                              // Update localStorage
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
                );
              })}
            </div>
          ) : (
            // Empty state when no searches match filter
            <div className="text-center py-8 text-gray-500">
              No search history found.
            </div>
          )}
        </div>
        
        {/* Footer with clear history and close buttons */}
        <div className="flex justify-between mt-4">
          <button
            onClick={() => {
              // Clear all search history
              setAllSearches([]);
              setRecentSearches([]);
              setFilteredSearches([]);
              
              // Clear localStorage
              if (typeof window !== 'undefined') {
                localStorage.removeItem('allSearches');
              }
            }}
            className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-medium text-sm py-1 px-3 rounded-md"
          >
            Clear History
          </button>
          
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllSearchesPopup;