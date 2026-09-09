import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RispNavBar from '../components/RISP/RispNavBar';
import RispEntryIntro from '../components/RISP/RispEntryIntro';
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
// Import countryToRegion mapping from RISPLanding
import { countryToRegion } from './RISPLanding';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useRispProgram } from '../hooks/useRispProgram';
import { useSoiDistricts } from '../hooks/useSoiDistricts';
import SoiDistrictPicker from '../components/RISP/SoiDistrictPicker';
import type { SoiDistrict } from '../hooks/useSoiDistricts';

/** RISP may report the same disease at a few locations without using Excel. */
const MAX_RISP_LINES_PER_DISEASE = 3;

const RISPOutbreak: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isSoi } = useRispProgram();
  const { districts: soiDistricts, loading: soiDistrictsLoading, error: soiDistrictsError } =
    useSoiDistricts(isSoi);

  // Compute user's region and region countries
  const userRegion = useMemo(() => {
    if (!user?.country) return null;
    return countryToRegion[user.country] || null;
  }, [user?.country]);

  const userRegionCountries = useMemo(() => {
    if (!userRegion) return [];
    return Object.keys(countryToRegion).filter(
      (country) => countryToRegion[country] === userRegion
    );
  }, [userRegion]);
  
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
  const popoverHideTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [bulkReloadKey, setBulkReloadKey] = useState(0);

  // Table headers with tooltips
  const tableHeaders = [
    { label: "Disease", tooltip: false },
    { label: "Number of Outbreaks", tooltip: true },
    { label: "Species", tooltip: true },
    { label: "Status", tooltip: true },
    { label: "Serotype", tooltip: true },
    { label: "Control Measures", tooltip: true },
    { label: "Location", tooltip: true },
    { label: "Date suspected", tooltip: true },
    { label: "Date confirmed", tooltip: true },
    { label: "Latitude", tooltip: true },
    { label: "Longitude", tooltip: true },
    { label: "Additional Information", tooltip: true },
  ];

  const tableData = [
    { description: "Specify the disease that was identified in the current outbreak." },
    { description: "An outbreak means the occurrence of one or more cases in an epidemiological unit." },
    { description: "Specify the species affected by the outbreak." },
    { description: "Level of confirmation (laboratory, clinical, or suspected)." },
    { description: "For FMD outbreaks, specify the serotype if known." },
    { description: "Measures taken to control the outbreak." },
    { description: "One location per line: National, border area, or a specific district/region." },
    { description: "Date the outbreak was first suspected (optional for simple RISP lines; useful for SOI)." },
    { description: "Date the outbreak was confirmed (optional for simple RISP lines; useful for SOI)." },
    { description: "Latitude of the outbreak location (preferred over epi-unit name)." },
    { description: "Longitude of the outbreak location (preferred over epi-unit name)." },
    { description: "Any additional information about the outbreak." },
  ];

  const emptyOutbreakFields = () => ({
    recordId: null as number | null,
    numberOutbreaks: "" as string | number,
    selectedSpecies: [] as string[],
    selectedStatus: [] as string[],
    selectedSerotype: [] as string[],
    selectedControlMeasures: [] as string[],
    selectedLocation: [] as string[],
    districtId: null as number | null,
    provinceId: null as number | null,
    borderingCountry: "",
    dateSuspected: "",
    dateConfirmed: "",
    latitude: "" as string | number,
    longitude: "" as string | number,
    outbreaksAdditionalInfo: "",
  });

  const makeDiseaseLine = (
    disease: (typeof diseaseOptions)[number],
    lineIndex: number,
    outbreakOverrides: Partial<ReturnType<typeof emptyOutbreakFields>> = {}
  ) => ({
    id: disease.id,
    lineKey: `${disease.id}-${lineIndex}-${Math.random().toString(36).slice(2, 8)}`,
    name: disease.name,
    isSpeciesModalOpen: false,
    isSelectedModalOpen: false,
    isSerotypeModalOpen: false,
    isControlMeasuresModalOpen: false,
    isLocationModalOpen: false,
    outbreakData: {
      diseaseId: disease.id,
      diseaseName: disease.name,
      country: user?.country || "",
      ...emptyOutbreakFields(),
      ...outbreakOverrides,
      year: parseInt(selectedYear, 10),
      quarter: selectedQuarter,
    },
  });

  // Create state for each disease with modals and data
  const [diseases, setDiseases] = useState(() =>
    diseaseOptions.map((disease, i) => makeDiseaseLine(disease, i))
  );

  const showPopover = (index: number) => {
    if (popoverHideTimeout.current) {
      clearTimeout(popoverHideTimeout.current);
      popoverHideTimeout.current = null;
    }
    setPopoverIndex(index);
    setPopoverVisible(true);
  };

  const hidePopover = () => {
    if (popoverHideTimeout.current) {
      clearTimeout(popoverHideTimeout.current);
    }
    popoverHideTimeout.current = setTimeout(() => {
      setPopoverVisible(false);
    }, 150); // 150ms delay to allow mouse to move into popover
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

        const response = await rispService.getOutbreaks(
          parseInt(selectedYear, 10),
          selectedQuarter,
          user?.country || ''
        );

        const parseJsonArray = (value: unknown): string[] => {
          if (Array.isArray(value)) return value as string[];
          if (typeof value === 'string') {
            try {
              return JSON.parse(value || '[]');
            } catch {
              return [];
            }
          }
          return [];
        };

        const recordToOverrides = (record: any) => {
          const locsRaw = record.locations;
          let locs: string[] = [];
          if (Array.isArray(locsRaw)) locs = locsRaw;
          else if (typeof locsRaw === 'string') {
            try {
              locs = JSON.parse(locsRaw || '[]');
            } catch {
              locs = [];
            }
          }
          if (record.location) locs = [record.location];
          locs = (locs || []).slice(0, 1);

          return {
            recordId: record.id ?? null,
            numberOutbreaks: Number(record.number_outbreaks) || 0,
            selectedLocation: locs,
            borderingCountry: record.bordering_country || '',
            selectedStatus: parseJsonArray(record.status),
            selectedSerotype: parseJsonArray(record.serotype),
            selectedSpecies: parseJsonArray(record.species),
            selectedControlMeasures: parseJsonArray(record.control_measures),
            dateSuspected: record.date_suspected
              ? String(record.date_suspected).slice(0, 10)
              : '',
            dateConfirmed: record.date_confirmed
              ? String(record.date_confirmed).slice(0, 10)
              : '',
            latitude: record.latitude ?? '',
            longitude: record.longitude ?? '',
            districtId: record.district_id ?? null,
            provinceId: record.province_id ?? null,
            outbreaksAdditionalInfo: record.additional_info || '',
          };
        };

        const records = Array.isArray(response.data) ? response.data : [];
        const activeRecords = records.filter((record: any) => {
          const n = Number(record.number_outbreaks) || 0;
          return n > 0 || record.location || record.district_id;
        });

        if (isSoi) {
          // SOI: one grid row per disease (first matching record)
          const lines = diseaseOptions.map((disease, i) => {
            const key = disease.name.split(' - ')[0].trim();
            const record = activeRecords.find(
              (r: any) => (r.disease_name || '').trim() === key
            );
            return makeDiseaseLine(disease, i, record ? recordToOverrides(record) : {});
          });
          setDiseases(lines);
          return;
        }

        // RISP: one or more lines per disease (max 3), preserve all locations
        const byDisease = new Map<string, any[]>();
        for (const record of activeRecords) {
          const key = (record.disease_name || '').trim();
          if (!key) continue;
          const list = byDisease.get(key) || [];
          if (list.length < MAX_RISP_LINES_PER_DISEASE) {
            list.push(record);
            byDisease.set(key, list);
          }
        }

        const lines: ReturnType<typeof makeDiseaseLine>[] = [];
        diseaseOptions.forEach((disease) => {
          const key = disease.name.split(' - ')[0].trim();
          const recs = byDisease.get(key) || [];
          if (recs.length === 0) {
            lines.push(makeDiseaseLine(disease, 0));
          } else {
            recs.forEach((record, lineIdx) => {
              lines.push(makeDiseaseLine(disease, lineIdx, recordToOverrides(record)));
            });
          }
        });
        setDiseases(lines);
      } catch (error) {
        console.error('Error loading outbreak data:', error);
      }
    };

    if (user?.country) {
      console.log(
        'useEffect triggered - Loading previous data for year/quarter:',
        selectedYear,
        selectedQuarter,
        'country:',
        user?.country
      );
      loadPreviousData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on period / country / bulk upload
  }, [selectedYear, selectedQuarter, user?.country, bulkReloadKey, isSoi]);

  const countLinesForDisease = (diseaseName: string) =>
    diseases.filter((d) => d.name === diseaseName).length;

  const addLocationLine = (index: number) => {
    if (isSoi) return;
    const source = diseases[index];
    if (!source) return;
    if (countLinesForDisease(source.name) >= MAX_RISP_LINES_PER_DISEASE) {
      alert(`You can add at most ${MAX_RISP_LINES_PER_DISEASE} locations for the same disease.`);
      return;
    }
    const opt = diseaseOptions.find((d) => d.id === source.id);
    if (!opt) return;

    const newLine = makeDiseaseLine(opt, countLinesForDisease(source.name), {
      numberOutbreaks: source.outbreakData.numberOutbreaks || 1,
      selectedSpecies: [...(source.outbreakData.selectedSpecies || [])],
      selectedStatus: [...(source.outbreakData.selectedStatus || [])],
      selectedSerotype: [...(source.outbreakData.selectedSerotype || [])],
      selectedControlMeasures: [...(source.outbreakData.selectedControlMeasures || [])],
      // Leave location empty so the user picks a different one
      selectedLocation: [],
      borderingCountry: '',
      recordId: null,
    });

    setDiseases((prev) => {
      const next = [...prev];
      // Insert after the last line of this disease
      let insertAt = index;
      while (insertAt + 1 < next.length && next[insertAt + 1].name === source.name) {
        insertAt += 1;
      }
      next.splice(insertAt + 1, 0, newLine);
      return next;
    });
  };

  const removeLocationLine = (index: number) => {
    if (isSoi) return;
    const target = diseases[index];
    if (!target) return;
    if (countLinesForDisease(target.name) <= 1) return;
    setDiseases((prev) => prev.filter((_, i) => i !== index));
  };
  // Generic field update function similar to vaccination page
  const handleFieldUpdate = (index: number, field: string, value: any) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      const disease = newDiseases[index];
      
      if (disease) {
        if (field === 'selectedLocation') {
          disease.outbreakData = {
            ...disease.outbreakData,
            selectedLocation: Array.isArray(value) ? value.slice(-1) : []
          };
          disease.isLocationModalOpen = false;
        } else {
          disease.outbreakData = {
            ...disease.outbreakData,
            [field]: value
          };
          if (field === 'selectedSpecies') {
            disease.isSpeciesModalOpen = false;
          } else if (field === 'selectedStatus') {
            disease.isSelectedModalOpen = false;
          } else if (field === 'selectedSerotype') {
            disease.isSerotypeModalOpen = false;
          } else if (field === 'selectedControlMeasures') {
            disease.isControlMeasuresModalOpen = false;
          }
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


  // Helper for bordering country change (now supports multiple)
  const handleBorderingCountryChange = (index: number, countries: string[]) => {
    setDiseases(prevDiseases => {
      const newDiseases = [...prevDiseases];
      const disease = newDiseases[index];
      if (disease) {
        disease.outbreakData.borderingCountry = countries.join(', ');
      }
      return newDiseases;
    });
  };

  // Custom handler for location changes that includes bordering country formatting
  // Helper function to convert formatted locations back to raw selections
  const getRawLocations = (formattedLocations?: string[] | null): string[] => {
    return (formattedLocations || []).map(location => {
      if (location.startsWith('Within 50km from the border:')) {
        return 'Within 50km from the border';
      }
      return location;
    });
  };


  // Helper function to format locations for display (now supports multiple bordering countries)
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
        disease.outbreakData.selectedLocation = selectedLocations.slice(-1);
        
        // Close modal
        disease.isLocationModalOpen = false;
      }
      
      return newDiseases;
    });
  };

  const handleSoiDistrictSelect = (index: number, district: SoiDistrict) => {
    setDiseases((prevDiseases) => {
      const newDiseases = [...prevDiseases];
      const disease = newDiseases[index];
      if (disease) {
        disease.outbreakData = {
          ...disease.outbreakData,
          selectedLocation: [district.district_name],
          districtId: district.district_id,
          provinceId: district.province_id,
        };
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
    const diseasesToSubmit = diseases.map(disease => {
      const latRaw = disease.outbreakData.latitude;
      const lonRaw = disease.outbreakData.longitude;
      const latitude =
        latRaw === '' || latRaw === null || latRaw === undefined
          ? null
          : Number(latRaw);
      const longitude =
        lonRaw === '' || lonRaw === null || lonRaw === undefined
          ? null
          : Number(lonRaw);
      const locList = (disease.outbreakData.selectedLocation || []).slice(0, 1);
      const displayLoc =
        !isSoi && locList.length
          ? formatLocationsForDisplay(locList, disease.outbreakData.borderingCountry || '')
          : locList;
      return {
        id: disease.outbreakData.recordId ?? undefined,
        disease: disease.outbreakData.diseaseName.split(' - ')[0].trim(),
        number_outbreaks: parseInt(String(disease.outbreakData.numberOutbreaks)) || 0,
        locations: displayLoc,
        location: displayLoc[0] || null,
        bordering_country: disease.outbreakData.borderingCountry || "",
        status: disease.outbreakData.selectedStatus || [],
        serotype: disease.outbreakData.selectedSerotype || [],
        species: disease.outbreakData.selectedSpecies || [],
        control_measures: disease.outbreakData.selectedControlMeasures || [],
        comments: disease.outbreakData.outbreaksAdditionalInfo || "",
        date_suspected: disease.outbreakData.dateSuspected || null,
        date_confirmed: disease.outbreakData.dateConfirmed || null,
        latitude: Number.isFinite(latitude as number) ? latitude : null,
        longitude: Number.isFinite(longitude as number) ? longitude : null,
        district_id: disease.outbreakData.districtId ?? null,
        province_id: disease.outbreakData.provinceId ?? null,
      };
    });

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
    const errors = diseasesToSubmit.reduce((acc: string[], diseaseData, idx) => {
      // Only validate if there are outbreaks
      if (diseaseData.number_outbreaks > 0) {
        const missing = [];
        if (!diseaseData.locations.length) missing.push(isSoi ? 'District' : 'Location');
        if (!diseaseData.species.length) missing.push('Species');
        if (!diseaseData.status.length) missing.push('Status');
        if (isFMD(diseaseData.disease) && !diseaseData.serotype.length) missing.push('Serotype');
        if (!diseaseData.control_measures.length) missing.push('Control Measures');

        if (missing.length > 0) {
          const locHint = diseaseData.location ? ` @ ${diseaseData.location}` : ` (line ${idx + 1})`;
          acc.push(`${diseaseData.disease}${locHint}: Missing ${missing.join(', ')}`);
        }
      }
      return acc;
    }, []);

    // RISP: two lines of the same disease must not share the same location
    if (!isSoi) {
      const seen = new Map<string, string>();
      for (const row of diseasesToSubmit) {
        if (row.number_outbreaks <= 0 || !row.location) continue;
        const key = `${row.disease}::${row.location}`;
        if (seen.has(key)) {
          errors.push(
            `${row.disease}: location "${row.location}" is used on more than one line — pick different locations or remove a line.`
          );
        } else {
          seen.set(key, row.location);
        }
      }
    }
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

      <RispEntryIntro
        bulkCategory="outbreaks"
        templateYear={selectedYear}
        templateQuarter={selectedQuarter}
        onUploadSuccess={() => {
          if (user?.country) {
            setBulkReloadKey((k) => k + 1);
          }
        }}
        pageHint="In this section, report FAST disease outbreaks for the selected quarter. An outbreak is one or more cases in an epidemiological unit (see WOAH glossary). Use one location per line. For RISP you can add up to 3 location lines for the same disease; for many more rows use Excel bulk upload."
      />

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
                      colSpan={12}
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
                            <div
                              className="absolute z-10 inline-block w-64 text-sm text-black transition-opacity duration-300 bg-white border border-gray-200 rounded-lg shadow-sm"
                              onMouseEnter={() => {
                                if (popoverHideTimeout.current) {
                                  clearTimeout(popoverHideTimeout.current);
                                  popoverHideTimeout.current = null;
                                }
                              }}
                              onMouseLeave={hidePopover}
                            >
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
                  {diseases.map((disease, index) => {
                    const linesForDisease = countLinesForDisease(disease.name);
                    const isExtraLine =
                      !isSoi &&
                      diseases.findIndex((d) => d.name === disease.name) !== index;
                    return (
                    <tr key={disease.lineKey}>
                      <td className="p-4" style={{ width: '170px' }}>
                        <p className="font-medium">{disease.name}</p>
                        {isExtraLine && (
                          <p className="text-xs text-gray-500 mt-0.5">Additional location</p>
                        )}
                        {!isSoi && !isNoOutbreaks(disease.outbreakData) && (
                          <div className="mt-2 flex flex-col gap-1">
                            {!isExtraLine && linesForDisease < MAX_RISP_LINES_PER_DISEASE && (
                              <button
                                type="button"
                                className="text-xs text-green-700 hover:underline text-left"
                                onClick={() => addLocationLine(index)}
                              >
                                + Add location
                              </button>
                            )}
                            {linesForDisease > 1 && (
                              <button
                                type="button"
                                className="text-xs text-red-600 hover:underline text-left"
                                onClick={() => removeLocationLine(index)}
                              >
                                Remove line
                              </button>
                            )}
                          </div>
                        )}
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
                                ? (isSoi
                                    ? disease.outbreakData.selectedLocation.join(', ')
                                    : formatLocationsForDisplay(disease.outbreakData.selectedLocation, disease.outbreakData.borderingCountry).join(", "))
                                : (isSoi ? "Select district" : "Select Location")}
                            </button>
                          </div>
                        )}
                        {isSoi ? (
                          <SoiDistrictPicker
                            isOpen={disease.isLocationModalOpen}
                            districts={soiDistricts}
                            loading={soiDistrictsLoading}
                            error={soiDistrictsError}
                            selectedDistrictId={disease.outbreakData.districtId}
                            onClose={() => {
                              const newDiseases = [...diseases];
                              newDiseases[index].isLocationModalOpen = false;
                              setDiseases(newDiseases);
                            }}
                            onSelect={(district) => handleSoiDistrictSelect(index, district)}
                          />
                        ) : (
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
                          // Pass region countries for bordering country dropdown
                          borderingCountryOptions={userRegionCountries}
                          onBorderingCountryChange={(countries) => handleBorderingCountryChange(index, countries)}
                          singleSelect
                        />
                        )}
                      </td>

                      {/* DATE SUSPECTED */}
                      <td className="p-4" style={{ width: '150px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <input type="date" disabled className="w-full p-2 border border-gray-300 rounded bg-gray-200" />
                        ) : (
                          <input
                            type="date"
                            className="w-full p-2 border border-gray-300 rounded"
                            value={disease.outbreakData.dateSuspected || ''}
                            onChange={(e) => handleFieldUpdate(index, 'dateSuspected', e.target.value)}
                          />
                        )}
                      </td>

                      {/* DATE CONFIRMED */}
                      <td className="p-4" style={{ width: '150px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <input type="date" disabled className="w-full p-2 border border-gray-300 rounded bg-gray-200" />
                        ) : (
                          <input
                            type="date"
                            className="w-full p-2 border border-gray-300 rounded"
                            value={disease.outbreakData.dateConfirmed || ''}
                            onChange={(e) => handleFieldUpdate(index, 'dateConfirmed', e.target.value)}
                          />
                        )}
                      </td>

                      {/* LATITUDE */}
                      <td className="p-4" style={{ width: '120px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <input type="number" disabled className="w-full p-2 border border-gray-300 rounded bg-gray-200" placeholder="—" />
                        ) : (
                          <input
                            type="number"
                            step="any"
                            className="w-full p-2 border border-gray-300 rounded"
                            placeholder="Lat"
                            value={disease.outbreakData.latitude}
                            onChange={(e) =>
                              handleFieldUpdate(
                                index,
                                'latitude',
                                e.target.value === '' ? '' : e.target.value
                              )
                            }
                          />
                        )}
                      </td>

                      {/* LONGITUDE */}
                      <td className="p-4" style={{ width: '120px' }}>
                        {isNoOutbreaks(disease.outbreakData) ? (
                          <input type="number" disabled className="w-full p-2 border border-gray-300 rounded bg-gray-200" placeholder="—" />
                        ) : (
                          <input
                            type="number"
                            step="any"
                            className="w-full p-2 border border-gray-300 rounded"
                            placeholder="Long"
                            value={disease.outbreakData.longitude}
                            onChange={(e) =>
                              handleFieldUpdate(
                                index,
                                'longitude',
                                e.target.value === '' ? '' : e.target.value
                              )
                            }
                          />
                        )}
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center space-x-4">
              <button 
                type="button" 
                onClick={handleSubmit} 
                className="nav-btn px-8 py-3"
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
