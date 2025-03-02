'use client';

import { useState, useEffect } from 'react';

/**
 * ClearButton component - A button that appears in the search input to clear the text
 * 
 * This component:
 * 1. Only shows when there is text in the input field
 * 2. Uses client-side hydration to prevent server/client mismatch (mounted check)
 * 3. Provides a clear "X" button positioned inside the input
 * 
 * @param props.query - The current search query text
 * @param props.onClear - Callback function executed when the button is clicked
 */
const ClearButton = ({ query, onClear }: { query: string, onClear: () => void }) => {
  // Track whether component has mounted to avoid hydration errors
  // (showing the button during SSR would cause hydration mismatch)
  const [isMounted, setIsMounted] = useState(false);
  
  // After component mounts, set isMounted to true
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Don't render anything if:
  // - Component hasn't mounted yet (we're still in SSR or initial render)
  // - There's no query text to clear
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

export default ClearButton;