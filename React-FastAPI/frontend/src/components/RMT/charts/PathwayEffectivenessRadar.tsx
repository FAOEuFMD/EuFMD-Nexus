import React from 'react';
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
  // Transform data for the radar chart if needed
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
  
  return (
    <div className="h-96 w-full rmt-step mb-6">
      <h3 className="text-lg font-semibold mb-2">Pathway Effectiveness by Disease</h3>
      <div className="h-80">
        <ResponsiveRadar
          data={radarData}
          keys={['FMD', 'PPR', 'LSD', 'RVF', 'SPGP']}
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
          colors={[
            '#4CAF50', // FMD - Green
            '#FFEB3B', // PPR - Yellow
            '#FF9800', // LSD - Orange
            '#F44336', // RVF - Red
            '#673AB7'  // SPGP - Purple
          ]}
          fillOpacity={0.25}
          blendMode="multiply"
          animate={true}
          legends={[
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
          ]}
        />
      </div>
    </div>
  );
};

export default PathwayEffectivenessRadar;
