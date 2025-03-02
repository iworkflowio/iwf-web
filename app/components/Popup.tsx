'use client';

/**
 * Popup component - A flexible modal dialog box
 * 
 * 🔰 BEGINNER'S GUIDE TO REACT CONCEPTS:
 * 
 * 1. React.ReactNode as a Prop Type:
 *    The content prop accepts React.ReactNode, which means it can take any valid React content:
 *    - JSX elements like <div>, <p>, etc.
 *    - Plain strings or numbers
 *    - Arrays of JSX elements
 *    - Other React components
 *    - null, undefined, or boolean values
 *    This flexibility allows the Popup to display virtually any content.
 * 
 * 2. Named Function Component:
 *    This component uses the named function declaration syntax:
 *    Example: function Popup({ title, content, onClose }: PopupProps) { ... }
 *    - Alternative to arrow function syntax (const Popup = () => { ... })
 *    - Both approaches work the same, but named function can be more readable
 *    - React DevTools will display the component name automatically
 * 
 * 3. Dual Styling Approaches:
 *    This component demonstrates two ways to style elements in React:
 *    Example: className="fixed inset-0..." AND style={{ position: 'fixed', top: 0... }}
 *    - className uses Tailwind CSS's utility classes (declarative approach)
 *    - style prop uses inline JavaScript objects (imperative approach)
 *    - Both are shown for educational purposes, but typically you'd choose one
 * 
 * 4. JSX Comments:
 *    Special comment syntax inside JSX:
 *    Example: {/* Header with title and close button *\/}
 *    - JSX comments must be wrapped in curly braces
 *    - Uses JavaScript's multi-line comment syntax
 *    - Helps document the structure of complex components
 * 
 * 5. Event Handler Pattern:
 *    Simple onClick event handler with prop function:
 *    Example: onClick={onClose}
 *    - Passes the onClose function directly (no anonymous wrapper needed)
 *    - This pattern works when no additional logic or parameters are needed
 *    - For more complex handlers, you'd use: onClick={() => { onClose(); }}
 * 
 * 6. Portal-like Pattern:
 *    While not using React.createPortal(), this component follows a similar pattern:
 *    - Creates a full-screen overlay (fixed position, inset-0)
 *    - Renders on top of other content (z-50)
 *    - Often modals use portals to render outside the normal DOM hierarchy
 *    - In Next.js, this component renders in place since it uses 'use client' directive
 * 
 * 7. Common UI Pattern - Modal:
 *    This implements the standard modal/dialog pattern:
 *    - Backdrop overlay to focus attention and block interaction with content behind
 *    - Centered content box with title and close button
 *    - Scrollable content area for variable-length content
 *    - Clear visual hierarchy and consistent styling
 * 
 * COMPONENT BEHAVIOR:
 * This component creates a modal overlay with a white box centered on the screen.
 * It's used throughout the application to display details, edit forms, and other
 * information that needs to be prominently shown to the user.
 * 
 * Features:
 * - Dark semi-transparent backdrop that covers the entire screen
 * - Centered white card with a header and content area
 * - Close button in the top right corner
 * - Scrollable content area if content is too large
 * - Consistent styling across all modals in the application
 * 
 * @param props.title - The title displayed in the header of the popup
 * @param props.content - React component or JSX to display in the popup body
 * @param props.onClose - Function called when the close button is clicked
 */
interface PopupProps {
  title: string;
  content: React.ReactNode;
  onClose: () => void;
}

function Popup({ title, content, onClose }: PopupProps) {
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
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl" 
        style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.5rem', 
          padding: '1.5rem', 
          width: '100%', 
          maxWidth: '42rem' 
        }}
      >
        {/* Header with title and close button */}
        <div 
          className="flex justify-between items-center mb-4" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1rem' 
          }}
        >
          <h3 className="text-lg font-bold">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            style={{ color: '#6b7280' }}
          >
            ✕
          </button>
        </div>
        
        {/* Content area with scroll if needed */}
        <div 
          className="max-h-96 overflow-y-auto" 
          style={{ maxHeight: '24rem', overflowY: 'auto' }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

export default Popup;