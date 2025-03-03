'use client';

import {ColumnDef, TimezoneOption} from './types';
import { WorkflowSearchResponseEntry } from '../ts-api/src/api-gen/api';
import {formatTimestamp, formatAttributeValue, loadFromLocalStorage, saveToLocalStorage} from './utils';
import StatusBadge from './StatusBadge';
import {useEffect, useState} from "react";

/**
 * ColumnManager handles all the column logic including creation, 
 * search attribute column generation, and accessor creation.
 */

export function useColumnManager(timezone: TimezoneOption){
  // Initialize columns with base columns for server rendering
  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    // Start with base columns - no localStorage access during initial render to avoid hydration issues
    return getBaseColumnsWithAccessors(timezone);
  });

  // After initial render, load saved columns from localStorage - only runs once on mount
  useEffect(() => {

    // Load saved columns from localStorage
    const savedColumns = loadFromLocalStorage<ColumnDef[]>('columns', null);

    // If we have saved columns, update them with current accessors
    if (savedColumns && savedColumns.length > 0) {
      // Create base columns with accessors
      const baseColumnsWithAccessors = getBaseColumnsWithAccessors(timezone);

      // Map saved columns to ensure they have current accessors
      const updatedColumns = savedColumns.map(savedCol => {
        // Find matching base column to get current accessor
        const baseCol = baseColumnsWithAccessors.find(c => c.id === savedCol.id);

        if (baseCol) {
          // Keep visibility and other properties from saved column, but use current accessor
          return {
            ...savedCol,
            accessor: baseCol.accessor
          };
        } else if (savedCol.id.startsWith('attr_')) {
          // This is a custom search attribute column
          const attributeKey = savedCol.id.substring(5); // Remove 'attr_' prefix

          // Create an appropriate accessor for this search attribute column
          return {
            ...savedCol,
            accessor: createSearchAttributeAccessor(attributeKey, timezone)
          };
        }

        // Default case: just return the saved column as is
        return savedCol;
      });

      // Update the columns state
      setColumns(updatedColumns);
    }
  }, []); // Only run once on mount

  // Save column configuration to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage('columns', columns);
  }, [columns]);

  // Update accessors when timezone changes
  useEffect(() => {

    // Update time-related columns with new timezone information
    const baseColumnsWithAccessors = getBaseColumnsWithAccessors(timezone);

    setColumns(prevColumns => prevColumns.map(col => {
      // Update time-related columns
      if (col.id === 'startTime' || col.id === 'closeTime') {
        const baseCol = baseColumnsWithAccessors.find(c => c.id === col.id);
        if (baseCol) {
          return { ...col, accessor: baseCol.accessor };
        }
      }
      // Update datetime search attribute columns
      else if (col.id.startsWith('attr_')) {
        const attributeKey = col.id.substring(5);
        return {
          ...col,
          accessor: createSearchAttributeAccessor(attributeKey, timezone)
        };
      }
      return col;
    }));
  }, [timezone]); // Re-run when timezone changes
  
  return {
    columns,
    setColumns
  }
}

/**
 * Gets the base columns with accessors for rendering workflow data
 * This only includes the standard columns, not search attribute columns
 * 
 * @param timezone - The current timezone for formatting time values
 * @returns An array of column definitions with accessor functions
 */
export const getBaseColumnsWithAccessors = (timezone: any): ColumnDef[] => {
  // Define base column definitions without accessors
  const baseColumns: Omit<ColumnDef, 'accessor'>[] = [
    { id: 'workflowStatus', label: 'Status', visible: true },
    { id: 'workflowType', label: 'Type', visible: true },
    { id: 'workflowId', label: 'Workflow ID', visible: true },
    { id: 'workflowRunId', label: 'Run ID', visible: true },
    { id: 'startTime', label: 'Start Time', visible: true },
    { id: 'closeTime', label: 'Close Time', visible: true },
    { id: 'taskQueue', label: 'Task Queue', visible: false },
    { id: 'historySizeInBytes', label: 'History Size', visible: false },
    { id: 'historyLength', label: 'History Length', visible: false },
    { id: 'customSearchAttributes', label: 'Search Attributes', visible: true }
  ];

  // Function to generate time column accessor that respects timezone
  const createTimeColumnAccessor = (timeGetter: (w: WorkflowSearchResponseEntry) => number | undefined) => {
    // Return a function that will use the current timezone setting when called
    return (w: WorkflowSearchResponseEntry) => formatTimestamp(timeGetter(w), timezone);
  };

  // Map base columns to add accessors
  const columnsWithAccessors = baseColumns.map(col => {
    let accessor;
    
    switch (col.id) {
      case 'workflowStatus':
        accessor = (w: WorkflowSearchResponseEntry) => <StatusBadge status={w.workflowStatus} />;
        break;
      case 'workflowId':
        accessor = (w: WorkflowSearchResponseEntry) => w.workflowId;
        break;
      case 'workflowRunId':
        accessor = (w: WorkflowSearchResponseEntry) => w.workflowRunId;
        break;
      case 'workflowType':
        accessor = (w: WorkflowSearchResponseEntry) => w.workflowType || 'N/A';
        break;
      case 'startTime':
        // Create dynamic accessor that will use the current timezone setting
        accessor = createTimeColumnAccessor(w => w.startTime);
        break;
      case 'closeTime':
        // Create dynamic accessor that will use the current timezone setting
        accessor = createTimeColumnAccessor(w => w.closeTime);
        break;
      case 'taskQueue':
        accessor = (w: WorkflowSearchResponseEntry) => w.taskQueue || 'N/A';
        break;
      case 'historySizeInBytes':
        accessor = (w: WorkflowSearchResponseEntry) => {
          if (w.historySizeInBytes === undefined) return 'N/A';
          
          const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
          if (w.historySizeInBytes === 0) return '0 Byte';
          const i = Math.floor(Math.log(w.historySizeInBytes) / Math.log(1024));
          return Math.round((w.historySizeInBytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
        };
        break;
      case 'historyLength':
        accessor = (w: WorkflowSearchResponseEntry) => w.historyLength?.toString() || 'N/A';
        break;
      case 'customSearchAttributes':
        // For the search attributes column, we don't add click behavior here
        // The parent component should handle connecting this with a showSearchAttributes function
        accessor = (w: WorkflowSearchResponseEntry) => (
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs"
            >
            {w.customSearchAttributes?.length || 0} attributes
          </button>
        );
        break;
      default:
        accessor = () => 'N/A';
    }
    
    return { ...col, accessor };
  });
  
  return columnsWithAccessors;
};

/**
 * Creates an accessor function for a custom search attribute column
 * 
 * @param attributeKey - The search attribute key
 * @param timezone - The current timezone for formatting time values
 * @returns An accessor function for the search attribute
 */
export const createSearchAttributeAccessor = (attributeKey: string, timezone: any) => {
  return (workflow: WorkflowSearchResponseEntry) => {
    const attr = workflow.customSearchAttributes?.find(a => a.key === attributeKey);
    if (!attr) return 'N/A';
    
    // Special handling for datetime values
    if (attr.valueType === 'DATETIME' && attr.integerValue !== undefined) {
      return formatTimestamp(attr.integerValue, timezone);
    }
    
    // For other types, use the regular formatter
    return formatAttributeValue(attr);
  };
};

/**
 * Gets all columns including base columns and custom search attribute columns
 * 
 * @param timezone - The current timezone for formatting time values
 * @param searchAttributeColumns - Array of search attribute column definitions
 * @returns Complete array of column definitions with accessors
 */
export const getColumnsWithAccessors = (
  timezone: any, 
  searchAttributeColumns: Omit<ColumnDef, 'accessor'>[] = []
): ColumnDef[] => {
  // Get base columns
  const baseColumnsWithAccessors = getBaseColumnsWithAccessors(timezone);
  
  // Create accessors for search attribute columns
  const searchAttrColumnsWithAccessors = searchAttributeColumns.map(col => {
    // Extract attribute key from column ID (remove 'attr_' prefix)
    const attributeKey = col.id.substring(5);
    return {
      ...col,
      accessor: createSearchAttributeAccessor(attributeKey, timezone)
    };
  });
  
  // Combine base columns and search attribute columns
  return [...baseColumnsWithAccessors, ...searchAttrColumnsWithAccessors];
};