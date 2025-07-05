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
  // Transform data for the heatmap in the format Nivo expects
  const transformDiseaseStatus = (data: DiseaseStatusHeatmapProps['diseaseStatusData']) => {
    // Group by country
    return data.map(item => ({
      id: item.name_un || item.countryName,
      data: [
        { x: 'FMD', y: Number(item.FMD ?? 0) },
        { x: 'PPR', y: Number(item.PPR ?? 0) },
        { x: 'LSD', y: Number(item.LSD ?? 0) },
        { x: 'RVF', y: Number(item.RVF ?? 0) },
        { x: 'SPGP', y: Number(item.SPGP ?? 0) }
      ]
    }));
  };

  // Custom color scale that matches your existing color scheme
  const getColor = (value: any) => {
    const numValue = typeof value === 'object' ? value.data?.y || 0 : Number(value);
    if (numValue === 0) return '#4CAF50'; // score-ok
    if (numValue === 1) return '#FFEB3B'; // score-warning1
    if (numValue === 2) return '#FF9800'; // score-warning2
    if (numValue === 3) return '#F44336'; // score-warning4
    return '#EEEEEE'; // score-na
  };

  return (
    <div className="h-80 w-full rmt-step">
      <h3 className="text-lg font-semibold mb-2">Disease Status by Country</h3>
      <div className="h-64">
        <ResponsiveHeatMap
          data={transformDiseaseStatus(diseaseStatusData)}
          margin={{ top: 60, right: 80, bottom: 40, left: 120 }}
          valueFormat=">-.2s"
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Diseases',
            legendPosition: 'middle',
            legendOffset: -30
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Countries',
            legendPosition: 'middle',
            legendOffset: -80
          }}
          colors={getColor}
          emptyColor="#eeeeee"
          borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }}
          hoverTarget="cell"
          animate={true}
        />
      </div>
    </div>
  );
};

export default DiseaseStatusHeatmap;
