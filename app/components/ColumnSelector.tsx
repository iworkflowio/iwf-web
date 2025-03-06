'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from './types';
import { SearchAttribute } from '../ts-api/src/api-gen/api';
import { formatAttributeValue } from './utils';

/**
 * ColumnSelector Component - Modal for customizing table columns
 * 
 * REACT CONCEPTS DEMONSTRATED:
 * - useState: Manages local state for attribute columns
 * - useEffect: Detects available search attributes from results
 * - Component state: Local component state that doesn't need to be lifted up
 * - Side effects: Processes workflow results to find available attributes
 * - Props usage: Receives both data and functions from parent
 * - Event handling: Checkbox changes, button clicks
 * - Conditional rendering: Search attribute section only shows when attributes available
 * - Lists & keys: Maps over arrays with unique keys
 * - Form elements: Checkboxes for toggling column visibility
 * 
 * ADVANCED REACT PATTERNS:
 * - Derived data: Creates new data structures from props
 * - Complex state management: Uses both local state and parent state
 * - Dynamic UI generation: Creates UI elements based on available data
 * - Utility functions: Uses helper functions within the component for formatting
 * 
 * COMPONENT BEHAVIOR:
 * This component allows users to customize the table columns displayed in the workflow list:
 * - Toggle visibility of existing columns with checkboxes
 * - Add new columns for search attributes found in workflow data
 * - Remove custom search attribute columns that are no longer needed
 * - Reset column visibility to show all columns at once
 * 
 * @param props.columns - Current column definitions
 * @param props.setColumns - Function to update columns (state setter from parent)
 * @param props.onClose - Function to close the modal
 * @param props.results - Current workflow results (used to find available search attributes)
 * @param props.toggleColumnVisibility - Function to toggle a column's visibility
 * @param props.resetColumnVisibility - Function to reset all columns to visible
 */
interface ColumnSelectorProps {
  columns: ColumnDef[];
  setColumns: (columns: ColumnDef[]) => void;
  onClose: () => void;
  results: any[];
  toggleColumnVisibility: (columnId: string) => void;
  resetColumnVisibility: () => void;
}

const ColumnSelector = ({
  columns,
  setColumns,
  onClose,
  results,
  toggleColumnVisibility,
  resetColumnVisibility
}: ColumnSelectorProps) => {
  // Track available search attributes that can be added as columns
  const [attributeColumns, setAttributeColumns] = useState<Map<string, boolean>>(new Map());

  // Find all unique search attribute keys in all workflows
  useEffect(() => {
    const attributeKeysMap = new Map<string, boolean>();
    
    results.forEach(workflow => {
      if (workflow.customSearchAttributes) {
        workflow.customSearchAttributes.forEach((attr: SearchAttribute) => {
          if (attr.key) {
            // Check if this attribute key is already a column
            const isAlreadyColumn = columns.some(col => col.id === `attr_${attr.key}`);
            // If it's not already a column, add it to our map
            if (!isAlreadyColumn) {
              attributeKeysMap.set(attr.key, false);
            }
          }
        });
      }
    });
    
    setAttributeColumns(attributeKeysMap);
  }, [results, columns]);

  // We don't need formatAttributeValue here
  // It's now defined and managed in WorkflowSearchPage
  
  // Get value type label
  const getValueTypeLabel = (attr?: SearchAttribute) => {
    if (!attr?.valueType) return '';
    
    switch (attr.valueType) {
      case 'KEYWORD': return 'K';
      case 'TEXT': return 'T';
      case 'DATETIME': return 'DT';
      case 'INT': return 'I';
      case 'DOUBLE': return 'D';
      case 'BOOL': return 'B';
      case 'KEYWORD_ARRAY': return 'K[]';
      default: return '';
    }
  };
  
  // Add a search attribute as a column
  const addAttributeColumn = (attributeKey: string) => {
    // Find an example attribute to get its type
    const exampleAttr = results.flatMap(w => w.customSearchAttributes || [])
                        .find(a => a.key === attributeKey);
    const valueTypeLabel = getValueTypeLabel(exampleAttr);
          
    // Create a new column for this attribute
    const newColumn: ColumnDef = {
      id: `attr_${attributeKey}`,
      label: attributeKey,
      accessor: (workflow) => {
        const attr = workflow.customSearchAttributes?.find((a: SearchAttribute) => a.key === attributeKey);
        if (!attr) return 'N/A';
        
        // Use the formatAttributeValue utility function to format the attribute
        return formatAttributeValue(attr);
      },
      visible: true
    };
    
    // Add to columns
    setColumns([...columns, newColumn]);
    
    // Update attribute map to remove the added attribute
    const newMap = new Map(attributeColumns);
    newMap.delete(attributeKey);
    setAttributeColumns(newMap);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div 
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl"
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Customize Table Columns</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ✕
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-4 mb-6">
          {/* Current columns section */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">Current Columns</h4>
            <p className="text-sm text-gray-500 mb-3">Select which columns to display in the table:</p>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto p-2">
              {columns.map(column => (
                <div key={column.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`column-${column.id}`}
                      checked={column.visible}
                      onChange={() => toggleColumnVisibility(column.id)}
                      className="w-4 h-4 mr-2 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor={`column-${column.id}`} className="text-sm">
                      {column.label}
                    </label>
                  </div>
                  
                  {/* Show remove button for custom attribute columns */}
                  {column.id.startsWith('attr_') && (
                    <button
                      onClick={() => {
                        // Remove this column
                        setColumns(columns.filter(c => c.id !== column.id));
                        
                        // Add the attribute back to the available list
                        const attrKey = column.id.replace('attr_', '');
                        const newMap = new Map(attributeColumns);
                        newMap.set(attrKey, false);
                        setAttributeColumns(newMap);
                      }}
                      className="text-red-500 hover:text-red-700 text-xs"
                      title="Remove column"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Add search attribute columns section - only shown if attributes available */}
          {attributeColumns.size > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-2">Add Search Attribute Columns</h4>
              <p className="text-sm text-gray-500 mb-3">Add custom search attributes as columns:</p>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto p-2">
                {Array.from(attributeColumns.entries()).map(([key]) => (
                  <div key={key} className="flex items-center">
                    <button
                      onClick={() => addAttributeColumn(key)}
                      className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded-full flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {key}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with action buttons */}
        <div className="flex justify-between">
          <button
            onClick={resetColumnVisibility}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md text-sm"
          >
            Show All Columns
          </button>
          <button
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnSelector;