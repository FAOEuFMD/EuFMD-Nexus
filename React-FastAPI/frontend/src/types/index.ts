// User and Authentication Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  country?: string;
  organization?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  country?: string;
  organization?: string;
}

// Country and Region Types
export interface Country {
  id: number;
  iso3: string;
  name_un: string;
  subregion: string;
}

export interface Region {
  id: number;
  name: string;
  countries: Country[];
}

// RMT (Risk Management Tool) Types
export interface RiskScore {
  id: number;
  countryId: number;
  diseaseId: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  score: number;
  factors: RiskFactor[];
  lastUpdated: string;
}

export interface RiskFactor {
  id: number;
  name: string;
  weight: number;
  value: number;
  description: string;
}

export interface MitigationMeasure {
  id: number;
  name: string;
  description: string;
  category: string;
  effectiveness: number;
  cost: number;
  implementation_time: number;
}

// PCP (Progressive Control Pathway) Types
export interface PCPStage {
  id: number;
  stage: number;
  name: string;
  description: string;
  requirements: string[];
}

export interface PCPStatus {
  id: number;
  countryId: number;
  currentStage: number;
  targetStage: number;
  progress: number;
  lastAssessment: string;
  nextReview: string;
}

// Training Types
export interface Course {
  id: number;
  title: string;
  description: string;
  category: string;
  duration: number;
  capacity: number;
  startDate: string;
  endDate: string;
  location: string;
  instructor: string;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
}

export interface Enrollment {
  id: number;
  courseId: number;
  userId: number;
  status: 'enrolled' | 'completed' | 'dropped' | 'waitlist';
  enrollmentDate: string;
  completionDate?: string;
  grade?: number;
}

export interface TrainingData {
  id: number;
  courseId: number;
  participantCount: number;
  completionRate: number;
  averageGrade: number;
  feedback: TrainingFeedback[];
}

export interface TrainingFeedback {
  id: number;
  rating: number;
  comment: string;
  category: string;
}

// Diagnostic Support Types
export interface DiagnosticTest {
  id: number;
  name: string;
  type: string;
  sampleType: string;
  sensitivity: number;
  specificity: number;
  costPerTest: number;
  timeToResult: number;
}

export interface Laboratory {
  id: number;
  name: string;
  countryId: number;
  address: string;
  contact: string;
  capabilities: string[];
  certifications: string[];
  status: 'active' | 'inactive' | 'pending';
}

// Emergency Response Types
export interface EmergencyResponse {
  id: number;
  countryId: number;
  type: 'outbreak' | 'surveillance' | 'vaccination' | 'other';
  status: 'active' | 'resolved' | 'monitoring';
  severity: 'low' | 'medium' | 'high' | 'critical';
  startDate: string;
  endDate?: string;
  description: string;
  actions: EmergencyAction[];
}

export interface EmergencyAction {
  id: number;
  type: string;
  description: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: string;
  assignedTo: string;
}

// Fast Report Types
export interface FastReport {
  id: number;
  countryId: number;
  reportType: string;
  status: 'draft' | 'submitted' | 'reviewed' | 'approved';
  submissionDate: string;
  reviewDate?: string;
  data: Record<string, any>;
  attachments: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Form Types
export interface FormErrors {
  [key: string]: string[];
}

export interface SelectOption {
  value: string | number;
  label: string;
}

// Dashboard Types
export interface DashboardStats {
  totalCountries: number;
  activeOutbreaks: number;
  riskAssessments: number;
  trainingSessions: number;
  diagnosticTests: number;
}

// Map Types
export interface MapData {
  countryId: number;
  iso3: string;
  name: string;
  value: number;
  color: string;
  coordinates: [number, number];
}

// Chart Types
export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

// All types are already exported with their interface declarations
