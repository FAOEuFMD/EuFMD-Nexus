import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  getMaxRiskScore,
  getRiskBgClass,
  getRiskTextClass,
  normalizeRiskScore,
} from '../utils/riskScoreColors';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { calculateRiskScores, Connections } from '../utils/calculateRiskScores';
import { calculateConnectionScoresPerPathway } from '../utils/calculateConnectionScoresPerPathway';
import { PATHWAYS_EFFECTIVENESS } from '../utils/pathwaysConfig';

// Import map and chart components
import RiskScoreMap from '../components/RMT/maps/RiskScoreMap';
import PathwayEffectivenessRadar from '../components/RMT/charts/PathwayEffectivenessRadar';
import SimpleHeatmap from '../components/RMT/charts/SimpleHeatmap';
import SimpleBarChart from 'components/RMT/charts/SimpleBarChart';

// Types
interface RiskScore {
  sourceCountry: string;
  sourceCountryId: number;
  disease: string;
  riskScore: number;
  diseaseRisk: number;
  pathwayScore: number;
  connectionStrength: number;
}

interface Country {
  id: number;
  name_un: string;
  iso3: string;
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

interface DiseaseStatus {
  dFMD: number | null;
  dPPR: number | null;
  dLSD: number | null;
  dRVF: number | null;
  dSPGP: number | null;
  country_id?: number;
}

interface MitigationMeasure {
  mFMD: number | null;
  mPPR: number | null;
  mLSD: number | null;
  mRVF: number | null;
  mSPGP: number | null;
  country_id?: number;
}

interface PathwayScores {
  name_un: string;
  scores: {
    airborne: number;
    vectorborne: number;
    wildAnimals: number;
    animalProduct: number;
    liveAnimal: number;
    fomite: number;
  };
  diseaseScores: {
    [key: string]: {
      airborne: number;
      vectorborne: number;
      wildAnimals: number;
      animalProduct: number;
      liveAnimal: number;
      fomite: number;
    };
  };
}

interface CollapsibleSectionProps {
  title: string;
  variant?: 'main' | 'sub';
  defaultOpen?: boolean;
  description?: string;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  variant = 'sub',
  defaultOpen = true,
  description,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  // When a section is expanded, notify any embedded maps/charts (e.g. Leaflet)
  // so they re-measure their container and render correctly.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const isMain = variant === 'main';

  return (
    <div className={isMain ? 'rmt-collapsible rmt-collapsible-main mb-6' : 'rmt-collapsible rmt-collapsible-sub mb-4'}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          isMain
            ? 'w-full flex items-center justify-between text-left px-4 py-3 bg-[#15736d] text-white rounded-t hover:bg-[#0f5a54] transition-colors'
            : 'w-full flex items-center justify-between text-left px-4 py-2 bg-gray-100 text-gray-800 rounded-t hover:bg-gray-200 transition-colors border-b border-gray-200'
        }
      >
        <span className={isMain ? 'text-lg font-bold' : 'text-base font-semibold'}>{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div className={`rmt-collapsible-body ${open ? '' : 'rmt-collapsible-collapsed'} border border-t-0 border-gray-200 rounded-b px-4 py-4`}>
        {description && <p className="text-gray-600 mb-4">{description}</p>}
        {children}
      </div>
    </div>
  );
};

const RMTResults: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Results data
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [sourceCountries, setSourceCountries] = useState<Country[]>([]);
  const [receiverCountry, setReceiverCountry] = useState<string>('');
  const [receiverCountryInfo, setReceiverCountryInfo] = useState<Country | null>(null);
  const [receiverIsCustom, setReceiverIsCustom] = useState(false);
  
  // Data for visualization
  const [diseaseStatus, setDiseaseStatus] = useState<Array<{ name_un: string; [key: string]: any }>>([]);
  const [pathwayScores, setPathwayScores] = useState<PathwayScores[]>([]);

  // Input data retained for the Inputs section and the "download all" export
  const [mitigationMeasures, setMitigationMeasures] = useState<Record<number, MitigationMeasure>>({});
  const [connectionsByCountry, setConnectionsByCountry] = useState<Record<number, Connections>>({});
  
  // Disease names
  const diseases = useMemo(() => ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'], []);
  const [selectedDisease, setSelectedDisease] = useState<string>('FMD');

  // Pathway data
  const pathwaysData = useMemo(() => [
    { pathway: "Airborne", FMD: 2, PPR: 0, LSD: 1, RVF: 1, SPGP: 2 },
    { pathway: "Vector-borne", FMD: 0, PPR: 0, LSD: 3, RVF: 3, SPGP: 1 },
    { pathway: "Wild Animals", FMD: 1, PPR: 2, LSD: 0, RVF: 1, SPGP: 0 },
    { pathway: "Animal Product", FMD: 2, PPR: 0, LSD: 1, RVF: 2, SPGP: 1 },
    { pathway: "Live Animal", FMD: 3, PPR: 3, LSD: 2, RVF: 3, SPGP: 3 },
    { pathway: "Fomite", FMD: 2, PPR: 2, LSD: 1, RVF: 0, SPGP: 2 },
  ], []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get data from location state
        const { 
          connections, 
          selectedCountries, 
          receiverCountry: stateReceiverCountry,
          receiverCountryName,
          receiverIsCustom: stateReceiverIsCustom,
          diseaseStatusData: stateDisease,
          mitigationMeasuresData: stateMitigation,
          sourceCountriesData
        } = location.state || {};
        
        if (!connections || !selectedCountries || !Array.isArray(selectedCountries)) {
          setError('Missing required data. Please go back and complete the previous steps.');
          setLoading(false);
          return;
        }
        
        setReceiverCountry(receiverCountryName || stateReceiverCountry?.name_un || 'Unknown Country');
        setReceiverIsCustom(Boolean(stateReceiverIsCustom));
        if (!stateReceiverIsCustom && stateReceiverCountry?.iso3) {
          setReceiverCountryInfo(stateReceiverCountry);
        }
        
        // Initialize data structures
        let diseaseStatusData: Record<number, DiseaseStatus> = {};
        let mitigationMeasuresData: Record<number, MitigationMeasure> = {};
        let countriesData: Country[] = [];
        
        // If we have data in state, use it directly
        if (stateDisease && stateMitigation && sourceCountriesData && sourceCountriesData.length > 0) {
          diseaseStatusData = stateDisease;
          mitigationMeasuresData = stateMitigation;
          countriesData = sourceCountriesData;
        }
        // Otherwise fetch from API
        else {
          // Create promises for all API calls
          const apiCalls = selectedCountries.map((countryId: number) => Promise.all([
            apiService.rmt.getDiseaseStatusByCountry(countryId),
            apiService.rmt.getMitigationMeasuresByCountry(countryId),
            apiService.countries.getById(countryId)
          ]));
          
          // Wait for all API calls to complete
          const results = await Promise.all(apiCalls);
          
          // Process results
          results.forEach((result: any[], index: number) => {
            const countryId = selectedCountries[index];
            const [diseaseStatus, mitigationMeasures, countryData] = result;
            
            if (countryData && countryData.data) {
              countriesData.push(countryData.data);
            }
            
            if (diseaseStatus.data && diseaseStatus.data.scores && diseaseStatus.data.scores.length > 0) {
              const latestDS = diseaseStatus.data.scores[0];
              diseaseStatusData[countryId] = {
                dFMD: latestDS.FMD,
                dPPR: latestDS.PPR,
                dLSD: latestDS.LSD,
                dRVF: latestDS.RVF,
                dSPGP: latestDS.SPGP,
                country_id: countryId
              };
            }
            
            if (mitigationMeasures.data && mitigationMeasures.data.scores && mitigationMeasures.data.scores.length > 0) {
              const latestMM = mitigationMeasures.data.scores[0];
              mitigationMeasuresData[countryId] = {
                mFMD: latestMM.FMD,
                mPPR: latestMM.PPR,
                mLSD: latestMM.LSD,
                mRVF: latestMM.RVF,
                mSPGP: latestMM.SPGP,
                country_id: countryId
              };
            }
          });
        }

        if (!stateReceiverIsCustom && !stateReceiverCountry?.iso3 && receiverCountryName) {
          const allCountriesResponse = await apiService.countries.getAll();
          const match = allCountriesResponse.data?.find(
            (c: Country) => c.name_un === receiverCountryName,
          );
          if (match) setReceiverCountryInfo(match);
        }
        
        setSourceCountries(countriesData);
        setMitigationMeasures(mitigationMeasuresData);
        
        // Transform connections array to be indexed by country ID
        const connectionsPerCountry: Record<number, Connections> = {};
        
        // connections should now be an array of ConnectionRow objects
        if (Array.isArray(connections)) {
          connections.forEach((connRow: ConnectionRow) => {
            connectionsPerCountry[connRow.id] = {
              liveAnimalContact: connRow.liveAnimalContact || 0,
              legalImport: connRow.legalImport || 0,
              proximity: connRow.proximity || 0,
              illegalImport: connRow.illegalImport || 0,
              connection: connRow.connection || 0,
              livestockDensity: connRow.livestockDensity || 0
            };
          });
        } else {
          // Fallback for old format (single connections object)
          countriesData.forEach(country => {
            connectionsPerCountry[country.id] = { 
              liveAnimalContact: connections.liveAnimalContact || 0,
              legalImport: connections.legalImport || 0,
              proximity: connections.proximity || 0,
              illegalImport: connections.illegalImport || 0,
              connection: connections.connection || 0,
              livestockDensity: connections.livestockDensity || 0
            };
          });
        }

        setConnectionsByCountry(connectionsPerCountry);

        console.log('Original connections:', connections);
        console.log('Connections per country:', connectionsPerCountry);
        console.log('Countries data:', countriesData);
        
        // Calculate risk scores
        const calculatedScores = calculateRiskScores({
          diseaseStatus: diseaseStatusData,
          mitigationMeasures: mitigationMeasuresData,
          connections: connectionsPerCountry,
          sourceCountries: countriesData
        });
        
        setRiskScores(calculatedScores);
        
        // Prepare data for disease status visualization
        const dsChartData = countriesData.map(country => {
          const countryId = country.id;
          const ds = diseaseStatusData[countryId];
          
          return {
            name_un: country.name_un,
            FMD: ds?.dFMD ?? 0,
            PPR: ds?.dPPR ?? 0,
            LSD: ds?.dLSD ?? 0,
            RVF: ds?.dRVF ?? 0,
            SPGP: ds?.dSPGP ?? 0
          };
        });
        setDiseaseStatus(dsChartData);
        
        // Calculate scores per pathway for the risk pathway charts (Vue logic)
        const scoresByPathway = countriesData.map(country => {
          const countryId = country.id;
          // Get connection scores for this country (provide defaults if undefined)
          const countryConnections = connectionsPerCountry[countryId] || {
            liveAnimalContact: 0,
            legalImport: 0,
            proximity: 0,
            illegalImport: 0,
            connection: 0,
            livestockDensity: 0
          };
          const connectionScores = calculateConnectionScoresPerPathway(countryConnections);

          // For each disease, calculate pathway contributions and total risk as sum of those
          const diseasePathwayScores: any = {};
          diseases.forEach(disease => {
            // DiseaseStatus and MitigationMeasure keys
            const diseaseStatusKey = `d${disease}` as keyof DiseaseStatus;
            const mitigationMeasureKey = `m${disease}` as keyof MitigationMeasure;
            const ds = diseaseStatusData[countryId]?.[diseaseStatusKey] ?? 0;
            const mm = mitigationMeasuresData[countryId]?.[mitigationMeasureKey] ?? 0;

            // If disease status is 0, all pathways are 0
            if (ds === 0) {
              diseasePathwayScores[disease] = {
                airborne: 0,
                vectorborne: 0,
                wildAnimals: 0,
                animalProduct: 0,
                liveAnimal: 0,
                fomite: 0
              };
              return;
            }

            const baseRisk = ds + (4 - mm);
            diseasePathwayScores[disease] = {
              airborne: baseRisk * (PATHWAYS_EFFECTIVENESS.airborne[disease as keyof typeof PATHWAYS_EFFECTIVENESS.airborne] * connectionScores.airborne),
              vectorborne: baseRisk * (PATHWAYS_EFFECTIVENESS.vectorborne[disease as keyof typeof PATHWAYS_EFFECTIVENESS.vectorborne] * connectionScores.vectorborne),
              wildAnimals: baseRisk * (PATHWAYS_EFFECTIVENESS.wildAnimals[disease as keyof typeof PATHWAYS_EFFECTIVENESS.wildAnimals] * connectionScores.wildAnimals),
              animalProduct: baseRisk * (PATHWAYS_EFFECTIVENESS.animalProduct[disease as keyof typeof PATHWAYS_EFFECTIVENESS.animalProduct] * connectionScores.animalProduct),
              liveAnimal: baseRisk * (PATHWAYS_EFFECTIVENESS.liveAnimal[disease as keyof typeof PATHWAYS_EFFECTIVENESS.liveAnimal] * connectionScores.liveAnimal),
              fomite: baseRisk * (PATHWAYS_EFFECTIVENESS.fomite[disease as keyof typeof PATHWAYS_EFFECTIVENESS.fomite] * connectionScores.fomite)
            };
          });

          // For the selected disease, the sum of pathway contributions is the risk score
          // For the "scores" field (used for overall bar), use the sum for each pathway across all diseases
          const overallScores = {
            airborne: 0,
            vectorborne: 0,
            wildAnimals: 0,
            animalProduct: 0,
            liveAnimal: 0,
            fomite: 0
          };
          diseases.forEach(disease => {
            overallScores.airborne += diseasePathwayScores[disease].airborne;
            overallScores.vectorborne += diseasePathwayScores[disease].vectorborne;
            overallScores.wildAnimals += diseasePathwayScores[disease].wildAnimals;
            overallScores.animalProduct += diseasePathwayScores[disease].animalProduct;
            overallScores.liveAnimal += diseasePathwayScores[disease].liveAnimal;
            overallScores.fomite += diseasePathwayScores[disease].fomite;
          });

          return {
            name_un: country.name_un,
            scores: overallScores,
            diseaseScores: diseasePathwayScores
          };
        });
        setPathwayScores(scoresByPathway);
        
      } catch (err: any) {
        console.error('Error loading results data:', err);
        setError(`Failed to load results: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [location, diseases, pathwaysData]);
  
  // Format risk scores for the map visualization
  const formatRiskScoresForMap = (maxRiskScore: number) => {
    const countryRiskScores: Record<string, Record<string, number>> = {};
    const normalizationFactor = maxRiskScore > 0 ? maxRiskScore / 3 : 1;
    
    // Normalize and collect scores
    riskScores.forEach(score => {
      if (!countryRiskScores[score.sourceCountry]) {
        countryRiskScores[score.sourceCountry] = {};
      }
      const normalizedScore = Math.min(3, score.riskScore / normalizationFactor);
      countryRiskScores[score.sourceCountry][score.disease] = normalizedScore;
    });
    
    return sourceCountries.map(country => {
      const scores = countryRiskScores[country.name_un] || {};
      
      // Calculate overall risk score (average across diseases)
      let overallScore = 0;
      let count = 0;
      
      diseases.forEach(disease => {
        if (scores[disease] !== undefined) {
          overallScore += scores[disease];
          count++;
        }
      });
      
      const riskScores: { 
        FMD: number; 
        PPR: number; 
        LSD: number; 
        RVF: number; 
        SPGP: number; 
        overall: number; 
      } = {
        FMD: scores.FMD || 0,
        PPR: scores.PPR || 0,
        LSD: scores.LSD || 0,
        RVF: scores.RVF || 0,
        SPGP: scores.SPGP || 0,
        overall: 0
      };
      
      if (count > 0) {
        riskScores.overall = Math.round((overallScore / count) * 10) / 10;
      }
      
      return {
        id: country.id,
        name_un: country.name_un,
        iso3: country.iso3,
        riskScores
      };
    });
  };

  // Get color based on normalized risk level (same scale as map)
  const getCellColor = (rawScore: number, maxRiskScore: number): string => {
    return getRiskBgClass(normalizeRiskScore(rawScore, maxRiskScore));
  };

  const getCellTextColor = (rawScore: number, maxRiskScore: number): string => {
    return getRiskTextClass(normalizeRiskScore(rawScore, maxRiskScore));
  };

  // Handle going back to previous step (Connections page)
  const handlePrevious = () => {
    const { 
      connections, 
      selectedCountries, 
      receiverCountryName,
      receiverIsCustom,
      receiverMode,
      customReceiverName,
      receiverCountry: stateReceiverCountry,
      diseaseStatusData,
      mitigationMeasuresData,
      sourceCountriesData
    } = location.state || {};
    
    // Navigate back to risk scores page with the same data, but set to the Connections step (step 3)
    navigate('/rmt/risk-scores', {
      state: {
        connections,
        selectedCountries,
        receiverCountryName,
        receiverIsCustom,
        receiverMode,
        customReceiverName,
        receiverCountry: stateReceiverCountry,
        diseaseStatusData,
        mitigationMeasuresData,
        sourceCountriesData,
        currentStep: 3 // Set to Connections step
      }
    });
  };

  // Handle starting a new assessment (clear all stored data)
  const handleStartNewAssessment = () => {
    sessionStorage.removeItem('rmtState');
    navigate('/rmt/risk-scores', { replace: true });
  };

  // Human-readable headers for the connections export/table
  const connectionColumns: Array<{ key: keyof Connections; label: string }> = [
    { key: 'liveAnimalContact', label: 'Live animal contact/trade' },
    { key: 'legalImport', label: 'Legal import of animal products' },
    { key: 'proximity', label: 'Geographic proximity' },
    { key: 'illegalImport', label: 'Illegal import of animal products' },
    { key: 'connection', label: 'Connection (land/air/sea)' },
    { key: 'livestockDensity', label: 'Livestock density near border' },
  ];

  const pathwayColumns: Array<{ key: keyof PathwayScores['scores']; label: string }> = [
    { key: 'airborne', label: 'Airborne' },
    { key: 'vectorborne', label: 'Vector-borne' },
    { key: 'wildAnimals', label: 'Wild Animals' },
    { key: 'animalProduct', label: 'Animal Product' },
    { key: 'liveAnimal', label: 'Live Animal' },
    { key: 'fomite', label: 'Fomite' },
  ];

  // Build and download a single Excel workbook with one sheet per table.
  // Everything is exported regardless of which sections are expanded.
  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Risk scores (outputs)
    const riskRows = sourceCountries.map((country) => {
      const scoresByDisease = riskScores
        .filter((s) => s.sourceCountry === country.name_un)
        .reduce((acc, s) => {
          acc[s.disease] = s.riskScore;
          return acc;
        }, {} as Record<string, number>);
      const row: Record<string, any> = { 'Source Country': country.name_un };
      diseases.forEach((d) => {
        row[d] = Math.round(scoresByDisease[d] || 0);
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riskRows), 'Risk Scores');

    // 2. Risk pathway contributions (outputs)
    const pathwayRows = pathwayScores.map((p) => {
      const row: Record<string, any> = { 'Source Country': p.name_un };
      pathwayColumns.forEach(({ key, label }) => {
        row[label] = Math.round((p.scores[key] || 0) * 100) / 100;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pathwayRows), 'Pathway Contributions');

    // 3. Disease status (inputs)
    const diseaseRows = diseaseStatus.map((d) => {
      const row: Record<string, any> = { 'Source Country': d.name_un };
      diseases.forEach((dis) => {
        row[dis] = d[dis] ?? 0;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diseaseRows), 'Disease Status');

    // 4. Mitigation measures (inputs)
    const mitigationRows = sourceCountries.map((country) => {
      const mm = mitigationMeasures[country.id];
      const row: Record<string, any> = { 'Source Country': country.name_un };
      diseases.forEach((d) => {
        const val = mm?.[`m${d}` as keyof MitigationMeasure];
        row[d] = val ?? 'N/A';
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mitigationRows), 'Mitigation Measures');

    // 5. Connections (inputs)
    const connectionRows = sourceCountries.map((country) => {
      const conn = connectionsByCountry[country.id];
      const row: Record<string, any> = { 'Source Country': country.name_un };
      connectionColumns.forEach(({ key, label }) => {
        row[label] = conn?.[key] ?? 0;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(connectionRows), 'Connections');

    const safeName = (receiverCountry || 'assessment').replace(/[^a-z0-9]+/gi, '_');
    XLSX.writeFile(wb, `RMT_Risk_Assessment_${safeName}.xlsx`);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#15736d]"></div>
        </div>
        <p className="text-center mt-4 text-gray-600">Loading results...</p>
      </div>
    );
  }

  const maxRiskScore = getMaxRiskScore(riskScores);
  const mapData = formatRiskScoresForMap(maxRiskScore);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4">
        Risk Assessment Results for {receiverCountry}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
          <button 
            onClick={handleStartNewAssessment}
            className="underline hover:text-red-800"
          >
            Return to start
          </button>
        </div>
      )}

      {/* ============================= OUTPUTS ============================= */}
      <CollapsibleSection title="1 — Outputs" variant="main" defaultOpen={true}>
        {/* Map visualization */}
        <CollapsibleSection
          title="Risk Map Visualization"
          defaultOpen={true}
          description={
            `This map shows the overall risk level for each source country relative to ${receiverCountry}. Countries with a similar level of risk are colored with the same color, on a scale from green (lower risk score) to red (higher risk score).` +
            (receiverIsCustom
              ? ' No target area is shown on the map because a custom evaluation name was used.'
              : ' The target country is highlighted in gray.')
          }
        >
          <div className="mb-3">
            <label className="mr-2 font-medium text-sm sm:text-base">Select Disease: </label>
            <select 
              value={selectedDisease} 
              onChange={(e) => setSelectedDisease(e.target.value)}
              className="border rounded px-2 py-1 bg-white min-w-[120px] sm:min-w-[150px] text-sm sm:text-base"
              style={{ 
                paddingRight: '2rem',
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.7rem center',
                backgroundSize: '0.65em',
                appearance: 'none'
              }}
            >
              {diseases.map(disease => (
                <option key={disease} value={disease}>{disease}</option>
              ))}
            </select>
          </div>
          <RiskScoreMap 
            countryData={mapData}
            targetCountryName={receiverCountry}
            targetCountryIso3={receiverIsCustom ? undefined : receiverCountryInfo?.iso3}
            selectedDisease={selectedDisease}
          />
        </CollapsibleSection>

        {/* Risk scores table */}
        <CollapsibleSection
          title="Risk Scores Summary"
          defaultOpen={true}
          description="This table presents the risk scores for each disease across all source countries. Higher scores indicate a higher risk of entry of the pathogen. The scores should be used to compare the risk of entry of a pathogen among source countries, but should not be compared among different diseases."
        >
          <div className="rmt-table-container rmt-table-scroll-y">
            <table className="w-full rmt-table min-w-[600px]">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Source Country</th>
                  {diseases.map(disease => (
                    <th key={disease} className="px-4 py-2 text-center">{disease}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceCountries.map(country => {
                  const countryScores = riskScores
                    .filter(score => score.sourceCountry === country.name_un)
                    .reduce((acc, score) => {
                      acc[score.disease] = score.riskScore;
                      return acc;
                    }, {} as Record<string, number>);
                  
                  return (
                    <tr key={country.id} className="border-b">
                      <td className="px-4 py-2 font-medium">{country.name_un}</td>
                      {diseases.map(disease => {
                        const score = countryScores[disease] || 0;
                        const displayScore = Math.round(score);
                        return (
                          <td 
                            key={`${country.id}-${disease}`} 
                            className="px-4 py-2 text-center"
                          >
                            <span className={`inline-block w-8 h-8 rounded-full ${getCellColor(score, maxRiskScore)} ${getCellTextColor(score, maxRiskScore)} text-center leading-8 font-semibold`}>
                              {displayScore}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Enhanced Risk Pathway Chart */}
        <CollapsibleSection
          title="Risk Pathway Contributions"
          defaultOpen={true}
          description="This chart shows the contribution of each pathway to the overall risk for each source country. Use the disease selector to view pathway contributions for a specific disease."
        >
          <SimpleBarChart 
            pathwayScores={pathwayScores} 
          />
        </CollapsibleSection>
      </CollapsibleSection>

      {/* ============================= INPUTS ============================= */}
      <CollapsibleSection title="2 — Inputs" variant="main" defaultOpen={true}>
        {/* Pathway Effectiveness Radar */}
        <CollapsibleSection
          title="Pathway Effectiveness by Disease"
          defaultOpen={true}
          description="This radar chart shows how effective each pathway is for the transmission of each disease. A higher score indicates the pathway is more effective for disease transmission."
        >
          <PathwayEffectivenessRadar 
            pathwaysData={pathwaysData} 
          />
        </CollapsibleSection>

        {/* Disease Status */}
        <CollapsibleSection
          title="Disease Status by Country"
          defaultOpen={true}
          description="Disease status score for each disease across all source countries. Darker colors indicate higher disease prevalence."
        >
          <SimpleHeatmap 
            diseaseStatusData={diseaseStatus} 
          />
        </CollapsibleSection>

        {/* Mitigation Measures (read-only) */}
        <CollapsibleSection
          title="Mitigation Measures"
          defaultOpen={true}
          description="Effectiveness of mitigation measures in each source country per disease (0 = uncontrolled risk, 4 = all risks mitigated)."
        >
          <div className="rmt-table-container rmt-table-scroll-y">
            <table className="w-full rmt-table min-w-[600px]">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Source Country</th>
                  {diseases.map(disease => (
                    <th key={disease} className="px-4 py-2 text-center">{disease}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceCountries.map(country => {
                  const mm = mitigationMeasures[country.id];
                  return (
                    <tr key={country.id} className="border-b">
                      <td className="px-4 py-2 font-medium">{country.name_un}</td>
                      {diseases.map(disease => {
                        const val = mm?.[`m${disease}` as keyof MitigationMeasure];
                        return (
                          <td key={`${country.id}-m-${disease}`} className="px-4 py-2 text-center">
                            {val === null || val === undefined ? 'N/A' : val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Connections (read-only) */}
        <CollapsibleSection
          title="Connections"
          defaultOpen={true}
          description={`Connection scores between ${receiverCountry} and each source country, per pathway component (0 = no connection, 3 = highly connected; livestock density is 0 or 1).`}
        >
          <div className="rmt-table-container rmt-table-scroll-y">
            <table className="w-full rmt-table min-w-[700px]">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Source Country</th>
                  {connectionColumns.map(col => (
                    <th key={col.key} className="px-4 py-2 text-center">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceCountries.map(country => {
                  const conn = connectionsByCountry[country.id];
                  return (
                    <tr key={country.id} className="border-b">
                      <td className="px-4 py-2 font-medium">{country.name_un}</td>
                      {connectionColumns.map(col => {
                        const val = conn?.[col.key];
                        return (
                          <td key={`${country.id}-c-${col.key}`} className="px-4 py-2 text-center">
                            {val === null || val === undefined ? '-' : val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      </CollapsibleSection>

      {/* Actions */}
      <div className="rmt-no-print flex flex-col sm:flex-row justify-between mt-10 gap-4">
        <button 
          onClick={handleStartNewAssessment}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors text-center"
        >
          Start New Assessment
        </button>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handlePrevious}
            className="px-4 py-2 font-semibold text-[#015039] bg-transparent border-2 border-[#015039] rounded transition-all duration-300 hover:bg-[#15736d] hover:text-white"
          >
            Previous
          </button>
          <button
            onClick={handleDownloadExcel}
            className="px-4 py-2 bg-[#15736d] text-white hover:bg-[#0f5a54] rounded transition-colors"
          >
            Download Excel
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#15736d] text-white hover:bg-[#0f5a54] rounded transition-colors"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default RMTResults;
