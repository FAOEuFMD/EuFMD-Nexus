import React, { useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface RiskPathwayChartProps {
  pathwayScores: Array<{
    name_un: string;
    scores: {
      airborne: number;
      vectorborne: number;
      wildAnimals: number;
      animalProduct: number;
      liveAnimal: number;
      fomite: number;
    };
    diseaseScores?: {
      [key: string]: {
        airborne: number;
        vectorborne: number;
        wildAnimals: number;
        animalProduct: number;
        liveAnimal: number;
        fomite: number;
      };
    };
  }>;
}

interface ChartDataItem {
  country: string;
  [key: string]: string | number;
}

const RiskPathwayChart: React.FC<RiskPathwayChartProps> = ({ pathwayScores }) => {
  const [selectedDisease, setSelectedDisease] = useState('FMD');
  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];
  
  // Transform data for the selected disease
  const transformPathwayContributions = (
    data: RiskPathwayChartProps['pathwayScores'],
    disease: string
  ): ChartDataItem[] => {
    return data.map(country => {
      // If we have per-disease breakdown, use it, otherwise use overall scores
      const scores = country.diseaseScores?.[disease] || country.scores;
      
      return {
        country: country.name_un,
        airborne: scores.airborne,
        vectorborne: scores.vectorborne,
        wildAnimals: scores.wildAnimals,
        animalProduct: scores.animalProduct,
        liveAnimal: scores.liveAnimal,
        fomite: scores.fomite
      };
    });
  };
  
  const chartData = transformPathwayContributions(pathwayScores, selectedDisease);
  
  // Custom label formatter - needs to match Nivo's LabelFormatter type
  const formatLabel = (value: number | string) => {
    // Make sure we handle both number and string values
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(numValue) ? '0.0' : numValue.toFixed(1);
  };
  
  // Pathway names for legend
  const pathwayLabels = {
    airborne: 'Airborne',
    vectorborne: 'Vector-borne',
    wildAnimals: 'Wild Animals',
    animalProduct: 'Animal Product',
    liveAnimal: 'Live Animal',
    fomite: 'Fomite'
  };

  // Custom pathway colors
  const getPathwayColor = (pathway: string) => {
    const colors: Record<string, string> = {
      airborne: '#8DD3C7',
      vectorborne: '#FFFFB3',
      wildAnimals: '#BEBADA',
      animalProduct: '#FB8072',
      liveAnimal: '#80B1D3',
      fomite: '#FDB462'
    };
    return colors[pathway] || '#CCCCCC';
  };

  return (
    <div className="h-96 w-full rmt-step mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Risk Pathway Scores</h3>
        <div className="flex space-x-2">
          {diseases.map(disease => (
            <button
              key={disease}
              onClick={() => setSelectedDisease(disease)}
              className={`px-3 py-1 rounded text-sm ${
                selectedDisease === disease 
                  ? 'bg-[#15736d] text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {disease}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveBar
          data={chartData}
          keys={['airborne', 'vectorborne', 'wildAnimals', 'animalProduct', 'liveAnimal', 'fomite']}
          indexBy="country"
          margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
          padding={0.3}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={({ id }) => getPathwayColor(id as string)}
          borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
            legend: 'Country',
            legendPosition: 'middle',
            legendOffset: 42
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Risk Score',
            legendPosition: 'middle',
            legendOffset: -40
          }}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelFormat={(value) => formatLabel(value)}
          legends={[
            {
              dataFrom: 'keys',
              anchor: 'bottom-right',
              direction: 'column',
              justify: false,
              translateX: 120,
              translateY: 0,
              itemsSpacing: 2,
              itemWidth: 100,
              itemHeight: 20,
              itemDirection: 'left-to-right',
              itemOpacity: 0.85,
              symbolSize: 20,
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemOpacity: 1
                  }
                }
              ],
              data: Object.keys(pathwayLabels).map(key => ({
                id: key,
                label: pathwayLabels[key as keyof typeof pathwayLabels],
                color: getPathwayColor(key)
              }))
            }
          ]}
        />
      </div>
    </div>
  );
};

export default RiskPathwayChart;