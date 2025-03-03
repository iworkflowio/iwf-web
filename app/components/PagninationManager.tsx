'use client';

import {
    updateUrlWithParams
} from './utils';
import {useState} from "react";

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

export function usePaginationManager(query, fetchWorkflows){

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
    
    return{
        pageSize,
        nextPageToken, setNextPageToken,
        currentPage, setCurrentPage,
        pageHistory, setPageHistory,
        goToNextPage, goToPrevPage,goToFirstPage,
        changePageSize
    };
}