import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
let DefaultIcon = L.divIcon({
  html: `<div style="background-color: #3B82F6; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Country {
  id: number;
  name_un: string;
  lat: number;
  lon: number;
}

interface Procurement {
  id: number;
  stock_id: number;
  product: string;
  serotype: string;
  quantity: number;
  delivery_date: string;
  country_id: number;
  name_un: string;
  'LOA/DP': string;
  supplier: string;
  description: string;
  PO: string;
  expiry_date: string;
  report_usage: string;
  notes: string;
}

interface MapModalProps {
  isVisible: boolean;
  procurements: Procurement[];
  matchedCountries: Country[];
  onClose: () => void;
}

const MapModal: React.FC<MapModalProps> = ({ 
  isVisible, 
  procurements, 
  matchedCountries, 
  onClose 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (isVisible && mapContainer.current && matchedCountries.length > 0) {
      // Initialize map
      const ChadCoords: [number, number] = [12.137752, 15.054325];
      
      if (!mapRef.current) {
        mapRef.current = L.map(mapContainer.current).setView(ChadCoords, 3);

        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
          }
        ).addTo(mapRef.current);
      }

      // Clear existing markers
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          mapRef.current?.removeLayer(layer);
        }
      });

      // Add markers for countries with procurements
      matchedCountries.forEach((country) => {
        const countryProcurements = procurements.filter(
          (proc) => proc.country_id === country.id
        );

        if (countryProcurements.length > 0 && mapRef.current) {
          const marker = L.marker([country.lat, country.lon])
            .addTo(mapRef.current);

          // Create popup content
          const totalQuantity = countryProcurements.reduce(
            (sum, proc) => sum + proc.quantity, 
            0
          );

          const uniqueProducts = Array.from(new Set(countryProcurements.map(proc => proc.product)));

          const popupContent = `
            <div style="min-width: 200px;">
              <h3 style="font-weight: bold; margin-bottom: 10px; color: #1f2937;">${country.name_un}</h3>
              <p><strong>Total Quantity:</strong> ${totalQuantity}</p>
              <p><strong>Products:</strong> ${uniqueProducts.length}</p>
              <div style="margin-top: 8px;">
                <strong>Product Details:</strong>
                <ul style="margin: 4px 0; padding-left: 16px;">
                  ${uniqueProducts.map(product => {
                    const productQuantity = countryProcurements
                      .filter(proc => proc.product === product)
                      .reduce((sum, proc) => sum + proc.quantity, 0);
                    return `<li>${product}: ${productQuantity}</li>`;
                  }).join('')}
                </ul>
              </div>
            </div>
          `;

          marker.bindPopup(popupContent);
        }
      });

      // Fit map to show all markers
      if (matchedCountries.length > 0) {
        const group = L.featureGroup(
          matchedCountries.map(country => 
            L.marker([country.lat, country.lon])
          )
        );
        mapRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    }

    // Cleanup on unmount or when modal is closed
    return () => {
      if (!isVisible && mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isVisible, procurements, matchedCountries]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Diagnostic Support Map
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div 
            ref={mapContainer} 
            style={{ height: '400px', width: '800px' }}
            className="rounded-lg border border-gray-300"
          />
          {matchedCountries.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">No countries with procurements to display</p>
            </div>
          )}
        </div>
        <div className="p-4 flex justify-end border-t border-gray-200">
          <button 
            onClick={onClose} 
            className="nav-btn close-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapModal;
