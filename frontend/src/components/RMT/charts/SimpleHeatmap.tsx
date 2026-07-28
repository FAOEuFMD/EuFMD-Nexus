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

const DISEASES = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'] as const;

const getCellColor = (value: number): string => {
  if (value === 0) return 'bg-green-500';
  if (value === 1) return 'bg-yellow-500';
  if (value === 2) return 'bg-orange-500';
  if (value === 3) return 'bg-red-500';
  return 'bg-gray-300';
};

const getCellTextColor = (value: number): string => {
  return value > 2 ? 'text-white' : 'text-gray-900';
};

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

  return (
    <div className="w-full rmt-step">
      <div className="flex flex-wrap justify-center gap-4 mb-4 text-sm">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-500 mr-2 rounded" />
          <span>0 - Not Present</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-yellow-500 mr-2 rounded" />
          <span>1 - Low Prevalence</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-orange-500 mr-2 rounded" />
          <span>2 - Medium Prevalence</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-500 mr-2 rounded" />
          <span>3 - High Prevalence</span>
        </div>
      </div>

      <div className="rmt-table-container rmt-table-scroll-y">
        <table className="w-full rmt-table min-w-[600px]">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Source Country</th>
              {DISEASES.map((disease) => (
                <th key={disease} className="px-4 py-2 text-center">
                  {disease}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {diseaseStatusData.map((country) => (
              <tr key={country.name_un} className="border-b">
                <td className="px-4 py-2 font-medium">{country.name_un}</td>
                {DISEASES.map((disease) => {
                  const value = Number(country[disease] ?? 0);
                  return (
                    <td key={disease} className="px-4 py-2 text-center">
                      <span
                        className={`inline-block w-8 h-8 rounded-full ${getCellColor(value)} ${getCellTextColor(value)} text-center leading-8 font-semibold`}
                        title={`${country.name_un} - ${disease}: ${value}`}
                      >
                        {value}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SimpleHeatmap;
