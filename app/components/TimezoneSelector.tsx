'use client';

import { TimezoneOption } from './types';
import { formatTimestamp } from './utils';

/**
 * TimezoneSelector Component - Modal for selecting timezone settings
 * 
 * This component displays a popup dialog allowing users to choose their
 * preferred timezone for displaying dates throughout the application.
 * 
 * Features:
 * - Lists common timezones with their UTC offsets
 * - Shows the currently selected timezone
 * - Allows selection via radio buttons
 * - Displays current time in the selected timezone for preview
 * 
 * @param props.timezoneOptions - Array of available timezone options
 * @param props.timezone - Currently selected timezone option
 * @param props.setTimezone - State setter function to update the selected timezone
 * @param props.onClose - Function to close the timezone selector
 */
interface TimezoneSelectorProps {
  timezoneOptions: TimezoneOption[];
  timezone: TimezoneOption;
  setTimezone: (timezone: TimezoneOption) => void;
  onClose: () => void;
}

const TimezoneSelector = ({
  timezoneOptions,
  timezone,
  setTimezone,
  onClose
}: TimezoneSelectorProps) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        right: 0, 
        bottom: 0, 
        left: 0, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 50 
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" 
        style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.5rem', 
          padding: '1.5rem', 
          width: '100%', 
          maxWidth: '28rem' 
        }}
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Select Timezone</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ✕
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
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md text-sm"
            style={{ backgroundColor: '#f3f4f6', color: '#1f2937', borderRadius: '0.375rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimezoneSelector;