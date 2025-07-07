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
  country_id: number;
  country_name?: string;
  FMD: number;
  PPR: number;
  LSD: number;
  RVF: number;
  SPGP: number;
  date: string;
}

interface MitigationMeasureEntry {
  id?: number;
  country_id: number;
  country_name?: string;
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
  const [tableTitle, setTableTitle] = useState('');
  
  // Form states for Disease Status
  const [newDiseaseStatus, setNewDiseaseStatus] = useState<Partial<DiseaseStatusEntry>>({
    country_id: 0,
    FMD: 0,
    PPR: 0,
    LSD: 0,
    RVF: 0,
    SPGP: 0,
    date: new Date().toISOString().split('T')[0]
  });
  
  // Form states for Mitigation Measures
  const [newMitigationMeasure, setNewMitigationMeasure] = useState<Partial<MitigationMeasureEntry>>({
    country_id: 0,
    FMD: 0,
    PPR: 0,
    LSD: 0,
    RVF: 0,
    SPGP: 0,
    date: new Date().toISOString().split('T')[0]
  });

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
      const response = await fetch('/api/rmt/disease-status-rmt');
      const data = await response.json();
      setDiseaseStatus(data);
      setShowDiseaseStatusTable(true);
      setShowMitigationMeasuresTable(false);
      setTableTitle('Disease Status');
    } catch (err: any) {
      setError(err.message || 'Failed to load disease status data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMitigationMeasures = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rmt/mitigation-measures-rmt');
      const data = await response.json();
      setMitigationMeasures(data);
      setShowMitigationMeasuresTable(true);
      setShowDiseaseStatusTable(false);
      setTableTitle('Mitigation Measures');
    } catch (err: any) {
      setError(err.message || 'Failed to load mitigation measures data');
    } finally {
      setLoading(false);
    }
  };

  const closeTable = () => {
    setDiseaseStatus([]);
    setMitigationMeasures([]);
    setShowDiseaseStatusTable(false);
    setShowMitigationMeasuresTable(false);
    setShowDiseaseStatusForm(false);
    setShowMitigationMeasuresForm(false);
    setTableTitle('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const newDiseaseStatusForm = () => {
    setShowDiseaseStatusForm(true);
  };

  const newMitigationMeasuresForm = () => {
    setShowMitigationMeasuresForm(true);
  };

  const handleSubmitDiseaseStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiseaseStatus.country_id) {
      alert('Please select a country');
      return;
    }

    const data = {
      country_id: newDiseaseStatus.country_id,
      date: newDiseaseStatus.date,
      FMD: newDiseaseStatus.FMD,
      PPR: newDiseaseStatus.PPR,
      LSD: newDiseaseStatus.LSD,
      RVF: newDiseaseStatus.RVF,
      SPGP: newDiseaseStatus.SPGP,
    };

    try {
      const response = await fetch('/api/rmt/disease-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        setShowDiseaseStatusForm(false);
        fetchDiseaseStatus(); // Refresh the table
      } else {
        alert('Error submitting disease status');
      }
    } catch (error) {
      console.error("Error submitting disease status:", error);
      alert('Error submitting disease status');
    }
  };

  const handleSubmitMitigationMeasure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMitigationMeasure.country_id) {
      alert('Please select a country');
      return;
    }

    const data = {
      country_id: newMitigationMeasure.country_id,
      date: newMitigationMeasure.date,
      FMD: newMitigationMeasure.FMD,
      PPR: newMitigationMeasure.PPR,
      LSD: newMitigationMeasure.LSD,
      RVF: newMitigationMeasure.RVF,
      SPGP: newMitigationMeasure.SPGP,
    };

    try {
      const response = await fetch('/api/rmt/mitigation-measures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        setShowMitigationMeasuresForm(false);
        fetchMitigationMeasures(); // Refresh the table
      } else {
        alert('Error submitting mitigation measures');
      }
    } catch (error) {
      console.error("Error submitting mitigation measures:", error);
      alert('Error submitting mitigation measures');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl">Loading RMT data...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="min-h-32">
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

        {/* Main action buttons - matching Vue layout exactly */}
        <button 
          onClick={fetchDiseaseStatus}
          className="nav-btn w-1/3 mb-2"
        >
          Add Disease Status
        </button>

        <button
          onClick={fetchMitigationMeasures}
          className="nav-btn w-1/3 mb-2"
        >
          Add Mitigation Measures
        </button>
      </div>
      
      {/* Disease Status Section */}
      <div className="flex flex-col justify-center w-full max-w-5xl mx-auto mb-8">
        {tableTitle && showDiseaseStatusTable && (
          <h2 className="text-xl font-bold mb-2 text-center">{tableTitle}</h2>
        )}
        
        {showDiseaseStatusTable && (
          <div className="flex justify-center mt-4">
            <button 
              onClick={newDiseaseStatusForm}
              className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300"
            >
              New Disease Status
            </button>
            <button 
              onClick={closeTable}
              className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2"
            >
              Close
            </button>         
          </div>
        )}

        {/* Disease Status Form */}
        {showDiseaseStatusForm && (
          <div className="flex justify-center mt-4">
            <form onSubmit={handleSubmitDiseaseStatus} className="w-full max-w-lg mb-8">
              <div className="flex flex-wrap -mx-3 mb-6">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-country">
                    Country
                  </label>
                  <select 
                    value={newDiseaseStatus.country_id || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, country_id: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-country"
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
                <div className="w-full md:w-1/2 px-3">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-date">
                    Date
                  </label>
                  <input 
                    value={newDiseaseStatus.date || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, date: e.target.value }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-date" 
                    type="date"
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-fmd">
                    FMD
                  </label>
                  <input 
                    value={newDiseaseStatus.FMD || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, FMD: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-fmd" 
                    type="number"
                    required
                  />
                </div>
                <div className="w-full md:w-1/2 px-3">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-ppr">
                    PPR
                  </label>
                  <input 
                    value={newDiseaseStatus.PPR || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, PPR: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-ppr" 
                    type="number"
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-lsd">
                    LSD
                  </label>
                  <input 
                    value={newDiseaseStatus.LSD || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, LSD: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-lsd" 
                    type="number"
                    required
                  />
                </div>
                <div className="w-full md:w-1/2 px-3">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-rvf">
                    RVF
                  </label>
                  <input 
                    value={newDiseaseStatus.RVF || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, RVF: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-rvf" 
                    type="number"
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-spgp">
                    SPGP
                  </label>
                  <input 
                    value={newDiseaseStatus.SPGP || ''}
                    onChange={(e) => setNewDiseaseStatus(prev => ({ ...prev, SPGP: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-spgp" 
                    type="number"
                    required
                  />
                </div>
              </div>
              
              <div className="flex justify-center mt-4">
                <button 
                  className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                  type="submit"
                >
                  Submit
                </button>
                <button 
                  className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                  type="button"
                  onClick={() => setShowDiseaseStatusForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Disease Status Table */}
        {diseaseStatus.length > 0 && showDiseaseStatusTable && (
          <table className="w-full border bg-white text-center">
            <thead>
              <tr className="bg-greens text-white text-sm sticky top-0 z-20 font-medium uppercase tracking-wider whitespace-nowrap">
                <th className="px-5 py-1 text-left">Country</th>
                <th className="p-1">FMD</th>
                <th className="p-1">PPR</th>
                <th className="p-1">LSD</th>
                <th className="p-1">RVF</th>
                <th className="p-1">SPGP</th>
                <th className="p-1">DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {diseaseStatus.map((status) => (
                <tr key={status.id}>
                  <td className="px-5 py-1 text-left cursor-pointer">
                    {status.country_name}
                  </td>
                  <td className="px-5 py-3">
                    {status.FMD}
                  </td>
                  <td className="px-5 py-3">
                    {status.PPR}
                  </td>
                  <td className="px-5 py-3">
                    {status.LSD}
                  </td>
                  <td className="px-5 py-3">
                    {status.RVF}
                  </td>
                  <td className="px-5 py-3">
                    {status.SPGP}
                  </td>
                  <td className="px-5 py-3">
                    {formatDate(status.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mitigation Measures Section */}
      <div className="flex flex-col justify-center w-full max-w-5xl mx-auto mb-8">
        {tableTitle && showMitigationMeasuresTable && (
          <h2 className="text-xl font-bold mb-2">{tableTitle}</h2>
        )}
        
        {showMitigationMeasuresTable && (
          <div className="flex justify-center mt-4">
            <button 
              onClick={newMitigationMeasuresForm}
              className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300"
            >
              New Mitigation Measures
            </button>
            <button 
              onClick={closeTable}
              className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2"
            >
              Close
            </button>         
          </div>
        )}

        {/* Mitigation Measures Form */}
        {showMitigationMeasuresForm && (
          <div className="flex justify-center mt-4">
            <form onSubmit={handleSubmitMitigationMeasure} className="w-full max-w-lg mb-8">
              <div className="flex flex-wrap -mx-3 mb-6">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-country-mm">
                    Country
                  </label>
                  <select 
                    value={newMitigationMeasure.country_id || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, country_id: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-country-mm"
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
                <div className="w-full md:w-1/2 px-3">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-date-mm">
                    Date
                  </label>
                  <input 
                    value={newMitigationMeasure.date || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, date: e.target.value }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-date-mm" 
                    type="date"
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-fmd-mm">
                    FMD
                  </label>
                  <input 
                    value={newMitigationMeasure.FMD || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, FMD: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-fmd-mm" 
                    type="number"
                    required
                  />
                </div>
                <div className="w-full md:w-1/2 px-3">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-ppr-mm">
                    PPR
                  </label>
                  <input 
                    value={newMitigationMeasure.PPR || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, PPR: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-ppr-mm" 
                    type="number"
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-lsd-mm">
                    LSD
                  </label>
                  <input 
                    value={newMitigationMeasure.LSD || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, LSD: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-lsd-mm" 
                    type="number"
                    required
                  />
                </div>
                <div className="w-full md:w-1/2 px-3">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-rvf-mm">
                    RVF
                  </label>
                  <input 
                    value={newMitigationMeasure.RVF || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, RVF: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-rvf-mm" 
                    type="number"
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap -mx-3 mb-2">
                <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
                  <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-spgp-mm">
                    SPGP
                  </label>
                  <input 
                    value={newMitigationMeasure.SPGP || ''}
                    onChange={(e) => setNewMitigationMeasure(prev => ({ ...prev, SPGP: parseInt(e.target.value) }))}
                    className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" 
                    id="grid-spgp-mm" 
                    type="number"
                    required
                  />
                </div>
              </div>
              
              <div className="flex justify-center mt-4">
                <button 
                  className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                  type="submit"
                >
                  Submit
                </button>
                <button 
                  className="nav-btn text-white border-2 border-green-600 px-4 py-2 rounded my-2 shadow-none hover:shadow-md hover:shadow-black/30 transition-all duration-300 ml-2" 
                  type="button"
                  onClick={() => setShowMitigationMeasuresForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mitigation Measures Table */}
        {mitigationMeasures.length > 0 && showMitigationMeasuresTable && (
          <table className="w-full border bg-white text-center">
            <thead>
              <tr className="bg-greens text-white text-sm sticky top-0 z-20 font-medium uppercase tracking-wider whitespace-nowrap">
                <th className="px-5 py-1 text-left">Country</th>
                <th className="p-1">FMD</th>
                <th className="p-1">PPR</th>
                <th className="p-1">LSD</th>
                <th className="p-1">RVF</th>
                <th className="p-1">SPGP</th>
                <th className="p-1">DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mitigationMeasures.map((measure) => (
                <tr key={measure.id}>
                  <td className="px-5 py-1 text-left cursor-pointer">
                    {measure.country_name}
                  </td>
                  <td className="px-5 py-3">
                    {measure.FMD}
                  </td>
                  <td className="px-5 py-3">
                    {measure.PPR}
                  </td>
                  <td className="px-5 py-3">
                    {measure.LSD}
                  </td>
                  <td className="px-5 py-3">
                    {measure.RVF}
                  </td>
                  <td className="px-5 py-3">
                    {measure.SPGP}
                  </td>
                  <td className="px-5 py-3">
                    {formatDate(measure.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>   
    </div>
  );
};

export default RMTData;
