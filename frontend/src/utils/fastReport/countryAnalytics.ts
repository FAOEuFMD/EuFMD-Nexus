export interface FastReportAnalyticsRow {
  Year?: number;
  Quarter?: number;
  Disease?: string;
  Outbreaks?: string | number;
  Vaccination_Doses?: number | string;
  Region?: string;
  Country?: string;
}

export const COUNTRY_ZOOM_THRESHOLD = 6;

export function periodLabel(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

export function sortPeriods(periods: string[]): string[] {
  return periods.slice().sort((a, b) => {
    const [yA, qA] = a.split('-Q').map(Number);
    const [yB, qB] = b.split('-Q').map(Number);
    if (yA !== yB) return yA - yB;
    return qA - qB;
  });
}

export interface PlotlyTrace {
  name: string;
  type: 'scatter' | 'bar';
  mode?: string;
  x: string[];
  y: number[];
  marker?: { color: string };
}

export function buildOutbreakTraces(
  rows: FastReportAnalyticsRow[],
  diseaseColors: Record<string, string>
): { periods: string[]; traces: PlotlyTrace[]; hasData: boolean } {
  const periodsSet = new Set<string>();
  const byDisease: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    const year = row.Year;
    const quarter = row.Quarter;
    const disease = row.Disease;
    if (year == null || quarter == null || !disease) continue;

    const period = periodLabel(Number(year), Number(quarter));
    periodsSet.add(period);

    const outbreaks = parseInt(String(row.Outbreaks ?? '0'), 10) || 0;
    if (!byDisease[disease]) byDisease[disease] = {};
    byDisease[disease][period] = (byDisease[disease][period] || 0) + outbreaks;
  }

  const periods = sortPeriods(Array.from(periodsSet));
  const traces: PlotlyTrace[] = Object.entries(byDisease).map(([disease, data]) => ({
    name: disease,
    type: 'scatter',
    mode: 'lines+markers',
    x: periods,
    y: periods.map((p) => data[p] || 0),
    marker: { color: diseaseColors[disease] || '#888888' },
  }));

  const hasData = traces.some((t) => t.y.some((v) => v > 0));
  return { periods, traces, hasData };
}

export function buildVaccinationTraces(
  rows: FastReportAnalyticsRow[],
  diseaseColors: Record<string, string>
): { periods: string[]; traces: PlotlyTrace[]; hasData: boolean } {
  const periodsSet = new Set<string>();
  const byDisease: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    const year = row.Year;
    const quarter = row.Quarter;
    const disease = row.Disease;
    if (year == null || quarter == null || !disease) continue;

    const doses = Number(row.Vaccination_Doses ?? 0);
    if (!doses || doses <= 0) continue;

    const period = periodLabel(Number(year), Number(quarter));
    periodsSet.add(period);

    if (!byDisease[disease]) byDisease[disease] = {};
    byDisease[disease][period] = (byDisease[disease][period] || 0) + doses;
  }

  const periods = sortPeriods(Array.from(periodsSet));
  const traces: PlotlyTrace[] = Object.entries(byDisease).map(([disease, data]) => ({
    name: disease,
    type: 'bar',
    x: periods,
    y: periods.map((p) => data[p] || 0),
    marker: { color: diseaseColors[disease] || '#888888' },
  }));

  const hasData = traces.length > 0 && traces.some((t) => t.y.some((v) => v > 0));
  return { periods, traces, hasData };
}
