import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import RispNavBar from '../components/RISP/RispNavBar';
import QuarterSelection from '../components/RISP/QuarterSelection';
import { diseaseOptions, rispService, SurveillanceData } from '../services/risp/rispService';
import { useAuthStore } from '../stores/authStore';

// Helper function to get disease key from disease name
const getDiseaseKey = (diseaseName: string): string => {
  if (diseaseName.includes('FMD')) return 'fmd';
  if (diseaseName.includes('LSD')) return 'lsd';
  if (diseaseName.includes('PPR')) return 'ppr';
  if (diseaseName.includes('SPGP')) return 'sgp';
  if (diseaseName.includes('RVF')) return 'rvf';
  return diseaseName.toLowerCase().replace(/[^a-z]/g, '');
};

// Utility to get full display name from diseaseOptions
const getDiseaseDisplayName = (diseaseName: string): string => {
  const found = diseaseOptions.find(opt =>
    diseaseName && (diseaseName.toLowerCase().includes(opt.name.split(' - ')[1]?.toLowerCase() || '') ||
    opt.name.toLowerCase().includes(diseaseName.toLowerCase()))
  );
  return found ? found.name : diseaseName;
};

// Create initial state objects based on diseaseOptions
const createInitialPassiveState = () => {
  const state: Record<string, string> = {};
  diseaseOptions.forEach(disease => {
    state[getDiseaseKey(disease.name)] = '';
  });
  return state;
};

const createInitialActiveState = () => {
  const state: Record<string, any> = {};
  diseaseOptions.forEach(disease => {
    const key = getDiseaseKey(disease.name);
    state[key] = {
      none: false,
      clinical: false,
      virological: false,
      serological: false,
      syndromic: false,
      other: false,
      entomological: false // Add entomological for all, but only show for LSD and RVF
    };
  });
  return state;
};

const createInitialDetailsState = () => {
  const state: Record<string, string> = {};
  diseaseOptions.forEach(disease => {
    state[getDiseaseKey(disease.name)] = '';
  });
  return state;
};

const RISPSurveillance: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Generate years for dropdown (current year and 3 previous years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 4}, (_, i) => String(currentYear - i));
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  // Helper function to get previous quarter and year
  const getPreviousQuarterAndYear = () => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentQuarter = Math.ceil(currentMonth / 3); // 1-4
    const currentYear = new Date().getFullYear();
    
    if (currentQuarter === 1) {
      // If current quarter is Q1, previous quarter is Q4 of previous year
      return {
        quarter: 'Q4',
        year: String(currentYear - 1)
      };
    } else {
      // Otherwise, previous quarter is in the same year
      return {
        quarter: `Q${currentQuarter - 1}`,
        year: String(currentYear)
      };
    }
  };

  const previousPeriod = getPreviousQuarterAndYear();

  const [selectedYear, setSelectedYear] = useState<string>(previousPeriod.year);
  const [selectedQuarter, setSelectedQuarter] = useState<string>(previousPeriod.quarter);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Initialize surveillance data for each disease - dynamically created from diseaseOptions
  const [passiveSurveillance, setPassiveSurveillance] = useState<Record<string, string>>(createInitialPassiveState());
  const [activeSurveillance, setActiveSurveillance] = useState<Record<string, any>>(createInitialActiveState());
  const [details, setDetails] = useState<Record<string, string>>(createInitialDetailsState());

  const handlePassiveSurveillanceChange = (disease: string, value: string) => {
    setPassiveSurveillance(prev => ({
      ...prev,
      [disease]: value
    }));
  };

  // Update handleOptionChange to always allow toggling any option, and untick 'none' if any other is selected
  const handleOptionChange = (diseaseKey: string, option: string) => {
    setActiveSurveillance(prev => {
      const newDiseaseState = { ...prev[diseaseKey] };
      if (option === 'none') {
        // If selecting 'none', untick all others
        newDiseaseState['none'] = !newDiseaseState['none'];
        if (newDiseaseState['none']) {
          Object.keys(newDiseaseState).forEach(opt => {
            if (opt !== 'none') newDiseaseState[opt] = false;
          });
        }
      } else {
        // If selecting any other, untick 'none' and toggle the selected option
        newDiseaseState[option] = !newDiseaseState[option];
        newDiseaseState['none'] = false;
      }
      return { ...prev, [diseaseKey]: newDiseaseState };
    });
  };

  // Update handleNoneChange to use handleOptionChange for consistency
  const handleNoneChange = (diseaseKey: string) => {
    handleOptionChange(diseaseKey, 'none');
  };

  const handleDetailsChange = (disease: string, value: string) => {
    setDetails(prev => ({
      ...prev,
      [disease]: value
    }));
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };

  const handleQuarterChange = (quarter: string) => {
    setSelectedQuarter(quarter);
  };

  // Load previous data when year or quarter changes
  const loadPreviousData = useCallback(async () => {
    if (!user?.country) return;
    
    try {
      // Reset form first to clear any existing data
      setPassiveSurveillance(createInitialPassiveState());
      setActiveSurveillance(createInitialActiveState());
      setDetails(createInitialDetailsState());

      const existingData = await rispService.getSurveillance(
        parseInt(selectedYear),
        selectedQuarter,
        user.country
      );
      
      if (existingData && existingData.data && existingData.data.length > 0) {
        const passiveData: Record<string, string> = createInitialPassiveState();
        const activeData: Record<string, any> = createInitialActiveState();
        const detailsData: Record<string, string> = createInitialDetailsState();
        
        console.log("Loading surveillance data:", existingData.data);
        
        existingData.data.forEach((record: any) => {
          // Use database field names like the Vue version
          const diseaseFromDb = record.disease_name?.toLowerCase() || '';
          let diseaseKey = '';
          
          // Map database disease names to our keys
          if (diseaseFromDb.includes('fmd') || diseaseFromDb.includes('foot')) diseaseKey = 'fmd';
          else if (diseaseFromDb.includes('lsd') || diseaseFromDb.includes('lumpy')) diseaseKey = 'lsd';
          else if (diseaseFromDb.includes('ppr') || diseaseFromDb.includes('peste')) diseaseKey = 'ppr';
          else if (diseaseFromDb.includes('spgp') || diseaseFromDb.includes('sheep') || diseaseFromDb.includes('goat')) diseaseKey = 'sgp';
          else if (diseaseFromDb.includes('rvf') || diseaseFromDb.includes('rift')) diseaseKey = 'rvf';
          
          if (diseaseKey) {
            // Handle passive surveillance (convert 1/0 to Yes/No like Vue version)
            const passiveValue = Number(record.passive_surveillance);
            passiveData[diseaseKey] = passiveValue === 1 ? "Yes" : "No";
            
            // Handle active surveillance (parse JSON like Vue version)
            try {
              const activeOptions = JSON.parse(record.active_surveillance || '[]');
              const defaultActiveState = {
                none: false, clinical: false, virological: false, 
                serological: false, syndromic: false, other: false
              };
              activeData[diseaseKey] = { ...defaultActiveState };
              activeOptions.forEach((option: string) => {
                if (activeData[diseaseKey].hasOwnProperty(option)) {
                  activeData[diseaseKey][option] = true;
                }
              });
            } catch (error) {
              console.error('Error parsing active surveillance for', diseaseKey, error);
            }
            
            // Handle details/additional info
            detailsData[diseaseKey] = record.details || record.additional_info || '';
          }
        });
        
        setPassiveSurveillance(passiveData);
        setActiveSurveillance(activeData);
        setDetails(detailsData);
      }
    } catch (error) {
      console.error('Error loading surveillance data:', error);
    }
  }, [selectedYear, selectedQuarter, user?.country]);

  // Load data when component mounts or when year/quarter changes
  useEffect(() => {
    loadPreviousData();
  }, [loadPreviousData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    
    try {
      // Prepare surveillance data for each disease
      const surveillanceDataList: SurveillanceData[] = diseaseOptions.map(disease => {
        const diseaseKey = getDiseaseKey(disease.name);
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
        navigate('/risp/summary');
      }, 2000);
    } catch (error) {
      console.error('Error saving surveillance data:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>
        {`
          input[type="checkbox"].green-checkbox {
            accent-color: #15736d;
            color: #15736d;
          }
          input[type="checkbox"].green-checkbox:checked {
            background-color: #15736d;
            border-color: #15736d;
          }
          input[type="checkbox"].green-checkbox:focus {
            ring-color: #15736d;
            border-color: #15736d;
          }
          input[type="radio"].green-radio {
            accent-color: #15736d;
            color: #15736d;
          }
          input[type="radio"].green-radio:checked {
            background-color: #15736d;
            border-color: #15736d;
          }
        `}
      </style>
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
          selectedYear={selectedYear}
          selectedQuarter={selectedQuarter}
          onYearChange={handleYearChange}
          onQuarterChange={handleQuarterChange}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mt-8 px-7">
          <table className="w-full border border-white bg-white tracking-wider text-sm">
            <thead>
              <tr className="text-white text-sm font-medium capitalize whitespace-nowrap" style={{ backgroundColor: '#15736d' }}>
                <th className="py-2 border border-white">Disease</th>
                <th className="py-2 border border-white">Passive Surveillance</th>
                <th className="py-2 border border-white">Active Surveillance</th>
                <th className="py-2 border border-white">Details and Results</th>
              </tr>
            </thead>
            <tbody>
              {diseaseOptions.map((disease, index) => {
                const diseaseKey = getDiseaseKey(disease.name);
                const displayName = getDiseaseDisplayName(disease.name);
                const showEntomological = displayName.includes('Lumpy Skin Disease') || displayName.includes('Rift Valley Fever');
                return (
                  <tr key={disease.id} className="hover:bg-gray-50">
                    <td className="p-4" style={{ width: '170px' }}>
                      <p>{displayName}</p>
                    </td>
                    <td>
                      <div className="flex justify-center space-x-4">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            value="Yes"
                            name={`${displayName}_control`}
                            checked={passiveSurveillance[diseaseKey] === 'Yes'}
                            onChange={() => handlePassiveSurveillanceChange(diseaseKey, 'Yes')}
                            className="green-radio"
                          />
                          <span className="ml-2">Yes</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            value="No"
                            name={`${displayName}_control`}
                            checked={passiveSurveillance[diseaseKey] === 'No'}
                            onChange={() => handlePassiveSurveillanceChange(diseaseKey, 'No')}
                            className="green-radio"
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
                            checked={activeSurveillance[diseaseKey]?.none || false}
                            onChange={() => handleNoneChange(diseaseKey)}
                            className="h-4 w-4 rounded border-gray-300 green-checkbox"
                          />
                          <span className="ml-2">None</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={activeSurveillance[diseaseKey]?.clinical || false}
                            onChange={() => handleOptionChange(diseaseKey, 'clinical')}
                            className="h-4 w-4 rounded border-gray-300 green-checkbox"
                          />
                          <span className="ml-2">Clinical</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={activeSurveillance[diseaseKey]?.virological || false}
                            onChange={() => handleOptionChange(diseaseKey, 'virological')}
                            className="h-4 w-4 rounded border-gray-300 green-checkbox"
                          />
                          <span className="ml-2">Virological</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={activeSurveillance[diseaseKey]?.serological || false}
                            onChange={() => handleOptionChange(diseaseKey, 'serological')}
                            className="h-4 w-4 rounded border-gray-300 green-checkbox"
                          />
                          <span className="ml-2">Serological</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={activeSurveillance[diseaseKey]?.syndromic || false}
                            onChange={() => handleOptionChange(diseaseKey, 'syndromic')}
                            className="h-4 w-4 rounded border-gray-300 green-checkbox"
                          />
                          <span className="ml-2">Syndromic</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={activeSurveillance[diseaseKey]?.other || false}
                            onChange={() => handleOptionChange(diseaseKey, 'other')}
                            className="h-4 w-4 rounded border-gray-300 green-checkbox"
                          />
                          <span className="ml-2">Other</span>
                        </label>
                        {showEntomological && (
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={activeSurveillance[diseaseKey]?.entomological || false}
                              onChange={() => handleOptionChange(diseaseKey, 'entomological')}
                              className="h-4 w-4 rounded border-gray-300 green-checkbox"
                            />
                            <span className="ml-2">Entomological</span>
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <textarea
                        className="form-control border rounded p-2 w-full bg-gray-100 focus:outline-none"
                        style={{ borderColor: '#d1d5db' }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#15736d';
                          e.target.style.boxShadow = '0 0 0 2px rgba(21, 115, 109, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#d1d5db';
                          e.target.style.boxShadow = 'none';
                        }}
                        rows={4}
                        value={details[diseaseKey] || ''}
                        onChange={(e) => handleDetailsChange(diseaseKey, e.target.value)}
                        placeholder="eg. geographic area, species, target population..."
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center space-x-4 my-8">
          <button
            type="button"
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            onClick={() => navigate('/risp/vaccination')}
          >
            &lt;&lt; Previous
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-white rounded disabled:opacity-50"
            style={{ backgroundColor: '#15736d' }}
            onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = '#0f5b57')}
            onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = '#15736d')}
          >
            {saving ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </form>

      {saveSuccess && (
        <div 
          className="fixed top-4 right-4 px-4 py-3 rounded text-white"
          style={{ backgroundColor: '#15736d', border: '1px solid #0f5b57' }}
        >
          Surveillance data saved successfully!
        </div>
      )}
    </div>
    </>
  );
};

export default RISPSurveillance;
