import React, { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import NexusMap from './maps/NexusMap';
import FitMapBounds from './maps/FitMapBounds';

interface Country {
  id: number;
  name_un: string;
  lat: number;
  lon: number;
}

interface Procurement {
  id: number;
  country_id: number;
  product: string;
  quantity: number;
}

interface DiagnosticSupportMapProps {
  procurements: Procurement[];
  countries: Country[];
}

const procurementMarkerIcon = L.divIcon({
  html: '<div style="background-color:#3B82F6;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: '',
});

const DiagnosticSupportMap: React.FC<DiagnosticSupportMapProps> = ({
  procurements,
  countries,
}) => {
  const countriesWithProcurements = useMemo(() => {
    const countryIds = new Set(procurements.map((proc) => proc.country_id));
    return countries.filter(
      (country) =>
        countryIds.has(country.id) &&
        Number.isFinite(country.lat) &&
        Number.isFinite(country.lon),
    );
  }, [procurements, countries]);

  const markerPositions = useMemo(
    () => countriesWithProcurements.map((country) => [country.lat, country.lon] as [number, number]),
    [countriesWithProcurements],
  );

  if (countriesWithProcurements.length === 0) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 text-center text-sm text-gray-500">
        No countries with procurements to display on the map.
      </div>
    );
  }

  return (
    <NexusMap
      height="100%"
      className="h-full border-0 shadow-none"
      disclaimerClassName="px-1.5 py-0.5 bg-gray-50 border-t border-gray-200"
      disclaimerTextClassName="text-[8px] text-gray-500 italic leading-[1.2]"
    >
      <FitMapBounds positions={markerPositions} />
      {countriesWithProcurements.map((country) => {
        const countryProcurements = procurements.filter((proc) => proc.country_id === country.id);
        const totalQuantity = countryProcurements.reduce((sum, proc) => sum + proc.quantity, 0);
        const uniqueProducts = Array.from(new Set(countryProcurements.map((proc) => proc.product)));

        return (
          <Marker
            key={country.id}
            position={[country.lat, country.lon]}
            icon={procurementMarkerIcon}
          >
            <Popup>
              <div className="min-w-[180px] text-sm">
                <h3 className="mb-2 font-bold text-gray-800">{country.name_un}</h3>
                <p>
                  <strong>Total quantity:</strong> {totalQuantity}
                </p>
                <p>
                  <strong>Products:</strong> {uniqueProducts.length}
                </p>
                <ul className="mt-2 list-disc pl-4">
                  {uniqueProducts.map((product) => {
                    const productQuantity = countryProcurements
                      .filter((proc) => proc.product === product)
                      .reduce((sum, proc) => sum + proc.quantity, 0);
                    return (
                      <li key={product}>
                        {product}: {productQuantity}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </NexusMap>
  );
};

export default DiagnosticSupportMap;
