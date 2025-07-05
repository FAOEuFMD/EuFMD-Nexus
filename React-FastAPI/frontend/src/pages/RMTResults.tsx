import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { calculateRiskScores } from '../utils/calculateRiskScores';

// Import map and chart components
// import RiskScoreMap from '../components/RMT/maps/RiskScoreMap'; // Commented out as it's not currently in use
import DebugRiskMap from '../components/RMT/maps/DebugRiskMap';
import DiseaseStatusHeatmap from '../components/RMT/charts/DiseaseStatusHeatmap';
import PathwayEffectivenessRadar from '../components/RMT/charts/PathwayEffectivenessRadar';
import EnhancedRiskPathwayChart from '../components/RMT/charts/RiskPathwayChart';

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

// Removed unused interface

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
    { pathway: "Airborne", FMD: 2, PPR: 0, LSD: 1, RVF: 0, SPGP: 1 },
    { pathway: "Vector-borne", FMD: 0, PPR: 0, LSD: 3, RVF: 3, SPGP: 2 },
    { pathway: "Wild Animals", FMD: 1, PPR: 2, LSD: 0, RVF: 2, SPGP: 0 },
    { pathway: "Animal Product", FMD: 2, PPR: 1, LSD: 1, RVF: 1, SPGP: 1 },
    { pathway: "Live Animal", FMD: 3, PPR: 3, LSD: 1, RVF: 3, SPGP: 3 },
    { pathway: "Fomite", FMD: 2, PPR: 1, LSD: 1, RVF: 0, SPGP: 1 },
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
          console.log("Using data from state");
          diseaseStatusData = stateDisease;
          mitigationMeasuresData = stateMitigation;
          countriesData = sourceCountriesData;
        }
        // Otherwise fetch from API
        else {
          console.log("Fetching data from API");
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
        
        // Calculate risk scores
        const calculatedScores = calculateRiskScores({
          diseaseStatus: diseaseStatusData,
          mitigationMeasures: mitigationMeasuresData,
          connections,
          sourceCountries: countriesData
        });
        
        console.log('---------- DEBUG RMT RESULTS ----------');
        console.log('Calculated risk scores:', calculatedScores);
        console.log('Disease status data:', diseaseStatusData);
        console.log('Mitigation measures data:', mitigationMeasuresData); 
        console.log('Source countries data:', countriesData);
        console.log('Connections data:', connections);
        console.log('-------------------------------------');
        console.log('Disease status data:', diseaseStatusData);
        console.log('Mitigation measures data:', mitigationMeasuresData);
        console.log('Source countries data:', countriesData);
        
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
    
    riskScores.forEach(score => {
      if (!countryRiskScores[score.sourceCountry]) {
        countryRiskScores[score.sourceCountry] = {};
      }
      countryRiskScores[score.sourceCountry][score.disease] = score.riskScore;
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
      <h2 className="text-2xl font-semibold mb-4">
        Risk Assessment Results for {receiverCountry}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
          <Link to="/rmt" className="underline hover:text-red-800">Return to start</Link>
        </div>
      )}

      {/* Map visualization */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Risk Map Visualization</h3>
        <p className="text-gray-600 mb-4">
          This map shows the overall risk level for each source country relative to {receiverCountry}.
          Countries are colored according to their risk level: green (low risk), yellow (low-medium risk),
          orange (medium-high risk), and red (high risk). The target country ({receiverCountry}) is 
          highlighted in gray.
        </p>
        <div className="mb-3">
          <label className="mr-2 font-medium">Select Disease: </label>
          <select 
            value={selectedDisease} 
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="border rounded px-2 py-1 bg-white"
          >
            {diseases.map(disease => (
              <option key={disease} value={disease}>{disease}</option>
            ))}
          </select>
        </div>
        {/* Use the debug map for now to ensure we at least see some data */}
        <DebugRiskMap 
          countryData={mapData}
          targetCountryName={receiverCountry}
          selectedDisease={selectedDisease}
        />
        {/* Original map commented out for debugging
        <RiskScoreMap 
          countryData={mapData}
          targetCountryName={receiverCountry}
          selectedDisease={selectedDisease}
        />
        */}
      </div>

      {/* Risk scores table */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Risk Scores Summary</h3>
        <p className="text-gray-600 mb-4">
          This table presents the risk scores for each disease across all source countries.
          Higher scores (orange to red) indicate higher risk of disease introduction.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse rmt-table">
            <thead>
              <tr className="bg-[#15736d] text-white">
                <th className="px-4 py-2 text-left">Source Country</th>
                {diseases.map(disease => (
                  <th key={disease} className="px-4 py-2 text-center">{disease}</th>
                ))}
                <th className="px-4 py-2 text-center">Average</th>
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
                
                // Calculate average score
                const totalScore = diseases.reduce((sum, disease) => sum + (countryScores[disease] || 0), 0);
                const averageScore = Math.round((totalScore / diseases.length) * 10) / 10;
                
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
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block w-8 h-8 rounded-full ${getRiskColor(averageScore)} ${getTextColor(averageScore)} text-center leading-8`}>
                        {averageScore}
                      </span>
                    </td>
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
        <DiseaseStatusHeatmap diseaseStatusData={diseaseStatus} />
      </div>

      {/* Pathway Effectiveness Radar */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Pathway Effectiveness by Disease</h3>
        <p className="text-gray-600 mb-4">
          This radar chart shows how effective each pathway is for the transmission of each disease.
          A higher score indicates the pathway is more effective for disease transmission.
        </p>
        <PathwayEffectivenessRadar pathwaysData={pathwaysData} />
      </div>

      {/* Enhanced Risk Pathway Chart */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Risk Pathway Contributions</h3>
        <p className="text-gray-600 mb-4">
          This chart shows the contribution of each pathway to the overall risk for each source country.
          Use the disease selector to view pathway contributions for a specific disease.
        </p>
        <EnhancedRiskPathwayChart pathwayScores={pathwayScores} />
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-10">
        <Link 
          to="/rmt" 
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
        >
          Start New Assessment
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#15736d] text-white hover:bg-[#0f5a54] rounded transition-colors"
        >
          Print Results
        </button>
      </div>
    </div>
  );
};

export default RMTResults;
