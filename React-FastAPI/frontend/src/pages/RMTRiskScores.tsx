import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Country {
  id: number;
  iso3: string;
  name_un: string;
  subregion?: string;
}

interface DiseaseStatusRow {
  id: number;
  countryName: string;
  FMD: number | null;
  PPR: number | null;
  LSD: number | null;
  RVF: number | null;
  SPGP: number | null;
}

interface MitigationMeasureRow {
  id: number;
  countryName: string;
  FMD: number | null;
  PPR: number | null;
  LSD: number | null;
  RVF: number | null;
  SPGP: number | null;
}

interface PathwayRow {
  pathway: string;
  FMD: number;
  PPR: number;
  LSD: number;
  RVF: number;
  SPGP: number;
}

interface ConnectionRow {
  id: number;
  countryName: string;
  liveAnimalContact: number | null;
  legalImport: number | null;
  proximity: number | null;
  illegalImport: number | null;
  connection: number | null;
  livestockDensity: number | null;
}

const RMTRiskScores: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Country selection state
  const [countries, setCountries] = useState<Country[]>([]);
  const [receiverCountry, setReceiverCountry] = useState<Country | null>(null);
  const [sourceCountries, setSourceCountries] = useState<Country[]>([]);
  const [selectedSourceCountry, setSelectedSourceCountry] = useState<string>('');
  const [selectedCountries, setSelectedCountries] = useState<Set<number>>(new Set());
  
  // Carousel/step state
  const [currentStep, setCurrentStep] = useState(0);
  const stepTitles = ['Disease Status', 'Mitigation Measures', 'Pathways', 'Connections'];
  
  // Form data state
  const [diseaseStatus, setDiseaseStatus] = useState<DiseaseStatusRow[]>([]);
  const [mitigationMeasures, setMitigationMeasures] = useState<MitigationMeasureRow[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  
  // Date information
  const [diseaseStatusDate, setDiseaseStatusDate] = useState<string | null>(null);
  const [mitigationMeasuresDate, setMitigationMeasuresDate] = useState<string | null>(null);

  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];
  const connectionFields = ['liveAnimalContact', 'legalImport', 'proximity', 'illegalImport', 'connection', 'livestockDensity'];

  // Vue-style colors for disease status scores - matching exact Vue app colors
  const getScoreColor = (score: number | null): string => {
    if (score === null || score === undefined) return 'score-na';
    switch (score) {
      case 0: return 'score-ok'; // Disease free
      case 1: return 'score-warning1'; // Silent/suspected circulation
      case 2: return 'score-warning2'; // Low level circulation
      case 3: return 'score-warning4'; // High level circulation
      default: return 'score-na';
    }
  };

  // Mitigation measures color function (scale 0-4, inverted from disease status)
  const getMitigationColor = (score: number | null): string => {
    if (score === null || score === undefined) return 'score-na';
    switch (score) {
      case 0: return 'score-warning4'; // Uncontrolled risk
      case 1: return 'score-warning3'; // Insufficient measures
      case 2: return 'score-warning2'; // Some risks remain
      case 3: return 'score-warning1'; // Most risks mitigated
      case 4: return 'score-ok'; // All risks mitigated
      default: return 'score-na';
    }
  };

  // Pathway effectiveness color function (scale 0-3, blue theme matching Vue app)
  const getPathwayColor = (score: number | null): string => {
    if (score === null || score === undefined) return 'score-na';
    switch (score) {
      case 0: return 'pathway-zero'; // Not important
      case 1: return 'pathway-one'; // Possible
      case 2: return 'pathway-two'; // Effective
      case 3: return 'pathway-three'; // Very effective
      default: return 'score-na';
    }
  };

  // Connection color function (scale 0-3, neutral/gray theme)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getConnectionColor = (score: number | null): string => {
    if (score === null || score === undefined) return 'score-na';
    switch (score) {
      case 0: return 'connection-none'; // No connection
      case 1: return 'connection-low'; // Low connection
      case 2: return 'connection-medium'; // Medium connection
      case 3: return 'connection-high'; // High connection
      default: return 'score-na';
    }
  };
  
  // Format date to a human-readable format
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Predefined pathways scores from Vue app
  const pathwaysData: PathwayRow[] = [
    { pathway: "Airborne", FMD: 2, PPR: 0, LSD: 1, RVF: 0, SPGP: 1 },
    { pathway: "Vector-borne", FMD: 0, PPR: 0, LSD: 3, RVF: 3, SPGP: 2 },
    { pathway: "Wild Animals", FMD: 1, PPR: 2, LSD: 0, RVF: 2, SPGP: 0 },
    { pathway: "Animal Product", FMD: 2, PPR: 1, LSD: 1, RVF: 1, SPGP: 1 },
    { pathway: "Live Animal", FMD: 3, PPR: 3, LSD: 1, RVF: 3, SPGP: 3 },
    { pathway: "Fomite", FMD: 2, PPR: 1, LSD: 1, RVF: 0, SPGP: 1 },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Fetch countries and dates in parallel
      const [
        countriesResponse, 
        diseaseStatusDateResponse, 
        mitigationMeasuresDateResponse
      ] = await Promise.all([
        apiService.countries.getAll(),
        apiService.rmt.getDiseaseStatusDate(),
        apiService.rmt.getMitigationMeasuresDate()
      ]);
      
      console.log('Countries API response:', countriesResponse);
      console.log('Available countries:', countriesResponse.data);
      
      // Set the latest date for disease status and mitigation measures
      if (diseaseStatusDateResponse.data && diseaseStatusDateResponse.data.length > 0) {
        const latestDate = diseaseStatusDateResponse.data[0].lastUpdate;
        console.log('Latest disease status date:', latestDate);
        setDiseaseStatusDate(latestDate);
      }
      
      if (mitigationMeasuresDateResponse.data && mitigationMeasuresDateResponse.data.length > 0) {
        const latestDate = mitigationMeasuresDateResponse.data[0].lastUpdate;
        console.log('Latest mitigation measures date:', latestDate);
        setMitigationMeasuresDate(latestDate);
      }
      
      // Log some country IDs for debugging
      if (countriesResponse.data && Array.isArray(countriesResponse.data)) {
        console.log('Sample country IDs:', countriesResponse.data.slice(0, 10).map((c: any) => ({ id: c.id, name: c.name_un })));
        console.log('Total countries loaded:', countriesResponse.data.length);
      }
      
      setCountries(countriesResponse.data);
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiverCountryChange = (countryName: string) => {
    const country = countries.find(c => c.name_un === countryName);
    setReceiverCountry(country || null);
    
    // Clear source countries and data when receiver country changes
    setSourceCountries([]);
    setSelectedSourceCountry('');
    setSelectedCountries(new Set());
    setDiseaseStatus([]);
    setMitigationMeasures([]);
    setConnections([]);
  };

  const handleSourceCountrySelection = async (value: string) => {
    if (!value) return;
    
    setLoading(true);
    try {
      if (value === 'allEUNeighbourCountries') {
        // Handle EU neighbour countries selection
        try {
          const euNeighboursResponse = await apiService.rmt.getEUNeighbours();
          console.log('EU neighbours response:', euNeighboursResponse);
          
          // The backend sends results.data directly, so with Axios we get it in response.data
          const euNeighbours = euNeighboursResponse.data;
          console.log('EU neighbours data:', euNeighbours);
          
          if (Array.isArray(euNeighbours) && euNeighbours.length > 0) {
            setSourceCountries(euNeighbours);
            // Add all EU neighbour countries to selected countries set
            const newSelectedCountries = new Set<number>();
            euNeighbours.forEach(country => newSelectedCountries.add(country.id));
            setSelectedCountries(newSelectedCountries);
            
            // Fetch disease status and mitigation measures for all EU countries
            try {
              const promises = euNeighbours.flatMap(country => [
                apiService.rmt.getDiseaseStatusByCountry(country.id),
                apiService.rmt.getMitigationMeasuresByCountry(country.id)
              ]);
              
              const results = await Promise.all(promises);
              
              // Process results - odd indices are disease status, even are mitigation measures
              const diseaseStatusData = [];
              const mitigationMeasuresData = [];
              const connectionsData = [];
              
              for (let i = 0; i < euNeighbours.length; i++) {
                const country = euNeighbours[i];
                const diseaseResult = results[i * 2];
                const mitigationResult = results[i * 2 + 1];
                
                diseaseStatusData.push({
                  id: country.id,
                  countryName: country.name_un,
                  FMD: diseaseResult.data?.scores?.[0]?.FMD ?? null,
                  PPR: diseaseResult.data?.scores?.[0]?.PPR ?? null,
                  LSD: diseaseResult.data?.scores?.[0]?.LSD ?? null,
                  RVF: diseaseResult.data?.scores?.[0]?.RVF ?? null,
                  SPGP: diseaseResult.data?.scores?.[0]?.SPGP ?? null
                });
                
                mitigationMeasuresData.push({
                  id: country.id,
                  countryName: country.name_un,
                  FMD: mitigationResult.data?.scores?.[0]?.FMD ?? null,
                  PPR: mitigationResult.data?.scores?.[0]?.PPR ?? null,
                  LSD: mitigationResult.data?.scores?.[0]?.LSD ?? null,
                  RVF: mitigationResult.data?.scores?.[0]?.RVF ?? null,
                  SPGP: mitigationResult.data?.scores?.[0]?.SPGP ?? null
                });
                
                connectionsData.push({
                  id: country.id,
                  countryName: country.name_un,
                  liveAnimalContact: null,
                  legalImport: null,
                  proximity: null,
                  illegalImport: null,
                  connection: null,
                  livestockDensity: null
                });
              }
              
              setDiseaseStatus(diseaseStatusData);
              setMitigationMeasures(mitigationMeasuresData);
              setConnections(connectionsData);
              
            } catch (dataError) {
              console.warn('Failed to fetch EU countries data, using defaults:', dataError);
              // Initialize with null values if data fetching fails
              const diseaseStatusData = euNeighbours.map(country => ({
                id: country.id,
                countryName: country.name_un,
                FMD: null,
                PPR: null,
                LSD: null,
                RVF: null,
                SPGP: null
              }));
              
              const mitigationMeasuresData = euNeighbours.map(country => ({
                id: country.id,
                countryName: country.name_un,
                FMD: null,
                PPR: null,
                LSD: null,
                RVF: null,
                SPGP: null
              }));
              
              const connectionsData = euNeighbours.map(country => ({
                id: country.id,
                countryName: country.name_un,
                liveAnimalContact: null,
                legalImport: null,
                proximity: null,
                illegalImport: null,
                connection: null,
                livestockDensity: null
              }));
              
              setDiseaseStatus(diseaseStatusData);
              setMitigationMeasures(mitigationMeasuresData);
              setConnections(connectionsData);
            }
          } else {
            throw new Error('Invalid or empty EU neighbours response');
          }
        } catch (euError) {
          console.warn('EU neighbours endpoint failed, using fallback approach:', euError);
          // Fallback: Use hardcoded list of EU neighboring countries
          const euNeighbourCountries = countries.filter(country => {
            const euNeighbourNames = [
              'Albania', 'Armenia', 'Azerbaijan', 'Belarus', 'Bosnia and Herzegovina',
              'Georgia', 'Moldova', 'Montenegro', 'North Macedonia', 'Serbia',
              'Turkey', 'Ukraine', 'Russia', 'Norway', 'Switzerland', 'United Kingdom',
              'Algeria', 'Egypt', 'Libya', 'Morocco', 'Tunisia'
            ];
            return euNeighbourNames.includes(country.name_un) && country.id !== receiverCountry?.id;
          });
          console.log('Using fallback EU neighbour countries:', euNeighbourCountries);
          setSourceCountries(euNeighbourCountries);
          
          // Initialize data arrays for fallback countries
          const diseaseStatusData = euNeighbourCountries.map(country => ({
            id: country.id,
            countryName: country.name_un,
            FMD: null,
            PPR: null,
            LSD: null,
            RVF: null,
            SPGP: null
          }));
          
          const mitigationMeasuresData = euNeighbourCountries.map(country => ({
            id: country.id,
            countryName: country.name_un,
            FMD: null,
            PPR: null,
            LSD: null,
            RVF: null,
            SPGP: null
          }));
          
          const connectionsData = euNeighbourCountries.map(country => ({
            id: country.id,
            countryName: country.name_un,
            liveAnimalContact: null,
            legalImport: null,
            proximity: null,
            illegalImport: null,
            connection: null,
            livestockDensity: null
          }));
          
          setDiseaseStatus(diseaseStatusData);
          setMitigationMeasures(mitigationMeasuresData);
          setConnections(connectionsData);
        }
      } else {
        // Handle single country selection
          const selectedCountry = countries.find(c => c.name_un === value);
          if (selectedCountry) {
            // Check if country is already in source countries
            if (!sourceCountries.find(c => c.id === selectedCountry.id)) {
              setSourceCountries(prev => [...prev, selectedCountry]);
              // Add to selected countries set
              setSelectedCountries(prev => {
                const newSet = new Set(prev);
                newSet.add(selectedCountry.id);
                return newSet;
              });
              
              // Fetch disease status and mitigation measures for the new country
              try {
                console.log('Fetching data for country:', selectedCountry.name_un, 'ID:', selectedCountry.id);
                
                const [diseaseResponse, mitigationResponse] = await Promise.all([
                  apiService.rmt.getDiseaseStatusByCountry(selectedCountry.id),
                  apiService.rmt.getMitigationMeasuresByCountry(selectedCountry.id)
                ]);
                
                // Debug: Log the actual API responses
                console.log('Disease API Response for', selectedCountry.name_un, ':', diseaseResponse);
                console.log('Disease API Response Data:', diseaseResponse.data);
                console.log('Disease API Scores:', diseaseResponse.data?.scores);
                console.log('Mitigation API Response for', selectedCountry.name_un, ':', mitigationResponse);
                console.log('Mitigation API Response Data:', mitigationResponse.data);
                console.log('Mitigation API Scores:', mitigationResponse.data?.scores);                  // Check if disease status data already exists for this country
                  if (!diseaseStatus.find(d => d.id === selectedCountry.id)) {
                    // Debug the structure of the response
                    console.log('Disease response structure:', JSON.stringify(diseaseResponse.data));
                    
                    // Handle the response regardless of structure (array or single object)
                    const scores = diseaseResponse.data?.scores;
                    let scoreData: Record<string, any> = {};
                    
                    // Debug to see what we're getting
                    console.log('Disease scores type:', typeof scores);
                    console.log('Is array?', Array.isArray(scores));
                    console.log('Full disease scores:', scores);
                    
                    // Check if scores is an array, a single object, or just a value indicating status
                    if (Array.isArray(scores) && scores.length > 0) {
                      console.log('Using first item from scores array');
                      scoreData = scores[0];
                    } else if (typeof scores === 'object' && scores !== null) {
                      console.log('Using scores object directly');
                      scoreData = scores;
                    } else {
                      console.log('Using data directly');
                      // If scores is not what we expect, check if FMD, PPR, etc. are directly in data
                      scoreData = diseaseResponse.data;
                    }
                    
                    const newDiseaseStatus = {
                      id: selectedCountry.id,
                      countryName: selectedCountry.name_un,
                      FMD: (scoreData as Record<string, any>)?.FMD ?? null,
                      PPR: (scoreData as Record<string, any>)?.PPR ?? null,
                      LSD: (scoreData as Record<string, any>)?.LSD ?? null,
                      RVF: (scoreData as Record<string, any>)?.RVF ?? null,
                      SPGP: (scoreData as Record<string, any>)?.SPGP ?? null
                    };
                    console.log('Parsed disease status for', selectedCountry.name_un, ':', newDiseaseStatus);
                    setDiseaseStatus(prev => [...prev, newDiseaseStatus]);
                }                  // Check if mitigation measures data already exists for this country
                  if (!mitigationMeasures.find(m => m.id === selectedCountry.id)) {
                    // Debug the structure of the response
                    console.log('Mitigation response structure:', JSON.stringify(mitigationResponse.data));
                    
                    // Handle the response regardless of structure (array or single object)
                    const scores = mitigationResponse.data?.scores;
                    let scoreData: Record<string, any> = {};
                    
                    // Debug to see what we're getting
                    console.log('Mitigation scores type:', typeof scores);
                    console.log('Is array?', Array.isArray(scores));
                    console.log('Full mitigation scores:', scores);
                    
                    // Check if scores is an array, a single object, or just a value indicating status
                    if (Array.isArray(scores) && scores.length > 0) {
                      console.log('Using first item from scores array');
                      scoreData = scores[0];
                    } else if (typeof scores === 'object' && scores !== null) {
                      console.log('Using scores object directly');
                      scoreData = scores;
                    } else {
                      console.log('Using data directly');
                      // If scores is not what we expect, check if FMD, PPR, etc. are directly in data
                      scoreData = mitigationResponse.data;
                    }
                    
                    const newMitigationMeasure = {
                      id: selectedCountry.id,
                      countryName: selectedCountry.name_un,
                      FMD: (scoreData as Record<string, any>)?.FMD ?? null,
                      PPR: (scoreData as Record<string, any>)?.PPR ?? null,
                      LSD: (scoreData as Record<string, any>)?.LSD ?? null,
                      RVF: (scoreData as Record<string, any>)?.RVF ?? null,
                      SPGP: (scoreData as Record<string, any>)?.SPGP ?? null
                    };
                    console.log('Parsed mitigation measures for', selectedCountry.name_un, ':', newMitigationMeasure);
                    setMitigationMeasures(prev => [...prev, newMitigationMeasure]);
                }
                
                // Check if connections data already exists for this country
                if (!connections.find(c => c.id === selectedCountry.id)) {
                  // Initialize connections for the new country
                  const newConnection = {
                    id: selectedCountry.id,
                    countryName: selectedCountry.name_un,
                    liveAnimalContact: null,
                    legalImport: null,
                    proximity: null,
                    illegalImport: null,
                    connection: null,
                    livestockDensity: null
                  };
                  setConnections(prev => [...prev, newConnection]);
                }
                
              } catch (dataError: any) {
                console.error('API Error for country', selectedCountry.name_un, ':', dataError);
                console.error('Error response:', dataError.response?.data);
                console.error('Error status:', dataError.response?.status);
                console.error('Full error object:', JSON.stringify(dataError.response, null, 2));
                
                // Add with null values if API calls fail, but log what happened
                if (!diseaseStatus.find(d => d.id === selectedCountry.id)) {
                  const defaultDiseaseStatus = {
                    id: selectedCountry.id,
                    countryName: selectedCountry.name_un,
                    FMD: null,
                    PPR: null,
                    LSD: null,
                    RVF: null,
                    SPGP: null
                  };
                  console.log('Adding default disease status for', selectedCountry.name_un, 'due to API error');
                  setDiseaseStatus(prev => [...prev, defaultDiseaseStatus]);
                }
                
                if (!mitigationMeasures.find(m => m.id === selectedCountry.id)) {
                  const defaultMitigationMeasure = {
                    id: selectedCountry.id,
                    countryName: selectedCountry.name_un,
                    FMD: null,
                    PPR: null,
                    LSD: null,
                    RVF: null,
                    SPGP: null
                  };
                  console.log('Adding default mitigation measures for', selectedCountry.name_un, 'due to API error');
                  setMitigationMeasures(prev => [...prev, defaultMitigationMeasure]);
                }
                
                if (!connections.find(c => c.id === selectedCountry.id)) {
                  const defaultConnection = {
                    id: selectedCountry.id,
                    countryName: selectedCountry.name_un,
                    liveAnimalContact: null,
                    legalImport: null,
                    proximity: null,
                    illegalImport: null,
                    connection: null,
                    livestockDensity: null
                  };
                  setConnections(prev => [...prev, defaultConnection]);
                }
              }
            }
          }
        }
    } catch (err: any) {
      console.error('Failed to load source countries:', err);
      setError(err.message || 'Failed to load source countries');
    } finally {
      setLoading(false);
      setSelectedSourceCountry(''); // Reset selection
    }
  };

  // Data initialization is now handled manually during country selection

  // Remove this useEffect as we handle data initialization manually during country selection
  // useEffect(() => {
  //   if (sourceCountries.length > 0) {
  //     initializeDataArrays();
  //   }
  // }, [sourceCountries]);

  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Disease Status
        return receiverCountry !== null && sourceCountries.length > 0 && diseaseStatus.every(row => 
          diseases.every(disease => row[disease as keyof typeof row] !== null)
        );
      case 1: // Mitigation Measures
        return mitigationMeasures.every(row => 
          diseases.every(disease => row[disease as keyof typeof row] !== null)
        );
      case 2: // Pathways (pre-filled)
        return true;
      case 3: // Connections
        return connections.every(row => 
          connectionFields.every(field => row[field as keyof typeof row] !== null)
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < stepTitles.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      alert('Please fill in all required fields before proceeding.');
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setReceiverCountry(null);
    setSourceCountries([]);
    setSelectedSourceCountry('');
    setDiseaseStatus([]);
    setMitigationMeasures([]);
    setConnections([]);
  };

  const handleCalculateResults = () => {
    if (validateStep(3)) {
      // Find the first connection row that has values (assuming all rows have same values)
      const connectionData = connections.length > 0 ? connections[0] : null;
      
      if (!connectionData) {
        alert('No connection data available. Please fill in the connection details.');
        return;
      }

      // Navigate to results page with connections data
      navigate('/rmt/results', {
        state: {
          connections: {
            liveAnimalContact: connectionData.liveAnimalContact || 0,
            legalImport: connectionData.legalImport || 0,
            proximity: connectionData.proximity || 0,
            illegalImport: connectionData.illegalImport || 0,
            connection: connectionData.connection || 0,
            livestockDensity: connectionData.livestockDensity || 0
          },
          selectedCountries: Array.from(selectedCountries),
          receiverCountryName: receiverCountry?.name_un
        }
      });
    } else {
      alert('Please fill in all required fields before calculating results.');
    }
  };

  const updateDiseaseStatus = (countryId: number, disease: string, value: number) => {
    setDiseaseStatus(prev => 
      prev.map(row => 
        row.id === countryId 
          ? { ...row, [disease]: value }
          : row
      )
    );
  };

  const updateMitigationMeasure = (countryId: number, disease: string, value: number) => {
    setMitigationMeasures(prev => 
      prev.map(row => 
        row.id === countryId 
          ? { ...row, [disease]: value }
          : row
      )
    );
  };

  const updateConnection = (countryId: number, field: string, value: number) => {
    setConnections(prev => 
      prev.map(row => 
        row.id === countryId 
          ? { ...row, [field]: value }
          : row
      )
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Disease Status (includes country selection)
        return (
          <div className="space-y-6">
            {/* Country Selection Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-wrap gap-2 justify-evenly mb-0">
                {/* Receiver country select - Left side */}
                <div>
                  <label htmlFor="receiverCountry" className="block text-sm font-medium text-gray-700 mb-2">
                    My country is:
                  </label>
                  <select
                    id="receiverCountry"
                    value={receiverCountry?.name_un || ''}
                    onChange={(e) => handleReceiverCountryChange(e.target.value)}
                    className="block w-full mx-auto mt-1 p-2 border focus:border-[#15736d] rounded disabled:text-gray-400 bg-white mb-1 invalid:text-gray-400"
                  >
                    <option value="">Type name of the country</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.name_un}>
                        {country.name_un}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source country select - Right side */}
                <div className="grow">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    I want to evaluate risks with:
                  </div>
                  <div className="flex gap-2 justify-evenly">
                    <select
                      value={selectedSourceCountry}
                      onChange={(e) => handleSourceCountrySelection(e.target.value)}
                      className="block w-3/4 mx-auto mt-1 p-2 border focus:border-[#15736d] rounded bg-white mb-1"
                      disabled={!receiverCountry}
                    >
                      <option value="">Type name of the country</option>
                      <option value="allEUNeighbourCountries">
                        Select all EU neighbouring countries
                      </option>
                      {countries
                        .filter(country => country.id !== receiverCountry?.id)
                        .map(country => (
                          <option key={country.id} value={country.name_un}>
                            {country.name_un}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Disease Status Table - Shown immediately when countries are selected */}
            {diseaseStatus.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Disease Status</h3>
                <p className="text-gray-600 mb-4 text-sm">
                  The disease prevalence score reflects the current epidemiological situation of the source countries for the five FAST diseases 
                  (foot-and-mouth disease (FMD), peste des petits ruminants (PPR), lumpy skin disease (LSD), Rift Valley fever (RVF) and 
                  sheep pox and goat pox (SPGP)) and ranges from 0 to 3. Users can modify the scores as appropriate.
                </p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Disease Status Table */}
                  <div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                              Country
                            </th>
                            {diseases.map(disease => (
                              <th key={disease} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                                {disease}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {diseaseStatus.map((row) => (
                            <tr key={row.id}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                                {row.countryName}
                              </td>
                              {diseases.map(disease => (
                                <td key={disease} className={`px-3 py-2 whitespace-nowrap border border-gray-300 ${getScoreColor(row[disease as keyof typeof row] as number | null)}`}>
                                  <select
                                    value={row[disease as keyof typeof row] !== null && row[disease as keyof typeof row] !== undefined ? String(row[disease as keyof typeof row]) : ''}
                                    onChange={(e) => updateDiseaseStatus(row.id, disease, parseInt(e.target.value))}
                                    className="w-full p-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#15736d] bg-transparent"
                                  >
                                    <option value="">N/A</option>
                                    <option value="0">0</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                  </select>
                                </td>
                              ))}
                              <td className="px-3 py-2 whitespace-nowrap text-center border border-gray-300">
                                <button
                                  onClick={() => {
                                    setSourceCountries(prev => prev.filter(c => c.id !== row.id));
                                    setDiseaseStatus(prev => prev.filter(d => d.id !== row.id));
                                    setMitigationMeasures(prev => prev.filter(m => m.id !== row.id));
                                    setConnections(prev => prev.filter(c => c.id !== row.id));
                                  }}
                                  className="text-red-500 hover:text-red-700 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Disease Status Legend */}
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-800">Disease Status Levels:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <div className="w-8 h-6 bg-green-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">0</div>
                        <span><strong>Disease free:</strong> the pathogen is currently not present in the country</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-8 h-6 bg-yellow-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">1</div>
                        <span><strong>Silent/suspected circulation:</strong> Sporadic cases generally occur, but no active cases are currently reported in livestock. The pathogen may be present in wildlife.</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-8 h-6 bg-orange-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">2</div>
                        <span><strong>Low level circulation:</strong> Active cases are observed in one region (first level administrative divisions)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-8 h-6 bg-red-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">3</div>
                        <span><strong>High level circulation:</strong> Active cases observed in multiple regions (two or more first level administrative divisions), or cases are observed in multiple livestock sectors</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                      *depending on the country: regions, governorates, provinces, wilayas etc.
                    </p>
                    {diseaseStatusDate && (
                      <p className="text-xs text-gray-600 mt-2">
                        Date of last update of disease status scores for countries of the European Neighborhood: {formatDate(diseaseStatusDate)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 1: // Mitigation Measures
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Mitigation Measures</h3>
              <p className="text-gray-600 mb-4">
                The mitigation measures score evaluates the effectiveness of mitigation measures in the source countries for each FAST disease. The score can range from 0 to 4 (see below). The EuFMD team inputs default scores into the tool for the countries of the European neighborhood, reviews them quarterly, and updates them immediately if significant changes occur or new information is obtained.
              </p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mitigation Measures Table */}
                <div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                            Country
                          </th>
                          {diseases.map(disease => (
                            <th key={disease} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                              {disease}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {mitigationMeasures.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                              {row.countryName}
                            </td>
                            {diseases.map(disease => (
                              <td key={disease} className={`px-3 py-2 whitespace-nowrap border border-gray-300 ${getMitigationColor(row[disease as keyof typeof row] as number | null)}`}>
                                <select
                                  value={row[disease as keyof typeof row] !== null && row[disease as keyof typeof row] !== undefined ? String(row[disease as keyof typeof row]) : ''}
                                  onChange={(e) => updateMitigationMeasure(row.id, disease, parseInt(e.target.value))}
                                  className="w-full p-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#15736d] bg-transparent"
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Mitigation Measures Legend */}
                <div>
                  <h4 className="font-semibold mb-3 text-gray-800">Mitigation Measures Levels:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <div className="w-8 h-6 bg-red-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">0</div>
                      <span><strong>Uncontrolled risk:</strong> No mitigation measures are taken</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-6 bg-orange-200 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">1</div>
                      <span><strong>Insufficient measures:</strong> Mitigation measures are implemented, but not sufficient to substantially reduce the risk</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-6 bg-orange-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">2</div>
                      <span><strong>Some risks remain:</strong> Mitigation measures are effectively implemented, but some important risks remain unmitigated</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-6 bg-yellow-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">3</div>
                      <span><strong>Most risks mitigated:</strong> Mitigation measures are effectively implemented and the most important risks are mitigated</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-6 bg-green-100 border border-gray-300 mr-3 rounded flex items-center justify-center text-xs font-medium">4</div>
                      <span><strong>All risks mitigated:</strong> Mitigation measures are effectively implemented and all known risks are mitigated</span>
                    </div>
                  </div>
                  
                  {mitigationMeasuresDate && (
                    <p className="text-xs text-gray-600 mt-4">
                      Date of last update of mitigation measures scores for countries of the European Neighborhood: {formatDate(mitigationMeasuresDate)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Pathways
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Pathways Effectiveness</h3>
              <p className="text-gray-600 mb-4">
                The tool considers six incursion pathways (airborne, vectors, wild animals, animal products, live animals, fomites) for the introduction of pathogens into a target country. Each pathway/pathogen combination is assigned an effectiveness score (0 to 3) based on the ease of biological transmission. Scores are defined based on literature and expert knowledge, and it is not possible to modify them.
              </p>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Pathway effectiveness scores are automatically calculated based on EuFMD research data. No user input is required for this step.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Pathway
                          </th>
                          {diseases.map(disease => (
                            <th key={disease} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {disease}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pathwaysData.map((row, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {row.pathway}
                            </td>
                            {diseases.map(disease => {
                              const score = row[disease as keyof typeof row] as number;
                              return (
                                <td key={disease} className={`px-4 py-3 whitespace-nowrap text-sm text-center ${getPathwayColor(score)}`}>
                                  {score}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3">Score Legend</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <div className="w-6 h-6 pathway-zero border mr-2 rounded"></div>
                        <span>0 - Not important</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-6 h-6 pathway-one border mr-2 rounded"></div>
                        <span>1 - Possible</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-6 h-6 pathway-two border mr-2 rounded"></div>
                        <span>2 - Effective</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-6 h-6 pathway-three border mr-2 rounded"></div>
                        <span>3 - Very effective</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Key References*</h4>
                    <ul className="text-xs space-y-1 text-gray-600">
                      <li>• Brown et al., 2022</li>
                      <li>• Horigan et al., 2018</li>
                      <li>• Klausner et al., 2017</li>
                      <li>• Rossi et al., 2017</li>
                      <li>• Ryan et al., 2008</li>
                      <li>• Tuppurainen et al., 2017</li>
                    </ul>
                    <p className="text-xs text-gray-500 mt-2">
                      *All scores were determined based on scientific literature and expert opinion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3: // Connections
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Connections</h3>
              <p className="text-gray-600 mb-4">
                Rate the strength of connection between {receiverCountry?.name_un} and each source country from 1 (very low) to 5 (very high).
              </p>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Country
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Live Animal Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Legal Import
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Proximity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Illegal Import
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Connection
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Livestock Density
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {connections.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {row.countryName}
                        </td>
                        {connectionFields.map(field => (
                          <td key={field} className="px-4 py-3 whitespace-nowrap">
                            <select
                              value={row[field as keyof typeof row] !== null && row[field as keyof typeof row] !== undefined ? String(row[field as keyof typeof row]) : ''}
                              onChange={(e) => updateConnection(row.id, field, parseInt(e.target.value))}
                              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#15736d]"
                            >
                              <option value="">-</option>
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
          </div>
        );

      default:
        return null;
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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Risk Monitoring Tool</h1>
        {receiverCountry && currentStep !== 2 && (
          <h2 className="text-xl text-gray-700">
            Evaluating {receiverCountry.name_un}'s risk with:
          </h2>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {stepTitles.map((title, index) => (
            <div
              key={index}
              className={`flex items-center ${index <= currentStep ? 'text-[#015039]' : 'text-gray-400'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStep
                    ? 'bg-[#15736d] text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index + 1}
              </div>
              <span className="ml-2 text-sm font-medium hidden md:block">{title}</span>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#15736d] h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / stepTitles.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step content */}
      <div className="mb-8">
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between items-center">
        <div className="space-x-4">
          <Link
            to="/rmt"
            className="px-4 py-2 text-[#015039] border-2 border-[#015039] rounded-md hover:bg-[#15736d] hover:text-white transition-colors duration-300"
          >
            Back to Overview
          </Link>
          <button
            onClick={handleRestart}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Restart
          </button>
        </div>

        <div className="space-x-4">
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              className="px-4 py-2 font-semibold text-[#015039] bg-transparent border-2 border-[#015039] rounded transition-all duration-300 hover:bg-[#15736d] hover:text-white"
            >
              Previous
            </button>
          )}
          
          {currentStep < stepTitles.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!validateStep(currentStep)}
              className="px-4 py-2 font-semibold text-[#015039] bg-transparent border-2 border-[#015039] rounded transition-all duration-300 hover:bg-[#15736d] hover:text-white disabled:bg-gray-400 disabled:border-gray-400 disabled:text-white disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCalculateResults}
              disabled={!validateStep(currentStep)}
              className="px-4 py-2 font-bold text-[#15736d] border-[#15736d] border-2 rounded my-2 transition-all duration-300 hover:bg-green-100 shadow-none ease-in-out hover:shadow-md hover:shadow-black/30 disabled:bg-gray-400 disabled:border-gray-400 disabled:text-white disabled:cursor-not-allowed disabled:shadow-none"
            >
              Calculate results
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RMTRiskScores;
