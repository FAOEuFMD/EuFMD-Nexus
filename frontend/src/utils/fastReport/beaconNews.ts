import type { BeaconNewsItem } from '../../components/FastReport/BeaconNewsPanel';

/** Map BEACON location labels → FAST / map country keys */
const BEACON_LOCATION_TO_COUNTRY: Record<string, string> = {
  czechia: 'Czech Republic',
  'iran, islamic republic of': 'Iran (Islamic Republic of)',
  iran: 'Iran (Islamic Republic of)',
  palestine: 'Palestine',
  'state of palestine': 'Palestine',
  'egypt, arab republic': 'Egypt',
  egypt: 'Egypt',
  'sudan, republic of the': 'Sudan',
  sudan: 'Sudan',
  türkiye: 'Türkiye',
  turkey: 'Türkiye',
  'syrian arab republic': 'Syrian Arab Republic',
  syria: 'Syrian Arab Republic',
  'russian federation': 'Russian Federation',
  russia: 'Russian Federation',
};

export function normalizeBeaconCountryName(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) return raw;
  if (BEACON_LOCATION_TO_COUNTRY[key]) return BEACON_LOCATION_TO_COUNTRY[key];
  // Title-case fallback: keep original trimming
  return raw.trim();
}

/** Group BEACON news items by canonical country name. */
export function groupBeaconNewsByCountry(
  items: BeaconNewsItem[]
): Record<string, BeaconNewsItem[]> {
  const out: Record<string, BeaconNewsItem[]> = {};
  for (const item of items) {
    const locs = item.locations?.length ? item.locations : [];
    if (!locs.length) continue;
    for (const loc of locs) {
      const country = normalizeBeaconCountryName(loc);
      if (!out[country]) out[country] = [];
      // Avoid duplicate same report under one country
      if (!out[country].some((x) => x.id === item.id)) {
        out[country].push(item);
      }
    }
  }
  return out;
}

function countryNameKey(raw: string): string {
  return normalizeBeaconCountryName(raw).trim().toLowerCase();
}

/** News for a selected country (FAST name or geo label). */
export function beaconNewsForCountry(
  byCountry: Record<string, BeaconNewsItem[]>,
  country: string | null | undefined,
  geoName?: string | null
): BeaconNewsItem[] {
  if (!country && !geoName) return [];
  const wanted = new Set<string>();
  if (country) wanted.add(countryNameKey(country));
  if (geoName) wanted.add(countryNameKey(geoName));

  const seen = new Set<string>();
  const out: BeaconNewsItem[] = [];
  for (const [stored, items] of Object.entries(byCountry)) {
    if (!wanted.has(countryNameKey(stored))) continue;
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/** Extra centroids for European (and other) labels not in neighbourhood coords JSON. */
const EXTRA_COUNTRY_LATLNG: Record<string, [number, number]> = {
  albania: [41.1533, 20.1683],
  austria: [47.5162, 14.5501],
  belarus: [53.7098, 27.9534],
  belgium: [50.5039, 4.4699],
  bosnia: [43.9159, 17.6791],
  'bosnia and herzegovina': [43.9159, 17.6791],
  bulgaria: [42.7339, 25.4858],
  croatia: [45.1, 15.2],
  cyprus: [35.1264, 33.4299],
  'czech republic': [49.8175, 15.473],
  czechia: [49.8175, 15.473],
  denmark: [56.2639, 9.5018],
  estonia: [58.5953, 25.0136],
  finland: [61.9241, 25.7482],
  france: [46.2276, 2.2137],
  germany: [51.1657, 10.4515],
  greece: [39.0742, 21.8243],
  hungary: [47.1625, 19.5033],
  iceland: [64.9631, -19.0208],
  ireland: [53.1424, -7.6921],
  italy: [41.8719, 12.5674],
  kazakhstan: [48.0196, 66.9237],
  kosovo: [42.6026, 20.903],
  latvia: [56.8796, 24.6032],
  lithuania: [55.1694, 23.8813],
  luxembourg: [49.8153, 6.1296],
  malta: [35.9375, 14.3754],
  moldova: [47.4116, 28.3699],
  'republic of moldova': [47.4116, 28.3699],
  montenegro: [42.7087, 19.3744],
  netherlands: [52.1326, 5.2913],
  'north macedonia': [41.6086, 21.7453],
  norway: [60.472, 8.4689],
  poland: [51.9194, 19.1451],
  portugal: [39.3999, -8.2245],
  romania: [45.9432, 24.9668],
  'russian federation': [61.524, 105.3188],
  russia: [61.524, 105.3188],
  serbia: [44.0165, 21.0059],
  slovakia: [48.669, 19.699],
  slovenia: [46.1512, 14.9955],
  spain: [40.4637, -3.7492],
  sweden: [60.1282, 18.6435],
  switzerland: [46.8182, 8.2275],
  ukraine: [48.3794, 31.1656],
  'united kingdom': [55.3781, -3.436],
};

/** Rough polygon centroid from GeoJSON coordinates (lon/lat → [lat, lng]). */
export function geoJsonFeatureLatLng(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feature: any
): [number, number] | null {
  const geom = feature?.geometry;
  if (!geom?.coordinates) return null;

  const ring =
    geom.type === 'Polygon'
      ? geom.coordinates[0]
      : geom.type === 'MultiPolygon'
        ? geom.coordinates[0]?.[0]
        : null;
  if (!Array.isArray(ring) || ring.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    sumLat += lat;
    sumLng += lng;
    n += 1;
  }
  if (!n) return null;
  return [sumLat / n, sumLng / n];
}

export type BeaconNewsMapMarker = {
  country: string;
  count: number;
  position: [number, number];
};

function buildLatLngIndex(
  countryCoordinates: Record<string, [number, number]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonData?: any
): Map<string, [number, number]> {
  const latLngByKey = new Map<string, [number, number]>();
  for (const [name, coords] of Object.entries(countryCoordinates)) {
    if (Array.isArray(coords) && coords.length >= 2) {
      latLngByKey.set(countryNameKey(name), [coords[0], coords[1]]);
    }
  }
  for (const [name, coords] of Object.entries(EXTRA_COUNTRY_LATLNG)) {
    if (!latLngByKey.has(name)) latLngByKey.set(name, coords);
  }

  const features = Array.isArray(geoJsonData?.features) ? geoJsonData.features : [];
  for (const feature of features) {
    const props = feature?.properties || {};
    const names = [props.ROMNAM, props.COUNTRY, props.NAME_0, props.name, props.NAME]
      .filter(Boolean)
      .map((n: string | number) => String(n));
    const centroid = geoJsonFeatureLatLng(feature);
    if (!centroid) continue;
    for (const name of names) {
      const key = countryNameKey(name);
      if (!latLngByKey.has(key)) latLngByKey.set(key, centroid);
    }
  }
  return latLngByKey;
}

/** Map position for a BEACON / FAST country label when available. */
export function beaconCountryLatLng(
  country: string,
  countryCoordinates: Record<string, [number, number]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonData?: any
): [number, number] | null {
  return buildLatLngIndex(countryCoordinates, geoJsonData).get(countryNameKey(country)) || null;
}

/**
 * Countries with BEACON news that are not already covered by an outbreak info box.
 * Used to place news-only info boxes on the map.
 */
export function buildNewsOnlyInfoBoxes(
  byCountry: Record<string, BeaconNewsItem[]>,
  countryCoordinates: Record<string, [number, number]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonData: any,
  countriesWithOutbreakBox: Iterable<string>
): BeaconNewsMapMarker[] {
  const outbreakKeys = new Set(
    Array.from(countriesWithOutbreakBox).map((c) => countryNameKey(c))
  );
  const latLngByKey = buildLatLngIndex(countryCoordinates, geoJsonData);
  const markers: BeaconNewsMapMarker[] = [];

  for (const [country, items] of Object.entries(byCountry)) {
    if (!items.length) continue;
    const key = countryNameKey(country);
    if (outbreakKeys.has(key)) continue;
    const position = latLngByKey.get(key);
    if (!position) continue;
    markers.push({ country, count: items.length, position });
  }
  return markers;
}
