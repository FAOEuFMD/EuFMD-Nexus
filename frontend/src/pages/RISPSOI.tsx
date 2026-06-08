import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  Year: number;
  Country: string;
  Disease?: string;
  Outbreaks?: string;
  Vaccination_Doses?: number;
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

const RISPSOI: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SoiSection>(null);
  const [selectedCategory, setSelectedCategory] = useState<DataCategory | null>(null);
  const [activeTab, setActiveTab] = useState<DataCategory>('outbreaks');

  // Data table state
  const [dataRecords, setDataRecords] = useState<SoiDataRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');

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

  // Filter records
  const filteredRecords = useMemo(() => {
    return dataRecords.filter((record) => {
      const yearMatch = filterYear === 'all' || record.Year?.toString() === filterYear;
      const countryMatch = filterCountry === 'all' || record.Country === filterCountry;
      return yearMatch && countryMatch;
    });
  }, [dataRecords, filterYear, filterCountry]);

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(dataRecords.map((r) => r.Year).filter(Boolean)));
    return years.sort((a, b) => b - a);
  }, [dataRecords]);

  const availableCountries = useMemo(() => {
    return Array.from(new Set(dataRecords.map((r) => r.Country).filter(Boolean))).sort();
  }, [dataRecords]);

  // Render table columns based on active tab
  const renderTableHeaders = () => {
    switch (activeTab) {
      case 'outbreaks':
        return ['Year', 'Country', 'Disease', 'Outbreaks', 'Description'];
      case 'vaccination':
        return ['Year', 'Country', 'Disease', 'Doses', 'Description'];
      case 'marketprice':
        return ['Year', 'Country', 'Price', 'Description'];
      default:
        return [];
    }
  };

  const renderTableRow = (record: SoiDataRecord, index: number) => {
    switch (activeTab) {
      case 'outbreaks':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 text-sm">{record.Year}</td>
            <td className="px-3 py-2 text-sm">{record.Country}</td>
            <td className="px-3 py-2 text-sm">{record.Disease || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Outbreaks || '0'}</td>
            <td className="px-3 py-2 text-sm text-gray-500 max-w-xs truncate">{record.Outbreak_Description || '-'}</td>
          </tr>
        );
      case 'vaccination':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 text-sm">{record.Year}</td>
            <td className="px-3 py-2 text-sm">{record.Country}</td>
            <td className="px-3 py-2 text-sm">{record.Disease || '-'}</td>
            <td className="px-3 py-2 text-sm">{record.Vaccination_Doses || '0'}</td>
            <td className="px-3 py-2 text-sm text-gray-500 max-w-xs truncate">{record.Vaccination_Description || '-'}</td>
          </tr>
        );
      case 'marketprice':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 text-sm">{record.Year}</td>
            <td className="px-3 py-2 text-sm">{record.Country}</td>
            <td className="px-3 py-2 text-sm">{record.Price || '-'}</td>
            <td className="px-3 py-2 text-sm text-gray-500 max-w-xs truncate">{record.Description || '-'}</td>
          </tr>
        );
      default:
        return null;
    }
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

      {/* 4 Action Buttons - small and inline like RISP nav-btn style */}
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
              <h3 className="text-lg font-semibold text-gray-800 mb-4">View Data</h3>
              {/* Tab buttons */}
              <div className="flex gap-2 mb-4">
                {(['outbreaks', 'vaccination', 'marketprice'] as DataCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveTab(cat); setFilterYear('all'); setFilterCountry('all'); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === cat
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {DATA_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year:</label>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((y) => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Country:</label>
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">All Countries</option>
                    {availableCountries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end text-xs text-gray-500 pb-1">
                  {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
                </div>
              </div>
              {/* Table */}
              {dataLoading ? (
                <div className="text-center py-8 text-gray-500">Loading data...</div>
              ) : dataError ? (
                <div className="text-center py-8 text-red-500">{dataError}</div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {renderTableHeaders().map((header) => (
                          <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={renderTableHeaders().length} className="px-3 py-8 text-center text-sm text-gray-500">
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

          {/* Visualizations Section */}
          {activeSection === 'visualizations' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Visualizations</h3>
              <p className="text-sm text-gray-600 mb-4">
                Interactive map showing SOI data across regions.
              </p>
              <div className="h-96 w-full rounded-lg overflow-hidden border border-gray-200">
                <MapContainer
                  center={[47, 28]}
                  zoom={4}
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
                </MapContainer>
              </div>
              <div className="mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700 italic">
                  The boundaries and names shown and the designations used on this map do not imply the
                  expression of any opinion whatsoever on the part of FAO concerning the legal status of any
                  country, territory, city or area or of its authorities, or concerning the delimitation of its
                  frontiers and boundaries.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RISPSOI;