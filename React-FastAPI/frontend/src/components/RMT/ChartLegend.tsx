import React from 'react';

interface ChartLegendProps {
  keys: string[];
  colors: string[];
}

const ChartLegend: React.FC<ChartLegendProps> = ({ keys, colors }) => {
  return (
    <div className="text-xs">
      {keys.map((key, i) => (
        <div key={i} className="flex items-center px-3 py-1 gap-2">
          <div className="rounded-full w-4 h-4" style={{ backgroundColor: colors[i] }}></div>
          <div>{key}</div>
        </div>
      ))}
    </div>
  );
};

export default ChartLegend;
