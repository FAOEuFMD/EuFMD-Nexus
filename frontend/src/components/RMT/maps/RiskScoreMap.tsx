import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Feature, Geometry } from 'geojson';
import fixLeafletIcon from '../../../utils/maps/fixLeafletIcon';

interface RiskScoreMapProps {
  countryData: Array<{
    id: number;
    name_un: string;
    riskScores: {
      FMD: number;
      PPR: number;
      LSD: number;
      RVF: number;
      SPGP: number;
      overall?: number;
    };
  }>;
  targetCountryName: string;
  selectedDisease?: string; // Optional: to filter the map by specific disease
}

const RiskScoreMap: React.FC<RiskScoreMapProps> = ({ 
  countryData, 
  targetCountryName,
  selectedDisease = 'overall' 
}) => {
  const [countriesGeoJSON, setCountriesGeoJSON] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // Fix the Leaflet icon issue
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  // Calculate average risk score across diseases for a country
  const calculateAverageRisk = (country: any): number => {
    if (!country.riskScores) return 0;
    
    if (selectedDisease !== 'overall') {
      return country.riskScores[selectedDisease] || 0;
    }
    
    const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];
    const scores = diseases.map(d => country.riskScores[d] || 0);
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  };

  // Color function based on risk score
  const getRiskColor = (score: number): string => {
    // Normalize score if it's outside the expected 0-3 range
    const normalizedScore = score > 3 ? Math.min(3, score / Math.ceil(score / 3)) : score;
    
    if (normalizedScore === 0) return '#4CAF50'; // Low risk (green)
    if (normalizedScore <= 1) return '#FFEB3B'; // Low-medium risk (yellow)
    if (normalizedScore <= 2) return '#FF9800'; // Medium-high risk (orange)
    return '#F44336'; // High risk (red)
  };

  // Style function for countries
  const getCountryStyle = (feature: Feature<Geometry, any> | undefined) => {
    if (!feature) return {};
    
    const countryName = feature.properties.NAME_EN || feature.properties.name;
    
    // Highlight the target country differently
    if (countryName === targetCountryName) {
      return { 
        fillColor: '#CCCCCC', // Gray for target country
        weight: 2, 
        opacity: 1,
        color: '#333',
        fillOpacity: 0.7 
      };
    }
    
    // Find risk data for this country
    const countryRiskData = countryData.find(c => 
      c.name_un === countryName || 
      c.name_un.toLowerCase() === countryName.toLowerCase()
    );
    
    if (!countryRiskData) {
      return { 
        fillColor: '#FFFFFF',  // White for countries with no data
        weight: 1, 
        opacity: 0.5,
        color: '#999',
        fillOpacity: 0.4
      };
    }
    
    // Get risk score and determine color
    const riskScore = calculateAverageRisk(countryRiskData);
    return {
      fillColor: getRiskColor(riskScore),
      weight: 1,
      opacity: 0.7,
      color: '#666',
      fillOpacity: 0.7
    };
  };

  // Fetch GeoJSON data
  useEffect(() => {
    // Fix Leaflet's icon issue
    fixLeafletIcon();
    
    const fetchGeoJSON = async () => {
      try {
        setIsLoading(true);
        console.log("Fetching GeoJSON data for map...");
        
        // First try the GitHub URL
        try {
          const response = await fetch(
            'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
          );
          
          if (!response.ok) {
            throw new Error('GitHub fetch failed');
          }
          
          const data = await response.json();
          console.log("Successfully loaded GeoJSON from GitHub");
          setCountriesGeoJSON(data);
        } 
        // If GitHub fails, try a fallback URL
        catch (githubError) {
          console.warn("Failed to fetch from GitHub, trying fallback URL:", githubError);
          
          // Fallback to a more reliable source or a local file
          const fallbackResponse = await fetch(
            // You can also add this file to your public folder and reference it as /countries.geojson
            'https://datahub.io/core/geo-countries/r/countries.geojson'
          );
          
          if (!fallbackResponse.ok) {
            throw new Error('Fallback fetch also failed');
          }
          
          const fallbackData = await fallbackResponse.json();
          console.log("Successfully loaded GeoJSON from fallback source");
          setCountriesGeoJSON(fallbackData);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching GeoJSON from all sources:', error);
        setMapError('Failed to load map data. Please check your internet connection and try again.');
        setIsLoading(false);
      }
    };
    
    fetchGeoJSON();
  }, []);

  // Handle feature interactions
  const onEachFeature = (feature: Feature<Geometry, any>, layer: any) => {
    const countryName = feature.properties.NAME_EN || feature.properties.name;
    const countryRiskData = countryData.find(c => 
      c.name_un === countryName || 
      c.name_un.toLowerCase() === countryName.toLowerCase()
    );
    
    let tooltipContent = `<strong>${countryName}</strong>`;
    
    if (countryName === targetCountryName) {
      tooltipContent += '<br/><em>Target Country</em>';
    } else if (countryRiskData) {
      const riskScore = calculateAverageRisk(countryRiskData);
      tooltipContent += `<br/>Risk Score: ${riskScore.toFixed(1)}`;
      
      if (selectedDisease !== 'overall') {
        tooltipContent += ` (${selectedDisease})`;
      }
      
      // Show individual disease scores if available
      if (selectedDisease === 'overall' && countryRiskData.riskScores) {
        tooltipContent += '<br/><small>Disease scores:';
        ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'].forEach(disease => {
          // TypeScript-safe way to access disease scores
          const diseaseProp = disease as keyof typeof countryRiskData.riskScores;
          const score = countryRiskData.riskScores[diseaseProp];
          if (score !== undefined) {
            tooltipContent += `<br/>${disease}: ${score.toFixed(1)}`;
          }
        });
        tooltipContent += '</small>';
      }
    }
    
    layer.bindTooltip(tooltipContent);
  };

  if (isLoading) {
    return <div className="h-96 flex items-center justify-center bg-gray-100">Loading map data...</div>;
  }

  if (mapError) {
    return <div className="h-96 flex items-center justify-center bg-red-50 text-red-800">{mapError}</div>;
  }

  return (
    <div className="h-96 w-full mb-6 rmt-step overflow-hidden rounded-lg border border-gray-200">
      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {countriesGeoJSON && (
          <GeoJSON 
            data={countriesGeoJSON}
            style={getCountryStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default RiskScoreMap;
