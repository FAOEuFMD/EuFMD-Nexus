import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
// import { ResponsiveLine } from '@nivo/line';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '../stores/authStore';

// MapDisabler removed to allow full map interaction

// Import GeoJSON files - keeping for potential future use
// import seenCountriesGeoJSON from '../data/geojson/seen-countries.json';
// import nearEastCountriesGeoJSON from '../data/geojson/near-east-countries.json';
// import northAfricaCountriesGeoJSON from '../data/geojson/north-africa-countries.json';

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
  Epidemiological_information: string;
  Surveillance: number | string; // 1 or 0, could be number or string
  Vaccination: number | string; // 1 or 0, could be number or string
  Vaccination_doses: number;
  Vaccination_Description: string;
  Source: string;
}

interface CountryCoordinates {
  [key: string]: [number, number];
}

// Remove separate interfaces since all data comes from the same table
// interface VaccinationData and SurveillanceData are no longer needed

type ViewModeType = 'default' | 'outbreaks' | 'vaccination' | 'surveillance';

// Region mapping for countries
export const countryToRegion: { [key: string]: string } = {
  // South East European Neighbourhood (SEEN)
  'Armenia': 'South East European Neighbourhood (SEEN)',
  'Azerbaijan': 'South East European Neighbourhood (SEEN)',
  'Georgia': 'South East European Neighbourhood (SEEN)',
  'Iran (Islamic Republic of)': 'South East European Neighbourhood (SEEN)',
  'Iraq': 'South East European Neighbourhood (SEEN)',
  'Iraq (KRI)': 'South East European Neighbourhood (SEEN)',
  'Pakistan': 'South East European Neighbourhood (SEEN)',
  'Türkiye': 'South East European Neighbourhood (SEEN)',
  
  // Near East
  'Egypt': 'Near East',
  'Jordan': 'Near East',
  'Lebanon': 'Near East',
  'Palestine, State of': 'Near East',
  'Syrian Arab Republic': 'Near East',
 
  
  // North Africa
  'Algeria': 'North Africa',
  'Libya': 'North Africa',
  'Mauritania': 'North Africa',
  'Morocco': 'North Africa',
  'Tunisia': 'North Africa',
};

// Region center coordinates and zoom levels for static map view
const regionSettings: { [key: string]: { center: [number, number], zoom: number } } = {
  'South East European Neighbourhood (SEEN)': { center: [38.0, 55.0], zoom: 3 },
  'Near East': { center: [30.0, 35.0], zoom: 3 },
  'North Africa': { center: [30.0, 10.0], zoom: 3 },
  'default': { center: [30, 25], zoom: 3 } // More centered view for Middle East/North Africa region
};

// Static country coordinates for major countries (same as FastReport)
const countryCoordinates: CountryCoordinates = {
  'Afghanistan': [33.9391, 67.7100],
  'Algeria': [28.0339, 1.6596],
  'Armenia': [40.0691, 45.0382],
  'Azerbaijan': [40.1431, 47.5769],
  'Georgia': [42.3154, 43.3569],
  'Iran (Islamic Republic of)': [32.4279, 53.6880],
  'Iraq': [33.2232, 43.6793],
  'Iraq (KRI)': [36.1911, 44.0093],
  'Jordan': [30.5852, 36.2384],
  'Lebanon': [33.8547, 35.8623],
  'Pakistan': [30.3753, 69.3451],
  'Palestine': [31.9522, 35.2332],
  'Palestine, State of': [31.9522, 35.2332],
  'Syria': [34.8021, 38.9968],
  'Syrian Arab Republic': [34.8021, 38.9968],
  'Türkiye': [38.9637, 35.2433],
  'Egypt': [26.8206, 30.8025],
  'Libya': [26.3351, 17.2283],
  'Morocco': [31.7917, -7.0926],
  'Sudan': [12.8628, 30.2176],
  'Tunisia': [33.8869, 9.5375],
};

// Function to get the appropriate GeoJSON data based on user region - commented out for now
// const getRegionGeoJSON = (userRegion: string) => {
//   switch (userRegion) {
//     case 'South East European Neighbourhood (SEEN)':
//       return seenCountriesGeoJSON;
//     case 'Near East':
//       return nearEastCountriesGeoJSON;
//     case 'North Africa':
//       return northAfricaCountriesGeoJSON;
//     default:
//       return null;
//   }
// };

const MapController: React.FC<{ filteredData: FastReportData[] }> = ({ filteredData }) => {
  const map = useMap();
  
  useEffect(() => {
    // Don't auto-zoom to data, maintain the region view
    // This prevents the map from zooming in too much when there's limited data
  }, [map, filteredData]);
  
  return null;
};

const RISPLanding: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FastReportData[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [selectedDisease, setSelectedDisease] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewModeType>('default');
  const [selectedCountryData, setSelectedCountryData] = useState<any>(null);

  // Debug user information
  useEffect(() => {
    console.log('Current user object:', user);
    console.log('User country from auth:', user?.country);
  }, [user]);

  // Get user's region based on their country
  const userRegion = useMemo(() => {
    if (!user?.country) return null;
    const region = countryToRegion[user.country] || null;
    console.log('User country:', user?.country, 'User region:', region);
    return region;
  }, [user?.country]);

  // Get list of countries in user's region
  const userRegionCountries = useMemo(() => {
    if (!userRegion) return [];
    const countries = Object.keys(countryToRegion).filter(country => countryToRegion[country] === userRegion);
    console.log('User region countries:', countries);
    return countries;
  }, [userRegion]);

  // Get map settings based on user's region
  const mapSettings = useMemo(() => {
    if (!userRegion || !regionSettings[userRegion]) {
      return regionSettings['default'];
    }
    return regionSettings[userRegion];
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


  // Find the most recent year and quarter in the data (for all visualizations)
  const { mostRecentYear, mostRecentQuarter } = useMemo(() => {
    if (!data.length) {
      const now = new Date();
      return {
        mostRecentYear: now.getFullYear(),
        mostRecentQuarter: Math.ceil((now.getMonth() + 1) / 3)
      };
    }
    // Sort descending by year, then quarter
    const sorted = [...data].sort((a, b) => {
      if (a.Year !== b.Year) return b.Year - a.Year;
      return b.Quarter - a.Quarter;
    });
    return {
      mostRecentYear: sorted[0].Year,
      mostRecentQuarter: sorted[0].Quarter
    };
  }, [data]);

  // Only use data from the most recent quarter for all visualizations
  const lastQuarterData = useMemo(() => {
    return data.filter(item => item.Year === mostRecentYear && item.Quarter === mostRecentQuarter && (userRegionCountries.length === 0 || userRegionCountries.includes(item.Country)));
  }, [data, mostRecentYear, mostRecentQuarter, userRegionCountries]);

  // Group last quarter data by country for info boxes
  const mostRecentQuarterData = useMemo(() => {
    const countryDataWithReports = lastQuarterData.reduce((acc, item) => {
      const country = item.Country;
      if (!acc[country]) {
        acc[country] = {
          country,
          year: mostRecentYear,
          quarter: mostRecentQuarter,
          totalOutbreaks: 0,
          diseases: [],
          reports: [],
          outbreakReports: [],
          vaccinationReports: [],
          surveillanceReports: [],
          hasData: true,
          lastReported: `Q${mostRecentQuarter} ${mostRecentYear}`
        };
      }
      const outbreaks = parseInt(String(item.Outbreaks || 0), 10) || 0;
      if (outbreaks > 0) {
        acc[country].totalOutbreaks += outbreaks;
      }
      if (item.Disease && !acc[country].diseases.includes(item.Disease)) {
        acc[country].diseases.push(item.Disease);
      }
      acc[country].reports.push(item);
      if (outbreaks > 0) {
        acc[country].outbreakReports.push(item);
      }
      if (item.Vaccination === 1 || item.Vaccination === '1') {
        acc[country].vaccinationReports.push(item);
      }
      if (item.Surveillance === 1 || item.Surveillance === '1') {
        acc[country].surveillanceReports.push(item);
      }
      return acc;
    }, {} as Record<string, any>);
    // Add countries with no data for the most recent quarter
    const allCountryData = userRegionCountries.map(country => {
      if (countryDataWithReports[country]) {
        return countryDataWithReports[country];
      } else {
        return {
          country,
          year: mostRecentYear,
          quarter: mostRecentQuarter,
          totalOutbreaks: 0,
          diseases: [],
          reports: [],
          vaccinations: [],
          surveillance: [],
          hasData: false
        };
      }
    });
    return allCountryData;
  }, [lastQuarterData, userRegionCountries, mostRecentYear, mostRecentQuarter]);

  // For all map and info visualizations, use only lastQuarterData

  // Only last quarter data for all map/info visualizations
  const filteredData = useMemo(() => lastQuarterData, [lastQuarterData]);
  
  // Data to use for markers - only include entries with actual outbreaks (last quarter only)
  const markerData = useMemo(() => {
    return lastQuarterData.filter(item => {
      if (!item.Outbreaks) return false;
      const outbreaksStr = String(item.Outbreaks).trim();
      if (outbreaksStr === '' || outbreaksStr === '0' || outbreaksStr.toLowerCase() === 'null') return false;
      const outbreaksNum = parseInt(outbreaksStr, 10);
      return !isNaN(outbreaksNum) && outbreaksNum > 0;
    });
  }, [lastQuarterData]);

  // Only last quarter vaccination data
  const filteredVaccinationData = useMemo(() => {
    return lastQuarterData.filter(item => (item.Vaccination === 1 || item.Vaccination === '1'));
  }, [lastQuarterData]);

  // Only last quarter surveillance data
  const filteredSurveillanceData = useMemo(() => {
    return lastQuarterData.filter(item => (item.Surveillance === 1 || item.Surveillance === '1'));
  }, [lastQuarterData]);

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
          console.log("Sample data record:", dashboardData.data[0]);
          console.log("Vaccination records (===1):", dashboardData.data.filter((item: any) => item.Vaccination === 1).length);
          console.log("Vaccination records (==='1'):", dashboardData.data.filter((item: any) => item.Vaccination === '1').length);
          console.log("Surveillance records (===1):", dashboardData.data.filter((item: any) => item.Surveillance === 1).length);
          console.log("Surveillance records (==='1'):", dashboardData.data.filter((item: any) => item.Surveillance === '1').length);
          setData(dashboardData.data);
        } else {
          console.warn("Invalid API data format:", dashboardData);
          setData([]);
        }

        // No need for separate vaccination/surveillance data - they come from the same table
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
        
        {/* Share Information Button - Moved to the right */}
        <div className="flex justify-end space-x-2">
          <a
            href="/RISP_Template.xlsx"
            download
            className="nav-btn"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Download Template
          </a>
          <Link to="/risp/outbreak">
            <button className="nav-btn">Share Information</button>
          </Link>
        </div>
      </section>

      {/* Dashboard Section */}
      <div className="w-full space-y-4">

        {/* Filters - Show for outbreaks, vaccination, and surveillance modes */}
        {(viewMode === 'outbreaks' || viewMode === 'vaccination' || viewMode === 'surveillance') && (
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
              Showing <span className="font-bold">
                {viewMode === 'outbreaks' && filteredData.length}
                {viewMode === 'vaccination' && filteredVaccinationData.length}
                {viewMode === 'surveillance' && filteredSurveillanceData.length}
              </span> {viewMode === 'outbreaks' ? 'report' : viewMode}{(
                (viewMode === 'outbreaks' && filteredData.length !== 1) ||
                (viewMode === 'vaccination' && filteredVaccinationData.length !== 1) ||
                (viewMode === 'surveillance' && filteredSurveillanceData.length !== 1)
              ) ? 's' : ''}
              {userRegion && ' in ' + userRegion}
            </div>
            </div>
          </div>
        )}

        {/* Map and Action Buttons Layout */}
        <div className="flex gap-4" style={{ overflow: 'visible' }}>
          {/* Map - 3/4 width */}
          <div className="w-3/4 bg-white rounded-lg shadow" style={{ position: 'relative', overflow: 'visible' }}>
            {/* Map Header - only show for overview mode */}
            {viewMode === 'default' && (
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                <h3 className="text-lg font-semibold text-gray-800">
                  Overview of last quarter reported
                  {mostRecentQuarterData.length > 0 && ` (Q${mostRecentQuarterData[0].quarter} ${mostRecentQuarterData[0].year})`}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Data bubbles show activity for each country in your region. Click for detailed information.
                </p>
              </div>
            )}
            <div className="h-96 w-full overflow-hidden rounded-b-lg" style={{ 
              position: 'relative', 
              zIndex: 1
            }}>
              <MapContainer
                center={mapSettings.center}
                zoom={mapSettings.zoom}
                scrollWheelZoom={true}
                className="h-full w-full"
                maxZoom={6}
                minZoom={1}
                style={{ 
                  position: 'relative',
                  zIndex: 1
                }}
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
                        eventHandlers={{
                          click: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                          },
                          mousedown: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                          }
                        }}
                      >
                        <Popup maxWidth={300} autoPan={false} keepInView={false}>
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
                        eventHandlers={{
                          click: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                          },
                          mousedown: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                          }
                        }}
                      >
                        <Popup maxWidth={300} autoPan={false} keepInView={false}>
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
                        eventHandlers={{
                          click: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                          },
                          mousedown: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                          }
                        }}
                      >
                        <Popup maxWidth={300} autoPan={false} keepInView={false}>
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
                  // Show data bubbles for most recent quarter instead of country boundaries
                  mostRecentQuarterData.map((countryData) => {
                    const coords = countryCoordinates[countryData.country];
                    if (!coords) return null;
                    
                    // Calculate bubble size and style based on data availability
                    const baseSize = 40;
                    const maxSize = 80;
                    const hasData = countryData.hasData;
                    const size = hasData ? Math.min(maxSize, baseSize + Math.max(0, countryData.totalOutbreaks * 3)) : baseSize;
                    
                    // Different styling for countries with/without data
                    const bubbleStyle = hasData 
                      ? "background: linear-gradient(135deg, #015039 0%, #10b981 100%);"
                      : "background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);";
                    
                    return (
                      <Marker
                        key={`recent-data-${countryData.country}`}
                        position={coords}
                        icon={L.divIcon({
                          className: 'data-bubble',
                          html: `
                            <div style="
                              ${bubbleStyle}
                              width: ${size}px;
                              height: ${size}px;
                              border-radius: 50%;
                              border: 3px solid white;
                              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              color: white;
                              font-weight: bold;
                              font-size: ${Math.max(10, size * 0.2)}px;
                              position: relative;
                            ">
                              <div style="text-align: center;">
                                <div style="font-size: ${Math.max(8, size * 0.15)}px; line-height: 1;">${countryData.country.slice(0, 3).toUpperCase()}</div>
                                ${hasData && countryData.totalOutbreaks > 0 ? `<div style="font-size: ${Math.max(12, size * 0.25)}px; line-height: 1;">${countryData.totalOutbreaks}</div>` : ''}
                                ${!hasData ? `<div style="font-size: ${Math.max(6, size * 0.12)}px; line-height: 1;">No Data</div>` : ''}
                              </div>
                            </div>
                          `,
                          iconSize: [size, size],
                          iconAnchor: [size/2, size/2]
                        })}
                        eventHandlers={{
                          click: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                            setSelectedCountryData(countryData);
                          },
                          mousedown: (e) => {
                            e.originalEvent?.stopPropagation();
                            e.originalEvent?.preventDefault();
                          }
                        }}
                      />
                    );
                  })
                )}
                
                <MapController filteredData={markerData} />
              </MapContainer>
            </div>
          </div>
          
          {/* Action Buttons Sidebar - 1/4 width */}
          <div className="w-1/4 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Visualize:</h3>
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
              
              {/* Temporarily commented out for deployment - can be re-enabled in the future
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
              */}
            </div>
          </div>
        </div>

        {/* Country Information Card */}
        {selectedCountryData ? (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3 text-gray-800">{selectedCountryData.country} - Last Quarter Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Outbreak Data */}
              <div className="p-3 bg-red-50 rounded">
                <h4 className="font-medium text-red-800 mb-2">Outbreaks</h4>
                {(() => {
                  // Check if data was reported for this country
                  const hasAnyData = selectedCountryData.reports && selectedCountryData.reports.length > 0;
                  
                  if (!hasAnyData) {
                    return (
                      <div className="text-center text-gray-500 text-sm">
                        Data was not reported
                      </div>
                    );
                  }
                  
                  // Check if there are any outbreaks
                  if (selectedCountryData.totalOutbreaks === 0) {
                    return (
                      <div className="text-center text-gray-500 text-sm">
                        No outbreaks reported for the period
                      </div>
                    );
                  }
                  
                  // Show disease breakdown
                  const diseaseOutbreaks = selectedCountryData.outbreakReports.reduce((acc: any, report: any) => {
                    const disease = report.Disease;
                    const outbreaks = parseInt(String(report.Outbreaks || 0), 10) || 0;
                    acc[disease] = (acc[disease] || 0) + outbreaks;
                    return acc;
                  }, {});
                  
                  return (
                    <div>
                      <div className="text-2xl font-bold text-red-600 mb-2">{selectedCountryData.totalOutbreaks}</div>
                      <div className="space-y-1">
                        {Object.entries(diseaseOutbreaks).map(([disease, count]: [string, any]) => (
                          <div key={disease} className="flex justify-between text-sm">
                            <span className="text-gray-700">{disease}:</span>
                            <span className="font-medium text-red-600">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Vaccination Data */}
              <div className="p-3 bg-green-50 rounded">
                <h4 className="font-medium text-green-800 mb-2">Vaccination Data</h4>
                <div className="text-2xl font-bold text-green-600">{selectedCountryData.vaccinationReports.length}</div>
                <div className="text-sm text-gray-600">vaccination reports</div>
                {selectedCountryData.vaccinationReports.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-700">Diseases:</div>
                    <div className="text-sm text-gray-600">
                      {Array.from(new Set(selectedCountryData.vaccinationReports.map((r: any) => r.Disease).filter(Boolean))).join(', ')}
                    </div>
                  </div>
                )}
              </div>

              {/* Surveillance Data */}
              <div className="p-3 bg-blue-50 rounded">
                <h4 className="font-medium text-blue-800 mb-2">Surveillance Data</h4>
                <div className="text-2xl font-bold text-blue-600">{selectedCountryData.surveillanceReports.length}</div>
                <div className="text-sm text-gray-600">surveillance reports</div>
                {selectedCountryData.surveillanceReports.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-700">Diseases:</div>
                    <div className="text-sm text-gray-600">
                      {Array.from(new Set(selectedCountryData.surveillanceReports.map((r: any) => r.Disease).filter(Boolean))).slice(0, 3).join(', ')}
                      {Array.from(new Set(selectedCountryData.surveillanceReports.map((r: any) => r.Disease).filter(Boolean))).length > 3 && '...'}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-3 bg-gray-50 rounded">
                <h4 className="font-medium text-gray-800 mb-2">Quarter Summary</h4>
                <div className="text-sm text-gray-600">
                  <div>Total Reports: {selectedCountryData.outbreakReports.length + selectedCountryData.vaccinationReports.length + selectedCountryData.surveillanceReports.length}</div>
                  <div>Last Updated: {selectedCountryData.lastReported}</div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedCountryData(null)}
              className="mt-3 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm text-gray-700"
            >
              Close Details
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3 text-gray-800">Country Information</h3>
            <p className="text-gray-600 text-center py-8">
              Click on a country bubble above to see detailed information for the last quarter
            </p>
          </div>
        )}

        {/* Summary Statistics */}
        {filteredData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3 text-gray-800">Summary Statistics {userRegion && `for ${userRegion}`}:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">
                  {filteredData.reduce((sum, item) => sum + parseInt(item.Outbreaks || '0'), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Outbreaks</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {filteredData.filter(item => item.Vaccination === 1 || item.Vaccination === '1').length}
                </div>
                <div className="text-sm text-gray-600">Vaccination Campaigns</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {filteredData.filter(item => item.Surveillance === 1 || item.Surveillance === '1').length}
                </div>
                <div className="text-sm text-gray-600">Surveillance Activities</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <div className="text-2xl font-bold text-purple-600">
                  {Array.from(new Set(filteredData.map(item => item.Country))).length}
                </div>
                <div className="text-sm text-gray-600">Countries Affected</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RISPLanding;
