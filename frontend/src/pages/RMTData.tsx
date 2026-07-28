import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Country {
  id: number;
  iso3: string;
  name_un: string;
  subregion?: string;
}

interface ScoreRow {
  id?: number;
  country_id: number;
  countryName: string;
  FMD: number | null;
  PPR: number | null;
  LSD: number | null;
  RVF: number | null;
  SPGP: number | null;
  date: string;
}

const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'] as const;

/** Keep only the latest row per country (safety net if API returns duplicates). */
function latestPerCountry<T extends { country_id: number; date?: string; id?: number }>(rows: T[]): T[] {
  const byCountry = new Map<number, T>();
  rows.forEach((row) => {
    const existing = byCountry.get(row.country_id);
    if (!existing) {
      byCountry.set(row.country_id, row);
      return;
    }
    const existingDate = existing.date || '';
    const rowDate = row.date || '';
    if (rowDate > existingDate || (rowDate === existingDate && (row.id || 0) > (existing.id || 0))) {
      byCountry.set(row.country_id, row);
    }
  });
  return Array.from(byCountry.values()).sort((a, b) => a.country_id - b.country_id);
}

function formatRows(records: any[], countries: Country[]): ScoreRow[] {
  const deduped = latestPerCountry(records);
  return deduped.map((record) => {
    const country = countries.find((c) => c.id === record.country_id);
    return {
      id: record.id,
      country_id: record.country_id,
      countryName: country ? country.name_un : `Country ${record.country_id}`,
      FMD: record.FMD ?? null,
      PPR: record.PPR ?? null,
      LSD: record.LSD ?? null,
      RVF: record.RVF ?? null,
      SPGP: record.SPGP ?? null,
      date: record.date ? String(record.date).split('T')[0].split(' ')[0] : 'N/A',
    };
  });
}

const RMTDataNew: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryDiseaseStatus, setCountryDiseaseStatus] = useState<ScoreRow[]>([]);
  const [countryMitigationMeasures, setCountryMitigationMeasures] = useState<ScoreRow[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [activeTable, setActiveTable] = useState<'disease' | 'mitigation' | null>(null);

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    setLoading(true);
    try {
      const countriesData = await apiService.countries.getAll();
      setCountries(countriesData.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  };

  const loadDiseaseStatusData = async () => {
    if (countries.length === 0) {
      setError('Countries not loaded yet. Please wait and try again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.rmt.getAdminDiseaseStatus();
      const records = Array.isArray(response.data) ? response.data : [];
      setCountryDiseaseStatus(formatRows(records, countries));
      setShowTable(true);
      setActiveTable('disease');
    } catch (err: any) {
      setError(err.message || 'Failed to load disease status data');
    } finally {
      setLoading(false);
    }
  };

  const loadMitigationMeasuresData = async () => {
    if (countries.length === 0) {
      setError('Countries not loaded yet. Please wait and try again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.rmt.getAdminMitigationMeasures();
      const records = Array.isArray(response.data) ? response.data : [];
      setCountryMitigationMeasures(formatRows(records, countries));
      setShowTable(true);
      setActiveTable('mitigation');
    } catch (err: any) {
      setError(err.message || 'Failed to load mitigation measures data');
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = (rows: ScoreRow[], currentDate: string) =>
    rows.map((row) => ({
      country_id: row.country_id,
      FMD: row.FMD ?? 0,
      PPR: row.PPR ?? 0,
      LSD: row.LSD ?? 0,
      RVF: row.RVF ?? 0,
      SPGP: row.SPGP ?? 0,
      date: currentDate,
    }));

  const handleSave = async () => {
    if (!activeTable) return;

    setSaving(true);
    setError(null);

    try {
      const currentDate = new Date().toISOString().split('T')[0];

      if (activeTable === 'disease') {
        const payload = buildPayload(countryDiseaseStatus, currentDate);
        await apiService.rmt.saveAdminDiseaseStatus(payload);
        alert('Disease status data saved successfully!');
        await loadDiseaseStatusData();
      } else {
        const payload = buildPayload(countryMitigationMeasures, currentDate);
        await apiService.rmt.saveAdminMitigationMeasures(payload);
        alert('Mitigation measures data saved successfully!');
        await loadMitigationMeasuresData();
      }
    } catch (err: any) {
      console.error('Error saving data:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to save data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderScoreTable = (
    title: string,
    rows: ScoreRow[],
    setRows: React.Dispatch<React.SetStateAction<ScoreRow[]>>,
    maxScore: number,
  ) => (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">{rows.length} countries (latest scores)</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white border">
          <thead>
            <tr className="bg-[#15736d] text-white">
              <th className="border border-gray-300 px-4 py-2 text-left">Country</th>
              {diseases.map((disease) => (
                <th key={disease} className="border border-gray-300 px-4 py-2 text-center">
                  {disease}
                </th>
              ))}
              <th className="border border-gray-300 px-4 py-2 text-center">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.country_id}>
                <td className="border border-gray-300 px-4 py-2 font-medium">{row.countryName}</td>
                {diseases.map((disease) => (
                  <td key={disease} className="border border-gray-300 px-2 py-2 text-center">
                    <select
                      value={row[disease] !== null && row[disease] !== undefined ? String(row[disease]) : ''}
                      onChange={(e) => {
                        const newValue = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        setRows((prev) =>
                          prev.map((item) =>
                            item.country_id === row.country_id ? { ...item, [disease]: newValue } : item,
                          ),
                        );
                      }}
                      className="w-full px-2 py-1 rounded border text-center bg-white"
                    >
                      <option value="">N/A</option>
                      {Array.from({ length: maxScore + 1 }, (_, i) => (
                        <option key={i} value={String(i)}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
                <td className="border border-gray-300 px-4 py-2 text-center">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading && countries.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl">Loading RMT data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="font-black capitalize text-2xl my-3">RMT Data Entry</h1>
      <p className="text-sm text-gray-600 mb-6">
        Edit the latest system-wide scores per country. Saving updates existing rows instead of creating duplicates.
      </p>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4 mb-8">
        <button
          onClick={loadDiseaseStatusData}
          className="bg-[#15736d] hover:bg-[#438f8a] text-white px-6 py-3 rounded-md transition-colors duration-300 mr-4"
          disabled={loading}
        >
          {loading && activeTable === 'disease' ? 'Loading...' : 'Update Disease Status'}
        </button>

        <button
          onClick={loadMitigationMeasuresData}
          className="bg-[#15736d] hover:bg-[#438f8a] text-white px-6 py-3 rounded-md transition-colors duration-300"
          disabled={loading}
        >
          {loading && activeTable === 'mitigation' ? 'Loading...' : 'Update Mitigation Measures'}
        </button>
      </div>

      {showTable && activeTable === 'disease' && countryDiseaseStatus.length > 0 &&
        renderScoreTable('Disease Status', countryDiseaseStatus, setCountryDiseaseStatus, 3)}

      {showTable && activeTable === 'mitigation' && countryMitigationMeasures.length > 0 &&
        renderScoreTable('Mitigation Measures', countryMitigationMeasures, setCountryMitigationMeasures, 4)}

      {showTable &&
        ((activeTable === 'disease' && countryDiseaseStatus.length > 0) ||
          (activeTable === 'mitigation' && countryMitigationMeasures.length > 0)) && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-3 text-white font-medium rounded-lg transition-colors ${
                saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#15736d] hover:bg-[#124a47]'
              }`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
    </div>
  );
};

export default RMTDataNew;
