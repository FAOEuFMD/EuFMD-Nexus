import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { calculateRiskScores, Connections } from '../utils/calculateRiskScores';

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

const RMTResults: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Results data
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [sourceCountries, setSourceCountries] = useState<Country[]>([]);
  const [receiverCountry, setReceiverCountry] = useState<string>('');
  
  // Data for visualization
  const [diseaseStatus, setDiseaseStatus] = useState<Array<{ name_un: string; [key: string]: any }>>([]);
  const [pathwayScores, setPathwayScores] = useState<PathwayScores[]>([]);
  
  // Disease names
  const diseases = useMemo(() => ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'], []);
  const [selectedDisease, setSelectedDisease] = useState<string>('FMD');

  // Pathway data
  const pathwaysData = [
    { pathway: "Airborne", FMD: 2, PPR: 0, LSD: 1, RVF: 1, SPGP: 2 },
    { pathway: "Vector-borne", FMD: 0, PPR: 0, LSD: 3, RVF: 3, SPGP: 1 },
    { pathway: "Wild Animals", FMD: 1, PPR: 2, LSD: 0, RVF: 1, SPGP: 0 },
    { pathway: "Animal Product", FMD: 2, PPR: 0, LSD: 1, RVF: 2, SPGP: 1 },
    { pathway: "Live Animal", FMD: 3, PPR: 3, LSD: 2, RVF: 3, SPGP: 3 },
    { pathway: "Fomite", FMD: 2, PPR: 2, LSD: 1, RVF: 0, SPGP: 2 },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get data from location state
        const { 
          connections, 
          selectedCountries, 
          receiverCountryName,
          diseaseStatusData: stateDisease,
          mitigationMeasuresData: stateMitigation,
          sourceCountriesData
        } = location.state || {};
        
        if (!connections || !selectedCountries || !Array.isArray(selectedCountries)) {
          setError('Missing required data. Please go back and complete the previous steps.');
          setLoading(false);
          return;
        }
        
        setReceiverCountry(receiverCountryName || 'Unknown Country');
        
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
        
        setSourceCountries(countriesData);
        
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
        
        // Calculate scores per pathway for the risk pathway charts
        const scoresByPathway = countriesData.map(country => {
          const countryId = country.id;
          const countryScores = calculatedScores.filter(score => score.sourceCountryId === countryId);
          
          // Group scores by disease and then by pathway
          const diseasePathwayScores: any = {};
          diseases.forEach(disease => {
            diseasePathwayScores[disease] = {
              airborne: 0,
              vectorborne: 0,
              wildAnimals: 0,
              animalProduct: 0,
              liveAnimal: 0,
              fomite: 0
            };
          });
          
          countryScores.forEach(score => {
            // Calculate per-pathway scores based on connection strength and pathway effectiveness
            if (score.riskScore > 0) {
              diseasePathwayScores[score.disease].airborne = Math.round(score.riskScore * 0.2);
              diseasePathwayScores[score.disease].vectorborne = Math.round(score.riskScore * 0.15);
              diseasePathwayScores[score.disease].wildAnimals = Math.round(score.riskScore * 0.1);
              diseasePathwayScores[score.disease].animalProduct = Math.round(score.riskScore * 0.2);
              diseasePathwayScores[score.disease].liveAnimal = Math.round(score.riskScore * 0.25);
              diseasePathwayScores[score.disease].fomite = Math.round(score.riskScore * 0.1);
            }
          });
          
          // Calculate overall scores (average across diseases)
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
          
          Object.keys(overallScores).forEach(key => {
            overallScores[key as keyof typeof overallScores] = 
              Math.round((overallScores[key as keyof typeof overallScores] / diseases.length) * 10) / 10;
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
  }, [location, diseases]);
  
  // Format risk scores for the map visualization
  const formatRiskScoresForMap = () => {
    const countryRiskScores: Record<string, Record<string, number>> = {};
    
    // Find maximum risk score for normalization
    let maxRiskScore = 0;
    riskScores.forEach(score => {
      if (score.riskScore > maxRiskScore) {
        maxRiskScore = score.riskScore;
      }
    });
    
    // Use a safe normalization factor (ensure we don't divide by zero)
    const normalizationFactor = maxRiskScore > 0 ? maxRiskScore / 3 : 1;
    
    // Normalize and collect scores
    riskScores.forEach(score => {
      if (!countryRiskScores[score.sourceCountry]) {
        countryRiskScores[score.sourceCountry] = {};
      }
      // Normalize score to 0-3 range
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
        riskScores
      };
    });
  };

  // Get color based on risk level
  const getRiskColor = (score: number): string => {
    if (score === 0) return 'bg-green-500'; // Low risk
    if (score <= 1) return 'bg-yellow-500'; // Low-medium risk
    if (score <= 2) return 'bg-orange-500'; // Medium-high risk
    return 'bg-red-500'; // High risk
  };

  // Get text color for risk score cells
  const getTextColor = (score: number): string => {
    if (score > 2) return 'text-white'; // White text on dark backgrounds
    return 'text-gray-900'; // Dark text on light backgrounds
  };

  // Handle going back to previous step (Connections page)
  const handlePrevious = () => {
    const { 
      connections, 
      selectedCountries, 
      receiverCountryName,
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
        diseaseStatusData,
        mitigationMeasuresData,
        sourceCountriesData,
        currentStep: 3 // Set to Connections step
      }
    });
  };

  // Handle starting a new assessment (clear all stored data)
  const handleStartNewAssessment = () => {
    // Clear stored RMT state
    sessionStorage.removeItem('rmtState');
    // Navigate to the main RMT page
    navigate('/rmt');
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

  const mapData = formatRiskScoresForMap();

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

      {/* Map visualization */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Risk Map Visualization</h3>
        <p className="text-gray-600 mb-4">
          This map shows the overall risk level for each source country relative to {receiverCountry}. Countries with a similar level of risk are colored with the same color, on a scale from green (lower risk score) to red (higher risk score). The target country is highlighted in gray.
        </p>
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
          selectedDisease={selectedDisease}
        />
      </div>

      {/* Risk scores table */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Risk Scores Summary</h3>
        <p className="text-gray-600 mb-4">
          This table presents the risk scores for each disease across all source countries. Higher scores indicate a higher risk of entry of the pathogen. The scores should be used to compare the risk of entry of a pathogen among source countries, but should not be compared among different diseases.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse rmt-table min-w-[600px]">
            <thead>
              <tr className="bg-[#15736d] text-white">
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
                      return (
                        <td 
                          key={`${country.id}-${disease}`} 
                          className="px-4 py-2 text-center"
                        >
                          <span className={`inline-block w-8 h-8 rounded-full ${getRiskColor(score)} ${getTextColor(score)} text-center leading-8`}>
                            {score}
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
      </div>

      {/* Disease Status Heatmap */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Disease Status by Country</h3>
        <p className="text-gray-600 mb-4">
          This heatmap shows the disease status for each disease across all source countries.
          Darker colors indicate higher disease prevalence.
        </p>
        <div className="flex justify-center">
          <div className="w-full">
            <SimpleHeatmap 
              diseaseStatusData={diseaseStatus} 
            />
          </div>
        </div>
      </div>

      {/* Pathway Effectiveness Radar */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Pathway Effectiveness by Disease</h3>
        <p className="text-gray-600 mb-4">
          This radar chart shows how effective each pathway is for the transmission of each disease.
          A higher score indicates the pathway is more effective for disease transmission.
        </p>
        <PathwayEffectivenessRadar 
          pathwaysData={pathwaysData} 
        />
      </div>

      {/* Enhanced Risk Pathway Chart */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Risk Pathway Contributions</h3>
        <p className="text-gray-600 mb-4">
          This chart shows the contribution of each pathway to the overall risk for each source country.
          Use the disease selector to view pathway contributions for a specific disease.
        </p>
        <SimpleBarChart 
          pathwayScores={pathwayScores} 
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between mt-10 gap-4">
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
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#15736d] text-white hover:bg-[#0f5a54] rounded transition-colors"
          >
            Print Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default RMTResults;
