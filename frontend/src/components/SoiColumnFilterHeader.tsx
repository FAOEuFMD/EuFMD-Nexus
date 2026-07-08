import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SoiColumnFilterProps {
  label: string;
  columnKey: string;
  uniqueValues: string[];
  selectedValues: Set<string> | undefined;
  onFilterChange: (columnKey: string, selected: Set<string> | undefined) => void;
  compact?: boolean;
}

export const SoiColumnFilter: React.FC<SoiColumnFilterProps> = ({
  label,
  columnKey,
  uniqueValues,
  selectedValues,
  onFilterChange,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = selectedValues !== undefined;

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uniqueValues;
    return uniqueValues.filter((v) => v.toLowerCase().includes(q));
  }, [uniqueValues, search]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isChecked = (value: string) => {
    if (!isActive) return true;
    return selectedValues!.has(value);
  };

  const toggleValue = (value: string) => {
    if (!isActive) {
      const next = new Set(uniqueValues);
      next.delete(value);
      onFilterChange(columnKey, next);
      return;
    }
    const next = new Set(selectedValues);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    if (next.size === uniqueValues.length) {
      onFilterChange(columnKey, undefined);
    } else {
      onFilterChange(columnKey, next);
    }
  };

  const selectAll = () => onFilterChange(columnKey, undefined);
  const clearFilter = () => onFilterChange(columnKey, new Set());

  return (
    <div className="relative" ref={dropdownRef}>
      <div className={`flex items-center gap-1 min-w-0 ${compact ? 'justify-center' : ''}`}>
        {!compact && (
          <span className="truncate text-xs font-medium text-gray-600 uppercase tracking-wider" title={label}>
            {label.replace(/_/g, ' ')}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors ${
            isActive ? 'text-[#15736d]' : 'text-gray-400'
          }`}
          title={`Filter ${label}`}
          aria-label={`Filter ${label}`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 w-52 bg-white border border-gray-200 rounded-lg shadow-lg text-left normal-case tracking-normal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-gray-100">
            <p className="text-[10px] font-medium text-gray-500 mb-1 truncate">{label.replace(/_/g, ' ')}</p>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#15736d]"
            />
          </div>
          <div className="flex gap-2 px-2 py-1.5 border-b border-gray-100">
            <button type="button" onClick={selectAll} className="text-[10px] text-[#15736d] hover:underline">
              Select all
            </button>
            <button type="button" onClick={clearFilter} className="text-[10px] text-gray-500 hover:underline">
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-1 text-xs text-gray-400">No values</p>
            ) : (
              filteredOptions.map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked(value)}
                    onChange={() => toggleValue(value)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#15736d] focus:ring-[#15736d]"
                  />
                  <span className="text-xs text-gray-700 truncate" title={value}>
                    {value}
                  </span>
                </label>
              ))
            )}
          </div>
          {isActive && (
            <div className="px-2 py-1.5 border-t border-gray-100 text-[10px] text-gray-500">
              {selectedValues!.size} of {uniqueValues.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface SoiColumnFilterHeaderProps extends SoiColumnFilterProps {
  className?: string;
}

const SoiColumnFilterHeader: React.FC<SoiColumnFilterHeaderProps> = ({
  className = '',
  ...filterProps
}) => (
  <th className={`relative px-3 py-2 text-left ${className}`}>
    <SoiColumnFilter {...filterProps} />
  </th>
);

export default SoiColumnFilterHeader;
