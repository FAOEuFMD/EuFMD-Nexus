import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RispNavBar from '../components/RISP/RispNavBar';
import QuarterSelection from '../components/RISP/QuarterSelection';
import { diseaseOptions, rispService, SurveillanceData } from '../services/risp/rispService';
import { useAuthStore } from '../stores/authStore';

const RISPSurveillance: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Generate years for dropdown (current year and 3 previous years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 4}, (_, i) => String(currentYear - i));
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedQuarter, setSelectedQuarter] = useState<string>(`Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Initialize surveillance data for each disease
  const [passiveSurveillance, setPassiveSurveillance] = useState<Record<string, string>>({
    fmd: '',
    lsd: '',
    sgp: '',
    ppr: '',
    bef: '',
    rvf: '',
  });
  
  const [activeSurveillance, setActiveSurveillance] = useState<Record<string, any>>({
    fmd: { none: false, clinical: false, virological: false, serological: false },
    lsd: { none: false, clinical: false, virological: false, serological: false },
    sgp: { none: false, clinical: false, virological: false, serological: false },
    ppr: { none: false, clinical: false, virological: false, serological: false },
    bef: { none: false, clinical: false, virological: false, serological: false },
    rvf: { none: false, clinical: false, virological: false, serological: false },
  });
  
  const [details, setDetails] = useState<Record<string, string>>({
    fmd: '',
    lsd: '',
    sgp: '',
    ppr: '',
    bef: '',
    rvf: '',
  });

  const handlePassiveSurveillanceChange = (disease: string, value: string) => {
    setPassiveSurveillance(prev => ({
      ...prev,
      [disease.toLowerCase()]: value
    }));
  };

  const handleNoneChange = (disease: string) => {
    setActiveSurveillance(prev => {
      const current = prev[disease.toLowerCase()];
      const newValue = !current.none;
      
      return {
        ...prev,
        [disease.toLowerCase()]: {
          none: newValue,
          clinical: newValue ? false : current.clinical,
          virological: newValue ? false : current.virological,
          serological: newValue ? false : current.serological
        }
      };
    });
  };

  const handleOptionChange = (disease: string, option: string) => {
    const diseaseKey = disease.toLowerCase();
    
    setActiveSurveillance(prev => {
      const current = prev[diseaseKey];
      const newValue = {
        ...current,
        [option]: !current[option]
      };
      
      // If any option is selected, "none" should be unchecked
      if (newValue.clinical || newValue.virological || newValue.serological) {
        newValue.none = false;
      }
      
      return {
        ...prev,
        [diseaseKey]: newValue
      };
    });
  };

  const handleDetailsChange = (disease: string, value: string) => {
    setDetails(prev => ({
      ...prev,
      [disease.toLowerCase()]: value
    }));
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };

  const handleQuarterChange = (quarter: string) => {
    setSelectedQuarter(quarter);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    
    try {
      // Prepare surveillance data for each disease
      const surveillanceDataList: SurveillanceData[] = diseaseOptions.map(disease => {
        const diseaseKey = disease.name.toLowerCase();
        return {
          diseaseName: disease.name,
          country: user?.country || "",
          passiveSurveillance: passiveSurveillance[diseaseKey] || 'No',
          activeSurveillance: activeSurveillance[diseaseKey],
          details: details[diseaseKey] || '',
          year: parseInt(selectedYear),
          quarter: selectedQuarter
        };
      });
      
      // Save surveillance data for each disease
      for (const data of surveillanceDataList) {
        await rispService.saveSurveillance(data);
      }
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        navigate('/risp');
      }, 2000);
    } catch (error) {
      console.error('Error saving surveillance data:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <RispNavBar />
      
      <section>
        <h3 className="text-lg m-3 text-justify px-7">
          Has your country carried out any surveillance activities in the last quarter? If yes, please describe them for each disease.
        </h3>
      </section>

      <div className="flex gap-2.5 items-center px-7" style={{ maxWidth: '300px' }}>
        <QuarterSelection
          years={years}
          quarters={quarters}
          onYearChange={handleYearChange}
          onQuarterChange={handleQuarterChange}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mt-8 px-7">
          <table className="w-full border border-white bg-white tracking-wider text-sm">
            <thead>
              <tr className="bg-green-greenMain text-white text-sm font-medium capitalize whitespace-nowrap">
                <th className="py-2 border border-white">Disease</th>
                <th className="py-2 border border-white">Passive Surveillance</th>
                <th className="py-2 border border-white">Active Surveillance</th>
                <th className="py-2 border border-white">Details and Results</th>
              </tr>
            </thead>
            <tbody>
              {/* FMD Row */}
              <tr className="hover:bg-gray-50">
                <td className="p-4" style={{ width: '170px' }}>
                  <p>FMD</p>
                </td>
                <td>
                  <div className="flex justify-center space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Yes"
                        name="FMD_control"
                        checked={passiveSurveillance.fmd === 'Yes'}
                        onChange={() => handlePassiveSurveillanceChange('fmd', 'Yes')}
                        className="text-green-600"
                      />
                      <span className="ml-2">Yes</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="No"
                        name="FMD_control"
                        checked={passiveSurveillance.fmd === 'No'}
                        onChange={() => handlePassiveSurveillanceChange('fmd', 'No')}
                        className="text-green-greenMain"
                      />
                      <span className="ml-2">No</span>
                    </label>
                  </div>
                </td>
                <td className="p-2">
                  <div className="grid grid-cols-2 gap-2 p-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.fmd.none}
                        onChange={() => handleNoneChange('fmd')}
                        className="form-checkbox text-green-greenMain"
                      />
                      <span className="ml-2">None</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.fmd.clinical}
                        disabled={activeSurveillance.fmd.none}
                        onChange={() => handleOptionChange('fmd', 'clinical')}
                        className="form-checkbox text-green-greenMain"
                      />
                      <span className="ml-2">Clinical</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.fmd.virological}
                        disabled={activeSurveillance.fmd.none}
                        onChange={() => handleOptionChange('fmd', 'virological')}
                        className="form-checkbox text-green-greenMain"
                      />
                      <span className="ml-2">Virological</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.fmd.serological}
                        disabled={activeSurveillance.fmd.none}
                        onChange={() => handleOptionChange('fmd', 'serological')}
                        className="form-checkbox text-green-greenMain"
                      />
                      <span className="ml-2">Serological</span>
                    </label>
                  </div>
                </td>
                <td className="p-2">
                  <textarea
                    className="w-full h-24 border border-gray-300 p-2 rounded"
                    value={details.fmd}
                    onChange={(e) => handleDetailsChange('fmd', e.target.value)}
                    placeholder="Add details about surveillance activities and results"
                  ></textarea>
                </td>
              </tr>

              {/* LSD Row */}
              <tr className="hover:bg-gray-50">
                <td className="p-4" style={{ width: '170px' }}>
                  <p>LSD</p>
                </td>
                <td>
                  <div className="flex justify-center space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Yes"
                        name="LSD_control"
                        checked={passiveSurveillance.lsd === 'Yes'}
                        onChange={() => handlePassiveSurveillanceChange('lsd', 'Yes')}
                        className="text-green-600"
                      />
                      <span className="ml-2">Yes</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="No"
                        name="LSD_control"
                        checked={passiveSurveillance.lsd === 'No'}
                        onChange={() => handlePassiveSurveillanceChange('lsd', 'No')}
                        className="text-green-600"
                      />
                      <span className="ml-2">No</span>
                    </label>
                  </div>
                </td>
                <td className="p-2">
                  <div className="grid grid-cols-2 gap-2 p-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.lsd.none}
                        onChange={() => handleNoneChange('lsd')}
                        className="form-checkbox text-green-600"
                      />
                      <span className="ml-2">None</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.lsd.clinical}
                        disabled={activeSurveillance.lsd.none}
                        onChange={() => handleOptionChange('lsd', 'clinical')}
                        className="form-checkbox text-green-600"
                      />
                      <span className="ml-2">Clinical</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.lsd.virological}
                        disabled={activeSurveillance.lsd.none}
                        onChange={() => handleOptionChange('lsd', 'virological')}
                        className="form-checkbox text-green-600"
                      />
                      <span className="ml-2">Virological</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={activeSurveillance.lsd.serological}
                        disabled={activeSurveillance.lsd.none}
                        onChange={() => handleOptionChange('lsd', 'serological')}
                        className="form-checkbox text-green-600"
                      />
                      <span className="ml-2">Serological</span>
                    </label>
                  </div>
                </td>
                <td className="p-2">
                  <textarea
                    className="w-full h-24 border border-gray-300 p-2 rounded"
                    value={details.lsd}
                    onChange={(e) => handleDetailsChange('lsd', e.target.value)}
                    placeholder="Add details about surveillance activities and results"
                  ></textarea>
                </td>
              </tr>

              {/* Add more rows for other diseases following the same pattern */}
              {/* SGP, PPR, BEF, RVF */}

            </tbody>
          </table>
        </div>

        <div className="flex justify-center mt-6 mb-10">
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded mr-4"
            onClick={() => navigate('/risp/vaccination')}
          >
            Back
          </button>
          <button
            type="submit"
            className={`px-4 py-2 bg-green-greenMain hover:bg-green-greenMain2 text-white rounded ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {saveSuccess && (
          <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <p>Surveillance information saved successfully!</p>
          </div>
        )}
      </form>
    </div>
  );
};

export default RISPSurveillance;
