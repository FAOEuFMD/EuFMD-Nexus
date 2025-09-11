/**
 * Utility functions to safely prepare data for Nivo charts
 * These functions ensure that all objects are extensible and properly formatted
 */

/**
 * Deep clone function that ensures all objects are extensible
 */
export const deepCloneExtensible = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepCloneExtensible(item));
  
  const cloned: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepCloneExtensible(obj[key]);
    }
  }
  return cloned;
};

/**
 * Validates and sanitizes data for Nivo heatmap
 */
export const sanitizeHeatmapData = (data: any[]): any[] => {
  try {
    const sanitized = data.map(item => ({
      id: String(item.id || item.name_un || 'Unknown'),
      data: (item.data || []).map((point: any) => ({
        x: String(point.x || ''),
        y: Number(point.y ?? 0)
      }))
    }));
    
    return deepCloneExtensible(sanitized);
  } catch (error) {
    console.warn('Failed to sanitize heatmap data:', error);
    return [];
  }
};

/**
 * Validates and sanitizes data for Nivo bar chart
 */
export const sanitizeBarData = (data: any[]): any[] => {
  try {
    const sanitized = data.map(item => {
      const result: any = {};
      for (const key in item) {
        if (item.hasOwnProperty(key)) {
          if (key === 'country' || typeof item[key] === 'string') {
            result[key] = String(item[key]);
          } else {
            result[key] = Number(item[key] ?? 0);
          }
        }
      }
      return result;
    });
    
    return deepCloneExtensible(sanitized);
  } catch (error) {
    console.warn('Failed to sanitize bar chart data:', error);
    return [];
  }
};

/**
 * Validates and sanitizes data for Nivo radar chart
 */
export const sanitizeRadarData = (data: any[]): any[] => {
  try {
    const sanitized = data.map(item => {
      const result: any = {};
      for (const key in item) {
        if (item.hasOwnProperty(key)) {
          if (key === 'pathway' || typeof item[key] === 'string') {
            result[key] = String(item[key]);
          } else {
            result[key] = Number(item[key] ?? 0);
          }
        }
      }
      return result;
    });
    
    return deepCloneExtensible(sanitized);
  } catch (error) {
    console.warn('Failed to sanitize radar chart data:', error);
    return [];
  }
};

/**
 * Generic object extensibility checker
 */
export const ensureExtensible = (obj: any): any => {
  try {
    // Try to add a test property
    const testObj = { ...obj };
    testObj._test = true;
    delete testObj._test;
    return obj;
  } catch (error) {
    // If that fails, deep clone the object
    console.warn('Object not extensible, deep cloning:', error);
    return deepCloneExtensible(obj);
  }
};
