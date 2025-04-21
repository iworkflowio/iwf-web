'use client';

import { TimezoneOption } from './types';
import {formatTimestamp, getTimezoneOptions} from './utils';

/**
 * TimezoneSelector Component - Modal for selecting timezone settings
 * 
 * REACT CONCEPTS DEMONSTRATED:
 * - Props: Receives data and callbacks from parent
 * - Event handling: onClick, onChange for user interactions
 * - Controlled components: Radio inputs controlled by state from parent
 * - Conditional rendering: Different content based on data availability
 * - Lists & keys: Maps over arrays with unique keys for each timezone
 * - Real-time UI updates: Preview changes timezone when selection changes
 * - State lifting: Uses setState passed from parent component
 * - Derived state: Calculates current time display from selected timezone
 * 
 * COMPONENT BEHAVIOR:
 * This component displays a popup dialog allowing users to choose their
 * preferred timezone for displaying dates throughout the application.
 * 
 * Features:
 * - Lists common timezones with their UTC offsets in a scrollable list
 * - Shows the currently selected timezone with visual highlighting
 * - Allows selection via radio buttons or clicking on rows
 * - Displays current time in the selected timezone for real-time preview
 * - Changes take effect immediately as user selects different options
 * 
 * @param props.timezone - Currently selected timezone option
 * @param props.setTimezone - State setter function to update the selected timezone
 * @param props.onClose - Function to close the timezone selector
 */
interface TimezoneSelectorProps {
  timezone: TimezoneOption;
  setTimezone: (timezone: TimezoneOption) => void;
  onClose: () => void;
}
let timezoneOptions = getTimezoneOptions();

const TimezoneSelector = ({
  timezone,
  setTimezone,
  onClose
}: TimezoneSelectorProps) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div 
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md"
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Select Timezone</h3>
          <button 
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-1.5 rounded-full flex items-center justify-center focus:outline-none"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Instruction text */}
        <p className="text-sm text-gray-600 mb-4">
          Choose a timezone to display timestamp values:
        </p>
        
        {/* Timezone options container */}
        <div className="border rounded-lg overflow-hidden mb-4">
          {/* Table header */}
          <div className="bg-gray-50 border-b py-2 px-3 grid grid-cols-12">
            <div className="col-span-1"></div>
            <div className="col-span-7 font-medium text-sm">Timezone</div>
            <div className="col-span-4 font-medium text-sm">UTC Offset</div>
          </div>
          
          {/* Scrollable list of timezone options */}
          <div className="max-h-60 overflow-y-auto">
            {timezoneOptions.length > 0 ? (
              // Map through each timezone option
              timezoneOptions.map((tz) => (
                <div 
                  key={tz.value} 
                  // Highlight the selected timezone with blue background
                  className={`grid grid-cols-12 items-center py-2 px-3 border-b last:border-b-0 hover:bg-gray-50 ${timezone.value === tz.value ? 'bg-blue-50' : ''}`}
                  onClick={() => {
                    // Update timezone when clicking the row (for better UX)
                    setTimezone(tz);
                  }}
                >
                  {/* Radio button column */}
                  <div className="col-span-1 flex justify-center">
                    <input
                      type="radio"
                      id={`tz-${tz.value}`}
                      name="timezone"
                      checked={timezone.value === tz.value}
                      onChange={() => {
                        // Update timezone when radio button is selected
                        setTimezone(tz);
                        // Leave selector open to let user see the effect in real-time
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Timezone name column */}
                  <label htmlFor={`tz-${tz.value}`} className="col-span-7 cursor-pointer text-sm">
                    {tz.label}
                  </label>
                  
                  {/* UTC offset column */}
                  <div className="col-span-4 text-gray-500 text-sm">
                    {tz.value === 'local' ? (
                      'Browser default'
                    ) : (
                      <span>
                        UTC {tz.offset >= 0 ? '+' : ''}{Math.floor(tz.offset / 60)}:
                        {Math.abs(tz.offset % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              // Loading state if timezone options aren't available yet
              <div className="p-4 text-center text-gray-500">
                Loading timezone options...
              </div>
            )}
          </div>
        </div>
        
        {/* Footer with current time preview and close button */}
        <div className="flex justify-between">
          <div className="text-sm text-gray-500">
            <span>Current time: {formatTimestamp(Date.now(), timezone)}</span>
          </div>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimezoneSelector;