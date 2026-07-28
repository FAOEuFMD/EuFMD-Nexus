import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  getFeatureCountryName,
  resolveFastReportCountry,
} from '../../utils/fastReport/countryResolver';
import { COUNTRY_ZOOM_THRESHOLD } from '../../utils/fastReport/countryAnalytics';

type GeoFeature = {
  properties?: Record<string, string | number | undefined>;
};

export interface CountrySelectPayload {
  fastReportCountry: string | null;
  geoName: string;
}

interface CountryBoundariesLayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonData: any;
  mapZoom: number;
  selectedCountry: string | null;
  selectedGeoName: string | null;
  showPcpStyling: boolean;
  pcpData: { Country: string; PCP_Stage: string }[];
  getPcpStageColor: (stage: string) => string;
  fastReportCountries: string[];
  onCountrySelect: (payload: CountrySelectPayload) => void;
  /** When true, also renders admin_level 1 (district/province) polygons */
  showDistrictBoundaries?: boolean;
}

const CountryBoundariesLayer: React.FC<CountryBoundariesLayerProps> = ({
  geoJsonData,
  mapZoom,
  selectedCountry,
  selectedGeoName,
  showPcpStyling,
  pcpData,
  getPcpStageColor,
  fastReportCountries,
  onCountrySelect,
  showDistrictBoundaries = false,
}) => {
  const map = useMap();
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const interactive = mapZoom >= COUNTRY_ZOOM_THRESHOLD;

  /**
   * Filter the GeoJSON features to only include:
   * - admin_level: 0 (country boundaries) always
   * - admin_level: 1 (district/province) only when showDistrictBoundaries is true
   */
  const filteredGeoJsonData = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return geoJsonData;

    return {
      ...geoJsonData,
      features: geoJsonData.features.filter(
        (feature: { properties?: Record<string, string | number | undefined> }) => {
          const adminLevel = feature.properties?.admin_level;
          // Always include features without admin_level (backward compatibility)
          if (adminLevel === undefined || adminLevel === null) return true;
          // Include admin_level 0 (countries) always
          if (adminLevel === 0) return true;
          // Include admin_level 1 only when showDistrictBoundaries is true
          if (adminLevel === 1) return showDistrictBoundaries;
          // Include any other levels
          return true;
        }
      ),
    };
  }, [geoJsonData, showDistrictBoundaries]);

  const getStyle = useCallback(
    (feature?: GeoFeature) => {
      const geoName = feature ? getFeatureCountryName(feature) : '';
      const resolved = geoName
        ? resolveFastReportCountry(geoName, fastReportCountries)
        : null;
      const isSelected =
        (resolved && resolved === selectedCountry) ||
        geoName === selectedGeoName ||
        (selectedCountry && geoName && resolveFastReportCountry(geoName, [selectedCountry]) === selectedCountry);

      if (showPcpStyling && feature) {
        const pcpEntry = pcpData.find(
          (e) => e.Country === geoName || e.Country === resolved
        );
        const pcpStage = pcpEntry?.PCP_Stage || '';
        return {
          fillColor: getPcpStageColor(pcpStage),
          fillOpacity: isSelected ? 0.75 : 0.6,
          color: isSelected ? '#015039' : '#ffffff',
          weight: isSelected ? 3 : 1,
        };
      }

      if (!interactive) {
        return {
          fillColor: '#94a3b8',
          fillOpacity: 0,
          color: '#94a3b8',
          weight: 0,
          opacity: 0,
        };
      }

      return {
        fillColor: isSelected ? '#015039' : '#10b981',
        fillOpacity: isSelected ? 0.35 : 0.08,
        color: isSelected ? '#015039' : '#64748b',
        weight: isSelected ? 3 : 1,
      };
    },
    [
      showPcpStyling,
      pcpData,
      getPcpStageColor,
      fastReportCountries,
      selectedCountry,
      selectedGeoName,
      interactive,
    ]
  );

  useEffect(() => {
    const layer = geoJsonLayerRef.current;
    if (!layer) return;
    layer.eachLayer((l) => {
      const feature = (l as L.Layer & { feature?: GeoFeature }).feature;
      if (feature) {
        (l as L.Path).setStyle(getStyle(feature));
      }
      (l as L.Layer & { options?: { interactive?: boolean } }).options = {
        ...(l as L.Layer & { options?: { interactive?: boolean } }).options,
        interactive,
      };
    });
  }, [getStyle, interactive, mapZoom, selectedCountry, selectedGeoName, showPcpStyling]);

  const onEachFeature = useCallback(
    (feature: GeoFeature, layer: L.Layer) => {
      const geoName = getFeatureCountryName(feature);
      const resolved = resolveFastReportCountry(geoName, fastReportCountries);

      (layer as L.Layer & { options?: { interactive?: boolean } }).options = {
        ...layer.options,
        interactive,
      };

      if (showPcpStyling) {
        const pcpEntry = pcpData.find(
          (e) => e.Country === geoName || e.Country === resolved
        );
        const pcpStage = pcpEntry?.PCP_Stage || 'No data';
        layer.bindPopup(
          `<div style="padding: 8px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">${geoName}</h3>
            <p><strong>PCP Stage:</strong> ${pcpStage}</p>
          </div>`
        );
      }

      layer.on({
        mouseover: (e) => {
          if (!interactive) return;
          const target = e.target as L.Path;
          target.setStyle({
            weight: 2,
            fillOpacity: showPcpStyling ? 0.7 : 0.2,
          });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            target.bringToFront();
          }
        },
        mouseout: (e) => {
          const target = e.target as L.Path;
          target.setStyle(getStyle(feature));
        },
        click: (e) => {
          if (!interactive) return;
          L.DomEvent.stopPropagation(e);
          const pathLayer = e.target as L.Path;
          const bounds = (pathLayer as L.Polygon).getBounds?.();
          if (bounds?.isValid?.()) {
            map.flyToBounds(bounds, { maxZoom: 8, duration: 0.5 });
          }
          onCountrySelect({
            fastReportCountry: resolved,
            geoName,
          });
        },
      });
    },
    [
      interactive,
      showPcpStyling,
      pcpData,
      fastReportCountries,
      onCountrySelect,
      map,
      getStyle,
    ]
  );

  return (
    <GeoJSON
      ref={(instance) => {
        geoJsonLayerRef.current = instance;
      }}
      data={filteredGeoJsonData}
      style={(feature) => getStyle(feature ?? undefined)}
      onEachFeature={onEachFeature}
    />
  );
};

export default CountryBoundariesLayer;