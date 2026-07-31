import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Feature, Geometry } from 'geojson';
import fixLeafletIcon from '../../../utils/maps/fixLeafletIcon';
import { fetchCountryBoundaries } from '../../../utils/maps/countryUtils';
import { getRiskColorHex } from '../../../utils/riskScoreColors';

interface RiskScoreMapProps {
  countryData: Array<{
    id: number;
    name_un: string;
    iso3: string;
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
  targetCountryIso3?: string;
  selectedDisease?: string;
}

const RiskScoreMap: React.FC<RiskScoreMapProps> = ({
  countryData,
  targetCountryName,
  targetCountryIso3,
  selectedDisease = 'overall',
}) => {
  const [countriesGeoJSON, setCountriesGeoJSON] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    fixLeafletIcon();
  }, []);

  const getFeatureIso3 = (feature: Feature<Geometry, any> | undefined): string => {
    if (!feature?.properties) return '';
    return String(feature.properties.ISO3CD || '').toUpperCase();
  };

  const calculateAverageRisk = (country: RiskScoreMapProps['countryData'][number]): number => {
    if (!country.riskScores) return 0;

    if (selectedDisease !== 'overall') {
      return country.riskScores[selectedDisease as keyof typeof country.riskScores] || 0;
    }

    const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'] as const;
    const scores = diseases.map((d) => country.riskScores[d] || 0);
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  };

  const getCountryStyle = (feature: Feature<Geometry, any> | undefined) => {
    if (!feature) return {};

    const featureIso3 = getFeatureIso3(feature);
    const targetIso3 = targetCountryIso3?.toUpperCase();

    if (targetIso3 && featureIso3 === targetIso3) {
      return {
        fillColor: '#CCCCCC',
        weight: 2,
        opacity: 1,
        color: '#333',
        fillOpacity: 0.7,
      };
    }

    const countryRiskData = countryData.find(
      (c) => c.iso3?.toUpperCase() === featureIso3,
    );

    if (!countryRiskData) {
      return {
        fillColor: '#FFFFFF',
        weight: 1,
        opacity: 0.5,
        color: '#999',
        fillOpacity: 0.4,
      };
    }

    const riskScore = calculateAverageRisk(countryRiskData);
    return {
      fillColor: getRiskColorHex(riskScore),
      weight: 1,
      opacity: 0.7,
      color: '#666',
      fillOpacity: 0.7,
    };
  };

  useEffect(() => {
    const loadBoundaries = async () => {
      try {
        setIsLoading(true);
        setMapError(null);

        const iso3Codes = [
          ...countryData.map((country) => country.iso3).filter(Boolean),
          ...(targetCountryIso3 ? [targetCountryIso3] : []),
        ];
        const uniqueIso3 = Array.from(new Set(iso3Codes.map((code) => code.toUpperCase())));

        if (uniqueIso3.length === 0) {
          setCountriesGeoJSON(null);
          return;
        }

        const data = await fetchCountryBoundaries(uniqueIso3);
        setCountriesGeoJSON(data);
      } catch (error) {
        console.error('Error loading country boundaries:', error);
        setMapError('Failed to load map data. Please check your internet connection and try again.');
        setCountriesGeoJSON(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadBoundaries();
  }, [countryData, targetCountryIso3]);

  const onEachFeature = (_feature: Feature<Geometry, any>, _layer: any) => {
    // Styling handled in getCountryStyle
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
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; United Nations Geospatial Information Section"
          maxNativeZoom={6}
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
