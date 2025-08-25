import React, { useState, useEffect } from 'react';
import { hierarchicalSpeciesOptions, singleSpeciesOptions } from '../../services/risp/rispService';

interface HierarchicalSpeciesSelectorProps {
  isOpen: boolean;
  selectedOptions: string[];
  onClose: () => void;
  onChange: (options: string[]) => void;
}

const HierarchicalSpeciesSelector: React.FC<HierarchicalSpeciesSelectorProps> = ({
  isOpen,
  selectedOptions,
  onClose,
  onChange
}) => {
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(selectedOptions);

  // Update local state when selectedOptions prop changes
  useEffect(() => {
    setSelectedSpecies(selectedOptions);
  }, [selectedOptions]);

  // Check if all species in a group are selected
  const isGroupFullySelected = (groupName: string): boolean => {
    const groupSpecies = hierarchicalSpeciesOptions[groupName as keyof typeof hierarchicalSpeciesOptions];
    return groupSpecies.every(species => selectedSpecies.includes(species));
  };

  // Check if some species in a group are selected (for indeterminate state)
  const isGroupPartiallySelected = (groupName: string): boolean => {
    const groupSpecies = hierarchicalSpeciesOptions[groupName as keyof typeof hierarchicalSpeciesOptions];
    return groupSpecies.some(species => selectedSpecies.includes(species)) && !isGroupFullySelected(groupName);
  };

  // Handle group selection (select/deselect all species in group)
  const handleGroupChange = (groupName: string) => {
    const groupSpecies = hierarchicalSpeciesOptions[groupName as keyof typeof hierarchicalSpeciesOptions];
    
    if (isGroupFullySelected(groupName)) {
      // Deselect all species in this group
      const newSelected = selectedSpecies.filter(species => !groupSpecies.includes(species));
      setSelectedSpecies(newSelected);
    } else {
      // Select all species in this group
      const newSelected = [...selectedSpecies];
      groupSpecies.forEach(species => {
        if (!newSelected.includes(species)) {
          newSelected.push(species);
        }
      });
      setSelectedSpecies(newSelected);
    }
  };

  // Handle individual species selection (works for both grouped and single species)
  const handleSpeciesChange = (species: string) => {
    if (selectedSpecies.includes(species)) {
      setSelectedSpecies(selectedSpecies.filter(s => s !== species));
    } else {
      setSelectedSpecies([...selectedSpecies, species]);
    }
  };

  const saveSelection = () => {
    onChange(selectedSpecies);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded shadow-lg w-96 max-h-96 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Select Species (Hierarchical)</h2>

        <div className="space-y-3">
          {/* Hierarchical Groups */}
          {Object.entries(hierarchicalSpeciesOptions).map(([groupName, groupSpecies]) => (
            <div key={groupName} className="border-l-2 border-gray-200 pl-2">
              {/* Group Header */}
              <label className="flex items-center space-x-2 font-medium text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGroupFullySelected(groupName)}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = isGroupPartiallySelected(groupName);
                    }
                  }}
                  onChange={() => handleGroupChange(groupName)}
                  style={{ accentColor: '#15736d' }}
                  className="w-4 h-4"
                />
                <span className="select-none">{groupName}</span>
              </label>

              {/* Group Species */}
              <div className="ml-6 mt-1 space-y-1">
                {groupSpecies.map(species => (
                  <label key={species} className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSpecies.includes(species)}
                      onChange={() => handleSpeciesChange(species)}
                      style={{ accentColor: '#15736d' }}
                      className="w-4 h-4"
                    />
                    <span className="select-none text-sm">{species}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Single Species (no grouping) */}
          {singleSpeciesOptions.map(species => (
            <div key={species}>
              <label className="flex items-center space-x-2 font-medium text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSpecies.includes(species)}
                  onChange={() => handleSpeciesChange(species)}
                  style={{ accentColor: '#15736d' }}
                  className="w-4 h-4"
                />
                <span className="select-none">{species}</span>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-2">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={saveSelection} 
            className="px-4 py-2 text-white rounded transition-colors"
            style={{ backgroundColor: '#15736d' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0f5a56';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#15736d';
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default HierarchicalSpeciesSelector;
