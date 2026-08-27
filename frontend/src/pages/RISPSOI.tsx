import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import KPIBanner from '../components/KPIBanner';
import VaccineRiskView from '../components/VaccineRiskView';
import EconomicImpactView from '../components/EconomicImpactView';
import SurveillanceQualityView from '../components/SurveillanceQualityView';
import {
  ALLOWED_SOI_COUNTRIES,
  isAllowedGeoCountry,
  isAllowedSoiCountry,
  vaccinationRegionKeyFromGeoFeature,
  vaccinationRegionKeyFromSoiRecord,
} from '../utils/maps/soiChoroplethMatching';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


interface SoiDataRecord {
  Year?: number;
  Country: string;
  Province?: string;
  District?: string;
  Epi_Unit?: string;
  Latitude?: number;
  Longitude?: number;
  Disease?: string;
  Species?: string;
  Serotype?: string;
  Date_Suspected?: string;
  Date_Confirmed?: string;
  Confirmation_Type?: string;
  Outbreaks?: string;
  Vaccination_Campaign?: string;
  Vaccination_Date?: string;
  Vaccine_Manufacturer?: string;
  Cattle_Strain?: string;
  SR_Strain?: string;
  Cattle_Population?: number;
  Cattle_Target_Pop?: number;
  Cattle_Estimated_Doses?: number;
  Cattle_Doses_Injected?: number;
  SR_Population?: number;
  SR_Target_Pop?: number;
  SR_Estimated_Doses?: number;
  SR_Doses_Injected?: number;
  Vaccination_Doses?: number;
  // Market price fields
  Quarter?: string;
  Reference?: string;
  Cattle_Districts_Live_Min?: number;
  Cattle_Districts_Live_Max?: number;
  Cattle_Districts_Live_Avg?: number;
  Cattle_Districts_Meat_Min?: number;
  Cattle_Districts_Meat_Max?: number;
  Cattle_Districts_Meat_Avg?: number;
  Cattle_Capital_Live_Min?: number;
  Cattle_Capital_Live_Max?: number;
  Cattle_Capital_Live_Avg?: number;
  Cattle_Capital_Meat_Min?: number;
  Cattle_Capital_Meat_Max?: number;
  Cattle_Capital_Meat_Avg?: number;
  Sheep_Districts_Live_Min?: number;
  Sheep_Districts_Live_Max?: number;
  Sheep_Districts_Live_Avg?: number;
  Sheep_Districts_Meat_Min?: number;
  Sheep_Districts_Meat_Max?: number;
  Sheep_Districts_Meat_Avg?: number;
  Sheep_Capital_Live_Min?: number;
  Sheep_Capital_Live_Max?: number;
  Sheep_Capital_Live_Avg?: number;
  Sheep_Capital_Meat_Min?: number;
  Sheep_Capital_Meat_Max?: number;
  Sheep_Capital_Meat_Avg?: number;
  Pig_Districts_Live_Min?: number;
  Pig_Districts_Live_Max?: number;
  Pig_Districts_Live_Avg?: number;
  Pig_Districts_Meat_Min?: number;
  Pig_Districts_Meat_Max?: number;
  Pig_Districts_Meat_Avg?: number;
  Pig_Capital_Live_Min?: number;
  Pig_Capital_Live_Max?: number;
  Pig_Capital_Live_Avg?: number;
  Pig_Capital_Meat_Min?: number;
  Pig_Capital_Meat_Max?: number;
  Pig_Capital_Meat_Avg?: number;
  Price?: string;
  [key: string]: any;
}

// Allowed countries for SOI dashboard (formal TCC nation names)
const ALLOWED_C = ALLOWED_SOI_COUNTRIES;

const RISPSOI: React.FC = () => {
  type DashboardTab = 'spatial' | 'vaccine' | 'economic' | 'surveillance';
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('spatial');

  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Map layer toggles (default to checked so map shows data on load)
  const [showOutbreaks, setShowOutbreaks] = useState(true);
  const [showVaccination, setShowVaccination] = useState(true);
  const [mapOutbreaks, setMapOutbreaks] = useState<SoiDataRecord[]>([]);
  const [mapVaccination, setMapVaccination] = useState<SoiDataRecord[]>([]);
  const [, setMapLoading] = useState(false);

  // GeoJSON choropleth state
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [vaccinationByProvince, setVaccinationByProvince] = useState<Record<string, number>>({});

  // Load GeoJSON on mount
  useEffect(() => {
    fetch('/gadm.geojson')
      .then((res) => res.json())
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.error('Failed to load GeoJSON:', err));
  }, []);

  // Pre-fetch outbreaks and vaccination data for country dropdown population
  useEffect(() => {
    const prefetch = async () => {
      if (mapOutbreaks.length === 0) {
        try {
          const res = await fetch('/api/tcc/outbreaks');
          if (res.ok) {
            const data = await res.json();
            setMapOutbreaks(data.data || []);
          }
        } catch (err) { /* ignore */ }
      }
      if (mapVaccination.length === 0) {
        try {
          const res = await fetch('/api/tcc/vaccination');
          if (res.ok) {
            const data = await res.json();
            setMapVaccination(data.data || []);
          }
        } catch (err) { /* ignore */ }
      }
    };
    prefetch();
  }, [mapOutbreaks.length, mapVaccination.length]);

  // Compute vaccination counts per province/region when vaccination data changes
  useEffect(() => {
    if (mapVaccination.length === 0) {
      setVaccinationByProvince({});
      return;
    }
    const counts: Record<string, number> = {};
    mapVaccination.forEach((r) => {
      if (!isAllowedSoiCountry(r.Country || '')) return;
      const key = vaccinationRegionKeyFromSoiRecord(r.Country || '', r.Province);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    setVaccinationByProvince(counts);
  }, [mapVaccination]);

  // Filter GeoJSON to admin_level 1 and attach vaccination counts for choropleth
  const adminBoundaryData = useMemo(() => {
    if (!geoJsonData) return null;
    const features = geoJsonData.features.filter((f: any) => {
      if (f.properties.admin_level !== 1) return false;
      return isAllowedGeoCountry(f.properties.COUNTRY || '');
    });
    return {
      ...geoJsonData,
      features: features.map((f: any) => {
        const key = vaccinationRegionKeyFromGeoFeature(f.properties) || '';
        const count = key ? (vaccinationByProvince[key] || 0) : 0;
        return { ...f, properties: { ...f.properties, vaccination_count: count } };
      }),
    };
  }, [geoJsonData, vaccinationByProvince]);

  // Green color scale for choropleth
  const getChoroplethColor = (count: number, maxCount: number) => {
    if (count === 0) return '#f0fdf4';
    const ratio = count / maxCount;
    if (ratio < 0.25) return '#bbf7d0';
    if (ratio < 0.5) return '#86efac';
    if (ratio < 0.75) return '#4ade80';
    return '#16a34a';
  };

  // Max vaccination count for color scaling
  const maxVaccinationCount = useMemo(() => {
    const values = Object.keys(vaccinationByProvince).map((k) => vaccinationByProvince[k]);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [vaccinationByProvince]);

  // Fetch data for map when checkboxes are toggled
  useEffect(() => {
    if (!showOutbreaks && !showVaccination) return;
    const fetchMapData = async () => {
      setMapLoading(true);
      try {
        if (showOutbreaks && mapOutbreaks.length === 0) {
          const res = await fetch('/api/tcc/outbreaks');
          if (res.ok) {
            const data = await res.json();
            setMapOutbreaks(data.data || []);
          }
        }
        if (showVaccination && mapVaccination.length === 0) {
          const res = await fetch('/api/tcc/vaccination');
          if (res.ok) {
            const data = await res.json();
            setMapVaccination(data.data || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch map data:', err);
      } finally {
        setMapLoading(false);
      }
    };
    fetchMapData();
  }, [showOutbreaks, showVaccination, mapOutbreaks.length, mapVaccination.length]);

  // Filtered map markers based on country and date filters
  const filteredMapOutbreaks = useMemo(() => {
    return mapOutbreaks.filter((r) => {
      if (!r.Latitude || !r.Longitude) return false;
      if (filterCountry !== 'all' && r.Country !== filterCountry) return false;
      const recordDate = r.Date_Confirmed || r.Date_Suspected || '';
      if (filterDateFrom && recordDate < filterDateFrom) return false;
      if (filterDateTo && recordDate > filterDateTo) return false;
      return true;
    });
  }, [mapOutbreaks, filterCountry, filterDateFrom, filterDateTo]);

  const filteredMapVaccination = useMemo(() => {
    return mapVaccination.filter((r) => {
      if (!r.Latitude || !r.Longitude) return false;
      if (filterCountry !== 'all' && r.Country !== filterCountry) return false;
      const recordDate = r.Vaccination_Date || '';
      if (filterDateFrom && recordDate < filterDateFrom) return false;
      if (filterDateTo && recordDate > filterDateTo) return false;
      return true;
    });
  }, [mapVaccination, filterCountry, filterDateFrom, filterDateTo]);

  const availableCountries = useMemo(() => ALLOWED_C, []);

  const outbreakIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  return (
    <div className="container mx-auto px-4">
      {/* Header Section */}
      <section className="mb-6">
        <p className="font-black capitalize text-2xl mb-6 font-martaBold">
          Statement of Intentions (SOI) Database
        </p>
        <div className="w-full">
          <h3 className="text-gray-600 mb-6" style={{ lineHeight: '2.5rem', width: '100%' }}>
            Welcome to the SOI Database. This platform allows you to report and share
            information as specified on the Statement of Intentions Agreement. Your input is crucial
            to help monitor and manage health risks effectively. Please share information about
            outbreaks, vaccination and market prices.
          </h3>
        </div>
      </section>

      {/* Share Information → unified RISP entry forms */}
      <div className="flex justify-end mb-6">
        <Link to="/risp/outbreak">
          <button type="button" className="nav-btn">Share Information</button>
        </Link>
      </div>

      {/* Dashboard / Map */}
      <div className="bg-white rounded-lg shadow p-6">
          <KPIBanner />
          <div className="flex gap-4 mt-4">
            {/* Main Content Area (Map or Charts) */}
            <div className="flex-1 min-h-[24rem] rounded-lg overflow-hidden border border-gray-200">
              {dashboardTab === 'spatial' && (
                <div className="relative w-full h-full">
                  <MapContainer
                    center={[39.0, 35.0]}
                    zoom={5}
                    scrollWheelZoom={true}
                    className="h-full w-full"
                    style={{ height: '24rem' }}
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
                    {showOutbreaks && filteredMapOutbreaks.map((r, i) => (
                      <Marker key={`ob-${i}`} position={[r.Latitude!, r.Longitude!]} icon={outbreakIcon}>
                        <Popup>
                          <div className="text-xs">
                            <strong>{r.Country}</strong>{r.Province ? `, ${r.Province}` : ''}<br/>
                            Disease: {r.Disease || '-'}<br/>
                            Serotype: {r.Serotype || '-'}<br/>
                            Confirmed: {r.Date_Confirmed || r.Date_Suspected || '-'}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {adminBoundaryData && (
                      <GeoJSON
                        key={`admin-boundaries-${showVaccination}-${Object.keys(vaccinationByProvince).length}`}
                        data={adminBoundaryData}
                        style={(feature) => {
                          if (showVaccination) {
                            return {
                              fillColor: getChoroplethColor(feature?.properties.vaccination_count || 0, maxVaccinationCount),
                              weight: 1,
                              opacity: 1,
                              color: '#9ca3af',
                              fillOpacity: 0.6,
                            };
                          }
                          return {
                            fillColor: '#e5e7eb',
                            weight: 1,
                            opacity: 1,
                            color: '#6b7280',
                            fillOpacity: 0.2,
                          };
                        }}
                        onEachFeature={(feature, layer) => {
                          const name = feature.properties.NAME_1;
                          const country = feature.properties.COUNTRY;
                          if (showVaccination) {
                            const count = feature.properties.vaccination_count || 0;
                            layer.bindPopup(
                              `<div style="font-size:12px"><strong>${name}</strong> (${country})<br/>Vaccination records: ${count}</div>`
                            );
                          } else {
                            layer.bindPopup(
                              `<div style="font-size:12px"><strong>${name}</strong><br/>${country}</div>`
                            );
                          }
                        }}
                      />
                    )}
                  </MapContainer>
                  {/* Vaccination Choropleth Legend */}
                  {showVaccination && (
                    <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-2.5 border border-gray-200">
                      <div className="text-[9px] font-semibold text-gray-700 mb-1.5">Vaccination Records</div>
                      <div className="flex items-center gap-0.5">
                        {[
                          { color: '#f0fdf4', label: '0' },
                          { color: '#bbf7d0', label: '' },
                          { color: '#86efac', label: '' },
                          { color: '#4ade80', label: '' },
                          { color: '#16a34a', label: 'Max' },
                        ].map((item, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: item.color, border: '0.5px solid #d1d5db' }} />
                            {item.label && <span className="text-[7px] text-gray-500 mt-0.5">{item.label}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="text-[8px] text-gray-500 mt-1 text-center">Per province/region</div>
                    </div>
                  )}
                </div>
              )}

              {/* Vaccine & Risk Tab Content */}
              {dashboardTab === 'vaccine' && (
                <div className="p-4 h-full overflow-y-auto" style={{ minHeight: '24rem' }}>
                  <VaccineRiskView
                    filterCountry={filterCountry}
                    filterDateFrom={filterDateFrom}
                    filterDateTo={filterDateTo}
                  />
                </div>
              )}

              {/* Economic Impact Tab Content */}
              {dashboardTab === 'economic' && (
                <div className="p-4 h-full overflow-y-auto" style={{ minHeight: '24rem' }}>
                  <EconomicImpactView />
                </div>
              )}

              {/* Surveillance Quality Tab Content */}
              {dashboardTab === 'surveillance' && (
                <div className="p-4 h-full overflow-y-auto" style={{ minHeight: '24rem' }}>
                  <SurveillanceQualityView
                    filterCountry={filterCountry}
                    filterDateFrom={filterDateFrom}
                    filterDateTo={filterDateTo}
                  />
                </div>
              )}
            </div>

            {/* Right Sidebar: 2-column layout with tabs + filters */}
            <div className="w-80 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Left column: Dashboard Tabs */}
                <div className="flex flex-col gap-1">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Dashboard View:</label>
                  {([
                    { key: 'spatial' as DashboardTab, label: '🗺️ Spatial' },
                    { key: 'vaccine' as DashboardTab, label: '💉 Vaccine' },
                    { key: 'economic' as DashboardTab, label: '💰 Economic' },
                    { key: 'surveillance' as DashboardTab, label: '🔬 Surveillance' },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setDashboardTab(tab.key)}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                        dashboardTab === tab.key
                          ? 'bg-[#15736d] text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Right column: Filters */}
                <div className="flex flex-col gap-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Filters:</label>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Country:</label>
                    <select
                      value={filterCountry}
                      onChange={(e) => setFilterCountry(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-1.5 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All Countries</option>
                      {availableCountries.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From:</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-1.5 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To:</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-1.5 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Map Layer Toggles (only for spatial view) */}
              {dashboardTab === 'spatial' && (
                <div className="border-t border-gray-200 pt-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1.5">Map Layers:</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOutbreaks}
                        onChange={(e) => setShowOutbreaks(e.target.checked)}
                        className="w-3.5 h-3.5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                      />
                      <span className="text-[11px] text-gray-700">Outbreaks</span>
                      {showOutbreaks && <span className="text-[10px] text-gray-400">({filteredMapOutbreaks.length})</span>}
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showVaccination}
                        onChange={(e) => setShowVaccination(e.target.checked)}
                        className="w-3.5 h-3.5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                      />
                      <span className="text-[11px] text-gray-700">Vaccination</span>
                      {showVaccination && <span className="text-[10px] text-gray-400">({filteredMapVaccination.length})</span>}
                    </label>
                  </div>
                </div>
              )}

              <button
                onClick={() => { setFilterCountry('all'); setFilterDateFrom(''); setFilterDateTo(''); setShowOutbreaks(true); setShowVaccination(true); }}
                className="px-2 py-1 text-[11px] font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
          {dashboardTab === 'spatial' && (
            <div className="mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-700 italic">
                The boundaries and names shown and the designations used on this map do not imply the
                expression of any opinion whatsoever on the part of FAO concerning the legal status of any
                country, territory, city or area or of its authorities, or concerning the delimitation of its
                frontiers and boundaries.
              </p>
            </div>
          )}
        </div>
    </div>
  );
};

export default RISPSOI;