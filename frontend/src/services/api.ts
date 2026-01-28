import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Create axios instance with base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5800';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,  // 60 seconds for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Set token in both header formats for compatibility
      config.headers['x-access-token'] = token;  // Express backend format
      config.headers['Authorization'] = `Bearer ${token}`;  // FastAPI format
    }
    
    // Don't set Content-Type for FormData - let browser handle it
    if (config.data instanceof FormData) {
      // Remove the default application/json header
      delete config.headers['Content-Type'];
      // Explicitly tell axios not to set any Content-Type
      config.headers['Content-Type'] = undefined;
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
      // Only auto-redirect for non-upload endpoints
      // File upload errors should be handled by the component
      if (!error.config?.url?.includes('/upload-data')) {
        // Clear token and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('auth');
        window.location.href = '/login';
      }
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
    
    getById: (id: number) =>
      api.get(`/api/rmt/countries/${id}`),
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
    
    postDiseaseStatus: (data: any) =>
      api.post('/api/rmt/disease-status', data),
    
    getMitigationMeasures: () =>
      api.get('/api/rmt/mitigation-measures'),
    
    getMitigationMeasuresDate: () =>
      api.get('/api/rmt/mitigation-measures-date'),
    
    getMitigationMeasuresByCountry: (countryId: number) =>
      api.get(`/api/rmt/mitigation-measures/${countryId}`),
    
    postMitigationMeasures: (data: any) =>
      api.post('/api/rmt/mitigation-measures', data),
    
    getConnections: () =>
      api.get('/api/rmt-data/connections'),
    
    postConnections: (data: any) =>
      api.post('/api/rmt-data/connections', data),
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

    // Non-Moodle Courses endpoints
    addNMCourse: (courseData: any) =>
      api.post('/api/training/add', courseData),
    
    getAllNMCourses: () =>
      api.get('/api/training/getAllNMCourses'),
    
    getNMCourses: () =>
      api.get('/api/training/getNMCourses'),

    // Non-Moodle Enrollments endpoints
    addNMEnrolment: (enrollmentData: any) =>
      api.post('/api/training/addEnrolment', enrollmentData),
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

  // RISP endpoints
  risp: {
    // Get RISP data by type, year, and quarter
    getRISP: ({ type, year, quarter }: { type: string; year: string; quarter: string }) =>
      api.get(`/api/risp/${type}?year=${year}&quarter=${quarter}`),

    // Get outbreaks data specifically
    getOutbreaks: (year: number, quarter: string) =>
      api.get(`/api/risp/outbreaks?year=${year}&quarter=${quarter}`),

    // Add RISP data
    addRISP: (formData: any) =>
      api.post(`/api/risp/${formData.type}`, formData),    // Vaccination campaigns specific methods
    getRISPVaccinations: (year: string) =>
      api.get(`/api/risp/vaccinations?year=${year}`),
    
    addRISPVaccination: (formData: any) =>
      api.post('/api/risp/vaccinations', formData),
    
    updateRISPVaccination: (id: number, formData: any) =>
      api.put(`/api/risp/vaccinations/${id}`, formData),
    
    deleteRISPVaccination: (id: number) =>
      api.delete(`/api/risp/vaccinations/${id}`),
  },

  // THRACE endpoints
  thrace: {
    uploadData: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('uploadData FormData created:', {
        hasFile: formData.has('file'),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      console.log('Sending POST request to /api/thrace/upload-data with FormData');
      
      return api.post('/api/thrace/upload-data', formData, {
        // Explicitly tell axios not to set Content-Type so browser will use multipart boundary
        transformRequest: [(data) => data]
      });
    },
    
    getStagingSummary: () =>
      api.get('/api/thrace/staging-summary'),
    
    approveData: () =>
      api.post('/api/thrace/approve-data', {}),
    
    getInspectors: () =>
      api.get('/api/thrace/inspectors'),
    
    getCycleReport: (countryId: number, year: number, quarter: number) =>
      api.get('/api/thrace/cycle-report', {
        params: { country_id: countryId, year, quarter }
      }),

    getFreedomData: (species: string, disease: string, region: string, refreshSummary = false) =>
      api.get('/api/thrace/freedom-data', {
        params: { species, disease, region, refresh_summary: refreshSummary }
      }),
  },
};

export default api;
