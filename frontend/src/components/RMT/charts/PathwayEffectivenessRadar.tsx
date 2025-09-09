import React, { useState } from 'react';
import { ResponsiveRadar } from '@nivo/radar';

interface PathwayEffectivenessRadarProps {
  pathwaysData: Array<{
    pathway: string;
    FMD: number;
    PPR: number;
    LSD: number;
    RVF: number;
    SPGP: number;
  }>;
}

interface RadarDataItem {
  pathway: string;
  [key: string]: string | number;
}

const PathwayEffectivenessRadar: React.FC<PathwayEffectivenessRadarProps> = ({ pathwaysData }) => {
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];
  
  // Color mapping for diseases
  const diseaseColors: Record<string, string> = {
    FMD: '#4CAF50',    // Green
    PPR: '#FFEB3B',    // Yellow
    LSD: '#FF9800',    // Orange
    RVF: '#F44336',    // Red
    SPGP: '#673AB7'    // Purple
  };

  // Transform data for the radar chart
  const transformPathwaysForRadar = (data: PathwayEffectivenessRadarProps['pathwaysData']): RadarDataItem[] => {
    return data.map(item => ({
      pathway: item.pathway,
      FMD: item.FMD,
      PPR: item.PPR,
      LSD: item.LSD,
      RVF: item.RVF,
      SPGP: item.SPGP
    }));
  };

  const radarData = transformPathwaysForRadar(pathwaysData);
  
  // Determine which diseases to show and colors to use
  const keysToShow = selectedDisease ? [selectedDisease] : diseases;
  const colorsToUse = selectedDisease ? [diseaseColors[selectedDisease]] : Object.values(diseaseColors);
  
  return (
    <div className="w-full rmt-step mb-6">
      {/* Disease filter buttons */}
      <div className="mb-6 flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setSelectedDisease(null)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            selectedDisease === null 
              ? 'bg-[#15736d] text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Diseases
        </button>
        {diseases.map(disease => (
          <button
            key={disease}
            onClick={() => setSelectedDisease(disease)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedDisease === disease 
                ? 'text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            style={{
              backgroundColor: selectedDisease === disease ? diseaseColors[disease] : undefined
            }}
          >
            {disease}
          </button>
        ))}
      </div>
      
      <div className="h-96">
        <ResponsiveRadar
          data={radarData}
          keys={keysToShow}
          indexBy="pathway"
          maxValue={3}
          margin={{ top: 70, right: 80, bottom: 40, left: 80 }}
          curve="linearClosed"
          borderWidth={2}
          borderColor={{ from: 'color' }}
          gridLevels={4}
          gridShape="circular"
          gridLabelOffset={36}
          enableDots={true}
          dotSize={10}
          dotColor={{ theme: 'background' }}
          dotBorderWidth={2}
          dotBorderColor={{ from: 'color' }}
          enableDotLabel={true}
          dotLabel="value"
          dotLabelYOffset={-12}
          colors={colorsToUse}
          fillOpacity={0.25}
          blendMode="multiply"
          animate={true}
          legends={keysToShow.length > 1 ? [
            {
              anchor: 'top-left',
              direction: 'column',
              translateX: -50,
              translateY: -40,
              itemWidth: 80,
              itemHeight: 20,
              itemTextColor: '#999',
              symbolSize: 12,
              symbolShape: 'circle',
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemTextColor: '#000'
                  }
                }
              ]
            }
          ] : []} // Hide legend when showing single disease
        />
      </div>
    </div>
  );
};

export default PathwayEffectivenessRadar;
