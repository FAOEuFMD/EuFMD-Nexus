import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { rmtDataService, DiseaseStatusData, MitigationMeasureData, ConnectionsData } from '../services/rmtDataService';

export interface RMTDataState {
  diseaseStatus: DiseaseStatusData[];
  mitigationMeasures: MitigationMeasureData[];
  connections: ConnectionsData[];
  isLoading: boolean;
  error: string | null;
  isUserData: boolean; // Indicates if user has saved custom data
  hasUnsavedChanges: boolean;
}

export const useRMTData = () => {
  const { user } = useAuthStore();
  
  const [state, setState] = useState<RMTDataState>({
    diseaseStatus: [],
    mitigationMeasures: [],
    connections: [],
    isLoading: false,
    error: null,
    isUserData: false,
    hasUnsavedChanges: false,
  });

  // Check if user can save data
  const canSaveData = rmtDataService.userCanSaveData(user);

  // Load RMT data (user-specific or default)
  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const userId = canSaveData ? user?.id : undefined;
      const data = await rmtDataService.loadAllRMTData(userId);
      
      // Check if user has custom data (any data with user_id)
      const hasUserData = [
        ...data.diseaseStatus,
        ...data.mitigationMeasures,
        ...data.connections
      ].some(item => item.user_id === user?.id);

      setState(prev => ({
        ...prev,
        diseaseStatus: data.diseaseStatus,
        mitigationMeasures: data.mitigationMeasures,
        connections: data.connections,
        isLoading: false,
        isUserData: hasUserData,
        hasUnsavedChanges: false,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [user?.id, canSaveData]);

  // Save all RMT data
  const saveData = useCallback(async () => {
    if (!canSaveData) {
      throw new Error('User does not have permission to save data');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const dataToSave = {
        diseaseStatus: state.diseaseStatus.map(item => ({ ...item, user_id: user?.id })),
        mitigationMeasures: state.mitigationMeasures.map(item => ({ ...item, user_id: user?.id })),
        connections: state.connections.map(item => ({ ...item, user_id: user?.id })),
      };

      await rmtDataService.saveAllRMTData(dataToSave);

      setState(prev => ({
        ...prev,
        isLoading: false,
        isUserData: true,
        hasUnsavedChanges: false,
      }));

      return { success: true, message: 'Data saved successfully' };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
      throw error;
    }
  }, [state.diseaseStatus, state.mitigationMeasures, state.connections, user?.id, canSaveData]);

  // Reset to default data
  const resetToDefault = useCallback(async () => {
    if (!canSaveData) {
      throw new Error('User does not have permission to modify data');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await Promise.all([
        rmtDataService.resetDiseaseStatusToDefault(),
        rmtDataService.resetMitigationMeasuresToDefault(),
        rmtDataService.deleteConnections(),
      ]);

      // Reload default data
      await loadData();

      return { success: true, message: 'Data reset to default successfully' };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
      throw error;
    }
  }, [canSaveData, loadData]);

  // Update disease status
  const updateDiseaseStatus = useCallback((newData: DiseaseStatusData[]) => {
    setState(prev => ({
      ...prev,
      diseaseStatus: newData,
      hasUnsavedChanges: true,
    }));
  }, []);

  // Update mitigation measures
  const updateMitigationMeasures = useCallback((newData: MitigationMeasureData[]) => {
    setState(prev => ({
      ...prev,
      mitigationMeasures: newData,
      hasUnsavedChanges: true,
    }));
  }, []);

  // Update connections
  const updateConnections = useCallback((newData: ConnectionsData[]) => {
    setState(prev => ({
      ...prev,
      connections: newData,
      hasUnsavedChanges: true,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Load data on mount and when user changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    // State
    ...state,
    canSaveData,
    
    // Actions
    loadData,
    saveData,
    resetToDefault,
    updateDiseaseStatus,
    updateMitigationMeasures,
    updateConnections,
    clearError,
  };
};

export default useRMTData;
