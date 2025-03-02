'use client';

import { FilterSpec } from './types';
import { formatFilterForQuery } from './utils';
import { SearchAttribute } from '../ts-api/src/api-gen/api';

/**
 * FilterPopup Component - Modal for adding/editing column filters
 * 
 * This component displays a popup dialog allowing users to set
 * filter conditions for specific columns. It supports different
 * filter types based on the data type of the column.
 * 
 * Features:
 * - Different input types based on column (text, date, dropdown)
 * - Selection of comparison operators (=, !=, >, <, etc.)
 * - Ability to clear existing filters
 * 
 * @param props.activeFilterColumn - ID of the column being filtered
 * @param props.columnLabel - Display name of the column
 * @param props.filterValue - Current filter value
 * @param props.setFilterValue - Function to update filter value
 * @param props.filterOperator - Current comparison operator
 * @param props.setFilterOperator - Function to update comparison operator
 * @param props.appliedFilters - Currently applied filters
 * @param props.onClose - Function to close the popup
 * @param props.applyFilter - Function to apply the filter
 * @param props.workflowStatuses - Available workflow status options
 * @param props.getOperatorsForColumn - Function to get valid operators for a column
 * @param props.formatDateForFilter - Function to format date for filter
 * @param props.customAttributes - Collection of search attributes
 */
interface FilterPopupProps {
  activeFilterColumn: string;
  columnLabel: string;
  filterValue: string;
  setFilterValue: (value: string) => void;
  filterOperator: string;
  setFilterOperator: (operator: string) => void;
  appliedFilters: Record<string, FilterSpec>;
  onClose: () => void;
  applyFilter: () => void;
  workflowStatuses: string[];
  getOperatorsForColumn: (columnId: string) => string[];
  formatDateForFilter: (date: Date) => string;
  customAttributes?: SearchAttribute[];
}

const FilterPopup = ({
  activeFilterColumn,
  columnLabel,
  filterValue,
  setFilterValue,
  filterOperator,
  setFilterOperator,
  appliedFilters,
  onClose,
  applyFilter,
  workflowStatuses,
  getOperatorsForColumn,
  formatDateForFilter,
  customAttributes
}: FilterPopupProps) => {
  /**
   * Helper function to clear the filter for this column
   */
  const clearFilter = () => {
    if (activeFilterColumn && appliedFilters[activeFilterColumn]) {
      // Logic for removing this filter will be handled by the parent component
      setFilterValue('');
      onClose();
    } else {
      // Just clear the input and close if no filter is applied
      setFilterValue('');
      onClose();
    }
  };

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
          <h3 className="text-lg font-bold">Filter by {columnLabel}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-6">
          {/* Operator selection for all filter types */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Operator
            </label>
            <select
              className="w-full border rounded px-3 py-2 bg-white"
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
            >
              {activeFilterColumn && getOperatorsForColumn(activeFilterColumn).map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          {/* Different input fields based on column type */}
          {activeFilterColumn === 'workflowStatus' ? (
            // Workflow status dropdown
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Status
              </label>
              <select
                className="w-full border rounded px-3 py-2 bg-white"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              >
                <option value="">-- Select a status --</option>
                {workflowStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          ) : (activeFilterColumn === 'startTime' || activeFilterColumn === 'closeTime') ? (
            // Date/time picker for timestamp columns
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Date and Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full border rounded px-3 py-2"
                  value={filterValue ? new Date(filterValue).toISOString().substring(0, 16) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const selectedDate = new Date(e.target.value);
                      setFilterValue(formatDateForFilter(selectedDate));
                    } else {
                      setFilterValue('');
                    }
                  }}
                />
              </div>
              <p className="text-xs text-gray-500">
                Use the operator dropdown to select the comparison type (=, !=, &gt;, &lt;, etc.).
              </p>
            </div>
          ) : (
            // Default text input for other columns
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter Value
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                onBlur={(e) => setFilterValue(e.target.value.trim())}
                placeholder={`Enter ${columnLabel} value`}
              />
            </div>
          )}
        </div>
        
        {/* Footer with clear and apply buttons */}
        <div className="flex justify-between">
          <button
            onClick={clearFilter}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Clear Filter
          </button>
          
          <div className="space-x-2">
            <button
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md text-sm"
            >
              Cancel
            </button>
            <button
              onClick={applyFilter}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPopup;