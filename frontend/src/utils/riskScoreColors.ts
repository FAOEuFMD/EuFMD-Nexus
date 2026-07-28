/** Shared risk score color scale (green → yellow → orange → red). */

export const RISK_COLOR_HEX = {
  low: '#4CAF50',
  lowMedium: '#FFEB3B',
  mediumHigh: '#FF9800',
  high: '#F44336',
} as const;

export const RISK_COLOR_BG_CLASS = {
  low: 'bg-[#4CAF50]',
  lowMedium: 'bg-[#FFEB3B]',
  mediumHigh: 'bg-[#FF9800]',
  high: 'bg-[#F44336]',
} as const;

/** Normalize a raw risk score to the 0–3 scale used for coloring (same as the map). */
export function normalizeRiskScore(score: number, maxScore: number): number {
  if (score <= 0) return 0;
  if (maxScore <= 0) return 0;
  return Math.min(3, score / (maxScore / 3));
}

/** Map a 0–3 (or raw) score to a color bucket using the standard thresholds. */
export function getRiskColorHex(score: number): string {
  const normalized = score > 3 ? Math.min(3, score / Math.ceil(score / 3)) : score;

  if (normalized === 0) return RISK_COLOR_HEX.low;
  if (normalized <= 1) return RISK_COLOR_HEX.lowMedium;
  if (normalized <= 2) return RISK_COLOR_HEX.mediumHigh;
  return RISK_COLOR_HEX.high;
}

export function getRiskBgClass(score: number): string {
  const normalized = score > 3 ? Math.min(3, score / Math.ceil(score / 3)) : score;

  if (normalized === 0) return RISK_COLOR_BG_CLASS.low;
  if (normalized <= 1) return RISK_COLOR_BG_CLASS.lowMedium;
  if (normalized <= 2) return RISK_COLOR_BG_CLASS.mediumHigh;
  return RISK_COLOR_BG_CLASS.high;
}

/** Text contrast for score badges on colored backgrounds. */
export function getRiskTextClass(score: number): string {
  const normalized = score > 3 ? Math.min(3, score / Math.ceil(score / 3)) : score;
  return normalized > 2 ? 'text-white' : 'text-gray-900';
}

export function getMaxRiskScore(
  scores: Array<{ riskScore: number }>,
): number {
  return scores.reduce((max, item) => Math.max(max, item.riskScore), 0);
}
