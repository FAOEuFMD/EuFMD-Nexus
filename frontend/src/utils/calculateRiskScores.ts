import { calculateConnectionScoresPerPathway } from './calculateConnectionScoresPerPathway';
import { PATHWAYS_EFFECTIVENESS, Disease } from './pathwaysConfig';
import { calculateRiskPerDisease } from './calculateRiskPerDisease';

interface Connections {
  liveAnimalContact: number;
  legalImport: number;
  proximity: number;
  illegalImport: number;
  connection: number;
  livestockDensity: number;
}

interface DiseaseStatus {
  dFMD: number | null;
  dPPR: number | null;
  dLSD: number | null;
  dRVF: number | null;
  dSPGP: number | null;
  country_id?: number;
  country_name?: string;
}

interface MitigationMeasures {
  mFMD: number | null;
  mPPR: number | null;
  mLSD: number | null;
  mRVF: number | null;
  mSPGP: number | null;
  country_id?: number;
  country_name?: string;
}

interface RiskScoreResult {
  sourceCountry: string;
  sourceCountryId: number;
  disease: string;
  riskScore: number;
  diseaseRisk: number;
  pathwayScore: number;
  connectionStrength: number;
}

/**
 * Calculate the risk scores for all combinations of source countries and diseases
 * based on the selected connections, disease status, and mitigation measures
 */
export function calculateRiskScores({
  connections,
  diseaseStatus,
  mitigationMeasures,
  sourceCountries
}: {
  connections: Connections;
  diseaseStatus: Record<number, DiseaseStatus>;
  mitigationMeasures: Record<number, MitigationMeasures>;
  sourceCountries: Array<{ id: number; name_un: string }>;
}): RiskScoreResult[] {
  // Calculate connection scores per pathway
  const connectionScores = calculateConnectionScoresPerPathway(connections);
  
  // Calculate the sum of all connection strength for normalization
  const totalConnectionStrength = 
    connectionScores.airborne + 
    connectionScores.vectorborne + 
    connectionScores.wildAnimals + 
    connectionScores.animalProduct + 
    connectionScores.liveAnimal + 
    connectionScores.fomite;
  
  const results: RiskScoreResult[] = [];
  const diseases: Disease[] = ["FMD", "PPR", "LSD", "RVF", "SPGP"];
  
  // For each source country
  sourceCountries.forEach(country => {
    const countryId = country.id;
    const countryName = country.name_un;
    
    // Skip if no disease status or mitigation measures data for this country
    if (!diseaseStatus[countryId] || !mitigationMeasures[countryId]) {
      return;
    }
    
    // Calculate risk per disease for this country
    const riskScores = calculateRiskPerDisease(
      connectionScores,
      diseaseStatus[countryId],
      mitigationMeasures[countryId]
    );
    
    // Format the results
    diseases.forEach(disease => {
      // Include all scores including zero scores
      
      // Get disease risk value
      const diseaseKey = `d${disease}` as keyof DiseaseStatus;
      const diseaseRisk = (diseaseStatus[countryId][diseaseKey] as number) || 0;
      
      // Mitigation measures are already used in the calculateRiskPerDisease function
      
      // Calculate normalized pathway score for this disease
      let pathwayScore = 0;
      if (totalConnectionStrength > 0) {
        pathwayScore = (
          (PATHWAYS.airborne[disease] * connectionScores.airborne) +
          (PATHWAYS.vectorborne[disease] * connectionScores.vectorborne) +
          (PATHWAYS.wildAnimals[disease] * connectionScores.wildAnimals) +
          (PATHWAYS.animalProduct[disease] * connectionScores.animalProduct) +
          (PATHWAYS.liveAnimal[disease] * connectionScores.liveAnimal) +
          (PATHWAYS.fomite[disease] * connectionScores.fomite)
        );
      }
      
      results.push({
        sourceCountry: countryName,
        sourceCountryId: countryId,
        disease,
        riskScore: riskScores[disease],
        diseaseRisk,
        pathwayScore,
        connectionStrength: totalConnectionStrength
      });
    });
  });
  
  // Sort by risk score (highest first)
  return results.sort((a, b) => b.riskScore - a.riskScore);
}

// Use PATHWAYS_EFFECTIVENESS from centralized config
const PATHWAYS = PATHWAYS_EFFECTIVENESS;
