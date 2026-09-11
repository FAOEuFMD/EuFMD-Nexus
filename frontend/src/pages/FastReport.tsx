
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CollapsibleSidePanel from '../components/FastReport/CollapsibleSidePanel';
import CountryAnalyticsPanel from '../components/FastReport/CountryAnalyticsPanel';
import CountryBoundariesLayer, {
  CountrySelectPayload,
} from '../components/FastReport/CountryBoundariesLayer';
import MapZoomTracker from '../components/FastReport/MapZoomTracker';
import InfurOutbreakLayer from '../components/FastReport/InfurOutbreakLayer';
import BeaconNewsPanel, { type BeaconNewsItem } from '../components/FastReport/BeaconNewsPanel';
import VaccinationPatternDefs, {
  VACC_DOSE_BAND_LABELS,
  VACC_FLAGGED_LABEL,
  VACC_PATTERN_IDS,
  type VaccDoseBand,
} from '../components/FastReport/VaccinationPatternDefs';
import {
  EUROPE_REGION,
  WAHIS_INFUR_LABEL,
  excludeBefDisease,
  formatPeriod,
  getCurrentSemesterLabel,
  getLastPublishedQuarters,
  infurDateMatchesPeriod,
  isInPeriods,
  type InfurOutbreakPoint,
} from '../utils/fastReport/currentSituation';
import { fetchCountryBoundaries } from '../utils/maps/countryUtils';
import { countriesToIso3 } from '../utils/fastReport/countryIso3';
import { resolveFastReportCountry } from '../utils/fastReport/countryResolver';
import {
  beaconNewsForCountry,
  buildNewsOnlyInfoBoxes,
  groupBeaconNewsByCountry,
} from '../utils/fastReport/beaconNews';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

async function loadUnCountryBoundaries(iso3Codes: string[]) {
  const codes =
    iso3Codes.length > 0
      ? iso3Codes
      : [
          'AFG',
          'DZA',
          'ARM',
          'AZE',
          'EGY',
          'GEO',
          'IRN',
          'IRQ',
          'ISR',
          'JOR',
          'LBN',
          'LBY',
          'MRT',
          'MAR',
          'PAK',
          'PSE',
          'SDN',
          'SYR',
          'TUN',
          'TUR',
        ];

  // Prefer backend proxy (avoids browser CORS / payload issues; batches large PCP sets)
  try {
    const res = await fetch(`/api/fast-report/country-boundaries?iso3=${codes.join(',')}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.type === 'FeatureCollection' && Array.isArray(data.features) && data.features.length) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend UN boundaries proxy failed, trying direct UN API', err);
  }

  return fetchCountryBoundaries(codes);
}
// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export interface FastReportData {
  id: number;
  Year: number;
  Quarter: number;
  Report_Date?: string;
  Region: string;
  Country: string;
  Disease: string;
  Outbreaks: string;
  Cases: string;
  Outbreak_Description: string;
  Vaccination: number;
  Vaccination_Doses: number | string;
  Vaccination_Description: string;
  Source: string;
}

function parseOutbreakDate(item: FastReportData): Date | null {
  if (item.Report_Date) {
    const raw = String(item.Report_Date).trim().slice(0, 10);
    for (const fmt of [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{2})\/(\d{2})\/(\d{4})$/]) {
      const m = raw.match(fmt);
      if (m) {
        if (fmt.source.startsWith('^(\\d{4})')) {
          const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
          if (!isNaN(d.getTime())) return d;
        } else {
          const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
    const fallback = new Date(item.Report_Date);
    if (!isNaN(fallback.getTime())) return fallback;
  }
  const year = Number(item.Year);
  const quarter = Number(item.Quarter);
  if (!year || !quarter || quarter < 1 || quarter > 4) return null;
  // Approximate with quarter end when Report_Date is missing
  const endMonth = quarter * 3; // 3,6,9,12
  return new Date(year, endMonth, 0); // last day of end month
}

interface CountryCoordinates {
  [key: string]: [number, number];
}

function parseOutbreakCount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

interface CountryOutbreakColumn {
  disease: string;
  count: number;
  color: string;
}

interface CountryOutbreakBox {
  country: string;
  columns: CountryOutbreakColumn[];
  newsCount: number;
  /** Override when box is news-only and not in country-coordinates.json */
  position?: [number, number];
}

/** Default Fast Report frame — SE Europe / neighbourhood; north trimmed (no Scandinavia). */
const EUROPE_MAP_CENTER: [number, number] = [40, 26];
const EUROPE_DEFAULT_ZOOM = 5.5;
/** If fitBounds would pull out farther than this, keep the Europe frame instead. */
const EUROPE_MIN_FIT_ZOOM = 5;
/** Northern Europe cut off so Balkans / Black Sea / Near East dominate the view. */
const EUROPE_FRAME_BOUNDS = L.latLngBounds([33, -8], [54, 44]);

const MapController: React.FC<{
  countries: string[];
  countryCoordinates: CountryCoordinates;
  skipFit: boolean;
  /** Optional lat/lng points (e.g. INFUR dots) used when country centroids are empty. */
  pointCoords?: [number, number][];
  /**
   * When true (All Regions / Europe), avoid zooming out to worldwide marker spans
   * that appear on production but not on sparse local data.
   */
  preferEuropeFrame?: boolean;
}> = ({
  countries,
  countryCoordinates,
  skipFit,
  pointCoords = [],
  preferEuropeFrame = false,
}) => {
  const map = useMap();
  const countriesKey = countries.slice().sort().join('|');
  // Avoid building a huge dep string for thousands of INFUR points
  const pointsKey =
    pointCoords.length === 0
      ? ''
      : `${pointCoords.length}:${pointCoords[0][0].toFixed(2)},${pointCoords[0][1].toFixed(2)}:${pointCoords[pointCoords.length - 1][0].toFixed(2)},${pointCoords[pointCoords.length - 1][1].toFixed(2)}`;

  useEffect(() => {
    if (skipFit) return;

    map.invalidateSize();

    const coords: [number, number][] = [];

    if (countries.length > 0) {
      for (const country of countries) {
        const coord = countryCoordinates[country];
        if (coord) coords.push(coord);
      }
    }

    if (coords.length === 0 && pointCoords.length > 0) {
      for (const coord of pointCoords) {
        coords.push(coord);
      }
    }

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.12), { animate: false, maxZoom: 7 });
        if (preferEuropeFrame && map.getZoom() < EUROPE_MIN_FIT_ZOOM) {
          map.fitBounds(EUROPE_FRAME_BOUNDS, {
            animate: false,
            paddingTopLeft: [24, 12],
            paddingBottomRight: [24, 28],
          });
        }
        return;
      }
    }

    if (preferEuropeFrame) {
      map.fitBounds(EUROPE_FRAME_BOUNDS, {
        animate: false,
        paddingTopLeft: [24, 12],
        paddingBottomRight: [24, 28],
      });
    } else {
      map.setView(EUROPE_MAP_CENTER, EUROPE_DEFAULT_ZOOM, { animate: false });
    }
    // Fit only when the country set / coords change — not on every parent re-render
    // (re-fitting on zoomend → state update was locking zoom).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countriesKey/pointsKey encode geometry
  }, [map, countriesKey, countryCoordinates, skipFit, pointsKey, preferEuropeFrame]);

  return null;
};

/** Zoom the map to the full PCP / UN country polygon set when PCP-FMD is on. */
const FitToGeoJson: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonData: any;
  enabled: boolean;
  skip: boolean;
}> = ({ geoJsonData, enabled, skip }) => {
  const map = useMap();
  const featureCount = geoJsonData?.features?.length || 0;

  useEffect(() => {
    if (!enabled || skip || !geoJsonData?.features?.length) return;
    try {
      const layer = L.geoJSON(geoJsonData);
      const bounds = layer.getBounds();
      if (!bounds.isValid()) return;

      // Fit without animation so getZoom() is reliable, then nudge in a step
      // so the PCP world view is not excessively zoomed out.
      map.fitBounds(bounds, { animate: false, padding: [20, 20] });
      const fittedZoom = map.getZoom();
      map.setZoom(Math.min(fittedZoom + 1, 4), { animate: false });
    } catch (err) {
      console.warn('Could not fit map to PCP country bounds', err);
    }
  }, [map, enabled, skip, featureCount, geoJsonData]);

  return null;
};

const FastReport: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FastReportData[]>([]);
  /** WAHIS immediate notifications (INFUR) — Europe; Now or Historical by period. */
  const [infurData, setInfurData] = useState<InfurOutbreakPoint[]>([]);
  const [infurLoading, setInfurLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'now' | 'historical'>('now');
  const [reportGenerating, setReportGenerating] = useState(false);
  const [countryCoordinates, setCountryCoordinates] = useState<CountryCoordinates>({});
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  const [pcpData, setPcpData] = useState<{ Country: string; PCP_Stage: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoJsonError, setGeoJsonError] = useState<string | null>(null);

  const [diseaseLayers, setDiseaseLayers] = useState<{
    [disease: string]: { outbreaks: boolean; vaccination: boolean; status: boolean; pcpFmd: boolean };
  }>({});
  const [expandedDiseases, setExpandedDiseases] = useState<Set<string>>(new Set(['FMD', 'PPR']));

  const [mapZoom, setMapZoom] = useState(6);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedGeoName, setSelectedGeoName] = useState<string | null>(null);
  const [selectedFastReportCountry, setSelectedFastReportCountry] = useState<string | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [countryPanelCollapsed, setCountryPanelCollapsed] = useState(false);
  const [beaconNews, setBeaconNews] = useState<BeaconNewsItem[]>([]);
  const [beaconLoading, setBeaconLoading] = useState(false);
  const [beaconError, setBeaconError] = useState<string | null>(null);

  const dataWithoutBef = useMemo(() => excludeBefDisease(data), [data]);

  const fastReportCountries = useMemo(
    () => Array.from(new Set(dataWithoutBef.map((item) => item.Country).filter(Boolean))),
    [dataWithoutBef]
  );

  const openCountryPanel = useCallback(
    (fastReportCountry: string | null, geoName: string | null) => {
      setSelectedFastReportCountry(fastReportCountry);
      setSelectedGeoName(geoName);
      setSelectedCountry(fastReportCountry || geoName);
      setCountryPanelCollapsed(false);
    },
    []
  );

  const handleCountrySelect = useCallback(
    (payload: CountrySelectPayload) => {
      openCountryPanel(payload.fastReportCountry, payload.geoName);
    },
    [openCountryPanel]
  );

  const closeCountryPanel = useCallback(() => {
    setSelectedCountry(null);
    setSelectedGeoName(null);
    setSelectedFastReportCountry(null);
  }, []);

  const handleGenerateQuarterlyReport = useCallback(async () => {
    setReportGenerating(true);
    try {
      const response = await apiService.fastReport.downloadQuarterlyReport();
      const disposition = response.headers?.['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || 'FAST_Quarterly_Report.docx';
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err instanceof Error ? err.message : 'Report generation failed');
      alert(typeof message === 'string' ? message : 'Report generation failed');
    } finally {
      setReportGenerating(false);
    }
  }, []);

  const availableYears = useMemo(() => {
    const fromFast = dataWithoutBef.map((item) => item.Year);
    const fromInfur =
      viewMode === 'historical'
        ? infurData
            .map((item) => {
              const d = item.outbreakStartDate;
              if (!d || d.length < 4) return null;
              const y = Number(d.slice(0, 4));
              return Number.isFinite(y) ? y : null;
            })
            .filter((y): y is number => y !== null)
        : [];
    return Array.from(new Set([...fromFast, ...fromInfur])).sort((a, b) => b - a);
  }, [dataWithoutBef, infurData, viewMode]);

  const availableDiseases = useMemo(() => {
    const fromFast = dataWithoutBef.map((item) => item.Disease).filter(Boolean);
    const fromInfur = infurData.map((item) => item.disease).filter(Boolean);
    const diseases = Array.from(new Set([...fromFast, ...fromInfur]));
    const order = ['FMD', 'PPR', 'LSD', 'SPGP', 'RVF'];

    return diseases.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [dataWithoutBef, infurData]);

  const nowPeriods = useMemo(
    () => getLastPublishedQuarters(dataWithoutBef, 2),
    [dataWithoutBef]
  );

  const nowPeriodLabel = useMemo(() => {
    if (!nowPeriods.length) return 'No published FAST quarters yet';
    return nowPeriods.map(formatPeriod).join(' · ');
  }, [nowPeriods]);

  const availableRegions = useMemo(() => {
    const regions = Array.from(
      new Set(dataWithoutBef.map((item) => item.Region).filter(Boolean))
    ).sort();
    // Europe is WAHIS-INFUR-only (not in FAST_Report); always offer it in the filter.
    if (!regions.includes(EUROPE_REGION)) {
      return [...regions, EUROPE_REGION];
    }
    return regions;
  }, [dataWithoutBef]);

  const toggleDisease = (disease: string) => {
    const newExpanded = new Set(expandedDiseases);
    if (newExpanded.has(disease)) {
      newExpanded.delete(disease);
    } else {
      newExpanded.add(disease);
    }
    setExpandedDiseases(newExpanded);
  };

  const toggleLayer = (disease: string, layer: 'outbreaks' | 'vaccination' | 'status' | 'pcpFmd') => {
    setDiseaseLayers((prev) => ({
      ...prev,
      [disease]: {
        outbreaks: layer === 'outbreaks' ? !prev[disease]?.outbreaks : prev[disease]?.outbreaks || false,
        vaccination: layer === 'vaccination' ? !prev[disease]?.vaccination : prev[disease]?.vaccination || false,
        status: layer === 'status' ? !prev[disease]?.status : prev[disease]?.status || false,
        pcpFmd: layer === 'pcpFmd' ? !prev[disease]?.pcpFmd : prev[disease]?.pcpFmd || false,
      },
    }));
  };

  const diseaseLayerMatch = useCallback(
    (disease: string) => {
      const layers = diseaseLayers[disease];
      return !layers || layers.outbreaks || layers.vaccination;
    },
    [diseaseLayers]
  );

  /** FAST rows for the active view (BEF already removed). */
  const filteredFastData = useMemo(() => {
    return dataWithoutBef.filter((item) => {
      if (viewMode === 'now') {
        if (!isInPeriods(item.Year, item.Quarter, nowPeriods)) return false;
      } else {
        const yearMatch = selectedYear === 'all' || item.Year?.toString() === selectedYear;
        const quarterMatch =
          selectedQuarter === 'all' || item.Quarter?.toString() === selectedQuarter;
        if (!yearMatch || !quarterMatch) return false;
      }

      // Europe is WAHIS-INFUR-only — never show FAST rows under that region filter.
      if (selectedRegion === EUROPE_REGION) return false;
      const regionMatch = selectedRegion === 'all' || item.Region === selectedRegion;
      if (!regionMatch) return false;

      return diseaseLayerMatch(item.Disease);
    });
  }, [
    dataWithoutBef,
    viewMode,
    nowPeriods,
    selectedYear,
    selectedQuarter,
    selectedRegion,
    diseaseLayerMatch,
  ]);

  /** WAHIS-INFUR point outbreaks — Europe; period + disease layers. */
  const filteredInfurData = useMemo(() => {
    if (selectedRegion !== 'all' && selectedRegion !== EUROPE_REGION) return [];
    return infurData.filter((item) => {
      if (!item.disease || item.disease === 'BEF') return false;
      if (!diseaseLayers[item.disease]?.outbreaks) return false;
      if (viewMode === 'historical') {
        return infurDateMatchesPeriod(
          item.outbreakStartDate,
          selectedYear,
          selectedQuarter
        );
      }
      return true;
    });
  }, [
    selectedRegion,
    infurData,
    diseaseLayers,
    viewMode,
    selectedYear,
    selectedQuarter,
  ]);

  const showBeacon = viewMode === 'now';

  /** FAST rows only for country info-boxes / vaccination / FAST stats. */
  const filteredData = filteredFastData;

  const getMarkerColor = useCallback((disease: string): string => {
    const colors: { [key: string]: string } = {
      FMD: '#DC143C', // red
      LSD: '#4169E1', // blue
      PPR: '#22c55e', // green
      RVF: '#eab308', // yellow
      SPGP: '#7c3aed', // purple
      ASF: '#4444ff',
      LUMPY: '#ffff44',
      'Avian Influenza': '#ff8844',
      'Newcastle Disease': '#8844ff',
      default: '#888888',
    };
    return colors[disease] || colors.default;
  }, []);

  /** Rows used for outbreak map/stats (numeric outbreaks present, including 0). */
  const outbreakLayerRows = useMemo(() => {
    return filteredData.filter((item) => {
      if (!diseaseLayers[item.Disease]?.outbreaks) return false;
      return parseOutbreakCount(item.Outbreaks) !== null;
    });
  }, [filteredData, diseaseLayers]);

  /** Positive-outbreak rows for summary "affected" / totals / last report date. */
  const markerData = useMemo(() => {
    return outbreakLayerRows.filter((item) => (parseOutbreakCount(item.Outbreaks) || 0) > 0);
  }, [outbreakLayerRows]);

  /** One info box per country: disease columns only when outbreak layer is on and data exists (0 is shown). */
  const countryOutbreakBoxes = useMemo((): Omit<CountryOutbreakBox, 'newsCount'>[] => {
    const diseaseOrder = ['FMD', 'PPR', 'LSD', 'SPGP', 'RVF'];
    const byCountry = new Map<string, Map<string, number[]>>();

    for (const item of outbreakLayerRows) {
      if (!item.Country || !item.Disease) continue;
      const count = parseOutbreakCount(item.Outbreaks);
      if (count === null) continue;
      if (!byCountry.has(item.Country)) byCountry.set(item.Country, new Map());
      const byDisease = byCountry.get(item.Country)!;
      if (!byDisease.has(item.Disease)) byDisease.set(item.Disease, []);
      byDisease.get(item.Disease)!.push(count);
    }

    const boxes: Omit<CountryOutbreakBox, 'newsCount'>[] = [];
    Array.from(byCountry.entries()).forEach(([country, byDisease]) => {
      const diseases = Array.from(byDisease.keys()).sort((a, b) => {
        const ia = diseaseOrder.indexOf(a);
        const ib = diseaseOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });
      const columns: CountryOutbreakColumn[] = diseases.map((disease) => {
        const values = byDisease.get(disease) || [];
        const sum = values.reduce((s, n) => s + n, 0);
        return { disease, count: sum, color: getMarkerColor(disease) };
      });
      if (columns.length > 0) {
        boxes.push({ country, columns });
      }
    });
    return boxes.sort((a, b) => a.country.localeCompare(b.country));
  }, [outbreakLayerRows, getMarkerColor]);

  const outbreakBoxCountries = useMemo(
    () => countryOutbreakBoxes.map((b) => b.country),
    [countryOutbreakBoxes]
  );

  const beaconNewsByCountry = useMemo(
    () => (showBeacon ? groupBeaconNewsByCountry(beaconNews) : {}),
    [beaconNews, showBeacon]
  );

  /** Outbreak info boxes; BEACON news column only in Now view. */
  const countryInfoBoxes = useMemo((): CountryOutbreakBox[] => {
    if (!showBeacon) {
      return countryOutbreakBoxes.map((b) => ({ ...b, newsCount: 0 }));
    }

    const boxes: CountryOutbreakBox[] = countryOutbreakBoxes.map((b) => ({
      ...b,
      newsCount: beaconNewsForCountry(beaconNewsByCountry, b.country).length,
    }));

    const newsOnly = buildNewsOnlyInfoBoxes(
      beaconNewsByCountry,
      countryCoordinates,
      geoJsonData,
      outbreakBoxCountries
    );
    for (const marker of newsOnly) {
      boxes.push({
        country: marker.country,
        columns: [],
        newsCount: marker.count,
        position: marker.position,
      });
    }

    return boxes.sort((a, b) => a.country.localeCompare(b.country));
  }, [
    showBeacon,
    countryOutbreakBoxes,
    beaconNewsByCountry,
    countryCoordinates,
    geoJsonData,
    outbreakBoxCountries,
  ]);

  const vaccinationData = useMemo(() => {
    return filteredData.filter((item) => {
      if (!diseaseLayers[item.Disease]?.vaccination) return false;
      const doses = Number(item.Vaccination_Doses || 0);
      return doses > 0 || Number(item.Vaccination) === 1;
    });
  }, [filteredData, diseaseLayers]);

  const showVaccinationChoropleth = useMemo(
    () => Object.values(diseaseLayers).some((l) => l?.vaccination),
    [diseaseLayers]
  );

  /** Sum vaccine doses by country for selected vaccination disease layers. */
  const vaccinationDosesByCountry = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const item of vaccinationData) {
      if (!item.Country) continue;
      const doses = Number(item.Vaccination_Doses || 0);
      if (!doses || doses <= 0) continue;
      totals[item.Country] = (totals[item.Country] || 0) + doses;
    }
    return totals;
  }, [vaccinationData]);

  /** Countries with Vaccination=1 but no quantitative doses in the filtered set. */
  const vaccinationFlaggedByCountry = useMemo(() => {
    const flagged = new Set<string>();
    for (const item of vaccinationData) {
      if (!item.Country) continue;
      if (Number(item.Vaccination) !== 1) continue;
      const doses = Number(item.Vaccination_Doses || 0);
      if (doses > 0) continue;
      // Only flag if this country has no dose total from other rows
      if ((vaccinationDosesByCountry[item.Country] || 0) > 0) continue;
      flagged.add(item.Country);
    }
    return flagged;
  }, [vaccinationData, vaccinationDosesByCountry]);

  const summaryStats = useMemo(() => {
    const countriesAffected = new Set([
      ...markerData.map((item) => item.Country).filter(Boolean),
      ...filteredInfurData.map((item) => item.country).filter(Boolean),
    ]).size;
    const countriesVaccinating = new Set(
      vaccinationData.map((item) => item.Country).filter(Boolean)
    ).size;
    const totalOutbreaks =
      markerData.reduce((sum, item) => {
        const n = parseInt(String(item.Outbreaks || '0'), 10);
        return sum + (isNaN(n) ? 0 : n);
      }, 0) + filteredInfurData.length;

    let lastOutbreakDate: Date | null = null;
    for (const item of markerData) {
      const d = parseOutbreakDate(item);
      if (d && (!lastOutbreakDate || d > lastOutbreakDate)) {
        lastOutbreakDate = d;
      }
    }
    for (const item of filteredInfurData) {
      const raw = item.outbreakStartDate || item.submissionDate;
      if (!raw) continue;
      const d = new Date(raw);
      if (!isNaN(d.getTime()) && (!lastOutbreakDate || d > lastOutbreakDate)) {
        lastOutbreakDate = d;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysSinceLastOutbreak: number | null = null;
    if (lastOutbreakDate) {
      const last = new Date(lastOutbreakDate);
      last.setHours(0, 0, 0, 0);
      daysSinceLastOutbreak = Math.max(
        0,
        Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
      );
    }

    return {
      countriesAffected,
      countriesVaccinating,
      totalOutbreaks,
      daysSinceLastOutbreak,
    };
  }, [markerData, vaccinationData, filteredInfurData]);

  const showSummary =
    markerData.length > 0 ||
    vaccinationData.length > 0 ||
    filteredInfurData.length > 0 ||
    Object.values(diseaseLayers).some((l) => l?.outbreaks || l?.vaccination);

  const infurPointCoords = useMemo(
    (): [number, number][] => filteredInfurData.map((p) => [p.latitude, p.longitude]),
    [filteredInfurData]
  );
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const coordsResponse = await fetch('/country-coordinates.json');
        const coords = await coordsResponse.json();
        setCountryCoordinates(coords);

        const dashboardRes = await fetch('/api/fast-report/create-dashboard');

        if (!dashboardRes.ok) {
          throw new Error(`API error: ${dashboardRes.status} ${dashboardRes.statusText}`);
        }

        const dashboardData = await dashboardRes.json();

        if (dashboardData && dashboardData.data && Array.isArray(dashboardData.data)) {
          setData(dashboardData.data);
        } else if (dashboardData && Array.isArray(dashboardData)) {
          setData(dashboardData);
        } else {
          throw new Error('Invalid API response format - expected array or {data: array}');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Unable to load data: ${message}`);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInfur = async () => {
      setInfurLoading(true);
      try {
        const params = new URLSearchParams({ mode: viewMode });
        const infurRes = await fetch(`/api/fast-report/infur?${params.toString()}`);
        if (cancelled) return;
        if (infurRes.ok) {
          const infurPayload = await infurRes.json();
          setInfurData(Array.isArray(infurPayload?.data) ? infurPayload.data : []);
        } else {
          console.warn('INFUR API unavailable:', infurRes.status);
          setInfurData([]);
        }
      } catch (infurErr) {
        if (!cancelled) {
          console.warn('INFUR load failed:', infurErr);
          setInfurData([]);
        }
      } finally {
        if (!cancelled) setInfurLoading(false);
      }
    };

    loadInfur();
    return () => {
      cancelled = true;
    };
  }, [viewMode]);

  const fastReportCountriesKey = fastReportCountries.slice().sort().join('|');
  const pcpEnabled = !!diseaseLayers['FMD']?.pcpFmd;

  const boundaryIso3Codes = useMemo(() => {
    const codes = new Set(countriesToIso3(fastReportCountries));
    if (pcpEnabled && pcpData.length > 0) {
      for (const iso of countriesToIso3(pcpData.map((r) => r.Country))) {
        codes.add(iso);
      }
    }
    return Array.from(codes).sort();
  }, [fastReportCountries, pcpEnabled, pcpData]);

  const boundaryIso3Key = boundaryIso3Codes.join('|');

  useEffect(() => {
    let cancelled = false;

    const loadGeoJson = async () => {
      try {
        const geoData = await loadUnCountryBoundaries(boundaryIso3Codes);
        if (cancelled) return;
        if (!geoData || !geoData.features?.length) {
          throw new Error('UN country boundaries returned no features');
        }
        setGeoJsonData(geoData);
        setGeoJsonError(null);
      } catch (geoErr: unknown) {
        if (cancelled) return;
        const message = geoErr instanceof Error ? geoErr.message : 'Failed to load map boundaries';
        console.error('Error loading UN country boundaries:', message);
        setGeoJsonError(message);
      }
    };

    loadGeoJson();
    return () => {
      cancelled = true;
    };
  }, [boundaryIso3Key, boundaryIso3Codes, fastReportCountriesKey]);

  useEffect(() => {
    if (availableDiseases.length > 0 && Object.keys(diseaseLayers).length === 0) {
      const initialLayers: {
        [disease: string]: { outbreaks: boolean; vaccination: boolean; status: boolean; pcpFmd: boolean };
      } = {};
      availableDiseases.forEach((disease) => {
        initialLayers[disease] = {
          outbreaks: disease === 'FMD' || disease === 'PPR',
          vaccination: disease === 'FMD',
          status: false,
          pcpFmd: false,
        };
      });
      setDiseaseLayers(initialLayers);
    }
  }, [availableDiseases, diseaseLayers]);

  const beaconDiseaseCodes = useMemo(() => {
    const codes = Object.entries(diseaseLayers)
      .filter(([, layers]) => layers?.outbreaks || layers?.vaccination)
      .map(([disease]) => disease);
    return codes.length ? codes : ['FMD'];
  }, [diseaseLayers]);

  const beaconDiseaseKey = beaconDiseaseCodes.slice().sort().join('|');
  const beaconRegionParam = selectedRegion === 'all' ? 'all' : selectedRegion;

  useEffect(() => {
    if (!showBeacon) {
      setBeaconNews([]);
      setBeaconError(null);
      setBeaconLoading(false);
      return;
    }

    let cancelled = false;

    const loadBeacon = async () => {
      setBeaconLoading(true);
      setBeaconError(null);
      try {
        const params = new URLSearchParams({
          region: beaconRegionParam,
          diseases: beaconDiseaseCodes.join(','),
          limit: '25',
        });
        const res = await fetch(`/api/fast-report/beacon-news?${params}`);
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(detail || `BEACON API error ${res.status}`);
        }
        const payload = await res.json();
        if (cancelled) return;
        setBeaconNews(Array.isArray(payload?.data) ? payload.data : []);
        if (payload?.warning) {
          setBeaconError(String(payload.warning));
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load BEACON news';
        setBeaconError(message);
        setBeaconNews([]);
      } finally {
        if (!cancelled) setBeaconLoading(false);
      }
    };

    loadBeacon();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys encode filter inputs
  }, [showBeacon, beaconRegionParam, beaconDiseaseKey]);

  useEffect(() => {
    const loadPcpData = async () => {
      if (!diseaseLayers['FMD']?.pcpFmd) return;
      try {
        const pcpResponse = await fetch('/api/pcp/pcp-fmd-2026');
        const pcpResult = await pcpResponse.json();
        const rows = Array.isArray(pcpResult.data) ? pcpResult.data : [];
        // Normalize stage labels (DB sometimes has trailing spaces like "PCP-4 ")
        setPcpData(
          rows.map((row: { Country?: string; PCP_Stage?: string }) => ({
            Country: row.Country || '',
            PCP_Stage: String(row.PCP_Stage || '').trim(),
          }))
        );
      } catch (pcpErr) {
        console.error('Error loading PCP data:', pcpErr);
      }
    };

    loadPcpData();
  }, [diseaseLayers]);

  const getPcpStageColor = (stage: string): string => {
    const colors: { [key: string]: string } = {
      'PCP-0': '#E41A1C',
      'PCP-1-Provisional': '#F4C7A1',
      'PCP-1': '#F39C34',
      'PCP-2-Provisional': '#F7E08C',
      'PCP-2': '#F1C40F',
      'PCP-3-Provisional': '#A9D18E',
      'PCP-3': '#4CAF50',
      'PCP-4': '#2E7D32',
    };
    return colors[String(stage || '').trim()] || '#CCCCCC';
  };

  const createCountryOutbreakInfoBox = (
    columns: CountryOutbreakColumn[],
    newsCount = 0
  ) => {
    const colWidth = 28;
    const rowHeight = 28;
    const colsPerRow = 3;
    const hasNews = newsCount > 0;
    const totalCells = (hasNews ? 1 : 0) + columns.length;
    if (totalCells === 0) return L.divIcon({ className: 'country-outbreak-info-box', html: '' });

    const nCols = Math.min(totalCells, colsPerRow);
    const nRows = Math.max(1, Math.ceil(totalCells / colsPerRow));
    const width = Math.max(colWidth * nCols, colWidth);
    const height = rowHeight * nRows;
    const newsLabel = newsCount > 9 ? '9+' : String(newsCount);

    const newsCell = hasNews
      ? `
      <div title="BEACON news" style="
        background:#15736d;
        color:#fff;
        padding:2px 3px;
        text-align:center;
        min-width:${colWidth}px;
        min-height:${rowHeight - 1}px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:1px;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>
        </svg>
        <div style="font-weight:800;font-size:9px;line-height:1;">${newsLabel}</div>
      </div>`
      : '';

    const diseaseCells = columns
      .map(
        (col) => `
      <div style="
        background:#fff;
        padding:2px 3px;
        text-align:center;
        min-width:${colWidth}px;
        min-height:${rowHeight - 1}px;
        display:flex;
        flex-direction:column;
        justify-content:center;
      ">
        <div style="color:${col.color};font-weight:700;font-size:7px;line-height:1.05;">${col.disease}</div>
        <div style="color:${col.color};font-weight:800;font-size:10px;line-height:1.1;margin-top:0;">${col.count}</div>
      </div>`
      )
      .join('');

    return L.divIcon({
      className: 'country-outbreak-info-box',
      html: `
        <div style="
          background:#e5e7eb;
          border:1px solid #e5e7eb;
          border-radius:4px;
          box-shadow:0 1px 4px rgba(0,0,0,0.16);
          display:grid;
          grid-template-columns:repeat(${nCols}, ${colWidth}px);
          gap:1px;
          overflow:hidden;
          cursor:pointer;
          font-family:system-ui,-apple-system,sans-serif;
          user-select:none;
        ">${newsCell}${diseaseCells}</div>
      `,
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2],
    });
  };

  const handleZoomChange = useCallback((zoom: number) => {
    setMapZoom(zoom);
  }, []);

  const selectedCountryBeaconNews = useMemo(
    () =>
      showBeacon
        ? beaconNewsForCountry(
            beaconNewsByCountry,
            selectedFastReportCountry,
            selectedGeoName || selectedCountry
          )
        : [],
    [
      showBeacon,
      beaconNewsByCountry,
      selectedFastReportCountry,
      selectedGeoName,
      selectedCountry,
    ]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl">Loading Fast Report data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600 text-xl mb-4">Error Loading Data</div>
        <div className="text-gray-600">
          <p>{error}</p>
          <p className="mt-2 text-sm">Please ensure the FastAPI server is running and the database is accessible.</p>
        </div>
      </div>
    );
  }

  if (data.length === 0 && infurData.length === 0 && !loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-gray-600 text-xl mb-4">No Data Available</div>
        <p className="text-gray-600">No fast report or INFUR data found in the database.</p>
      </div>
    );
  }

  const countryPanelDisplayName = selectedCountry || '';
  const countryPanelApiKey = selectedFastReportCountry || selectedCountry || '';

  return (
    <div className="w-full space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Fast Report Dashboard</h2>
            {viewMode === 'now' ? (
              <div className="text-gray-600 mt-1 text-sm space-y-1.5 max-w-4xl">
                <p>
                  <span className="font-medium text-gray-700">Current situation</span> covers roughly
                  the last six months: EuFMD&apos;s last two published FAST quarters for neighbourhood
                  countries, and ADIS/WAHIS immediate notifications (INFUR) for European countries.
                  Use <span className="font-medium text-gray-700">Historical</span> on the right to
                  browse the FAST archive by year and quarter.
                </p>
                <p>
                  By default, FMD outbreaks and vaccination are on — use the disease layers to switch
                  or add diseases. Outbreaks without a precise location appear in the country info
                  box; those with latitude and longitude appear as dots. Orange dotted fill means
                  vaccination is reported but dose numbers are unknown; green hatching intensifies
                  with higher reported doses. When BEACON news exists for a country, a teal news
                  column appears first on the country info box — click the box, country fill, or
                  vaccination hatch to open the country panel (outbreaks, vaccination, and news).
                </p>
              </div>
            ) : (
              <p className="text-gray-600 mt-1 text-sm max-w-4xl">
                Historical FAST reports for neighbourhood countries and WAHIS immediate notifications
                (INFUR) for Europe — filter by year, quarter, region, and disease. BEACON news is
                available in the Now view only.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('now')}
                className={`px-4 py-2 text-sm font-medium ${
                  viewMode === 'now'
                    ? 'bg-[#15736d] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setViewMode('historical')}
                className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${
                  viewMode === 'historical'
                    ? 'bg-[#15736d] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Historical
              </button>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleGenerateQuarterlyReport}
                disabled={reportGenerating}
                className="px-4 py-2 text-sm font-semibold rounded-lg border-2 border-[#1d4ed8] text-[#1d4ed8] bg-white hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Download DOCX for the last completed calendar quarter (FAST + INFUR)"
              >
                {reportGenerating ? 'Generating…' : 'Generate Quarterly FAST Report'}
              </button>
            )}
          </div>
        </div>
        {viewMode === 'now' && (
          <div className="mt-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-medium">Current situation</span>
            <span className="text-gray-500"> · {getCurrentSemesterLabel()}</span>
            <span className="text-gray-500"> · FAST {nowPeriodLabel}</span>
            <span className="text-gray-500">
              {' '}
              · Europe {WAHIS_INFUR_LABEL} ({filteredInfurData.length} outbreak
              {filteredInfurData.length === 1 ? '' : 's'})
            </span>
          </div>
        )}
      </div>

      {showSummary && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 text-gray-800">Summary Statistics:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{summaryStats.countriesAffected}</div>
              <div className="text-sm text-gray-600">Countries Affected</div>
              <div className="text-xs text-gray-400 mt-1">Outbreak layer on</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{summaryStats.countriesVaccinating}</div>
              <div className="text-sm text-gray-600">Countries Vaccinating</div>
              <div className="text-xs text-gray-400 mt-1">Vaccination layer on</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded">
              <div className="text-2xl font-bold text-orange-600">{summaryStats.totalOutbreaks}</div>
              <div className="text-sm text-gray-600">Total Outbreaks</div>
              <div className="text-xs text-gray-400 mt-1">Selected diseases</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {summaryStats.daysSinceLastOutbreak != null
                  ? summaryStats.daysSinceLastOutbreak
                  : '—'}
              </div>
              <div className="text-sm text-gray-600">Days Since Last Outbreak Report</div>
              <div className="text-xs text-gray-400 mt-1">
                {viewMode === 'now' ? 'FAST / WAHIS-INFUR' : 'In selected period'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-0">
          <div className="flex-1 min-w-0 h-96 lg:h-[600px] relative">
            <MapContainer
              center={EUROPE_MAP_CENTER}
              zoom={EUROPE_DEFAULT_ZOOM}
              scrollWheelZoom={true}
              className="h-full w-full"
              zoomControl={true}
              doubleClickZoom={true}
              touchZoom={true}
            >
              <TileLayer
                url="https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; United Nations Geospatial Information Section"
                maxNativeZoom={6}
                maxZoom={18}
              />

              <VaccinationPatternDefs />

              {geoJsonData && (
                <CountryBoundariesLayer
                  geoJsonData={geoJsonData}
                  mapZoom={mapZoom}
                  selectedCountry={selectedFastReportCountry}
                  selectedGeoName={selectedGeoName}
                  showPcpStyling={!!diseaseLayers['FMD']?.pcpFmd}
                  pcpData={pcpData}
                  getPcpStageColor={getPcpStageColor}
                  showVaccinationChoropleth={
                    showVaccinationChoropleth && !diseaseLayers['FMD']?.pcpFmd
                  }
                  vaccinationDosesByCountry={vaccinationDosesByCountry}
                  vaccinationFlaggedByCountry={vaccinationFlaggedByCountry}
                  fastReportCountries={fastReportCountries}
                  onCountrySelect={handleCountrySelect}
                />
              )}

              {countryInfoBoxes.map((box) => {
                const coords = box.position || countryCoordinates[box.country];
                if (!coords) return null;

                return (
                  <Marker
                    key={`info-box-${box.country}`}
                    position={coords}
                    icon={createCountryOutbreakInfoBox(box.columns, box.newsCount)}
                    eventHandlers={{
                      click: () => {
                        const resolved = resolveFastReportCountry(
                          box.country,
                          fastReportCountries
                        );
                        openCountryPanel(resolved, box.country);
                      },
                    }}
                  >
                    <Popup maxWidth={280}>
                      <div className="p-2">
                        <h3 className="font-bold text-lg text-gray-800">{box.country}</h3>
                        <p className="text-xs text-green-700 mb-2">Click for country history</p>
                        <div className="space-y-1 text-sm">
                          {box.newsCount > 0 && (
                            <p>
                              <strong style={{ color: '#15736d' }}>BEACON:</strong> {box.newsCount}{' '}
                              report{box.newsCount === 1 ? '' : 's'}
                            </p>
                          )}
                          {box.columns.map((col) => (
                            <p key={col.disease}>
                              <strong style={{ color: col.color }}>{col.disease}:</strong> {col.count}{' '}
                              outbreak{col.count === 1 ? '' : 's'}
                            </p>
                          ))}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {filteredInfurData.length > 0 && (
                <InfurOutbreakLayer points={filteredInfurData} getDiseaseColor={getMarkerColor} />
              )}

              <MapZoomTracker onZoomChange={handleZoomChange} />
              <MapController
                countries={outbreakBoxCountries}
                countryCoordinates={countryCoordinates}
                skipFit={!!selectedCountry || pcpEnabled}
                pointCoords={selectedRegion === EUROPE_REGION ? infurPointCoords : []}
                preferEuropeFrame={
                  selectedRegion === 'all' || selectedRegion === EUROPE_REGION
                }
              />
              <FitToGeoJson
                geoJsonData={geoJsonData}
                enabled={pcpEnabled && pcpData.length > 0}
                skip={!!selectedCountry}
              />
            </MapContainer>

            {geoJsonError && (
              <div className="absolute top-3 left-3 right-3 z-[1000]">
                <div className="bg-amber-50 text-amber-900 text-xs px-3 py-2 rounded border border-amber-200">
                  Country boundaries unavailable ({geoJsonError}). Marker clicks still open country
                  history.
                </div>
              </div>
            )}

            {viewMode === 'historical' &&
              selectedRegion === EUROPE_REGION &&
              infurLoading &&
              filteredInfurData.length === 0 && (
              <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none">
                <div className="bg-white/95 text-gray-700 text-xs px-3 py-2 rounded border border-gray-200 shadow-sm">
                  Loading WAHIS-INFUR data for the selected period…
                </div>
              </div>
            )}
          </div>

          {selectedCountry && (
            <CollapsibleSidePanel
              title="Country"
              collapsed={countryPanelCollapsed}
              onToggleCollapse={() => setCountryPanelCollapsed((c) => !c)}
              onClose={closeCountryPanel}
              className={countryPanelCollapsed ? '' : 'w-full lg:w-96 xl:w-[420px]'}
            >
              <CountryAnalyticsPanel
                country={countryPanelApiKey}
                displayName={countryPanelDisplayName}
                hasFastReportMatch={!!selectedFastReportCountry}
                getDiseaseColor={getMarkerColor}
                beaconNews={selectedCountryBeaconNews}
                showBeaconNews={showBeacon}
              />
            </CollapsibleSidePanel>
          )}

          <CollapsibleSidePanel
            title="Filters"
            collapsed={filtersCollapsed}
            onToggleCollapse={() => setFiltersCollapsed((c) => !c)}
            className={filtersCollapsed ? '' : 'w-full lg:w-72 xl:w-80'}
          >
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region:</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Regions</option>
                  {availableRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                      {region === EUROPE_REGION ? ` (${WAHIS_INFUR_LABEL})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {viewMode === 'historical' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year:</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (
                        <option key={year} value={year.toString()}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarter:</label>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Diseases & Layers:</label>
                <div className="space-y-2">
                  {availableDiseases.map((disease) => (
                    <div key={disease} className="border border-gray-300 rounded-md overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleDisease(disease)}
                        className="w-full px-3 py-2 bg-white hover:bg-gray-50 flex items-center justify-between text-left"
                        style={{
                          backgroundColor: expandedDiseases.has(disease) ? '#f9fafb' : 'white',
                          borderLeft: `4px solid ${getMarkerColor(disease)}`,
                        }}
                      >
                        <span className="font-medium text-gray-800">{disease}</span>
                        <svg
                          className={`w-5 h-5 transition-transform ${expandedDiseases.has(disease) ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {expandedDiseases.has(disease) && (
                        <div className="px-3 py-2 bg-gray-50 space-y-2 border-t border-gray-200">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={diseaseLayers[disease]?.outbreaks || false}
                              onChange={() => toggleLayer(disease, 'outbreaks')}
                              className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                            />
                            <span className="text-sm text-gray-700">Outbreaks</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={diseaseLayers[disease]?.vaccination || false}
                              onChange={() => toggleLayer(disease, 'vaccination')}
                              className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                            />
                            <span className="text-sm text-gray-700">Vaccination</span>
                          </label>
                          {disease === 'FMD' && (
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={diseaseLayers[disease]?.pcpFmd || false}
                                onChange={() => toggleLayer(disease, 'pcpFmd')}
                                className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                              />
                              <span className="text-sm text-gray-700">PCP-FMD</span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`grid ${diseaseLayers['FMD']?.pcpFmd ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                <div className="bg-white rounded p-3 border border-gray-200">
                  <div className="font-medium text-gray-800 mb-2 text-xs">Disease Colors:</div>
                  <div className="grid grid-cols-1 gap-1">
                    {availableDiseases.map((disease) => (
                      <div key={disease} className="flex items-center">
                        <div
                          className="w-2.5 h-2.5 rounded-full border border-white mr-1.5 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: getMarkerColor(disease) }}
                        />
                        <span className="text-xs text-gray-700">{disease}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {diseaseLayers['FMD']?.pcpFmd && (
                  <div className="bg-white rounded p-3 border border-gray-200">
                    <div className="font-medium text-gray-800 mb-2 text-xs">
                      PCP Stages (2026)
                      {pcpData.length > 0 ? ` · ${pcpData.length} countries` : ''}:
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        ['#E41A1C', 'PCP-0'],
                        ['#F4C7A1', 'PCP-1-P'],
                        ['#F39C34', 'PCP-1'],
                        ['#F7E08C', 'PCP-2-P'],
                        ['#F1C40F', 'PCP-2'],
                        ['#A9D18E', 'PCP-3-P'],
                        ['#4CAF50', 'PCP-3'],
                        ['#2E7D32', 'PCP-4'],
                      ].map(([color, label]) => (
                        <div key={label} className="flex items-center">
                          <div
                            className="w-2.5 h-2.5 rounded-sm border border-white mr-1.5 flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-gray-700">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showVaccinationChoropleth && !diseaseLayers['FMD']?.pcpFmd && (
                  <div className="bg-white rounded p-3 border border-gray-200">
                    <div className="font-medium text-gray-800 mb-2 text-xs">Vaccination (hatch):</div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <div className="flex items-center gap-2">
                        <svg width="28" height="16" className="flex-shrink-0 border border-gray-200 rounded-sm">
                          <defs>
                            <pattern
                              id="legend-fast-vacc-hatch-flagged"
                              patternUnits="userSpaceOnUse"
                              width="10"
                              height="10"
                            >
                              <rect width="10" height="10" fill="rgba(180,83,9,0.14)" />
                              <circle cx="5" cy="5" r="1.6" fill="#b45309" />
                            </pattern>
                          </defs>
                          <rect width="28" height="16" fill="url(#legend-fast-vacc-hatch-flagged)" />
                        </svg>
                        <span className="text-xs text-gray-700">{VACC_FLAGGED_LABEL}</span>
                      </div>
                      {([1, 2, 3, 4] as VaccDoseBand[]).map((band) => {
                        const patternId = VACC_PATTERN_IDS[`band${band}` as keyof typeof VACC_PATTERN_IDS];
                        const sizes = [10, 8, 6, 5];
                        const strokes = [1, 1.4, 1.8, 2.2];
                        const size = sizes[band - 1];
                        const sw = strokes[band - 1];
                        return (
                          <div key={band} className="flex items-center gap-2">
                            <svg width="28" height="16" className="flex-shrink-0 border border-gray-200 rounded-sm">
                              <defs>
                                <pattern
                                  id={`legend-${patternId}`}
                                  patternUnits="userSpaceOnUse"
                                  width={size}
                                  height={size}
                                  patternTransform="rotate(45)"
                                >
                                  <rect width={size} height={size} fill="rgba(15,118,110,0.12)" />
                                  <line
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2={size}
                                    stroke="#0f766e"
                                    strokeWidth={sw}
                                  />
                                </pattern>
                              </defs>
                              <rect width="28" height="16" fill={`url(#legend-${patternId})`} />
                            </svg>
                            <span className="text-xs text-gray-700">{VACC_DOSE_BAND_LABELS[band]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSidePanel>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-700 italic">
            The boundaries and names shown and the designations used on this map do not imply the
            expression of any opinion whatsoever on the part of FAO concerning the legal status of any
            country, territory, city or area or of its authorities, or concerning the delimitation of its
            frontiers and boundaries.
          </p>
        </div>
      </div>

      {showBeacon && (
        <BeaconNewsPanel
          items={beaconNews}
          loading={beaconLoading}
          error={beaconError}
          regionLabel={
            selectedRegion === 'all'
              ? 'Europe and EuFMD neighbourhood countries'
              : selectedRegion === EUROPE_REGION
                ? 'European countries'
                : selectedRegion
          }
          diseaseLabels={beaconDiseaseCodes}
          getDiseaseColor={getMarkerColor}
        />
      )}
    </div>
  );
};

export default FastReport;
