import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface Inspector {
  id: number;
  name: string;
  country: string;
}

const ThraceDataEntry: React.FC = () => {
  const { user } = useAuthStore();
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [selectedInspector, setSelectedInspector] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInspectors = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/thrace/inspectors', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch inspectors');
        }

        const data = await response.json();
        setInspectors(data.inspectors || []);
      } catch (err: any) {
        console.error('Error fetching inspectors:', err);
        setError(err.message || 'Failed to load inspectors');
      } finally {
        setLoading(false);
      }
    };

    fetchInspectors();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-center items-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Data Entry Form</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form className="space-y-4">
        {/* Inspector Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Inspector <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedInspector}
            onChange={(e) => setSelectedInspector(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          >
            <option value="">Select an inspector</option>
            {inspectors.map((inspector) => (
              <option key={inspector.id} value={inspector.id}>
                {inspector.name}
              </option>
            ))}
          </select>
          {inspectors.length === 0 && !loading && (
            <p className="text-sm text-gray-500 mt-1">
              No inspectors found for {user?.country}
            </p>
          )}
        </div>

        {/* Placeholder for future fields */}
        {selectedInspector && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded p-4">
            Inspector selected. Additional fields will be added here.
          </div>
        )}
      </form>
    </div>
  );
};

export default ThraceDataEntry;
