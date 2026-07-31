export const UN_MAP_TILE_URL =
  'https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/tile/{z}/{y}/{x}';

export const UN_MAP_ATTRIBUTION = '&copy; United Nations Geospatial Information Section';

/** ClearMap_WebTopo only publishes LODs 0–6; higher zooms must overzoom these tiles. */
export const UN_MAP_MAX_NATIVE_ZOOM = 6;

export const MAP_DISCLAIMER =
  'The boundaries and names shown and the designations used on this map do not imply the ' +
  'expression of any opinion whatsoever on the part of FAO concerning the legal status of any ' +
  'country, territory, city or area or of its authorities, or concerning the delimitation of its ' +
  'frontiers and boundaries.';
