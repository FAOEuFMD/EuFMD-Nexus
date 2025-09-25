/**
 * Utility functions for map data
 */

/**
 * Fetches GeoJSON data for country boundaries
 * Uses UN GeoServices API (UN-compliant source) directly
 */
export const fetchCountryBoundaries = async (iso3Codes?: string[]) => {
  try {
    // UN GeoServices API base URL
    const UN_GEOSERVICES_BASE = "https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/109/query";
    
    // Build the query parameters
    const params = new URLSearchParams({
      outFields: "ISO3CD,ROMNAM",
      returnGeometry: "true",
      f: "geojson"
    });
    
    // If specific countries are requested, add the WHERE clause
    if (iso3Codes && iso3Codes.length > 0) {
      // Format for SQL IN clause
      const codes_str = iso3Codes.join("','");
      params.set("where", `ISO3CD IN ('${codes_str}')`);
    } else {
      // Get all countries
      params.set("where", "1=1");
    }
    
    const response = await fetch(`${UN_GEOSERVICES_BASE}?${params}`);
    
    if (!response.ok) {
      throw new Error(`UN GeoServices API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate the GeoJSON structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from UN GeoServices');
    }
    
    if (!data.type || data.type !== 'FeatureCollection') {
      throw new Error('Response is not a valid GeoJSON FeatureCollection');
    }
    
    if (!Array.isArray(data.features)) {
      throw new Error('GeoJSON features is not an array');
    }
    
    // Validate each feature
    const validFeatures = data.features.filter((feature: any) => {
      return feature && 
             feature.type === 'Feature' && 
             feature.geometry && 
             feature.properties;
    });
    
    const validatedData = {
      type: 'FeatureCollection',
      features: validFeatures
    };
    
    console.log(`Successfully loaded ${validatedData.features.length} valid countries from UN GeoServices`);
    
    return validatedData;
  } catch (error) {
    console.error('Error fetching country boundaries from UN GeoServices:', error);
    // No fallback - just return null to show background map only
    return null;
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
