import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

interface FitMapBoundsProps {
  positions: [number, number][];
  padding?: number;
  defaultZoom?: number;
}

const FitMapBounds: React.FC<FitMapBoundsProps> = ({
  positions,
  padding = 0.1,
  defaultZoom = 4,
}) => {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;

    if (positions.length === 1) {
      map.setView(positions[0], defaultZoom);
      return;
    }

    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds.pad(padding));
  }, [map, positions, padding, defaultZoom]);

  return null;
};

export default FitMapBounds;
