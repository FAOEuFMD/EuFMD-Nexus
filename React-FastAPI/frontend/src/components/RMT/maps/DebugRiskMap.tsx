import React, { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import fixLeafletIcon from '../../../utils/maps/fixLeafletIcon';

interface DebugRiskMapProps {
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

const DebugRiskMap: React.FC<DebugRiskMapProps> = ({ 
  countryData, 
  targetCountryName,
  selectedDisease = 'overall' 
}) => {
  // Fix Leaflet icon issue
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  // Simple placeholder map for debugging
  return (
    <div className="h-96 w-full mb-6 rmt-step overflow-hidden rounded-lg border border-gray-200">
      <div className="p-4 bg-blue-50">
        <h3 className="text-lg font-semibold mb-2">Risk Map (Debug Mode)</h3>
        <p className="mb-4">Map is loading in debug mode. If you can see this, the map component is rendering.</p>
        <p className="mb-2">Target Country: <strong>{targetCountryName}</strong></p>
        <p className="mb-2">Selected Disease: <strong>{selectedDisease}</strong></p>
        <p className="mb-2">Countries with data: <strong>{countryData.length}</strong></p>
        <div className="max-h-48 overflow-auto border p-2 bg-white">
          <pre className="text-xs">{JSON.stringify(countryData, null, 2)}</pre>
        </div>
      </div>
      
      <div className="h-64 bg-gray-100 p-4">
        <p className="text-center">Map placeholder</p>
      </div>
    </div>
  );
};

export default DebugRiskMap;
