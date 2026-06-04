import { normalizeCountryName } from '../maps/countryUtils';

/** Map GeoJSON / GADM names to FAST_Report.Country values */
const GEO_TO_FAST_REPORT: Record<string, string> = {
  Turkey: 'Türkiye',
  Türkiye: 'Türkiye',
  Iran: 'Iran (Islamic Republic of)',
  'Iran (Islamic Republic of)': 'Iran (Islamic Republic of)',
  Syria: 'Syrian Arab Republic',
  'Syrian Arab Republic': 'Syrian Arab Republic',
  Palestine: 'Palestine, State of',
  'Palestine, State of': 'Palestine, State of',
  'State of Palestine': 'Palestine, State of',
};

export function getFeatureCountryName(feature: {
  properties?: Record<string, string | number | undefined>;
}): string {
  const props = feature.properties || {};
  const name =
    props.COUNTRY ||
    props.NAME_0 ||
    props.name ||
    props.NAME ||
    '';
  return String(name);
}

/**
 * Resolve a GeoJSON country label to a FAST_Report country name when possible.
 */
export function resolveFastReportCountry(
  geoJsonName: string,
  fastReportCountries: Iterable<string>
): string | null {
  if (!geoJsonName) return null;

  const countrySet = new Set(fastReportCountries);

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
