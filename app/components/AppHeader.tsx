'use client';

import { AppConfig } from './types';

/**
 * AppHeader Component - Application header with title and controls
 * 
 * 🔰 BEGINNER'S GUIDE TO REACT CONCEPTS:
 * 
 * 1. Stateless Functional Component:
 *    This component doesn't track any internal state - it simply renders based on
 *    props it receives. React calls these "presentational components" because they
 *    just present UI without managing data themselves.
 *    Example: const AppHeader = (props) => { ... }
 * 
 * 2. Props (Properties):
 *    Props are how React components receive data from their parents. They're read-only!
 *    Here we use props destructuring to pull out specific properties we need:
 *    Example: const AppHeader = ({ config, timezone }) => { ... }
 *    This is cleaner than writing props.config, props.timezone everywhere.
 * 
 * 3. Event Handling:
 *    React uses camelCase naming for events (onClick instead of onclick).
 *    Example: onClick={() => setShowConfigPopup(true)}
 *    We use an arrow function to call our state setter with the value we want.
 * 
 * 4. JSX:
 *    JSX is React's syntax extension to write HTML-like elements in JavaScript.
 *    - HTML attributes become camelCase in JSX (className instead of class)
 *    - Component tags must start with capital letters (distinguishes from HTML)
 *    - All JSX elements must be closed (even <img /> needs the closing slash)
 *    - You use curly braces {} to embed JavaScript expressions in JSX
 * 
 * 5. Fragments:
 *    React components must return a single element, but you can use fragments
 *    to group elements without adding extra DOM nodes. Here we use a div as
 *    our container but could have used <></> (fragment shorthand).
 * 
 * 6. Props as Function Callbacks:
 *    React components often receive functions as props to communicate with parents.
 *    Example: setShowConfigPopup is a function from the parent that we call
 *    when the button is clicked. This "lifts state up" to manage it in the parent.
 * 
 * COMPONENT BEHAVIOR:
 * This component displays the application header bar at the top of the page with:
 * - Application title with attractive gradient background
 * - GitHub repository link for the project
 * - Configuration button to display app settings
 * - Timezone selector button showing current timezone
 * 
 * UI DESIGN PATTERNS:
 * - Action buttons in the header for global app settings
 * - Visual hierarchy with title prominence
 * - Consistent button styling with hover effects
 * - Semi-transparent background for buttons to layer on the gradient
 * - Icon + text pattern for better usability
 * 
 * @param props.config - Application configuration settings
 * @param props.timezone - Current timezone selection
 * @param props.setShowConfigPopup - Function to show configuration popup
 * @param props.setShowTimezoneSelector - Function to show timezone selector
 */
interface AppHeaderProps {
  config: AppConfig;
  timezone: { label: string; value: string; };
  setShowConfigPopup: (show: boolean) => void;
  setShowTimezoneSelector: (show: boolean) => void;
}

const AppHeader = ({
  config,
  timezone,
  setShowConfigPopup,
  setShowTimezoneSelector
}: AppHeaderProps) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-lg shadow-md mb-6">
      <div className="flex justify-between items-center">
        {/* Title and GitHub link */}
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <img src="/iwf-logo.svg" alt="iWF Logo" className="h-7 w-7 mr-2" />
            iWF Workflows
          </h1>
          <div className="mt-1 text-blue-100 text-sm">
            <a 
              href="https://github.com/indeedeng/iwf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center hover:text-white transition-colors"
            >
              {/* GitHub icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Indeed Workflow Framework
            </a>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex space-x-2">
          {/* Config button */}
          <button
            onClick={() => setShowConfigPopup(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-40 transition-all duration-150 ease-in-out"
            aria-label="Open configuration"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Config</span>
          </button>
          
          {/* Timezone button */}
          <button
            onClick={() => setShowTimezoneSelector(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-40 transition-all duration-150 ease-in-out"
            aria-label="Select timezone"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">{timezone.label}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;