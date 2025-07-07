// Interfaces for RISP data
export interface OutbreakData {
  id?: number;
  diseaseId: number;
  diseaseName: string;
  country: string;
  numberOutbreaks: number | string;
  selectedSpecies: string[];
  selectedStatus: string[];
  selectedSerotype: string[];
  selectedControlMeasures: string[];
  comments: string;
  year: number;
  quarter: string;
}

export interface SurveillanceData {
  id?: number;
  diseaseName: string;
  country: string;
  passiveSurveillance: string; // "Yes" or "No"
  activeSurveillance: {
    none: boolean;
    clinical: boolean;
    virological: boolean;
    serological: boolean;
  };
  details: string;
  year: number;
  quarter: string;
}

export interface VaccinationCampaign {
  id?: number;
  diseaseId?: number;
  diseaseName: string;
  country: string;
  year: string;
  status: string;
  strategy: string;
  geographicalAreas: string[];
  speciesTargeted: string[];
  coverage: string;
  serotypesIncluded: string[];
  vaccinationRegime: string;
  supplier: string;
  comments: string;
}

// Mock diseases for dropdown
export const diseaseOptions = [
  { id: 1, name: 'FMD' },
  { id: 2, name: 'LSD' },
  { id: 3, name: 'SGP' },
  { id: 4, name: 'PPR' },
  { id: 5, name: 'BEF' },
  { id: 6, name: 'RVF' },
];

// Mock statuses
export const statusOptions = [
  'Confirmed',
  'Suspected',
  'Resolved',
  'Ongoing'
];

// Mock species
export const speciesOptions = [
  'Cattle',
  'Buffalo',
  'Sheep',
  'Goats',
  'Pigs',
  'Wildlife',
  'Other'
];

// Mock serotypes for FMD
export const fmdSerotypes = [
  'O', 
  'A', 
  'Asia1', 
  'SAT1', 
  'SAT2', 
  'SAT3',
  'C',
  'Unknown'
];

// Mock control measures
export const controlMeasures = [
  'Quarantine',
  'Movement restrictions',
  'Vaccination',
  'Treatment',
  'Culling',
  'Disinfection',
  'Surveillance',
  'Public awareness',
  'Other'
];

// Mock vaccination strategies
export const vaccinationStrategies = [
  'Mass vaccination',
  'Risk-based vaccination',
  'Ring vaccination',
  'None'
];

// API calls for RISP data
export const rispService = {
  // Outbreaks
  getOutbreaks: async (year: number, quarter: string, country: string) => {
    // When API is implemented, this would be the actual call:
    // try {
    //   const response = await api.get(`/api/risp/outbreaks?year=${year}&quarter=${quarter}&country=${country}`);
    //   return response;
    // } catch (error) {
    //   console.error('Error fetching outbreaks:', error);
    //   return { data: [] };
    // }
    
    // For now, return mock data
    return { data: [] };
  },
  
  saveOutbreak: async (data: OutbreakData) => {
    try {
      // This would be your actual API call
      // const response = await api.post('/api/risp/outbreaks', data);
      console.log('Saving outbreak data:', data);
      return { success: true };
    } catch (error) {
      console.error('Error saving outbreak:', error);
      return { success: false, error };
    }
  },
  
  // Surveillance
  getSurveillance: async (year: number, quarter: string, country: string) => {
    // When API is implemented, this would be the actual call:
    // try {
    //   const response = await api.get(`/api/risp/surveillance?year=${year}&quarter=${quarter}&country=${country}`);
    //   return response;
    // } catch (error) {
    //   console.error('Error fetching surveillance data:', error);
    //   return { data: [] };
    // }
    
    // For now, return mock data
    return { data: [] };
  },
  
  saveSurveillance: async (data: SurveillanceData) => {
    try {
      // This would be your actual API call when API is ready
      // const response = await api.post('/api/risp/surveillance', data);
      console.log('Saving surveillance data:', data);
      return { success: true };
    } catch (error) {
      // This code will be executed when API is implemented
      console.error('Error saving surveillance data:', error);
      return { success: false, error: String(error) };
    }
  },
  
  // Vaccination
  getVaccinations: async (country: string) => {
    // When API is implemented, this would be the actual call:
    // try {
    //   const response = await api.get(`/api/risp/vaccinations?country=${country}`);
    //   return response;
    // } catch (error) {
    //   console.error('Error fetching vaccination data:', error);
    //   return { data: [] };
    // }
    
    // For now, return mock data
    return { data: [] };
  },
  
  saveVaccination: async (data: VaccinationCampaign) => {
    try {
      // This would be your actual API call when API is ready
      // const response = await api.post('/api/risp/vaccinations', data);
      console.log('Saving vaccination data:', data);
      return { success: true };
    } catch (error) {
      // This code will be executed when API is implemented
      console.error('Error saving vaccination data:', error);
      return { success: false, error: String(error) };
    }
  }
};

export default rispService;
