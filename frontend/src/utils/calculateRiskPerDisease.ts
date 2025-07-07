// Pathways constants from 'pathways' tab
const PATHWAYS = {
  airborne: { FMD: 2, PPR: 0, LSD: 1, RVF: 0, SPGP: 1 },
  vectorborne: { FMD: 0, PPR: 0, LSD: 3, RVF: 3, SPGP: 2 },
  wildAnimals: { FMD: 1, PPR: 2, LSD: 0, RVF: 2, SPGP: 0 },
  animalProduct: { FMD: 2, PPR: 1, LSD: 1, RVF: 1, SPGP: 1 },
  liveAnimal: { FMD: 3, PPR: 3, LSD: 1, RVF: 3, SPGP: 3 },
  fomite: { FMD: 2, PPR: 1, LSD: 1, RVF: 0, SPGP: 1 },
};

interface PathwayScores {
  airborne: number;
  vectorborne: number;
  wildAnimals: number;
  animalProduct: number;
  liveAnimal: number;
  fomite: number;
}

interface DiseaseStatus {
  dFMD: number | null;
  dPPR: number | null;
  dLSD: number | null;
  dRVF: number | null;
  dSPGP: number | null;
}

interface MitigationMeasures {
  mFMD: number | null;
  mPPR: number | null;
  mLSD: number | null;
  mRVF: number | null;
  mSPGP: number | null;
}

type Disease = 'FMD' | 'PPR' | 'LSD' | 'RVF' | 'SPGP';

interface RiskScores {
  [key: string]: number;
}

/**
 * This function returns the risk scores per disease.
 * The diseases are FMD, PPR, LSD, RVF and SPGP.
 * The logic of the calculations comes from the
 * scores tab at the RMT_FAST_EuFmd_Clean_rv20231017 Excel file.
 */
export function calculateRiskPerDisease(
  connectionScores: PathwayScores,
  diseaseStatus: DiseaseStatus,
  mitigationMeasures: MitigationMeasures
): RiskScores {
  const diseases: Disease[] = ["FMD", "PPR", "LSD", "RVF", "SPGP"];
  const results: RiskScores = {};
  
  for (const disease of diseases) {
    results[disease] = getScores(
      connectionScores,
      diseaseStatus,
      mitigationMeasures,
      disease
    );
  }
  
  return results;
}

function getScores(
  connectionScores: PathwayScores,
  diseaseStatus: DiseaseStatus,
  mitigationMeasures: MitigationMeasures,
  disease: Disease
): number {
  const diseaseKey = `d${disease}` as keyof DiseaseStatus;
  const mitigationKey = `m${disease}` as keyof MitigationMeasures;
  
  const diseaseValue = diseaseStatus[diseaseKey];
  
  // If disease status is 0, return 0 risk
  if (diseaseValue === 0 || diseaseValue === null) {
    return 0;
  }
  
  // Get mitigation value or default to 0 if null
  const mitigationValue = mitigationMeasures[mitigationKey] === null ? 0 : mitigationMeasures[mitigationKey] as number;
  
  // Calculate risk score (Vue app doesn't divide by 10)
  return (
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
}
