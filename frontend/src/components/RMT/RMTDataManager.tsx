import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faUndo, faDatabase, faUser, faExclamationTriangle, faCheckCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '../../stores/authStore';
import { useRMTData } from '../../hooks/useRMTData';

interface RMTDataManagerProps {
  className?: string;
  onDataChange?: (hasChanges: boolean) => void;
}

const RMTDataManager: React.FC<RMTDataManagerProps> = ({ 
  className = '', 
  onDataChange 
}) => {
  const { user } = useAuthStore();
  const {
    isUserData,
    hasUnsavedChanges,
    canSaveData,
    isLoading,
    error,
    saveData,
    resetToDefault,
    clearError
  } = useRMTData();

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Notify parent of changes
  React.useEffect(() => {
    onDataChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDataChange]);

  const handleSaveData = async () => {
    try {
      await saveData();
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error: any) {
      console.error('Error saving data:', error);
      // Error is handled by the hook
    }
  };

  const handleResetToDefault = async () => {
    if (window.confirm('Are you sure you want to reset all your data to default? This action cannot be undone.')) {
      try {
        await resetToDefault();
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } catch (error: any) {
        console.error('Error resetting data:', error);
        // Error is handled by the hook
      }
    }
  };

  if (!canSaveData) {
    return null; // Don't show for users who can't save data
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faDatabase} className="text-green-greenMain" />
          <h3 className="text-lg font-semibold text-gray-900">RMT Data Management</h3>
        </div>
        
        {/* Data Status Indicator */}
        <div className="flex items-center gap-2">
          {isUserData ? (
            <div className="flex items-center gap-1 text-sm text-green-greenMain">
              <FontAwesomeIcon icon={faUser} />
              <span>Using your saved data</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <FontAwesomeIcon icon={faDatabase} />
              <span>Using default data</span>
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <div className="text-sm text-gray-600">
          <strong>User:</strong> {user?.email} ({user?.role})
        </div>
        {user?.country && (
          <div className="text-sm text-gray-600">
            <strong>Country:</strong> {user.country}
          </div>
        )}
      </div>

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md flex items-center gap-2">
          <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
          <span className="text-sm text-green-700">Data operation completed successfully!</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 hover:text-red-800"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md flex items-center gap-2">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600" />
          <span className="text-sm text-yellow-700">
            You have unsaved changes. Don't forget to save your data before leaving.
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveData}
          disabled={isLoading || !hasUnsavedChanges}
          className="flex items-center gap-2 px-4 py-2 bg-green-greenMain hover:bg-green-greenMain2 disabled:bg-gray-300 text-white rounded-md transition-colors disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faSave} />
          {isLoading ? 'Saving...' : 'Save Data'}
        </button>

        {isUserData && (
          <button
            onClick={handleResetToDefault}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-md transition-colors disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faUndo} />
            Reset to Default
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          <strong>Save Data:</strong> Store your custom disease status, mitigation measures, and connections data.
        </p>
        {isUserData && (
          <p className="mt-1">
            <strong>Reset to Default:</strong> Delete your custom data and use the default system data.
          </p>
        )}
      </div>
    </div>
  );
};

export default RMTDataManager;
