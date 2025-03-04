'use client';

import {useState} from "react";
import {WorkflowSearchResponseEntry} from "../ts-api/src/api-gen";
import {FilterSpec, SavedQuery} from "./types";

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

export function useSearchManager(saveRecentSearch, setNextPageToken, setAppliedFilters){
    // Search query and results state
    const [results, setResults] = useState<WorkflowSearchResponseEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
    
    return {
        results, setResults,
        loading, setLoading,
        error, setError,
        syncFiltersWithQuery
    }
}