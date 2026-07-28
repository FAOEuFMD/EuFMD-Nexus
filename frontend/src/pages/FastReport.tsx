
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

interface CountryCoordinates {
  [key: string]: [number, number];
}

const MapController: React.FC<{
  filteredData: FastReportData[];
  countryCoordinates: CountryCoordinates;
  skipFit: boolean;
}> = ({ filteredData, countryCoordinates, skipFit }) => {
  const map = useMap();

  useEffect(() => {
    if (skipFit) return;
    if (filteredData.length > 0) {
      const validCoords = filteredData
        .map((item) => countryCoordinates[item.Country])
        .filter((coord) => coord);

      if (validCoords.length > 0) {
        const group = new L.FeatureGroup(validCoords.map((coord) => L.marker(coord)));
        map.fitBounds(group.getBounds().pad(0.1));
      }
    } else {
      map.setView([50, 20], 3);
    }
  }, [map, filteredData, countryCoordinates, skipFit]);

  return null;
};

const FastReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FastReportData[]>([]);
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
  const [expandedDiseases, setExpandedDiseases] = useState<Set<string>>(new Set());

  const [mapZoom, setMapZoom] = useState(6);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedGeoName, setSelectedGeoName] = useState<string | null>(null);
  const [selectedFastReportCountry, setSelectedFastReportCountry] = useState<string | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [countryPanelCollapsed, setCountryPanelCollapsed] = useState(false);

  const fastReportCountries = useMemo(
    () => Array.from(new Set(data.map((item) => item.Country).filter(Boolean))),
    [data]
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

  const handleMarkerCountryClick = useCallback(
    (country: string) => {
      openCountryPanel(country, null);
    },
    [openCountryPanel]
  );

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(data.map((item) => item.Year))).sort((a, b) => b - a);
    return years;
  }, [data]);

  const availableDiseases = useMemo(() => {
    const diseases = Array.from(new Set(data.map((item) => item.Disease).filter(Boolean)));
    const order = ['FMD', 'PPR', 'LSD', 'SPGP', 'RVF', 'BEF'];

    return diseases.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [data]);

  const availableRegions = useMemo(() => {
    const regions = Array.from(new Set(data.map((item) => item.Region).filter(Boolean))).sort();
    return regions;
  }, [data]);

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

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const yearMatch = selectedYear === 'all' || item.Year?.toString() === selectedYear;
      const quarterMatch = selectedQuarter === 'all' || item.Quarter?.toString() === selectedQuarter;
      const regionMatch = selectedRegion === 'all' || item.Region === selectedRegion;

      const diseaseLayers_check = diseaseLayers[item.Disease];
      const diseaseMatch =
        !diseaseLayers_check ||
        diseaseLayers_check.outbreaks ||
        diseaseLayers_check.vaccination ||
        diseaseLayers_check.status;

      return yearMatch && quarterMatch && diseaseMatch && regionMatch;
    });
  }, [data, selectedYear, selectedQuarter, selectedRegion, diseaseLayers]);

  const markerData = useMemo(() => {
    return filteredData.filter((item) => {
      if (!diseaseLayers[item.Disease]?.outbreaks) return false;
      if (!item.Outbreaks) return false;
      const outbreaksStr = String(item.Outbreaks).trim();
      if (outbreaksStr === '' || outbreaksStr === '0' || outbreaksStr.toLowerCase() === 'null') return false;
      const outbreaksNum = parseInt(outbreaksStr, 10);
      return !isNaN(outbreaksNum) && outbreaksNum > 0;
    });
  }, [filteredData, diseaseLayers]);

  const vaccinationData = useMemo(() => {
    return filteredData.filter((item) => {
      if (!diseaseLayers[item.Disease]?.vaccination) return false;
      const doses = Number(item.Vaccination_Doses || 0);
      return doses > 0;
    });
  }, [filteredData, diseaseLayers]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const coordsResponse = await fetch('/country-coordinates.json');
        const coords = await coordsResponse.json();
        setCountryCoordinates(coords);

        const response = await fetch('/api/fast-report/create-dashboard');

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const dashboardData = await response.json();

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
    const loadGeoJson = async () => {
      if (geoJsonData) return;
      try {
        const geoResponse = await fetch('/gadm.geojson');
        if (!geoResponse.ok) {
          throw new Error(`GeoJSON not found (${geoResponse.status})`);
        }
        const geoData = await geoResponse.json();
        setGeoJsonData(geoData);
        setGeoJsonError(null);
      } catch (geoErr: unknown) {
        const message = geoErr instanceof Error ? geoErr.message : 'Failed to load map boundaries';
        console.error('Error loading GeoJSON:', message);
        setGeoJsonError(message);
      }
    };

    loadGeoJson();
  }, [geoJsonData]);

  useEffect(() => {
    if (availableDiseases.length > 0 && Object.keys(diseaseLayers).length === 0) {
      const initialLayers: {
        [disease: string]: { outbreaks: boolean; vaccination: boolean; status: boolean; pcpFmd: boolean };
      } = {};
      availableDiseases.forEach((disease) => {
        initialLayers[disease] = {
          outbreaks: true,
          vaccination: false,
          status: false,
          pcpFmd: false,
        };
      });
      setDiseaseLayers(initialLayers);
    }
  }, [availableDiseases, diseaseLayers]);

  useEffect(() => {
    const loadPcpData = async () => {
      if (!diseaseLayers['FMD']?.pcpFmd) return;
      try {
        const pcpResponse = await fetch('/api/pcp/pcp-fmd-2026');
        const pcpResult = await pcpResponse.json();
        setPcpData(pcpResult.data || []);
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
    return colors[stage] || '#CCCCCC';
  };

  const getMarkerColor = (disease: string): string => {
    const colors: { [key: string]: string } = {
      FMD: '#006400',
      LSD: '#90EE90',
      PPR: '#9370DB',
      RVF: '#DC143C',
      SPGP: '#4169E1',
      BEF: '#888888',
      ASF: '#4444ff',
      LUMPY: '#ffff44',
      'Avian Influenza': '#ff8844',
      'Newcastle Disease': '#8844ff',
      default: '#888888',
    };
    return colors[disease] || colors.default;
  };

  /** Offset markers by disease so they don't overlap on the same country coordinate.
   *  Units are degrees lat/lng — small enough to stay within the country area. */
  const DISEASE_OFFSETS: Record<string, [number, number]> = {
    FMD: [0, 0],           // center
    PPR: [-0.2, 1.2],      // → right
    LSD: [0, -1.2],        // ← left
    RVF: [1.2, 0],         // ↑ up
    SPGP: [-1.2, 0],       // ↓ down
    BEF: [0.6, -0.8],      // ↗ up-right
    ASF: [0.6, 0.8],       // ↘ down-right
    LUMPY: [-0.6, 0.8],    // ↙ down-left
    'Avian Influenza': [-0.6, -0.8],  // ↖ up-left
    'Newcastle Disease': [0.4, -1.0],  // left-up
  };
  const getDiseaseOffset = (disease: string): [number, number] =>
    DISEASE_OFFSETS[disease] || [0, 0];

  const createCustomMarker = (disease: string, outbreaks: string) => {
    const color = getMarkerColor(disease);

    let outbreaksNum = 0;
    if (outbreaks) {
      const outbreaksStr = String(outbreaks).trim();
      if (outbreaksStr !== '' && outbreaksStr.toLowerCase() !== 'null') {
        const parsed = parseInt(outbreaksStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          outbreaksNum = parsed;
        }
      }
    }

    const size = Math.min(30, 15 + outbreaksNum * 2);

    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${outbreaksNum > 0 ? outbreaksNum : ''}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  const createSyringeMarker = (disease: string, doses: number | string) => {
    const color = getMarkerColor(disease);

    let displayDoses = '';
    if (doses) {
      const dosesNum = typeof doses === 'string' ? parseInt(doses, 10) : doses;
      if (!isNaN(dosesNum) && dosesNum > 0) {
        if (dosesNum >= 1000000) {
          displayDoses = (dosesNum / 1000000).toFixed(1) + 'M';
        } else if (dosesNum >= 1000) {
          displayDoses = (dosesNum / 1000).toFixed(0) + 'K';
        } else {
          displayDoses = dosesNum.toString();
        }
      }
    }

    return L.divIcon({
      className: 'custom-syringe-marker',
      html: `
        <div style="
          display: flex;
          flex-direction: row;
          align-items: center;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
          height: 40px;
        ">
          <!-- Needle (pointing left) -->
          <div style="
            width: 16px;
            height: 4px;
            background: ${color};
            border: 1.5px solid white;
            border-right: none;
            border-radius: 3px 0 0 3px;
            box-sizing: content-box;
          "></div>
          <!-- Barrel / Body with dose number -->
          <div style="
            background: ${color};
            color: white;
            font-size: 13px;
            font-weight: 800;
            padding: 6px 14px;
            border-radius: 4px;
            border: 2px solid white;
            white-space: nowrap;
            min-width: 28px;
            text-align: center;
          ">
            ${displayDoses || ''}
          </div>
          <!-- Plunger handle (right side) -->
          <div style="
            width: 8px;
            height: 14px;
            background: ${color};
            border: 2px solid white;
            border-left: none;
            border-radius: 0 4px 4px 0;
          "></div>
        </div>
      `,
      iconSize: [80, 40],
      iconAnchor: [40, 20],
    });
  };

  const handleZoomChange = useCallback((zoom: number) => {
    setMapZoom(zoom);
  }, []);

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

  if (data.length === 0 && !loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-gray-600 text-xl mb-4">No Data Available</div>
        <p className="text-gray-600">No fast report data found in the database.</p>
      </div>
    );
  }

  const countryPanelDisplayName = selectedCountry || '';
  const countryPanelApiKey = selectedFastReportCountry || selectedCountry || '';

  return (
    <div className="w-full space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Fast Report Dashboard</h2>
        <p className="text-gray-600">
          Interactive map showing disease outbreak reports across regions. Zoom in and click a country
          for historical trends, or use filters to explore specific years, diseases, or regions.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-0">
          <div className="flex-1 min-w-0 h-96 lg:h-[600px] relative">
            <MapContainer
              center={[47, 28]}
              zoom={6}
              scrollWheelZoom={true}
              className="h-full w-full"
              zoomControl={true}
              doubleClickZoom={true}
              touchZoom={true}
            >
              <TileLayer
                url="https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; United Nations Geospatial Information Section"
                maxZoom={18}
              />

              {geoJsonData && (
                <CountryBoundariesLayer
                  geoJsonData={geoJsonData}
                  mapZoom={mapZoom}
                  selectedCountry={selectedFastReportCountry}
                  selectedGeoName={selectedGeoName}
                  showPcpStyling={!!diseaseLayers['FMD']?.pcpFmd}
                  pcpData={pcpData}
                  getPcpStageColor={getPcpStageColor}
                  fastReportCountries={fastReportCountries}
                  onCountrySelect={handleCountrySelect}
                />
              )}

              {markerData.map((report) => {
                const coords = countryCoordinates[report.Country];
                if (!coords) return null;
                const offset = getDiseaseOffset(report.Disease);
                const offsetCoords: [number, number] = [coords[0] + offset[0], coords[1] + offset[1]];

                return (
                  <Marker
                    key={`${report.id}-${report.Country}-${report.Disease}`}
                    position={offsetCoords}
                    icon={createCustomMarker(report.Disease, report.Outbreaks)}
                    eventHandlers={{
                      click: () => handleMarkerCountryClick(report.Country),
                    }}
                  >
                    <Popup maxWidth={300}>
                      <div className="p-2">
                        <h3 className="font-bold text-lg text-gray-800">{report.Country}</h3>
                        <p className="text-xs text-green-700 mb-2">Click marker for country history</p>
                        <div className="space-y-1 text-sm">
                          <p><strong>Disease:</strong> {report.Disease}</p>
                          <p><strong>Year:</strong> {report.Year} Q{report.Quarter}</p>
                          <p><strong>Outbreaks:</strong> {report.Outbreaks}</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {vaccinationData.map((report) => {
                const coords = countryCoordinates[report.Country];
                if (!coords) return null;

                const vaccinationCoords: [number, number] = [coords[0] + 2, coords[1]];

                return (
                  <Marker
                    key={`vacc-${report.id}-${report.Country}-${report.Disease}`}
                    position={vaccinationCoords}
                    icon={createSyringeMarker(report.Disease, report.Vaccination_Doses || 0)}
                    eventHandlers={{
                      click: () => handleMarkerCountryClick(report.Country),
                    }}
                  >
                    <Popup maxWidth={300}>
                      <div className="p-2">
                        <h3 className="font-bold text-lg text-gray-800">{report.Country}</h3>
                        <p className="text-xs text-green-700 mb-2">Click marker for country history</p>
                        <div className="space-y-1 text-sm">
                          <p><strong>Disease:</strong> {report.Disease}</p>
                          <p><strong>Doses:</strong> {Number(report.Vaccination_Doses).toLocaleString()}</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              <MapZoomTracker onZoomChange={handleZoomChange} />
              <MapController
                filteredData={markerData}
                countryCoordinates={countryCoordinates}
                skipFit={!!selectedCountry}
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
              />
            </CollapsibleSidePanel>
          )}

          <CollapsibleSidePanel
            title="Filters"
            collapsed={filtersCollapsed}
            onToggleCollapse={() => setFiltersCollapsed((c) => !c)}
            className={filtersCollapsed ? '' : 'w-full lg:w-72 xl:w-80'}
          >
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
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
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-sm text-gray-600 bg-white rounded p-3 border border-gray-200">
                    <div className="font-medium text-gray-800 mb-1">Results:</div>
                    Showing <span className="font-bold text-green-600">{filteredData.length}</span> report
                    {filteredData.length !== 1 ? 's' : ''}
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
                        <div className="font-medium text-gray-800 mb-2 text-xs">PCP Stages:</div>
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
                  </div>
                </div>

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
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={diseaseLayers[disease]?.status || false}
                                onChange={() => toggleLayer(disease, 'status')}
                                className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                              />
                              <span className="text-sm text-gray-700">Disease Status</span>
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

      {filteredData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 text-gray-800">Summary Statistics:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{filteredData.length}</div>
              <div className="text-sm text-gray-600">Total Reports</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">
                {filteredData.reduce((sum, item) => sum + parseInt(item.Outbreaks || '0', 10), 0)}
              </div>
              <div className="text-sm text-gray-600">Total Outbreaks</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {Array.from(new Set(filteredData.map((item) => item.Country))).length}
              </div>
              <div className="text-sm text-gray-600">Countries Affected</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {Array.from(new Set(filteredData.map((item) => item.Disease))).length}
              </div>
              <div className="text-sm text-gray-600">Diseases Reported</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FastReport;
