'use client';

import { useState } from 'react';
import { WorkflowConfig, InterpreterWorkflowInput, KeyValue, SearchAttribute } from '../../ts-api/src/api-gen/api';

interface WorkflowConfigPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: React.ReactNode;
}

export function ConfigPopup({ isOpen, onClose, title, content }: WorkflowConfigPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          </div>
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
        <div className="px-6 py-4 max-h-[calc(80vh-8rem)] overflow-y-auto">
          {content}
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface WorkflowConfigDisplayProps {
  workflowConfig: WorkflowConfig;
}

export function WorkflowConfigDisplay({ workflowConfig }: WorkflowConfigDisplayProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition duration-150">
          <div className="text-sm font-medium text-gray-500 mb-1">Executing State ID Mode</div>
          <div className="font-medium text-gray-900">{workflowConfig.executingStateIdMode || 'Default'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition duration-150">
          <div className="text-sm font-medium text-gray-500 mb-1">Continue As New Threshold</div>
          <div className="font-medium text-gray-900">{workflowConfig.continueAsNewThreshold || 'Default'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition duration-150">
          <div className="text-sm font-medium text-gray-500 mb-1">Continue As New Page Size In Bytes</div>
          <div className="font-medium text-gray-900">{workflowConfig.continueAsNewPageSizeInBytes || 'Default'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition duration-150">
          <div className="text-sm font-medium text-gray-500 mb-1">Optimize Activity</div>
          <div className="font-medium text-gray-900 flex items-center">
            {workflowConfig.optimizeActivity ? 
              <span className="flex items-center text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Enabled
              </span> : 
              <span className="flex items-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Disabled
              </span>
            }
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition duration-150">
          <div className="text-sm font-medium text-gray-500 mb-1">Optimize Timer</div>
          <div className="font-medium text-gray-900 flex items-center">
            {workflowConfig.optimizeTimer ? 
              <span className="flex items-center text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Enabled
              </span> : 
              <span className="flex items-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Disabled
              </span>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

interface WaitForCompletionDisplayProps {
  stateIds?: string[];
  executionIds?: string[];
}

export function WaitForCompletionDisplay({ stateIds, executionIds }: WaitForCompletionDisplayProps) {
  return (
    <div className="space-y-6">
      {stateIds && stateIds.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Wait For Completion State IDs
          </h4>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <ul className="space-y-2">
              {stateIds.map((id, index) => (
                <li key={index} className="text-gray-800 flex items-center">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mr-3">
                    {index + 1}
                  </span>
                  <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm flex-1 break-all">
                    {id}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {executionIds && executionIds.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
            </svg>
            Wait For Completion State Execution IDs
          </h4>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <ul className="space-y-2">
              {executionIds.map((id, index) => (
                <li key={index} className="text-gray-800 flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium mr-3 mt-0.5">
                    {index + 1}
                  </span>
                  <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm flex-1 break-all">
                    {id}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {(!stateIds || stateIds.length === 0) && (!executionIds || executionIds.length === 0) && (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg border border-yellow-200 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
          </svg>
          No wait-for-completion states or executions configured
        </div>
      )}
    </div>
  );
}

interface InitialPersistenceDisplayProps {
  searchAttributes?: SearchAttribute[];
  dataAttributes?: KeyValue[];
}

export function InitialPersistenceDisplay({ searchAttributes, dataAttributes }: InitialPersistenceDisplayProps) {
  return (
    <div className="space-y-6">
      {searchAttributes && searchAttributes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
            </svg>
            Initial Search Attributes
          </h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">{searchAttributes.length} search attribute{searchAttributes.length !== 1 ? 's' : ''}</span>
              <span className="text-xs font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded">SearchAttribute[]</span>
            </div>
            <pre className="p-4 overflow-auto max-h-60 text-sm">
              {JSON.stringify(searchAttributes, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {dataAttributes && dataAttributes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
              <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
              <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
            </svg>
            Initial Data Attributes
          </h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">{dataAttributes.length} data attribute{dataAttributes.length !== 1 ? 's' : ''}</span>
              <span className="text-xs font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded">KeyValue[]</span>
            </div>
            <pre className="p-4 overflow-auto max-h-60 text-sm">
              {JSON.stringify(dataAttributes, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {(!searchAttributes || searchAttributes.length === 0) && (!dataAttributes || dataAttributes.length === 0) && (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg border border-yellow-200 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
          </svg>
          No initial persistence attributes configured
        </div>
      )}
    </div>
  );
}

export default function WorkflowConfigPopup({ workflowInput, continueAsNewSnapshot }: {
  workflowInput: InterpreterWorkflowInput;
  continueAsNewSnapshot?: any;
}) {
  const [activePopup, setActivePopup] = useState<'config' | 'waitForCompletion' | 'persistence' | 'continueAsNew' | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {workflowInput?.config && (
        <>
          <button 
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
            onClick={() => setActivePopup('config')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Workflow Config
          </button>
          
          <ConfigPopup 
            isOpen={activePopup === 'config'} 
            onClose={() => setActivePopup(null)}
            title="Workflow Configuration"
            content={<WorkflowConfigDisplay workflowConfig={workflowInput.config} />}
          />
        </>
      )}
      
      {(workflowInput?.waitForCompletionStateIds?.length > 0 || workflowInput?.waitForCompletionStateExecutionIds?.length > 0) && (
        <>
          <button 
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
            onClick={() => setActivePopup('waitForCompletion')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Wait For Completion
          </button>
          
          <ConfigPopup 
            isOpen={activePopup === 'waitForCompletion'} 
            onClose={() => setActivePopup(null)}
            title="Wait For State Completion Configuration"
            content={
              <WaitForCompletionDisplay 
                stateIds={workflowInput.waitForCompletionStateIds} 
                executionIds={workflowInput.waitForCompletionStateExecutionIds} 
              />
            }
          />
        </>
      )}
      
      {(workflowInput?.initSearchAttributes?.length > 0 || workflowInput?.initDataAttributes?.length > 0) && (
        <>
          <button 
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
            onClick={() => setActivePopup('persistence')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
              <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
              <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
            </svg>
            Initial Persistence
          </button>
          
          <ConfigPopup 
            isOpen={activePopup === 'persistence'} 
            onClose={() => setActivePopup(null)}
            title="Initial Persistence Configuration"
            content={
              <InitialPersistenceDisplay 
                searchAttributes={workflowInput.initSearchAttributes} 
                dataAttributes={workflowInput.initDataAttributes} 
              />
            }
          />
        </>
      )}
    </div>
  );
}