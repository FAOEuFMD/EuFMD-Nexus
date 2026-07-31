import React from 'react';
import { MapContainer, TileLayer, MapContainerProps } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_DISCLAIMER, UN_MAP_ATTRIBUTION, UN_MAP_MAX_NATIVE_ZOOM, UN_MAP_TILE_URL } from './mapConstants';

type NexusMapProps = {
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  height?: string;
  className?: string;
  mapClassName?: string;
  showDisclaimer?: boolean;
  disclaimerClassName?: string;
  disclaimerTextClassName?: string;
  children?: React.ReactNode;
} & Pick<MapContainerProps, 'scrollWheelZoom' | 'zoomControl' | 'doubleClickZoom' | 'touchZoom'>;

const NexusMap: React.FC<NexusMapProps> = ({
  center = [12.137752, 15.054325],
  zoom = 3,
  minZoom = 1,
  maxZoom = 18,
  height = '100%',
  className = '',
  mapClassName = 'h-full w-full',
  showDisclaimer = true,
  disclaimerClassName = 'px-2 py-1 bg-gray-50 border-t border-gray-200',
  disclaimerTextClassName = 'text-[9px] text-gray-500 italic leading-tight',
  scrollWheelZoom = true,
  zoomControl = true,
  doubleClickZoom = true,
  touchZoom = true,
  children,
}) => (
  <div className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white ${className}`}>
    <div className="flex-1 min-h-0" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        scrollWheelZoom={scrollWheelZoom}
        zoomControl={zoomControl}
        doubleClickZoom={doubleClickZoom}
        touchZoom={touchZoom}
        className={mapClassName}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url={UN_MAP_TILE_URL}
          attribution={UN_MAP_ATTRIBUTION}
          maxNativeZoom={UN_MAP_MAX_NATIVE_ZOOM}
          maxZoom={maxZoom}
        />
        {children}
      </MapContainer>
    </div>
    {showDisclaimer && (
      <div className={disclaimerClassName}>
        <p className={disclaimerTextClassName}>{MAP_DISCLAIMER}</p>
      </div>
    )}
  </div>
);

export default NexusMap;
