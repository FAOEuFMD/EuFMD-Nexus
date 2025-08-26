import { apiService } from '../api';

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
    [key: string]: boolean;  // Add index signature for TypeScript
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

// Mock diseases for dropdown - matching Vue exactly
export const diseaseOptions = [
  { id: 1, name: 'Foot-and-Mouth Disease - FMD' },
  { id: 2, name: 'Lumpy Skin Disease - LSD' },
  { id: 3, name: 'Peste Des Petits Ruminants - PPR' },
  { id: 4, name: 'Sheep Pox And Goat Pox - SPGP' },
  { id: 5, name: 'Rift Valley Fever - RVF' },
];

// Mock statuses - matching Vue exactly
export const statusOptions = [
  'Laboratory confirmed',
  'Clinically confirmed',
  'Suspected case',
];

// Mock species - hierarchical structure
export const speciesOptions = [
  'Cattle', 
  'Buffalo', 
  'Sheep', 
  'Goats',
  'Pigs', 
  'Wildlife',
  'Information not available'
];

// Hierarchical species structure for selection
export const hierarchicalSpeciesOptions = {
  'Large ruminants': ['Cattle', 'Buffalo'],
  'Small ruminants': ['Goats', 'Sheep']
};

// Single species options (no grouping needed)
export const singleSpeciesOptions = [
  'Pigs',
  'Wildlife', 
  'Information not available'
];

// Mock serotypes for FMD - matching Vue exactly
export const fmdSerotypes = [
  'O', 
  'A', 
  'C', 
  'Asia 1', 
  'SAT 1', 
  'SAT 2', 
  'SAT 3', 
  'unknown'
];

// Mock control measures - matching Vue exactly
export const controlMeasures = [
  'Ring Vaccination', 
  'Restriction of movements', 
  'Markets closure', 
  'Stamping out', 
  'Awareness raising campaigns', 
  'None', 
  'Other'
];

// Location options - matching Vue exactly
export const locationOptions = [
  'Within 50km from the border', 
  'Far from the border', 
  'Specify region'
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
    try {
      const response = await apiService.risp.getOutbreaks(year, quarter);
      return { data: response.data };
    } catch (error) {
      console.error('Error fetching outbreaks:', error);
      return { data: [] };
    }
  },
  
  saveOutbreak: async (data: OutbreakData) => {
    try {
      const formData = {
        type: "outbreak",
        year: data.year,
        quarter: data.quarter,
        diseases: [{
          disease: data.diseaseName,
          number_outbreaks: data.numberOutbreaks,
          species: data.selectedSpecies,
          status: data.selectedStatus,
          serotype: data.selectedSerotype,
          control_measures: data.selectedControlMeasures,
          comments: data.comments
        }]
      };

      const response = await apiService.risp.addRISP(formData);
      console.log('Outbreak data saved successfully:', response.data);
      return { success: true };
    } catch (error) {
      console.error('Error saving outbreak:', error);
      return { success: false, error };
    }
  },
  
  // Surveillance
  getSurveillance: async (year: number, quarter: string, country: string) => {
    try {
      const response = await apiService.risp.getRISP({ 
        type: "surveillance", 
        year: year.toString(), 
        quarter 
      });
      return { data: response.data };
    } catch (error) {
      console.error('Error fetching surveillance data:', error);
      return { data: [] };
    }
  },
  
  saveSurveillance: async (data: SurveillanceData) => {
    try {
      const formData = {
        type: "surveillance",
        year: data.year,
        quarter: data.quarter,
        diseases: [{
          disease: data.diseaseName.toUpperCase(),
          passive_surveillance: data.passiveSurveillance === 'Yes',
          active_surveillance: Object.keys(data.activeSurveillance)
            .filter(key => data.activeSurveillance[key]),
          details: data.details || ''
        }]
      };

      const response = await apiService.risp.addRISP(formData);
      console.log('Surveillance data saved successfully:', response.data);
      return { success: true };
    } catch (error) {
      console.error('Error saving surveillance data:', error);
      return { success: false, error: String(error) };
    }
  },
  
  // Vaccination
  getVaccinations: async (year: string) => {
    try {
      const response = await apiService.risp.getRISPVaccinations(year);
      return { data: response.data };
    } catch (error) {
      console.error('Error fetching vaccination data:', error);
      return { data: [] };
    }
  },
  
  saveVaccination: async (data: VaccinationCampaign) => {
    try {
      const response = await apiService.risp.addRISPVaccination(data);
      console.log('Vaccination data saved successfully:', response.data);
      return { success: true };
    } catch (error) {
      console.error('Error saving vaccination data:', error);
      return { success: false, error: String(error) };
    }
  },

  updateVaccination: async (id: number, data: VaccinationCampaign) => {
    try {
      const response = await apiService.risp.updateRISPVaccination(id, data);
      console.log('Vaccination data updated successfully:', response.data);
      return { success: true };
    } catch (error) {
      console.error('Error updating vaccination data:', error);
      return { success: false, error: String(error) };
    }
  },

  deleteVaccination: async (id: number) => {
    try {
      const response = await apiService.risp.deleteRISPVaccination(id);
      console.log('Vaccination campaign deleted successfully:', response.data);
      return { success: true };
    } catch (error) {
      console.error('Error deleting vaccination campaign:', error);
      return { success: false, error: String(error) };
    }
  }
};

export default rispService;
