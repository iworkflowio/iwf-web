import { WorkflowStatus } from '../../../ts-api/src/api-gen/api';

// Configuration for Temporal connection
export const temporalConfig = {
  // Default connection parameters, can be overridden with environment variables
  hostPort: process.env.TEMPORAL_HOST_PORT || 'localhost:7233',
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
};

// Map Temporal workflow status to our API status
export const mapTemporalStatus = (status: string): WorkflowStatus => {
  // Normalize the status by converting to uppercase and removing any prefixes
  const normalizedStatus = (status || '').toString().toUpperCase().trim();
  
  // Sometimes status comes with 'WORKFLOW_EXECUTION_STATUS_' prefix
  const statusWithoutPrefix = normalizedStatus.replace('WORKFLOW_EXECUTION_STATUS_', '');
  
  switch (statusWithoutPrefix) {
    case 'RUNNING':
      return 'RUNNING';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELED':
      return 'CANCELED';
    case 'TERMINATED':
      return 'TERMINATED';
    case 'CONTINUED_AS_NEW':
      return 'CONTINUED_AS_NEW';
    case 'TIMED_OUT':
      return 'TIMEOUT';
    case '1': // Sometimes Temporal returns numeric status codes
      return 'RUNNING';
    case '2':
      return 'COMPLETED';
    case '3':
      return 'FAILED';
    case '4':
      return 'CANCELED';
    case '5':
      return 'TERMINATED';
    case '6':
      return 'CONTINUED_AS_NEW';
    case '7':
      return 'TIMEOUT';
    default:
      throw new Error(`Unknown workflow status: ${status} (normalized: ${statusWithoutPrefix})`);
  }
};

// Helper function to get a string value from a possible complex object
export function extractStringValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    // Check for Buffer or PayloadData types
    if (value.data && typeof value.data !== 'object') {
      return String(value.data);
    }
    
    // Try toString - if it's not the default Object toString result
    const strValue = value.toString();
    if (strValue !== '[object Object]') {
      return strValue;
    }
    
    // Last resort - convert to JSON
    try {
      return JSON.stringify(value);
    } catch (e) {
      return 'Complex Value';
    }
  }
  
  return 'Unknown Value';
}