import axios from 'axios';
import { authService } from './auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5800';

// Create axios instance with auth header
const rmtDataApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
rmtDataApi.interceptors.request.use((config) => {
  const token = authService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types for RMT data
export interface DiseaseStatusData {
  id?: number;
  country_id: number;
  FMD: number;
  PPR: number;
  LSD: number;
  RVF: number;
  SPGP: number;
  date: string;
  user_id?: number;
}

export interface MitigationMeasureData {
  id?: number;
  country_id: number;
  FMD: number;
  PPR: number;
  LSD: number;
  RVF: number;
  SPGP: number;
  date: string;
  user_id?: number;
}

export interface ConnectionsData {
  id?: number;
  country_id: number;
  liveAnimalContact: number;
  legalImport: number;
  proximity: number;
  illegalImport: number;
  connection: number;
  livestockDensity: number;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface RMTDataResponse {
  message: string;
  data?: any;
  status: string;
}

export const rmtDataService = {
  // Disease Status Services
  async getDiseaseStatus(userId?: number, countryId?: number): Promise<DiseaseStatusData[]> {
    try {
      const params: any = {};
      if (userId) params.user_id = userId;
      if (countryId) params.country_id = countryId;

      const response = await rmtDataApi.get('/api/rmt-data/disease-status', { params });
      return response.data || [];
    } catch (error: any) {
      console.error('Error getting disease status:', error);
      throw new Error(error.response?.data?.detail || 'Failed to get disease status');
    }
  },

  async saveDiseaseStatus(data: DiseaseStatusData[]): Promise<RMTDataResponse> {
    try {
      const response = await rmtDataApi.post('/api/rmt-data/disease-status', data);
      return response.data;
    } catch (error: any) {
      console.error('Error saving disease status:', error);
      throw new Error(error.response?.data?.detail || 'Failed to save disease status');
    }
  },

  async resetDiseaseStatusToDefault(): Promise<RMTDataResponse> {
    try {
      const response = await rmtDataApi.delete('/api/rmt-data/disease-status');
      return response.data;
    } catch (error: any) {
      console.error('Error resetting disease status:', error);
      throw new Error(error.response?.data?.detail || 'Failed to reset disease status');
    }
  },

  // Mitigation Measures Services
  async getMitigationMeasures(userId?: number, countryId?: number): Promise<MitigationMeasureData[]> {
    try {
      const params: any = {};
      if (userId) params.user_id = userId;
      if (countryId) params.country_id = countryId;

      const response = await rmtDataApi.get('/api/rmt-data/mitigation-measures', { params });
      return response.data || [];
    } catch (error: any) {
      console.error('Error getting mitigation measures:', error);
      throw new Error(error.response?.data?.detail || 'Failed to get mitigation measures');
    }
  },

  async saveMitigationMeasures(data: MitigationMeasureData[]): Promise<RMTDataResponse> {
    try {
      const response = await rmtDataApi.post('/api/rmt-data/mitigation-measures', data);
      return response.data;
    } catch (error: any) {
      console.error('Error saving mitigation measures:', error);
      throw new Error(error.response?.data?.detail || 'Failed to save mitigation measures');
    }
  },

  async resetMitigationMeasuresToDefault(): Promise<RMTDataResponse> {
    try {
      const response = await rmtDataApi.delete('/api/rmt-data/mitigation-measures');
      return response.data;
    } catch (error: any) {
      console.error('Error resetting mitigation measures:', error);
      throw new Error(error.response?.data?.detail || 'Failed to reset mitigation measures');
    }
  },

  // Connections Services
  async getConnections(userId?: number, countryId?: number): Promise<ConnectionsData[]> {
    try {
      const params: any = {};
      if (userId) params.user_id = userId;
      if (countryId) params.country_id = countryId;

      const response = await rmtDataApi.get('/api/rmt-data/connections', { params });
      return response.data || [];
    } catch (error: any) {
      console.error('Error getting connections:', error);
      throw new Error(error.response?.data?.detail || 'Failed to get connections');
    }
  },

  async saveConnections(data: ConnectionsData[]): Promise<RMTDataResponse> {
    try {
      const response = await rmtDataApi.post('/api/rmt-data/connections', data);
      return response.data;
    } catch (error: any) {
      console.error('Error saving connections:', error);
      throw new Error(error.response?.data?.detail || 'Failed to save connections');
    }
  },

  async deleteConnections(): Promise<RMTDataResponse> {
    try {
      const response = await rmtDataApi.delete('/api/rmt-data/connections');
      return response.data;
    } catch (error: any) {
      console.error('Error deleting connections:', error);
      throw new Error(error.response?.data?.detail || 'Failed to delete connections');
    }
  },

  // Utility Functions
  userCanSaveData(user: any): boolean {
    return user && ['admin', 'rmt', 'risp'].includes(user.role);
  },

  // Load all RMT data for a user
  async loadAllRMTData(userId?: number): Promise<{
    diseaseStatus: DiseaseStatusData[];
    mitigationMeasures: MitigationMeasureData[];
    connections: ConnectionsData[];
  }> {
    try {
      const [diseaseStatus, mitigationMeasures, connections] = await Promise.all([
        this.getDiseaseStatus(userId),
        this.getMitigationMeasures(userId),
        this.getConnections(userId)
      ]);

      return {
        diseaseStatus,
        mitigationMeasures,
        connections
      };
    } catch (error: any) {
      console.error('Error loading RMT data:', error);
      throw new Error('Failed to load RMT data');
    }
  },

  // Save all RMT data for a user
  async saveAllRMTData(data: {
    diseaseStatus: DiseaseStatusData[];
    mitigationMeasures: MitigationMeasureData[];
    connections: ConnectionsData[];
  }): Promise<{
    diseaseStatus: RMTDataResponse;
    mitigationMeasures: RMTDataResponse;
    connections: RMTDataResponse;
  }> {
    try {
      const [diseaseStatusResult, mitigationMeasuresResult, connectionsResult] = await Promise.all([
        this.saveDiseaseStatus(data.diseaseStatus),
        this.saveMitigationMeasures(data.mitigationMeasures),
        this.saveConnections(data.connections)
      ]);

      return {
        diseaseStatus: diseaseStatusResult,
        mitigationMeasures: mitigationMeasuresResult,
        connections: connectionsResult
      };
    } catch (error: any) {
      console.error('Error saving RMT data:', error);
      throw new Error('Failed to save RMT data');
    }
  }
};

export default rmtDataService;
