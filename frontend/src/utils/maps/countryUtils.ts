/**
 * Utility functions for map data
 */

/**
 * Fetches GeoJSON data for country boundaries
 * Uses Natural Earth Data (UN-approved source)
 */
export const fetchCountryBoundaries = async () => {
  try {
    // Using Natural Earth Data (UN-approved source)
    // This is a simplified version for better performance
    const response = await fetch(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch country boundaries');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching country boundaries:', error);
    throw error;
  }
};

/**
 * Normalizes country names between GeoJSON and API data
 * This helps match country names that might be slightly different
 */
export const normalizeCountryName = (name: string): string => {
  // Handle common variations
  const normalizations: Record<string, string> = {
    'United States of America': 'United States',
    'USA': 'United States',
    'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
    'UK': 'United Kingdom',
    'Russian Federation': 'Russia',
    'Macedonia': 'North Macedonia',
    'Republic of Moldova': 'Moldova',
    'Congo, Democratic Republic of the': 'Democratic Republic of the Congo',
    'Congo': 'Republic of the Congo',
    'Czechia': 'Czech Republic',
    'Türkiye': 'Turkey'
  };

  // Return the normalized name if it exists, otherwise return the original name
  return normalizations[name] || name;
};

/**
 * Calculates a risk color based on a score value
 */
export const getRiskColor = (score: number): string => {
  if (score === 0) return '#4CAF50'; // Low risk (green)
  if (score <= 1) return '#FFEB3B'; // Low-medium risk (yellow)
  if (score <= 2) return '#FF9800'; // Medium-high risk (orange)
  return '#F44336'; // High risk (red)
};
