import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface MapZoomTrackerProps {
  onZoomChange: (zoom: number) => void;
}

const MapZoomTracker: React.FC<MapZoomTrackerProps> = ({ onZoomChange }) => {
  const map = useMap();

  useEffect(() => {
    const update = () => onZoomChange(map.getZoom());
    map.on('zoomend', update);
    update();
    return () => {
      map.off('zoomend', update);
    };
  }, [map, onZoomChange]);

  return null;
};

export default MapZoomTracker;
