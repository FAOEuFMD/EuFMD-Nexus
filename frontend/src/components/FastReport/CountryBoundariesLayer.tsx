import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  getFeatureCountryName,
  getFeatureIso3,
  findPcpEntryForFeature,
  resolveFastReportCountry,
} from '../../utils/fastReport/countryResolver';
import { ISO3_TO_FAST_COUNTRY, ISO3_TO_PCP_COUNTRY } from '../../utils/fastReport/countryIso3';
import { COUNTRY_ZOOM_THRESHOLD } from '../../utils/fastReport/countryAnalytics';
import {
  getVaccFillBand,
  getVaccPatternUrl,
} from './VaccinationPatternDefs';

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
  /** When true, fill countries by vaccination dose / flagged band (pattern hatch). */
  showVaccinationChoropleth?: boolean;
  /** Country name → total vaccine doses (selected vacc layers). */
  vaccinationDosesByCountry?: Record<string, number>;
  /** Countries with Vaccination=1 but no quantitative doses. */
  vaccinationFlaggedByCountry?: Set<string> | Record<string, boolean>;
  fastReportCountries: string[];
  onCountrySelect: (payload: CountrySelectPayload) => void;
  /** When true, also renders admin_level 1 (district/province) polygons */
  showDistrictBoundaries?: boolean;
}

function isFlagged(
  country: string | null,
  flagged: Set<string> | Record<string, boolean> | undefined
): boolean {
  if (!country || !flagged) return false;
  if (flagged instanceof Set) return flagged.has(country);
  return !!flagged[country];
}

const CountryBoundariesLayer: React.FC<CountryBoundariesLayerProps> = ({
  geoJsonData,
  mapZoom,
  selectedCountry,
  selectedGeoName,
  showPcpStyling,
  pcpData,
  getPcpStageColor,
  showVaccinationChoropleth = false,
  vaccinationDosesByCountry = {},
  vaccinationFlaggedByCountry,
  fastReportCountries,
  onCountrySelect,
  showDistrictBoundaries = false,
}) => {
  const map = useMap();
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const interactive =
    showVaccinationChoropleth ||
    showPcpStyling ||
    mapZoom >= COUNTRY_ZOOM_THRESHOLD;

  const filteredGeoJsonData = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return geoJsonData;

    return {
      ...geoJsonData,
      features: geoJsonData.features.filter(
        (feature: { properties?: Record<string, string | number | undefined> }) => {
          const adminLevel = feature.properties?.admin_level;
          if (adminLevel === undefined || adminLevel === null) return true;
          if (adminLevel === 0) return true;
          if (adminLevel === 1) return showDistrictBoundaries;
          return true;
        }
      ),
    };
  }, [geoJsonData, showDistrictBoundaries]);

  const resolveFeature = useCallback(
    (feature?: GeoFeature) => {
      const geoName = feature ? getFeatureCountryName(feature) : '';
      const iso3 = feature ? getFeatureIso3(feature) : null;
      const resolved = geoName || iso3
        ? resolveFastReportCountry(geoName, fastReportCountries, iso3)
        : null;
      return { geoName, iso3, resolved };
    },
    [fastReportCountries]
  );

  const lookupDoses = useCallback(
    (geoName: string, resolved: string | null) => {
      if (resolved && vaccinationDosesByCountry[resolved] != null) {
        return vaccinationDosesByCountry[resolved];
      }
      if (geoName && vaccinationDosesByCountry[geoName] != null) {
        return vaccinationDosesByCountry[geoName];
      }
      return 0;
    },
    [vaccinationDosesByCountry]
  );

  const lookupFlagged = useCallback(
    (geoName: string, resolved: string | null) => {
      return isFlagged(resolved, vaccinationFlaggedByCountry) || isFlagged(geoName, vaccinationFlaggedByCountry);
    },
    [vaccinationFlaggedByCountry]
  );

  const getStyle = useCallback(
    (feature?: GeoFeature) => {
      const { geoName, iso3, resolved } = resolveFeature(feature);
      const isSelected =
        (resolved && resolved === selectedCountry) ||
        geoName === selectedGeoName ||
        (selectedCountry &&
          geoName &&
          resolveFastReportCountry(geoName, [selectedCountry]) === selectedCountry);

      // PCP takes priority over vaccination when both layers are enabled
      if (showPcpStyling && feature) {
        const pcpEntry = findPcpEntryForFeature(pcpData, geoName, resolved, iso3);
        const pcpStage = pcpEntry?.PCP_Stage || '';
        return {
          fillColor: getPcpStageColor(pcpStage),
          fillOpacity: isSelected ? 0.75 : 0.6,
          color: isSelected ? '#015039' : '#ffffff',
          weight: isSelected ? 3 : 1,
        };
      }

      if (showVaccinationChoropleth && feature) {
        const doses = lookupDoses(geoName, resolved);
        const flagged = lookupFlagged(geoName, resolved);
        const band = getVaccFillBand(doses, flagged);
        if (band) {
          const isFlagOnly = band === 'flagged';
          return {
            fillColor: getVaccPatternUrl(band),
            fillOpacity: isSelected ? 0.95 : 0.85,
            color: isSelected ? '#015039' : isFlagOnly ? '#b45309' : '#0f766e',
            weight: isSelected ? 3 : 1.25,
            opacity: 0.9,
          };
        }
        return {
          fillColor: '#94a3b8',
          fillOpacity: isSelected ? 0.12 : 0.04,
          color: isSelected ? '#015039' : '#94a3b8',
          weight: isSelected ? 2.5 : 1,
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
      showVaccinationChoropleth,
      lookupDoses,
      lookupFlagged,
      resolveFeature,
      showPcpStyling,
      pcpData,
      getPcpStageColor,
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
  }, [
    getStyle,
    interactive,
    mapZoom,
    selectedCountry,
    selectedGeoName,
    showPcpStyling,
    showVaccinationChoropleth,
    vaccinationDosesByCountry,
    vaccinationFlaggedByCountry,
  ]);

  const onEachFeature = useCallback(
    (feature: GeoFeature, layer: L.Layer) => {
      const { geoName, iso3, resolved } = resolveFeature(feature);

      (layer as L.Layer & { options?: { interactive?: boolean } }).options = {
        ...layer.options,
        interactive,
      };

      if (showPcpStyling) {
        const pcpEntry = findPcpEntryForFeature(pcpData, geoName, resolved, iso3);
        const pcpStage = pcpEntry?.PCP_Stage || 'No data';
        const label =
          resolved ||
          (iso3
            ? ISO3_TO_FAST_COUNTRY[iso3] || ISO3_TO_PCP_COUNTRY[iso3]
            : undefined) ||
          geoName ||
          'Country';
        layer.bindPopup(
          `<div style="padding: 8px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">${label}</h3>
            <p><strong>PCP Stage:</strong> ${pcpStage}</p>
          </div>`
        );
      } else if (showVaccinationChoropleth) {
        const doses = lookupDoses(geoName, resolved);
        const flagged = lookupFlagged(geoName, resolved);
        const doseText =
          doses > 0
            ? doses.toLocaleString()
            : flagged
              ? 'In place (no dose numbers)'
              : 'No data';
        layer.bindPopup(
          `<div style="padding: 8px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">${geoName || resolved || 'Country'}</h3>
            <p><strong>Vaccine doses:</strong> ${doseText}</p>
          </div>`
        );
      }

      layer.on({
        mouseover: (e) => {
          if (!interactive) return;
          const target = e.target as L.Path;
          target.setStyle({
            weight: 2,
            fillOpacity: showVaccinationChoropleth || showPcpStyling ? 0.95 : 0.2,
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
      showVaccinationChoropleth,
      showPcpStyling,
      pcpData,
      lookupDoses,
      lookupFlagged,
      resolveFeature,
      onCountrySelect,
      map,
      getStyle,
    ]
  );

  return (
    <GeoJSON
      key={`boundaries-${filteredGeoJsonData?.features?.length || 0}-${showVaccinationChoropleth}-${showPcpStyling}`}
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
