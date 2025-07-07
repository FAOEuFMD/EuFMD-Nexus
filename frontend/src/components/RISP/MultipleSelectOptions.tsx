import React, { useEffect, useState } from 'react';

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
}

const MultipleSelectOptions: React.FC<MultipleSelectOptionsProps> = ({
  isOpen,
  multipleOptions,
  selectedOptions,
  onClose,
  onChange
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

  // Fetch admin levels when "Specify region" is selected
  useEffect(() => {
    if (selectedOptionsLocal.includes("Specify region")) {
      fetchAdminLevels();
    }
  }, [selectedOptionsLocal]);

  // Mock function to fetch admin levels (replace with actual API call)
  const fetchAdminLevels = async () => {
    try {
      // This would be your API call
      // const response = await fetch('/api/admin-levels');
      // const data = await response.json();
      
      // For now, using mock data
      const mockAdminLevels = [
        { id: "1", name: "Region 1" },
        { id: "2", name: "Region 2" },
        { id: "3", name: "Region 3" },
        { id: "4", name: "Region 4" },
      ];
      
      setAdminLevels(mockAdminLevels);
    } catch (error) {
      console.error("Error fetching admin levels:", error);
    }
  };

  const handleOptionChange = (option: string) => {
    if (selectedOptionsLocal.includes(option)) {
      setSelectedOptionsLocal(selectedOptionsLocal.filter(opt => opt !== option));
      
      // If removing "Specify region", also clear selected admin levels
      if (option === "Specify region") {
        setSelectedAdminLevels([]);
      }
    } else {
      setSelectedOptionsLocal([...selectedOptionsLocal, option]);
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
    // Combine selected options, admin levels, and other input if needed
    let finalOptions = [...selectedOptionsLocal];
    
    if (selectedOptionsLocal.includes("Specify region")) {
      finalOptions = finalOptions.concat(selectedAdminLevels);
    }
    
    if (includesOther() && otherInputValue.trim()) {
      finalOptions.push(otherInputValue.trim());
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
                className="text-green-600 focus:ring-green-500"
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
                          className="text-green-600 focus:ring-green-500"
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

        <div className="mt-4 flex justify-end space-x-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Cancel
          </button>
          <button 
            onClick={saveSelection} 
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultipleSelectOptions;
