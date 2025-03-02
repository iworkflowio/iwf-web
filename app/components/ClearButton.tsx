'use client';

import { useState, useEffect } from 'react';

/**
 * ClearButton component - A button that appears in the search input to clear the text
 * 
 * 🔰 BEGINNER'S GUIDE TO REACT CONCEPTS:
 * 
 * 1. useState Hook:
 *    useState creates a piece of state for your component and a function to update it.
 *    Example: const [isMounted, setIsMounted] = useState(false);
 *    - isMounted: the current state value (starts as false from the initial value)
 *    - setIsMounted: function to update isMounted
 *    - useState(false): initializes the state with a starting value of false
 *    Every time setIsMounted is called, React will re-render the component with the new value.
 * 
 * 2. useEffect Hook:
 *    useEffect lets you perform side effects in your component.
 *    Example: useEffect(() => { setIsMounted(true); }, []);
 *    - First argument: Function that contains your effect code
 *    - Second argument: Dependency array - when empty [], the effect runs once after mounting
 *    - When dependencies change, the effect runs again
 *    - Common uses: API calls, DOM manipulation, subscriptions, timers
 * 
 * 3. Conditional Rendering:
 *    React lets you render different UI based on conditions.
 *    Example: if (!isMounted || !query) return null;
 *    - This is an early return pattern - if condition is true, nothing renders
 *    - You can also use ternary operators: {condition ? <ElementA /> : <ElementB />}
 *    - Or logical AND: {condition && <Element />} (renders Element only if condition is true)
 * 
 * 4. Component Lifecycle:
 *    This component demonstrates handling the mounting phase:
 *    - Initial render: isMounted is false, nothing renders (avoids hydration issues)
 *    - After mount: useEffect runs, sets isMounted to true, component re-renders
 *    - Now shows the clear button (if query has text)
 * 
 * 5. Hydration:
 *    With server-side rendering, React "hydrates" the static HTML by attaching
 *    event listeners during client-side initialization. The isMounted check prevents
 *    a mismatch between server render (which has no JS state) and client render.
 * 
 * 6. Component Props with TypeScript:
 *    The component receives typed props through destructuring:
 *    Example: ({ query, onClear }: { query: string, onClear: () => void })
 *    - query: string - The current search text
 *    - onClear: function that returns nothing (void)
 * 
 * COMPONENT BEHAVIOR:
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