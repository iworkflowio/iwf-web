'use client';

import {useState} from "react";
import {WorkflowSearchResponseEntry} from "../ts-api/src/api-gen";
import {FilterSpec, SavedQuery} from "./types";
import {updateUrlWithParams} from "./utils";

// Initialize query state from URL if present (for sharing/bookmarking)
export const initialQueryParams = (() => {
    if (typeof window === 'undefined') {
        return { query: '', page: 1, size: 20, token: '' };
    }

    const params = new URLSearchParams(window.location.search);
    const query = params.get('q') || '';
    const size = parseInt(params.get('size') || '20', 10);
    const token = params.get('token') || '';
    const rawPage = parseInt(params.get('page') || '1', 10);

    // Reset to page 1 if page > 1 but no token is provided
    const page = (!token && rawPage > 1) ? 1 : rawPage;

    return { query, size, token, page };
})();

export function useSearchManager(saveRecentSearch, setAppliedFilters){
    // Search query and results state
    const [query, setQuery] = useState(initialQueryParams.query);
    const [results, setResults] = useState<WorkflowSearchResponseEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pagination state 
    const [pageSize, setPageSize] = useState<number>(initialQueryParams.size);
    const [nextPageToken, setNextPageToken] = useState<string>(initialQueryParams.token);
    const [currentPage, setCurrentPage] = useState<number>(initialQueryParams.page);
    const [pageHistory, setPageHistory] = useState<string[]>(() => {
        // Initialize page history array with the correct token in place
        const history = Array(initialQueryParams.page).fill('');
        if (initialQueryParams.page > 1 && initialQueryParams.token) {
            history[initialQueryParams.page - 1] = initialQueryParams.token;
        }
        return history;
    });

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

    // Function to fetch workflows
    // Execute a search with either query string or SavedQuery
    const fetchWorkflows = async (searchInput: string | SavedQuery = '', pageToken: string = '', pageSize?: number) => {
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
            const currentPageSize = pageSize || 20;

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

            // Save and sync filters with query if it's successful
            saveRecentSearch(searchQuery);
            syncFiltersWithQuery(searchQuery);
            
        } catch (err) {
            console.error('Search error:', err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            setResults([]); // Clear results on error

            // Reset pagination on error
            setNextPageToken('');
        } finally {
            setLoading(false);
        }
    };

    // Navigate to the next page of results
    const goToNextPage = () => {
        if ( !nextPageToken) return;

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
        fetchWorkflows(query, prevToken || '', pageSize);
    };

    // Go to the first page of results
    const goToFirstPage = () => {
        if (currentPage === 1) return;

        setCurrentPage(1);
        // Update URL with new page number and empty token
        updateUrlWithParams(query, 1, pageSize, '');
        fetchWorkflows(query, '', pageSize);
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
    
    return {
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
    }
}