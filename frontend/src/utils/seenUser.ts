import { User } from '../types';

/** South East European Neighbourhood (SEEN) countries — used for region helpers */
export const SEEN_COUNTRIES = [
  'Armenia',
  'Azerbaijan',
  'Georgia',
  'Iran (Islamic Republic of)',
  'Iraq',
  'Iraq (KRI)',
  'Pakistan',
  'Türkiye',
  'Turkey',
  'Russian Federation',
] as const;

export function isSeenCountry(country?: string | null): boolean {
  if (!country) return false;
  return SEEN_COUNTRIES.includes(country as (typeof SEEN_COUNTRIES)[number]);
}
