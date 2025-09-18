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
    
    const geoJsonCountryName = feature.properties.ROMNAM || feature.properties.NAME_EN || feature.properties.name;
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
        
        // Get list of countries we need (source countries + target country)
        const neededCountries = new Set<string>();
        
        // Add target country
        neededCountries.add(targetCountryName);
        
        // Add all source countries from countryData
        countryData.forEach(country => {
          neededCountries.add(country.name_un);
        });
        
        // Convert country names to potential ISO3 codes
        // This is a simplified mapping - you might need to enhance this
        const countryToISO3: { [key: string]: string } = {
          'Egypt': 'EGY',
          'Jordan': 'JOR', 
          'Lebanon': 'LBN',
          'Palestine': 'PSE',
          'Libya': 'LBY',
          'Turkey': 'TUR',
          'Türkiye': 'TUR',
          'Azerbaijan': 'AZE',
          'Armenia': 'ARM',
          'Georgia': 'GEO',
          'Iraq': 'IRQ',
          'Iran': 'IRN',
          'Pakistan': 'PAK',
          'Mauritania': 'MRT',
          'Algeria': 'DZA',
          'Morocco': 'MAR',
          'Tunisia': 'TUN',
          'Syria': 'SYR',
          'Sudan': 'SDN',
          'Israel': 'ISR',
          'Afghanistan': 'AFG'
        };
        
        // Convert country names to ISO3 codes
        const iso3Codes = Array.from(neededCountries).map(country => 
          countryToISO3[country] || country
        ).filter(Boolean);
        
        // Try UN GeoServices API directly
        try {
          const UN_GEOSERVICES_BASE = "https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/109/query";
          
          // Build the query parameters
          const params = new URLSearchParams({
            outFields: "ISO3CD,ROMNAM",
            returnGeometry: "true",
            f: "geojson",
            where: iso3Codes.length > 0 ? `ISO3CD IN ('${iso3Codes.join("','")}')` : "1=1"
          });
          
          const response = await fetch(`${UN_GEOSERVICES_BASE}?${params}`);
          
          if (!response.ok) {
            throw new Error(`UN GeoServices API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Validate the GeoJSON structure
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid response from UN GeoServices');
          }
          
          if (!data.type || data.type !== 'FeatureCollection') {
            throw new Error('Response is not a valid GeoJSON FeatureCollection');
          }
          
          if (!Array.isArray(data.features)) {
            throw new Error('GeoJSON features is not an array');
          }
          
          // Validate and filter features
          const validFeatures = data.features.filter((feature: any) => {
            return feature && 
                   feature.type === 'Feature' && 
                   feature.geometry && 
                   feature.properties &&
                   feature.geometry.coordinates;
          });
          
          if (validFeatures.length === 0) {
            throw new Error('No valid features found in UN GeoServices response');
          }
          
          const validatedData = {
            type: 'FeatureCollection',
            features: validFeatures
          };
          
          console.log(`Successfully loaded ${validatedData.features.length} valid countries from UN GeoServices`);
          setCountriesGeoJSON(validatedData);
        } 
        // If UN API fails, just show background map without country overlays
        catch (unError) {
          console.warn("Failed to fetch from UN GeoServices, showing background map only:", unError);
          setCountriesGeoJSON(null); // This will show only the background tile layer
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchGeoJSON:', error);
        setMapError('Failed to load map data. Please check your internet connection and try again.');
        setIsLoading(false);
      }
    };
    
    fetchGeoJSON();
  }, [countryData, targetCountryName]);

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
