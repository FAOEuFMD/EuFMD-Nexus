import React, { useState, useEffect } from 'react';

// Types
interface HerdImmunityRecord {
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

// Color scale for the heatmap (light yellow to dark red)
const getHeatmapColor = (count: number, maxCount: number): string => {
  if (count === 0) return '#fefce8';
  const ratio = count / maxCount;
  if (ratio < 0.15) return '#fef9c3';
  if (ratio < 0.3) return '#fde047';
  if (ratio < 0.45) return '#facc15';
  if (ratio < 0.6) return '#f97316';
  if (ratio < 0.75) return '#dc2626';
  return '#991b1b';
};

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

// Pure SVG Bar Chart for Herd Immunity
const HerdImmunityChart: React.FC<{ data: HerdImmunityRecord[] }> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartWidth = 600;
  const chartHeight = 340;
  const marginTop = 20;
  const marginRight = 30;
  const marginBottom = 100;
  const marginLeft = 55;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;
  const threshold = 70;

  const sortedData = [...data].sort((a, b) => a.coverage_percentage - b.coverage_percentage);

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
          const color = item.coverage_percentage < 70 ? '#ef4444' : '#22c55e';
          const isHovered = hoveredIndex === i;

          return (
            <g key={item.district_name} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={3} opacity={isHovered ? 0.85 : 1} />
              {isHovered && (
                <g>
                  <rect x={Math.min(x, marginLeft + plotWidth - 180)} y={Math.max(marginTop, y - 78)} width={180} height={72} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#shadow)" />
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 16, y - 62)} fontSize={11} fontWeight="bold" fill="#1f2937">{item.district_name}</text>
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 30, y - 48)} fontSize={10} fill="#4b5563">Target: {item.total_target?.toLocaleString()}</text>
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 44, y - 34)} fontSize={10} fill="#4b5563">Injected: {item.total_injected?.toLocaleString()}</text>
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 172)} y={Math.max(marginTop + 58, y - 20)} fontSize={10} fontWeight="bold" fill={item.coverage_percentage < 70 ? '#dc2626' : '#16a34a'}>Coverage: {item.coverage_percentage}%</text>
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
              {truncateName(item.district_name)}
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

  const [matrixData, setMatrixData] = useState<SerotypeStrainRecord[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixError, setMatrixError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchData = async () => {
      setMatrixLoading(true);
      setMatrixError(null);
      try {
        const params = new URLSearchParams();
        if (filterCountry && filterCountry !== 'all') params.append('country', filterCountry);
        if (filterDateFrom) params.append('date_from', filterDateFrom);
        if (filterDateTo) params.append('date_to', filterDateTo);
        const qs = params.toString();
        const res = await fetch(`/api/tcc/serotype-vs-strain-matrix${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setMatrixData(result.data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setMatrixError(`Failed to load matrix data: ${message}`);
      } finally {
        setMatrixLoading(false);
      }
    };
    fetchData();
  }, [filterCountry, filterDateFrom, filterDateTo]);

  const serotypes = Array.from(new Set(matrixData.map((d) => d.serotype))).sort();
  const vaccineStrains = Array.from(new Set(matrixData.map((d) => d.vaccine_strain))).sort();
  const maxOutbreakCount = matrixData.length > 0 ? Math.max(...matrixData.map((d) => d.outbreak_count)) : 1;

  const matrixLookup = new Map<string, number>();
  matrixData.forEach((d) => { matrixLookup.set(`${d.serotype}|${d.vaccine_strain}`, d.outbreak_count); });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 font-martaBold">
        Vaccine Effectiveness & Risk Analysis
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Herd Immunity Gap Bar Chart */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            District Vaccination Coverage vs. Herd Immunity Threshold
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Cattle vaccination coverage by district. The dashed line represents the 70% herd immunity threshold.
          </p>
          {herdLoading ? (
            <div style={{ height: 350 }}><SkeletonLoader /></div>
          ) : herdError ? (
            <div className="text-center py-8 text-red-500 text-sm">{herdError}</div>
          ) : herdData.length === 0 ? (
            <EmptyState message="No vaccination coverage data available" />
          ) : (
            <HerdImmunityChart data={herdData} />
          )}
        </div>

        {/* Chart 2: Serotype vs Vaccine Strain Heatmap */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Outbreak Serotypes vs. Deployed Vaccine Strains
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Shows how many outbreaks of each serotype (rows) occurred in districts using each vaccine strain (columns).
            A high count where the serotype differs from the vaccine strain suggests the vaccine may not protect against that serotype.
            Green diagonal (same serotype = strain) indicates good match. Red off-diagonal cells indicate potential gaps.
          </p>
          {matrixLoading ? (
            <div style={{ height: 350 }}><SkeletonLoader /></div>
          ) : matrixError ? (
            <div className="text-center py-8 text-red-500 text-sm">{matrixError}</div>
          ) : matrixData.length === 0 ? (
            <EmptyState message="No serotype vs. strain data available" />
          ) : (
            <div className="overflow-x-auto">
              <div className="grid gap-px bg-gray-200" style={{ gridTemplateColumns: `120px repeat(${vaccineStrains.length}, minmax(80px, 1fr))` }}>
                <div className="bg-gray-100 p-2 text-xs font-semibold text-gray-600 flex items-end justify-center">Serotype &darr; &nbsp; Strain &rarr;</div>
                {vaccineStrains.map((strain) => (
                  <div key={`hdr-${strain}`} className="bg-gray-100 p-2 text-xs font-semibold text-gray-700 text-center flex items-end justify-center">{strain}</div>
                ))}
                {serotypes.map((serotype) => (
                  <React.Fragment key={`row-${serotype}`}>
                    <div className="bg-gray-50 p-2 text-xs font-semibold text-gray-700 flex items-center">{serotype}</div>
                    {vaccineStrains.map((strain) => {
                      const count = matrixLookup.get(`${serotype}|${strain}`) || 0;
                      const isMatch = serotype === strain;
                      let bgColor: string;
                      let textColor = '#1f2937';
                      if (count === 0) {
                        bgColor = isMatch ? '#f0fdf4' : '#fefce8';
                      } else if (isMatch) {
                        // Match: green scale (good)
                        const ratio = count / maxOutbreakCount;
                        bgColor = ratio < 0.33 ? '#bbf7d0' : ratio < 0.66 ? '#4ade80' : '#16a34a';
                        textColor = ratio > 0.5 ? '#fff' : '#1f2937';
                      } else {
                        // Mismatch: red scale (risk)
                        bgColor = getHeatmapColor(count, maxOutbreakCount);
                        textColor = count > maxOutbreakCount * 0.45 ? '#fff' : '#1f2937';
                      }
                      return (
                        <div key={`cell-${serotype}-${strain}`} className="p-2 text-xs font-medium flex items-center justify-center cursor-default transition-colors" style={{ backgroundColor: bgColor, color: textColor }} title={isMatch ? `${serotype} = ${strain} (match): ${count} outbreak(s)` : `${serotype} vs ${strain} (mismatch): ${count} outbreak(s)`}>{count}</div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 flex-wrap">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#bbf7d0' }} />
                  <span>Match (green)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fde047' }} />
                  <span>Low risk</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }} />
                  <span>High risk (red)</span>
                </div>
                <span className="text-gray-400">| number = outbreak count</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VaccineRiskView;