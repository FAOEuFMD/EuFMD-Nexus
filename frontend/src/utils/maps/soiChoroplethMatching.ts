/** Formal TCC nation names used in SOI data -> GADM GeoJSON COUNTRY values */
export const SOI_TO_GEO_COUNTRY: Record<string, string> = {
  'Azerbaijan, Republic of': 'Azerbaijan',
  'Armenia, Republic of': 'Armenia',
  'Georgia': 'Georgia',
  'Iran, Islamic, Republic of': 'Iran',
  'Iraq, Republic of': 'Iraq',
  'Pakistan, Islamic, Republic of': 'Pakistan',
  'Russian Federation': 'Russia',
  'Turkey, Republic of': 'Turkey',
};

export const ALLOWED_SOI_COUNTRIES = Object.keys(SOI_TO_GEO_COUNTRY);

/** Map auth/profile country string to formal TCC nation name for filters. */
export function matchSoiCountryName(userCountry?: string | null): string | null {
  if (!userCountry?.trim()) return null;
  const norm = userCountry.toLowerCase().trim();
  for (const formal of ALLOWED_SOI_COUNTRIES) {
    if (formal.toLowerCase() === norm) return formal;
    const geo = (SOI_TO_GEO_COUNTRY[formal] || '').toLowerCase();
    if (geo && (geo === norm || norm.includes(geo) || geo.includes(norm))) return formal;
    const shortName = formal.split(',')[0].toLowerCase().trim();
    if (norm.includes(shortName) || shortName.includes(norm)) return formal;
  }
  return null;
}

/** Lowercase GADM country names included in the SOI choropleth */
export const ALLOWED_GEO_COUNTRIES = new Set(
  Object.values(SOI_TO_GEO_COUNTRY).map((name) => name.toLowerCase())
);

/**
 * Known mismatches between TCC province names and GADM NAME_1 values.
 * Keys and values are canonical region names (see canonicalRegionName).
 */
const REGION_ALIASES: Record<string, string> = {
  abkhazeti: 'abkhazia',
  adjara: 'ajaria',
  yerevan: 'erevan',
  daghligshirvan: 'dagligshirvan',
  ganjagazakh: 'ganjaqazakh',
  gubakhachmaz: 'qubakhachmaz',
  yukharigarabakh: 'yukharikarabakh',
};

export function normalizeRegionName(name: string): string {
  return name
    .toLowerCase()
    // Turkish dotless i (ı) is not matched by [a-z] and was dropped (e.g. Iğdır -> igdr)
    .replace(/\u0131/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\ba\s*\/\s*r\b/g, '')
    .replace(/\band\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function canonicalRegionName(name: string): string {
  const normalized = normalizeRegionName(name);
  return REGION_ALIASES[normalized] ?? normalized;
}

export function toGeoCountry(soiCountry: string): string | null {
  const mapped = SOI_TO_GEO_COUNTRY[soiCountry];
  return mapped ? mapped.toLowerCase() : null;
}

export function isAllowedSoiCountry(soiCountry: string): boolean {
  return soiCountry in SOI_TO_GEO_COUNTRY;
}

export function isAllowedGeoCountry(geoCountry: string): boolean {
  return ALLOWED_GEO_COUNTRIES.has(geoCountry.toLowerCase());
}

/** Build lookup key: geoCountry|canonicalRegion */
export function vaccinationRegionKey(geoCountry: string, regionName: string): string {
  return `${geoCountry.toLowerCase()}|${canonicalRegionName(regionName)}`;
}

export function vaccinationRegionKeyFromSoiRecord(country: string, province?: string): string | null {
  if (!province) return null;
  const geoCountry = toGeoCountry(country);
  if (!geoCountry) return null;
  return vaccinationRegionKey(geoCountry, province);
}

export function vaccinationRegionKeyFromGeoFeature(properties: {
  COUNTRY?: string;
  NAME_1?: string;
}): string | null {
  const geoCountry = (properties.COUNTRY || '').toLowerCase();
  const name1 = properties.NAME_1 || '';
  if (!geoCountry || !name1) return null;
  return vaccinationRegionKey(geoCountry, name1);
}
