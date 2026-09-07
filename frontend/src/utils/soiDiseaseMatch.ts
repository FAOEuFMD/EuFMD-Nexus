/** Flexible disease name matching for SOI filters (RISP vs SOI naming variants). */

function stripDiseaseCode(name: string): string {
  return name.replace(/\s*-\s*[A-Za-z0-9]+\s*$/, '').trim().toLowerCase();
}

function diseaseCode(name: string): string | null {
  const m = name.match(/\b(FMD|LSD|PPR|SPGP|RVF)\b/i);
  if (m) return m[1].toUpperCase();
  const aliases: Record<string, string> = {
    'foot-and-mouth disease': 'FMD',
    'foot and mouth disease': 'FMD',
    'lumpy skin disease': 'LSD',
    'peste des petits ruminants': 'PPR',
    'sheep pox and goat pox': 'SPGP',
    'rift valley fever': 'RVF',
  };
  const stripped = stripDiseaseCode(name);
  return aliases[stripped] || null;
}

/**
 * True if a record's disease_name matches the filter selection.
 * Handles "Foot-and-Mouth Disease - FMD" vs "Foot-and-Mouth Disease".
 */
export function diseasesMatch(
  recordDisease?: string | null,
  selected?: string | null
): boolean {
  if (!selected) return true;
  if (!recordDisease) return false;
  const a = recordDisease.trim();
  const b = selected.trim();
  if (a.toLowerCase() === b.toLowerCase()) return true;
  if (stripDiseaseCode(a) === stripDiseaseCode(b)) return true;
  const ca = diseaseCode(a);
  const cb = diseaseCode(b);
  if (ca && cb && ca === cb) return true;
  return false;
}
