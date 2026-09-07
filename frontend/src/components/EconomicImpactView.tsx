import React, { useState, useEffect, useMemo } from 'react';

// Types
interface OutbreakPriceRecord {
  periodID: number;
  dt_from: string;
  descrizione: string;
  outbreak_count: number;
  Country?: string | null;
  ctl_dis_liveAVG: number | null;
  ctl_dis_meatAVG: number | null;
  ctl_cap_liveAVG: number | null;
  ctl_cap_meatAVG: number | null;
}

interface DivergenceRecord {
  periodID: number;
  descrizione: string;
  dt_from: string;
  ctl_dis_liveAVG: number | null;
  ctl_cap_liveAVG: number | null;
  live_price_gap: number | null;
  live_price_gap_percent: number | null;
  ctl_dis_meatAVG: number | null;
  ctl_cap_meatAVG: number | null;
  meat_price_gap: number | null;
  meat_price_gap_percent: number | null;
}

interface SpeciesRecord {
  species: string;
  district_live_avg: number | null;
  capital_live_avg: number | null;
  district_meat_avg: number | null;
  capital_meat_avg: number | null;
  price_gap_percent: number | null;
}

// Skeleton loader
const SkeletonLoader: React.FC = () => (
  <div className="animate-pulse space-y-3 py-4">
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
    <div className="h-4 bg-gray-200 rounded w-5/6" />
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
const InsightBox: React.FC<{ text: string; type?: 'info' | 'warning' }> = ({ text, type = 'info' }) => (
  <div className={`mt-3 p-3 rounded-lg text-xs leading-relaxed ${
    type === 'warning'
      ? 'bg-amber-50 border border-amber-200 text-amber-800'
      : 'bg-blue-50 border border-blue-200 text-blue-800'
  }`}>
    <span className="font-semibold">{type === 'warning' ? '\u26A0 Alert: ' : '\uD83D\uDCA1 Insight: '}</span>
    {text}
  </div>
);

// ============ CHART 1: Outbreak vs Price Correlation (Dual-Axis SVG) ============
const OutbreakPriceChart: React.FC<{ data: OutbreakPriceRecord[] }> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; periodLabel: string; outbreakCount: number; prices: { country: string; live: number | null; meat: number | null }[] } | null>(null);

  const chartWidth = 700;
  const chartHeight = 380;
  const marginTop = 20;
  const marginRight = 60;
  const marginBottom = 80;
  const marginLeft = 55;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  // Backend can return multiple rows per period (one per country). Normalize into:
  // - periods: unique time points (bars use outbreaks per period)
  // - priceSeries: per-country live/meat lines across periods
  const periods = React.useMemo(() => {
    const by = new Map<number, { periodID: number; dt_from: string; descrizione: string; outbreak_count: number }>();
    data.forEach((r) => {
      if (!by.has(r.periodID)) {
        by.set(r.periodID, { periodID: r.periodID, dt_from: r.dt_from, descrizione: r.descrizione, outbreak_count: r.outbreak_count || 0 });
      }
    });
    return Array.from(by.values()).sort((a, b) => (a.dt_from || '').localeCompare(b.dt_from || ''));
  }, [data]);

  const countries = React.useMemo(() => {
    const s = new Set<string>();
    data.forEach((r) => { if (r.Country) s.add(r.Country); });
    return Array.from(s).sort();
  }, [data]);

  const priceByCountryPeriod = React.useMemo(() => {
    const map = new Map<string, Map<number, { live: number | null; meat: number | null }>>();
    countries.forEach((c) => map.set(c, new Map()));
    data.forEach((r) => {
      const c = r.Country || null;
      if (!c) return;
      const inner = map.get(c) || new Map<number, { live: number | null; meat: number | null }>();
      inner.set(r.periodID, { live: r.ctl_dis_liveAVG, meat: r.ctl_dis_meatAVG });
      map.set(c, inner);
    });
    return map;
  }, [data, countries]);

  const maxOutbreaks = Math.max(...periods.map((d) => d.outbreak_count || 0), 1);
  // Add headroom so outbreak bars don't visually squash the price lines
  const outbreakAxisMax = Math.max(1, Math.ceil(maxOutbreaks * 1.5));
  // Price axis fixed to 25 USD max so scales are comparable between countries/periods
  const priceMax = 25;

  const barCount = periods.length;
  const barGap = Math.max(2, Math.min(6, plotWidth / barCount * 0.3));
  const barWidth = Math.max(4, Math.min(30, (plotWidth - barGap * (barCount - 1)) / barCount));
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
  const offsetX = marginLeft + (plotWidth - totalBarsWidth) / 2;

  const PRICE_LIVE = '#2563EB';
  const PRICE_MEAT = '#60A5FA';

  const legendCountries = countries.slice(0, 6);
  const hiddenCount = Math.max(0, countries.length - legendCountries.length);

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ minWidth: 500 }}>
        <defs>
          <filter id="op-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Y-axis left gridlines (outbreaks) */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = marginTop + plotHeight * (1 - ratio);
          const val = Math.round(ratio * outbreakAxisMax);
          return (
            <g key={`obl-${ratio}`}>
              <line x1={marginLeft} y1={y} x2={marginLeft + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#ef4444">{val}</text>
            </g>
          );
        })}

        {/* Y-axis right gridlines (prices) */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = marginTop + plotHeight * (1 - ratio);
          const val = Math.round(ratio * priceMax);
          return (
            <g key={`pr-${ratio}`}>
              <text x={marginLeft + plotWidth + 8} y={y + 4} textAnchor="start" fontSize={9} fill="#2563EB">${val}</text>
            </g>
          );
        })}

        {/* Y-axis labels */}
        <text x={12} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={10} fill="#ef4444" transform={`rotate(-90, 12, ${marginTop + plotHeight / 2})`}>
          Outbreaks
        </text>
        <text x={chartWidth - 8} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={10} fill="#2563EB" transform={`rotate(90, ${chartWidth - 8}, ${marginTop + plotHeight / 2})`}>
          Price (USD)
        </text>

        {/* Bars (outbreaks) */}
        {periods.map((item, i) => {
          const x = offsetX + i * (barWidth + barGap);
          const barHeight = ((item.outbreak_count || 0) / outbreakAxisMax) * plotHeight;
          const y = marginTop + plotHeight - barHeight;
          return (
            <rect
              key={`bar-${i}`}
              x={x} y={y} width={barWidth} height={Math.max(0, barHeight)}
              fill="#DC2626" rx={2} opacity={hoveredIndex === i ? 0.7 : 0.85}
              onMouseEnter={() => {
                setHoveredIndex(i);
                const prices = legendCountries.map((c) => {
                  const v = priceByCountryPeriod.get(c)?.get(item.periodID);
                  return { country: c, live: v?.live ?? null, meat: v?.meat ?? null };
                });
                setTooltipData({
                  x: x + barWidth / 2,
                  y: Math.max(marginTop, y - 10),
                  periodLabel: item.descrizione,
                  outbreakCount: item.outbreak_count || 0,
                  prices,
                });
              }}
              onMouseLeave={() => { setHoveredIndex(null); setTooltipData(null); }}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Price lines: always blue (live=solid, meat=dashed) — avoid clashing with red outbreak bars */}
        {countries.map((country) => {
          const per = priceByCountryPeriod.get(country);
          if (!per) return null;

          const livePoints = periods
            .map((p, i) => {
              const v = per.get(p.periodID);
              if (!v || v.live == null) return null;
              const x = offsetX + i * (barWidth + barGap) + barWidth / 2;
              const y = marginTop + plotHeight - (v.live / priceMax) * plotHeight;
              return `${x},${y}`;
            })
            .filter(Boolean)
            .join(' ');

          const meatPoints = periods
            .map((p, i) => {
              const v = per.get(p.periodID);
              if (!v || v.meat == null) return null;
              const x = offsetX + i * (barWidth + barGap) + barWidth / 2;
              const y = marginTop + plotHeight - (v.meat / priceMax) * plotHeight;
              return `${x},${y}`;
            })
            .filter(Boolean)
            .join(' ');

          return (
            <g key={`lines-${country}`}>
              {livePoints ? <polyline points={livePoints} fill="none" stroke={PRICE_LIVE} strokeWidth={2} strokeLinejoin="round" opacity={0.95} /> : null}
              {meatPoints ? <polyline points={meatPoints} fill="none" stroke={PRICE_MEAT} strokeWidth={2} strokeLinejoin="round" strokeDasharray="6 4" opacity={0.95} /> : null}
            </g>
          );
        })}

        {/* X-axis labels */}
        {periods.map((item, i) => {
          const x = offsetX + i * (barWidth + barGap) + barWidth / 2;
          const y = marginTop + plotHeight + 10;
          return (
            <text key={`xl-${i}`} x={x} y={y} textAnchor="end" fontSize={9} fill="#6b7280" transform={`rotate(-45, ${x}, ${y})`}>
              {item.descrizione}
            </text>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${marginLeft + 10}, ${marginTop + 10})`}>
          <rect x={0} y={0} width={12} height={10} fill="#DC2626" rx={1} />
          <text x={16} y={9} fontSize={9} fill="#374151">Outbreaks</text>
          <line x1={90} y1={5} x2={108} y2={5} stroke={PRICE_LIVE} strokeWidth={2} />
          <text x={114} y={9} fontSize={9} fill="#374151">Live (solid)</text>
          <line x1={180} y1={5} x2={198} y2={5} stroke={PRICE_MEAT} strokeWidth={2} strokeDasharray="6 4" />
          <text x={204} y={9} fontSize={9} fill="#374151">Meat (dashed)</text>
        </g>

        {/* Country labels (prices are always blue) */}
        <g transform={`translate(${marginLeft + 10}, ${marginTop + 26})`}>
          {legendCountries.map((c, idx) => {
            const y = idx * 14;
            return (
              <g key={`leg-${c}`} transform={`translate(0, ${y})`}>
                <line x1={0} y1={7} x2={14} y2={7} stroke={PRICE_LIVE} strokeWidth={3} />
                <text x={18} y={10} fontSize={9} fill="#374151">{c}</text>
              </g>
            );
          })}
          {hiddenCount > 0 && (
            <text x={0} y={legendCountries.length * 14 + 10} fontSize={9} fill="#6b7280">
              +{hiddenCount} more
            </text>
          )}
        </g>

        {/* Tooltip */}
        {tooltipData && (
          <g>
            <rect x={Math.min(tooltipData.x - 120, marginLeft + plotWidth - 260)} y={Math.max(marginTop, tooltipData.y - 88)} width={250} height={85} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#op-shadow)" />
            <text x={Math.min(tooltipData.x - 112, marginLeft + plotWidth - 252)} y={Math.max(marginTop + 14, tooltipData.y - 72)} fontSize={10} fontWeight="bold" fill="#1f2937">{tooltipData.periodLabel}</text>
            <text x={Math.min(tooltipData.x - 112, marginLeft + plotWidth - 252)} y={Math.max(marginTop + 28, tooltipData.y - 58)} fontSize={9} fill="#ef4444">Outbreaks: {tooltipData.outbreakCount}</text>
            {tooltipData.prices.slice(0, 3).map((p, idx) => (
              <text key={`tp-${p.country}`} x={Math.min(tooltipData.x - 112, marginLeft + plotWidth - 252)} y={Math.max(marginTop + 42 + idx * 14, tooltipData.y - 44 + idx * 14)} fontSize={9} fill={PRICE_LIVE}>
                {p.country}: L ${p.live?.toLocaleString() ?? '-'} / M ${p.meat?.toLocaleString() ?? '-'}
              </text>
            ))}
            {tooltipData.prices.length > 3 && (
              <text x={Math.min(tooltipData.x - 112, marginLeft + plotWidth - 252)} y={Math.max(marginTop + 84, tooltipData.y - 2)} fontSize={9} fill="#6b7280">
                …
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};

// ============ CHART 2: Capital vs District Divergence (SVG Line Chart) ============
const DivergenceChart: React.FC<{ data: DivergenceRecord[] }> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartWidth = 700;
  const chartHeight = 350;
  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 80;
  const marginLeft = 55;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const allGaps: number[] = [];
  data.forEach((d) => { if (d.live_price_gap_percent != null) allGaps.push(d.live_price_gap_percent); if (d.meat_price_gap_percent != null) allGaps.push(d.meat_price_gap_percent); });
  const minGap = allGaps.length > 0 ? Math.min(...allGaps, 0) : -10;
  const maxGap = allGaps.length > 0 ? Math.max(...allGaps, 10) : 10;
  const gapRange = maxGap - minGap || 1;
  const yPadding = gapRange * 0.1;
  const yMin = minGap - yPadding;
  const yMax = maxGap + yPadding;
  const yRange = yMax - yMin || 1;

  const toY = (val: number) => marginTop + plotHeight * (1 - (val - yMin) / yRange);

  const pointCount = data.length;
  const pointGap = pointCount > 1 ? plotWidth / (pointCount - 1) : plotWidth / 2;
  const toX = (i: number) => marginLeft + i * pointGap;

  const zeroY = toY(0);

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ minWidth: 500 }}>
        <defs>
          <filter id="dv-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const val = yMin + ratio * yRange;
          const y = toY(val);
          return (
            <g key={`dgl-${ratio}`}>
              <line x1={marginLeft} y1={y} x2={marginLeft + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#6b7280">{val.toFixed(0)}%</text>
            </g>
          );
        })}

        {/* Zero reference line */}
        <line x1={marginLeft} y1={zeroY} x2={marginLeft + plotWidth} y2={zeroY} stroke="#000" strokeWidth={1} strokeDasharray="4 3" />
        <text x={marginLeft - 8} y={zeroY + 4} textAnchor="end" fontSize={9} fill="#000" fontWeight="bold">0%</text>

        {/* Y-axis label */}
        <text x={14} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={10} fill="#6b7280" transform={`rotate(-90, 14, ${marginTop + plotHeight / 2})`}>
          Price Gap (%)
        </text>

        {/* Line: Live Price Gap */}
        {(() => {
          const points = data
            .map((item, i) => {
              if (item.live_price_gap_percent == null) return null;
              return `${toX(i)},${toY(item.live_price_gap_percent)}`;
            })
            .filter(Boolean)
            .join(' ');
          return points ? <polyline points={points} fill="none" stroke="#EA580C" strokeWidth={2} strokeLinejoin="round" /> : null;
        })()}

        {/* Line: Meat Price Gap */}
        {(() => {
          const points = data
            .map((item, i) => {
              if (item.meat_price_gap_percent == null) return null;
              return `${toX(i)},${toY(item.meat_price_gap_percent)}`;
            })
            .filter(Boolean)
            .join(' ');
          return points ? <polyline points={points} fill="none" stroke="#9333EA" strokeWidth={2} strokeLinejoin="round" /> : null;
        })()}

        {/* Dots */}
        {data.map((item, i) => {
          const dots: React.ReactNode[] = [];
          const cx = toX(i);
          if (item.live_price_gap_percent != null) {
            dots.push(<circle key={`lg-${i}`} cx={cx} cy={toY(item.live_price_gap_percent)} r={3} fill="#EA580C" />);
          }
          if (item.meat_price_gap_percent != null) {
            dots.push(<circle key={`mg-${i}`} cx={cx} cy={toY(item.meat_price_gap_percent)} r={3} fill="#9333EA" />);
          }
          return dots;
        })}

        {/* Hover zones */}
        {data.map((item, i) => {
          const cx = toX(i);
          const isHovered = hoveredIndex === i;
          return (
            <g key={`hz-${i}`}>
              <rect
                x={cx - pointGap / 2} y={marginTop} width={pointGap} height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              />
              {isHovered && (
                <>
                  <line x1={cx} y1={marginTop} x2={cx} y2={marginTop + plotHeight} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
                  <rect x={Math.min(cx - 85, marginLeft + plotWidth - 180)} y={marginTop + 5} width={170} height={55} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#dv-shadow)" />
                  <text x={Math.min(cx - 77, marginLeft + plotWidth - 172)} y={marginTop + 19} fontSize={10} fontWeight="bold" fill="#1f2937">{item.descrizione}</text>
                  <text x={Math.min(cx - 77, marginLeft + plotWidth - 172)} y={marginTop + 33} fontSize={9} fill="#EA580C">Live Gap: {item.live_price_gap_percent != null ? `${item.live_price_gap_percent}%` : '-'}</text>
                  <text x={Math.min(cx - 77, marginLeft + plotWidth - 172)} y={marginTop + 47} fontSize={9} fill="#9333EA">Meat Gap: {item.meat_price_gap_percent != null ? `${item.meat_price_gap_percent}%` : '-'}</text>
                </>
              )}
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((item, i) => {
          const x = toX(i);
          const y = marginTop + plotHeight + 10;
          return (
            <text key={`dxl-${i}`} x={x} y={y} textAnchor="end" fontSize={9} fill="#6b7280" transform={`rotate(-45, ${x}, ${y})`}>
              {item.descrizione}
            </text>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${marginLeft + 10}, ${marginTop + 10})`}>
          <line x1={0} y1={5} x2={15} y2={5} stroke="#EA580C" strokeWidth={2} />
          <text x={20} y={9} fontSize={9} fill="#374151">Live Animal Price Gap</text>
          <line x1={140} y1={5} x2={155} y2={5} stroke="#9333EA" strokeWidth={2} />
          <text x={160} y={9} fontSize={9} fill="#374151">Meat Price Gap</text>
        </g>
      </svg>
    </div>
  );
};

// ============ CHART 3: Species Price Comparison (SVG Grouped Bar) ============
const SpeciesChart: React.FC<{ data: SpeciesRecord[] }> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartWidth = 700;
  const chartHeight = 320;
  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 40;
  const marginLeft = 55;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const priceMax = 25;

  const groupCount = data.length;
  const groupGap = 30;
  const groupWidth = (plotWidth - groupGap * (groupCount + 1)) / groupCount;
  const barWidth = Math.max(6, Math.min(20, groupWidth / 4 - 2));

  const barColors = ['#3B82F6', '#60A5FA', '#22C55E', '#4ADE80'];
  const barLabels = ['District Live', 'Capital Live', 'District Meat', 'Capital Meat'];

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ minWidth: 400 }}>
        <defs>
          <filter id="sp-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = marginTop + plotHeight * (1 - ratio);
          const val = Math.round(ratio * priceMax);
          return (
            <g key={`sgl-${ratio}`}>
              <line x1={marginLeft} y1={y} x2={marginLeft + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#6b7280">${val}</text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text x={14} y={marginTop + plotHeight / 2} textAnchor="middle" fontSize={10} fill="#6b7280" transform={`rotate(-90, 14, ${marginTop + plotHeight / 2})`}>
          Average Price (USD)
        </text>

        {/* Grouped bars */}
        {data.map((item, gi) => {
          const groupX = marginLeft + groupGap + gi * (groupWidth + groupGap);
          const prices = [item.district_live_avg, item.capital_live_avg, item.district_meat_avg, item.capital_meat_avg];
          const isHovered = hoveredIndex === gi;

          return (
            <g key={`sg-${gi}`}>
              {prices.map((price, bi) => {
                if (price == null) return null;
                const bx = groupX + bi * (barWidth + 2);
                const bh = (price / priceMax) * plotHeight;
                const by = marginTop + plotHeight - bh;
                return (
                  <rect
                    key={`sb-${gi}-${bi}`}
                    x={bx} y={by} width={barWidth} height={bh}
                    fill={barColors[bi]} rx={2} opacity={isHovered ? 0.85 : 1}
                  />
                );
              })}
              {/* Hover zone */}
              <rect
                x={groupX - 5} y={marginTop} width={groupWidth + 10} height={plotHeight + 30}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(gi)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              />
              {isHovered && (
                <g>
                  <rect x={Math.min(groupX, marginLeft + plotWidth - 170)} y={marginTop + 5} width={165} height={78} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} filter="url(#sp-shadow)" />
                  <text x={Math.min(groupX + 8, marginLeft + plotWidth - 162)} y={marginTop + 19} fontSize={10} fontWeight="bold" fill="#1f2937">{item.species}</text>
                  <text x={Math.min(groupX + 8, marginLeft + plotWidth - 162)} y={marginTop + 33} fontSize={9} fill="#3B82F6">District Live: ${item.district_live_avg?.toLocaleString() ?? '-'}</text>
                  <text x={Math.min(groupX + 8, marginLeft + plotWidth - 162)} y={marginTop + 45} fontSize={9} fill="#60A5FA">Capital Live: ${item.capital_live_avg?.toLocaleString() ?? '-'}</text>
                  <text x={Math.min(groupX + 8, marginLeft + plotWidth - 162)} y={marginTop + 57} fontSize={9} fill="#22C55E">District Meat: ${item.district_meat_avg?.toLocaleString() ?? '-'}</text>
                  <text x={Math.min(groupX + 8, marginLeft + plotWidth - 162)} y={marginTop + 69} fontSize={9} fill="#4ADE80">Capital Meat: ${item.capital_meat_avg?.toLocaleString() ?? '-'}</text>
                </g>
              )}
              {/* X-axis label */}
              <text x={groupX + groupWidth / 2} y={marginTop + plotHeight + 18} textAnchor="middle" fontSize={11} fill="#374151" fontWeight="bold">
                {item.species}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${marginLeft + 10}, ${chartHeight - 12})`}>
          {barColors.map((color, i) => (
            <g key={`legend-${i}`} transform={`translate(${i * 120}, 0)`}>
              <rect x={0} y={-6} width={10} height={8} fill={color} rx={1} />
              <text x={14} y={2} fontSize={8} fill="#6b7280">{barLabels[i]}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

// ============ MAIN COMPONENT ============
interface EconomicImpactViewProps {
  filterCountry?: string;
  userSoiCountry?: string | null;
}

const EconomicImpactView: React.FC<EconomicImpactViewProps> = ({
  filterCountry,
  userSoiCountry,
}) => {
  const [correlationData, setCorrelationData] = useState<OutbreakPriceRecord[]>([]);
  const [corrLoading, setCorrLoading] = useState(true);
  const [corrError, setCorrError] = useState<string | null>(null);

  const [divergenceData, setDivergenceData] = useState<DivergenceRecord[]>([]);
  const [divLoading, setDivLoading] = useState(true);
  const [divError, setDivError] = useState<string | null>(null);

  const [speciesData, setSpeciesData] = useState<SpeciesRecord[]>([]);
  const [speciesPeriodLabel, setSpeciesPeriodLabel] = useState<string | null>(null);
  const [spLoading, setSpLoading] = useState(true);
  const [spError, setSpError] = useState<string | null>(null);

  const effectiveCountry = useMemo(() => {
    if (filterCountry && filterCountry !== 'all') return filterCountry;
    return userSoiCountry || null;
  }, [filterCountry, userSoiCountry]);

  useEffect(() => {
    const fetchData = async () => {
      if (!effectiveCountry) {
        setCorrelationData([]);
        setCorrLoading(false);
        setCorrError(null);
        return;
      }

      setCorrLoading(true);
      setCorrError(null);
      try {
        const params = new URLSearchParams();
        params.append('country', effectiveCountry);
        const res = await fetch(`/api/tcc/economic/outbreak-price-correlation?${params.toString()}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setCorrelationData(result.data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setCorrError(`Failed to load correlation data: ${message}`);
      } finally {
        setCorrLoading(false);
      }
    };
    fetchData();
  }, [effectiveCountry]);

  useEffect(() => {
    const fetchData = async () => {
      if (!effectiveCountry) {
        setDivergenceData([]);
        setDivLoading(false);
        setDivError(null);
        return;
      }

      setDivLoading(true);
      setDivError(null);
      try {
        const params = new URLSearchParams();
        params.append('country', effectiveCountry);
        const res = await fetch(`/api/tcc/economic/capital-district-divergence?${params.toString()}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setDivergenceData(result.data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setDivError(`Failed to load divergence data: ${message}`);
      } finally {
        setDivLoading(false);
      }
    };
    fetchData();
  }, [effectiveCountry]);

  useEffect(() => {
    const fetchData = async () => {
      if (!effectiveCountry) {
        setSpeciesData([]);
        setSpeciesPeriodLabel(null);
        setSpLoading(false);
        setSpError(null);
        return;
      }

      setSpLoading(true);
      setSpError(null);
      try {
        const params = new URLSearchParams();
        params.append('country', effectiveCountry);
        const res = await fetch(`/api/tcc/economic/species-price-comparison?${params.toString()}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const result = await res.json();
        setSpeciesData(result.data || []);
        setSpeciesPeriodLabel(result.period?.descrizione ?? null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setSpError(`Failed to load species data: ${message}`);
      } finally {
        setSpLoading(false);
      }
    };
    fetchData();
  }, [effectiveCountry]);

  const hasHighDivergence = divergenceData.some(
    (d) => (d.live_price_gap_percent ?? 0) > 20 || (d.meat_price_gap_percent ?? 0) > 20
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 font-martaBold">
        Economic Impact Analysis
      </h2>

      {/* Chart 1: Outbreak vs Price Correlation */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Disease Outbreaks vs. Livestock Market Prices (Cattle)
        </h3>
        <p className="text-xs text-gray-500 mb-1">
          One country at a time — use the country filter above
        </p>
        <p className="text-xs text-gray-400 mb-1">
          {effectiveCountry || 'Select a country to compare outbreak frequency with cattle market prices over time.'}
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Dual-axis view: outbreak frequency (red bars) vs cattle market prices (lines).
        </p>
        {corrLoading ? (
          <div style={{ height: 380 }}><SkeletonLoader /></div>
        ) : corrError ? (
          <div className="text-center py-8 text-red-500 text-sm">{corrError}</div>
        ) : !effectiveCountry ? (
          <EmptyState message="Select a country using the filter above to view correlation data" />
        ) : correlationData.length === 0 ? (
          <EmptyState message={`No outbreak-price correlation data available for ${effectiveCountry}`} />
        ) : (
          <OutbreakPriceChart data={correlationData} />
        )}
        <InsightBox text="When outbreaks increase, live animal prices typically drop (farmers can't move animals), while meat prices may rise (scarcity at markets)." />
      </div>

      {/* Chart 2: Capital vs District Divergence */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">
            Capital vs. District Market Price Divergence
          </h3>
          {hasHighDivergence && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {'\u26A0'} High Divergence Detected
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-1">
          One country at a time — use the country filter above
        </p>
        <p className="text-xs text-gray-400 mb-1">
          {effectiveCountry || 'Select a country to view capital vs district price gaps over time.'}
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Price gap % between capital and district markets. Dashed line = 0% baseline. Positive values mean capital prices are higher.
        </p>
        {divLoading ? (
          <div style={{ height: 350 }}><SkeletonLoader /></div>
        ) : divError ? (
          <div className="text-center py-8 text-red-500 text-sm">{divError}</div>
        ) : !effectiveCountry ? (
          <EmptyState message="Select a country using the filter above to view divergence data" />
        ) : divergenceData.length === 0 ? (
          <EmptyState message={`No divergence data available for ${effectiveCountry}`} />
        ) : (
          <DivergenceChart data={divergenceData} />
        )}

        {/* Divergence detail table */}
        {divergenceData.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-2 py-1 text-left font-medium text-gray-600">Period</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">District Live</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">Capital Live</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">Live Gap %</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">District Meat</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">Capital Meat</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">Meat Gap %</th>
                </tr>
              </thead>
              <tbody>
                {divergenceData.map((d, i) => {
                  const liveHigh = (d.live_price_gap_percent ?? 0) > 20;
                  const meatHigh = (d.meat_price_gap_percent ?? 0) > 20;
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1 font-medium">{d.descrizione}</td>
                      <td className="px-2 py-1 text-right">{d.ctl_dis_liveAVG != null ? `$${d.ctl_dis_liveAVG.toLocaleString()}` : '-'}</td>
                      <td className="px-2 py-1 text-right">{d.ctl_cap_liveAVG != null ? `$${d.ctl_cap_liveAVG.toLocaleString()}` : '-'}</td>
                      <td className={`px-2 py-1 text-right font-medium ${liveHigh ? 'text-red-600' : 'text-gray-700'}`}>
                        {d.live_price_gap_percent != null ? `${d.live_price_gap_percent}%` : '-'}{liveHigh && ' \u26A0'}
                      </td>
                      <td className="px-2 py-1 text-right">{d.ctl_dis_meatAVG != null ? `$${d.ctl_dis_meatAVG.toLocaleString()}` : '-'}</td>
                      <td className="px-2 py-1 text-right">{d.ctl_cap_meatAVG != null ? `$${d.ctl_cap_meatAVG.toLocaleString()}` : '-'}</td>
                      <td className={`px-2 py-1 text-right font-medium ${meatHigh ? 'text-red-600' : 'text-gray-700'}`}>
                        {d.meat_price_gap_percent != null ? `${d.meat_price_gap_percent}%` : '-'}{meatHigh && ' \u26A0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <InsightBox
          text="Increasing gaps indicate trade restrictions or quarantines preventing animal movement from rural districts to capital markets."
          type={hasHighDivergence ? 'warning' : 'info'}
        />
      </div>

      {/* Chart 3: Species Price Comparison */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Current Prices by Species (Most Recent Period)
        </h3>
        <p className="text-xs text-gray-500 mb-1">
          One country at a time — use the country filter above
        </p>
        <p className="text-xs text-gray-400 mb-4">
          {effectiveCountry
            ? [effectiveCountry, speciesPeriodLabel].filter(Boolean).join(' · ')
            : 'Select a country to view District vs Capital prices for live and meat across species.'}
        </p>
        {spLoading ? (
          <div style={{ height: 320 }}><SkeletonLoader /></div>
        ) : spError ? (
          <div className="text-center py-8 text-red-500 text-sm">{spError}</div>
        ) : !effectiveCountry ? (
          <EmptyState message="Select a country using the filter above to view species prices" />
        ) : speciesData.length === 0 ? (
          <EmptyState message={`No species price data available for ${effectiveCountry}`} />
        ) : (
          <SpeciesChart data={speciesData} />
        )}

        {speciesData.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-2 py-1 text-left font-medium text-gray-600">Species</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">District Live</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">Capital Live</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">District Meat</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">Capital Meat</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600">Price Gap %</th>
                </tr>
              </thead>
              <tbody>
                {speciesData.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1 font-medium">{s.species}</td>
                    <td className="px-2 py-1 text-right">{s.district_live_avg != null ? `$${s.district_live_avg.toLocaleString()}` : '-'}</td>
                    <td className="px-2 py-1 text-right">{s.capital_live_avg != null ? `$${s.capital_live_avg.toLocaleString()}` : '-'}</td>
                    <td className="px-2 py-1 text-right">{s.district_meat_avg != null ? `$${s.district_meat_avg.toLocaleString()}` : '-'}</td>
                    <td className="px-2 py-1 text-right">{s.capital_meat_avg != null ? `$${s.capital_meat_avg.toLocaleString()}` : '-'}</td>
                    <td className="px-2 py-1 text-right font-medium text-gray-700">
                      {s.price_gap_percent != null ? `${s.price_gap_percent}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EconomicImpactView;