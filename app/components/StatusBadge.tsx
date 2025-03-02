'use client';

import { WorkflowStatus } from '../ts-api/src/api-gen/api';
import { getStatusColors } from './utils';

/**
 * StatusBadge Component - Displays a workflow status with appropriate colors
 * 
 * 🔰 BEGINNER'S GUIDE TO REACT CONCEPTS:
 * 
 * 1. Pure Component Pattern:
 *    This is a "pure" or "presentational" component - it takes input (props)
 *    and returns JSX without managing any internal state or side effects.
 *    - Props in, JSX out - like a pure function
 *    - No useState, useEffect, or other state management
 *    - Easily testable and predictable behavior
 * 
 * 2. Props with TypeScript:
 *    TypeScript enhances props with static typing for better development:
 *    Example: interface StatusBadgeProps { status?: WorkflowStatus; }
 *    - The ? makes status optional - component handles undefined case
 *    - WorkflowStatus is a TypeScript type (likely an enum) for valid values
 *    - Interface clearly communicates what this component needs
 * 
 * 3. Early Return Pattern:
 *    The component uses an early return to handle edge cases cleanly:
 *    Example: if (!status || !colors) return null;
 *    - Avoids nested conditionals or complex ternary expressions
 *    - In React, returning null means "render nothing"
 *    - Checks both status and the result from getStatusColors
 * 
 * 4. Separation of Concerns:
 *    Business logic (color selection) is separated from UI rendering logic:
 *    - getStatusColors() function handles the rules for which status gets what color
 *    - Component only handles the presentation of those colors in a badge
 *    - This separation makes the code more maintainable and testable
 * 
 * 5. Template Literals in JSX:
 *    String interpolation combines multiple class names dynamically:
 *    Example: className={`${colors.badgeClass} ${colors.bgColor} text-white ...`}
 *    - Combines values from the colors object with static class names
 *    - Uses backticks (`) for template literals
 *    - Enables dynamic styling based on component props
 * 
 * 6. Tailwind CSS Utility Classes:
 *    This component uses Tailwind's approach to styling with utility classes:
 *    - text-white, px-2, py-1, rounded-full, etc. define specific CSS properties
 *    - No need for separate CSS files or styled-components
 *    - Classes combined to create the final appearance
 * 
 * COMPONENT BEHAVIOR:
 * This component renders a visually distinct badge for each workflow status,
 * using colors to help quickly identify the status (green for completed, 
 * red for failed, etc.)
 * 
 * DESIGN PATTERN:
 * This follows the "presentational component" pattern - it only handles display
 * without containing any business logic. The color determination is even
 * delegated to a utility function, making this component focused only on 
 * rendering a styled span element.
 * 
 * @param props.status - The workflow status to display
 */
interface StatusBadgeProps {
  status?: WorkflowStatus;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  // Get the appropriate CSS classes for this status
  const colors = getStatusColors(status);
  
  // If no colors (which means status is also missing), don't render anything
  if (!colors) return null;
  
  return (
    <span className={`${colors.badgeClass} ${colors.bgColor} text-white px-2 py-1 rounded-full text-xs font-medium`}>
      {status}
    </span>
  );
};

export default StatusBadge;