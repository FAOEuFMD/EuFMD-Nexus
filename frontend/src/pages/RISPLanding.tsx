import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '../stores/authStore';

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

interface VaccinationData {
  Country: string;
  Disease: string;
  Year: number;
  Region: string;
}

interface SurveillanceData {
  Country: string;
  Disease: string;
  Year: number;
  Region: string;
}

type ViewModeType = 'default' | 'outbreaks' | 'vaccination' | 'surveillance';

// Region mapping for countries
const countryToRegion: { [key: string]: string } = {
  // South East European Neighbourhood (SEEN)
  'Armenia': 'South East European Neighbourhood (SEEN)',
  'Azerbaijan': 'South East European Neighbourhood (SEEN)',
  'Georgia': 'South East European Neighbourhood (SEEN)',
  'Iran (Islamic Republic of)': 'South East European Neighbourhood (SEEN)',
  'Iran': 'South East European Neighbourhood (SEEN)', // Alternative name
  'Iraq': 'South East European Neighbourhood (SEEN)',
  'Pakistan': 'South East European Neighbourhood (SEEN)',
  'Türkiye': 'South East European Neighbourhood (SEEN)',
  'Turkey': 'South East European Neighbourhood (SEEN)', // Alternative name
  
  // Near East
  'Egypt': 'Near East',
  'Jordan': 'Near East',
  'Lebanon': 'Near East',
  'Palestine, State of': 'Near East',
  'Palestine': 'Near East', // Alternative name
  'Syrian Arab Republic': 'Near East',
  'Syria': 'Near East', // Alternative name
  
  // North Africa
  'Algeria': 'North Africa',
  'Libya': 'North Africa',
  'Mauritania': 'North Africa',
  'Morocco': 'North Africa',
  'Tunisia': 'North Africa',
};

// Static country coordinates for major countries (same as FastReport)
const countryCoordinates: CountryCoordinates = {
  'Afghanistan': [33.9391, 67.7100],
  'Albania': [41.1533, 20.1683],
  'Algeria': [28.0339, 1.6596],
  'Armenia': [40.0691, 45.0382],
  'Azerbaijan': [40.1431, 47.5769],
  'Bangladesh': [23.6850, 90.3563],
  'Belarus': [53.7098, 27.9534],
  'Bosnia and Herzegovina': [43.9159, 17.6791],
  'Bulgaria': [42.7339, 25.4858],
  'China': [35.8617, 104.1954],
  'Croatia': [45.1000, 15.2000],
  'Czech Republic': [49.8175, 15.4730],
  'Estonia': [58.5953, 25.0136],
  'Georgia': [42.3154, 43.3569],
  'Germany': [51.1657, 10.4515],
  'Greece': [39.0742, 21.8243],
  'Hungary': [47.1625, 19.5033],
  'India': [20.5937, 78.9629],
  'Iran': [32.4279, 53.6880],
  'Iraq': [33.2232, 43.6793],
  'Italy': [41.8719, 12.5674],
  'Kazakhstan': [48.0196, 66.9237],
  'Kyrgyzstan': [41.2044, 74.7661],
  'Latvia': [56.8796, 24.6032],
  'Lithuania': [55.1694, 23.8813],
  'Moldova': [47.4116, 28.3699],
  'Mongolia': [46.8625, 103.8467],
  'Montenegro': [42.7087, 19.3744],
  'North Macedonia': [41.6086, 21.7453],
  'Pakistan': [30.3753, 69.3451],
  'Poland': [51.9194, 19.1451],
  'Romania': [45.9432, 24.9668],
  'Russia': [61.5240, 105.3188],
  'Serbia': [44.0165, 21.0059],
  'Slovakia': [48.6690, 19.6990],
  'Slovenia': [46.1512, 14.9955],
  'Tajikistan': [38.8610, 71.2761],
  'Turkey': [38.9637, 35.2433],
  'Turkmenistan': [38.9697, 59.5563],
  'Ukraine': [48.3794, 31.1656],
  'United Kingdom': [55.3781, -3.4360],
  'Uzbekistan': [41.3775, 64.5853],
  'Vietnam': [14.0583, 108.2772],
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

const RISPLanding: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FastReportData[]>([]);
  const [vaccinationData, setVaccinationData] = useState<VaccinationData[]>([]);
  const [surveillanceData, setSurveillanceData] = useState<SurveillanceData[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [selectedDisease, setSelectedDisease] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewModeType>('default');

  // Get user's region based on their country
  const userRegion = useMemo(() => {
    if (!user?.country) return null;
    return countryToRegion[user.country] || null;
  }, [user?.country]);

  // Get list of countries in user's region
  const userRegionCountries = useMemo(() => {
    if (!userRegion) return [];
    return Object.keys(countryToRegion).filter(country => countryToRegion[country] === userRegion);
  }, [userRegion]);

  // Get available years and diseases from data
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(data.map(item => item.Year))).sort((a, b) => b - a);
    return years;
  }, [data]);

  const availableQuarters = useMemo(() => {
    const quarters = Array.from(new Set(data.map(item => item.Quarter).filter(Boolean))).sort();
    return quarters;
  }, [data]);

  const availableDiseases = useMemo(() => {
    const diseases = Array.from(new Set(data.map(item => item.Disease).filter(Boolean))).sort();
    return diseases;
  }, [data]);

  // Filter data based on user's region countries and selected filters
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Filter by user's region countries (automatic, not visible to user)
      const regionMatch = userRegionCountries.length === 0 || userRegionCountries.includes(item.Country);
      const yearMatch = selectedYear === 'all' || item.Year?.toString() === selectedYear;
      const quarterMatch = selectedQuarter === 'all' || item.Quarter?.toString() === selectedQuarter;
      const diseaseMatch = selectedDisease === 'all' || item.Disease === selectedDisease;
      return regionMatch && yearMatch && quarterMatch && diseaseMatch;
    });
  }, [data, userRegionCountries, selectedYear, selectedQuarter, selectedDisease]);
  
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

  // Filtered vaccination data by region
  const filteredVaccinationData = useMemo(() => {
    return vaccinationData.filter(item => {
      const regionMatch = userRegionCountries.length === 0 || userRegionCountries.includes(item.Country);
      return regionMatch;
    });
  }, [vaccinationData, userRegionCountries]);

  // Filtered surveillance data by region  
  const filteredSurveillanceData = useMemo(() => {
    return surveillanceData.filter(item => {
      const regionMatch = userRegionCountries.length === 0 || userRegionCountries.includes(item.Country);
      return regionMatch;
    });
  }, [surveillanceData, userRegionCountries]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 10000);
        
        // Simple API call without country filtering - we'll filter client-side
        const response = await fetch('/api/fast-report/create-dashboard', {
          signal: controller.signal
        });
        clearTimeout(fetchTimeoutId);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const dashboardData = await response.json();
        
        if (dashboardData && dashboardData.data && Array.isArray(dashboardData.data)) {
          console.log("API data loaded:", dashboardData.data.length, "records");
          setData(dashboardData.data);
        } else {
          console.warn("Invalid API data format:", dashboardData);
          setData([]);
        }

        // Set sample vaccination data
        setVaccinationData([
          { Country: 'Türkiye', Disease: 'FMD', Year: 2024, Region: 'SEEN' },
          { Country: 'Armenia', Disease: 'FMD', Year: 2024, Region: 'SEEN' },
          { Country: 'Georgia', Disease: 'PPR', Year: 2024, Region: 'SEEN' },
          { Country: 'Iran', Disease: 'LSD', Year: 2024, Region: 'SEEN' },
          { Country: 'Egypt', Disease: 'FMD', Year: 2024, Region: 'Near East' },
          { Country: 'Jordan', Disease: 'PPR', Year: 2024, Region: 'Near East' },
          { Country: 'Algeria', Disease: 'FMD', Year: 2024, Region: 'North Africa' },
          { Country: 'Morocco', Disease: 'PPR', Year: 2024, Region: 'North Africa' },
        ]);

        // Set sample surveillance data
        setSurveillanceData([
          { Country: 'Türkiye', Disease: 'FMD', Year: 2024, Region: 'SEEN' },
          { Country: 'Azerbaijan', Disease: 'FMD', Year: 2024, Region: 'SEEN' },
          { Country: 'Pakistan', Disease: 'FMD', Year: 2024, Region: 'SEEN' },
          { Country: 'Iraq', Disease: 'PPR', Year: 2024, Region: 'SEEN' },
          { Country: 'Lebanon', Disease: 'FMD', Year: 2024, Region: 'Near East' },
          { Country: 'Syria', Disease: 'PPR', Year: 2024, Region: 'Near East' },
          { Country: 'Tunisia', Disease: 'FMD', Year: 2024, Region: 'North Africa' },
          { Country: 'Libya', Disease: 'LSD', Year: 2024, Region: 'North Africa' },
        ]);
      } catch (err: any) {
        console.warn('API fetch error:', err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add custom styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .welcome-text-full {
        width: 100%;
        line-height: 2.5rem;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const getMarkerColor = (disease: string): string => {
    const colors: { [key: string]: string } = {
      'FMD': '#00ff00',           // Bright green
      'BEF': '#8b4513',           // Brown
      'PPR': '#50c878',           // Emerald
      'LSD': '#0000ff',           // Blue
      'SGP': '#ffa500',           // Orange
      'RVF': '#800080',           // Purple
      'default': '#95a5a6'        // Light gray
    };
    return colors[disease] || colors.default;
  };

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
      iconAnchor: [size/2, size/2]
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl">Loading Risk Information...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      {/* Header Section */}
      <section className="mb-6">
        <p className="font-black capitalize text-2xl mb-6 font-martaBold">
          Risk Information Sharing Platform
        </p>
        <div className="w-full">
          <h3 className="text-gray-600 welcome-text-full mb-6">
            Welcome to the Risk Information Sharing Platform. This platform allows
            you to visualize and share information. Your input is crucial to help
            monitor and manage health risks effectively. Please share information about outbreaks, control and surveillance
            measures for the selected time period.
          </h3>
        </div>
        
        {/* Share Information Button */}
        <Link to="/risp/outbreak">
          <button className="w-1/4 nav-btn">Share Information</button>
        </Link>
      </section>

      {/* Dashboard Section */}
      <div className="w-full space-y-4">

        {/* Filters - Only show in outbreaks mode */}
        {viewMode === 'outbreaks' && (
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
                Quarter:
              </label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Quarters</option>
                {availableQuarters.map(quarter => (
                  <option key={quarter} value={quarter.toString()}>Q{quarter}</option>
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
            
            <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
              Showing <span className="font-bold">{filteredData.length}</span> report{filteredData.length !== 1 ? 's' : ''}
              {userRegion && ' in ' + userRegion}
            </div>
            </div>
          </div>
        )}

        {/* Map and Action Buttons Layout */}
        <div className="flex gap-4">
          {/* Map - 3/4 width */}
          <div className="w-3/4 bg-white rounded-lg shadow overflow-hidden">
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
                
                {/* Show different content based on view mode */}
                {viewMode === 'outbreaks' && (
                  // Show outbreak markers when in outbreaks mode
                  markerData.map((report) => {
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
                  })
                )}
                
                {viewMode === 'vaccination' && (
                  // Show vaccination data markers
                  filteredVaccinationData.map((vaccine, index) => {
                    const coords = countryCoordinates[vaccine.Country];
                    if (!coords) return null;
                    
                    return (
                      <Marker
                        key={`vaccination-${vaccine.Country}-${index}`}
                        position={coords}
                        icon={L.divIcon({
                          className: 'vaccination-marker',
                          html: `<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">💉</div>`,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                        })}
                      >
                        <Popup maxWidth={300}>
                          <div className="p-2">
                            <h3 className="font-bold text-lg text-gray-800">{vaccine.Country}</h3>
                            <div className="space-y-1 text-sm">
                              <p><strong>Disease:</strong> {vaccine.Disease}</p>
                              <p><strong>Year:</strong> {vaccine.Year}</p>
                              <p><strong>Region:</strong> {vaccine.Region}</p>
                              <p><strong>Vaccination Status:</strong> Active</p>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })
                )}
                
                {viewMode === 'surveillance' && (
                  // Show surveillance data markers  
                  filteredSurveillanceData.map((surveillance, index) => {
                    const coords = countryCoordinates[surveillance.Country];
                    if (!coords) return null;
                    
                    return (
                      <Marker
                        key={`surveillance-${surveillance.Country}-${index}`}
                        position={coords}
                        icon={L.divIcon({
                          className: 'surveillance-marker',
                          html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">👁️</div>`,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                        })}
                      >
                        <Popup maxWidth={300}>
                          <div className="p-2">
                            <h3 className="font-bold text-lg text-gray-800">{surveillance.Country}</h3>
                            <div className="space-y-1 text-sm">
                              <p><strong>Disease:</strong> {surveillance.Disease}</p>
                              <p><strong>Year:</strong> {surveillance.Year}</p>
                              <p><strong>Region:</strong> {surveillance.Region}</p>
                              <p><strong>Surveillance Status:</strong> Active</p>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })
                )}
                
                {viewMode === 'default' && (
                  // Show colored country markers for default view
                  userRegionCountries.map((country) => {
                    const coords = countryCoordinates[country];
                    if (!coords) return null;
                    
                    return (
                      <Marker
                        key={`country-${country}`}
                        position={coords}
                        icon={L.divIcon({
                          className: 'country-marker',
                          html: `<div style="background-color: #3498db; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                        })}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-lg text-gray-800">{country}</h3>
                            <p className="text-sm text-gray-600">Region: {userRegion}</p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })
                )}
                
                <MapController filteredData={markerData} />
              </MapContainer>
            </div>
          </div>
          
          {/* Action Buttons Sidebar - 1/4 width */}
          <div className="w-1/4 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="space-y-4">
              <button 
                onClick={() => setViewMode('default')}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center ${
                  viewMode === 'default' 
                    ? 'bg-gray-600 text-white' 
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Overview
              </button>
              
              <button 
                onClick={() => setViewMode('outbreaks')}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center ${
                  viewMode === 'outbreaks' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Outbreaks
              </button>
              
              <button 
                onClick={() => setViewMode('vaccination')}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center ${
                  viewMode === 'vaccination' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Vaccination
              </button>
              
              <button 
                onClick={() => setViewMode('surveillance')}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center ${
                  viewMode === 'surveillance' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Surveillance
              </button>
            </div>
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
            <h3 className="font-semibold mb-3 text-gray-800">Summary Statistics {userRegion && `for ${userRegion}`}:</h3>
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
    </div>
  );
};

export default RISPLanding;
