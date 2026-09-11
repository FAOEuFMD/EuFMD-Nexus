import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { isAllowedSoiCountry } from '../utils/maps/soiChoroplethMatching';
import { diseasesMatch } from '../utils/soiDiseaseMatch';

export type SoiRawSubTab = 'outbreaks' | 'vaccination' | 'surveillance' | 'marketprice';

interface SoiRawDataViewProps {
  filterCountry: string;
  filterDisease: string;
  filterDateFrom: string;
  filterDateTo: string;
}

const SUB_TABS: { key: SoiRawSubTab; label: string }[] = [
  { key: 'outbreaks', label: 'Outbreaks' },
  { key: 'vaccination', label: 'Vaccination' },
  { key: 'surveillance', label: 'Surveillance' },
  { key: 'marketprice', label: 'Market price' },
];

const COLUMN_SETS: Record<SoiRawSubTab, string[]> = {
  outbreaks: [
    'Country',
    'Year',
    'Quarter',
    'Disease',
    'Province',
    'District',
    'Location',
    'Outbreaks',
    'Species',
    'Status',
    'Serotype',
    'Control_Measures',
    'Date_Suspected',
    'Date_Confirmed',
    'Latitude',
    'Longitude',
  ],
  vaccination: [
    'Country',
    'Year',
    'Disease',
    'Province',
    'District',
    'Location',
    'Status',
    'Vaccination_Type',
    'Species',
    'Q1',
    'Q2',
    'Q3',
    'Q4',
    'Vaccination_Doses',
    'Coverage',
    'Vaccination_Date',
    'Vaccination_Campaign',
  ],
  surveillance: [
    'Country',
    'Year',
    'Quarter',
    'Disease',
    'Passive_Surveillance',
    'Active_Surveillance',
    'Details',
    'Created_At',
  ],
  marketprice: [
    'Country',
    'Year',
    'Quarter',
    'Species',
    'Market_Level',
    'Product',
    'Price_Min',
    'Price_Max',
    'Price_Avg',
    'Reference',
  ],
};

function quarterStart(year: string | number | undefined, quarter: string | undefined): string | null {
  if (year == null || year === '') return null;
  const y = String(year);
  const q = String(quarter || 'Q1').toUpperCase();
  const month = { Q1: '01', Q2: '04', Q3: '07', Q4: '10' }[q] || '01';
  return `${y}-${month}-01`;
}

function rowDate(subTab: SoiRawSubTab, row: Record<string, unknown>): string | null {
  if (subTab === 'outbreaks') {
    const d = row.Date_Confirmed || row.Date_Suspected;
    return d ? String(d).slice(0, 10) : null;
  }
  if (subTab === 'vaccination') {
    if (row.Vaccination_Date) return String(row.Vaccination_Date).slice(0, 10);
    return row.Year != null ? `${row.Year}-01-01` : null;
  }
  if (subTab === 'surveillance' || subTab === 'marketprice') {
    return quarterStart(row.Year as string | number | undefined, row.Quarter as string | undefined);
  }
  return null;
}

function cellDisplay(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

const SoiRawDataView: React.FC<SoiRawDataViewProps> = ({
  filterCountry,
  filterDisease,
  filterDateFrom,
  filterDateTo,
}) => {
  const [subTab, setSubTab] = useState<SoiRawSubTab>('outbreaks');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowsByTab, setRowsByTab] = useState<Partial<Record<SoiRawSubTab, Record<string, unknown>[]>>>(
    {}
  );
  const loadedRef = React.useRef<Partial<Record<SoiRawSubTab, boolean>>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (loadedRef.current[subTab]) return;
      setLoading(true);
      setError(null);
      try {
        const url =
          subTab === 'outbreaks'
            ? '/api/tcc/outbreaks'
            : subTab === 'vaccination'
              ? '/api/tcc/vaccination'
              : subTab === 'surveillance'
                ? '/api/tcc/raw/surveillance'
                : '/api/tcc/raw/marketprice';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load ${subTab} (${res.status})`);
        const payload = await res.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        if (!cancelled) {
          loadedRef.current[subTab] = true;
          setRowsByTab((prev) => ({ ...prev, [subTab]: data }));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load raw data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [subTab]);

  const filteredRows = useMemo(() => {
    const rows = rowsByTab[subTab] || [];
    return rows.filter((row) => {
      const country = String(row.Country || '');
      if (!isAllowedSoiCountry(country)) return false;
      if (filterCountry !== 'all' && country !== filterCountry) return false;

      // Market price has no disease column
      if (subTab !== 'marketprice' && filterDisease) {
        const disease = String(row.Disease || '');
        if (disease && !diseasesMatch(disease, filterDisease)) return false;
      }

      const date = rowDate(subTab, row);
      if (filterDateFrom && date && date < filterDateFrom) return false;
      if (filterDateTo && date && date > filterDateTo) return false;
      return true;
    });
  }, [rowsByTab, subTab, filterCountry, filterDisease, filterDateFrom, filterDateTo]);

  const columns = COLUMN_SETS[subTab];

  const handleDownload = () => {
    const sheetRows = filteredRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const col of columns) {
        out[col] = row[col] ?? '';
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows.length ? sheetRows : [{}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, SUB_TABS.find((t) => t.key === subTab)?.label || 'Data');
    const countryBit = filterCountry === 'all' ? 'all_countries' : filterCountry.replace(/\s+/g, '_');
    XLSX.writeFile(wb, `soi_raw_${subTab}_${countryBit}.xlsx`);
  };

  return (
    <div className="mt-4 border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                subTab === tab.key
                  ? 'bg-[#15736d] text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{filteredRows.length} row{filteredRows.length === 1 ? '' : 's'}</span>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || filteredRows.length === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded border-2 border-[#15736d] text-[#15736d] hover:bg-[#15736d] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Download Excel
          </button>
        </div>
      </div>

      {loading && <div className="p-6 text-sm text-gray-600">Loading raw data…</div>}
      {error && <div className="p-4 text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-auto max-h-[28rem]">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-2 font-semibold text-gray-700 whitespace-nowrap border-b border-gray-200"
                  >
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">
                    No rows match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {columns.map((col) => (
                      <td key={col} className="px-2 py-1.5 whitespace-nowrap text-gray-800 border-b border-gray-100">
                        {cellDisplay(row[col])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SoiRawDataView;
