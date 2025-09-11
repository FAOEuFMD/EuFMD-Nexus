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

  // Add country name mapping function
  const getStandardizedCountryName = (geoJsonName: string): string => {
    const nameMapping: { [key: string]: string } = {
      'Turkey': 'Türkiye',
      'Iran (Islamic Republic of)': 'Iran',
      'Palestine, State of': 'Palestine',
      'West Bank': 'Palestine',
      'West Bank and Gaza': 'Palestine',
      'Gaza Strip': 'Palestine',
      'Palestinian Territory': 'Palestine',
    
    };
    
    return nameMapping[geoJsonName] || geoJsonName;
  };

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
    
    const geoJsonCountryName = feature.properties.NAME_EN || feature.properties.name;
    const standardizedCountryName = getStandardizedCountryName(geoJsonCountryName);
    
    // Highlight the target country differently
    if (standardizedCountryName === targetCountryName) {
      return { 
        fillColor: '#CCCCCC', // Gray for target country
        weight: 2, 
        opacity: 1,
        color: '#333',
        fillOpacity: 0.7 
      };
    }
    
    // Find risk data for this country using standardized name
    const countryRiskData = countryData.find(c => 
      c.name_un === standardizedCountryName || 
      c.name_un.toLowerCase() === standardizedCountryName.toLowerCase()
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
    // Remove tooltip functionality since map already shows country names
    // Country styling and risk data matching is handled in getCountryStyle function
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
          url="https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; United Nations Geospatial Information Section"
          maxZoom={18}
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
