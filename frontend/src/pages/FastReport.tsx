
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
  Vaccination_Description: string;
  Source: string;
}

interface CountryCoordinates {
  [key: string]: [number, number];
}

// Static country coordinates for target regions (Europe, West Eurasia, Central Asia, South Asia, North Africa, Near East)
const countryCoordinates: CountryCoordinates = {
  'Afghanistan': [33.9391, 67.7100],
  'Algeria': [28.0339, 1.6596],
  'Armenia': [40.0691, 45.0382],
  'Azerbaijan': [40.1431, 47.5769],
  'Georgia': [42.3154, 43.3569],
  'Iran': [32.4279, 53.6880],
  'Iraq': [33.2232, 43.6793],
  'Jordan': [30.5852, 36.2384],
  'Lebanon': [33.8547, 35.8623],
  'Pakistan': [30.3753, 69.3451],
  'Palestine': [31.9522, 35.2332],
  'Palestine, State of': [31.9522, 35.2332],
  'Syria': [34.8021, 38.9968],
  'Syrian Arab Republic': [34.8021, 38.9968],
  'Turkey': [38.9637, 35.2433],
  'Egypt': [26.8206, 30.8025],
  'Libya': [26.3351, 17.2283],
  'Morocco': [31.7917, -7.0926],
  'Sudan': [12.8628, 30.2176],
  'Tunisia': [33.8869, 9.5375],
};

const MapController: React.FC<{ filteredData: FastReportData[] }> = ({ filteredData }) => {
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
  }, [map, filteredData]);
  
  return null;
};

const FastReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FastReportData[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedDisease, setSelectedDisease] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  // Get available years, diseases, and regions from data
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(data.map(item => item.Year))).sort((a, b) => b - a);
    return years;
  }, [data]);

  const availableDiseases = useMemo(() => {
    const diseases = Array.from(new Set(data.map(item => item.Disease).filter(Boolean))).sort();
    return diseases;
  }, [data]);

  const availableRegions = useMemo(() => {
    const regions = Array.from(new Set(data.map(item => item.Region).filter(Boolean))).sort();
    return regions;
  }, [data]);

  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const yearMatch = selectedYear === 'all' || item.Year?.toString() === selectedYear;
      const diseaseMatch = selectedDisease === 'all' || item.Disease === selectedDisease;
      const regionMatch = selectedRegion === 'all' || item.Region === selectedRegion;
      return yearMatch && diseaseMatch && regionMatch;
    });
  }, [data, selectedYear, selectedDisease, selectedRegion]);
  
  // Data to use for markers - only include entries with actual outbreaks
  const markerData = useMemo(() => {
    return filteredData.filter(item => {
      if (!item.Outbreaks) return false;
      const outbreaksStr = String(item.Outbreaks).trim();
      if (outbreaksStr === '' || outbreaksStr === '0' || outbreaksStr.toLowerCase() === 'null') return false;
      const outbreaksNum = parseInt(outbreaksStr, 10);
      return !isNaN(outbreaksNum) && outbreaksNum > 0;
    });
  }, [filteredData]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
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

  const getMarkerColor = (disease: string): string => {
    const colors: { [key: string]: string } = {
      'FMD': '#ff4444',
      'ASF': '#4444ff', 
      'PPR': '#44ff44',
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
              Disease:
            </label>
            <select
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Diseases</option>
              {availableDiseases.map(disease => (
                <option key={disease} value={disease}>{disease}</option>
              ))}
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
          
          <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
            Showing <span className="font-bold">{filteredData.length}</span> report{filteredData.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="h-96 w-full">
          <MapContainer
            center={[50, 20]}
            zoom={3}
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
            
            <MapController filteredData={markerData} />
          </MapContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3 text-gray-800">Disease Legend:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {availableDiseases.map(disease => (
            <div key={disease} className="flex items-center">
              <div 
                className="w-4 h-4 rounded-full border border-white mr-2 shadow"
                style={{ backgroundColor: getMarkerColor(disease) }}
              ></div>
              <span className="text-sm">{disease}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <strong>Note:</strong> Marker size indicates the number of outbreaks. 
            Larger markers represent more outbreak reports.
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
