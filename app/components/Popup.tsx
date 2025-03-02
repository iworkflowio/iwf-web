'use client';

/**
 * Popup component - A flexible modal dialog box
 * 
 * This component creates a modal overlay with a white box centered on the screen.
 * It's used throughout the application to display details, edit forms, and other
 * information that needs to be prominently shown to the user.
 * 
 * Features:
 * - Dark semi-transparent backdrop
 * - Centered white card with a header and content area
 * - Close button in the top right
 * - Scrollable content area if content is large
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