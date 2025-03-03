import { WorkflowStatus, WorkflowSearchResponseEntry, SearchAttribute } from '../ts-api/src/api-gen/api';
import { SavedQuery, TimezoneOption } from './types';

/**
 * getTimezoneOptions - Creates a list of timezone options for the timezone selector
 * 
 * This function defines common timezone options with their display names and offsets.
 * It detects the local browser timezone offset to properly set the "Local Time" option.
 * 
 * @returns Array of TimezoneOption objects with label, value, and offset information
 */
export const getTimezoneOptions = (): TimezoneOption[] => {
  // Calculate local timezone offset in minutes (only works in browser)
  const localOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() * -1 : 0;
  
  return [
    { label: 'Local Time', value: 'local', offset: localOffset },
    { label: 'UTC', value: 'UTC', offset: 0 },
    { label: 'Pacific Time (PT)', value: 'America/Los_Angeles', offset: -420 }, // UTC-7 or UTC-8 depending on DST
    { label: 'Mountain Time (MT)', value: 'America/Denver', offset: -360 }, // UTC-6 or UTC-7 depending on DST
    { label: 'Central Time (CT)', value: 'America/Chicago', offset: -300 }, // UTC-5 or UTC-6 depending on DST
    { label: 'Eastern Time (ET)', value: 'America/New_York', offset: -240 }, // UTC-4 or UTC-5 depending on DST
    { label: 'GMT', value: 'Europe/London', offset: 60 }, // UTC+1 or UTC+0 depending on DST
    { label: 'Central European Time (CET)', value: 'Europe/Paris', offset: 120 }, // UTC+2 or UTC+1 depending on DST
    { label: 'India (IST)', value: 'Asia/Kolkata', offset: 330 }, // UTC+5:30
    { label: 'China (CST)', value: 'Asia/Shanghai', offset: 480 }, // UTC+8
    { label: 'Japan (JST)', value: 'Asia/Tokyo', offset: 540 }, // UTC+9
    { label: 'Australia Eastern (AEST)', value: 'Australia/Sydney', offset: 600 }, // UTC+10 or UTC+11 depending on DST
  ];
};

/**
 * formatTimestamp - Formats a timestamp according to the selected timezone
 * 
 * Takes a Unix timestamp and formats it as a human-readable date string
 * adjusted for the selected timezone.
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @param timezone - The selected timezone option
 * @returns Formatted date string or "N/A" if timestamp is undefined
 */
export const formatTimestamp = (timestamp: number | undefined, timezone: TimezoneOption): string => {
  if (timestamp === undefined) return 'N/A';
  
  const date = new Date(timestamp);
  
  if (timezone.value === 'local') {
    // Use local timezone (browser default)
    return date.toLocaleString();
  } else if (timezone.value === 'UTC') {
    // Format in UTC
    return date.toLocaleString('en-US', { timeZone: 'UTC' });
  } else {
    // Use specified timezone
    try {
      // Try to use Intl API with timezone
      return date.toLocaleString('en-US', { 
        timeZone: timezone.value,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      });
    } catch (err) {
      // Fallback to manual offset calculation if timezone is not supported
      const offsetMillis = timezone.offset * 60 * 1000;
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
      const adjustedTime = new Date(utcTime + offsetMillis);
      return `${adjustedTime.toLocaleString()} ${timezone.label.split('(')[1]?.split(')')[0] || ''}`;
    }
  }
};

/**
 * formatBytes - Formats a byte size into a human-readable string
 * 
 * Converts raw byte count to KB, MB, GB, etc. as appropriate.
 * 
 * @param bytes - The number of bytes to format
 * @returns Formatted string with appropriate size unit or "N/A" if undefined
 */
export const formatBytes = (bytes?: number): string => {
  if (bytes === undefined) return 'N/A';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * getStatusColors - Gets the appropriate CSS classes for a workflow status
 * 
 * Returns CSS class strings based on the workflow status.
 * Each status has a different color for visual identification.
 * 
 * @param status - The workflow status (RUNNING, COMPLETED, etc.)
 * @returns Object with badge classes or null if status is undefined
 */
export const getStatusColors = (status?: WorkflowStatus): { badgeClass: string, bgColor: string } | null => {
  if (!status) return null;
  
  let badgeClass = 'badge ';
  let bgColor = '';
  
  // Determine color based on status
  switch (status) {
    case 'RUNNING':
      badgeClass += 'badge-blue';
      bgColor = 'bg-blue-500';
      break;
    case 'COMPLETED':
      badgeClass += 'badge-green';
      bgColor = 'bg-green-500';
      break;
    case 'FAILED':
      badgeClass += 'badge-red';
      bgColor = 'bg-red-500';
      break;
    case 'TIMEOUT':
      badgeClass += 'badge-yellow';
      bgColor = 'bg-yellow-500';
      break;
    case 'TERMINATED':
      badgeClass += 'badge-gray';
      bgColor = 'bg-gray-500';
      break;
    case 'CANCELED':
      badgeClass += 'badge-orange';
      bgColor = 'bg-orange-500';
      break;
    case 'CONTINUED_AS_NEW':
      badgeClass += 'badge-purple';
      bgColor = 'bg-purple-500';
      break;
    default:
      badgeClass += 'badge-gray';
      bgColor = 'bg-gray-400';
  }
  
  return { badgeClass, bgColor };
};

/**
 * formatQueryForDisplay - Creates a user-friendly display of a search query
 * 
 * Returns either the query name (if it has one) or a truncated version of the
 * query text to fit in limited UI space.
 * 
 * @param savedQuery - The saved query object
 * @returns String representation for display
 */
export const formatQueryForDisplay = (savedQuery: SavedQuery): string => {
  // If query has a name, show that instead
  if (savedQuery.name) return savedQuery.name;
  
  // Otherwise format the query string
  const query = savedQuery.query;
  if (query.length <= 25) return query;
  // Truncate long queries with ellipsis in the middle
  return `${query.substring(0, 10)}...${query.substring(query.length - 10)}`;
};

/**
 * sortQueriesByPriority - Sorts saved queries by importance
 * 
 * Sort order:
 * 1. Named queries (alphabetically)
 * 2. Unnamed queries (by recency)
 * 
 * @param queries - Array of saved query objects
 * @returns New sorted array (doesn't modify original)
 */
export const sortQueriesByPriority = (queries: SavedQuery[]): SavedQuery[] => {
  return [...queries].sort((a, b) => {
    // Named queries have higher priority
    if (a.name && !b.name) return -1;
    if (!a.name && b.name) return 1;
    
    // Among named queries, sort alphabetically
    if (a.name && b.name) return a.name.localeCompare(b.name);
    
    // Among unnamed queries, sort by timestamp (most recent first)
    return b.timestamp - a.timestamp;
  });
};

/**
 * loadFromLocalStorage - Safely loads data from localStorage with error handling
 * 
 * @param key - The localStorage key to retrieve
 * @param defaultValue - The default value to return if the key doesn't exist or there's an error
 * @returns The parsed value from localStorage or the defaultValue if not found/error
 */
export const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.error(`Error loading ${key} from localStorage:`, e);
    return defaultValue;
  }
};

/**
 * saveToLocalStorage - Safely saves data to localStorage with error handling
 * 
 * @param key - The localStorage key to store the data under
 * @param value - The value to store (will be JSON.stringify'd)
 */
export const saveToLocalStorage = (key: string, value: any): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e);
  }
};

/**
 * formatAttributeValue - Formats a search attribute for display
 * 
 * Converts different search attribute types (string, integer, boolean, etc.) to
 * a string representation suitable for display in the UI.
 * 
 * @param attr - The search attribute to format
 * @returns Formatted string representation of the attribute value
 */
export const formatAttributeValue = (attr: SearchAttribute): string => {
  if (attr.stringValue !== undefined) return attr.stringValue;
  if (attr.integerValue !== undefined) return attr.integerValue.toString();
  if (attr.doubleValue !== undefined) return attr.doubleValue.toString();
  if (attr.boolValue !== undefined) return attr.boolValue ? 'true' : 'false';
  if (attr.stringArrayValue) {
    if (attr.stringArrayValue.length === 0) return '[]';
    if (attr.stringArrayValue.length === 1) return attr.stringArrayValue[0];
    return attr.stringArrayValue.length <= 2 
      ? attr.stringArrayValue.join(', ')
      : `${attr.stringArrayValue[0]}, ${attr.stringArrayValue[1]}, ... (${attr.stringArrayValue.length})`;
  }
  return 'N/A';
};

/**
 * formatFilterForQuery - Formats a filter value for inclusion in a query
 * 
 * Handles different data types and adds quotes as needed based on field type.
 * 
 * @param columnId - ID of the column being filtered
 * @param value - The filter value
 * @returns Properly formatted value string for the query
 */
export const formatFilterForQuery = (
  columnId: string, 
  value: string,
  customAttributes?: SearchAttribute[]
): string => {
  // Format based on column type
  if (columnId === 'startTime' || columnId === 'closeTime') {
    return value; // Value is already in the correct format from the datepicker
  }
  
  // Handle search attribute columns
  if (columnId.startsWith('attr_')) {
    const attributeName = columnId.substring(5);
    
    // Try to find an example of this attribute to determine its type
    const exampleAttr = customAttributes?.find(a => a.key === attributeName);
    
    if (exampleAttr) {
      // Format based on value type
      switch(exampleAttr.valueType) {
        case 'INT':
        case 'DOUBLE':
          // For numeric types, don't add quotes
          return value.replace(/"/g, '');
        case 'BOOL':
          // For boolean values, don't add quotes and ensure lowercase
          return value.toLowerCase().replace(/"/g, '');
        case 'DATETIME':
          // Keep datetime formatting as is
          return value;
        case 'KEYWORD_ARRAY':
          // If not already quoted
          if (!value.startsWith('"') && !value.endsWith('"')) {
            return `"${value}"`;
          }
          return value;
        default:
          // Default to quoted string for TEXT, KEYWORD, etc.
          if (!value.startsWith('"') && !value.endsWith('"')) {
            return `"${value}"`;
          }
          return value;
      }
    }
  }
  
  // For regular string fields, add quotes if not already present
  if (!value.startsWith('"') && !value.endsWith('"')) {
    return `"${value}"`;
  }
  
  return value;
};