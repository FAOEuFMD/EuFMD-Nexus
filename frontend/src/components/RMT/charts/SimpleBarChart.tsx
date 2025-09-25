import React, { useState } from 'react';

interface SimpleBarChartProps {
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

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ pathwayScores }) => {
  const [selectedDisease, setSelectedDisease] = useState('FMD');
  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];

  if (!pathwayScores || pathwayScores.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No pathway scores data available</p>
        </div>
      </div>
    );
  }

  // Pathway configuration with original Nivo colors
  const pathwayConfig = {
    airborne: { color: '#8DD3C7', label: 'Airborne' },
    vectorborne: { color: '#FFFFB3', label: 'Vector-borne' },
    wildAnimals: { color: '#BEBADA', label: 'Wild Animals' },
    animalProduct: { color: '#FB8072', label: 'Animal Product' },
    liveAnimal: { color: '#80B1D3', label: 'Live Animal' },
    fomite: { color: '#FDB462', label: 'Fomite' }
  };

  const pathwayKeys = Object.keys(pathwayConfig) as Array<keyof typeof pathwayConfig>;

  // Get data for selected disease
  const getChartData = () => {
    return pathwayScores.map(country => {
      const scores = country.diseaseScores?.[selectedDisease] || country.scores;
      
      return {
        country: country.name_un,
        pathways: pathwayKeys.map(pathway => ({
          pathway,
          value: scores[pathway] || 0,
          color: pathwayConfig[pathway].color,
          label: pathwayConfig[pathway].label
        }))
      };
    });
  };

  const chartData = getChartData();
  
  // Calculate max total height for scaling
  const maxTotal = Math.max(...chartData.map(item => 
    item.pathways.reduce((sum, p) => sum + p.value, 0)
  ));
  
  // Max height for bars in pixels - adjusted to fit within container
  // Container is h-96 (384px) minus top/bottom padding (160px) minus space for country labels and axis (40px)
  const maxBarHeight = 184;

  // Y-axis tick values
  const yAxisTicks = [];
  const tickInterval = Math.max(1, Math.ceil(maxTotal / 5)); // Ensure minimum interval of 1
  const safeMaxTotal = Math.max(1, maxTotal); // Ensure minimum total of 1
  
  for (let i = 0; i <= safeMaxTotal; i += tickInterval) {
    yAxisTicks.push(i);
    // Safety break to prevent infinite loops
    if (yAxisTicks.length > 10) break;
  }

  return (
    <div className="w-full rmt-step mb-6">
      {/* Header with disease selector (matching original) */}
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

      {/* Chart container with proper containment and responsive height */}
      <div className="h-96 relative bg-white rounded border border-gray-200 overflow-hidden max-w-full">
        <div className="absolute inset-0 overflow-hidden" style={{ padding: '60px 60px 100px 60px' }}>
        
          {/* Y-axis */}
          <div className="absolute left-0 top-16 bottom-20 flex flex-col justify-between items-end pr-3" style={{ width: '55px' }}>
            {yAxisTicks.reverse().map((tick, index) => (
              <div key={index} className="text-xs text-gray-600 relative">
                <span>{tick.toFixed(1)}</span>
                <div className="absolute left-full top-1/2 w-2 h-px bg-gray-300" style={{ transform: 'translateY(-50%)' }}></div>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="ml-12 h-full flex items-end justify-around relative border-l border-b border-gray-300 overflow-hidden lg:mr-32">
            
            {/* Horizontal grid lines */}
            {yAxisTicks.map((tick, index) => (
              <div
                key={index}
                className="absolute left-0 right-0 border-t border-gray-200"
                style={{ bottom: `${(tick / safeMaxTotal) * 100}%` }}
              ></div>
            ))}

            {chartData.map((countryData, index) => {
              const totalHeight = countryData.pathways.reduce((sum, p) => sum + p.value, 0);
              const scaledHeight = safeMaxTotal > 0 ? (totalHeight / safeMaxTotal) * maxBarHeight : 0;
              
              return (
                <div key={index} className="flex flex-col items-center justify-end" style={{ width: '60px', height: '100%' }}>
                  {/* Stacked bar positioned directly on the bottom border */}
                  <div 
                    className="relative flex flex-col-reverse border border-gray-400"
                    style={{ 
                      height: `${Math.max(scaledHeight, 1)}px`,
                      width: '42px',
                      minHeight: '1px',
                      maxHeight: `${maxBarHeight}px`
                    }}
                  >
                    {countryData.pathways.map((pathway, pathwayIndex) => {
                      if (pathway.value === 0) return null;
                      
                      const segmentHeight = safeMaxTotal > 0 
                        ? (pathway.value / safeMaxTotal) * maxBarHeight 
                        : 0;
                      
                      // Create darker border color similar to Nivo
                      const borderColor = pathway.color === '#FFFFB3' ? '#E6E68A' : 
                                        pathway.color === '#8DD3C7' ? '#7AB8A8' :
                                        pathway.color === '#BEBADA' ? '#A5A1C1' :
                                        pathway.color === '#FB8072' ? '#E2675F' :
                                        pathway.color === '#80B1D3' ? '#6D9EBA' :
                                        '#E4A34F';
                      
                      return (
                        <div
                          key={pathwayIndex}
                          className="relative flex items-center justify-center text-xs font-medium border-t"
                          style={{
                            backgroundColor: pathway.color,
                            borderColor: borderColor,
                            height: `${Math.max(segmentHeight, 12)}px`,
                            minHeight: '12px',
                            color: pathway.color === '#FFFFB3' ? '#333' : '#000'
                          }}
                          title={`${pathway.label}: ${pathway.value.toFixed(1)}`}
                        >
                          {pathway.value > 0 && (
                            <span className="text-xs font-medium">
                              {pathway.value.toFixed(1)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Country labels positioned below the chart area */}
          <div className="ml-12 flex justify-around relative lg:mr-32" style={{ height: '80px', paddingTop: '15px' }}>
            {chartData.map((countryData, index) => (
              <div key={index} className="flex justify-center" style={{ width: '60px' }}>
                <div 
                  className="text-center leading-tight"
                  style={{ 
                    fontSize: '10px',
                    width: 'max-content',
                    maxWidth: '55px',
                    color: '#374151',
                    lineHeight: '1.2'
                  }}
                >
                  {countryData.country}
                </div>
              </div>
            ))}
          </div>

          {/* X-axis label */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-sm text-gray-700 font-medium">
            Country
          </div>

          {/* Legend - positioned like original Nivo chart with responsive behavior */}
          <div className="absolute right-2 top-16 bottom-20 hidden lg:flex flex-col justify-center" style={{ width: '110px' }}>
            <div className="space-y-2">
              {pathwayKeys.map(pathway => (
                <div key={pathway} className="flex items-center text-xs">
                  <div
                    className="w-5 h-5 border border-gray-400 mr-2 flex-shrink-0"
                    style={{ backgroundColor: pathwayConfig[pathway].color }}
                  ></div>
                  <span className="text-gray-700 opacity-85 hover:opacity-100 transition-opacity">
                    {pathwayConfig[pathway].label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile legend below chart for smaller screens */}
      <div className="lg:hidden mt-4 flex flex-wrap justify-center gap-3">
        {pathwayKeys.map(pathway => (
          <div key={pathway} className="flex items-center text-xs">
            <div
              className="w-4 h-4 border border-gray-400 mr-1 flex-shrink-0"
              style={{ backgroundColor: pathwayConfig[pathway].color }}
            ></div>
            <span className="text-gray-700">
              {pathwayConfig[pathway].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimpleBarChart;
