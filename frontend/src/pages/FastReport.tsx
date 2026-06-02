
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface FastReportData {
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

const MapController: React.FC<{ filteredData: FastReportData[], countryCoordinates: CountryCoordinates }> = ({ filteredData, countryCoordinates }) => {
  const map = useMap();
  
  useEffect(() => {
    if (filteredData.length > 0) {
      const validCoords = filteredData
        .map(item => countryCoordinates[item.Country])
        .filter(coord => coord);
      
      if (validCoords.length > 0) {
        const group = new L.FeatureGroup(validCoords.map(coord => L.marker(coord)));
        map.fitBounds(group.getBounds().pad(0.1));
      }
    } else {
      map.setView([50, 20], 3);
    }
  }, [map, filteredData, countryCoordinates]);
  
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
  
  // Disease layer selections: { disease: { outbreaks: bool, vaccination: bool, status: bool } }
  const [diseaseLayers, setDiseaseLayers] = useState<{
    [disease: string]: { outbreaks: boolean; vaccination: boolean; status: boolean };
  }>({});
  const [expandedDiseases, setExpandedDiseases] = useState<Set<string>>(new Set());

  // Get available years, diseases, and regions from data
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(data.map(item => item.Year))).sort((a, b) => b - a);
    return years;
  }, [data]);

  const availableDiseases = useMemo(() => {
    const diseases = Array.from(new Set(data.map(item => item.Disease).filter(Boolean)));
    
    // Define preferred order
    const order = ['FMD', 'PPR', 'LSD', 'SPGP', 'RVF', 'BEF'];
    
    return diseases.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      
      // If both are in the order array, sort by order
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // If only a is in order, it comes first
      if (indexA !== -1) return -1;
      // If only b is in order, it comes first
      if (indexB !== -1) return 1;
      // Otherwise, sort alphabetically
      return a.localeCompare(b);
    });
  }, [data]);

  const availableRegions = useMemo(() => {
    const regions = Array.from(new Set(data.map(item => item.Region).filter(Boolean))).sort();
    return regions;
  }, [data]);

  // Toggle disease expansion
  const toggleDisease = (disease: string) => {
    const newExpanded = new Set(expandedDiseases);
    if (newExpanded.has(disease)) {
      newExpanded.delete(disease);
    } else {
      newExpanded.add(disease);
    }
    setExpandedDiseases(newExpanded);
  };

  // Toggle disease layer
  const toggleLayer = (disease: string, layer: 'outbreaks' | 'vaccination' | 'status') => {
    setDiseaseLayers(prev => ({
      ...prev,
      [disease]: {
        outbreaks: layer === 'outbreaks' ? !prev[disease]?.outbreaks : prev[disease]?.outbreaks || false,
        vaccination: layer === 'vaccination' ? !prev[disease]?.vaccination : prev[disease]?.vaccination || false,
        status: layer === 'status' ? !prev[disease]?.status : prev[disease]?.status || false,
      }
    }));
  };

  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const yearMatch = selectedYear === 'all' || item.Year?.toString() === selectedYear;
      const quarterMatch = selectedQuarter === 'all' || item.Quarter?.toString() === selectedQuarter;
      const regionMatch = selectedRegion === 'all' || item.Region === selectedRegion;
      
      // Check if any layer is enabled for this disease
      const diseaseLayers_check = diseaseLayers[item.Disease];
      const diseaseMatch = !diseaseLayers_check || 
        diseaseLayers_check.outbreaks || 
        diseaseLayers_check.vaccination || 
        diseaseLayers_check.status;
      
      return yearMatch && quarterMatch && diseaseMatch && regionMatch;
    });
  }, [data, selectedYear, selectedQuarter, selectedRegion, diseaseLayers]);
  
  // Data to use for markers - only include entries with actual outbreaks AND outbreak layer enabled
  const markerData = useMemo(() => {
    return filteredData.filter(item => {
      // Check if outbreak layer is enabled for this disease
      if (!diseaseLayers[item.Disease]?.outbreaks) return false;
      
      if (!item.Outbreaks) return false;
      const outbreaksStr = String(item.Outbreaks).trim();
      if (outbreaksStr === '' || outbreaksStr === '0' || outbreaksStr.toLowerCase() === 'null') return false;
      const outbreaksNum = parseInt(outbreaksStr, 10);
      return !isNaN(outbreaksNum) && outbreaksNum > 0;
    });
  }, [filteredData, diseaseLayers]);

  // Data for vaccination markers - only include entries with vaccination doses AND vaccination layer enabled
  const vaccinationData = useMemo(() => {
    return filteredData.filter(item => {
      // Check if vaccination layer is enabled for this disease
      if (!diseaseLayers[item.Disease]?.vaccination) return false;
      
      // Check if there are vaccination doses
      const doses = Number(item.Vaccination_Doses || 0);
      return doses > 0;
    });
  }, [filteredData, diseaseLayers]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load country coordinates from JSON file
        const coordsResponse = await fetch('/country-coordinates.json');
        const coords = await coordsResponse.json();
        setCountryCoordinates(coords);
        
        console.log('Attempting to fetch data from API...');
        const response = await fetch('/api/fast-report/create-dashboard');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const dashboardData = await response.json();
        
        // Validate API response structure
        if (dashboardData && dashboardData.data && Array.isArray(dashboardData.data)) {
          console.log("Successfully loaded API data:", dashboardData.data.length, "records");
          setData(dashboardData.data);
        } else if (dashboardData && Array.isArray(dashboardData)) {
          // Handle case where API returns array directly
          console.log("Successfully loaded API data (direct array):", dashboardData.length, "records");
          setData(dashboardData);
        } else {
          console.warn("Invalid API data format:", dashboardData);
          throw new Error('Invalid API response format - expected array or {data: array}');
        }
      } catch (err: any) {
        console.error('Failed to fetch from API:', err.message);
        setError(`Unable to load data: ${err.message}`);
        setData([]); // No fallback data - show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Initialize disease layers when diseases are available
  useEffect(() => {
    if (availableDiseases.length > 0 && Object.keys(diseaseLayers).length === 0) {
      const initialLayers: { [disease: string]: { outbreaks: boolean; vaccination: boolean; status: boolean } } = {};
      availableDiseases.forEach(disease => {
        initialLayers[disease] = {
          outbreaks: true,  // Default: show outbreaks
          vaccination: false,
          status: false
        };
      });
      setDiseaseLayers(initialLayers);
    }
  }, [availableDiseases, diseaseLayers]);

  const getMarkerColor = (disease: string): string => {
    const colors: { [key: string]: string } = {
      'FMD': '#006400',      // dark green
      'LSD': '#90EE90',      // light green
      'PPR': '#9370DB',      // purple
      'RVF': '#DC143C',      // red
      'SPGP': '#4169E1',     // blue
      'BEF': '#888888',      // grey
      'ASF': '#4444ff', 
      'LUMPY': '#ffff44',
      'Avian Influenza': '#ff8844',
      'Newcastle Disease': '#8844ff',
      'default': '#888888'
    };
    return colors[disease] || colors.default;
  };

  const createCustomMarker = (disease: string, outbreaks: string) => {
    const color = getMarkerColor(disease);
    
    // Parse outbreaks, ensure it's a positive number
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
    
    // Size based on number of outbreaks (minimum 15px)
    const size = Math.min(30, 15 + outbreaksNum * 2);
    
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${outbreaksNum > 0 ? outbreaksNum : ''}</div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  };

  const createSyringeMarker = (disease: string, doses: number | string) => {
    const color = getMarkerColor(disease);
    
    // Format doses - convert to K/M for display
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
    
    // Syringe icon SVG - larger size
    const syringeIcon = `
      <svg width="50" height="50" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5">
        <path d="M6 10l-2-2 1.5-1.5L7 8l3-3-1.5-1.5L10 2l4 4-1.5 1.5L9 4 6 7l1.5 1.5L6 10z"/>
        <rect x="7" y="10" width="4" height="8" rx="1" fill="${color}"/>
        <rect x="8.5" y="18" width="1" height="3" fill="${color}"/>
        <line x1="7.5" y1="13" x2="10.5" y2="13" stroke="white" stroke-width="0.5"/>
        <line x1="7.5" y1="15" x2="10.5" y2="15" stroke="white" stroke-width="0.5"/>
      </svg>
    `;
    
    return L.divIcon({
      className: 'custom-syringe-marker',
      html: `
        <div style="position: relative; width: 60px; height: 60px;">
          <div style="position: absolute; top: 0; left: 5px;">
            ${syringeIcon}
          </div>
          ${displayDoses ? `
            <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background-color: ${color}; color: white; font-size: 11px; font-weight: bold; padding: 3px 6px; border-radius: 4px; border: 1.5px solid white; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
              ${displayDoses}
            </div>
          ` : ''}
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 60]
    });
  };

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
          <p className="mt-2 text-sm">Check the browser console for more details.</p>
        </div>
      </div>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-gray-600 text-xl mb-4">No Data Available</div>
        <div className="text-gray-600">
          <p>No fast report data found in the database.</p>
          <p className="mt-2 text-sm">Please check if data has been submitted through the data entry forms.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Fast Report Dashboard</h2>
        <p className="text-gray-600">
          Interactive map showing disease outbreak reports across regions. Use filters to explore specific years, diseases, or regions.
        </p>
      </div>

      {/* Map and Filters Side-by-Side */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-0">
          {/* Map - Left side, smaller width */}
          <div className="w-full lg:w-2/3 h-96 lg:h-[600px]">
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
            
            {markerData.map((report) => {
              const coords = countryCoordinates[report.Country];
              if (!coords) return null;
              
              return (
                <Marker
                  key={`${report.id}-${report.Country}-${report.Disease}`}
                  position={coords}
                  icon={createCustomMarker(report.Disease, report.Outbreaks)}
                >
                  <Popup maxWidth={300}>
                    <div className="p-2">
                      <h3 className="font-bold text-lg text-gray-800">{report.Country}</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Disease:</strong> {report.Disease}</p>
                        <p><strong>Year:</strong> {report.Year} Q{report.Quarter}</p>
                        <p><strong>Region:</strong> {report.Region}</p>
                        <p><strong>Outbreaks:</strong> {report.Outbreaks}</p>
                        <p><strong>Cases:</strong> {report.Cases}</p>
                        {report.Vaccination && (
                          <p><strong>Vaccination:</strong> {report.Vaccination === 1 ? 'Yes' : 'No'}</p>
                        )}
                        {report.Outbreak_Description && (
                          <div className="mt-2">
                            <strong>Description:</strong>
                            <p className="text-gray-600 mt-1">{report.Outbreak_Description}</p>
                          </div>
                        )}
                        {report.Source && (
                          <p className="text-xs text-gray-500 mt-2"><strong>Source:</strong> {report.Source}</p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {/* Vaccination markers - positioned above country centers */}
            {vaccinationData.map((report) => {
              const coords = countryCoordinates[report.Country];
              if (!coords) return null;
              
              // Offset latitude by +2 degrees to position above the outbreak marker
              const vaccinationCoords: [number, number] = [coords[0] + 2, coords[1]];
              
              return (
                <Marker
                  key={`vacc-${report.id}-${report.Country}-${report.Disease}`}
                  position={vaccinationCoords}
                  icon={createSyringeMarker(report.Disease, report.Vaccination_Doses || 0)}
                >
                  <Popup maxWidth={300}>
                    <div className="p-2">
                      <h3 className="font-bold text-lg text-gray-800">{report.Country}</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Disease:</strong> {report.Disease}</p>
                        <p><strong>Year:</strong> {report.Year} Q{report.Quarter}</p>
                        <p><strong>Region:</strong> {report.Region}</p>
                        <p><strong>Vaccination:</strong> Yes</p>
                        {report.Vaccination_Doses && (
                          <p><strong>Doses Administered:</strong> {Number(report.Vaccination_Doses).toLocaleString()}</p>
                        )}
                        {report.Vaccination_Description && (
                          <div className="mt-2">
                            <strong>Vaccination Details:</strong>
                            <p className="text-gray-600 mt-1">{report.Vaccination_Description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            <MapController filteredData={markerData} countryCoordinates={countryCoordinates} />
          </MapContainer>
          </div>

          {/* Filters - Right side, wider with 2 columns inside */}
          <div className="w-full lg:w-1/3 bg-gray-50 p-4 border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto lg:h-[600px]">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
            
            {/* 2 Column Grid for filters */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left Column - Basic Filters */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quarter:
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region:
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">All Regions</option>
                    {availableRegions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                
                <div className="text-sm text-gray-600 bg-white rounded p-3 border border-gray-200">
                  <div className="font-medium text-gray-800 mb-1">Results:</div>
                  Showing <span className="font-bold text-green-600">{filteredData.length}</span> report{filteredData.length !== 1 ? 's' : ''}
                </div>
                
                {/* Compact Legend */}
                <div className="bg-white rounded p-3 border border-gray-200">
                  <div className="font-medium text-gray-800 mb-2 text-sm">Disease Colors:</div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {availableDiseases.map(disease => (
                      <div key={disease} className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full border border-white mr-2 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: getMarkerColor(disease) }}
                        ></div>
                        <span className="text-xs text-gray-700">{disease}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Right Column - Disease Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diseases & Layers:
                </label>
                <div className="space-y-2">
                  {availableDiseases.map(disease => (
                    <div key={disease} className="border border-gray-300 rounded-md overflow-hidden">
                      {/* Disease Header - Collapsable */}
                      <button
                        onClick={() => toggleDisease(disease)}
                        className="w-full px-3 py-2 bg-white hover:bg-gray-50 flex items-center justify-between text-left"
                        style={{ 
                          backgroundColor: expandedDiseases.has(disease) ? '#f9fafb' : 'white',
                          borderLeft: `4px solid ${getMarkerColor(disease)}`
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
                      
                      {/* Layer Options - Expandable */}
                      {expandedDiseases.has(disease) && (
                        <div className="px-3 py-2 bg-gray-50 space-y-2 border-t border-gray-200">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={diseaseLayers[disease]?.outbreaks || false}
                              onChange={() => toggleLayer(disease, 'outbreaks')}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">Outbreaks</span>
                          </label>
                          
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={diseaseLayers[disease]?.vaccination || false}
                              onChange={() => toggleLayer(disease, 'vaccination')}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Vaccination</span>
                          </label>
                          
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={diseaseLayers[disease]?.status || false}
                              onChange={() => toggleLayer(disease, 'status')}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">Disease Status</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Map Disclaimer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-700 italic">
            The boundaries and names shown and the designations used on this map do not imply the 
            expression of any opinion whatsoever on the part of FAO concerning the legal status of any country, 
            territory, city or area or of its authorities, or concerning the delimitation of its frontiers and 
            boundaries.
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      {filteredData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 text-gray-800">Summary Statistics:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {filteredData.length}
              </div>
              <div className="text-sm text-gray-600">Total Reports</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">
                {filteredData.reduce((sum, item) => sum + parseInt(item.Outbreaks || '0'), 0)}
              </div>
              <div className="text-sm text-gray-600">Total Outbreaks</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {Array.from(new Set(filteredData.map(item => item.Country))).length}
              </div>
              <div className="text-sm text-gray-600">Countries Affected</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {Array.from(new Set(filteredData.map(item => item.Disease))).length}
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
