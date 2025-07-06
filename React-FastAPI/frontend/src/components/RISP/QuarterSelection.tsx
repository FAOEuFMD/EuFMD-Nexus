import React, { useEffect, useState } from 'react';

interface QuarterSelectionProps {
  years: string[];
  quarters: string[];
  onYearChange?: (year: string) => void;
  onQuarterChange?: (quarter: string) => void;
}

const QuarterSelection: React.FC<QuarterSelectionProps> = ({ 
  years, 
  quarters, 
  onYearChange,
  onQuarterChange 
}) => {
  const currentYear = new Date().getFullYear().toString();
  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<string>(currentQuarter);

  useEffect(() => {
    // Initialize with default values only on component mount
    const initialize = () => {
      if (onYearChange) onYearChange(selectedYear);
      if (onQuarterChange) onQuarterChange(selectedQuarter);
    };
    
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedYear(value);
    if (onYearChange) onYearChange(value);
  };

  const handleQuarterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedQuarter(value);
    if (onQuarterChange) onQuarterChange(value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5 items-center">
        <label htmlFor="year" className="block text-sm font-medium text-gray-700">
          Year
        </label>
        <select
          id="year"
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          value={selectedYear}
          onChange={handleYearChange}
        >
          <option disabled value="">Select Year</option>
          {years.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2.5 items-center">
        <label htmlFor="quarter" className="block text-sm font-medium text-gray-700">
          Quarter
        </label>
        <select
          id="quarter"
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          value={selectedQuarter}
          onChange={handleQuarterChange}
        >
          <option disabled value="">Select Quarter</option>
          {quarters.map(quarter => (
            <option key={quarter} value={quarter}>
              {quarter}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default QuarterSelection;
