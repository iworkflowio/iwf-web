'use client';

import { AppConfig } from './types';

/**
 * ConfigPopup - Displays the application configuration settings
 * 
 * This component shows the Temporal server connection details
 * in a modal dialog. It's used for informational purposes to help
 * users understand which Temporal instance they're connected to.
 * 
 * Features:
 * - Displays Temporal host/port
 * - Displays Temporal namespace
 * - Shows information on how to change these settings
 * 
 * @param props.config - The current application configuration
 * @param props.onClose - Function to close the popup
 */
interface ConfigPopupProps {
  config: AppConfig;
  onClose: () => void;
}

const ConfigPopup = ({ config, onClose }: ConfigPopupProps) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div 
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md"
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Temporal Configuration</h3>
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
        
        {/* Configuration settings display */}
        <div className="space-y-4">
          {/* Host/Port setting */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Temporal Host/Port</h4>
            <div className="bg-gray-50 p-2 rounded border text-sm font-mono">
              {config.temporalHostPort}
            </div>
          </div>
          
          {/* Namespace setting */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Temporal Namespace</h4>
            <div className="bg-gray-50 p-2 rounded border text-sm font-mono">
              {config.temporalNamespace}
            </div>
          </div>
          
          {/* Web UI setting */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Temporal Web UI</h4>
            <div className="bg-gray-50 p-2 rounded border text-sm font-mono">
              {config.temporalWebUI}
            </div>
            <div className="text-xs mt-1">
              <a 
                href={config.temporalWebUI} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Open Temporal Web UI
              </a>
            </div>
          </div>
          
          {/* Help text about changing settings */}
          <div className="pt-2 text-xs text-gray-500">
            <p>These settings can be changed by updating the .env.local file.</p>
            <div className="mt-1">
              <div>Environment variables:</div>
              <ul className="list-disc ml-4 mt-1">
                <li>TEMPORAL_HOST_PORT</li>
                <li>TEMPORAL_NAMESPACE</li>
                <li>TEMPORAL_WEB_UI_URL</li>
              </ul>
            </div>
            <p className="mt-1">See README.md for more information.</p>
          </div>
        </div>
        
        {/* Close button */}
        <div className="flex justify-end mt-4">
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

export default ConfigPopup;