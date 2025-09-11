import React from 'react';
import { ResponsiveHeatMap } from '@nivo/heatmap';

interface DiseaseStatusHeatmapProps {
  diseaseStatusData: Array<{
    name_un: string;
    FMD?: number | null;
    PPR?: number | null;
    LSD?: number | null;
    RVF?: number | null;
    SPGP?: number | null;
    [key: string]: any; // To allow for other properties
  }>;
}

const DiseaseStatusHeatmap: React.FC<DiseaseStatusHeatmapProps> = ({ diseaseStatusData }) => {
  console.log('DiseaseStatusHeatmap received data:', diseaseStatusData);

  // Early return if no data
  if (!diseaseStatusData || diseaseStatusData.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No disease status data available</p>
          <p className="text-xs text-gray-500">Please ensure data has been loaded correctly</p>
        </div>
      </div>
    );
  }

  // Transform data for the heatmap - create completely new objects
  const chartData = diseaseStatusData.map(item => ({
    id: String(item.name_un || 'Unknown'),
    data: [
      { x: 'FMD', y: Number(item.FMD || 0) },
      { x: 'PPR', y: Number(item.PPR || 0) },
      { x: 'LSD', y: Number(item.LSD || 0) },
      { x: 'RVF', y: Number(item.RVF || 0) },
      { x: 'SPGP', y: Number(item.SPGP || 0) }
    ]
  }));

  console.log('Transformed heatmap data:', chartData);

  return (
    <div className="w-full rmt-step" style={{ height: '400px' }}>
      <div style={{ height: '350px' }}>
        <ResponsiveHeatMap
          data={chartData}
          margin={{ top: 60, right: 80, bottom: 40, left: 120 }}
          valueFormat=">-.0f"
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Diseases',
            legendPosition: 'middle',
            legendOffset: -45
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Countries',
            legendPosition: 'middle',
            legendOffset: -100
          }}
          colors={({ value }) => {
            const v = Number(value);
            if (v === 0) return '#4CAF50';
            if (v === 1) return '#FFEB3B';
            if (v === 2) return '#FF9800';
            if (v === 3) return '#F44336';
            return '#EEEEEE';
          }}
          emptyColor="#eeeeee"
          borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }}
          animate={false}
        />
      </div>
    </div>
  );
};

export default DiseaseStatusHeatmap;
