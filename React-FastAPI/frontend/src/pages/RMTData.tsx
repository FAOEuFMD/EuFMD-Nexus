import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Country {
  id: number;
  iso3: string;
  name_un: string;
  subregion?: string;
}

interface DiseaseStatusEntry {
  id?: number;
  countryId: number;
  country?: string;
  FMD: number;
  PPR: number;
  LSD: number;
  RVF: number;
  SPGP: number;
  date: string;
}

interface MitigationMeasureEntry {
  id?: number;
  countryId: number;
  country?: string;
  FMD: number;
  PPR: number;
  LSD: number;
  RVF: number;
  SPGP: number;
  date: string;
}

const RMTData: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [countries, setCountries] = useState<Country[]>([]);
  const [diseaseStatus, setDiseaseStatus] = useState<DiseaseStatusEntry[]>([]);
  const [mitigationMeasures, setMitigationMeasures] = useState<MitigationMeasureEntry[]>([]);
  
  // UI states
  const [showDiseaseStatusTable, setShowDiseaseStatusTable] = useState(false);
  const [showMitigationMeasuresTable, setShowMitigationMeasuresTable] = useState(false);
  const [showDiseaseStatusForm, setShowDiseaseStatusForm] = useState(false);
  const [showMitigationMeasuresForm, setShowMitigationMeasuresForm] = useState(false);
  
  // Form states
  const [newDiseaseStatus, setNewDiseaseStatus] = useState<Partial<DiseaseStatusEntry>>({
    countryId: 0,
    FMD: 0,
    PPR: 0,
    LSD: 0,
    RVF: 0,
    SPGP: 0,
    date: new Date().toISOString().split('T')[0]
  });
  
  const [newMitigationMeasure, setNewMitigationMeasure] = useState<Partial<MitigationMeasureEntry>>({
    countryId: 0,
    FMD: 0,
    PPR: 0,
    LSD: 0,
    RVF: 0,
    SPGP: 0,
    date: new Date().toISOString().split('T')[0]
  });

  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];

  // Color-coding utility function to match Vue app
  const getScoreColorClass = (score: number | null | undefined) => {
    if (score === 0) {
      return 'score-ok';
    } else if (score === null || score === undefined) {
      return 'score-na';
    } else if (score === 1) {
      return 'score-warning1';
    } else if (score === 2) {
      return 'score-warning2';
    } else if (score === 3) {
      return 'score-warning4';
    }
    return 'score-na';
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
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

  const fetchDiseaseStatus = async () => {
    setLoading(true);
    try {
      const data = await apiService.rmt.getDiseaseStatus();
      // Add country names to the data
      const dataWithCountries = data.data.map((item: any) => ({
        ...item,
        country: countries.find(c => c.id === item.countryId)?.name_un || 'Unknown'
      }));
      setDiseaseStatus(dataWithCountries);
      setShowDiseaseStatusTable(true);
      setShowMitigationMeasuresTable(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load disease status data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMitigationMeasures = async () => {
    setLoading(true);
    try {
      const data = await apiService.rmt.getMitigationMeasures();
      // Add country names to the data
      const dataWithCountries = data.data.map((item: any) => ({
        ...item,
        country: countries.find(c => c.id === item.countryId)?.name_un || 'Unknown'
      }));
      setMitigationMeasures(dataWithCountries);
      setShowMitigationMeasuresTable(true);
      setShowDiseaseStatusTable(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load mitigation measures data');
    } finally {
      setLoading(false);
    }
  };

  const closeTable = () => {
    setShowDiseaseStatusTable(false);
    setShowMitigationMeasuresTable(false);
    setShowDiseaseStatusForm(false);
    setShowMitigationMeasuresForm(false);
  };

  const handleSubmitDiseaseStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiseaseStatus.countryId) {
      alert('Please select a country');
      return;
    }

    alert('Creating new disease status is currently disabled as this feature is being migrated to the new system.');
    
    // Reset form
    setShowDiseaseStatusForm(false);
    setNewDiseaseStatus({
      countryId: 0,
      FMD: 0,
      PPR: 0,
      LSD: 0,
      RVF: 0,
      SPGP: 0,
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleSubmitMitigationMeasure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMitigationMeasure.countryId) {
      alert('Please select a country');
      return;
    }

    alert('Creating new mitigation measure is currently disabled as this feature is being migrated to the new system.');
    
    // Reset form
    setShowMitigationMeasuresForm(false);
    setNewMitigationMeasure({
      countryId: 0,
      FMD: 0,
      PPR: 0,
      LSD: 0,
      RVF: 0,
      SPGP: 0,
      date: new Date().toISOString().split('T')[0]
    });
  };

  const deleteDiseaseStatus = async (id: number) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete this disease status record?')) return;
    
    alert('Deleting disease status is currently disabled as this feature is being migrated to the new system.');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl">Loading RMT data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="min-h-32 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
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

        <div className="space-x-4">
          <button 
            onClick={fetchDiseaseStatus}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md transition-colors mb-2"
          >
            Add Disease Status
          </button>

          <button
            onClick={fetchMitigationMeasures}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md transition-colors mb-2"
          >
            Add Mitigation Measures
          </button>
        </div>
      </div>
      
      {/* Disease Status Table */}
      {showDiseaseStatusTable && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Disease Status Data</h2>
            <div className="space-x-2">
              <button 
                onClick={() => setShowDiseaseStatusForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                New Disease Status
              </button>
              <button 
                onClick={closeTable}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {diseaseStatus.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Country
                    </th>
                    {diseases.map(disease => (
                      <th key={disease} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {disease}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {diseaseStatus.map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.country}
                      </td>
                      {diseases.map(disease => (
                        <td key={disease} className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${getScoreColorClass(row[disease as keyof typeof row] as number)}`}>
                          {row[disease as keyof typeof row] === null || row[disease as keyof typeof row] === undefined ? 'N/A' : row[disease as keyof typeof row]}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(row.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => deleteDiseaseStatus(row.id!)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4 text-gray-500">No disease status data available</div>
          )}
        </div>
      )}

      {/* Disease Status Form */}
      {showDiseaseStatusForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Add New Disease Status</h3>
          <form onSubmit={handleSubmitDiseaseStatus} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  value={newDiseaseStatus.countryId || ''}
                  onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, countryId: parseInt(e.target.value) }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select a country...</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id}>
                      {country.name_un}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newDiseaseStatus.date || ''}
                  onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {diseases.map(disease => (
                <div key={disease}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {disease}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newDiseaseStatus[disease as keyof typeof newDiseaseStatus] || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ 
                      ...prev, 
                      [disease]: parseInt(e.target.value) 
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowDiseaseStatusForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mitigation Measures Table */}
      {showMitigationMeasuresTable && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Mitigation Measures Data</h2>
            <div className="space-x-2">
              <button 
                onClick={() => setShowMitigationMeasuresForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                New Mitigation Measure
              </button>
              <button 
                onClick={closeTable}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {mitigationMeasures.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Country
                    </th>
                    {diseases.map(disease => (
                      <th key={disease} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {disease}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mitigationMeasures.map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.country}
                      </td>
                      {diseases.map(disease => (
                        <td key={disease} className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${getScoreColorClass(row[disease as keyof typeof row] as number)}`}>
                          {row[disease as keyof typeof row] === null || row[disease as keyof typeof row] === undefined ? 'N/A' : row[disease as keyof typeof row]}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(row.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          className="text-red-600 hover:text-red-900"
                          onClick={() => {
                            // Delete functionality would be implemented here
                            alert('Delete mitigation measure functionality would be implemented here');
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4 text-gray-500">No mitigation measures data available</div>
          )}
        </div>
      )}

      {/* Mitigation Measures Form */}
      {showMitigationMeasuresForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Add New Mitigation Measure</h3>
          <form onSubmit={handleSubmitMitigationMeasure} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  value={newMitigationMeasure.countryId || ''}
                  onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, countryId: parseInt(e.target.value) }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select a country...</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id}>
                      {country.name_un}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newMitigationMeasure.date || ''}
                  onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {diseases.map(disease => (
                <div key={disease}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {disease}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newMitigationMeasure[disease as keyof typeof newMitigationMeasure] || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ 
                      ...prev, 
                      [disease]: parseInt(e.target.value) 
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowMitigationMeasuresForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RMTData;
