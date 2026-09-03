import { useEffect, useState } from 'react';
import { apiService } from '../services/api';

export interface SoiDistrict {
  district_id: number;
  district_name: string;
  province_id: number;
  province_name: string;
}

export function useSoiDistricts(enabled: boolean) {
  const [districts, setDistricts] = useState<SoiDistrict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDistricts([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiService.risp
      .getSoiDistricts()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? res ?? [];
        setDistricts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setDistricts([]);
        setError(err?.response?.data?.detail || err?.message || 'Failed to load districts');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { districts, loading, error };
}
