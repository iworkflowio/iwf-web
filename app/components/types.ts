// Import types from the API for workflow data structures
import { WorkflowSearchResponseEntry, SearchAttribute } from '../ts-api/src/api-gen/api';

/**
 * ColumnDef defines the structure of a table column in the workflow table.
 * 
 * Each column needs:
 * - id: A unique identifier for the column
 * - label: The displayed header text
 * - accessor: A function that extracts/formats the data from a workflow object
 * - visible: Whether the column should be shown in the table
 */
export interface ColumnDef {
  id: string;
  label: string;
  accessor: (workflow: WorkflowSearchResponseEntry) => React.ReactNode;
  visible: boolean;
}

/**
 * TimezoneOption defines a timezone choice for displaying dates.
 * 
 * Each timezone has:
 * - label: User-friendly name (e.g., "Pacific Time (PT)")
 * - value: The timezone identifier (e.g., "America/Los_Angeles")
 * - offset: The offset from UTC in minutes
 */
export interface TimezoneOption {
  label: string;
  value: string;
  offset: number; // in minutes from UTC
}

/**
 * SavedQuery represents a search query that users can save.
 * 
 * Properties:
 * - query: The actual search query text
 * - name: Optional friendly name for the saved query
 * - timestamp: When the query was saved (for sorting)
 */
export interface SavedQuery {
  query: string;
  name?: string;
  timestamp: number; // For sorting by recency
}

/**
 * AppConfig contains the application configuration settings.
 * 
 * Current settings:
 * - temporalHostPort: The Temporal server host and port
 * - temporalNamespace: The Temporal namespace to use
 */
export interface AppConfig {
  temporalHostPort: string;
  temporalNamespace: string;
}

/**
 * PopupState manages the state of popup dialogs.
 * 
 * Properties:
 * - show: Whether the popup should be displayed
 * - title: The popup's title
 * - content: The React component/content to show inside the popup
 */
export interface PopupState {
  show: boolean;
  title: string;
  content: React.ReactNode;
}

/**
 * FilterSpec defines the structure of a filter applied to a column.
 * 
 * Properties:
 * - value: The filter value to match
 * - operator: The comparison operator (=, !=, >, <, etc.)
 */
export interface FilterSpec {
  value: string;
  operator: string;
}