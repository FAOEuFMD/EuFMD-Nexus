import React, { useState } from 'react';
import { pcpService } from '../../services';
import AddPCPModal from './AddPCPModal';

interface AddPCPProps {
  regions: string[];
  countries: string[];
  pcpStages: string[];
  psoSupport: string[];
  onRegionSelected: (region: string | null) => void;
  onCountrySelected: (country: string | null) => void;
  onYearSelected: (year: number | null) => void;
  onStageSelected: (stage: string | null) => void;
  onPSOSelected: (pso: string | null) => void;
  onClearFilters: () => void;
  onForceRerender: () => void;
  filteredCountries: string[];
}

const AddPCP: React.FC<AddPCPProps> = ({
  regions,
  countries,
  pcpStages,
  psoSupport,
  onRegionSelected,
  onCountrySelected,
  onYearSelected,
  onStageSelected,
  onPSOSelected,
  onClearFilters,
  onForceRerender,
  filteredCountries
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedPSO, setSelectedPSO] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Generate year options (2010 to current year)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2010; year <= currentYear; year++) {
      years.push(year);
    }
    return years;
  };

  const yearOptions = generateYearOptions();

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setSelectedRegion(value);
    onRegionSelected(value);
    // Clear country selection when region changes
    setSelectedCountry(null);
    onCountrySelected(null);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setSelectedCountry(value);
    onCountrySelected(value);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    setSelectedYear(value);
    onYearSelected(value);
  };

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setSelectedStage(value);
    onStageSelected(value);
  };

  const handlePSOChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setSelectedPSO(value);
    onPSOSelected(value);
  };

  const handleClearFilters = () => {
    setSelectedRegion(null);
    setSelectedCountry(null);
    setSelectedYear(null);
    setSelectedStage(null);
    setSelectedPSO(null);
    onClearFilters();
  };

  const handleDownloadReport = async () => {
    try {
      const requestObject: any = {};
      if (selectedRegion) {
        requestObject.RMM = selectedRegion;
      }
      if (selectedCountry) {
        requestObject.country = selectedCountry;
      }
      if (selectedYear) {
        requestObject.year = selectedYear;
      }
      if (selectedStage) {
        requestObject.stage = selectedStage;
      }
      if (selectedPSO) {
        requestObject.pso_support = selectedPSO;
      }

      await pcpService.downloadReport(requestObject);
      
      // Clear filters after successful download
      handleClearFilters();
      
      // Show success message (you can implement a toast here)
      console.log("Report Downloaded");
    } catch (error) {
      console.error("Error downloading report:", error);
      // Show error message (you can implement a toast here)
      console.log("Error occurred while trying to retrieve the report");
    }
  };

  const openModal = () => {
    setShowModal(true);
  };

  return (
    <div className="pt-10 mb-20">
      <div className="flex justify-around gap-4 flex-wrap">
        <label className="block font-semibold min-w-0 flex-1">
          Select Region
          <select
            value={selectedRegion || ''}
            onChange={handleRegionChange}
            className={`block w-full mt-1 p-2 border focus:border-green-600 rounded bg-white mb-1 ${
              selectedRegion === null ? 'text-gray-400' : 'text-black'
            }`}
          >
            <option disabled value="">Select Region</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>

        <label className="block font-semibold min-w-0 flex-1">
          Select Country
          <select
            value={selectedCountry || ''}
            onChange={handleCountryChange}
            className={`block w-full mt-1 p-2 border focus:border-green-600 rounded bg-white mb-1 ${
              selectedCountry === null ? 'text-gray-400' : 'text-black'
            }`}
          >
            <option disabled value="">Select Country</option>
            <option value="">Select All</option>
            {filteredCountries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>

        <label className="block font-semibold min-w-0 flex-1">
          Select Year
          <select
            value={selectedYear || ''}
            onChange={handleYearChange}
            className={`block w-full mt-1 p-2 border focus:border-green-600 rounded bg-white mb-1 ${
              selectedYear === null ? 'text-gray-400' : 'text-black'
            }`}
          >
            <option disabled value="">Select Year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="block font-semibold min-w-0 flex-1">
          Select PCP Stage
          <select
            value={selectedStage || ''}
            onChange={handleStageChange}
            className={`block w-full mt-1 p-2 border focus:border-green-600 rounded bg-white mb-1 ${
              selectedStage === null ? 'text-gray-400' : 'text-black'
            }`}
          >
            <option disabled value="">Select PCP Stage</option>
            {pcpStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>

        <label className="block font-semibold min-w-0 flex-1">
          PSO Support
          <select
            value={selectedPSO || ''}
            onChange={handlePSOChange}
            className={`block w-full mt-1 p-2 border focus:border-green-600 rounded bg-white mb-1 ${
              selectedPSO === null ? 'text-gray-400' : 'text-black'
            }`}
          >
            <option disabled value="">Select PSO Support</option>
            {psoSupport.map((pso) => (
              <option key={pso} value={pso}>
                {pso}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            onClick={handleClearFilters}
            className="text-red-600 px-2 font-bold border-solid border-2 border-red-500 rounded-lg hover:bg-red-400 hover:text-black h-fit"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="mt-10 flex gap-4">
        <button 
          onClick={openModal} 
          className="bg-green-greenMain text-white px-6 py-2 rounded hover:bg-green-greenMain2 transition-colors w-1/4"
        >
          Add New PCP FMD
        </button>
        <button 
          onClick={handleDownloadReport} 
          className="bg-green-greenMain text-white px-6 py-2 rounded hover:bg-green-greenMain2 transition-colors w-1/4"
        >
          Download Report
        </button>
      </div>

      <AddPCPModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onPCPAdded={onForceRerender}
      />
    </div>
  );
};

export default AddPCP;
