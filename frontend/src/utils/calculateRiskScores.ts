import { calculateConnectionScoresPerPathway } from './calculateConnectionScoresPerPathway';
import { PATHWAYS_EFFECTIVENESS, Disease } from './pathwaysConfig';

export interface Connections {
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
  connections: Record<number, Connections>;
  diseaseStatus: Record<number, DiseaseStatus>;
  mitigationMeasures: Record<number, MitigationMeasures>;
  sourceCountries: Array<{ id: number; name_un: string }>;
}): RiskScoreResult[] {
  const results: RiskScoreResult[] = [];
  const diseases: Disease[] = ["FMD", "PPR", "LSD", "RVF", "SPGP"];

  // For each source country
  sourceCountries.forEach(country => {
    const countryId = country.id;
    const countryName = country.name_un;

    // Skip if no disease status, mitigation measures, or connections data for this country
    if (!diseaseStatus[countryId] || !mitigationMeasures[countryId] || !connections[countryId]) {
      return;
    }

    // Prepare data structure like Vue app expects, using this country's specific connections
    const countryData = {
      connections: connections[countryId], // Use country-specific connections
      diseaseStatus: {
        FMD: diseaseStatus[countryId].dFMD,
        PPR: diseaseStatus[countryId].dPPR,
        LSD: diseaseStatus[countryId].dLSD,
        RVF: diseaseStatus[countryId].dRVF,
        SPGP: diseaseStatus[countryId].dSPGP,
      },
      mitigationMeasures: {
        FMD: mitigationMeasures[countryId].mFMD,
        PPR: mitigationMeasures[countryId].mPPR,
        LSD: mitigationMeasures[countryId].mLSD,
        RVF: mitigationMeasures[countryId].mRVF,
        SPGP: mitigationMeasures[countryId].mSPGP,
      }
    };

    // Calculate connection scores per pathway
    const connectionScores = calculateConnectionScoresPerPathway(countryData.connections);

    // Check if all connection input values are 0 (meaning no connections for this country)
    const allConnectionsZero = 
      countryData.connections.liveAnimalContact === 0 &&
      countryData.connections.legalImport === 0 &&
      countryData.connections.proximity === 0 &&
      countryData.connections.illegalImport === 0 &&
      countryData.connections.connection === 0 &&
      countryData.connections.livestockDensity === 0;

    // Calculate risk per disease for this country using Vue app logic
    const riskScores: Record<string, number> = {};
    diseases.forEach(disease => {
      const diseaseValue = countryData.diseaseStatus[disease];
      
      // If disease status is 0 or null, or all connections are 0, return 0 risk
      if (diseaseValue === 0 || diseaseValue === null || allConnectionsZero) {
        riskScores[disease] = 0;
        return;
      }
      
      // Get mitigation value or default to 0 if null
      const mitigationValue = countryData.mitigationMeasures[disease] === null ? 0 : countryData.mitigationMeasures[disease] as number;
      
      // Calculate risk score using Vue app formula
      riskScores[disease] = (
        (diseaseValue + (4 - mitigationValue)) *
        (
          (PATHWAYS.airborne[disease] * connectionScores.airborne) +
          (PATHWAYS.vectorborne[disease] * connectionScores.vectorborne) +
          (PATHWAYS.wildAnimals[disease] * connectionScores.wildAnimals) +
          (PATHWAYS.animalProduct[disease] * connectionScores.animalProduct) +
          (PATHWAYS.liveAnimal[disease] * connectionScores.liveAnimal) +
          (PATHWAYS.fomite[disease] * connectionScores.fomite)
        )
      );
    });

    // Calculate the sum of all connection strength for display
    const totalConnectionStrength =
      connectionScores.airborne +
      connectionScores.vectorborne +
      connectionScores.wildAnimals +
      connectionScores.animalProduct +
      connectionScores.liveAnimal +
      connectionScores.fomite;

    // Format the results
    diseases.forEach(disease => {
      // Get disease risk value
      const diseaseRisk = countryData.diseaseStatus[disease] || 0;

      // Calculate pathway score for this disease
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
