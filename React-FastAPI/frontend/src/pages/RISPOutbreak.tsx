import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RispNavBar from '../components/RISP/RispNavBar';
import QuarterSelection from '../components/RISP/QuarterSelection';
import NumberInput from '../components/RISP/NumberInput';
import MultipleSelectOptions from '../components/RISP/MultipleSelectOptions';
import { 
  diseaseOptions, 
  speciesOptions, 
  statusOptions, 
  fmdSerotypes, 
  controlMeasures,
  rispService 
} from '../services/risp/rispService';
import { useAuthStore } from '../stores/authStore';

const RISPOutbreak: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Generate years for dropdown (current year and 3 previous years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 4}, (_, i) => String(currentYear - i));
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedQuarter, setSelectedQuarter] = useState<string>(`Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [popoverVisible, setPopoverVisible] = useState<boolean>(false);
  const [popoverIndex, setPopoverIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Table headers with tooltips
  const tableHeaders = [
    { label: "Disease", tooltip: false },
    { label: "Number of Outbreaks", tooltip: true },
    { label: "Species", tooltip: true },
    { label: "Status", tooltip: true },
    { label: "Serotype", tooltip: true },
    { label: "Control Measures", tooltip: true },
    { label: "Comments", tooltip: true },
  ];

  const tableData = [
    { description: "Disease name" },
    { description: "Number of outbreaks reported in the quarter" },
    { description: "Animal species affected by the disease" },
    { description: "Status of the outbreak (confirmed, suspected, resolved)" },
    { description: "FMD serotype if applicable (O, A, Asia1, etc.)" },
    { description: "Control measures applied in response to the outbreak" },
    { description: "Additional comments about the outbreak" },
  ];

  // Create state for each disease with modals and data
  const [diseases, setDiseases] = useState(
    diseaseOptions.map(disease => ({
      ...disease,
      isSpeciesModalOpen: false,
      isSelectedModalOpen: false,
      isSerotypeModalOpen: false,
      isControlMeasuresModalOpen: false,
      outbreakData: {
        diseaseId: disease.id,
        diseaseName: disease.name,
        country: user?.country || "",
        numberOutbreaks: "" as string | number,
        selectedSpecies: [] as string[],
        selectedStatus: [] as string[],
        selectedSerotype: [] as string[],
        selectedControlMeasures: [] as string[],
        comments: "",
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
    return diseaseName === 'FMD';
  };

  const filteredSpecies = (diseaseName: string) => {
    // You can customize this to filter species by disease if needed
    return speciesOptions;
  };

  const handleSpeciesSelection = (index: number, selected: string[]) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      newDiseases[index] = {
        ...newDiseases[index],
        outbreakData: {
          ...newDiseases[index].outbreakData,
          selectedSpecies: selected
        },
        isSpeciesModalOpen: false
      };
      return newDiseases;
    });
  };

  const handleStatusSelection = (index: number, selected: string[]) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      newDiseases[index] = {
        ...newDiseases[index],
        outbreakData: {
          ...newDiseases[index].outbreakData,
          selectedStatus: selected
        },
        isSelectedModalOpen: false
      };
      return newDiseases;
    });
  };

  const handleSerotypeSelection = (index: number, selected: string[]) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      newDiseases[index] = {
        ...newDiseases[index],
        outbreakData: {
          ...newDiseases[index].outbreakData,
          selectedSerotype: selected
        },
        isSerotypeModalOpen: false
      };
      return newDiseases;
    });
  };

  const handleControlMeasuresSelection = (index: number, selected: string[]) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      newDiseases[index] = {
        ...newDiseases[index],
        outbreakData: {
          ...newDiseases[index].outbreakData,
          selectedControlMeasures: selected
        },
        isControlMeasuresModalOpen: false
      };
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

  const handleCommentsChange = (index: number, value: string) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      newDiseases[index] = {
        ...newDiseases[index],
        outbreakData: {
          ...newDiseases[index].outbreakData,
          comments: value
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
    
    // Filter only diseases with outbreaks
    const outbreaksToSave = diseases
      .filter(disease => disease.outbreakData.numberOutbreaks && parseInt(String(disease.outbreakData.numberOutbreaks)) > 0)
      .map(disease => disease.outbreakData);
    
    try {
      // Save each outbreak
      for (const outbreak of outbreaksToSave) {
        await rispService.saveOutbreak(outbreak);
      }
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        navigate('/risp/vaccination');
      }, 2000);
    } catch (error) {
      console.error('Error saving outbreaks:', error);
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
                        <MultipleSelectOptions 
                          isOpen={disease.isSpeciesModalOpen}
                          multipleOptions={filteredSpecies(disease.name)}
                          selectedOptions={disease.outbreakData.selectedSpecies}
                          onClose={() => {
                            const newDiseases = [...diseases];
                            newDiseases[index].isSpeciesModalOpen = false;
                            setDiseases(newDiseases);
                          }}
                          onChange={(selected) => handleSpeciesSelection(index, selected)}
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
                          onChange={(selected) => handleStatusSelection(index, selected)}
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
                              placeholder="No serotype"
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
                          onChange={(selected) => handleSerotypeSelection(index, selected)}
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
                          onChange={(selected) => handleControlMeasuresSelection(index, selected)}
                        />
                      </td>

                      {/* COMMENTS */}
                      <td className="p-4" style={{ width: '170px' }}>
                        <textarea
                          className={`border border-gray-300 rounded p-2 w-full ${isNoOutbreaks(disease.outbreakData) ? 'bg-gray-200' : ''}`}
                          value={disease.outbreakData.comments}
                          onChange={(e) => handleCommentsChange(index, e.target.value)}
                          disabled={isNoOutbreaks(disease.outbreakData)}
                          placeholder={isNoOutbreaks(disease.outbreakData) ? "No outbreaks" : "Add comments"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center mt-6 mb-10">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded mr-4"
                onClick={() => navigate('/risp')}
              >
                Back
              </button>
              <button
                type="submit"
                className={`px-4 py-2 bg-green-greenMain hover:bg-green-greenMain2 text-white rounded ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save and Proceed to Vaccination'}
              </button>
            </div>

            {saveSuccess && (
              <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>Outbreak information saved successfully!</p>
              </div>
            )}
          </div>
        </section>
      </form>
    </div>
  );
};

export default RISPOutbreak;
