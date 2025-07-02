import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { calculateRiskScores } from '../utils/calculateRiskScores';

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

interface Connections {
  liveAnimalContact: number;
  legalImport: number;
  proximity: number;
  illegalImport: number;
  connection: number;
  livestockDensity: number;
}

const RMTResults: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [receiverCountry, setReceiverCountry] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const calculateResults = async () => {
      try {
        setLoading(true);
        
        // Get data from location state
        const { connections, selectedCountries, receiverCountryName } = location.state || {};
        
        if (!connections || !selectedCountries || !Array.isArray(selectedCountries)) {
          setError('Missing required data. Please go back and complete the previous steps.');
          setLoading(false);
          return;
        }
        
        setReceiverCountry(receiverCountryName || 'Unknown Country');
        
        // Fetch disease status and mitigation measures for each selected country
        const diseaseStatusData: Record<number, DiseaseStatus> = {};
        const mitigationMeasuresData: Record<number, MitigationMeasure> = {};
        
        // Create promises for all API calls
        const apiCalls = selectedCountries.map((countryId: number) => Promise.all([
          apiService.rmt.getDiseaseStatusByCountry(countryId),
          apiService.rmt.getMitigationMeasuresByCountry(countryId)
        ]));
        
        // Wait for all API calls to complete
        const results = await Promise.all(apiCalls);
        
        // Process results
        results.forEach((result: any[], index: number) => {
          const countryId = selectedCountries[index];
          const [diseaseStatus, mitigationMeasures] = result;
          
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
        
        // Fetch countries data to get country names
        const countriesResponse = await apiService.countries.getAll();
        const sourceCountries = selectedCountries.map(countryId => {
          const country = countriesResponse.data.find((c: Country) => c.id === countryId);
          return {
            id: countryId,
            name_un: country ? country.name_un : `Country ID ${countryId}`
          };
        });
        
        // Calculate risk scores
        const connectionInputs: Connections = {
          liveAnimalContact: parseInt(connections.liveAnimalContact) || 0,
          legalImport: parseInt(connections.legalImport) || 0,
          proximity: parseInt(connections.proximity) || 0,
          illegalImport: parseInt(connections.illegalImport) || 0,
          connection: parseInt(connections.connection) || 0,
          livestockDensity: parseInt(connections.livestockDensity) || 0
        };
        
        const calculatedScores = calculateRiskScores({
          connections: connectionInputs,
          diseaseStatus: diseaseStatusData,
          mitigationMeasures: mitigationMeasuresData,
          sourceCountries
        });
        
        setRiskScores(calculatedScores);
      } catch (err: any) {
        console.error('Error calculating risk scores:', err);
        setError(err.message || 'Failed to calculate risk scores');
      } finally {
        setLoading(false);
      }
    };
    
    calculateResults();
  }, [location.state]);

  const getRiskColor = (score: number): string => {
    // Match Vue app's getResultsClass function exactly
    if (score === 0) {
      return 'score-ok';
    } else if (score < 31.0) {
      return 'score-warning1';
    } else if (score < 71.0) {
      return 'score-warning2';
    } else {
      return 'score-warning4';
    }
  };

  // We're keeping this function for reference but it's not used in the new table format
  // const getRiskLevel = (score: number): string => {
  //   if (score >= 4.5) return 'Very High';
  //   if (score >= 3.5) return 'High';
  //   if (score >= 2.5) return 'Medium';
  //   if (score >= 1.5) return 'Low';
  //   return 'Very Low';
  // };
  
  // Transform the risk scores data to match the Vue app's format (countries in rows, diseases in columns)
  const transformRiskScores = () => {
    // Log risk scores to debug zero values
    console.log('Risk scores:', JSON.stringify(riskScores));
    
    type CountryScores = {
      name_un: string;
      FMD?: number;
      PPR?: number;
      LSD?: number;
      RVF?: number;
      SPGP?: number;
    };
    
    const countryMap: Record<string, CountryScores> = {};
    
    // First, extract all unique countries
    const uniqueCountriesSet = new Set(riskScores.map(score => score.sourceCountry));
    const uniqueCountries = Array.from(uniqueCountriesSet);
    
    // Initialize the map with all countries and set all disease scores to 0
    uniqueCountries.forEach(country => {
      countryMap[country] = { 
        name_un: country,
        FMD: 0,
        PPR: 0,
        LSD: 0,
        RVF: 0,
        SPGP: 0
      };
    });
    
    // Now populate with actual scores
    riskScores.forEach(score => {
      
      // Ensure all scores including zeros are explicitly assigned
      if (score.disease === 'FMD') countryMap[score.sourceCountry].FMD = score.riskScore;
      else if (score.disease === 'PPR') countryMap[score.sourceCountry].PPR = score.riskScore;
      else if (score.disease === 'LSD') countryMap[score.sourceCountry].LSD = score.riskScore;
      else if (score.disease === 'RVF') countryMap[score.sourceCountry].RVF = score.riskScore;
      else if (score.disease === 'SPGP') countryMap[score.sourceCountry].SPGP = score.riskScore;
    });
    
    return Object.values(countryMap);
  };
  
  // No need for a separate format function as we're using toFixed directly in the JSX

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mr-4"></div>
        <div className="text-xl">Calculating risk scores...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Results
          {receiverCountry && <span className="text-2xl ml-2 text-gray-600">for {receiverCountry}</span>}
        </h1>
        <Link 
          to="/rmt/risk-scores"
          className="nav-btn hover:bg-green-dark border-2 border-green-greenMain px-4 py-2 rounded m-2 text-green-greenMain hover:text-white transition duration-300"
        >
          Back to Assessment
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {riskScores.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 max-w-lg mx-auto">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  No risk assessment data available. Please complete the risk assessment first.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <Link 
              to="/rmt/risk-scores"
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Start Risk Assessment
            </Link>
          </div>
        </div>
      ) : (
        <>

          {/* Results Table - Formatted like the Vue app with countries in rows and diseases in columns */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Risk Scores by Country and Disease</h2>
              <p className="text-gray-600 text-sm mt-1">
                These scores are for comparison between one pathway and another as a generic risk assessment tool. The absolute value is irrelevant. The higher the score, the higher the risk of incursion. These scores take into account the disease prevalence in the source country, the mitigation actions, the possible pathways of incursion and the connection between the source and target countries.
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-white text-center text-sm">
                <thead className="text-white">
                  <tr className="text-sm font-medium whitespace-nowrap" style={{ backgroundColor: '#15736d' }}>
                    <th className="py-2 border border-white text-wrap">
                      Country
                    </th>
                    <th className="py-2 border border-white text-wrap">
                      FMD
                    </th>
                    <th className="py-2 border border-white text-wrap">
                      PPR
                    </th>
                    <th className="py-2 border border-white text-wrap">
                      LSD
                    </th>
                    <th className="py-2 border border-white text-wrap">
                      RVF
                    </th>
                    <th className="py-2 border border-white text-wrap">
                      SPGP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transformRiskScores().map((country, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-2">
                        <p>{country.name_un}</p>
                      </td>
                      {['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'].map((disease) => {
                        const score = country[disease as keyof typeof country] as number | undefined;
                        return (
                          <td key={`${country.name_un}-${disease}`} className="px-2">
                            <div style={{ pageBreakInside: 'avoid' }}>
                              {score !== undefined && score !== null ? (
                                <p className={`py-2 px-4 my-1 mx-3 rounded ${getRiskColor(score)}`}>
                                  {score === 0 ? '0' : (score % 1 === 0 ? score.toString() : score.toFixed(1))}
                                </p>
                              ) : (
                                <p className="py-2 px-4 my-1 mx-3">N/A</p>
                              )}
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

          {/* We're removing the explanation boxes to match the Vue version */}
        </>
      )}
    </div>
  );
};

export default RMTResults;
