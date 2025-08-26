import React, { useState, useEffect } from 'react';
import { hierarchicalSpeciesOptions, singleSpeciesOptions } from '../../services/risp/rispService';

interface HierarchicalSpeciesSelectorProps {
  isOpen: boolean;
  selectedOptions: string[];
  onClose: () => void;
  onChange: (options: string[]) => void;
  disease?: string; // Add disease prop for filtering
}

const HierarchicalSpeciesSelector: React.FC<HierarchicalSpeciesSelectorProps> = ({
  isOpen,
  selectedOptions,
  onClose,
  onChange,
  disease
}) => {
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(selectedOptions);

  // Function to get disease-specific species options
  const getFilteredSpeciesOptions = () => {
    if (!disease) return { hierarchical: hierarchicalSpeciesOptions, single: singleSpeciesOptions };

    const diseaseName = disease.toLowerCase();
    
    if (diseaseName.includes('lsd') || diseaseName.includes('lumpy')) {
      // LSD affects only cattle and buffalo (large ruminants)
      return {
        hierarchical: { 'Large ruminants': ['Cattle', 'Buffalo'] },
        single: ['Wildlife', 'Information not available']
      };
    } else if (diseaseName.includes('ppr') || diseaseName.includes('peste')) {
      // PPR affects only small ruminants
      return {
        hierarchical: { 'Small ruminants': ['Goats', 'Sheep'] },
        single: ['Wildlife', 'Information not available']
      };
    } else if (diseaseName.includes('spgp') || diseaseName.includes('sheep') || diseaseName.includes('goat')) {
      // SPGP affects sheep and goats
      return {
        hierarchical: { 'Small ruminants': ['Goats', 'Sheep'] },
        single: ['Information not available']
      };
    } else if (diseaseName.includes('fmd') || diseaseName.includes('foot')) {
      // FMD affects cloven-hoofed animals
      return {
        hierarchical: hierarchicalSpeciesOptions, // All ruminants
        single: ['Pigs', 'Wildlife', 'Information not available']
      };
    } else if (diseaseName.includes('rvf') || diseaseName.includes('rift')) {
      // RVF affects multiple species
      return {
        hierarchical: hierarchicalSpeciesOptions, // All ruminants
        single: ['Wildlife', 'Information not available']
      };
    }
    
    // Default: show all options
    return { hierarchical: hierarchicalSpeciesOptions, single: singleSpeciesOptions };
  };

  const filteredOptions = getFilteredSpeciesOptions();

  // Update local state when selectedOptions prop changes
  useEffect(() => {
    setSelectedSpecies(selectedOptions);
  }, [selectedOptions]);

  // Reset local state when modal opens to ensure proper syncing
  useEffect(() => {
    if (isOpen) {
      setSelectedSpecies(selectedOptions);
    }
  }, [isOpen, selectedOptions]);

  // Check if all species in a group are selected
  const isGroupFullySelected = (groupName: string): boolean => {
    const groupSpecies = filteredOptions.hierarchical[groupName as keyof typeof filteredOptions.hierarchical];
    return groupSpecies ? groupSpecies.every(species => selectedSpecies.includes(species)) : false;
  };

  // Check if some species in a group are selected (for indeterminate state)
  const isGroupPartiallySelected = (groupName: string): boolean => {
    const groupSpecies = filteredOptions.hierarchical[groupName as keyof typeof filteredOptions.hierarchical];
    return groupSpecies ? (groupSpecies.some(species => selectedSpecies.includes(species)) && !isGroupFullySelected(groupName)) : false;
  };

  // Handle group selection (select/deselect all species in group)
  const handleGroupChange = (groupName: string) => {
    const groupSpecies = filteredOptions.hierarchical[groupName as keyof typeof filteredOptions.hierarchical];
    if (!groupSpecies) return;
    
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
        <h2 className="text-lg font-semibold mb-4">Select Species</h2>

        <div className="space-y-3">
          {/* Hierarchical Groups */}
          {Object.entries(filteredOptions.hierarchical).map(([groupName, groupSpecies]) => (
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
                {groupSpecies.map((species: string) => (
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
          {filteredOptions.single.map(species => (
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
