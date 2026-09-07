import { useEffect } from 'react';

/** SVG pattern ids used as Leaflet fillColor: url(#id) */
export const VACC_PATTERN_IDS = {
  /** Vaccination reported (Vaccination=1) but no dose numbers */
  flagged: 'fast-vacc-hatch-flagged',
  band1: 'fast-vacc-hatch-1',
  band2: 'fast-vacc-hatch-2',
  band3: 'fast-vacc-hatch-3',
  band4: 'fast-vacc-hatch-4',
} as const;

const STROKE = '#0f766e';
const FLAGGED_STROKE = '#b45309';
const DEFS_HOST_ID = 'fast-vacc-pattern-host';

/**
 * Ensures hatch pattern defs exist in the document (hidden SVG host).
 * Leaflet paths can use fillColor: 'url(#fast-vacc-hatch-N)'.
 */
const VaccinationPatternDefs: React.FC = () => {
  useEffect(() => {
    ensureDocumentPatterns();
  }, []);

  return null;
};

function ensureDocumentPatterns() {
  if (typeof document === 'undefined') return;
  // Always refresh so newly added pattern ids are present after code updates
  const existing = document.getElementById(DEFS_HOST_ID);
  if (existing) existing.remove();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = DEFS_HOST_ID;
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText =
    'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  // Distinct dotted pattern for "in place, no quantitative data"
  {
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', VACC_PATTERN_IDS.flagged);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '10');
    pattern.setAttribute('height', '10');

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '10');
    bg.setAttribute('height', '10');
    bg.setAttribute('fill', 'rgba(180, 83, 9, 0.14)');
    pattern.appendChild(bg);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', '5');
    dot.setAttribute('cy', '5');
    dot.setAttribute('r', '1.6');
    dot.setAttribute('fill', FLAGGED_STROKE);
    pattern.appendChild(dot);

    defs.appendChild(pattern);
  }

  const patterns: Array<{ id: string; size: number; strokeWidth: number }> = [
    { id: VACC_PATTERN_IDS.band1, size: 10, strokeWidth: 1 },
    { id: VACC_PATTERN_IDS.band2, size: 8, strokeWidth: 1.4 },
    { id: VACC_PATTERN_IDS.band3, size: 6, strokeWidth: 1.8 },
    { id: VACC_PATTERN_IDS.band4, size: 5, strokeWidth: 2.2 },
  ];

  for (const p of patterns) {
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', p.id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', String(p.size));
    pattern.setAttribute('height', String(p.size));
    pattern.setAttribute('patternTransform', 'rotate(45)');

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(p.size));
    bg.setAttribute('height', String(p.size));
    bg.setAttribute('fill', 'rgba(15, 118, 110, 0.12)');
    pattern.appendChild(bg);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', '0');
    line.setAttribute('x2', '0');
    line.setAttribute('y2', String(p.size));
    line.setAttribute('stroke', STROKE);
    line.setAttribute('stroke-width', String(p.strokeWidth));
    pattern.appendChild(line);

    defs.appendChild(pattern);
  }

  svg.appendChild(defs);
  document.body.appendChild(svg);
}

/** Quantitative dose bands (1–4) plus flagged (=1, no doses). */
export type VaccDoseBand = 1 | 2 | 3 | 4;
export type VaccFillBand = 'flagged' | VaccDoseBand;

/** Fixed dose bands for choropleth (sum of doses across selected vacc diseases). */
export function getVaccDoseBand(doses: number): VaccDoseBand | null {
  if (!doses || doses <= 0) return null;
  if (doses < 100_000) return 1;
  if (doses < 500_000) return 2;
  if (doses < 1_000_000) return 3;
  return 4;
}

/** Prefer quantitative doses; otherwise use Vaccination=1 flagged pattern. */
export function getVaccFillBand(doses: number, flagged: boolean): VaccFillBand | null {
  const doseBand = getVaccDoseBand(doses);
  if (doseBand) return doseBand;
  if (flagged) return 'flagged';
  return null;
}

export function getVaccPatternUrl(band: VaccFillBand): string {
  const id =
    band === 'flagged'
      ? VACC_PATTERN_IDS.flagged
      : band === 1
        ? VACC_PATTERN_IDS.band1
        : band === 2
          ? VACC_PATTERN_IDS.band2
          : band === 3
            ? VACC_PATTERN_IDS.band3
            : VACC_PATTERN_IDS.band4;
  return `url(#${id})`;
}

export const VACC_FLAGGED_LABEL = 'Vaccination in place (no dose numbers)';

export const VACC_DOSE_BAND_LABELS: Record<VaccDoseBand, string> = {
  1: '1 – 99,999 doses',
  2: '100,000 – 499,999',
  3: '500,000 – 999,999',
  4: '1,000,000+',
};

export default VaccinationPatternDefs;
