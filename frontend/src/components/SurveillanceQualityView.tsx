import React, { useState, useEffect } from 'react';

// Types
interface ResponseTimeBucket {
  time_bucket: string;
  outbreak_count: number;
  percentage: number;
}

interface ConfirmationMethod {
  conf_type: string;
  conf_type_name: string;
  outbreak_count: number;
  percentage: number;
}

interface TrendRecord {
  period_label: string;
  conf_type: string;
  outbreak_count: number;
}

// Skeleton loader
const SkeletonLoader: React.FC = () => (
  <div className="animate-pulse space-y-3 py-4">
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
    <div className="h-40 bg-gray-100 rounded" />
  </div>
);

// Empty state
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    <p className="text-sm font-medium">{message}</p>
  </div>
);

// Insight box
const InsightBox: React.FC<{ text: string; type?: 'info' | 'warning' | 'success' }> = ({ text, type = 'info' }) => {
  const styles = {
    info: 'bg-blue-50 border border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
    success: 'bg-green-50 border border-green-200 text-green-800',
  };
  const icons = { info: '\uD83D\uDCA1', warning: '\u26A0', success: '\u2705' };
  return (
    <div className={`mt-3 p-3 rounded-lg text-xs leading-relaxed ${styles[type]}`}>
      <span className="font-semibold">{icons[type]} </span>
      {text}
    </div>
  );
};

// ============ CHART 1: Response Time Distribution (SVG Bar Chart) ============
const ResponseTimeChart: React.FC<{ data: ResponseTimeBucket[]; avgDays: number | null }> = ({ data, avgDays }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const bucketColors: Record<string, string> = {
    'Excellent (0-3 days)': '#16A34A',
    'Good (4-7 days)': '#EAB308',
    'Delayed (8-14 days)': '#EA580C',
    'Critical (>14 days)': '#DC2626',
  };

  const chartWidth = 700;
  const chartHeight = 340;
  const marginTop = 30;
  const marginRight = 20;
  const marginBottom = 100;
  const marginLeft = 50;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const maxCount = Math.max(...data.map((d) => d.outbreak_count || 0), 1);
  const barCount = data.length;
  const groupGap = 20;
  const barWidth = Math.min(80, Math.max(40, (plotWidth - groupGap * (barCount + 1)) / barCount));

  return (
    <div className="overflow-x-auto">
      {/* KPI overlay */}
      {avgDays != null && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm text-gray-600">National Average:</span>
          <span className={`text-2xl font-bold ${avgDays <= 7 ? 'text-green-600' : avgDays <= 14 ? 'text-amber-600' : 'text-red-600'}`}>
            {avgDays} Days
          </span>
        </div>
      )}
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ minWidth: 400 }}>
        <defs>
          <filter id="rt-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = marginTop + plotHeight * (1 - ratio);
          const val = Math.round(ratio * maxCount);
          return (
            <g key={`rtg-${ratio}`}>
              <line x1={marginLeft} y1={y} x2={marginLeft + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#6b7280">{val}</text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text x={14} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={10} fill="#6b7280" transform={`rotate(-90, 14, ${marginTop + plotHeight / 2})`}>
          Number of Outbreaks
        </text>

        {/* Bars */}
        {data.map((item, i) => {
          const x = marginLeft + groupGap + i * (barWidth + groupGap);
          const barHeight = (item.outbreak_count / maxCount) * plotHeight;
          const y = marginTop + plotHeight - barHeight;
          const color = bucketColors[item.time_bucket] || '#6b7280';
          const isHovered = hoveredIndex === i;

          return (
            <g key={`rtb-${i}`}>
              <rect
                x={x} y={y} width={barWidth} height={Math.max(0, barHeight)}
                fill={color} rx={4} opacity={isHovered ? 0.85 : 1}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              />
              {/* Value on top */}
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight="bold" fill={color}>
                {item.outbreak_count}
              </text>
              {/* Percentage label */}
              <text x={x + barWidth / 2} y={y - 18} textAnchor="middle" fontSize={9} fill="#6b7280">
                {item.percentage}%
              </text>
              {/* X-axis label */}
              <text
                x={x + barWidth / 2} y={marginTop + plotHeight + 10}
                textAnchor="end" fontSize={9} fill="#374151"
                transform={`rotate(-40, ${x + barWidth / 2}, ${marginTop + plotHeight + 10})`}
              >
                {item.time_bucket}
              </text>
              {/* Tooltip on hover */}
              {isHovered && (
                <g>
                  <rect x={Math.min(x, marginLeft + plotWidth - 160)} y={Math.max(marginTop, y - 55)} width={155} height={48} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#rt-shadow)" />
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 152)} y={Math.max(marginTop + 16, y - 39)} fontSize={10} fontWeight="bold" fill="#1f2937">{item.time_bucket}</text>
                  <text x={Math.min(x + 8, marginLeft + plotWidth - 152)} y={Math.max(marginTop + 30, y - 25)} fontSize={9} fill="#4b5563">Outbreaks: {item.outbreak_count} ({item.percentage}%)</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ============ CHART 2: Diagnostic Methods (SVG Donut Chart) ============
const DonutChart: React.FC<{ data: ConfirmationMethod[] }> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const typeColors: Record<string, string> = {
    'L': '#2563EB',
    'C': '#F97316',
  };

  const total = data.reduce((sum, d) => sum + d.outbreak_count, 0);
  const labPct = data.find((d) => d.conf_type === 'L')?.percentage || 0;
  const meetsTarget = labPct > 50;

  const cx = 150;
  const cy = 150;
  const outerR = 110;
  const innerR = 70;

  let currentAngle = -Math.PI / 2; // Start from top

  const arcs = data.map((item, i) => {
    const sliceAngle = (item.outbreak_count / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const x1Outer = cx + outerR * Math.cos(startAngle);
    const y1Outer = cy + outerR * Math.sin(startAngle);
    const x2Outer = cx + outerR * Math.cos(endAngle);
    const y2Outer = cy + outerR * Math.sin(endAngle);
    const x1Inner = cx + innerR * Math.cos(endAngle);
    const y1Inner = cy + innerR * Math.sin(endAngle);
    const x2Inner = cx + innerR * Math.cos(startAngle);
    const y2Inner = cy + innerR * Math.sin(startAngle);

    const path = `M ${x1Outer} ${y1Outer} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer} L ${x1Inner} ${y1Inner} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner} Z`;

    return { path, color: typeColors[item.conf_type] || '#6b7280', item, index: i };
  });

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-8">
        <svg width="300" height="300" viewBox="0 0 300 300">
          {arcs.map((arc) => (
            <path
              key={`arc-${arc.index}`}
              d={arc.path}
              fill={arc.color}
              opacity={hoveredIndex === arc.index ? 0.8 : 1}
              stroke="white"
              strokeWidth={2}
              onMouseEnter={() => setHoveredIndex(arc.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {/* Center text */}
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize={24} fontWeight="bold" fill="#1f2937">
            {labPct.toFixed(0)}%
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#6b7280">
            Lab Confirmed
          </text>
        </svg>

        {/* Legend and details */}
        <div className="flex-1">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-3 mb-3">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: typeColors[item.conf_type] || '#6b7280' }} />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">{item.conf_type_name}</div>
                <div className="text-xs text-gray-500">{item.outbreak_count} outbreaks ({item.percentage}%)</div>
              </div>
            </div>
          ))}
          <div className={`mt-4 p-2 rounded text-xs font-medium ${meetsTarget ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {meetsTarget ? '\u2705' : '\u274C'} FAO/OIE Target: {'>'}50% Laboratory Confirmation
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ CHART 3: Surveillance Trends (SVG Stacked Area Chart) ============
const TrendsChart: React.FC<{ data: TrendRecord[] }> = ({ data }) => {
  const [hoveredPeriod, setHoveredPeriod] = useState<string | null>(null);

  // Group data by period
  const periods = Array.from(new Set(data.map((d) => d.period_label))).sort();
  const labData = periods.map((p) => data.find((d) => d.period_label === p && d.conf_type === 'L')?.outbreak_count || 0);
  const clinData = periods.map((p) => data.find((d) => d.period_label === p && d.conf_type === 'C')?.outbreak_count || 0);

  // Stacked values
  const stackedTotal = periods.map((_, i) => labData[i] + clinData[i]);
  const maxVal = Math.max(...stackedTotal, 1);

  const chartWidth = 700;
  const chartHeight = 340;
  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 70;
  const marginLeft = 50;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const pointCount = periods.length;
  const pointGap = pointCount > 1 ? plotWidth / (pointCount - 1) : plotWidth / 2;
  const toX = (i: number) => marginLeft + i * pointGap;
  const toY = (val: number) => marginTop + plotHeight * (1 - val / maxVal);

  // Build area paths
  const buildAreaPath = (vals: number[], baseVals: number[]) => {
    const topPoints: string[] = [];
    const bottomPoints: string[] = [];
    for (let i = 0; i < periods.length; i++) {
      topPoints.push(`${toX(i)},${toY(vals[i])}`);
      bottomPoints.unshift(`${toX(i)},${toY(baseVals[i])}`);
    }
    return `M ${topPoints.join(' L ')} L ${bottomPoints.join(' L ')} Z`;
  };

  // Clinical (bottom) area
  const clinicalArea = buildAreaPath(clinData, periods.map(() => 0));
  // Laboratory (stacked on top) area
  const labArea = buildAreaPath(stackedTotal, clinData);

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ minWidth: 500 }}>
        <defs>
          <filter id="tr-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = marginTop + plotHeight * (1 - ratio);
          const val = Math.round(ratio * maxVal);
          return (
            <g key={`trg-${ratio}`}>
              <line x1={marginLeft} y1={y} x2={marginLeft + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#6b7280">{val}</text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text x={14} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={10} fill="#6b7280" transform={`rotate(-90, 14, ${marginTop + plotHeight / 2})`}>
          Outbreaks Confirmed
        </text>

        {/* Areas (bottom first, then stacked) */}
        <path d={clinicalArea} fill="#F97316" opacity={0.6} />
        <path d={labArea} fill="#2563EB" opacity={0.6} />

        {/* Lines on top of areas */}
        {(() => {
          const clinPoints = clinData.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
          const labPoints = stackedTotal.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
          return (
            <>
              <polyline points={clinPoints} fill="none" stroke="#F97316" strokeWidth={2} />
              <polyline points={labPoints} fill="none" stroke="#2563EB" strokeWidth={2} />
            </>
          );
        })()}

        {/* Dots */}
        {periods.map((_, i) => (
          <React.Fragment key={`td-${i}`}>
            <circle cx={toX(i)} cy={toY(clinData[i])} r={3} fill="#F97316" />
            <circle cx={toX(i)} cy={toY(stackedTotal[i])} r={3} fill="#2563EB" />
          </React.Fragment>
        ))}

        {/* Hover zones */}
        {periods.map((period, i) => {
          const isHovered = hoveredPeriod === period;
          return (
            <g key={`thz-${i}`}>
              <rect
                x={toX(i) - pointGap / 2} y={marginTop} width={pointGap} height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredPeriod(period)}
                onMouseLeave={() => setHoveredPeriod(null)}
                style={{ cursor: 'pointer' }}
              />
              {isHovered && (
                <>
                  <line x1={toX(i)} y1={marginTop} x2={toX(i)} y2={marginTop + plotHeight} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
                  <rect x={Math.min(toX(i) - 75, marginLeft + plotWidth - 160)} y={marginTop + 5} width={150} height={50} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#tr-shadow)" />
                  <text x={Math.min(toX(i) - 67, marginLeft + plotWidth - 152)} y={marginTop + 19} fontSize={10} fontWeight="bold" fill="#1f2937">{period}</text>
                  <text x={Math.min(toX(i) - 67, marginLeft + plotWidth - 152)} y={marginTop + 33} fontSize={9} fill="#2563EB">Lab: {labData[i]}</text>
                  <text x={Math.min(toX(i) - 67, marginLeft + plotWidth - 152)} y={marginTop + 45} fontSize={9} fill="#F97316">Clinical: {clinData[i]}</text>
                </>
              )}
            </g>
          );
        })}

        {/* X-axis labels */}
        {periods.map((period, i) => (
          <text key={`txl-${i}`} x={toX(i)} y={marginTop + plotHeight + 10} textAnchor="end" fontSize={9} fill="#6b7280" transform={`rotate(-45, ${toX(i)}, ${marginTop + plotHeight + 10})`}>
            {period}
          </text>
        ))}

        {/* Legend */}
        <g transform={`translate(${marginLeft + 10}, ${marginTop + 10})`}>
          <rect x={0} y={0} width={12} height={10} fill="#2563EB" rx={1} opacity={0.6} />
          <text x={16} y={9} fontSize={9} fill="#374151">Laboratory</text>
          <rect x={90} y={0} width={12} height={10} fill="#F97316" rx={1} opacity={0.6} />
          <text x={106} y={9} fontSize={9} fill="#374151">Clinical</text>
        </g>
      </svg>
    </div>
  );
};

// ============ MAIN COMPONENT ============
interface SurveillanceQualityViewProps {
  filterNationID?: number;
  filterCountry?: string;
  filterDateFrom?: string;
  filterDateTo?: string;
}

const SurveillanceQualityView: React.FC<SurveillanceQualityViewProps> = ({ filterNationID, filterCountry, filterDateFrom, filterDateTo }) => {
  const [timeData, setTimeData] = useState<ResponseTimeBucket[]>([]);
  const [avgDays, setAvgDays] = useState<number | null>(null);
  const [timeLoading, setTimeLoading] = useState(true);
  const [timeError, setTimeError] = useState<string | null>(null);

  const [methodData, setMethodData] = useState<ConfirmationMethod[]>([]);
  const [methodLoading, setMethodLoading] = useState(true);
  const [methodError, setMethodError] = useState<string | null>(null);

  const [trendData, setTrendData] = useState<TrendRecord[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setTimeLoading(true);
      setTimeError(null);
      try {
        const params = new URLSearchParams();
        if (filterNationID) params.append('nationID', String(filterNationID));
        else if (filterCountry && filterCountry !== 'all') params.append('country', filterCountry);
        if (filterDateFrom) params.append('date_from', filterDateFrom);
        if (filterDateTo) params.append('date_to', filterDateTo);
        const qs = params.toString();
        const res = await fetch(`/api/tcc/surveillance/response-time-distribution${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setTimeData(result.data || []);
        setAvgDays(result.avg_days_to_confirm ?? null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setTimeError(`Failed to load response time data: ${message}`);
      } finally {
        setTimeLoading(false);
      }
    };
    fetchData();
  }, [filterNationID, filterCountry, filterDateFrom, filterDateTo]);

  useEffect(() => {
    const fetchData = async () => {
      setMethodLoading(true);
      setMethodError(null);
      try {
        const params = new URLSearchParams();
        if (filterNationID) params.append('nationID', String(filterNationID));
        else if (filterCountry && filterCountry !== 'all') params.append('country', filterCountry);
        if (filterDateFrom) params.append('date_from', filterDateFrom);
        if (filterDateTo) params.append('date_to', filterDateTo);
        const qs = params.toString();
        const res = await fetch(`/api/tcc/surveillance/confirmation-methods${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setMethodData(result.data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setMethodError(`Failed to load confirmation methods: ${message}`);
      } finally {
        setMethodLoading(false);
      }
    };
    fetchData();
  }, [filterNationID, filterCountry, filterDateFrom, filterDateTo]);

  useEffect(() => {
    const fetchData = async () => {
      setTrendLoading(true);
      setTrendError(null);
      try {
        const params = new URLSearchParams();
        if (filterNationID) params.append('nationID', String(filterNationID));
        else if (filterCountry && filterCountry !== 'all') params.append('country', filterCountry);
        if (filterDateFrom) params.append('date_from', filterDateFrom);
        if (filterDateTo) params.append('date_to', filterDateTo);
        const qs = params.toString();
        const res = await fetch(`/api/tcc/surveillance/trends${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setTrendData(result.data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setTrendError(`Failed to load trends data: ${message}`);
      } finally {
        setTrendLoading(false);
      }
    };
    fetchData();
  }, [filterNationID, filterCountry, filterDateFrom, filterDateTo]);

  const labPct = methodData.find((d) => d.conf_type === 'L')?.percentage || 0;
  const meetsTarget = labPct > 50;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 font-martaBold">
        Surveillance Quality Indicators
      </h2>

      {/* Chart 1: Response Time Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Outbreak Response Time: Date Suspected to Date Confirmed
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Distribution of time-to-confirmation across performance buckets.
        </p>
        {timeLoading ? (
          <div style={{ height: 380 }}><SkeletonLoader /></div>
        ) : timeError ? (
          <div className="text-center py-8 text-red-500 text-sm">{timeError}</div>
        ) : timeData.length === 0 ? (
          <EmptyState message="No response time data available" />
        ) : (
          <ResponseTimeChart data={timeData} avgDays={avgDays} />
        )}
        <InsightBox
          text={`Faster confirmation enables quicker response. A national average of ${avgDays ?? 'N/A'} days means livestock remain at risk during the investigation period.`}
          type={avgDays != null && avgDays <= 7 ? 'success' : avgDays != null && avgDays <= 14 ? 'warning' : 'info'}
        />
      </div>

      {/* Chart 2: Diagnostic Methods */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Diagnostic Confirmation Methods
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Ratio of Laboratory vs Clinical confirmation for outbreak verification.
        </p>
        {methodLoading ? (
          <div style={{ height: 320 }}><SkeletonLoader /></div>
        ) : methodError ? (
          <div className="text-center py-8 text-red-500 text-sm">{methodError}</div>
        ) : methodData.length === 0 ? (
          <EmptyState message="No confirmation method data available" />
        ) : (
          <DonutChart data={methodData} />
        )}
        <InsightBox
          text={meetsTarget
            ? `Laboratory confirmation at ${labPct}% meets the FAO/OIE target of >50%. This indicates strong diagnostic infrastructure.`
            : `Laboratory confirmation at ${labPct}% is below the FAO/OIE target of >50%. Consider investing in laboratory capacity and sample transport networks.`
          }
          type={meetsTarget ? 'success' : 'warning'}
        />
      </div>

      {/* Chart 3: Surveillance Trends */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Diagnostic Capacity Trend Over Time
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Stacked area showing Laboratory vs Clinical confirmations by quarter.
        </p>
        {trendLoading ? (
          <div style={{ height: 380 }}><SkeletonLoader /></div>
        ) : trendError ? (
          <div className="text-center py-8 text-red-500 text-sm">{trendError}</div>
        ) : trendData.length === 0 ? (
          <EmptyState message="No trend data available" />
        ) : (
          <TrendsChart data={trendData} />
        )}
        <InsightBox text="An increasing proportion of Laboratory confirmations over time indicates improving national diagnostic infrastructure." />
      </div>
    </div>
  );
};

export default SurveillanceQualityView;