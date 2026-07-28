import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import KPIBanner from '../components/KPIBanner';
import VaccineRiskView from '../components/VaccineRiskView';
import EconomicImpactView from '../components/EconomicImpactView';
import SurveillanceQualityView from '../components/SurveillanceQualityView';
import SoiColumnFilterHeader from '../components/SoiColumnFilterHeader';
import { SoiColumnFilter } from '../components/SoiColumnFilterHeader';
import {
  applyColumnFilters,
  ColumnFilters,
  MARKET_PRICE_FILTER_FIELDS,
  uniqueColumnValues,
} from '../utils/soiColumnFilters';
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

type SoiSection = 'templates' | 'uploads' | 'data' | 'visualizations' | null;
type DataCategory = 'outbreaks' | 'vaccination' | 'marketprice';

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

const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  outbreaks: 'Outbreaks',
  vaccination: 'Vaccination',
  marketprice: 'Market Price',
};

const DATA_CATEGORY_FILES: Record<DataCategory, string> = {
  outbreaks: '/templates/outbreaks.xlsx',
  vaccination: '/templates/vaccination.xlsx',
  marketprice: '/templates/marketprice.xlsx',
};

// Allowed countries for SOI dashboard (formal TCC nation names)
const ALLOWED_C = ALLOWED_SOI_COUNTRIES;

const COUNTRY_DISPLAY: Record<string, string> = {
  'Azerbaijan, Republic of': 'Azerbaijan',
  'Armenia, Republic of': 'Armenia',
  'Georgia': 'Georgia',
  'Iran, Islamic, Republic of': 'Iran',
  'Iraq, Republic of': 'Iraq',
  'Pakistan, Islamic, Republic of': 'Pakistan',
  'Russian Federation': 'Russian Federation',
  'Turkey, Republic of': 'T\u00FCrkiye',
};

const RISPSOI: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SoiSection>(null);
  const [selectedCategory, setSelectedCategory] = useState<DataCategory | null>(null);
  const [activeTab, setActiveTab] = useState<DataCategory>('outbreaks');
  type DashboardTab = 'spatial' | 'vaccine' | 'economic' | 'surveillance';
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('spatial');

  // Data table state
  const [dataRecords, setDataRecords] = useState<SoiDataRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});

  // Map layer toggles (default to checked so map shows data on load)
  const [showOutbreaks, setShowOutbreaks] = useState(true);
  const [showVaccination, setShowVaccination] = useState(true);
  const [mapOutbreaks, setMapOutbreaks] = useState<SoiDataRecord[]>([]);
  const [mapVaccination, setMapVaccination] = useState<SoiDataRecord[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

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
    if (activeSection !== null && activeSection !== 'visualizations') return;
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
  }, [activeSection]);

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

  // Fetch data from TCC database tables based on selected category
  useEffect(() => {
    if (activeSection !== 'data') return;
    const fetchData = async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        const response = await fetch(`/api/tcc/${activeTab}`);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const result = await response.json();
        setDataRecords(result.data || result || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setDataError(`Unable to load data: ${message}`);
        setDataRecords([]);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, [activeSection, activeTab]);

  const dataTableFields = useMemo(() => {
    switch (activeTab) {
      case 'outbreaks':
        return ['Country', 'Province', 'District', 'Disease', 'Species', 'Serotype', 'Epi_Unit', 'Date_Suspected', 'Date_Confirmed', 'Confirmation_Type'];
      case 'vaccination':
        return ['Country', 'Province', 'District', 'Vaccination_Campaign', 'Vaccination_Date', 'Vaccine_Manufacturer', 'Cattle_Strain', 'SR_Strain', 'Cattle_Population', 'Cattle_Target_Pop', 'Cattle_Estimated_Doses', 'Cattle_Doses_Injected', 'SR_Population', 'SR_Target_Pop', 'SR_Estimated_Doses', 'SR_Doses_Injected'];
      case 'marketprice':
        return [...MARKET_PRICE_FILTER_FIELDS];
      default:
        return [];
    }
  }, [activeTab]);

  const columnUniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    dataTableFields.forEach((field) => {
      map[field] = uniqueColumnValues(dataRecords, field);
    });
    return map;
  }, [dataRecords, dataTableFields]);

  const filteredRecords = useMemo(
    () => applyColumnFilters(dataRecords, columnFilters, dataTableFields),
    [dataRecords, columnFilters, dataTableFields],
  );

  const hasActiveColumnFilters = useMemo(
    () => Object.keys(columnFilters).length > 0,
    [columnFilters],
  );

  const handleColumnFilterChange = (columnKey: string, selected: Set<string> | undefined) => {
    setColumnFilters((prev) => {
      if (selected === undefined) {
        const { [columnKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [columnKey]: selected };
    });
  };

  const availableCountries = useMemo(() => ALLOWED_C, []);

  // Render table rows based on active tab (for outbreaks and vaccination)
  const renderTableRow = (record: SoiDataRecord, index: number) => {
    switch (activeTab) {
      case 'outbreaks':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 text-sm">{record.Country || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Province || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.District || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Disease || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Species || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Serotype || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Epi_Unit || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Date_Suspected || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Date_Confirmed || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Confirmation_Type || '-'}</td>
          </tr>
        );
      case 'vaccination':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 text-sm">{record.Country || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Province || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.District || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Vaccination_Campaign || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Vaccination_Date || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Vaccine_Manufacturer || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Cattle_Strain || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.SR_Strain || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Cattle_Population ?? '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Cattle_Target_Pop ?? '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Cattle_Estimated_Doses ?? '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Cattle_Doses_Injected ?? '-'}</td>
            <td className="px-3 py-2 text-sm">{record.SR_Population ?? '-'}</td>
            <td className="px-3 py-2 text-sm">{record.SR_Target_Pop ?? '-'}</td>
            <td className="px-3 py-2 text-sm">{record.SR_Estimated_Doses ?? '-'}</td>
            <td className="px-3 py-2 text-sm">{record.SR_Doses_Injected ?? '-'}</td>
          </tr>
        );
      default:
        return null;
    }
  };

  // Helper to format cell values
  const fmtVal = (val: number | undefined | null) => val != null ? val : '-';

  // Custom colored marker icons
  const outbreakIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  const vaccinationIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="width:12px;height:12px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  // Download state and refs for dropdowns
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build flat data array based on active tab
  const getExportData = () => {
    if (activeTab === 'marketprice') {
      return filteredRecords.map((r) => ({
        Quarter: r.Quarter,
        Country: r.Country,
        'Cattle Districts Live Min': r.Cattle_Districts_Live_Min,
        'Cattle Districts Live Max': r.Cattle_Districts_Live_Max,
        'Cattle Districts Live Avg': r.Cattle_Districts_Live_Avg,
        'Cattle Districts Meat Min': r.Cattle_Districts_Meat_Min,
        'Cattle Districts Meat Max': r.Cattle_Districts_Meat_Max,
        'Cattle Districts Meat Avg': r.Cattle_Districts_Meat_Avg,
        'Cattle Capital Live Min': r.Cattle_Capital_Live_Min,
        'Cattle Capital Live Max': r.Cattle_Capital_Live_Max,
        'Cattle Capital Live Avg': r.Cattle_Capital_Live_Avg,
        'Cattle Capital Meat Min': r.Cattle_Capital_Meat_Min,
        'Cattle Capital Meat Max': r.Cattle_Capital_Meat_Max,
        'Cattle Capital Meat Avg': r.Cattle_Capital_Meat_Avg,
        'Sheep Districts Live Min': r.Sheep_Districts_Live_Min,
        'Sheep Districts Live Max': r.Sheep_Districts_Live_Max,
        'Sheep Districts Live Avg': r.Sheep_Districts_Live_Avg,
        'Sheep Districts Meat Min': r.Sheep_Districts_Meat_Min,
        'Sheep Districts Meat Max': r.Sheep_Districts_Meat_Max,
        'Sheep Districts Meat Avg': r.Sheep_Districts_Meat_Avg,
        'Sheep Capital Live Min': r.Sheep_Capital_Live_Min,
        'Sheep Capital Live Max': r.Sheep_Capital_Live_Max,
        'Sheep Capital Live Avg': r.Sheep_Capital_Live_Avg,
        'Sheep Capital Meat Min': r.Sheep_Capital_Meat_Min,
        'Sheep Capital Meat Max': r.Sheep_Capital_Meat_Max,
        'Sheep Capital Meat Avg': r.Sheep_Capital_Meat_Avg,
        'Pig Districts Live Min': r.Pig_Districts_Live_Min,
        'Pig Districts Live Max': r.Pig_Districts_Live_Max,
        'Pig Districts Live Avg': r.Pig_Districts_Live_Avg,
        'Pig Districts Meat Min': r.Pig_Districts_Meat_Min,
        'Pig Districts Meat Max': r.Pig_Districts_Meat_Max,
        'Pig Districts Meat Avg': r.Pig_Districts_Meat_Avg,
        'Pig Capital Live Min': r.Pig_Capital_Live_Min,
        'Pig Capital Live Max': r.Pig_Capital_Live_Max,
        'Pig Capital Live Avg': r.Pig_Capital_Live_Avg,
        'Pig Capital Meat Min': r.Pig_Capital_Meat_Min,
        'Pig Capital Meat Max': r.Pig_Capital_Meat_Max,
        'Pig Capital Meat Avg': r.Pig_Capital_Meat_Avg,
      }));
    }
    if (activeTab === 'outbreaks') {
      return filteredRecords.map((r) => ({
        Country: r.Country,
        Province: r.Province,
        District: r.District,
        Disease: r.Disease,
        Species: r.Species,
        Serotype: r.Serotype,
        'Epi Unit': r.Epi_Unit,
        'Date Suspected': r.Date_Suspected,
        'Date Confirmed': r.Date_Confirmed,
        'Confirmation Type': r.Confirmation_Type,
      }));
    }
    // vaccination
    return filteredRecords.map((r) => ({
      Country: r.Country,
      Province: r.Province,
      District: r.District,
      'Vaccination Campaign': r.Vaccination_Campaign,
      'Vaccination Date': r.Vaccination_Date,
      'Vaccine Manufacturer': r.Vaccine_Manufacturer,
      'Cattle Strain': r.Cattle_Strain,
      'SR Strain': r.SR_Strain,
      'Cattle Population': r.Cattle_Population,
      'Cattle Target Pop': r.Cattle_Target_Pop,
      'Cattle Estimated Doses': r.Cattle_Estimated_Doses,
      'Cattle Doses Injected': r.Cattle_Doses_Injected,
      'SR Population': r.SR_Population,
      'SR Target Pop': r.SR_Target_Pop,
      'SR Estimated Doses': r.SR_Estimated_Doses,
      'SR Doses Injected': r.SR_Doses_Injected,
    }));
  };

  const downloadCSV = () => {
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soi_${activeTab}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  const downloadExcel = () => {
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `soi_${activeTab}_data.xlsx`);
    setShowDownloadMenu(false);
  };

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

      {/* 4 Action Buttons */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => setActiveSection(activeSection === 'templates' ? null : 'templates')}
          className={`px-3 py-2 font-semibold text-sm border-2 rounded transition-all duration-300 flex items-center justify-center ${
            activeSection === 'templates'
              ? 'bg-green-greenMain text-white border-green-greenMain'
              : 'bg-transparent text-green-greenMain border-green-greenMain hover:bg-green-greenMain hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Templates
        </button>
        <button
          onClick={() => setActiveSection(activeSection === 'uploads' ? null : 'uploads')}
          className={`px-3 py-2 font-semibold text-sm border-2 rounded transition-all duration-300 flex items-center justify-center ${
            activeSection === 'uploads'
              ? 'bg-green-greenMain text-white border-green-greenMain'
              : 'bg-transparent text-green-greenMain border-green-greenMain hover:bg-green-greenMain hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Uploads
        </button>
        <button
          onClick={() => setActiveSection(activeSection === 'data' ? null : 'data')}
          className={`px-3 py-2 font-semibold text-sm border-2 rounded transition-all duration-300 flex items-center justify-center ${
            activeSection === 'data'
              ? 'bg-green-greenMain text-white border-green-greenMain'
              : 'bg-transparent text-green-greenMain border-green-greenMain hover:bg-green-greenMain hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Data
        </button>
        <button
          onClick={() => setActiveSection(activeSection === 'visualizations' ? null : 'visualizations')}
          className={`px-3 py-2 font-semibold text-sm border-2 rounded transition-all duration-300 flex items-center justify-center ${
            activeSection === 'visualizations'
              ? 'bg-green-greenMain text-white border-green-greenMain'
              : 'bg-transparent text-green-greenMain border-green-greenMain hover:bg-green-greenMain hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          Visualizations
        </button>
      </div>

      {/* Section content */}
      {activeSection && (
        <div className="bg-white rounded-lg shadow p-6">
          {/* Templates Section */}
          {activeSection === 'templates' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Download Templates</h3>
              <p className="text-sm text-gray-600 mb-4">Select a template to download:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['outbreaks', 'vaccination', 'marketprice'] as DataCategory[]).map((cat) => (
                  <a
                    key={cat}
                    href={DATA_CATEGORY_FILES[cat]}
                    download
                    className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700 capitalize">{cat}</span>
                    <span className="text-xs text-gray-500 mt-1">Download .xlsx</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Uploads Section */}
          {activeSection === 'uploads' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Report</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select report type:</label>
                <div className="flex gap-2">
                  {(['outbreaks', 'vaccination', 'marketprice'] as DataCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === cat
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {DATA_CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>
              {selectedCategory && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-2">
                    <span className="font-medium capitalize">{selectedCategory}</span> report upload
                  </p>
                  <p className="text-sm text-gray-500 mb-4">Drag and drop your file here, or click to browse</p>
                  <label className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg cursor-pointer transition-colors">
                    Browse Files
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Data Section */}
          {activeSection === 'data' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">View Data</h3>
                <div className="relative" ref={downloadMenuRef}>
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="px-3 py-1.5 text-sm font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <button
                        onClick={downloadCSV}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                      >
                        Download as CSV
                      </button>
                      <button
                        onClick={downloadExcel}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg"
                      >
                        Download as Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Tab buttons */}
              <div className="flex gap-2 mb-4">
                {(['outbreaks', 'vaccination', 'marketprice'] as DataCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveTab(cat); setColumnFilters({}); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === cat
                        ? 'bg-[#15736d] text-white'
                        : 'bg-[#15736d] text-white hover:opacity-80'
                    }`}
                  >
                    {DATA_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <div className="flex gap-4 mb-4 flex-wrap items-center">
                <p className="text-xs text-gray-500">
                  {filteredRecords.length} of {dataRecords.length} record{dataRecords.length !== 1 ? 's' : ''}
                  {hasActiveColumnFilters ? ' (filtered)' : ''}
                </p>
                {hasActiveColumnFilters && (
                  <button
                    type="button"
                    onClick={() => setColumnFilters({})}
                    className="text-xs text-[#15736d] hover:underline"
                  >
                    Clear column filters
                  </button>
                )}
                <p className="text-xs text-gray-400">Click the funnel icon in any column header to filter</p>
              </div>

              {/* Data Table */}
              {dataLoading ? (
                <div className="text-center py-8 text-gray-500">Loading data...</div>
              ) : dataError ? (
                <div className="text-center py-8 text-red-500">{dataError}</div>
              ) : activeTab === 'marketprice' ? (
                /* Market Price Table with multi-level headers */
                <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-200">
                      {/* Row 1: Species categories */}
                      <tr>
                        <th rowSpan={5} className="px-2 py-1 text-left font-medium border-r bg-gray-300 align-top">
                          <div className="flex flex-col gap-2">
                            <span>Quarter</span>
                            <SoiColumnFilter
                              label="Quarter"
                              columnKey="Quarter"
                              uniqueValues={columnUniqueValuesMap.Quarter || []}
                              selectedValues={columnFilters.Quarter}
                              onFilterChange={handleColumnFilterChange}
                            />
                          </div>
                        </th>
                        <th rowSpan={5} className="px-2 py-1 text-left font-medium border-r bg-gray-300 align-top">
                          <div className="flex flex-col gap-2">
                            <span>Country</span>
                            <SoiColumnFilter
                              label="Country"
                              columnKey="Country"
                              uniqueValues={columnUniqueValuesMap.Country || []}
                              selectedValues={columnFilters.Country}
                              onFilterChange={handleColumnFilterChange}
                            />
                          </div>
                        </th>
                        <th colSpan={12} className="px-2 py-1 text-center font-bold border-r">Cattle/Beef</th>
                        <th colSpan={12} className="px-2 py-1 text-center font-bold border-r">Sheep</th>
                        <th colSpan={12} className="px-2 py-1 text-center font-bold">Pig</th>
                      </tr>
                      {/* Row 2: Districts / Capital */}
                      <tr>
                        <th colSpan={6} className="px-2 py-1 text-center font-semibold border-r">Districts</th>
                        <th colSpan={6} className="px-2 py-1 text-center font-semibold border-r">Capital</th>
                        <th colSpan={6} className="px-2 py-1 text-center font-semibold border-r">Districts</th>
                        <th colSpan={6} className="px-2 py-1 text-center font-semibold border-r">Capital</th>
                        <th colSpan={6} className="px-2 py-1 text-center font-semibold border-r">Districts</th>
                        <th colSpan={6} className="px-2 py-1 text-center font-semibold">Capital</th>
                      </tr>
                      {/* Row 3: Live / Meat */}
                      <tr>
                        {/* Cattle Districts */}
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Live</th>
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Meat</th>
                        {/* Cattle Capital */}
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Live</th>
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Meat</th>
                        {/* Sheep Districts */}
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Live</th>
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Meat</th>
                        {/* Sheep Capital */}
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Live</th>
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Meat</th>
                        {/* Pig Districts */}
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Live</th>
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Meat</th>
                        {/* Pig Capital */}
                        <th colSpan={3} className="px-2 py-1 text-center font-medium border-r">Live</th>
                        <th colSpan={3} className="px-2 py-1 text-center font-medium">Meat</th>
                      </tr>
                      {/* Row 4: m / M / A */}
                      <tr>
                        {/* Cattle Districts */}
                        {['Live', 'Meat'].map((type) => ['Min', 'Max', 'Avg'].map((agg) => (
                          <th key={`ctl_dis_${type}_${agg}`} className="px-1 py-1 text-center font-medium border-r">{agg === 'Min' ? 'm' : agg === 'Max' ? 'M' : 'A'}</th>
                        )))}
                        {/* Cattle Capital */}
                        {['Live', 'Meat'].map((type) => ['Min', 'Max', 'Avg'].map((agg) => (
                          <th key={`ctl_cap_${type}_${agg}`} className="px-1 py-1 text-center font-medium border-r">{agg === 'Min' ? 'm' : agg === 'Max' ? 'M' : 'A'}</th>
                        )))}
                        {/* Sheep Districts */}
                        {['Live', 'Meat'].map((type) => ['Min', 'Max', 'Avg'].map((agg) => (
                          <th key={`shp_dis_${type}_${agg}`} className="px-1 py-1 text-center font-medium border-r">{agg === 'Min' ? 'm' : agg === 'Max' ? 'M' : 'A'}</th>
                        )))}
                        {/* Sheep Capital */}
                        {['Live', 'Meat'].map((type) => ['Min', 'Max', 'Avg'].map((agg) => (
                          <th key={`shp_cap_${type}_${agg}`} className="px-1 py-1 text-center font-medium border-r">{agg === 'Min' ? 'm' : agg === 'Max' ? 'M' : 'A'}</th>
                        )))}
                        {/* Pig Districts */}
                        {['Live', 'Meat'].map((type) => ['Min', 'Max', 'Avg'].map((agg) => (
                          <th key={`pig_dis_${type}_${agg}`} className="px-1 py-1 text-center font-medium border-r">{agg === 'Min' ? 'm' : agg === 'Max' ? 'M' : 'A'}</th>
                        )))}
                        {/* Pig Capital */}
                        {['Live', 'Meat'].map((type) => ['Min', 'Max', 'Avg'].map((agg) => (
                          <th key={`pig_cap_${type}_${agg}`} className="px-1 py-1 text-center font-medium border-r">{agg === 'Min' ? 'm' : agg === 'Max' ? 'M' : 'A'}</th>
                        )))}
                      </tr>
                      {/* Row 5: column filters for price fields */}
                      <tr className="bg-gray-100">
                        {MARKET_PRICE_FILTER_FIELDS.slice(2).map((field) => (
                          <th key={`filter_${field}`} className="px-1 py-1 border-r">
                            <SoiColumnFilter
                              label={field}
                              columnKey={field}
                              uniqueValues={columnUniqueValuesMap[field] || []}
                              selectedValues={columnFilters[field]}
                              onFilterChange={handleColumnFilterChange}
                              compact
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={MARKET_PRICE_FILTER_FIELDS.length} className="px-3 py-8 text-center text-sm text-gray-500">
                            No records found
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="px-2 py-1 text-sm border-r">{r.Quarter || '-'}</td>
                            <td className="px-2 py-1 text-sm border-r whitespace-nowrap">{r.Country || '-'}</td>
                            {/* Cattle Districts */}
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Districts_Live_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Districts_Live_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Districts_Live_Avg)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Districts_Meat_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Districts_Meat_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Districts_Meat_Avg)}</td>
                            {/* Cattle Capital */}
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Capital_Live_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Capital_Live_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Capital_Live_Avg)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Capital_Meat_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Capital_Meat_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Cattle_Capital_Meat_Avg)}</td>
                            {/* Sheep Districts */}
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Districts_Live_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Districts_Live_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Districts_Live_Avg)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Districts_Meat_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Districts_Meat_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Districts_Meat_Avg)}</td>
                            {/* Sheep Capital */}
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Capital_Live_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Capital_Live_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Capital_Live_Avg)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Capital_Meat_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Capital_Meat_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Sheep_Capital_Meat_Avg)}</td>
                            {/* Pig Districts */}
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Districts_Live_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Districts_Live_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Districts_Live_Avg)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Districts_Meat_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Districts_Meat_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Districts_Meat_Avg)}</td>
                            {/* Pig Capital */}
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Capital_Live_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Capital_Live_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Capital_Live_Avg)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Capital_Meat_Min)}</td>
                            <td className="px-2 py-1 text-sm text-center border-r">{fmtVal(r.Pig_Capital_Meat_Max)}</td>
                            <td className="px-2 py-1 text-sm text-center">{fmtVal(r.Pig_Capital_Meat_Avg)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Generic Table for outbreaks / vaccination */
                <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {dataTableFields.map((header) => (
                          <SoiColumnFilterHeader
                            key={header}
                            label={header}
                            columnKey={header}
                            uniqueValues={columnUniqueValuesMap[header] || []}
                            selectedValues={columnFilters[header]}
                            onFilterChange={handleColumnFilterChange}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={dataTableFields.length} className="px-3 py-8 text-center text-sm text-gray-500">
                            No records found
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((record, i) => renderTableRow(record, i))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Dashboard / Map - always visible when no section or when Visualizations selected */}
      {(activeSection === null || activeSection === 'visualizations') && (
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
      )}
    </div>
  );
};

export default RISPSOI;