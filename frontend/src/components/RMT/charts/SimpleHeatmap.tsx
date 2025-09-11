import React from 'react';

interface SimpleHeatmapProps {
  diseaseStatusData: Array<{
    name_un: string;
    FMD?: number | null;
    PPR?: number | null;
    LSD?: number | null;
    RVF?: number | null;
    SPGP?: number | null;
  }>;
}

const SimpleHeatmap: React.FC<SimpleHeatmapProps> = ({ diseaseStatusData }) => {
  if (!diseaseStatusData || diseaseStatusData.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No disease status data available</p>
        </div>
      </div>
    );
  }

  const diseases = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'];
  
  const getColor = (value: number) => {
    if (value === 0) return 'bg-green-500';
    if (value === 1) return 'bg-yellow-500';
    if (value === 2) return 'bg-orange-500';
    if (value === 3) return 'bg-red-500';
    return 'bg-gray-300';
  };

  const getTextColor = (value: number) => {
    return value > 2 ? 'text-white' : 'text-gray-900';
  };

  return (
    <div className="w-full rmt-step">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Legend */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 mr-2 rounded"></div>
              <span>0 - Not Present</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-500 mr-2 rounded"></div>
              <span>1 - Low Prevalence</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-orange-500 mr-2 rounded"></div>
              <span>2 - Medium Prevalence</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 mr-2 rounded"></div>
              <span>3 - High Prevalence</span>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header */}
            <div className="flex">
              <div className="w-32 p-3 bg-gray-50 border border-gray-300 font-semibold text-gray-700">
                Countries
              </div>
              {diseases.map(disease => (
                <div key={disease} className="w-20 p-3 bg-gray-50 border border-gray-300 text-center font-semibold text-gray-700">
                  {disease}
                </div>
              ))}
            </div>
            
            {/* Data Rows */}
            {diseaseStatusData.map((country, index) => (
              <div key={index} className="flex">
                <div className="w-32 p-3 bg-gray-50 border border-gray-300 font-medium text-gray-800">
                  {country.name_un}
                </div>
                {diseases.map(disease => {
                  const value = Number(country[disease as keyof typeof country] || 0);
                  return (
                    <div key={disease} className="w-20 p-3 border border-gray-300 flex items-center justify-center">
                      <div 
                        className={`w-12 h-12 rounded ${getColor(value)} ${getTextColor(value)} flex items-center justify-center text-sm font-bold shadow-sm transition-all duration-200 hover:scale-110`}
                        title={`${country.name_un} - ${disease}: ${value}`}
                      >
                        {value}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleHeatmap;
