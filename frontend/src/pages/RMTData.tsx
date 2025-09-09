import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Country {
  id: number;
  iso3: string;
  name_un: string;
  subregion?: string;
}

const RMTDataNew: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryDiseaseStatus, setCountryDiseaseStatus] = useState<any[]>([]);
  const [countryMitigationMeasures, setCountryMitigationMeasures] = useState<any[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [activeTable, setActiveTable] = useState<'disease' | 'mitigation' | null>(null);
  
  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];

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
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.rmt.getDiseaseStatus();
      const allDiseaseStatusRecords = Array.isArray(response.data) ? response.data : [];
      
      // Format the data to include country names and show all records
      const formattedData = allDiseaseStatusRecords.map((record: any) => {
        const country = countries.find(c => c.id === record.country_id);
        return {
          ...record,
          countryName: country ? country.name_un : `Country ${record.country_id}`,
          date: record.date ? new Date(record.date).toISOString().split('T')[0] : 'N/A'
        };
      });
      
      setCountryDiseaseStatus(formattedData);
      setShowTable(true);
      setActiveTable('disease');
    } catch (err: any) {
      setError(err.message || 'Failed to load disease status data');
    } finally {
      setLoading(false);
    }
  };

  const loadMitigationMeasuresData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.rmt.getMitigationMeasures();
      const allMitigationRecords = Array.isArray(response.data) ? response.data : [];
      
      // Format the data to include country names and show all records
      const formattedData = allMitigationRecords.map((record: any) => {
        const country = countries.find(c => c.id === record.country_id);
        return {
          ...record,
          countryName: country ? country.name_un : `Country ${record.country_id}`,
          date: record.date ? new Date(record.date).toISOString().split('T')[0] : 'N/A'
        };
      });
      
      setCountryMitigationMeasures(formattedData);
      setShowTable(true);
      setActiveTable('mitigation');
    } catch (err: any) {
      setError(err.message || 'Failed to load mitigation measures data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeTable) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const currentDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
      
      if (activeTable === 'disease') {
        // Save disease status data
        for (const row of countryDiseaseStatus) {
          const dataToSave = {
            country_id: row.country_id,
            FMD: row.FMD || 0,
            PPR: row.PPR || 0,
            LSD: row.LSD || 0,
            RVF: row.RVF || 0,
            SPGP: row.SPGP || 0,
            date: currentDate
          };
          
          await apiService.rmt.postDiseaseStatus(dataToSave);
        }
        alert('Disease status data saved successfully!');
      } else if (activeTable === 'mitigation') {
        // Save mitigation measures data
        for (const row of countryMitigationMeasures) {
          const dataToSave = {
            country_id: row.country_id,
            FMD: row.FMD || 0,
            PPR: row.PPR || 0,
            LSD: row.LSD || 0,
            RVF: row.RVF || 0,
            SPGP: row.SPGP || 0,
            date: currentDate
          };
          
          await apiService.rmt.postMitigationMeasures(dataToSave);
        }
        alert('Mitigation measures data saved successfully!');
      }
      
    } catch (error) {
      console.error('Error saving data:', error);
      setError('Failed to save data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && countries.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl">Loading RMT data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="font-black capitalize text-2xl my-3">
        RMT Data Entry
      </h1>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main action buttons */}
      <div className="space-y-4 mb-8">
        <button 
          onClick={loadDiseaseStatusData}
          className="bg-[#15736d] hover:bg-[#438f8a] text-white px-6 py-3 rounded-md transition-colors duration-300 mr-4"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Update Disease Status'}
        </button>

        <button
          onClick={loadMitigationMeasuresData}
          className="bg-[#15736d] hover:bg-[#438f8a] text-white px-6 py-3 rounded-md transition-colors duration-300"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Update Mitigation Measures'}
        </button>
      </div>

      {/* Disease Status Table */}
      {showTable && activeTable === 'disease' && countryDiseaseStatus.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Disease Status</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white border">
              <thead>
                <tr className="bg-[#15736d] text-white">
                  <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Country</th>
                  {diseases.map(disease => (
                    <th key={disease} className="border border-gray-300 px-4 py-2 text-center">
                      {disease}
                    </th>
                  ))}
                  <th className="border border-gray-300 px-4 py-2 text-center">Date</th>
                </tr>
              </thead>
              <tbody>
                {countryDiseaseStatus.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-gray-300 px-4 py-2">
                      {row.id}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      {row.countryName}
                    </td>
                    {diseases.map(disease => (
                      <td key={disease} className="border border-gray-300 px-2 py-2 text-center">
                        <select
                          value={row[disease] !== null && row[disease] !== undefined ? String(row[disease]) : ''}
                          onChange={(e) => {
                            const newValue = e.target.value === '' ? null : parseInt(e.target.value);
                            setCountryDiseaseStatus(prev => 
                              prev.map(item => 
                                item.id === row.id 
                                  ? { ...item, [disease]: newValue }
                                  : item
                              )
                            );
                          }}
                          className="w-full px-2 py-1 rounded border text-center bg-white"
                        >
                          <option value="">N/A</option>
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </td>
                    ))}
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {row.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mitigation Measures Table */}
      {showTable && activeTable === 'mitigation' && countryMitigationMeasures.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Mitigation Measures</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white border">
              <thead>
                <tr className="bg-[#15736d] text-white">
                  <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Country</th>
                  {diseases.map(disease => (
                    <th key={disease} className="border border-gray-300 px-4 py-2 text-center">
                      {disease}
                    </th>
                  ))}
                  <th className="border border-gray-300 px-4 py-2 text-center">Date</th>
                </tr>
              </thead>
              <tbody>
                {countryMitigationMeasures.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-gray-300 px-4 py-2">
                      {row.id}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      {row.countryName}
                    </td>
                    {diseases.map(disease => (
                      <td key={disease} className="border border-gray-300 px-2 py-2 text-center">
                        <select
                          value={row[disease] !== null && row[disease] !== undefined ? String(row[disease]) : ''}
                          onChange={(e) => {
                            const newValue = e.target.value === '' ? null : parseInt(e.target.value);
                            setCountryMitigationMeasures(prev => 
                              prev.map(item => 
                                item.id === row.id 
                                  ? { ...item, [disease]: newValue }
                                  : item
                              )
                            );
                          }}
                          className="w-full px-2 py-1 rounded border text-center bg-white"
                        >
                          <option value="">N/A</option>
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </select>
                      </td>
                    ))}
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {row.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Button */}
      {showTable && ((activeTable === 'disease' && countryDiseaseStatus.length > 0) || 
                     (activeTable === 'mitigation' && countryMitigationMeasures.length > 0)) && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-3 text-white font-medium rounded-lg transition-colors ${
              saving 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-[#15736d] hover:bg-[#124a47]'
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