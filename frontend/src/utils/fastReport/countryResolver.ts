import { normalizeCountryName } from '../maps/countryUtils';
import { FAST_COUNTRY_ISO3, ISO3_TO_FAST_COUNTRY, ISO3_TO_PCP_COUNTRY, iso3ForCountry } from './countryIso3';

/** Map GeoJSON / UN ROMNAM / GADM names to FAST_Report.Country values */
const GEO_TO_FAST_REPORT: Record<string, string> = {
  Turkey: 'Türkiye',
  Türkiye: 'Türkiye',
  Iran: 'Iran (Islamic Republic of)',
  'Iran (Islamic Republic of)': 'Iran (Islamic Republic of)',
  Syria: 'Syrian Arab Republic',
  'Syrian Arab Republic': 'Syrian Arab Republic',
  Palestine: 'Palestine',
  'Palestine, State of': 'Palestine',
  'State of Palestine': 'Palestine',
  Gaza: 'Palestine',
  'West Bank': 'Palestine',
  "Bi'r Tawīl": 'Egypt',
  "Bi'r Tawil": 'Egypt',
  "Hala'ib Triangle": 'Sudan',
  'Russian Federation': 'Russian Federation',
  Russia: 'Russian Federation',
};

export function getFeatureCountryName(feature: {
  properties?: Record<string, string | number | undefined>;
}): string {
  const props = feature.properties || {};
  const name =
    props.ROMNAM ||
    props.COUNTRY ||
    props.NAME_0 ||
    props.name ||
    props.NAME ||
    '';
  return String(name);
}

export function getFeatureIso3(feature: {
  properties?: Record<string, string | number | undefined>;
}): string | null {
  const props = feature.properties || {};
  const iso = props.ISO3CD || props.ISO3 || props.iso3;
  if (!iso) return null;
  return String(iso).trim().toUpperCase() || null;
}

/**
 * Resolve a GeoJSON / UN country feature to a FAST_Report country name when possible.
 */
export function resolveFastReportCountry(
  geoJsonName: string,
  fastReportCountries: Iterable<string>,
  iso3?: string | null
): string | null {
  const countrySet = new Set(fastReportCountries);

  if (iso3) {
    const fromIso = ISO3_TO_FAST_COUNTRY[iso3.toUpperCase()];
    if (fromIso && countrySet.has(fromIso)) return fromIso;
  }

  if (!geoJsonName) return null;

  if (countrySet.has(geoJsonName)) return geoJsonName;

  const alias = GEO_TO_FAST_REPORT[geoJsonName];
  if (alias && countrySet.has(alias)) return alias;

  const normalized = normalizeCountryName(geoJsonName);
  if (countrySet.has(normalized)) return normalized;

  const aliasNormalized = GEO_TO_FAST_REPORT[normalized];
  if (aliasNormalized && countrySet.has(aliasNormalized)) return aliasNormalized;

  for (const country of Array.from(countrySet)) {
    if (normalizeCountryName(country) === normalized) return country;
    if (country.toLowerCase() === geoJsonName.toLowerCase()) return country;
  }

  return null;
}

export type PcpCountryRow = { Country: string; PCP_Stage: string };

/**
 * Match a UN / GeoJSON feature to a PCP row.
 * Prefer ISO3 so disputed polygons (Gaza, West Bank, Bi'r Tawīl, …) still color.
 */
export function findPcpEntryForFeature(
  pcpData: PcpCountryRow[],
  geoName: string,
  resolved: string | null,
  iso3?: string | null
): PcpCountryRow | undefined {
  if (!pcpData.length) return undefined;

  const candidates = new Set<string>();
  if (resolved) candidates.add(resolved);
  if (geoName) {
    candidates.add(geoName);
    const alias =
      GEO_TO_FAST_REPORT[geoName] || GEO_TO_FAST_REPORT[normalizeCountryName(geoName)];
    if (alias) candidates.add(alias);
  }
  if (iso3) {
    const fromIso = ISO3_TO_FAST_COUNTRY[iso3.toUpperCase()];
    if (fromIso) candidates.add(fromIso);
    const fromPcp = ISO3_TO_PCP_COUNTRY[iso3.toUpperCase()];
    if (fromPcp) candidates.add(fromPcp);
  }

  for (const name of Array.from(candidates)) {
    const hit = pcpData.find((e) => e.Country === name);
    if (hit) return hit;
  }

  const lowerCandidates = new Set(
    Array.from(candidates).map((n) => n.trim().toLowerCase())
  );
  const isoUpper = iso3 ? iso3.toUpperCase() : null;
  for (const row of pcpData) {
    if (!row.Country) continue;
    if (lowerCandidates.has(row.Country.trim().toLowerCase())) return row;
    if (isoUpper && iso3ForCountry(row.Country) === isoUpper) return row;
    if (isoUpper && FAST_COUNTRY_ISO3[row.Country] === isoUpper) return row;
  }

  return undefined;
}
