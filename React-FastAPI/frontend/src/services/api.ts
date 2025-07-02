import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Create axios instance with base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5800';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Skip auth for RMT endpoints since they don't require authentication
    const isRMTEndpoint = config.url?.includes('/api/rmt/');
    
    if (!isRMTEndpoint) {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['x-access-token'] = token;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Methods
export const apiService = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) =>
      api.post('/api/auth/login', { email, password }),
    
    getProfile: () =>
      api.get('/api/auth/profile'),
    
    logout: () =>
      api.put('/api/auth/logout'),
  },

  // Countries endpoints
  countries: {
    getAll: () =>
      api.get('/api/rmt/countries'),
  },

  // RMT endpoints
  rmt: {
    getEUNeighbours: () =>
      api.get('/api/rmt/eu-neighbours'),
    
    getDiseaseStatus: () =>
      api.get('/api/rmt/disease-status'),
    
    getDiseaseStatusDate: () =>
      api.get('/api/rmt/disease-status-date'),
    
    getDiseaseStatusByCountry: (countryId: number) =>
      api.get(`/api/rmt/disease-status/${countryId}`),
    
    getMitigationMeasures: () =>
      api.get('/api/rmt/mitigation-measures'),
    
    getMitigationMeasuresDate: () =>
      api.get('/api/rmt/mitigation-measures-date'),
    
    getMitigationMeasuresByCountry: (countryId: number) =>
      api.get(`/api/rmt/mitigation-measures/${countryId}`),
  },

  // PCP endpoints
  pcp: {
    getAll: () =>
      api.get('/api/pcp/'),
    
    add: (data: any) =>
      api.post('/api/pcp/add', data),
    
    getUniqueValues: () =>
      api.get('/api/pcp/unique-values'),
    
    delete: (id: number) =>
      api.delete(`/api/pcp/${id}`),
  },

  // Training endpoints
  training: {
    getAll: () =>
      api.get('/api/training/'),
    
    getCompetencies: () =>
      api.get('/api/training/competencies'),
    
    getCourses: () =>
      api.get('/api/training/courses'),
    
    getUserProgress: (userId: number) =>
      api.get(`/api/training/user-progress/${userId}`),
    
    enrollInCourse: (courseId: number) =>
      api.post('/api/training/enroll', { course_id: courseId }),
    
    updateProgress: (courseId: number, progress: number) =>
      api.put('/api/training/progress', { course_id: courseId, progress }),
    
    getUserCertificates: (userId: number) =>
      api.get(`/api/training/certificates/${userId}`),
  },

  // Fast Report endpoints
  fastReport: {
    getAll: () =>
      api.get('/api/fast-report/'),
    
    getByYear: (year: number) =>
      api.get(`/api/fast-report/by-year/${year}`),
    
    getByCountry: (country: string) =>
      api.get(`/api/fast-report/by-country/${country}`),
    
    getByRegion: (region: string) =>
      api.get(`/api/fast-report/by-region/${region}`),
    
    add: (data: any) =>
      api.post('/api/fast-report/add', data),
    
    update: (id: number, data: any) =>
      api.put(`/api/fast-report/${id}`, data),
    
    delete: (id: number) =>
      api.delete(`/api/fast-report/${id}`),
    
    getSummary: () =>
      api.get('/api/fast-report/summary'),
  },

  // Diagnostic Support endpoints
  diagnosticSupport: {
    getAll: () =>
      api.get('/api/diagnostic-support/'),
    
    getLaboratories: () =>
      api.get('/api/diagnostic-support/laboratories'),
    
    getDiagnosticTests: () =>
      api.get('/api/diagnostic-support/diagnostic-tests'),
    
    createRequest: (data: any) =>
      api.post('/api/diagnostic-support/request', data),
  },

  // Emergency Response endpoints
  emergencyResponse: {
    getAll: () =>
      api.get('/api/emergency-response/'),
    
    getProtocols: () =>
      api.get('/api/emergency-response/protocols'),
    
    getContacts: () =>
      api.get('/api/emergency-response/contacts'),
    
    createAlert: (data: any) =>
      api.post('/api/emergency-response/alert', data),
  },

  // Feedback endpoints
  feedback: {
    getAll: () =>
      api.get('/api/feedback/'),
    
    submit: (data: any) =>
      api.post('/api/feedback/submit', data),
    
    getCategories: () =>
      api.get('/api/feedback/categories'),
  },

  // Visits endpoints
  visits: {
    getAll: () =>
      api.get('/api/visits/'),
    
    getUserVisits: (userId: number) =>
      api.get(`/api/visits/user/${userId}`),
    
    schedule: (data: any) =>
      api.post('/api/visits/schedule', data),
    
    updateStatus: (id: number, status: string) =>
      api.put(`/api/visits/${id}/status`, { status }),
  },
};

export default api;
