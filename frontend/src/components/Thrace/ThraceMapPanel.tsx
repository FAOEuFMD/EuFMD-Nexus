import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../../services/api';
import {
  MAP_DISCLAIMER,
  UN_MAP_ATTRIBUTION,
  UN_MAP_MAX_NATIVE_ZOOM,
  UN_MAP_TILE_URL,
} from '../maps/mapConstants';

export type ThraceMapMode = 'locations' | 'visited' | 'intensity';

interface DistrictOption {
  districtID: number;
  district_name: string;
}

interface CountryGroup {
  nationID: number | null;
  country: string;
  districts: DistrictOption[];
}

interface MapPoint {
  epiunitID: number;
  epiunitname: string;
  epiunitcountrycode: string;
  villagename: string;
  lat: number;
  lon: number;
  districtID: number;
  district_name: string;
  nationID: number | null;
  country: string;
  visits: number;
  visited: boolean;
}

const THRACE_CENTER: [number, number] = [41.2, 26.5];
const LOCATION_COLOR = '#15736d';
const DEFAULT_ZOOM = 13;
const MARKER_RADIUS = 4;
const CHECKBOX_STYLE: React.CSSProperties = { accentColor: '#15736d' };

function visitIntensityColor(visits: number): string {
  if (visits <= 0) return '#ef4444'; // red — 0
  if (visits <= 2) return '#eab308'; // yellow 1–2
  if (visits <= 4) return '#f97316'; // orange 3–4
  if (visits <= 6) return '#22c55e'; // green 5–6
  return '#7c3aed'; // purple 7+
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.03), { maxZoom: 15 });
    }
  }, [map, points]);
  return null;
}

function pointColor(mode: ThraceMapMode, point: MapPoint): string {
  if (mode === 'locations') return LOCATION_COLOR;
  if (mode === 'visited') return point.visited ? '#22c55e' : '#ef4444';
  return visitIntensityColor(point.visits);
}

interface ThraceMapPanelProps {
  onClose?: () => void;
}

const ThraceMapPanel: React.FC<ThraceMapPanelProps> = ({ onClose }) => {
  const [countries, setCountries] = useState<CountryGroup[]>([]);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<number[]>([]);
  const [districtMenuOpen, setDistrictMenuOpen] = useState(false);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<ThraceMapMode>('visited');
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedPeriod, setAppliedPeriod] = useState<{ start: string; end: string } | null>(null);
  const [autoLoadReady, setAutoLoadReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingDistricts(true);
      setError(null);
      try {
        const res = await apiService.thrace.getMapDistricts();
        const groups: CountryGroup[] = res.data?.countries || [];
        setCountries(groups);
        const allIds = groups.flatMap((g) => g.districts.map((d) => d.districtID));
        setSelectedDistrictIds(allIds);
        setAutoLoadReady(allIds.length > 0);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load districts');
      } finally {
        setLoadingDistricts(false);
      }
    };
    load();
  }, []);

  const selectedLabel = useMemo(() => {
    if (selectedDistrictIds.length === 0) return 'Select districts…';
    const total = countries.reduce((n, c) => n + c.districts.length, 0);
    if (total > 0 && selectedDistrictIds.length === total) {
      return `All ${selectedDistrictIds.length} districts selected`;
    }
    if (selectedDistrictIds.length === 1) {
      for (const c of countries) {
        const d = c.districts.find((x) => x.districtID === selectedDistrictIds[0]);
        if (d) return `${c.country}: ${d.district_name}`;
      }
    }
    return `${selectedDistrictIds.length} districts selected`;
  }, [selectedDistrictIds, countries]);

  const toggleDistrict = (id: number) => {
    setSelectedDistrictIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCountryAll = (group: CountryGroup) => {
    const ids = group.districts.map((d) => d.districtID);
    const allSelected = ids.every((id) => selectedDistrictIds.includes(id));
    if (allSelected) {
      setSelectedDistrictIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedDistrictIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const loadMap = useCallback(async (districtIds?: number[]) => {
    const ids = districtIds ?? selectedDistrictIds;
    if (ids.length === 0) {
      setError('Select at least one district');
      return;
    }
    setLoadingMap(true);
    setError(null);
    try {
      const res = await apiService.thrace.getMapData({
        start_date: startDate,
        end_date: endDate,
        district_ids: ids.join(','),
      });
      setPoints(res.data?.points || []);
      setAppliedPeriod({
        start: res.data?.start_date || startDate,
        end: res.data?.end_date || endDate,
      });
      if (!(res.data?.points || []).length) {
        setError('No epiunits with coordinates found for the selected districts.');
      }
    } catch (err: any) {
      setPoints([]);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load map data');
    } finally {
      setLoadingMap(false);
    }
  }, [selectedDistrictIds, startDate, endDate]);

  // Auto-load once all districts are selected on first open
  useEffect(() => {
    if (!autoLoadReady || selectedDistrictIds.length === 0) return;
    setAutoLoadReady(false);
    loadMap(selectedDistrictIds);
  }, [autoLoadReady, selectedDistrictIds, loadMap]);
  const legendItems = useMemo(() => {
    if (mode === 'locations') {
      return [{ label: 'Epiunit', color: LOCATION_COLOR }];
    }
    if (mode === 'visited') {
      return [
        { label: 'Visited', color: '#22c55e' },
        { label: 'Not visited', color: '#ef4444' },
      ];
    }
    return [
      { label: '0 visits', color: '#ef4444' },
      { label: '1–2 visits', color: '#eab308' },
      { label: '3–4 visits', color: '#f97316' },
      { label: '5–6 visits', color: '#22c55e' },
      { label: '7+ visits', color: '#7c3aed' },
    ];
  }, [mode]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold">Surveillance map</h2>
          <p className="text-sm text-gray-600 mt-1">
            Epiunit locations and field-activity visits for the selected districts and period.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* Hierarchical district multi-select */}
        <div className="lg:col-span-4 relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">Districts</label>
          <button
            type="button"
            disabled={loadingDistricts}
            onClick={() => setDistrictMenuOpen((o) => !o)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white focus:outline-none focus:ring-2 focus:ring-green-500 flex justify-between items-center"
          >
            <span className="truncate text-sm">{loadingDistricts ? 'Loading…' : selectedLabel}</span>
            <span className="text-gray-400 ml-2">{districtMenuOpen ? '▲' : '▼'}</span>
          </button>
          {districtMenuOpen && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg">
              {countries.map((group) => {
                const ids = group.districts.map((d) => d.districtID);
                const allSelected = ids.length > 0 && ids.every((id) => selectedDistrictIds.includes(id));
                return (
                  <div key={group.nationID ?? group.country} className="border-b border-gray-100 last:border-0">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm font-bold text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => toggleCountryAll(group)}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={allSelected}
                        className="h-4 w-4 rounded border-gray-300 text-[#15736d] focus:ring-[#15736d]"
                        style={CHECKBOX_STYLE}
                      />
                      {group.country}
                    </button>
                    {group.districts.map((d) => (
                      <label
                        key={d.districtID}
                        className="flex items-center gap-2 px-3 pl-8 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-[#15736d] focus:ring-[#15736d]"
                          style={CHECKBOX_STYLE}
                          checked={selectedDistrictIds.includes(d.districtID)}
                          onChange={() => toggleDistrict(d.districtID)}
                        />
                        {d.district_name}
                      </label>
                    ))}
                  </div>
                );
              })}
              {countries.length === 0 && !loadingDistricts && (
                <div className="px-3 py-2 text-sm text-gray-500">No districts available</div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ThraceMapMode)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="locations">Locations</option>
            <option value="visited">Visited / not visited</option>
            <option value="intensity">Visit intensity</option>
          </select>
        </div>
        <div className="lg:col-span-2 flex items-end">
          <button
            type="button"
            className="nav-btn w-full"
            onClick={() => loadMap()}
            disabled={loadingMap}
          >
            {loadingMap ? 'Loading…' : 'Show map'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {appliedPeriod && points.length > 0 && (
        <p className="text-xs text-gray-500 mb-2">
          Showing {points.length} epiunits · visits from {appliedPeriod.start} to {appliedPeriod.end}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0 h-96 lg:h-[520px] rounded-lg overflow-hidden border border-gray-200 relative z-0">
          <MapContainer
            center={THRACE_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            className="h-full w-full"
            zoomControl
          >
            <TileLayer
              url={UN_MAP_TILE_URL}
              attribution={UN_MAP_ATTRIBUTION}
              maxNativeZoom={UN_MAP_MAX_NATIVE_ZOOM}
              maxZoom={18}
            />
            <FitBounds points={points} />
            {points.map((p) => (
              <CircleMarker
                key={p.epiunitID}
                center={[p.lat, p.lon]}
                radius={MARKER_RADIUS}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1,
                  fillColor: pointColor(mode, p),
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-sm">{p.villagename || p.epiunitname || 'Epiunit'}</div>
                    <div>{p.country}{p.district_name ? ` · ${p.district_name}` : ''}</div>
                    {p.epiunitcountrycode && <div>Code: {p.epiunitcountrycode}</div>}
                    <div>Visits in period: <strong>{p.visits}</strong></div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div className="lg:w-40 flex-shrink-0">
          <div className="text-sm font-semibold text-gray-800 mb-2">Legend</div>
          <div className="flex flex-col gap-2">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-gray-700">
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-600 italic leading-tight">{MAP_DISCLAIMER}</p>
      </div>
    </div>
  );
};

export default ThraceMapPanel;
