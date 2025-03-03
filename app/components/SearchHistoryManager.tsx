'use client';

import {ColumnDef, SavedQuery, TimezoneOption} from './types';
import {
    formatTimestamp,
    formatAttributeValue,
    loadFromLocalStorage,
    saveToLocalStorage,
    sortQueriesByPriority
} from './utils';
import {useEffect, useRef, useState} from "react";

// Saved searches state with a maximum limit of 500
const MAX_SAVED_SEARCHES = 500;
export function useSearchHistoryManager(){

    const [allSearches, setAllSearches] = useState<SavedQuery[]>([]);
    const [showAllSearchesPopup, setShowAllSearchesPopup] = useState(false);

    // Load saved searches from localStorage
    useEffect(() => {
        const savedSearches = loadFromLocalStorage<any[]>('allSearches', []);
        if (!savedSearches.length) return;
        setAllSearches(savedSearches);
    }, []);

    // Save search to localStorage
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

            // Sort by priority 
            const sorted = sortQueriesByPriority(newSearches);
            // Enforce the maximum number of saved searches
            if (newSearches.length > MAX_SAVED_SEARCHES) {
                newSearches = sorted.slice(0, MAX_SAVED_SEARCHES);
            }else{
                newSearches = sorted
            }

            // Save all searches to localStorage
            saveToLocalStorage('allSearches', newSearches);

            return newSearches;
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
                saveToLocalStorage('allSearches', newSearches);

                // Return the updated searches
                return sortQueriesByPriority(newSearches);
            }
            return prevSearches;
        });
    };
    
    return {
        allSearches, setAllSearches,
        showAllSearchesPopup, setShowAllSearchesPopup,
        saveRecentSearch,updateQueryName
        
    }
}