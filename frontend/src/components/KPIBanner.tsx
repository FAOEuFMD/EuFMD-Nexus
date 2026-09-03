import React, { useState, useEffect } from 'react';

interface KPIData {
  daysSince: number | null;
  activeHotspots: number;
  campaigns: number;
  dominantSerotype: string | null;
}

interface KPIBannerProps {
  reloadKey?: string;
}

const KPIBanner: React.FC<KPIBannerProps> = ({ reloadKey }) => {
  const [kpi, setKpi] = useState<KPIData>({
    daysSince: null,
    activeHotspots: 0,
    campaigns: 0,
    dominantSerotype: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      setLoading(true);
      try {
        const [daysRes, hotspotsRes, campaignsRes, serotypeRes] = await Promise.all([
          fetch('/api/tcc/kpi/days-since-last-outbreak'),
          fetch('/api/tcc/kpi/active-hotspots'),
          fetch('/api/tcc/kpi/campaigns'),
          fetch('/api/tcc/kpi/dominant-serotype'),
        ]);

        const daysData = await daysRes.json();
        const hotspotsData = await hotspotsRes.json();
        const campaignsData = await campaignsRes.json();
        const serotypeData = await serotypeRes.json();

        setKpi({
          daysSince: daysData.days_since,
          activeHotspots: hotspotsData.hotspot_count || 0,
          campaigns: campaignsData.campaign_count || 0,
          dominantSerotype: serotypeData.serotype,
        });
      } catch (err) {
        console.error('Failed to fetch KPI data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, [reloadKey]);

  const getDaysColor = (days: number | null) => {
    if (days === null) return 'text-gray-500';
    if (days > 90) return 'text-green-600';
    if (days >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDaysBg = (days: number | null) => {
    if (days === null) return 'bg-gray-50 border-gray-200';
    if (days > 90) return 'bg-green-50 border-green-200';
    if (days >= 30) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getHotspotColor = (count: number) => {
    if (count > 0) return 'text-red-600';
    return 'text-green-600';
  };

  const getHotspotBg = (count: number) => {
    if (count > 0) return 'bg-red-50 border-red-200';
    return 'bg-green-50 border-green-200';
  };

  if (loading) {
    return (
      <div className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-200 px-4 py-3">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-200 px-4 py-3">
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1 - Days Since Last Outbreak */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${getDaysBg(kpi.daysSince)}`}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm">
            <svg className={`w-5 h-5 ${getDaysColor(kpi.daysSince)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className={`text-lg font-bold ${getDaysColor(kpi.daysSince)}`}>
              {kpi.daysSince !== null ? `${kpi.daysSince} Days` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Last confirmed outbreak</div>
          </div>
        </div>

        {/* Card 2 - Active Hotspots */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${getHotspotBg(kpi.activeHotspots)}`}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm">
            <svg className={`w-5 h-5 ${getHotspotColor(kpi.activeHotspots)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className={`text-lg font-bold ${getHotspotColor(kpi.activeHotspots)}`}>
              {kpi.activeHotspots}
            </div>
            <div className="text-xs text-gray-500">Districts/Epiunits with outbreak (30 days)</div>
          </div>
        </div>

        {/* Card 3 - Campaigns in Progress */}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 border-green-200">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{kpi.campaigns}</div>
            <div className="text-xs text-gray-500">Current campaigns</div>
          </div>
        </div>

        {/* Card 4 - Dominant Serotype */}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-indigo-50 border-indigo-200">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-bold text-indigo-600">
              {kpi.dominantSerotype || 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Most prevalent strain</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPIBanner;