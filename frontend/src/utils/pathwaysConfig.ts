// Single source of truth for pathway effectiveness scores
// Based on literature and expert knowledge - scores represent effectiveness (0-3)

export type Disease = 'FMD' | 'PPR' | 'LSD' | 'RVF' | 'SPGP';
export type PathwayKey = 'airborne' | 'vectorborne' | 'wildAnimals' | 'animalProduct' | 'liveAnimal' | 'fomite';

// Centralized pathway effectiveness scores
export const PATHWAYS_EFFECTIVENESS: {
  [key in PathwayKey]: { [key in Disease]: number };
} = {
  airborne: { FMD: 2, PPR: 0, LSD: 0, RVF: 0, SPGP: 0 },
  vectorborne: { FMD: 0, PPR: 0, LSD: 3, RVF: 3, SPGP: 1 },
  wildAnimals: { FMD: 1, PPR: 2, LSD: 0, RVF: 1, SPGP: 0 },
  animalProduct: { FMD: 2, PPR: 0, LSD: 1, RVF: 2, SPGP: 1 },
  liveAnimal: { FMD: 3, PPR: 3, LSD: 3, RVF: 3, SPGP: 3 },
  fomite: { FMD: 2, PPR: 2, LSD: 1, RVF: 0, SPGP: 2 },
};

// Pathway display names mapping
export const PATHWAY_DISPLAY_NAMES: { [key in PathwayKey]: string } = {
  airborne: 'Airborne',
  vectorborne: 'Vector-borne',
  wildAnimals: 'Wild Animals', 
  animalProduct: 'Animal Product',
  liveAnimal: 'Live Animal',
  fomite: 'Fomite'
};

// Utility function to convert to chart format
export const getPathwaysForChart = () => {
  return Object.entries(PATHWAY_DISPLAY_NAMES).map(([key, displayName]) => ({
    pathway: displayName,
    FMD: PATHWAYS_EFFECTIVENESS[key as PathwayKey].FMD,
    PPR: PATHWAYS_EFFECTIVENESS[key as PathwayKey].PPR,
    LSD: PATHWAYS_EFFECTIVENESS[key as PathwayKey].LSD,
    RVF: PATHWAYS_EFFECTIVENESS[key as PathwayKey].RVF,
    SPGP: PATHWAYS_EFFECTIVENESS[key as PathwayKey].SPGP,
  }));
};
