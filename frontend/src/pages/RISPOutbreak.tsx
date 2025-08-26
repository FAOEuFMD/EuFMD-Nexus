import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RispNavBar from '../components/RISP/RispNavBar';
import QuarterSelection from '../components/RISP/QuarterSelection';
import NumberInput from '../components/RISP/NumberInput';
import MultipleSelectOptions from '../components/RISP/MultipleSelectOptions';
import HierarchicalSpeciesSelector from '../components/RISP/HierarchicalSpeciesSelector';
import { 
  diseaseOptions, 
  statusOptions, 
  fmdSerotypes, 
  controlMeasures,
  locationOptions,
  rispService 
} from '../services/risp/rispService';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const RISPOutbreak: React.FC = () => {
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
  const [popoverVisible, setPopoverVisible] = useState<boolean>(false);
  const [popoverIndex, setPopoverIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // Table headers with tooltips
  const tableHeaders = [
    { label: "Disease", tooltip: false },
    { label: "Number of Outbreaks", tooltip: true },
    { label: "Species", tooltip: true },
    { label: "Status", tooltip: true },
    { label: "Serotype", tooltip: true },
    { label: "Control Measures", tooltip: true },
    { label: "Location", tooltip: true },
    { label: "Additional Information", tooltip: true },
  ];

  const tableData = [
    { description: "Specify the disease that was identified in the current outbreak." },
    { description: "An outbreak means the occurrence of one or more cases in an epidemiological unit." },
    { description: "Specify the species affected by the outbreak." },
    { description: "Refers to the level of confirmation for the disease." },
    { description: "For FMD outbreaks, specify the serotype if known." },
    { description: "Measures taken to control the outbreak." },
    { description: "Location where the outbreak occurred." },
    { description: "Any additional information about the outbreak." },
  ];

  // Create state for each disease with modals and data
  const [diseases, setDiseases] = useState(
    diseaseOptions.map(disease => ({
      ...disease,
      isSpeciesModalOpen: false,
      isSelectedModalOpen: false,
      isSerotypeModalOpen: false,
      isControlMeasuresModalOpen: false,
      isLocationModalOpen: false,
      outbreakData: {
        diseaseId: disease.id,
        diseaseName: disease.name,
        country: user?.country || "",
        numberOutbreaks: "" as string | number,
        selectedSpecies: [] as string[],
        selectedStatus: [] as string[],
        selectedSerotype: [] as string[],
        selectedControlMeasures: [] as string[],
        selectedLocation: [] as string[],
        borderingCountry: "",
        outbreaksAdditionalInfo: "",
        year: parseInt(selectedYear),
        quarter: selectedQuarter
      }
    }))
  );

  const showPopover = (index: number) => {
    setPopoverIndex(index);
    setPopoverVisible(true);
  };

  const hidePopover = () => {
    setPopoverVisible(false);
  };

  const isNoOutbreaks = (data: any) => {
    return !data.numberOutbreaks || parseInt(data.numberOutbreaks) === 0;
  };

  const isFMD = (diseaseName: string) => {
    return diseaseName.includes('FMD');
  };


  // Load data only when component mounts or year/quarter actually changes
  useEffect(() => {
    const loadPreviousData = async () => {
      try {
        console.log('loadPreviousData: Starting to load data for', selectedYear, selectedQuarter);
        
        // Reset form first
        setDiseases(prevDiseases => 
          prevDiseases.map(disease => ({
            ...disease,
            outbreakData: {
              diseaseId: disease.outbreakData.diseaseId,
              diseaseName: disease.name,
              country: user?.country || "",
              numberOutbreaks: 0,
              selectedLocation: [],
              borderingCountry: "",
              selectedStatus: [],
              selectedSerotype: [],
              selectedSpecies: [],
              selectedControlMeasures: [],
              outbreaksAdditionalInfo: "",
              year: parseInt(selectedYear),
              quarter: selectedQuarter
            }
          }))
        );

        const response = await rispService.getOutbreaks(parseInt(selectedYear), selectedQuarter, user?.country || "");
        
        if (response.data && response.data.length > 0) {
          console.log("Loading outbreak data:", response.data);

          response.data.forEach((record: any) => {
            setDiseases(prevDiseases => {
              const newDiseases = [...prevDiseases];
              const disease = newDiseases.find(d => 
                d.name.split(' - ')[0].trim() === record.disease_name.trim()
              );
              
              if (disease) {
                try {
                  disease.outbreakData = {
                    diseaseId: disease.outbreakData.diseaseId,
                    diseaseName: disease.name,
                    country: user?.country || "",
                    numberOutbreaks: Number(record.number_outbreaks) || 0,
                    selectedLocation: JSON.parse(record.locations || '[]'),
                    borderingCountry: record.bordering_country || "",
                    selectedStatus: JSON.parse(record.status || '[]'),
                    selectedSerotype: JSON.parse(record.serotype || '[]'),
                    selectedSpecies: JSON.parse(record.species || '[]'),
                    selectedControlMeasures: JSON.parse(record.control_measures || '[]'),
                    outbreaksAdditionalInfo: record.additional_info || "",
                    year: parseInt(selectedYear),
                    quarter: selectedQuarter
                  };
                  console.log('Loaded data for', disease.name, ':', disease.outbreakData);
                } catch (e) {
                  console.error("Error parsing JSON for disease:", disease.name, e);
                }
              }
              return newDiseases;
            });
          });
        } else {
          console.log("No outbreak data found for this period");
        }
      } catch (error) {
        console.error("Error loading outbreak data:", error);
      }
    };

    if (user?.country) {
      console.log('useEffect triggered - Loading previous data for year/quarter:', selectedYear, selectedQuarter, 'country:', user?.country);
      loadPreviousData();
    }
  }, [selectedYear, selectedQuarter, user?.country]); // Removed loadPreviousData dependency

  // Generic field update function similar to vaccination page
  const handleFieldUpdate = (index: number, field: string, value: any) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      const disease = newDiseases[index];
      
      if (disease) {
        // Update the specific field in outbreakData
        disease.outbreakData = {
          ...disease.outbreakData,
          [field]: value
        };
        
        // Close modal for selection fields
        if (field === 'selectedSpecies') {
          disease.isSpeciesModalOpen = false;
        } else if (field === 'selectedStatus') {
          disease.isSelectedModalOpen = false;
        } else if (field === 'selectedSerotype') {
          disease.isSerotypeModalOpen = false;
        } else if (field === 'selectedControlMeasures') {
          disease.isControlMeasuresModalOpen = false;
        } else if (field === 'selectedLocation') {
          disease.isLocationModalOpen = false;
        }
        
        console.log(`Updated ${field} for ${disease.name}:`, value);
      }
      
      return newDiseases;
    });
  };

  const handleNumberChange = (index: number, value: number | string) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      newDiseases[index] = {
        ...newDiseases[index],
        outbreakData: {
          ...newDiseases[index].outbreakData,
          numberOutbreaks: value
        }
      };
      return newDiseases;
    });
  };

  // Helper function to handle bordering country input
  const handleBorderingCountryChange = (index: number, country: string) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      const disease = newDiseases[index];
      
      if (disease) {
        disease.outbreakData.borderingCountry = country;
      }
      
      return newDiseases;
    });
  };

  // Custom handler for location changes that includes bordering country formatting
  // Helper function to convert formatted locations back to raw selections
  const getRawLocations = (formattedLocations: string[]): string[] => {
    return formattedLocations.map(location => {
      if (location.startsWith('Within 50km from the border:')) {
        return 'Within 50km from the border';
      }
      return location;
    });
  };

  // Helper function to format locations for display
  const formatLocationsForDisplay = (rawLocations: string[], borderingCountry: string): string[] => {
    return rawLocations.map(location => {
      if (location === 'Within 50km from the border' && borderingCountry && borderingCountry.trim()) {
        return `Within 50km from the border: ${borderingCountry.trim()}`;
      }
      return location;
    });
  };

  const handleLocationChange = (index: number, selectedLocations: string[]) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      const disease = newDiseases[index];
      
      if (disease) {
        // Store the raw selections
        disease.outbreakData.selectedLocation = selectedLocations;
        
        // Close modal
        disease.isLocationModalOpen = false;
      }
      
      return newDiseases;
    });
  };

  const handleCommentsChange = (index: number, value: string) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      newDiseases[index] = {
        ...newDiseases[index],
        outbreakData: {
          ...newDiseases[index].outbreakData,
          outbreaksAdditionalInfo: value
        }
      };
      return newDiseases;
    });
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    // Update year in all disease outbreak data
    setDiseases(prevDiseases => {
      return prevDiseases.map(disease => ({
        ...disease,
        outbreakData: {
          ...disease.outbreakData,
          year: parseInt(year)
        }
      }));
    });
  };

  const handleQuarterChange = (quarter: string) => {
    setSelectedQuarter(quarter);
    // Update quarter in all disease outbreak data
    setDiseases(prevDiseases => {
      return prevDiseases.map(disease => ({
        ...disease,
        outbreakData: {
          ...disease.outbreakData,
          quarter: quarter
        }
      }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    
    // Submit all diseases, including those with zero outbreaks (like Vue does)
    const diseasesToSubmit = diseases.map(disease => ({
      disease: disease.outbreakData.diseaseName.split(' - ')[0].trim(),
      number_outbreaks: parseInt(String(disease.outbreakData.numberOutbreaks)) || 0,
      locations: disease.outbreakData.selectedLocation || [],
      bordering_country: disease.outbreakData.borderingCountry || "",
      status: disease.outbreakData.selectedStatus || [],
      serotype: disease.outbreakData.selectedSerotype || [],
      species: disease.outbreakData.selectedSpecies || [],
      control_measures: disease.outbreakData.selectedControlMeasures || [],
      comments: disease.outbreakData.outbreaksAdditionalInfo || ""  // Change from additional_info to comments and ensure it's a string
    }));

    console.log('Outbreak data details:');
    diseases.forEach((disease, index) => {
      console.log(`Disease ${index} (${disease.name}):`, {
        numberOutbreaks: disease.outbreakData.numberOutbreaks,
        selectedSpecies: disease.outbreakData.selectedSpecies,
        selectedStatus: disease.outbreakData.selectedStatus,
        selectedLocation: disease.outbreakData.selectedLocation,
        borderingCountry: disease.outbreakData.borderingCountry,
        selectedControlMeasures: disease.outbreakData.selectedControlMeasures,
        selectedSerotype: disease.outbreakData.selectedSerotype
      });
    });
    console.log('Data being submitted:', diseasesToSubmit);

    // Validation - check for diseases with outbreaks > 0
    const errors = diseasesToSubmit.reduce((acc: string[], diseaseData) => {
      // Only validate if there are outbreaks
      if (diseaseData.number_outbreaks > 0) {
        const missing = [];
        if (!diseaseData.locations.length) missing.push('Location');
        if (!diseaseData.species.length) missing.push('Species');
        if (!diseaseData.status.length) missing.push('Status');
        if (isFMD(diseaseData.disease) && !diseaseData.serotype.length) missing.push('Serotype');
        if (!diseaseData.control_measures.length) missing.push('Control Measures');

        if (missing.length > 0) {
          acc.push(`${diseaseData.disease}: Missing ${missing.join(', ')}`);
        }
      }
      return acc;
    }, []);

    if (errors.length > 0) {
      alert('Please fill in all required fields before proceeding:\n\n' + errors.join('\n'));
      setSaving(false);
      return;
    }
    
    try {
      const formData = {
        type: "outbreaks",
        userId: user?.id,
        country: user?.country,
        year: parseInt(selectedYear),
        quarter: selectedQuarter,
        diseases: diseasesToSubmit
      };

      console.log('Submitting data:', JSON.stringify(formData, null, 2));
      const response = await apiService.risp.addRISP(formData);

      console.log('Save successful:', response);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Hide success message after 3 seconds
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving outbreaks:', error);
      alert(`Failed to save outbreak data: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <RispNavBar />
      
      <section>
        <h3 className="text-lg m-3 text-justify px-7">
          In this section, please report the occurrence of FAST diseases in your
          country during the previous quarter. An outbreak is defined as the
          occurrence of one or more cases in an epidemiological unit (link:
          <a
            href="https://www.woah.org/fileadmin/Home/eng/Health_standards/tahc/2018/en_glossaire.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 mx-1"
          >
            WOAH
          </a>
          ). You can report outbreaks at national (mandatory) and sub-national
          level (optional).
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
        <div>
          <p className="text-lg font-semibold text-left m-3 px-7">
            Please specify if there is an outbreak to report for the following
            diseases:
          </p>
        </div>

        <section className="flex justify-content">
          <div className="flex flex-col no-wrap">
            <div className="small-form-wrapper" style={{ width: 'calc(100% + 155px)' }}>
              <table className="w-full m-0 p-0 border bg-white tracking-wide text-sm">
                <thead>
                  <tr className="bg-green-greenMain text-white text-sm">
                    <th
                      colSpan={8}
                      className="py-2 px-4 border relative rounded-tl-lg rounded-tr-lg"
                    >
                      Outbreak information
                    </th>
                  </tr>
                  <tr className="bg-green-greenMain text-white text-sm">
                    {tableHeaders.map((header, index) => (
                      <th
                        key={header.label}
                        className="py-2 px-4 border relative"
                        style={{ width: '170px', margin: 0, padding: 0 }}
                      >
                        <div className="flex justify-around items-center m-0 p-0">
                          <span>{header.label}</span>
                          {header.tooltip && (
                            <button
                              onMouseOver={() => showPopover(index)}
                              onMouseLeave={hidePopover}
                              type="button"
                              className="ml-2"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                height="24px"
                                viewBox="0 -960 960 960"
                                width="20px"
                                fill="#FFFFFF"
                              >
                                <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
                              </svg>
                              <span className="sr-only">Show information</span>
                            </button>
                          )}
                          {popoverVisible && popoverIndex === index && (
                            <div className="absolute z-10 inline-block w-64 text-sm text-black transition-opacity duration-300 bg-white border border-gray-200 rounded-lg shadow-sm">
                              <div className="p-3 space-y-2">
                                <p className="text-neutral font-neutral">
                                  {tableData[index].description}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="border border-gray-300 m-0 p-0">
                  {diseases.map((disease, index) => (
                    <tr key={disease.id}>
                      <td className="p-4" style={{ width: '170px' }}>
                        <p>{disease.name}</p>
                      </td>
                      <td className="p-4" style={{ width: '170px' }}>
                        <NumberInput
                          value={disease.outbreakData.numberOutbreaks}
                          onChange={(value) => handleNumberChange(index, value)}
                        />
                      </td>
                      
                      {/* SPECIES */}
                      <td className="p-4" style={{ width: '170px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <div className="border border-gray-300 rounded">
                            <button 
                              className="w-full p-2 text-left bg-gray-200"
                              disabled
                            >
                              No outbreaks 
                            </button>
                          </div>
                        ) : (
                          <div className="border border-gray-300 rounded">
                            <button 
                              onClick={() => {
                                const newDiseases = [...diseases];
                                newDiseases[index].isSpeciesModalOpen = true;
                                setDiseases(newDiseases);
                              }}
                              type="button"
                              className="w-full p-2 text-left"
                            >
                              {disease.outbreakData.selectedSpecies?.length 
                                ? disease.outbreakData.selectedSpecies.join(", ") 
                                : "Select Species"}
                            </button>
                          </div>
                        )}
                        <HierarchicalSpeciesSelector 
                          isOpen={disease.isSpeciesModalOpen}
                          selectedOptions={disease.outbreakData.selectedSpecies}
                          disease={disease.name}
                          onClose={() => {
                            setDiseases(prev => prev.map((d, i) => 
                              i === index ? { ...d, isSpeciesModalOpen: false } : d
                            ));
                          }}
                          onChange={(selected) => handleFieldUpdate(index, 'selectedSpecies', selected)}
                        />
                      </td>

                      {/* STATUS */}
                      <td className="p-4" style={{ width: '170px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <div className="border border-gray-300 rounded">
                            <button 
                              className="w-full p-2 text-left bg-gray-200"
                              disabled
                            >
                              No outbreaks 
                            </button>
                          </div>
                        ) : (
                          <div className="border border-gray-300 rounded">
                            <button 
                              onClick={() => {
                                const newDiseases = [...diseases];
                                newDiseases[index].isSelectedModalOpen = true;
                                setDiseases(newDiseases);
                              }}
                              type="button"
                              className="w-full p-2 text-left"
                            >
                              {disease.outbreakData.selectedStatus?.length 
                                ? disease.outbreakData.selectedStatus.join(", ") 
                                : "Select Status"}
                            </button>
                          </div>
                        )}
                        <MultipleSelectOptions 
                          isOpen={disease.isSelectedModalOpen}
                          multipleOptions={statusOptions}
                          selectedOptions={disease.outbreakData.selectedStatus}
                          onClose={() => {
                            const newDiseases = [...diseases];
                            newDiseases[index].isSelectedModalOpen = false;
                            setDiseases(newDiseases);
                          }}
                          onChange={(selected) => handleFieldUpdate(index, 'selectedStatus', selected)}
                          country={user?.country}
                        />
                      </td>

                      {/* SEROTYPE */}
                      <td className="p-4" style={{ width: '170px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <div className="border border-gray-300 rounded">
                            <button 
                              className="w-full p-2 text-left bg-gray-200"
                              disabled
                            >
                              No outbreaks
                            </button>
                          </div>
                        ) : !isFMD(disease.name) ? (
                          <div className="border border-gray-300 rounded">
                            <input 
                              className="w-full p-2 text-left" 
                              disabled 
                              placeholder="N/A"
                            />
                          </div>
                        ) : (
                          <div className="border border-gray-300 rounded">
                            <button 
                              onClick={() => {
                                const newDiseases = [...diseases];
                                newDiseases[index].isSerotypeModalOpen = true;
                                setDiseases(newDiseases);
                              }}
                              type="button"
                              className="w-full p-2 text-left"
                            >
                              {disease.outbreakData.selectedSerotype?.length 
                                ? disease.outbreakData.selectedSerotype.join(", ") 
                                : "Select Serotype"}
                            </button>
                          </div>
                        )}
                        <MultipleSelectOptions 
                          isOpen={disease.isSerotypeModalOpen}
                          multipleOptions={fmdSerotypes}
                          selectedOptions={disease.outbreakData.selectedSerotype}
                          onClose={() => {
                            const newDiseases = [...diseases];
                            newDiseases[index].isSerotypeModalOpen = false;
                            setDiseases(newDiseases);
                          }}
                          onChange={(selected) => handleFieldUpdate(index, 'selectedSerotype', selected)}
                          country={user?.country}
                        />
                      </td>

                      {/* CONTROL MEASURES */}
                      <td className="p-4" style={{ width: '170px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <div className="border border-gray-300 rounded">
                            <button 
                              className="w-full p-2 text-left bg-gray-200"
                              disabled
                            >
                              No outbreaks 
                            </button>
                          </div>
                        ) : (
                          <div className="border border-gray-300 rounded">
                            <button 
                              onClick={() => {
                                const newDiseases = [...diseases];
                                newDiseases[index].isControlMeasuresModalOpen = true;
                                setDiseases(newDiseases);
                              }}
                              type="button"
                              className="w-full p-2 text-left"
                            >
                              {disease.outbreakData.selectedControlMeasures?.length 
                                ? disease.outbreakData.selectedControlMeasures.join(", ") 
                                : "Select Measure"}
                            </button>
                          </div>
                        )}
                        <MultipleSelectOptions 
                          isOpen={disease.isControlMeasuresModalOpen}
                          multipleOptions={controlMeasures}
                          selectedOptions={disease.outbreakData.selectedControlMeasures}
                          onClose={() => {
                            const newDiseases = [...diseases];
                            newDiseases[index].isControlMeasuresModalOpen = false;
                            setDiseases(newDiseases);
                          }}
                          onChange={(selected) => handleFieldUpdate(index, 'selectedControlMeasures', selected)}
                          country={user?.country}
                        />
                      </td>

                      {/* LOCATION */}
                      <td className="p-4" style={{ width: '170px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <div className="border border-gray-300 rounded">
                            <button 
                              className="w-full p-2 text-left bg-gray-200"
                              disabled
                            >
                              No outbreaks
                            </button>
                          </div>
                        ) : (
                          <div className="border border-gray-300 rounded">
                            <button 
                              onClick={() => {
                                const newDiseases = [...diseases];
                                newDiseases[index].isLocationModalOpen = true;
                                setDiseases(newDiseases);
                              }}
                              type="button"
                              className="w-full p-2 text-left"
                            >
                              {disease.outbreakData.selectedLocation?.length 
                                ? formatLocationsForDisplay(disease.outbreakData.selectedLocation, disease.outbreakData.borderingCountry).join(", ") 
                                : "Select Location"}
                            </button>
                          </div>
                        )}
                        <MultipleSelectOptions 
                          isOpen={disease.isLocationModalOpen}
                          multipleOptions={locationOptions}
                          selectedOptions={getRawLocations(disease.outbreakData.selectedLocation)}
                          onClose={() => {
                            const newDiseases = [...diseases];
                            newDiseases[index].isLocationModalOpen = false;
                            setDiseases(newDiseases);
                          }}
                          onChange={(selected) => handleLocationChange(index, selected)}
                          country={user?.country}
                          borderingCountry={disease.outbreakData.borderingCountry}
                          onBorderingCountryChange={(country) => handleBorderingCountryChange(index, country)}
                        />
                      </td>

                      {/* ADDITIONAL INFORMATION */}
                      <td className="p-4" style={{ width: '170px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <div className="border border-gray-300 rounded">
                            <textarea disabled className="bg-gray-200" placeholder="No outbreaks"></textarea>
                          </div>
                        ) : (
                          <div className="border border-gray-300 rounded">
                            <textarea 
                              value={disease.outbreakData.outbreaksAdditionalInfo} 
                              onChange={(e) => handleCommentsChange(index, e.target.value)}
                              placeholder="Add comment"
                              className="comment-textarea"
                              rows={4}
                            ></textarea>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center space-x-4">
              <button 
                type="button" 
                onClick={handleSubmit} 
                className="w-1/4 nav-btn my-10"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save & Proceed to Vaccination'}
              </button>
            </div>
            
            {saveSuccess && (
              <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>Outbreak information saved successfully!</p>
              </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
                  <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                      <svg
                        className="h-6 w-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Data Saved Successfully!
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Outbreak information has been submitted correctly.
                    </p>
                    <button
                      onClick={() => {
                        setShowSuccessModal(false);
                        navigate('/risp/vaccination');
                      }}
                      className="w-full text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                      style={{
                        backgroundColor: '#15736d',
                        borderColor: 'rgb(1 80 57 / 1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgb(1 80 57 / 1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#15736d';
                      }}
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </form>
    </div>
  );
};

export default RISPOutbreak;
