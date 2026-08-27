import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';

/** Matches countries.soi = 1 (plus common user.country variants). */
const SOI_COUNTRY_HINTS = [
  'armenia',
  'azerbaijan',
  'bulgaria',
  'georgia',
  'greece',
  'iran',
  'iraq',
  'pakistan',
  'russian federation',
  'russia',
  'türkiye',
  'turkiye',
  'turkey',
];

function guessSoiFromCountry(country?: string | null): boolean {
  if (!country) return false;
  const c = country.toLowerCase();
  return SOI_COUNTRY_HINTS.some((h) => c.includes(h));
}

/**
 * Same UI for all countries; only welcome copy differs.
 * Uses local country-name matching (no extra API) so a missing/401
 * program-context call cannot force logout via the axios interceptor.
 */
export function useRispProgram() {
  const { user } = useAuthStore();
  const isSoi = useMemo(
    () => user?.role?.toLowerCase() === 'soi' || guessSoiFromCountry(user?.country),
    [user?.role, user?.country]
  );
  return { isSoi, loading: false, country: user?.country || '' };
}
