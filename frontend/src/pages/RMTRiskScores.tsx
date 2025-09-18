import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { getPathwaysForChart } from '../utils/pathwaysConfig';
import { rmtDataService } from '../services/rmtDataService';
import { useAuthStore } from '../stores/authStore';

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

const RMTRiskScores: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  
  // Check if user can save data (has RMT-related role)
  const canSaveData = user && ['admin', 'rmt', 'risp'].includes(user.role);
  
  // Track if user has made modifications to data
  const [hasModifications, setHasModifications] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // State from navigation (when coming back from results page)
  const navigationState = useMemo(() => location.state || {}, [location.state]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Country selection state
  const [countries, setCountries] = useState<Country[]>([]);
  const [receiverCountry, setReceiverCountry] = useState<Country | null>(null);
  const [sourceCountries, setSourceCountries] = useState<Country[]>([]);
  const [selectedSourceCountry, setSelectedSourceCountry] = useState<string>('');
  
  // Carousel/step state - initialize from navigation state if available
  const [currentStep, setCurrentStep] = useState(navigationState.currentStep || 0);
  const stepTitles = ['Disease Status', 'Mitigation Measures', 'Pathways', 'Connections'];
  
  // Form data state
  const [diseaseStatus, setDiseaseStatus] = useState<DiseaseStatusRow[]>([]);
  const [mitigationMeasures, setMitigationMeasures] = useState<MitigationMeasureRow[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  
  // Date information
  const [diseaseStatusDate, setDiseaseStatusDate] = useState<string | null>(null);
  const [mitigationMeasuresDate, setMitigationMeasuresDate] = useState<string | null>(null);
  
  // Selected connection field for detailed info display
  const [selectedConnectionField, setSelectedConnectionField] = useState<string | null>(null);

  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];
  const connectionFields = ['liveAnimalContact', 'legalImport', 'proximity', 'illegalImport', 'connection', 'livestockDensity'];
  
  // Helper function to get data prioritizing user data over API data
  // Connection field titles and descriptions - matching Vue app exactly
  const connectionFieldInfo: Record<string, { 
    title: string; 
    description: string; 
    scoresInfo: Record<number, string>;
    legend: {
      title: string;
      sources: string[];
      link: string;
    }
  }> = {
    liveAnimalContact: { 
      title: "Live animals (ruminant/pig) contact or trade", 
      description: "Score the volume of legal import of live ruminants or pigs from the source country (or presumptive illegal import of live animals) and the possibility of contact through common grazing.",
      scoresInfo: {
        0: "No live ruminant/pig imports, either legal or informal",
        1: "Import is possible - very small numbers/sporadic (legal or informal)",
        2: "Import of small numbers or occasional (legal or informal) and/or occasional contacts through common grazing",
        3: "Import of large numbers regularly (legal or informal) and/or regular contact through common grazing"
      },
      legend: {
        title: "Possible data sources:",
        sources: ["TRACES", "National trade data"],
        link: "https://food.ec.europa.eu/horizontal-topics/traces_en"
      }
    },
    legalImport: { 
      title: "Legal import of products of animal (pig or ruminant) origin", 
      description: "Score the volume of products of animal origin (POAO) legally imported from the source country (pig or ruminant products).",
      scoresInfo: {
        0: "None",
        1: "Possible",
        2: "Occasional - Small volume",
        3: "Regular - Large volume"
      },
      legend: {
        title: "Possible data sources:",
        sources: ["TRACES", "National trade data"],
        link: "https://food.ec.europa.eu/horizontal-topics/traces_en"
      }
    },
    proximity: { 
      title: "Geographic Proximity", 
      description: "Score the proximity/spatial continuity of the target country with the source countries.",
      scoresInfo: {
        0: "Major barrier exists (distant, ocean, etc)",
        1: "No shared border, but no major geographical barriers. Connection by land vehicles is possible",
        2: "The countries are separated by water with a bridge or frequent boat crossing (less than 20km)",
        3: "The two countries share a land border"
      },
      legend: {
        title: "Possible data sources:",
        sources: ["On-line maps", "Eurostat statistics about transport"],
        link: "https://ec.europa.eu/eurostat/web/transport/overview"
      }
    },
    illegalImport: { 
      title: "Illegal import of ruminant/pig products (for commercial or personal use)", 
      description: "Score the frequency and volume of the informal/illegal import of ruminant/pig products from the source countries to the target country. If pertinent data is not available, an estimation could be done by considering indirect data such as the size of the immigrant community in the source country or the frequency of flight connections between the countries.",
      scoresInfo: {
        0: "Negligible",
        1: "Possible",
        2: "Likely (this might be associated with a high immigrant population, regular flight connections or border crossings, tourism connections)",
        3: "Known to be regular, informal import of ruminant or pig products"
      },
      legend: {
        title: "Possible data sources:",
        sources: ["National data regarding controls of passenger luggage", "National data regarding immigrant population", "Eurostat statistics about transport"],
        link: "https://ec.europa.eu/eurostat/web/transport/overview"
      }
    },
    connection: { 
      title: "Connection by land, air or sea (for fomites and vector pathways)", 
      description: "Score the frequency of movements between countries.",
      scoresInfo: {
        0: "No connection",
        1: "Possible (occasional)",
        2: "Regular connections (land vehicles, cargo or passenger ships, airplanes)",
        3: "Regular connections, including vehicles that transport pigs and/or ruminants (empty or full)"
      },
      legend: {
        title: "Possible data sources:",
        sources: ["Eurostat statistics about transport"],
        link: "https://ec.europa.eu/eurostat/web/transport/overview"
      }
    },
    livestockDensity: { 
      title: "Livestock density near the border shared with the source country", 
      description: "Define if the target country presents a high density of susceptible animals (ruminants and pigs) near the border with the source country.",
      scoresInfo: {
        0: "Low density of ruminants or pigs",
        1: "High density of ruminants or pigs"
      },
      legend: {
        title: "Possible data sources:",
        sources: ["National animal register", "FAO Gridded Livestock of the World"],
        link: "https://www.fao.org/land-water/land/land-governance/land-resources-planning-toolbox/category/details/fr/c/1236449/"
      }
    }
  };

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

  // Connection color function (scale 0-3, using warning colors)
  // Using the same color scheme as disease status but inverted (higher = more risk)
  const getConnectionColor = (score: number | null): string => {
    if (score === null || score === undefined) return 'score-na';
    switch (score) {
      case 0: return 'score-ok'; // No connection (low risk)
      case 1: return 'score-warning1'; // Low connection
      case 2: return 'score-warning2'; // Medium connection
      case 3: return 'score-warning4'; // High connection (high risk)
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

  // Predefined pathways scores from centralized config
  const pathwaysData: PathwayRow[] = getPathwaysForChart();

  useEffect(() => {
    loadInitialData();
    // Set default selected connection field
    setSelectedConnectionField('liveAnimalContact');
  }, []);

  // Restore state from sessionStorage or navigation state
  useEffect(() => {
    // Check if we have saved state in sessionStorage
    const savedState = sessionStorage.getItem('rmtState');
    if (savedState) {
      try {
        const rmtState = JSON.parse(savedState);
        setCurrentStep(rmtState.currentStep || 0);
        setReceiverCountry(rmtState.receiverCountry);
        setSourceCountries(rmtState.sourceCountries || []);
        setDiseaseStatus(rmtState.diseaseStatus || []);
        setMitigationMeasures(rmtState.mitigationMeasures || []);
        setConnections(rmtState.connections || []);
        setDiseaseStatusDate(rmtState.diseaseStatusDate);
        setMitigationMeasuresDate(rmtState.mitigationMeasuresDate);
      } catch (error) {
        console.error('Error restoring RMT state:', error);
      }
    }
    // If navigation state has currentStep, use that (for coming back from results)
    else if (navigationState.currentStep !== undefined) {
      setCurrentStep(navigationState.currentStep);
    }
  }, [navigationState]);

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
            
            // Fetch disease status and mitigation measures for all EU countries
            try {
              const promises = euNeighbours.flatMap(country => [
                apiService.rmt.getDiseaseStatusByCountry(country.id),
                apiService.rmt.getMitigationMeasuresByCountry(country.id)
              ]);
              
              const results = await Promise.all(promises);
              
              // Process results - odd indices are disease status, even are mitigation measures
              const diseaseStatusData: DiseaseStatusRow[] = [];
              const mitigationMeasuresData: MitigationMeasureRow[] = [];
              const connectionsData: ConnectionRow[] = [];
              
              for (let i = 0; i < euNeighbours.length; i++) {
                const country = euNeighbours[i];
                
                // Process API results
                const diseaseResult = results[i * 2];
                diseaseStatusData.push({
                  id: country.id,
                  countryName: country.name_un,
                  FMD: diseaseResult.data?.scores?.[0]?.FMD ?? null,
                  PPR: diseaseResult.data?.scores?.[0]?.PPR ?? null,
                  LSD: diseaseResult.data?.scores?.[0]?.LSD ?? null,
                  RVF: diseaseResult.data?.scores?.[0]?.RVF ?? null,
                  SPGP: diseaseResult.data?.scores?.[0]?.SPGP ?? null
                });
                
                const mitigationResult = results[i * 2 + 1];
                mitigationMeasuresData.push({
                  id: country.id,
                  countryName: country.name_un,
                  FMD: mitigationResult.data?.scores?.[0]?.FMD ?? null,
                  PPR: mitigationResult.data?.scores?.[0]?.PPR ?? null,
                  LSD: mitigationResult.data?.scores?.[0]?.LSD ?? null,
                  RVF: mitigationResult.data?.scores?.[0]?.RVF ?? null,
                  SPGP: mitigationResult.data?.scores?.[0]?.SPGP ?? null
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
          
          const connectionsData = euNeighbourCountries.map(country => {
            return {
              id: country.id,
              countryName: country.name_un,
              liveAnimalContact: null,
              legalImport: null,
              proximity: null,
              illegalImport: null,
              connection: null,
              livestockDensity: null
            };
          });
          
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
              
            // Fetch disease status and mitigation measures for the new country
            try {
              console.log('Fetching data for country:', selectedCountry.name_un, 'ID:', selectedCountry.id);
              
              // Fetch from API
              const [diseaseResponse, mitigationResponse] = await Promise.all([
                apiService.rmt.getDiseaseStatusByCountry(selectedCountry.id),
                apiService.rmt.getMitigationMeasuresByCountry(selectedCountry.id)
              ]);
              
              // Debug: Log the actual API responses
              console.log('Disease API Response for', selectedCountry.name_un, ':', diseaseResponse);
              if (diseaseResponse?.data) {
                console.log('Disease API Response Data:', diseaseResponse.data);
                console.log('Disease API Scores:', diseaseResponse.data?.scores);
              }
              console.log('Mitigation API Response for', selectedCountry.name_un, ':', mitigationResponse);
              if (mitigationResponse?.data) {
                console.log('Mitigation API Response Data:', mitigationResponse.data);
                console.log('Mitigation API Scores:', mitigationResponse.data?.scores);
              }
              
              // Check if disease status data already exists for this country
              if (!diseaseStatus.find(d => d.id === selectedCountry.id)) {
                let newDiseaseStatus: DiseaseStatusRow | null = null;
                
                if (diseaseResponse) {
                  // Debug: Log the actual API responses
                  console.log('Disease API Response for', selectedCountry.name_un, ':', diseaseResponse);
                  if (diseaseResponse.data) {
                    console.log('Disease API Response Data:', diseaseResponse.data);
                    console.log('Disease API Scores:', diseaseResponse.data?.scores);
                  }
                  
                  // Debug the structure of the response
                  console.log('Disease response structure:', JSON.stringify(diseaseResponse?.data));
                  
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
                    scoreData = diseaseResponse?.data || {};
                  }
                  
                  newDiseaseStatus = {
                    id: selectedCountry.id,
                    countryName: selectedCountry.name_un,
                    FMD: (scoreData as Record<string, any>)?.FMD ?? null,
                    PPR: (scoreData as Record<string, any>)?.PPR ?? null,
                    LSD: (scoreData as Record<string, any>)?.LSD ?? null,
                    RVF: (scoreData as Record<string, any>)?.RVF ?? null,
                    SPGP: (scoreData as Record<string, any>)?.SPGP ?? null
                  };
                }
                
                if (newDiseaseStatus) {
                  console.log('Parsed disease status for', selectedCountry.name_un, ':', newDiseaseStatus);
                  setDiseaseStatus(prev => [...prev, newDiseaseStatus!]);
                }
              }
              
              // Check if mitigation measures data already exists for this country
              if (!mitigationMeasures.find(m => m.id === selectedCountry.id)) {
                let newMitigationMeasure: MitigationMeasureRow | null = null;
                
                if (mitigationResponse) {
                  // Debug: Log the actual API responses
                  console.log('Mitigation API Response for', selectedCountry.name_un, ':', mitigationResponse);
                  if (mitigationResponse.data) {
                    console.log('Mitigation API Response Data:', mitigationResponse.data);
                    console.log('Mitigation API Scores:', mitigationResponse.data?.scores);
                  }
                  
                  // Debug the structure of the response
                  console.log('Mitigation response structure:', JSON.stringify(mitigationResponse?.data));
                  
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
                    scoreData = mitigationResponse?.data || {};
                  }
                  
                  newMitigationMeasure = {
                    id: selectedCountry.id,
                    countryName: selectedCountry.name_un,
                    FMD: (scoreData as Record<string, any>)?.FMD ?? null,
                    PPR: (scoreData as Record<string, any>)?.PPR ?? null,
                    LSD: (scoreData as Record<string, any>)?.LSD ?? null,
                    RVF: (scoreData as Record<string, any>)?.RVF ?? null,
                    SPGP: (scoreData as Record<string, any>)?.SPGP ?? null
                  };
                }
                
                if (newMitigationMeasure) {
                  console.log('Parsed mitigation measures for', selectedCountry.name_un, ':', newMitigationMeasure);
                  setMitigationMeasures(prev => [...prev, newMitigationMeasure!]);
                }
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
    // Clear sessionStorage
    sessionStorage.removeItem('rmtState');
    setCurrentStep(0);
    setReceiverCountry(null);
    setSourceCountries([]);
    setSelectedSourceCountry('');
    setDiseaseStatus([]);
    setMitigationMeasures([]);
    setConnections([]);
  };

  const handleBackToOverview = () => {
    // Clear sessionStorage when going back to overview
    sessionStorage.removeItem('rmtState');
    navigate('/rmt');
  };

  const handleCalculateResults = () => {
    if (validateStep(3)) {
      // Find the first connection row that has values (assuming all rows have same values)
      const connectionData = connections.length > 0 ? connections[0] : null;
      
      if (!connectionData) {
        alert('No connection data available. Please fill in the connection details.');
        return;
      }

      // Save current state to sessionStorage before navigating
      const rmtState = {
        currentStep,
        receiverCountry,
        sourceCountries,
        diseaseStatus,
        mitigationMeasures,
        connections,
        diseaseStatusDate,
        mitigationMeasuresDate
      };
      sessionStorage.setItem('rmtState', JSON.stringify(rmtState));

      // Prepare disease status and mitigation measures data as objects keyed by country ID
      const diseaseStatusData: Record<number, any> = {};
      const mitigationMeasuresData: Record<number, any> = {};

      diseaseStatus.forEach(ds => {
        diseaseStatusData[ds.id] = {
          dFMD: ds.FMD ?? 0,
          dPPR: ds.PPR ?? 0,
          dLSD: ds.LSD ?? 0,
          dRVF: ds.RVF ?? 0,
          dSPGP: ds.SPGP ?? 0,
          country_id: ds.id
        };
      });

      mitigationMeasures.forEach(mm => {
        mitigationMeasuresData[mm.id] = {
          mFMD: mm.FMD ?? 0,
          mPPR: mm.PPR ?? 0,
          mLSD: mm.LSD ?? 0,
          mRVF: mm.RVF ?? 0,
          mSPGP: mm.SPGP ?? 0,
          country_id: mm.id
        };
      });

      // Navigate to results page with all required data
      navigate('/rmt/results', {
        state: {
          connections: connections, // Pass the entire connections array per country
          selectedCountries: sourceCountries.map(country => country.id),
          receiverCountryName: receiverCountry?.name_un,
          diseaseStatusData,
          mitigationMeasuresData,
          sourceCountriesData: sourceCountries
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
    if (canSaveData) {
      setHasModifications(true);
    }
  };

  const updateMitigationMeasure = (countryId: number, disease: string, value: number) => {
    setMitigationMeasures(prev => 
      prev.map(row => 
        row.id === countryId 
          ? { ...row, [disease]: value }
          : row
      )
    );
    if (canSaveData) {
      setHasModifications(true);
    }
  };

  const updateConnection = (countryId: number, field: string, value: number) => {
    // For livestockDensity, ensure the value is only 0 or 1 as per Vue app
    if (field === 'livestockDensity' && value > 1) {
      value = 1; // Cap at 1 for livestock density
    }
    
    setConnections(prev => 
      prev.map(row => 
        row.id === countryId 
          ? { ...row, [field]: value }
          : row
      )
    );
    if (canSaveData) {
      setHasModifications(true);
    }
  };
  
  // Function to fill empty connection fields with value 0 (preserves existing user entries)
  const fillAllConnectionsWithZero = () => {
    setConnections(prev =>
      prev.map(row => ({
        ...row,
        liveAnimalContact: row.liveAnimalContact !== null && row.liveAnimalContact !== undefined ? row.liveAnimalContact : 0,
        legalImport: row.legalImport !== null && row.legalImport !== undefined ? row.legalImport : 0,
        proximity: row.proximity !== null && row.proximity !== undefined ? row.proximity : 0,
        illegalImport: row.illegalImport !== null && row.illegalImport !== undefined ? row.illegalImport : 0,
        connection: row.connection !== null && row.connection !== undefined ? row.connection : 0,
        livestockDensity: row.livestockDensity !== null && row.livestockDensity !== undefined ? row.livestockDensity : 0
      }))
    );
  };

  // Save user data to database
  const saveUserData = async () => {
    if (!canSaveData || !user) return;

    setIsSaving(true);
    setSaveMessage('');

    try {
      // Get current date for data records
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Save only the data for the current step
      switch (currentStep) {
        case 0: // Disease Status
          const diseaseData = diseaseStatus.map(row => ({
            country_id: row.id,
            FMD: row.FMD ?? 0,
            PPR: row.PPR ?? 0,
            LSD: row.LSD ?? 0,
            RVF: row.RVF ?? 0,
            SPGP: row.SPGP ?? 0,
            date: currentDate
          }));
          await rmtDataService.saveDiseaseStatus(diseaseData);
          setSaveMessage('Disease status data saved successfully!');
          break;

        case 1: // Mitigation Measures
          const mitigationData = mitigationMeasures.map(row => ({
            country_id: row.id,
            FMD: row.FMD ?? 0,
            PPR: row.PPR ?? 0,
            LSD: row.LSD ?? 0,
            RVF: row.RVF ?? 0,
            SPGP: row.SPGP ?? 0,
            date: currentDate
          }));
          await rmtDataService.saveMitigationMeasures(mitigationData);
          setSaveMessage('Mitigation measures data saved successfully!');
          break;

        case 2: // Pathways
          // Pathways don't have user-specific data to save currently
          setSaveMessage('Pathways data is calculated automatically - no save needed.');
          break;

        case 3: // Connections
          const connectionsData = connections.map(row => ({
            country_id: row.id,
            liveAnimalContact: row.liveAnimalContact ?? 0,
            legalImport: row.legalImport ?? 0,
            proximity: row.proximity ?? 0,
            illegalImport: row.illegalImport ?? 0,
            connection: row.connection ?? 0,
            livestockDensity: row.livestockDensity ?? 0
          }));
          await rmtDataService.saveConnections(connectionsData);
          setSaveMessage('Connections data saved successfully!');
          break;

        default:
          setSaveMessage('Unknown step - cannot save data.');
          break;
      }

      // Reset modifications flag after successful save
      setHasModifications(false);
      setHasModifications(false);
    } catch (error) {
      console.error('Error saving data:', error);
      setSaveMessage('Error saving data. Please try again.');
    } finally {
      setIsSaving(false);
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Disease Status (includes country selection)
        return (
          <div className="space-y-6">
            {/* Country Selection Form */}
            <div className="rmt-step">
              <div className="flex flex-col lg:flex-row gap-4 justify-evenly mb-0">
                {/* Receiver country select - Left side */}
                <div className="flex-1 min-w-0">
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
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    I want to evaluate risks with:
                  </div>
                  <div className="flex gap-2 justify-evenly">
                    <select
                      value={selectedSourceCountry}
                      onChange={(e) => handleSourceCountrySelection(e.target.value)}
                      className="block w-full mx-auto mt-1 p-2 border focus:border-[#15736d] rounded bg-white mb-1"
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
              <div className="rmt-step">
                <h3 className="text-lg font-semibold mb-4">Disease Status</h3>
                <p className="text-gray-600 mb-4 text-sm">
                  The disease prevalence score reflects the current epidemiological situation of the source countries for the five FAST diseases 
                  (foot-and-mouth disease (FMD), peste des petits ruminants (PPR), lumpy skin disease (LSD), Rift Valley fever (RVF) and 
                  sheep pox and goat pox (SPGP)) and ranges from 0 to 3. Users can modify the scores as appropriate.
                </p>
                
                <div className="rmt-grid">
                  {/* Disease Status Table */}
                  <div className="h-full">
                    <div className="rmt-table-container">
                      <table className="rmt-table">
                        <thead>
                          <tr>
                            <th>
                              Country
                            </th>
                            {diseases.map(disease => (
                              <th key={disease}>
                                {disease}
                              </th>
                            ))}
                            <th>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {diseaseStatus.map((row) => (
                            <tr key={row.id}>
                              <td className="whitespace-nowrap font-medium text-gray-900">
                                {row.countryName}
                              </td>
                              {diseases.map(disease => (
                                <td key={disease} className="text-center">
                                  <select
                                    value={row[disease as keyof typeof row] !== null && row[disease as keyof typeof row] !== undefined ? String(row[disease as keyof typeof row]) : ''}
                                    onChange={(e) => updateDiseaseStatus(row.id, disease, parseInt(e.target.value))}
                                    className={`rmt-score ${getScoreColor(row[disease as keyof typeof row] as number | null)}`}
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
                    <div className="rmt-info-box">
                      <h4 className="rmt-info-title">Disease Status Levels:</h4>
                      <div className="space-y-2">
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-ok">0</div>
                          <span><strong>Disease free:</strong> the pathogen is currently not present in the country</span>
                        </div>
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-warning1">1</div>
                          <span><strong>Silent/suspected circulation:</strong> Sporadic cases generally occur, but no active cases are currently reported in livestock. The pathogen may be present in wildlife.</span>
                        </div>
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-warning2">2</div>
                          <span><strong>Low level circulation:</strong> Active cases are observed in one region (first level administrative divisions)</span>
                        </div>
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-warning4">3</div>
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

                {/* Save button for Disease Status */}
                {canSaveData && currentStep === 0 && (
                  <div className="mt-4 mb-4">
                    <button
                      onClick={() => setHasModifications(true)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-[#15736d] border border-[#15736d] rounded hover:bg-[#015039] hover:border-[#015039] transition-all duration-300"
                    >
                      Save Data
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 1: // Mitigation Measures
        return (
          <div className="space-y-6">
            <div className="rmt-step">
              <h3 className="text-lg font-semibold mb-4">Mitigation Measures</h3>
              <p className="text-gray-600 mb-4">
                The mitigation measures score evaluates the effectiveness of mitigation measures in the source countries for each FAST disease. The score can range from 0 to 4 (see below). The EuFMD team inputs default scores into the tool for the countries of the European neighborhood, reviews them quarterly, and updates them immediately if significant changes occur or new information is obtained.
              </p>
              
              <div className="rmt-grid">
                {/* Mitigation Measures Table */}
                <div>
                  <div className="rmt-table-container">
                    <table className="rmt-table">
                      <thead>
                        <tr>
                          <th>
                            Country
                          </th>
                          {diseases.map(disease => (
                            <th key={disease}>
                              {disease}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mitigationMeasures.map((row) => (
                          <tr key={row.id}>
                            <td className="whitespace-nowrap font-medium text-gray-900">
                              {row.countryName}
                            </td>
                            {diseases.map(disease => (
                              <td key={disease} className="text-center">
                                <select
                                  value={row[disease as keyof typeof row] !== null && row[disease as keyof typeof row] !== undefined ? String(row[disease as keyof typeof row]) : ''}
                                  onChange={(e) => updateMitigationMeasure(row.id, disease, parseInt(e.target.value))}
                                  className={`rmt-score ${getMitigationColor(row[disease as keyof typeof row] as number | null)}`}
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
                <div className="rmt-info-box">
                  <h4 className="rmt-info-title">Mitigation Measures Levels:</h4>
                  <div className="space-y-2">
                    <div className="rmt-legend-item">
                      <div className="rmt-legend-color score-warning4">0</div>
                      <span><strong>Uncontrolled risk:</strong> No mitigation measures are taken</span>
                    </div>
                    <div className="rmt-legend-item">
                      <div className="rmt-legend-color score-warning3">1</div>
                      <span><strong>Insufficient measures:</strong> Mitigation measures are implemented, but not sufficient to substantially reduce the risk</span>
                    </div>
                    <div className="rmt-legend-item">
                      <div className="rmt-legend-color score-warning2">2</div>
                      <span><strong>Some risks remain:</strong> Mitigation measures are effectively implemented, but some important risks remain unmitigated</span>
                    </div>
                    <div className="rmt-legend-item">
                      <div className="rmt-legend-color score-warning1">3</div>
                      <span><strong>Most risks mitigated:</strong> Mitigation measures are effectively implemented and the most important risks are mitigated</span>
                    </div>
                    <div className="rmt-legend-item">
                      <div className="rmt-legend-color score-ok">4</div>
                      <span><strong>All risks mitigated:</strong> Mitigation measures are effectively implemented and all known risks are mitigated</span>
                    </div>
                  </div>
                  
                  {mitigationMeasuresDate && (
                    <p className="text-xs text-gray-600 mt-4">
                      Date of last update of mitigation measures scores for countries of the European Neighborhood: {formatDate(mitigationMeasuresDate)}
                    </p>
                  )}
                </div>

                {/* Save button for Mitigation Measures */}
                {canSaveData && currentStep === 1 && (
                  <div className="mt-4 mb-4">
                    <button
                      onClick={() => setHasModifications(true)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-[#15736d] border border-[#15736d] rounded hover:bg-[#015039] hover:border-[#015039] transition-all duration-300"
                    >
                      Save Data
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2: // Pathways
        return (
          <div className="space-y-6">
            <div className="rmt-step">
              <h3 className="text-lg font-semibold mb-4">Pathways Effectiveness</h3>
              <p className="text-gray-600 mb-4">
                The tool considers six incursion pathways (airborne, vectors, wild animals, animal products, live animals, fomites) for the introduction of pathogens into a target country. Each pathway/pathogen combination is assigned an effectiveness score (0 to 3) based on the ease of biological transmission. Scores are defined based on literature and expert knowledge, and it is not possible to modify them.
              </p>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Pathway effectiveness scores are estimated based on research data, and have been reviewed by experts of the European Reference Laboratories for each of the FAST diseases. No user inputs is required for this step.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rmt-grid">
                <div>
                  <div className="rmt-table-container">
                    <table className="rmt-table">
                      <thead>
                        <tr>
                          <th>
                            Pathway
                          </th>
                          {diseases.map(disease => (
                            <th key={disease}>
                              {disease}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pathwaysData.map((row, index) => (
                          <tr key={index}>
                            <td className="whitespace-nowrap font-medium text-gray-900">
                              {row.pathway}
                            </td>
                            {diseases.map(disease => {
                              const score = row[disease as keyof typeof row] as number;
                              return (
                                <td key={disease} className="text-center">
                                  <div className={`rmt-score ${getPathwayColor(score)}`}>
                                    {score}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="flex flex-col lg:flex-row gap-4 mt-4 lg:mt-0">
                  <div className="rmt-info-box flex-1">
                    <h4 className="rmt-info-title">Score Legend</h4>
                    <div className="space-y-2">
                      <div className="rmt-legend-item">
                        <div className="rmt-legend-color pathway-zero">0</div>
                        <span>Not important</span>
                      </div>
                      <div className="rmt-legend-item">
                        <div className="rmt-legend-color pathway-one">1</div>
                        <span>Possible</span>
                      </div>
                      <div className="rmt-legend-item">
                        <div className="rmt-legend-color pathway-two">2</div>
                        <span>Effective</span>
                      </div>
                      <div className="rmt-legend-item">
                        <div className="rmt-legend-color pathway-three">3</div>
                        <span>Very effective</span>
                      </div>
                    </div>
                  </div>

                  <div className="rmt-info-box flex-1">
                    <h4 className="rmt-info-title">Key References*</h4>
                    <ul className="text-xs space-y-1 text-gray-600">
                      <li>• <a href="https://www.mdpi.com/1999-4915/14/5/1009" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Brown et al., 2022</a></li>
                      <li>• <a href="https://www.sciencedirect.com/science/article/abs/pii/S0167587717306943" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Horigan et al., 2018</a></li>
                      <li>• <a href="https://onlinelibrary.wiley.com/doi/abs/10.1111/tbed.12378" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Klausner et al., 2017</a></li>
                      <li>• <a href="https://www.nature.com/articles/s41598-017-02567-6" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Rossi et al., 2017</a></li>
                      <li>• <a href="https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1865-1682.2007.01004.x" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Ryan et al., 2008</a></li>
                      <li>• <a href="https://onlinelibrary.wiley.com/doi/10.1111/tbed.12444" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Tuppurainen et al., 2015</a></li>
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
            <div className="rmt-step">
              <h3 className="text-lg font-semibold mb-4">Connections between countries</h3>
              <p className="text-gray-600 mb-4">
                In this section, define the connection scores (table on the left), using the criteria provided when 
                clicking on the column headers or cells. To help with this process, various data sources are suggested. 
                The connection scores will then be combined to assess the strength of the connection between {receiverCountry?.name_un} and 
                each source country, through each of the 6 pathways, ranging from no connection (0) to highly connected (3).
              </p>
              
              <div className="flex flex-wrap justify-start mb-4 gap-2">
                <button
                  onClick={fillAllConnectionsWithZero}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1 px-3 rounded text-sm flex items-center gap-1"
                  title="Fill only empty fields with 0 (preserves existing values)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  Fill Empty With 0
                </button>
              </div>
              
              <div className="rmt-grid">
                <div className="rmt-table-container">
                  <table className="rmt-table">
                    <thead>
                      <tr>
                        <th>
                          Country
                        </th>
                        {connectionFields.map(field => (
                          <th 
                            key={field}
                            onClick={() => setSelectedConnectionField(field)}
                            className="cursor-pointer hover:bg-gray-100"
                            title={`Click for more information about ${connectionFieldInfo[field].title}`}
                          >
                            {connectionFieldInfo[field].title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {connections.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap font-medium text-gray-900">
                            {row.countryName}
                          </td>
                          {connectionFields.map(field => (
                            <td 
                              key={field} 
                              className="text-center"
                              onClick={() => setSelectedConnectionField(field)}
                            >
                              <select
                                value={row[field as keyof typeof row] !== null && row[field as keyof typeof row] !== undefined ? String(row[field as keyof typeof row]) : ''}
                                onChange={(e) => updateConnection(row.id, field, parseInt(e.target.value))}
                                className={`rmt-score ${getConnectionColor(row[field as keyof typeof row] as number | null)}`}
                              >
                                <option value="">-</option>
                                <option value="0">0</option>
                                {field === 'livestockDensity' ? (
                                  // Livestock density only has 0 and 1 options in the Vue app
                                  <option value="1">1</option>
                                ) : (
                                  // Other connection fields have 0-3 options
                                  <>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                  </>
                                )}
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Connections Legend Box */}
                <div className="rmt-info-box">
                  {selectedConnectionField ? (
                    <>
                      <h4 className="rmt-info-title">{connectionFieldInfo[selectedConnectionField].title}</h4>
                      <p className="mb-4 text-sm text-gray-700">{connectionFieldInfo[selectedConnectionField].description}</p>
                      <table className="w-full text-center tracking-wider text-sm mb-4">
                        <thead className="text-white">
                          <tr className="bg-[#15736d] text-sm font-medium whitespace-nowrap">
                            <th className="py-2 px-4 border border-white">Score</th>
                            <th className="py-2 px-4 border border-white">Information</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(connectionFieldInfo[selectedConnectionField].scoresInfo).map(([score, info]) => (
                            <tr key={score}>
                              <td className={`${getConnectionColor(parseInt(score))} px-4 py-2`}>{score}</td>
                              <td className="px-4 py-2 text-left">{info}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      <div className="ml-2">
                        <div className="text-sm font-medium mt-4 mb-2">
                          {connectionFieldInfo[selectedConnectionField].legend.title}
                        </div>
                        <ul className="text-sm list-disc pl-6">
                          {connectionFieldInfo[selectedConnectionField].legend.sources.map((source, index) => (
                            <li key={index} className="mb-1">
                              {source === 'TRACES' || source === 'Eurostat statistics about transport' ? (
                                <a 
                                  href={connectionFieldInfo[selectedConnectionField].legend.link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {source}
                                </a>
                              ) : source === 'FAO Gridded Livestock of the World' ? (
                                <>
                                  Animal density maps (<a 
                                    href={connectionFieldInfo[selectedConnectionField].legend.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    {source}
                                  </a>)
                                </>
                              ) : (
                                <span>{source}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="rmt-info-title">Connection Information</h4>
                      <p className="mb-3 text-sm text-gray-700">
                        In this section, you define the connection scores (table on the left), 
                        using the criteria provided when clicking on the column headers or cells.
                        To help with this process, various data sources are suggested.
                      </p>
                      <p className="mb-3 text-sm text-gray-700">
                        The connection scores will be combined to assess the strength 
                        of the connection between your country and the source countries, through 
                        each of the 6 pathways, ranging from no connection (0) to highly connected (2).
                      </p>
                      <div className="space-y-2 mb-4">
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-ok">0</div>
                          <span>None - No significant connection</span>
                        </div>
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-warning1">1</div>
                          <span>Low - Limited connection</span>
                        </div>
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-warning2">2</div>
                          <span>Medium - Moderate connection</span>
                        </div>
                        <div className="rmt-legend-item">
                          <div className="rmt-legend-color score-warning4">3</div>
                          <span>High - Strong connection</span>
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 border-l-4 border-blue-300 rounded">
                        <p className="text-sm text-gray-700">
                          <strong>Click on any column header or cell</strong> to see detailed criteria and data sources for each connection type.
                        </p>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">
                        <strong>Note:</strong> Livestock Density only uses values 0 (No high density) and 1 (Yes, high density).
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-600 mt-4">
                    Note: Rate each connection factor based on your knowledge of the relationship between countries.
                  </p>
                </div>

                {/* Save button for Connections */}
                {canSaveData && currentStep === 3 && (
                  <div className="mt-4 mb-4">
                    <button
                      onClick={() => setHasModifications(true)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-[#15736d] border border-[#15736d] rounded hover:bg-[#015039] hover:border-[#015039] transition-all duration-300"
                    >
                      Save Data
                    </button>
                  </div>
                )}
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Risk Monitoring Tool</h1>
        {receiverCountry && currentStep !== 2 && (
          <h2 className="text-lg sm:text-xl text-gray-700">
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
        <div className="rmt-progress mb-4">
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
              <span className="ml-2 text-sm font-medium hidden sm:block">{title}</span>
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
      <div className="mb-12">
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBackToOverview}
            className="px-4 py-2 text-[#015039] border-2 border-[#015039] rounded-md hover:bg-[#15736d] hover:text-white transition-colors duration-300"
          >
            Back to Overview
          </button>
          <button
            onClick={handleRestart}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Restart
          </button>
        </div>

        {/* Save message display */}
        {saveMessage && (
          <div className={`mt-4 p-3 rounded-md ${saveMessage.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {saveMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Save button for RMT users when modifications have been made */}
          {canSaveData && hasModifications && (
            <button
              onClick={saveUserData}
              disabled={isSaving}
              className="px-4 py-2 font-semibold text-white bg-[#15736d] border-2 border-[#15736d] rounded transition-all duration-300 hover:bg-[#015039] hover:border-[#015039] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : `Save ${stepTitles[currentStep]} Data`}
            </button>
          )}
          
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
