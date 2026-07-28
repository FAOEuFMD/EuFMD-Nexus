import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { apiService } from '../../services/api';
import {
  buildOutbreakTraces,
  buildVaccinationTraces,
  FastReportAnalyticsRow,
} from '../../utils/fastReport/countryAnalytics';

interface CountryAnalyticsPanelProps {
  country: string;
  displayName: string;
  hasFastReportMatch: boolean;
  getDiseaseColor: (disease: string) => string;
}

const PLOT_LAYOUT = {
  margin: { t: 24, b: 48, l: 48, r: 16 },
  hovermode: 'closest' as const,
  showlegend: true,
  legend: { orientation: 'h' as const, y: -0.25 },
  xaxis: { title: 'Period' },
};

const PLOT_CONFIG = { responsive: true, displayModeBar: false };

const CountryAnalyticsPanel: React.FC<CountryAnalyticsPanelProps> = ({
  country,
  displayName,
  hasFastReportMatch,
  getDiseaseColor,
}) => {
  const outbreakChartRef = useRef<HTMLDivElement>(null);
  const vaccinationChartRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FastReportAnalyticsRow[]>([]);
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setRows([]);

      if (!hasFastReportMatch) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiService.fastReport.getByCountry(
          encodeURIComponent(country)
        );
        if (cancelled) return;
        const data = Array.isArray(response.data) ? response.data : [];
        setRows(data);
        const latest = data[0] as FastReportAnalyticsRow | undefined;
        setRegion(latest?.Region ?? null);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load country data';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [country, hasFastReportMatch]);

  const diseaseColorMap = React.useMemo(() => {
    const diseases = Array.from(
      new Set(rows.map((r) => r.Disease).filter(Boolean) as string[])
    );
    return Object.fromEntries(
      diseases.map((d) => [d, getDiseaseColor(d)])
    );
  }, [rows, getDiseaseColor]);

  useEffect(() => {
    if (!outbreakChartRef.current || loading) return;

    const { traces, hasData } = buildOutbreakTraces(rows, diseaseColorMap);

    if (!hasData || traces.length === 0) {
      Plotly.purge(outbreakChartRef.current);
      return;
    }

    Plotly.newPlot(
      outbreakChartRef.current,
      traces,
      {
        ...PLOT_LAYOUT,
        yaxis: { title: 'Outbreaks' },
        title: { text: 'Outbreaks over time', font: { size: 14 } },
      },
      PLOT_CONFIG
    );

    return () => {
      if (outbreakChartRef.current) Plotly.purge(outbreakChartRef.current);
    };
  }, [rows, loading, diseaseColorMap]);

  useEffect(() => {
    if (!vaccinationChartRef.current || loading) return;

    const { traces, hasData } = buildVaccinationTraces(rows, diseaseColorMap);

    if (!hasData || traces.length === 0) {
      Plotly.purge(vaccinationChartRef.current);
      return;
    }

    Plotly.newPlot(
      vaccinationChartRef.current,
      traces,
      {
        ...PLOT_LAYOUT,
        barmode: 'group',
        yaxis: { title: 'Doses' },
        title: { text: 'Vaccination doses over time', font: { size: 14 } },
      },
      PLOT_CONFIG
    );

    return () => {
      if (vaccinationChartRef.current) Plotly.purge(vaccinationChartRef.current);
    };
  }, [rows, loading, diseaseColorMap]);

  const outbreakStats = buildOutbreakTraces(rows, diseaseColorMap);
  const vaccinationStats = buildVaccinationTraces(rows, diseaseColorMap);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-600">Loading country history…</div>
    );
  }

  if (!hasFastReportMatch) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{displayName}</span> is not matched to Fast
          Report records. No historical charts are available.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">{error}</div>
    );
  }

  return (
    <div className="p-4 space-y-4 w-full min-w-[280px] max-w-md">
      <div>
        <h4 className="text-lg font-bold text-gray-800">{displayName}</h4>
        {region && <p className="text-sm text-gray-600">Region: {region}</p>}
        <p className="text-xs text-gray-500 mt-1">
          {rows.length} historical record{rows.length !== 1 ? 's' : ''} (full history)
        </p>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-gray-800 mb-2">Outbreaks</h5>
        {!outbreakStats.hasData ? (
          <p className="text-sm text-gray-500">No outbreak records for this country.</p>
        ) : (
          <div ref={outbreakChartRef} className="w-full" style={{ minHeight: 220 }} />
        )}
      </div>

      <div>
        <h5 className="text-sm font-semibold text-gray-800 mb-2">Vaccination</h5>
        {!vaccinationStats.hasData ? (
          <p className="text-sm text-gray-500">No vaccination doses recorded.</p>
        ) : (
          <div ref={vaccinationChartRef} className="w-full" style={{ minHeight: 220 }} />
        )}
      </div>
    </div>
  );
};

export default CountryAnalyticsPanel;
