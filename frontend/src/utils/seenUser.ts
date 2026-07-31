import { User } from '../types';

/** South East European Neighbourhood (SEEN) countries */
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

export function isSeenRispUser(user?: Pick<User, 'role' | 'country'> | null): boolean {
  const role = user?.role?.toLowerCase();
  // Admins see the same RISP branching (SOI + FAST Report) as SEEN users
  if (role === 'admin') return true;
  return role === 'risp' && isSeenCountry(user?.country);
}

export const SEEN_RISP_PORTAL_PATH = '/risp/portal';
