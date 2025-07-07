import { calculateConnectionScoresPerPathway } from './calculateConnectionScoresPerPathway';
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

// Define disease type
type Disease = 'FMD' | 'PPR' | 'LSD' | 'RVF' | 'SPGP';

// Define pathway type
type PathwayKey = 'airborne' | 'vectorborne' | 'wildAnimals' | 'animalProduct' | 'liveAnimal' | 'fomite';

// Pathways constants from 'pathways' tab
const PATHWAYS: {
  [key in PathwayKey]: { [key in Disease]: number };
} = {
  airborne: { FMD: 2, PPR: 0, LSD: 1, RVF: 0, SPGP: 1 },
  vectorborne: { FMD: 0, PPR: 0, LSD: 3, RVF: 3, SPGP: 2 },
  wildAnimals: { FMD: 1, PPR: 2, LSD: 0, RVF: 2, SPGP: 0 },
  animalProduct: { FMD: 2, PPR: 1, LSD: 1, RVF: 1, SPGP: 1 },
  liveAnimal: { FMD: 3, PPR: 3, LSD: 1, RVF: 3, SPGP: 3 },
  fomite: { FMD: 2, PPR: 1, LSD: 1, RVF: 0, SPGP: 1 },
};
