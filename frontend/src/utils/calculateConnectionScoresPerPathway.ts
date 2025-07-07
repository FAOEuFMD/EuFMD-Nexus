/**
 * Calculates connection scores per pathway.
 * The pathways are: airborne, vector-borne, wild animals,
 * animal product, live animal, and fomite.
 * The logic of the calculations comes from the
 * connections tab at the RMT_FAST_EuFmd_Clean_rv20231017 Excel file.
 */

interface ConnectionInputs {
  liveAnimalContact: number;
  legalImport: number;
  proximity: number;
  illegalImport: number;
  connection: number;
  livestockDensity: number;
}

interface PathwayScores {
  airborne: number;
  vectorborne: number;
  wildAnimals: number;
  animalProduct: number;
  liveAnimal: number;
  fomite: number;
}

export function calculateConnectionScoresPerPathway(connections: ConnectionInputs): PathwayScores {
  const {
    liveAnimalContact,
    legalImport,
    proximity,
    illegalImport,
    connection,
    livestockDensity,
  } = connections;

  const airborne = getAirborneScore(livestockDensity, proximity);
  const vectorborne = getVectorborneScore(
    livestockDensity,
    proximity,
    connection
  );
  const wildAnimals = getWildAnimalsScore(livestockDensity, proximity);
  const animalProduct = getAnimalProductScore(legalImport, illegalImport);
  const liveAnimal = getLiveAnimalScore(liveAnimalContact, proximity);
  const fomite = getFomiteScore(connection, proximity);

  return {
    airborne,
    vectorborne,
    wildAnimals,
    animalProduct,
    liveAnimal,
    fomite,
  };
}

function getAirborneScore(livestockDensity: number, proximity: number): number {
  return livestockDensity > 0 && proximity > 1 ? 2 : proximity > 1 ? 1 : 0;
}

function getVectorborneScore(livestockDensity: number, proximity: number, connection: number): number {
  let vectorborne = 0;
  if ((proximity > 1 && livestockDensity > 0) || connection > 2) {
    vectorborne = 2;
  } else if (proximity > 1 || connection > 1) {
    vectorborne = 1.5;
  } else if (proximity === 1 || connection === 1) {
    vectorborne = 1;
  }
  return vectorborne;
}

function getWildAnimalsScore(livestockDensity: number, proximity: number): number {
  let wildAnimals = 0;
  if (proximity === 3 && livestockDensity > 0) {
    wildAnimals = 2;
  } else if (proximity === 3 && livestockDensity === 0) {
    wildAnimals = 1;
  }
  return wildAnimals;
}

function getAnimalProductScore(legalImport: number, illegalImport: number): number {
  let animalProduct = 0;
  if (legalImport === 3 || illegalImport === 3) {
    animalProduct = 2;
  } else if (legalImport === 2 || illegalImport === 2) {
    animalProduct = 1.5;
  } else if (legalImport === 1 || illegalImport === 1) {
    animalProduct = 1;
  }
  return animalProduct;
}

function getLiveAnimalScore(liveAnimalContact: number, proximity: number): number {
  let liveAnimal = 0;
  if (liveAnimalContact === 3) {
    liveAnimal = 2;
  } else if (liveAnimalContact === 2) {
    liveAnimal = 1.5;
  } else if (liveAnimalContact === 1 || proximity === 3) {
    liveAnimal = 1;
  }
  return liveAnimal;
}

function getFomiteScore(connection: number, proximity: number): number {
  let fomite = 0;
  if (connection === 3) {
    fomite = 2;
  } else if (proximity > 1 || connection > 1) {
    fomite = 1.5;
  } else if (proximity === 1 || connection === 1) {
    fomite = 1;
  }
  return fomite;
}
