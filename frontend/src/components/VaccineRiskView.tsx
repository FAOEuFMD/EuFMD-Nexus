import React, { useState, useEffect } from 'react';

// Types
interface HerdImmunityRecord {
  country: string;
  province_name?: string | null;
  district_name: string;
  total_target: number;
  total_injected: number;
  coverage_percentage: number;
}

interface SerotypeStrainRecord {
  serotype: string;
  vaccine_strain: string;
  outbreak_count: number;
}

// Truncate long district names for the chart
const truncateName = (name: string, maxLen: number = 14): string => {
  if (!name) return '';
  return name.length > maxLen ? name.substring(0, maxLen - 1) + '\u2026' : name;
};

const PRAGMATIST_URL = 'https://www.openfmd.org/dashboard/pragmatist/';

// Skeleton loader
const SkeletonLoader: React.FC = () => (
  <div className="animate-pulse space-y-3 py-4">
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
    <div className="h-4 bg-gray-200 rounded w-5/6" />
    <div className="h-4 bg-gray-200 rounded w-2/3" />
    <div className="h-4 bg-gray-200 rounded w-4/5" />
  </div>
);

// Empty state
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
    <p className="text-sm font-medium">{message}</p>
  </div>
);

type HerdChartMode = 'country' | 'province' | 'district';

const computeCoverage = (totalInjected: number, totalTarget: number) => {
  if (!totalTarget) return 0;
  return Math.round((totalInjected / totalTarget) * 10000) / 100;
};

// Horizontal bar chart so labels stay on the left
const HerdImmunityHorizontalChart: React.FC<{
  title: string;
  rows: { label: string; total_target: number; total_injected: number; coverage_percentage: number }[];
  threshold: number;
}> = ({ title, rows, threshold }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartWidth = 760;
  const chartHeight = 420;
  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 35;
  const marginLeft = 220;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const sorted = [...rows].sort((a, b) => a.coverage_percentage - b.coverage_percentage);
  const barCount = sorted.length;
  const barGap = barCount > 18 ? 4 : 6;
  const barHeight = Math.max(10, Math.min(22, (plotHeight - barGap * (barCount - 1)) / Math.max(1, barCount)));

  const thresholdX = marginLeft + (threshold / 100) * plotWidth;

  return (
    <div className="overflow-x-auto">
      <p className="text-xs font-semibold text-gray-700 mb-2">{title}</p>
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ minWidth: 520 }}>
        <defs>
          <filter id="shadow2" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* X axis grid + labels */}
        {[0, 20, 40, 60, 80, 100].map((tick) => {
          const x = marginLeft + plotWidth * (tick / 100);
          return (
            <g key={`x-${tick}`}>
              <line x1={x} y1={marginTop} x2={x} y2={marginTop + plotHeight} stroke="#e5e7eb" strokeWidth={1} />
              <text x={x} y={marginTop + plotHeight + 22} textAnchor="middle" fontSize={10} fill="#6b7280">
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Threshold line */}
        <line x1={thresholdX} y1={marginTop} x2={thresholdX} y2={marginTop + plotHeight} stroke="#000" strokeWidth={1.5} strokeDasharray="6 3" />
        <text x={Math.min(thresholdX + 6, marginLeft + plotWidth - 20)} y={marginTop + 12} fontSize={9} fill="#000" fontWeight="bold">
          {threshold}%
        </text>

        {/* Bars */}
        {sorted.map((item, i) => {
          const y = marginTop + i * (barHeight + barGap);
          const w = (Math.max(0, Math.min(100, item.coverage_percentage)) / 100) * plotWidth;
          const x = marginLeft;
          const isHovered = hoveredIndex === i;
          const color = item.coverage_percentage < threshold ? '#ef4444' : '#22c55e';
          return (
            <g
              key={`${item.label}-${i}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <text x={marginLeft - 8} y={y + barHeight * 0.72} textAnchor="end" fontSize={10} fill="#374151">
                {item.label.length > 28 ? item.label.slice(0, 27) + '…' : item.label}
              </text>
              <rect x={x} y={y} width={w} height={barHeight} fill={color} rx={3} opacity={isHovered ? 0.85 : 1} />
              <text x={x + Math.min(w + 6, plotWidth - 4)} y={y + barHeight * 0.72} fontSize={10} fill="#111827">
                {item.coverage_percentage}%
              </text>

              {isHovered && (
                <g>
                  <rect x={marginLeft + 10} y={Math.max(marginTop, y - 56)} width={260} height={52} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#shadow2)" />
                  <text x={marginLeft + 18} y={Math.max(marginTop + 16, y - 40)} fontSize={11} fontWeight="bold" fill="#1f2937">
                    {item.label}
                  </text>
                  <text x={marginLeft + 18} y={Math.max(marginTop + 32, y - 24)} fontSize={10} fill="#4b5563">
                    Target: {item.total_target?.toLocaleString()} | Injected: {item.total_injected?.toLocaleString()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Compact vertical chart for aggregated country view
const HerdImmunityCountryChart: React.FC<{
  rows: { label: string; total_target: number; total_injected: number; coverage_percentage: number }[];
  threshold: number;
}> = ({ rows, threshold }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartWidth = 600;
  const chartHeight = 340;
  const marginTop = 20;
  const marginRight = 30;
  const marginBottom = 100;
  const marginLeft = 55;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;
  const sortedData = [...rows].sort((a, b) => a.coverage_percentage - b.coverage_percentage);

  const barCount = sortedData.length;
  const barGap = barCount > 15 ? 2 : 4;
  const barWidth = Math.max(4, Math.min(30, (plotWidth - barGap * (barCount - 1)) / barCount));
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
  const offsetX = marginLeft + (plotWidth - totalBarsWidth) / 2;

  const thresholdY = marginTop + plotHeight * (1 - threshold / 100);

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ minWidth: 400 }}>
        {/* Shadow filter for tooltip */}
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Y-axis gridlines and labels */}
        {[0, 20, 40, 60, 80, 100].map((tick) => {
          const y = marginTop + plotHeight * (1 - tick / 100);
          return (
            <g key={`y-${tick}`}>
              <line x1={marginLeft} y1={y} x2={marginLeft + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#6b7280">{tick}%</text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text x={14} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={11} fill="#6b7280" transform={`rotate(-90, 14, ${marginTop + plotHeight / 2})`}>
          Coverage %
        </text>

        {/* Threshold line */}
        <line x1={marginLeft} y1={thresholdY} x2={marginLeft + plotWidth} y2={thresholdY} stroke="#000" strokeWidth={1.5} strokeDasharray="6 3" />
        <text x={marginLeft + plotWidth + 2} y={thresholdY - 4} fontSize={9} fill="#000" fontWeight="bold">70%</text>

        {/* Bars */}
        {sortedData.map((item, i) => {
          const x = offsetX + i * (barWidth + barGap);
          const barHeight = (item.coverage_percentage / 100) * plotHeight;
          const y = marginTop + plotHeight - barHeight;
          const color = item.coverage_percentage < threshold ? '#ef4444' : '#22c55e';
          const isHovered = hoveredIndex === i;

          return (
            <g key={item.label} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={3} opacity={isHovered ? 0.85 : 1} />
              {isHovered && (
                <g>
                  <rect x={Math.min(x, marginLeft + plotWidth - 180)} y={Math.max(marginTop, y - 78)} width={180} height={72} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#shadow)" />
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 16, y - 62)} fontSize={11} fontWeight="bold" fill="#1f2937">{item.label}</text>
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 30, y - 48)} fontSize={10} fill="#4b5563">Target: {item.total_target?.toLocaleString()}</text>
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 44, y - 34)} fontSize={10} fill="#4b5563">Injected: {item.total_injected?.toLocaleString()}</text>
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 58, y - 20)} fontSize={10} fontWeight="bold" fill={item.coverage_percentage < threshold ? '#dc2626' : '#16a34a'}>Coverage: {item.coverage_percentage}%</text>
                </g>
              )}
            </g>
          );
        })}

        {/* X-axis labels (rotated) */}
        {sortedData.map((item, i) => {
          const x = offsetX + i * (barWidth + barGap) + barWidth / 2;
          const y = marginTop + plotHeight + 10;
          return (
            <text key={`lbl-${i}`} x={x} y={y} textAnchor="end" fontSize={9} fill="#6b7280" transform={`rotate(-50, ${x}, ${y})`}>
              {truncateName(item.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// Main Component
interface VaccineRiskViewProps {
  filterCountry?: string;
  filterDateFrom?: string;
  filterDateTo?: string;
}

const VaccineRiskView: React.FC<VaccineRiskViewProps> = ({ filterCountry, filterDateFrom, filterDateTo }) => {
  const [herdData, setHerdData] = useState<HerdImmunityRecord[]>([]);
  const [herdLoading, setHerdLoading] = useState(true);
  const [herdError, setHerdError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(70);
  const [detailMode, setDetailMode] = useState<HerdChartMode>('district');

  // NOTE: Vaccine matching heatmap removed (see Pragmatist link section below)

  useEffect(() => {
    const fetchData = async () => {
      setHerdLoading(true);
      setHerdError(null);
      try {
        const params = new URLSearchParams();
        if (filterCountry && filterCountry !== 'all') params.append('country', filterCountry);
        if (filterDateFrom) params.append('date_from', filterDateFrom);
        if (filterDateTo) params.append('date_to', filterDateTo);
        const qs = params.toString();
        const res = await fetch(`/api/tcc/herd-immunity-gap${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setHerdData(result.data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setHerdError(`Failed to load herd immunity data: ${message}`);
      } finally {
        setHerdLoading(false);
      }
    };
    fetchData();
  }, [filterCountry, filterDateFrom, filterDateTo]);

  const countryRows = React.useMemo(() => {
    const by = new Map<string, { total_target: number; total_injected: number }>();
    herdData.forEach((r) => {
      const key = r.country || 'Unknown';
      const cur = by.get(key) || { total_target: 0, total_injected: 0 };
      cur.total_target += Number(r.total_target || 0);
      cur.total_injected += Number(r.total_injected || 0);
      by.set(key, cur);
    });
    return Array.from(by.entries()).map(([label, v]) => ({
      label,
      total_target: v.total_target,
      total_injected: v.total_injected,
      coverage_percentage: computeCoverage(v.total_injected, v.total_target),
    }));
  }, [herdData]);

  const detailRows = React.useMemo(() => {
    if (detailMode === 'district') {
      return herdData.map((r) => ({
        label: r.district_name,
        total_target: Number(r.total_target || 0),
        total_injected: Number(r.total_injected || 0),
        coverage_percentage: Number(r.coverage_percentage || 0),
      }));
    }
    if (detailMode === 'province') {
      const by = new Map<string, { total_target: number; total_injected: number }>();
      herdData.forEach((r) => {
        const key = r.province_name || 'Unknown';
        const cur = by.get(key) || { total_target: 0, total_injected: 0 };
        cur.total_target += Number(r.total_target || 0);
        cur.total_injected += Number(r.total_injected || 0);
        by.set(key, cur);
      });
      return Array.from(by.entries()).map(([label, v]) => ({
        label,
        total_target: v.total_target,
        total_injected: v.total_injected,
        coverage_percentage: computeCoverage(v.total_injected, v.total_target),
      }));
    }
    return [];
  }, [herdData, detailMode]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 font-martaBold">
        Vaccine Effectiveness & Risk Analysis
      </h2>

      <div className="grid grid-cols-1 gap-6">
        {/* Chart 1: Country first + movable threshold */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Country Vaccination Coverage vs. Herd Immunity Threshold
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Cattle vaccination coverage aggregated by country. Adjust the threshold as needed.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-xs font-medium text-gray-600">Threshold:</label>
            <input
              type="range"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-56"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-xs"
            />
            <span className="text-xs text-gray-500">%</span>
          </div>
          {herdLoading ? (
            <div style={{ height: 350 }}><SkeletonLoader /></div>
          ) : herdError ? (
            <div className="text-center py-8 text-red-500 text-sm">{herdError}</div>
          ) : herdData.length === 0 ? (
            <EmptyState message="No vaccination coverage data available" />
          ) : (
            <HerdImmunityCountryChart rows={countryRows} threshold={threshold} />
          )}
        </div>

        {/* Chart 2: Detail view (district/province) horizontal, labels on left */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Coverage detail (labels on the left)
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDetailMode('district')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  detailMode === 'district' ? 'bg-[#15736d] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                District
              </button>
              <button
                type="button"
                onClick={() => setDetailMode('province')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  detailMode === 'province' ? 'bg-[#15736d] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Province
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Same data as before, but shown horizontally so the district/province list stays on the left.
          </p>
          {herdLoading ? (
            <div style={{ height: 350 }}><SkeletonLoader /></div>
          ) : herdError ? (
            <div className="text-center py-8 text-red-500 text-sm">{herdError}</div>
          ) : detailRows.length === 0 ? (
            <EmptyState message="No coverage detail available" />
          ) : (
            <HerdImmunityHorizontalChart
              title={detailMode === 'district' ? 'District coverage' : 'Province coverage'}
              rows={detailRows}
              threshold={threshold}
            />
          )}
        </div>

        {/* Chart 2: Vaccine strain matching (external tool) */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Vaccine strain matching (FMD)
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Use PRAGMATIST (WRLFMD/EuFMD) for evidence-based FMD vaccine strain prioritisation.
          </p>
          <a
            href={PRAGMATIST_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#15736d] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open PRAGMATIST
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v11h11" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

export default VaccineRiskView;