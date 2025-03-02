'use client';

import { WorkflowStatus } from '../ts-api/src/api-gen/api';
import { getStatusColors } from './utils';

/**
 * StatusBadge Component - Displays a workflow status with appropriate colors
 * 
 * This component renders a visually distinct badge for each workflow status,
 * using colors to help quickly identify the status (green for completed, 
 * red for failed, etc.)
 * 
 * @param props.status - The workflow status to display
 */
interface StatusBadgeProps {
  status?: WorkflowStatus;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  // Get the appropriate CSS classes for this status
  const colors = getStatusColors(status);
  
  // If no status or colors, don't render anything
  if (!status || !colors) return null;
  
  return (
    <span className={`${colors.badgeClass} ${colors.bgColor} text-white px-2 py-1 rounded-full text-xs font-medium`}>
      {status}
    </span>
  );
};

export default StatusBadge;