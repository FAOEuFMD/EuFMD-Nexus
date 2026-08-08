/** Current-situation helpers for Fast Report (Now vs Historical). */

export const EUROPE_REGION = 'Europe';
/** Display label for the Europe immediate-notification source. */
export const WAHIS_INFUR_LABEL = 'WAHIS-INFUR';
export const EXCLUDED_DISEASES = new Set(['BEF']);

export type FastReportPeriod = { year: number; quarter: number };

/** Point outbreak from WAHIS INFUR (Europe Now map). */
export interface InfurOutbreakPoint {
  eventId?: number | null;
  reportId?: number | null;
  outbreakId?: number | null;
  outbreakReference?: string | null;
  nationalReference?: string | null;
  reportType?: string | null;
  reportStatus?: string | null;
  eventStatus?: string | null;
  country: string;
  disease: string;
  diseaseLabel?: string | null;
  reason?: string | null;
  adminDivision?: string | null;
  location?: string | null;
  locationApprox?: string | null;
  latitude: number;
  longitude: number;
  outbreakStartDate?: string | null;
  outbreakEndDate?: string | null;
  submissionDate?: string | null;
  eventStartDate?: string | null;
  epiUnitType?: string | null;
  speciesName?: string | null;
  isWild?: string | null;
  susceptible?: number | null;
  cases?: number | null;
  deaths?: number | null;
  killed?: number | null;
  slaughtered?: number | null;
  vaccinated?: number | null;
}

export function periodKey(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

export function formatPeriod(p: FastReportPeriod): string {
  return periodKey(p.year, p.quarter);
}

/** Distinct Year/Quarter pairs from data, newest first. */
export function listPublishedQuarters(
  rows: Array<{ Year?: number | null; Quarter?: number | null }>
): FastReportPeriod[] {
  const seen = new Set<string>();
  const out: FastReportPeriod[] = [];
  for (const row of rows) {
    const year = Number(row.Year);
    const quarter = Number(row.Quarter);
    if (!year || !quarter || quarter < 1 || quarter > 4) continue;
    const key = periodKey(year, quarter);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ year, quarter });
  }
  out.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.quarter - a.quarter));
  return out;
}

/** Last N published FAST quarters (default 2) for the Now map. */
export function getLastPublishedQuarters(
  rows: Array<{ Year?: number | null; Quarter?: number | null }>,
  n = 2
): FastReportPeriod[] {
  return listPublishedQuarters(rows).slice(0, n);
}

export function isInPeriods(
  year: number | null | undefined,
  quarter: number | null | undefined,
  periods: FastReportPeriod[]
): boolean {
  const y = Number(year);
  const q = Number(quarter);
  return periods.some((p) => p.year === y && p.quarter === q);
}

/** Current calendar semester label, e.g. 2026-H2. */
export function getCurrentSemesterLabel(now = new Date()): string {
  const half = now.getMonth() < 6 ? 'H1' : 'H2';
  return `${now.getFullYear()}-${half}`;
}

export function excludeBefDisease<T extends { Disease?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.Disease && !EXCLUDED_DISEASES.has(r.Disease));
}
