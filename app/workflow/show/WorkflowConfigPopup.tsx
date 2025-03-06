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
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <span className="text-2xl">&times;</span>
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
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm font-medium text-gray-500">Disable System Search Attribute</div>
          <div className="mt-1 text-gray-900">{workflowConfig.disableSystemSearchAttribute?.toString() || 'false'}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Executing State ID Mode</div>
          <div className="mt-1 text-gray-900">{workflowConfig.executingStateIdMode || 'Default'}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Continue As New Threshold</div>
          <div className="mt-1 text-gray-900">{workflowConfig.continueAsNewThreshold || 'Default'}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Continue As New Page Size In Bytes</div>
          <div className="mt-1 text-gray-900">{workflowConfig.continueAsNewPageSizeInBytes || 'Default'}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Optimize Activity</div>
          <div className="mt-1 text-gray-900">{workflowConfig.optimizeActivity?.toString() || 'false'}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-500">Optimize Timer</div>
          <div className="mt-1 text-gray-900">{workflowConfig.optimizeTimer?.toString() || 'false'}</div>
        </div>
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Raw Config</h4>
        <pre className="bg-gray-50 p-3 rounded-lg overflow-auto max-h-60 text-sm">
          {JSON.stringify(workflowConfig, null, 2)}
        </pre>
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
    <div>
      {stateIds && stateIds.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Wait For Completion State IDs</h4>
          <ul className="bg-gray-50 p-3 rounded-lg">
            {stateIds.map((id, index) => (
              <li key={index} className="mb-1 text-gray-800">
                {id}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {executionIds && executionIds.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Wait For Completion State Execution IDs</h4>
          <ul className="bg-gray-50 p-3 rounded-lg">
            {executionIds.map((id, index) => (
              <li key={index} className="mb-1 text-gray-800 break-all">
                {id}
              </li>
            ))}
          </ul>
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
    <div>
      {searchAttributes && searchAttributes.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Initial Search Attributes</h4>
          <pre className="bg-gray-50 p-3 rounded-lg overflow-auto max-h-60 text-sm">
            {JSON.stringify(searchAttributes, null, 2)}
          </pre>
        </div>
      )}
      
      {dataAttributes && dataAttributes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Initial Data Attributes</h4>
          <pre className="bg-gray-50 p-3 rounded-lg overflow-auto max-h-60 text-sm">
            {JSON.stringify(dataAttributes, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function WorkflowConfigPopup({ workflowInput }: { workflowInput: InterpreterWorkflowInput }) {
  const [activePopup, setActivePopup] = useState<'config' | 'waitForCompletion' | 'persistence' | null>(null);
  
  return (
    <div className="flex flex-wrap gap-2">
      {workflowInput?.config && (
        <>
          <button 
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            onClick={() => setActivePopup('config')}
          >
            <span className="mr-1">🛠️</span> Workflow Config
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
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            onClick={() => setActivePopup('waitForCompletion')}
          >
            <span className="mr-1">⏱️</span> Wait For State Completion
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
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            onClick={() => setActivePopup('persistence')}
          >
            <span className="mr-1">💾</span> Initial Persistence
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