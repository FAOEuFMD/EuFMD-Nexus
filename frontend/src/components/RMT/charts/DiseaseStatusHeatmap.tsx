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

  // Calculate dynamic height based on number of countries
  const baseHeight = 100; // Base height in pixels for a few countries
  const heightPerCountry = 45; // Additional height per country in pixels
  const minHeight = 240; // Minimum height in pixels
  const maxHeight = 800; // Maximum height in pixels
  // Use a different scaling approach for larger numbers of countries
  let calculatedHeight;
  if (diseaseStatusData.length <= 5) {
    // For small datasets, use linear scaling
    calculatedHeight = baseHeight + (diseaseStatusData.length * heightPerCountry);
  } else {
    // For larger datasets, use logarithmic scaling to prevent excessive height
    calculatedHeight = baseHeight + (5 * heightPerCountry) + 
                      (Math.log2(diseaseStatusData.length - 4) * heightPerCountry * 2);
  }
  calculatedHeight = Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  
  // Adjust left margin based on country name lengths
  const maxCountryNameLength = diseaseStatusData.reduce((max, country) => 
    Math.max(max, (country.name_un || "").length), 0);
  const leftMargin = Math.max(120, Math.min(200, maxCountryNameLength * 7)); // 7px per character with reasonable limits

  return (
    <div className="w-full rmt-step" style={{ height: `${calculatedHeight + 100}px` }}>
      <h3 className="text-lg font-semibold mb-2">Disease Status by Country</h3>
      <div className="flex justify-center mb-4">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-[#4CAF50] mr-1"></div>
            <span>0 - Not Present</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-[#FFEB3B] mr-1"></div>
            <span>1 - Low Prevalence</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-[#FF9800] mr-1"></div>
            <span>2 - Medium Prevalence</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-[#F44336] mr-1"></div>
            <span>3 - High Prevalence</span>
          </div>
        </div>
      </div>
      <div style={{ height: `${calculatedHeight}px` }}>
        <ResponsiveHeatMap
          data={transformDiseaseStatus(diseaseStatusData)}
          margin={{ top: 60, right: 80, bottom: 40, left: leftMargin }}
          valueFormat=">-.0f"
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Diseases',
            legendPosition: 'middle',
            legendOffset: -45,
            format: (value) => value
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Countries',
            legendPosition: 'middle',
            legendOffset: -Math.min(120, leftMargin * 0.9),
            format: (value) => value
          }}
          theme={{
            axis: {
              legend: {
                text: {
                  fontWeight: 'bold',
                  fontSize: 14
                }
              }
            }
          }}
          colors={getColor}
          emptyColor="#eeeeee"
          borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }}
          hoverTarget="cell"
          animate={true}
          tooltip={({ cell }) => (
            <div className="bg-white shadow-md rounded px-3 py-2 border border-gray-200">
              <strong>{cell.serieId}</strong><br />
              Disease: <strong>{cell.data.x}</strong><br />
              Status: <strong>{cell.data.y}</strong><br />
              {cell.data.y === 0 && <span className="text-green-600">Not Present</span>}
              {cell.data.y === 1 && <span className="text-yellow-600">Low Prevalence</span>}
              {cell.data.y === 2 && <span className="text-orange-600">Medium Prevalence</span>}
              {cell.data.y === 3 && <span className="text-red-600">High Prevalence</span>}
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default DiseaseStatusHeatmap;
