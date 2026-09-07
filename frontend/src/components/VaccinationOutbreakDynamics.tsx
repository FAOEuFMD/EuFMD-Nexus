import React, { useMemo, useState } from 'react';
import { diseasesMatch } from '../utils/soiDiseaseMatch';

export type DynamicsOutbreak = {
  Country: string;
  Province?: string;
  District?: string;
  Disease?: string;
  Date_Suspected?: string;
  Date_Confirmed?: string;
};

export type DynamicsVaccination = {
  Country: string;
  Province?: string;
  District?: string;
  Disease?: string;
  Year?: number | string;
  Q1?: number;
  Q2?: number;
  Q3?: number;
  Q4?: number;
  Coverage?: number | null;
  Vaccination_Doses?: number | null;
  Vaccination_Date?: string | null;
  Vaccination_Campaign?: string | null;
};

const LAGS = [0, 30, 60, 90, 120, 180] as const;
const MIN_PAIRS_FOR_PCT = 5;
const MIN_GOOD = 8;
const MIN_LIMITED = 3;

type Confidence = 'good' | 'limited' | 'insufficient';

type QuarterKey = string; // YYYY-Qn

type QuarterPoint = {
  key: QuarterKey;
  year: number;
  quarter: number;
  midMs: number;
  coverage: number | null; // null = missing
  outbreakCount: number | null; // null = missing (outside observed span); 0 = zero outbreaks
  hasCampaign: boolean;
  vaccRecords: number;
};

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function quarterKey(year: number, q: number): QuarterKey {
  return `${year}-Q${q}`;
}

function midOfQuarter(year: number, q: number): number {
  const month = (q - 1) * 3 + 1; // 1,4,7,10
  return new Date(year, month - 1 + 1, 15).getTime(); // ~middle month of quarter
}

function dateToQuarter(d: Date): { year: number; quarter: number; key: QuarterKey } {
  const year = d.getFullYear();
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return { year, quarter, key: quarterKey(year, quarter) };
}

function addDaysMs(ms: number, days: number): number {
  return ms + days * 24 * 60 * 60 * 1000;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function confidenceFromN(n: number): Confidence {
  if (n >= MIN_GOOD) return 'good';
  if (n >= MIN_LIMITED) return 'limited';
  return 'insufficient';
}

function ConfidenceDot({ level }: { level: Confidence }) {
  const map = {
    good: { color: '#16a34a', label: 'Good data support' },
    limited: { color: '#ca8a04', label: 'Limited observations' },
    insufficient: { color: '#dc2626', label: 'Insufficient data' },
  } as const;
  const m = map[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-600">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: m.color }}
        aria-hidden
      />
      {m.label}
    </span>
  );
}

interface Props {
  country: string | null;
  disease: string;
  dateFrom: string;
  dateTo: string;
  outbreaks: DynamicsOutbreak[];
  vaccinations: DynamicsVaccination[];
  userCountry?: string | null;
}

const VaccinationOutbreakDynamics: React.FC<Props> = ({
  country,
  disease,
  dateFrom,
  dateTo,
  outbreaks,
  vaccinations,
  userCountry,
}) => {
  const [lagDays, setLagDays] = useState<number>(90);

  const analysisCountry = country && country !== 'all' ? country : userCountry || null;

  const filtered = useMemo(() => {
    if (!analysisCountry) {
      return { outbreaks: [] as DynamicsOutbreak[], vaccinations: [] as DynamicsVaccination[] };
    }
    const ob = outbreaks.filter((r) => {
      if (r.Country !== analysisCountry) return false;
      if (!diseasesMatch(r.Disease, disease)) return false;
      const d = parseDate(r.Date_Confirmed || r.Date_Suspected);
      if (!d) return false;
      const iso = d.toISOString().slice(0, 10);
      if (dateFrom && iso < dateFrom) return false;
      if (dateTo && iso > dateTo) return false;
      return true;
    });
    const vac = vaccinations.filter((r) => {
      if (r.Country !== analysisCountry) return false;
      if (!diseasesMatch(r.Disease, disease)) return false;
      const y = Number(r.Year);
      if (!y) return false;
      if (dateFrom && y < Number(dateFrom.slice(0, 4))) return false;
      if (dateTo && y > Number(dateTo.slice(0, 4))) return false;
      return true;
    });
    return { outbreaks: ob, vaccinations: vac };
  }, [analysisCountry, disease, dateFrom, dateTo, outbreaks, vaccinations]);

  const series = useMemo(() => {
    const map = new Map<QuarterKey, QuarterPoint>();

    const ensure = (year: number, quarter: number) => {
      const key = quarterKey(year, quarter);
      if (!map.has(key)) {
        map.set(key, {
          key,
          year,
          quarter,
          midMs: midOfQuarter(year, quarter),
          coverage: null,
          outbreakCount: null,
          hasCampaign: false,
          vaccRecords: 0,
        });
      }
      return map.get(key)!;
    };

    // Vaccination → quarterly coverage (mean of non-null); campaigns when doses > 0
    const covAcc = new Map<QuarterKey, { sum: number; n: number }>();
    filtered.vaccinations.forEach((r) => {
      const year = Number(r.Year);
      if (!year) return;
      // Prefer quarters with doses; else attribute whole-year coverage to year mid if only annual
      const qDoses: [number, number][] = [
        [1, Number(r.Q1 || 0)],
        [2, Number(r.Q2 || 0)],
        [3, Number(r.Q3 || 0)],
        [4, Number(r.Q4 || 0)],
      ];
      const activeQs = qDoses.filter(([, d]) => d > 0);
      const targets = activeQs.length > 0 ? activeQs.map(([q]) => q) : [2]; // fallback Q2 if no q split
      const cov = r.Coverage != null && r.Coverage !== undefined ? Number(r.Coverage) : null;

      targets.forEach((q) => {
        const pt = ensure(year, q);
        pt.vaccRecords += 1;
        const doses = qDoses.find(([qq]) => qq === q)?.[1] || Number(r.Vaccination_Doses || 0);
        if (doses > 0) pt.hasCampaign = true;
        if (cov != null && !Number.isNaN(cov)) {
          const acc = covAcc.get(pt.key) || { sum: 0, n: 0 };
          acc.sum += cov;
          acc.n += 1;
          covAcc.set(pt.key, acc);
        }
      });
    });
    covAcc.forEach((acc, key) => {
      const pt = map.get(key);
      if (pt && acc.n > 0) pt.coverage = acc.sum / acc.n;
    });

    // Outbreak dates → quarter counts
    const obKeys = new Set<QuarterKey>();
    filtered.outbreaks.forEach((r) => {
      const d = parseDate(r.Date_Confirmed || r.Date_Suspected);
      if (!d) return;
      const { year, quarter, key } = dateToQuarter(d);
      const pt = ensure(year, quarter);
      if (pt.outbreakCount == null) pt.outbreakCount = 0;
      pt.outbreakCount += 1;
      obKeys.add(key);
    });

    // Within observed span (min..max of any data), fill missing outbreak counts as 0
    // (zero outbreaks ≠ missing). Outside span leave null.
    const points = Array.from(map.values()).sort((a, b) => a.midMs - b.midMs);
    if (points.length > 0) {
      const minMs = points[0].midMs;
      const maxMs = points[points.length - 1].midMs;
      // Fill intervening quarters
      const startY = points[0].year;
      const endY = points[points.length - 1].year;
      for (let y = startY; y <= endY; y++) {
        for (let q = 1; q <= 4; q++) {
          const mid = midOfQuarter(y, q);
          if (mid < minMs || mid > maxMs) continue;
          const pt = ensure(y, q);
          if (pt.outbreakCount == null) pt.outbreakCount = 0;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.midMs - b.midMs);
  }, [filtered]);

  const lagAnalysis = useMemo(() => {
    const results = LAGS.map((lag) => {
      const xs: number[] = [];
      const ys: number[] = [];
      // Country-level pairs: coverage at t vs outbreak count in ~90d window starting mid+lag
      series.forEach((pt) => {
        if (pt.coverage == null) return;
        const winStart = addDaysMs(pt.midMs, lag);
        const winEnd = addDaysMs(winStart, 90);
        // Sum outbreak counts from quarters whose mid falls in window; if none observed, null
        let sum = 0;
        let seen = false;
        series.forEach((p2) => {
          if (p2.outbreakCount == null) return;
          if (p2.midMs >= winStart && p2.midMs < winEnd) {
            sum += p2.outbreakCount;
            seen = true;
          }
        });
        if (!seen) return;
        xs.push(pt.coverage);
        ys.push(sum);
      });
      const corr = pearson(xs, ys);
      return { lag, n: xs.length, corr, xs, ys };
    });

    // Best lag = strongest negative correlation with sufficient n; else most negative among limited
    const usable = results.filter((r) => r.n >= MIN_LIMITED && r.corr != null);
    let best = usable.sort((a, b) => (a.corr! - b.corr!))[0] || null;

    const selected = results.find((r) => r.lag === lagDays) || results[0];

    // After vaccination: high vs low coverage halves at selected lag
    let afterLabel: string = 'Insufficient data';
    let afterDetail: string | null = null;
    if (selected && selected.n >= MIN_PAIRS_FOR_PCT) {
      const paired = selected.xs.map((x, i) => ({ x, y: selected.ys[i] }));
      const sorted = [...paired].sort((a, b) => a.x - b.x);
      const mid = Math.floor(sorted.length / 2);
      const low = sorted.slice(0, mid);
      const high = sorted.slice(mid);
      const mean = (arr: { y: number }[]) => arr.reduce((s, p) => s + p.y, 0) / arr.length;
      const mLow = mean(low);
      const mHigh = mean(high);
      if (mLow > 0) {
        const pct = ((mHigh - mLow) / mLow) * 100;
        afterLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
        afterDetail =
          pct < 0
            ? 'Lower outbreak counts followed higher-coverage periods at this lag'
            : 'Higher outbreak counts followed higher-coverage periods at this lag';
      } else {
        afterLabel = 'Insufficient data';
      }
    }

    const conf = confidenceFromN(selected?.n || 0);

    // Coverage metrics for selected period window
    const covPts = series.filter((p) => p.coverage != null);
    const currentCov = covPts.length ? covPts[covPts.length - 1].coverage : null;
    const startCov = covPts.length ? covPts[0].coverage : null;
    const covDelta =
      currentCov != null && startCov != null ? currentCov - startCov : null;

    // Outbreak incidence: no population denominator → outbreak count in period
    const obPts = series.filter((p) => p.outbreakCount != null);
    const totalOutbreaks = obPts.reduce((s, p) => s + (p.outbreakCount || 0), 0);
    const incidenceLabel = 'Outbreak count';
    const incidenceNote = 'No population-at-risk denominator available — using outbreak count';

    // Reactive vs proactive hint: campaigns in same quarter as outbreaks vs prior quarter
    let reactive = 0;
    let proactive = 0;
    series.forEach((pt, idx) => {
      if (!pt.hasCampaign) return;
      const same = (pt.outbreakCount || 0) > 0;
      const prev = idx > 0 ? series[idx - 1] : null;
      const prevOb = prev && prev.outbreakCount != null ? prev.outbreakCount > 0 : false;
      if (same && !prevOb) reactive += 1;
      else if (!same || prevOb) proactive += 1;
    });

    return {
      results,
      best,
      selected,
      afterLabel,
      afterDetail,
      conf,
      currentCov,
      covDelta,
      totalOutbreaks,
      incidenceLabel,
      incidenceNote,
      nPairs: selected?.n || 0,
      reactive,
      proactive,
      obsVacc: filtered.vaccinations.length,
      obsOutbreak: filtered.outbreaks.length,
    };
  }, [series, lagDays, filtered]);

  // Chart scales
  const chart = useMemo(() => {
    const width = 720;
    const height = 220;
    const pad = { t: 16, r: 48, b: 36, l: 40 };
    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;
    if (series.length === 0) return null;

    const covVals = series.map((p) => p.coverage).filter((v): v is number => v != null);
    const obVals = series.map((p) => p.outbreakCount).filter((v): v is number => v != null);
    const maxCov = Math.max(100, ...(covVals.length ? covVals : [0]));
    const maxOb = Math.max(1, ...(obVals.length ? obVals : [0]));

    const minMs = series[0].midMs;
    const maxMs = series[series.length - 1].midMs;

    const xAt = (i: number) =>
      pad.l + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);

    const xAtMs = (ms: number) => {
      if (series.length === 1 || maxMs === minMs) return pad.l + plotW / 2;
      const t = (ms - minMs) / (maxMs - minMs);
      return pad.l + Math.max(0, Math.min(1, t)) * plotW;
    };

    const yCov = (v: number) => pad.t + plotH - (v / maxCov) * plotH;
    const yOb = (v: number) => pad.t + plotH - (v / maxOb) * plotH;

    const covPath: string[] = [];
    series.forEach((p, i) => {
      if (p.coverage == null) return;
      const cmd = covPath.length === 0 ? 'M' : 'L';
      if (i > 0 && series[i - 1].coverage == null && covPath.length) {
        covPath.push(`M ${xAt(i)} ${yCov(p.coverage)}`);
      } else {
        covPath.push(`${cmd} ${xAt(i)} ${yCov(p.coverage)}`);
      }
    });

    // Lag windows for every quarter used in the calculation (coverage present).
    // Metrics pool ALL of these pairs — not a single campaign.
    const lagBands = series
      .filter((p) => p.coverage != null)
      .map((p) => {
        const winStart = addDaysMs(p.midMs, lagDays);
        const winEnd = addDaysMs(winStart, 90);
        // Skip windows entirely outside the chart time range
        if (winEnd < minMs || winStart > maxMs) return null;
        const x0 = xAtMs(p.midMs);
        const x1 = xAtMs(Math.max(winStart, minMs));
        const x2 = xAtMs(Math.min(winEnd, maxMs));
        return {
          x0,
          x1,
          x2: Math.max(x1 + 3, x2),
          hasCampaign: p.hasCampaign,
          key: p.key,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b != null);

    return {
      width,
      height,
      pad,
      plotW,
      plotH,
      xAt,
      yCov,
      yOb,
      maxCov,
      maxOb,
      covPath: covPath.join(' '),
      lagBands,
      nLagSources: lagBands.length,
    };
  }, [series, lagDays]);

  if (!analysisCountry) {
    return (
      <div className="mt-4 border border-gray-200 rounded-lg bg-white p-5">
        <h3 className="text-base font-semibold text-gray-800 font-martaBold">
          Vaccination & Outbreak Dynamics
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          Select a country in the filter to explore vaccination–outbreak timing for one country at a time.
        </p>
      </div>
    );
  }

  const noData =
    filtered.outbreaks.length === 0 && filtered.vaccinations.length === 0;

  return (
    <div className="mt-4 border border-teal-900/10 rounded-lg bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 font-martaBold">
            Vaccination & Outbreak Dynamics
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Exploratory temporal association for <span className="font-medium text-gray-700">{analysisCountry}</span>
            {' · '}{disease}. Not vaccine effectiveness and not causal. Countries are analysed separately.
          </p>
          <p className="text-[11px] text-teal-800/80 mt-1">
            Defaulting to your country when available — use the Country filter to explore another.
          </p>
          <p className="text-[11px] text-gray-500 mt-1 max-w-2xl">
            Lag metrics use <span className="font-medium text-gray-700">every vaccination quarter with coverage</span> in
            the selected time frame (paired with outbreak activity {`t + lag`}), not a single campaign.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            Lag (days)
          </label>
          <div className="flex flex-wrap gap-1">
            {LAGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLagDays(l)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  lagDays === l
                    ? 'bg-[#15736d] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                +{l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {noData ? (
        <div className="py-10 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-md bg-white">
          No data for this country / disease in the selected period.
          <br />
          <span className="text-xs">Choose another country or disease in the filters.</span>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">
                Vaccination coverage
              </div>
              <div className="text-xl font-semibold text-gray-800 mt-1">
                {lagAnalysis.currentCov != null ? `${lagAnalysis.currentCov.toFixed(0)}%` : '—'}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {lagAnalysis.covDelta != null
                  ? `${lagAnalysis.covDelta >= 0 ? '+' : ''}${lagAnalysis.covDelta.toFixed(0)} pp from period start`
                  : 'Change unavailable'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                n vacc records: {lagAnalysis.obsVacc}
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">
                {lagAnalysis.incidenceLabel}
              </div>
              <div className="text-xl font-semibold text-gray-800 mt-1">
                {lagAnalysis.totalOutbreaks}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">{lagAnalysis.incidenceNote}</div>
              <div className="text-[10px] text-gray-400 mt-1">
                n outbreak events: {lagAnalysis.obsOutbreak}
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">
                After vaccination (+{lagDays}d)
              </div>
              <div className="text-xl font-semibold text-gray-800 mt-1">{lagAnalysis.afterLabel}</div>
              <div className="text-[11px] text-gray-500 mt-1">
                {lagAnalysis.afterDetail || 'Need enough paired quarters to estimate % change'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                paired observations: {lagAnalysis.nPairs}
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium flex items-center justify-between gap-2">
                <span>Temporal signal</span>
                <ConfidenceDot level={lagAnalysis.conf} />
              </div>
              <div className="text-xl font-semibold text-gray-800 mt-1">
                {lagAnalysis.selected?.corr != null && lagAnalysis.nPairs >= MIN_LIMITED
                  ? `r = ${lagAnalysis.selected.corr.toFixed(2)}`
                  : '—'}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Observed association at +{lagDays}d (coverage → later outbreaks). Not effectiveness.
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-md border border-gray-200 bg-white p-3 mb-3 overflow-x-auto">
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500 mb-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-0.5 bg-[#15736d] inline-block" /> Vaccine Coverage %
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-red-400/80 inline-block rounded-sm" /> Outbreak count
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-0.5 h-3 bg-amber-500 inline-block" /> Vaccination campaign quarter
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-2 bg-[#15736d]/20 border border-[#15736d]/40 inline-block" /> Selected lag window(s)
              </span>
            </div>
            {chart ? (
              <svg width={chart.width} height={chart.height} className="max-w-full">
                {chart.lagBands.map((band) => (
                  <g key={`lag-${band.key}`}>
                    <rect
                      x={band.x1}
                      y={chart.pad.t}
                      width={Math.max(4, band.x2 - band.x1)}
                      height={chart.plotH}
                      fill="#15736d"
                      opacity={0.12}
                    />
                    <line
                      x1={band.x0}
                      x2={band.x1}
                      y1={chart.pad.t + 6}
                      y2={chart.pad.t + 6}
                      stroke="#15736d"
                      strokeDasharray="3 2"
                      strokeWidth={1}
                      opacity={0.7}
                    />
                  </g>
                ))}
                {/* Campaign markers */}
                {series.map((p, i) =>
                  p.hasCampaign ? (
                    <line
                      key={`c-${p.key}`}
                      x1={chart.xAt(i)}
                      x2={chart.xAt(i)}
                      y1={chart.pad.t}
                      y2={chart.pad.t + chart.plotH}
                      stroke="#d97706"
                      strokeWidth={1.5}
                      opacity={0.7}
                    />
                  ) : null
                )}
                {/* Outbreak bars */}
                {series.map((p, i) =>
                  p.outbreakCount != null ? (
                    <rect
                      key={`o-${p.key}`}
                      x={chart.xAt(i) - 6}
                      y={chart.yOb(p.outbreakCount)}
                      width={12}
                      height={Math.max(0, chart.pad.t + chart.plotH - chart.yOb(p.outbreakCount))}
                      fill="#f87171"
                      opacity={0.55}
                    />
                  ) : null
                )}
                {/* Coverage line */}
                {chart.covPath && (
                  <path d={chart.covPath} fill="none" stroke="#15736d" strokeWidth={2} />
                )}
                {series.map((p, i) =>
                  p.coverage != null ? (
                    <circle
                      key={`v-${p.key}`}
                      cx={chart.xAt(i)}
                      cy={chart.yCov(p.coverage)}
                      r={3}
                      fill="#15736d"
                    />
                  ) : null
                )}
                {/* X labels */}
                {series.map((p, i) =>
                  i % Math.max(1, Math.floor(series.length / 8)) === 0 || i === series.length - 1 ? (
                    <text
                      key={`t-${p.key}`}
                      x={chart.xAt(i)}
                      y={chart.height - 10}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#6b7280"
                    >
                      {p.key}
                    </text>
                  ) : null
                )}
                <text x={chart.pad.l - 6} y={chart.pad.t + 8} textAnchor="end" fontSize={9} fill="#15736d">
                  %
                </text>
                <text
                  x={chart.width - chart.pad.r + 6}
                  y={chart.pad.t + 8}
                  textAnchor="start"
                  fontSize={9}
                  fill="#ef4444"
                >
                  n
                </text>
              </svg>
            ) : (
              <p className="text-xs text-gray-400 py-6 text-center">Not enough temporal points to chart.</p>
            )}
            {chart && chart.nLagSources > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">
                Showing {chart.nLagSources} lag window{chart.nLagSources === 1 ? '' : 's'} (+{lagDays}d, ~90d wide)
                — one per vaccination quarter with coverage in this time frame.
              </p>
            )}
            {chart && chart.nLagSources === 0 && (
              <p className="text-[10px] text-amber-700/80 mt-1">
                No lag windows fall inside the charted range at +{lagDays}d (try a smaller lag or a wider From/To).
              </p>
            )}
          </div>

          {/* Timing note */}
          {(lagAnalysis.reactive > 0 || lagAnalysis.proactive > 0) && (
            <p className="text-[11px] text-gray-500 mb-2">
              Campaign timing hint: {lagAnalysis.proactive} quarter(s) look pre-emptive relative to local outbreaks;
              {' '}{lagAnalysis.reactive} coincide with outbreak quarters (possible reactive vaccination). Heuristic only.
            </p>
          )}

          {/* Best signal footer */}
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm text-gray-800">
                <span className="font-medium">Best observed temporal signal:{' '}</span>
                {lagAnalysis.best
                  ? `+${lagAnalysis.best.lag} days`
                  : 'Insufficient data'}
                {lagAnalysis.best && (
                  <span className="ml-2 align-middle">
                    <ConfidenceDot level={confidenceFromN(lagAnalysis.best.n)} />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 max-w-3xl">
                {lagAnalysis.best && lagAnalysis.best.corr != null && lagAnalysis.best.corr < 0
                  ? 'Outbreak activity was lower following higher vaccination coverage at this lag. This is an exploratory temporal association and does not establish causality.'
                  : lagAnalysis.best && lagAnalysis.best.corr != null && lagAnalysis.best.corr >= 0
                    ? 'At the strongest lag, higher coverage was not followed by lower outbreak counts in this sparse series. Treat as exploratory only — not causal.'
                    : 'Not enough paired observations across lags to identify a temporal signal.'}
              </p>
            </div>
            <div className="text-[10px] text-gray-400 text-right">
              Missing coverage left blank (not zero).
              <br />
              Zero outbreaks shown as 0 within the observed span.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VaccinationOutbreakDynamics;
