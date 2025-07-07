import React, { useState, useEffect, useRef } from 'react';
import { pcpService } from '../../services/pcpService';
import { PCPUniqueValues } from '../../types';

interface AddPCPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPCPAdded: () => void;
}

const AddPCPModal: React.FC<AddPCPModalProps> = ({ isOpen, onClose, onPCPAdded }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    Country: '',
    Year: new Date().getFullYear(),
    PCP_Stage: '',
    Last_meeting_attended: '',
    psoSupport: ''
  });

  const [uniqueValues, setUniqueValues] = useState<PCPUniqueValues>({
    countries: [],
    regions: [],
    stages: [],
    pso_support: []
  });

  const [filteredCountries, setFilteredCountries] = useState<string[]>([]);
  const [filteredStages, setFilteredStages] = useState<string[]>([]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUniqueValues();
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const fetchUniqueValues = async () => {
    try {
      setLoading(true);
      const response = await pcpService.getUniqueValues();
      setUniqueValues(response);
      setFilteredCountries(response.countries);
      setFilteredStages(response.stages);
    } catch (error) {
      console.error('Error fetching unique values:', error);
      // TODO: Add toast notification
    } finally {
      setLoading(false);
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.dropdown-container')) {
      setShowCountryDropdown(false);
      setShowStageDropdown(false);
    }
  };

  const filterCountries = (value: string) => {
    if (!value) {
      setFilteredCountries(uniqueValues.countries);
      return;
    }
    setFilteredCountries(
      uniqueValues.countries.filter(country =>
        country.toLowerCase().includes(value.toLowerCase())
      )
    );
  };

  const filterStages = (value: string) => {
    if (!value) {
      setFilteredStages(uniqueValues.stages);
      return;
    }
    setFilteredStages(
      uniqueValues.stages.filter(stage =>
        stage.toLowerCase().includes(value.toLowerCase())
      )
    );
  };

  const handleCountryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, Country: value }));
    filterCountries(value);
    setShowCountryDropdown(true);
  };

  const handleStageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, PCP_Stage: value }));
    filterStages(value);
    setShowStageDropdown(true);
  };

  const selectCountry = (country: string) => {
    setFormData(prev => ({ ...prev, Country: country }));
    setShowCountryDropdown(false);
  };

  const selectStage = (stage: string) => {
    setFormData(prev => ({ ...prev, PCP_Stage: stage }));
    setShowStageDropdown(false);
  };

  const resetForm = () => {
    setFormData({
      Country: '',
      Year: new Date().getFullYear(),
      PCP_Stage: '',
      Last_meeting_attended: '',
      psoSupport: ''
    });
    setShowCountryDropdown(false);
    setShowStageDropdown(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.Country || !formData.Year || !formData.PCP_Stage || !formData.psoSupport) {
      // TODO: Add toast notification
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const requestData = {
        Country: formData.Country,
        Year: formData.Year,
        PCP_Stage: formData.PCP_Stage,
        Last_RMM_held: formData.Last_meeting_attended, // Backend expects Last_RMM_held
        psoSupport: formData.psoSupport,
      };

      console.log('Sending PCP data:', requestData);
      const response = await pcpService.addPCPEntry(requestData);
      
      if (response.status === 'created') {
        // TODO: Add toast notification
        alert('PCP entry created successfully');
      } else if (response.status === 'updated') {
        // TODO: Add toast notification
        alert('PCP entry updated successfully');
      }
      
      onPCPAdded();
      handleClose();
      
    } catch (error) {
      console.error('Error:', error);
      // TODO: Add toast notification
      alert('An error occurred while trying to add/update PCP FMD entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900 opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="bg-white w-full max-w-xl lg:max-w-2xl rounded-lg z-50 shadow-lg p-4 md:p-6 mx-4"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-1 text-left px-8">
          {/* Close button */}
          <div className="flex justify-end items-center mt-5">
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-green-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Loading spinner */}
          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          )}

          {/* Form */}
          <div className="flex flex-col p-5">
            <form onSubmit={handleSubmit} className="mx-auto min-w-min px-4 pb-6">
              {/* Country Input with Dropdown */}
              <label className="mb-2 font-semibold block" htmlFor="Country">
                Country *
              </label>
              <div className="relative dropdown-container">
                <input
                  id="Country"
                  type="text"
                  placeholder="Type to search country"
                  value={formData.Country}
                  onChange={handleCountryInputChange}
                  onFocus={() => setShowCountryDropdown(true)}
                  className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                  required
                />
                {/* Country Dropdown */}
                {filteredCountries.length > 0 && showCountryDropdown && (
                  <div className="absolute z-50 w-full bg-white border rounded-b shadow-lg max-h-60 overflow-y-auto">
                    {filteredCountries.map((country) => (
                      <div
                        key={country}
                        onClick={() => selectCountry(country)}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {country}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Year Input */}
              <label className="mb-2 font-semibold block" htmlFor="Year">
                Year *
              </label>
              <input
                id="Year"
                type="number"
                placeholder="Year"
                value={formData.Year}
                onChange={(e) => setFormData(prev => ({ ...prev, Year: parseInt(e.target.value) || new Date().getFullYear() }))}
                className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                required
              />

              {/* PCP Stage Input with Dropdown */}
              <label className="mb-2 font-semibold block" htmlFor="PCP_Stage">
                PCP-FMD Stage *
              </label>
              <div className="relative dropdown-container">
                <input
                  id="PCP_Stage"
                  type="text"
                  placeholder="Type to search stage"
                  value={formData.PCP_Stage}
                  onChange={handleStageInputChange}
                  onFocus={() => setShowStageDropdown(true)}
                  className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
                  required
                />
                {/* Stage Dropdown */}
                {filteredStages.length > 0 && showStageDropdown && (
                  <div className="absolute z-50 w-full bg-white border rounded-b shadow-lg max-h-60 overflow-y-auto">
                    {filteredStages.map((stage) => (
                      <div
                        key={stage}
                        onClick={() => selectStage(stage)}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {stage}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Last Meeting Attended */}
              <label className="mb-2 font-semibold block" htmlFor="Last_meeting_attended">
                Last Meeting Attended (Optional)
              </label>
              <input
                id="Last_meeting_attended"
                type="text"
                placeholder="Month/Year"
                value={formData.Last_meeting_attended}
                onChange={(e) => setFormData(prev => ({ ...prev, Last_meeting_attended: e.target.value }))}
                className="w-full border focus:ring-green-600 focus:border-green-600 focus:outline-none focus:ring-1 rounded px-4 py-2 mb-2"
              />

              {/* PSO Support Radio Buttons */}
              <label className="mb-2 font-semibold block">
                PSO Support *
              </label>
              <div className="flex items-center mb-2">
                <label className="inline-flex items-center text-sm">
                  <input
                    type="radio"
                    name="psoSupport"
                    value="Yes"
                    checked={formData.psoSupport === 'Yes'}
                    onChange={(e) => setFormData(prev => ({ ...prev, psoSupport: e.target.value }))}
                    className="mr-2 w-5 h-5 text-green-600 focus:ring-green-600 border-gray-300"
                    required
                  />
                  Yes
                </label>
              </div>
              <div className="flex items-center mb-4">
                <label className="inline-flex items-center text-sm">
                  <input
                    type="radio"
                    name="psoSupport"
                    value="No"
                    checked={formData.psoSupport === 'No'}
                    onChange={(e) => setFormData(prev => ({ ...prev, psoSupport: e.target.value }))}
                    className="mr-2 w-5 h-5 text-green-600 focus:ring-green-600 border-gray-300"
                    required
                  />
                  No
                </label>
              </div>

              {/* Submit Button */}
              <div className="grid justify-items-center mt-5">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-greenMain text-white px-6 py-2 rounded hover:bg-green-greenMain2 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding...' : 'Add PCP FMD Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPCPModal;
