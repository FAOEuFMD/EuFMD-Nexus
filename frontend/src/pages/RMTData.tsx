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
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountryName, setSelectedCountryName] = useState<string>('');
  const [countryDiseaseStatus, setCountryDiseaseStatus] = useState<any[]>([]);
  const [showTable, setShowTable] = useState(false);
  
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

  const handleCountrySelection = async (value: string) => {
    setSelectedCountryName(value);
    if (value) {
      const country = countries.find(c => c.name_un === value);
      if (country) {
        setLoading(true);
        try {
          // Use the same API call as RMT
          const diseaseResponse = await apiService.rmt.getDiseaseStatusByCountry(country.id);
          
          if (diseaseResponse.data?.scores && diseaseResponse.data.scores.length > 0) {
            const latestScore = diseaseResponse.data.scores[0];
            setCountryDiseaseStatus([{
              id: country.id,
              countryName: country.name_un,
              FMD: latestScore.FMD ?? null,
              PPR: latestScore.PPR ?? null,
              LSD: latestScore.LSD ?? null,
              RVF: latestScore.RVF ?? null,
              SPGP: latestScore.SPGP ?? null
            }]);
          } else {
            // No data found, show empty row
            setCountryDiseaseStatus([{
              id: country.id,
              countryName: country.name_un,
              FMD: null,
              PPR: null,
              LSD: null,
              RVF: null,
              SPGP: null
            }]);
          }
          
          setShowTable(true);
        } catch (err: any) {
          setError(err.message || 'Failed to load country data');
        } finally {
          setLoading(false);
        }
      }
    } else {
      setShowTable(false);
      setCountryDiseaseStatus([]);
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
          className="bg-[#15736d] hover:bg-[#438f8a] text-white px-6 py-3 rounded-md transition-colors duration-300 mr-4"
          disabled={loading}
        >
          Update Disease Status
        </button>

        <button
          className="bg-[#15736d] hover:bg-[#438f8a] text-white px-6 py-3 rounded-md transition-colors duration-300"
          disabled={loading}
        >
          Update Mitigation Measures
        </button>
      </div>

      {/* Country Selector */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Country to update:
        </div>
        <select
          value={selectedCountryName}
          onChange={(e) => handleCountrySelection(e.target.value)}
          className="block w-full mt-1 p-2 border focus:border-[#15736d] rounded bg-white mb-4"
        >
          <option value="">Select a country...</option>
          {countries.map(country => (
            <option key={country.id} value={country.name_un}>
              {country.name_un}
            </option>
          ))}
        </select>
      </div>

      {/* Country Disease Status Table */}
      {showTable && countryDiseaseStatus.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Disease Status</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white border">
              <thead>
                <tr className="bg-[#15736d] text-white">
                  <th className="border border-gray-300 px-4 py-2 text-left">Country</th>
                  {diseases.map(disease => (
                    <th key={disease} className="border border-gray-300 px-4 py-2 text-center">
                      {disease}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {countryDiseaseStatus.map((row) => (
                  <tr key={row.id}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RMTDataNew;