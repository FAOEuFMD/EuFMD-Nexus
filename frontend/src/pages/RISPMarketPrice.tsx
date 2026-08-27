import React, { useEffect, useMemo, useState } from 'react';
import RispNavBar from '../components/RISP/RispNavBar';
import RispEntryIntro from '../components/RISP/RispEntryIntro';
import QuarterSelection from '../components/RISP/QuarterSelection';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

type Species = 'cattle' | 'sheep' | 'pig';
type MarketLevel = 'district' | 'capital';
type Product = 'live' | 'meat';

interface MarketPriceRow {
  id?: number | null;
  species: Species;
  market_level: MarketLevel;
  product: Product;
  price_min: number | '';
  price_max: number | '';
  price_avg: number | '';
  reference: string;
  location: string;
}

const emptyRow = (): MarketPriceRow => ({
  id: null,
  species: 'cattle',
  market_level: 'district',
  product: 'live',
  price_min: '',
  price_max: '',
  price_avg: '',
  reference: '',
  location: '',
});

const RISPMarketPrice: React.FC = () => {
  const { user } = useAuthStore();

  const getPreviousQuarterAndYear = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);
    const y = new Date().getFullYear();
    if (currentQuarter === 1) return { quarter: 'Q4', year: String(y - 1) };
    return { quarter: `Q${currentQuarter - 1}`, year: String(y) };
  };
  const previousPeriod = getPreviousQuarterAndYear();

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, i) => String(y - i));
  }, []);

  const [selectedYear, setSelectedYear] = useState(previousPeriod.year);
  const [selectedQuarter, setSelectedQuarter] = useState(previousPeriod.quarter);
  const [rows, setRows] = useState<MarketPriceRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadRows = async () => {
    try {
      const res = await apiService.risp.getMarketPrices(selectedYear, selectedQuarter);
      const data = res?.data ?? res ?? [];
      if (Array.isArray(data) && data.length > 0) {
        setRows(
          data.map((r: any) => ({
            id: r.id,
            species: r.species,
            market_level: r.market_level,
            product: r.product,
            price_min: r.price_min ?? '',
            price_max: r.price_max ?? '',
            price_avg: r.price_avg ?? '',
            reference: r.reference || '',
            location: r.location || '',
          }))
        );
      } else {
        setRows([emptyRow()]);
      }
    } catch (e) {
      console.error(e);
      setRows([emptyRow()]);
    }
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedQuarter, user?.id]);

  const updateRow = (index: number, field: keyof MarketPriceRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = async (index: number) => {
    const row = rows[index];
    if (row.id) {
      try {
        await apiService.risp.removeMarketPrice(row.id);
      } catch (e) {
        console.error(e);
        alert('Failed to remove row');
        return;
      }
    }
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
  };

  const saveAll = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        year: selectedYear,
        quarter: selectedQuarter,
        rows: rows
          .filter(
            (r) =>
              r.price_min !== '' ||
              r.price_max !== '' ||
              r.price_avg !== '' ||
              (r.reference && r.reference.trim())
          )
          .map((r) => ({
            id: r.id || undefined,
            species: r.species,
            market_level: r.market_level,
            product: r.product,
            price_min: r.price_min === '' ? null : Number(r.price_min),
            price_max: r.price_max === '' ? null : Number(r.price_max),
            price_avg: r.price_avg === '' ? null : Number(r.price_avg),
            reference: r.reference || null,
            location: r.location || null,
          })),
      };
      await apiService.risp.saveMarketPrices(payload);
      setMessage('Market prices saved.');
      await loadRows();
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.detail || e?.message || 'Failed to save market prices');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <RispNavBar />
      <div className="w-full overflow-x-auto px-4">
        <RispEntryIntro
          bulkCategory="marketprice"
          pageHint="Report livestock market prices (min / max / average) by species, market level and product for the selected quarter."
        />

        <div className="flex gap-2.5 items-center px-7" style={{ maxWidth: '300px' }}>
          <QuarterSelection
            years={years}
            quarters={['Q1', 'Q2', 'Q3', 'Q4']}
            selectedYear={selectedYear}
            selectedQuarter={selectedQuarter}
            onYearChange={setSelectedYear}
            onQuarterChange={setSelectedQuarter}
          />
        </div>

        <div className="bg-white rounded-lg mb-8 p-6 border-2 border-green-greenMain overflow-x-auto">
          <table className="min-w-full border border-white bg-white text-center tracking-wider text-sm">
            <thead>
              <tr className="bg-green-greenMain text-white text-sm font-medium capitalize whitespace-nowrap">
                <th className="py-3 px-2 border border-white">Species</th>
                <th className="py-3 px-2 border border-white">Market level</th>
                <th className="py-3 px-2 border border-white">Product</th>
                <th className="py-3 px-2 border border-white">Min</th>
                <th className="py-3 px-2 border border-white">Max</th>
                <th className="py-3 px-2 border border-white">Average</th>
                <th className="py-3 px-2 border border-white">Location (optional)</th>
                <th className="py-3 px-2 border border-white">Reference</th>
                <th className="py-3 px-2 border border-white"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="p-2">
                    <select
                      className="w-full h-[38px] border border-gray-300 rounded-md text-sm"
                      value={row.species}
                      onChange={(e) => updateRow(index, 'species', e.target.value)}
                    >
                      <option value="cattle">Cattle</option>
                      <option value="sheep">Sheep</option>
                      <option value="pig">Pig</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full h-[38px] border border-gray-300 rounded-md text-sm"
                      value={row.market_level}
                      onChange={(e) => updateRow(index, 'market_level', e.target.value)}
                    >
                      <option value="district">District</option>
                      <option value="capital">Capital</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full h-[38px] border border-gray-300 rounded-md text-sm"
                      value={row.product}
                      onChange={(e) => updateRow(index, 'product', e.target.value)}
                    >
                      <option value="live">Live</option>
                      <option value="meat">Meat</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full h-[38px] border border-gray-300 rounded-md px-2 text-sm"
                      value={row.price_min}
                      onChange={(e) =>
                        updateRow(index, 'price_min', e.target.value === '' ? '' : e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full h-[38px] border border-gray-300 rounded-md px-2 text-sm"
                      value={row.price_max}
                      onChange={(e) =>
                        updateRow(index, 'price_max', e.target.value === '' ? '' : e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full h-[38px] border border-gray-300 rounded-md px-2 text-sm"
                      value={row.price_avg}
                      onChange={(e) =>
                        updateRow(index, 'price_avg', e.target.value === '' ? '' : e.target.value)
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full h-[38px] border border-gray-300 rounded-md px-2 text-sm"
                      value={row.location}
                      onChange={(e) => updateRow(index, 'location', e.target.value)}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full h-[38px] border border-gray-300 rounded-md px-2 text-sm"
                      value={row.reference}
                      onChange={(e) => updateRow(index, 'reference', e.target.value)}
                      placeholder="Source / reference"
                    />
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={addRow}
              className="px-4 py-2 border-2 border-green-greenMain text-green-greenMain rounded font-semibold hover:bg-green-50"
            >
              Add price line
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="px-6 py-2 bg-green-greenMain text-white rounded font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save market prices'}
            </button>
          </div>
          {message && <p className="text-center text-sm text-green-700 mt-3">{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default RISPMarketPrice;
