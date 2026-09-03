import React, { useEffect, useMemo, useState } from 'react';
import type { SoiDistrict } from '../../hooks/useSoiDistricts';

interface SoiDistrictPickerProps {
  isOpen: boolean;
  districts: SoiDistrict[];
  loading?: boolean;
  error?: string | null;
  selectedDistrictId?: number | null;
  onClose: () => void;
  onSelect: (district: SoiDistrict) => void;
}

const SoiDistrictPicker: React.FC<SoiDistrictPickerProps> = ({
  isOpen,
  districts,
  loading = false,
  error = null,
  selectedDistrictId = null,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(selectedDistrictId);

  useEffect(() => {
    if (isOpen) {
      setPickedId(selectedDistrictId);
      setQuery('');
    }
  }, [isOpen, selectedDistrictId]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? districts.filter(
          (d) =>
            d.district_name.toLowerCase().includes(q) ||
            d.province_name.toLowerCase().includes(q)
        )
      : districts;

    const byProvince = new Map<string, SoiDistrict[]>();
    for (const d of filtered) {
      const list = byProvince.get(d.province_name) || [];
      list.push(d);
      byProvince.set(d.province_name, list);
    }
    return Array.from(byProvince.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [districts, query]);

  if (!isOpen) return null;

  const handleSave = () => {
    const picked = districts.find((d) => d.district_id === pickedId);
    if (picked) onSelect(picked);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-3">Select district</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search district or province…"
          className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-sm"
        />

        <div className="flex-1 overflow-y-auto border border-gray-200 rounded p-2 min-h-[200px]">
          {loading && <p className="text-sm text-gray-500 p-2">Loading districts…</p>}
          {error && <p className="text-sm text-red-600 p-2">{error}</p>}
          {!loading && !error && grouped.length === 0 && (
            <p className="text-sm text-gray-500 p-2">No districts found for your country.</p>
          )}
          {!loading &&
            grouped.map(([province, items]) => (
              <div key={province} className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">
                  {province}
                </p>
                <div className="space-y-1">
                  {items.map((d) => (
                    <label
                      key={d.district_id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="soi-district"
                        checked={pickedId === d.district_id}
                        onChange={() => setPickedId(d.district_id)}
                        className="text-green-greenMain focus:ring-green-greenMain"
                      />
                      <span className="text-sm text-gray-800">{d.district_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!pickedId}
            onClick={handleSave}
            className="px-4 py-2 bg-green-greenMain hover:bg-green-greenMain2 text-white rounded disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SoiDistrictPicker;
