import React, { useEffect, useState, useCallback } from 'react';

interface AdminLevel {
  name: string;
  id: string;
}

interface MultipleSelectOptionsProps {
  isOpen: boolean;
  multipleOptions: string[];
  selectedOptions: string[];
  onClose: () => void;
  onChange: (options: string[]) => void;
  country?: string; // Add country prop for admin levels fetching
  borderingCountry?: string; // New prop for bordering country
  borderingCountryOptions?: string[]; // New prop for region-based bordering country dropdown
  onBorderingCountryChange?: (countries: string[]) => void; // Now supports multiple
}

const MultipleSelectOptions: React.FC<MultipleSelectOptionsProps> = ({
  isOpen,
  multipleOptions,
  selectedOptions,
  onClose,
  onChange,
  country,
  borderingCountry,
  borderingCountryOptions = [],
  onBorderingCountryChange
}) => {
  // Split initial selected options into regular options and admin levels
  const initialRegularOptions = selectedOptions.filter(opt => multipleOptions.includes(opt));
  const initialAdminLevels = selectedOptions.filter(opt => 
    !multipleOptions.includes(opt) && opt !== 'Specify region'
  );

  const [selectedOptionsLocal, setSelectedOptionsLocal] = useState<string[]>(initialRegularOptions);
  const [selectedAdminLevels, setSelectedAdminLevels] = useState<string[]>(initialAdminLevels);
  const [otherInputValue, setOtherInputValue] = useState<string>('');
  const [adminLevels, setAdminLevels] = useState<AdminLevel[]>([]);
  // Local state for bordering countries (array of strings)
  const [selectedBorderingCountries, setSelectedBorderingCountries] = useState<string[]>(
    borderingCountry ? borderingCountry.split(',').map(c => c.trim()) : []
  );

  // Update local state when selectedOptions prop changes
  useEffect(() => {
    const newRegularOptions = selectedOptions.filter(opt => multipleOptions.includes(opt));
    const newAdminLevels = selectedOptions.filter(opt => 
      !multipleOptions.includes(opt) && opt !== 'Specify region'
    );
    setSelectedOptionsLocal(newRegularOptions);
    setSelectedAdminLevels(newAdminLevels);
    setSelectedBorderingCountries(borderingCountry ? borderingCountry.split(',').map(c => c.trim()) : []);
  }, [selectedOptions, multipleOptions, borderingCountry]);

  // Reset local state when modal opens to ensure proper syncing
  useEffect(() => {
    if (isOpen) {
      const newRegularOptions = selectedOptions.filter(opt => multipleOptions.includes(opt));
      const newAdminLevels = selectedOptions.filter(opt => 
        !multipleOptions.includes(opt) && opt !== 'Specify region'
      );
      
      setSelectedOptionsLocal(newRegularOptions);
      setSelectedAdminLevels(newAdminLevels);
    }
  }, [isOpen, selectedOptions, multipleOptions]);

  // Fetch admin levels when "Specify region" is selected
  const fetchAdminLevels = useCallback(async () => {
    try {
      if (!country) {
        console.log('No country available for admin levels');
        setAdminLevels([]);
        return;
      }

      console.log('Fetching admin levels for country:', country);
      
      const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country: country
        })
      });

      const data = await response.json();
      
      if (data && data.data && data.data.states) {
        const adminLevelsData = data.data.states.map((state: any) => ({
          id: state.state_code || state.name,
          name: state.name
        }));
        
        console.log('Received admin levels:', adminLevelsData);
        setAdminLevels(adminLevelsData);
      } else {
        console.error("Unexpected API response format:", data);
        setAdminLevels([]);
      }
    } catch (error) {
      console.error("Error fetching admin levels:", error);
      setAdminLevels([]);
    }
  }, [country]);

  useEffect(() => {
    if (selectedOptionsLocal.includes("Specify region")) {
      fetchAdminLevels();
    }
  }, [selectedOptionsLocal, fetchAdminLevels]);

  const handleOptionChange = (option: string) => {
    if (selectedOptionsLocal.includes(option)) {
      const newSelected = selectedOptionsLocal.filter(opt => opt !== option);
      setSelectedOptionsLocal(newSelected);
      
      // If removing "Specify region", also clear selected admin levels
      if (option === "Specify region") {
        setSelectedAdminLevels([]);
      }
    } else {
      const newSelected = [...selectedOptionsLocal, option];
      setSelectedOptionsLocal(newSelected);
    }
  };

  const handleAdminLevelChange = (adminLevel: string) => {
    if (selectedAdminLevels.includes(adminLevel)) {
      setSelectedAdminLevels(selectedAdminLevels.filter(level => level !== adminLevel));
    } else {
      setSelectedAdminLevels([...selectedAdminLevels, adminLevel]);
    }
  };

  const includesOther = () => {
    return selectedOptionsLocal.includes('Other');
  };

  const saveSelection = () => {
    // Combine selected options, admin levels, bordering countries, and other input if needed
    let finalOptions: string[] = [];
    if (selectedOptionsLocal.includes("Specify region")) {
      finalOptions = [
        ...selectedOptionsLocal.filter(opt => opt !== "Specify region"),
        ...selectedAdminLevels
      ];
    } else if (includesOther() && otherInputValue.trim()) {
      finalOptions = [otherInputValue.trim()];
    } else {
      finalOptions = [...selectedOptionsLocal];
    }
    // If 'Within 50km from the border' is selected, add it to finalOptions
    if (selectedOptionsLocal.includes('Within 50km from the border')) {
      // Remove any previous 'Within 50km from the border' entries
      finalOptions = finalOptions.filter(opt => opt !== 'Within 50km from the border');
      finalOptions.push('Within 50km from the border');
    }
    // Save bordering countries as a comma-separated string
    if (selectedOptionsLocal.includes('Within 50km from the border') && onBorderingCountryChange) {
      onBorderingCountryChange(selectedBorderingCountries);
    }
    onChange(finalOptions);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded shadow-lg w-96">
        <h2 className="text-lg font-semibold mb-4">Select</h2>

        {/* Options with Nested Admin Levels */}
        {multipleOptions.map(option => (
          <div key={option}>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedOptionsLocal.includes(option)}
                onChange={() => handleOptionChange(option)}
                className="text-green-greenMain focus:ring-green-greenMain focus:border-green-greenMain"
              />
              <span>{option}</span>
            </label>
            
            {/* Admin Levels Dropdown */}
            {option === 'Specify region' && selectedOptionsLocal.includes('Specify region') && (
              <div className="ml-8 mt-1 py-1">
                {adminLevels.length === 0 ? (
                  <div className="text-gray-500 text-xs">
                    Loading admin levels...
                  </div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-2 border-l-2 border-gray-100 pl-2">
                    {adminLevels.map(adminLevel => (
                      <label 
                        key={adminLevel.id}
                        className="flex items-center space-x-2 hover:bg-gray-50 px-1 py-0.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAdminLevels.includes(adminLevel.name)}
                          onChange={() => handleAdminLevelChange(adminLevel.name)}
                          className="text-green-greenMain focus:ring-green-greenMain focus:border-green-greenMain"
                        />
                        <span className="text-sm text-gray-700">{adminLevel.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Other Input */}
        {includesOther() && (
          <input
            className="border border-gray-300 rounded w-full p-2 text-left mt-2"
            value={otherInputValue}
            onChange={(e) => setOtherInputValue(e.target.value)}
            placeholder="Please specify here..."
          />
        )}

        {/* Conditional bordering country input */}
        {selectedOptionsLocal.includes('Within 50km from the border') && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Please select bordering country/countries:
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-100 rounded p-2 bg-white">
              {borderingCountryOptions.map(option => {
                const checked = selectedBorderingCountries.includes(option);
                return (
                  <label key={option} className="flex items-center space-x-2 mb-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        let updated = [...selectedBorderingCountries];
                        if (e.target.checked) {
                          updated.push(option);
                        } else {
                          updated = updated.filter(c => c !== option);
                        }
                        setSelectedBorderingCountries(updated);
                      }}
                      className="text-green-greenMain focus:ring-green-greenMain focus:border-green-greenMain"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end space-x-2">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={saveSelection} 
            className="px-4 py-2 bg-green-greenMain hover:bg-green-greenMain2 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultipleSelectOptions;
