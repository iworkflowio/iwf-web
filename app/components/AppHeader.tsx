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
            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-1 px-3 rounded text-sm flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Config
          </button>
          
          {/* Timezone button */}
          <button
            onClick={() => setShowTimezoneSelector(true)}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-1 px-3 rounded text-sm flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timezone.label}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;