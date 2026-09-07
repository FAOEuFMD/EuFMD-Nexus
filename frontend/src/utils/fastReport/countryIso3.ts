/** FAST_Report.Country → ISO3 for UN ClearMap layer 109. */
export const FAST_COUNTRY_ISO3: Record<string, string> = {
  Afghanistan: 'AFG',
  Algeria: 'DZA',
  Armenia: 'ARM',
  Azerbaijan: 'AZE',
  Egypt: 'EGY',
  Georgia: 'GEO',
  'Iran (Islamic Republic of)': 'IRN',
  Iraq: 'IRQ',
  Israel: 'ISR',
  Jordan: 'JOR',
  Lebanon: 'LBN',
  Libya: 'LBY',
  Mauritania: 'MRT',
  Morocco: 'MAR',
  Pakistan: 'PAK',
  Palestine: 'PSE',
  'Palestine, State of': 'PSE',
  Sudan: 'SDN',
  'Syrian Arab Republic': 'SYR',
  Tunisia: 'TUN',
  Türkiye: 'TUR',
  Turkey: 'TUR',
  'Russian Federation': 'RUS',
  Russia: 'RUS',
};

/**
 * PCP-FMD country labels (2026 DB) → ISO3 for UN ClearMap layer 109.
 * Covers Africa / Asia / Near East beyond EuFMD neighbourhood.
 */
export const PCP_COUNTRY_ISO3: Record<string, string> = {
  Afghanistan: 'AFG',
  Angola: 'AGO',
  Armenia: 'ARM',
  Azerbaijan: 'AZE',
  Bahrain: 'BHR',
  Bangladesh: 'BGD',
  Benin: 'BEN',
  Bhutan: 'BTN',
  Botswana: 'BWA',
  'Burkina Faso': 'BFA',
  Burundi: 'BDI',
  Cambodia: 'KHM',
  Cameroon: 'CMR',
  'Cape Verde': 'CPV',
  'Cabo Verde': 'CPV',
  'Central African Republic': 'CAF',
  Chad: 'TCD',
  Comoros: 'COM',
  Congo: 'COG',
  "Côte d'Ivoire": 'CIV',
  "Cote d'Ivoire": 'CIV',
  'Democratic Republic of the Congo': 'COD',
  Djibouti: 'DJI',
  Egypt: 'EGY',
  'Equatorial Guinea': 'GNQ',
  Eritrea: 'ERI',
  Eswatini: 'SWZ',
  Ethiopia: 'ETH',
  Gabon: 'GAB',
  Gambia: 'GMB',
  Georgia: 'GEO',
  Ghana: 'GHA',
  Guinea: 'GIN',
  'Guinea-Bissau': 'GNB',
  India: 'IND',
  'Iran (Islamic Republic of)': 'IRN',
  Iraq: 'IRQ',
  Jordan: 'JOR',
  Kazakhstan: 'KAZ',
  Kenya: 'KEN',
  Kuwait: 'KWT',
  Kyrgyzstan: 'KGZ',
  "Lao People's Democratic Republic": 'LAO',
  Lebanon: 'LBN',
  Lesotho: 'LSO',
  Liberia: 'LBR',
  Libya: 'LBY',
  Madagascar: 'MDG',
  Malawi: 'MWI',
  Malaysia: 'MYS',
  Mali: 'MLI',
  Mauritania: 'MRT',
  Mauritius: 'MUS',
  Mozambique: 'MOZ',
  Myanmar: 'MMR',
  Namibia: 'NAM',
  Nepal: 'NPL',
  Niger: 'NER',
  Nigeria: 'NGA',
  Oman: 'OMN',
  Pakistan: 'PAK',
  Palestine: 'PSE',
  Qatar: 'QAT',
  Rwanda: 'RWA',
  'Sao Tome and Principe': 'STP',
  'Saudi Arabia': 'SAU',
  Senegal: 'SEN',
  Seychelles: 'SYC',
  'Sierra Leone': 'SLE',
  Somalia: 'SOM',
  'South Africa': 'ZAF',
  'South Sudan': 'SSD',
  'Sri Lanka': 'LKA',
  Sudan: 'SDN',
  'Syrian Arab Republic': 'SYR',
  Tajikistan: 'TJK',
  Thailand: 'THA',
  Togo: 'TGO',
  Türkiye: 'TUR',
  Turkey: 'TUR',
  Turkmenistan: 'TKM',
  Uganda: 'UGA',
  'United Arab Emirates': 'ARE',
  'United Republic of Tanzania': 'TZA',
  Uzbekistan: 'UZB',
  'Viet Nam': 'VNM',
  Vietnam: 'VNM',
  Yemen: 'YEM',
  Zambia: 'ZMB',
  Zimbabwe: 'ZWE',
};

/** ISO3 → preferred FAST_Report.Country label when present in data. */
export const ISO3_TO_FAST_COUNTRY: Record<string, string> = {
  AFG: 'Afghanistan',
  DZA: 'Algeria',
  ARM: 'Armenia',
  AZE: 'Azerbaijan',
  EGY: 'Egypt',
  GEO: 'Georgia',
  IRN: 'Iran (Islamic Republic of)',
  IRQ: 'Iraq',
  ISR: 'Israel',
  JOR: 'Jordan',
  LBN: 'Lebanon',
  LBY: 'Libya',
  MRT: 'Mauritania',
  MAR: 'Morocco',
  PAK: 'Pakistan',
  PSE: 'Palestine',
  SDN: 'Sudan',
  SYR: 'Syrian Arab Republic',
  TUN: 'Tunisia',
  TUR: 'Türkiye',
  RUS: 'Russian Federation',
};

/** ISO3 → PCP country label (for map popups outside neighbourhood). */
export const ISO3_TO_PCP_COUNTRY: Record<string, string> = Object.fromEntries(
  Object.entries(PCP_COUNTRY_ISO3).map(([name, iso]) => [iso, name])
);

export function iso3ForFastCountry(country: string): string | null {
  return FAST_COUNTRY_ISO3[country] || null;
}

/** Resolve ISO3 from FAST or PCP country labels. */
export function iso3ForCountry(country: string): string | null {
  return FAST_COUNTRY_ISO3[country] || PCP_COUNTRY_ISO3[country] || null;
}

export function fastCountriesToIso3(countries: Iterable<string>): string[] {
  return countriesToIso3(countries);
}

export function countriesToIso3(countries: Iterable<string>): string[] {
  const codes = new Set<string>();
  for (const c of Array.from(countries)) {
    const iso = iso3ForCountry(c);
    if (iso) codes.add(iso);
  }
  return Array.from(codes);
}
