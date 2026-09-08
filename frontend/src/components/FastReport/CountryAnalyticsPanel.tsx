import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { apiService } from '../../services/api';
import {
  buildOutbreakTraces,
  buildVaccinationTraces,
  FastReportAnalyticsRow,
} from '../../utils/fastReport/countryAnalytics';
import { excludeBefDisease } from '../../utils/fastReport/currentSituation';
import type { BeaconNewsItem } from './BeaconNewsPanel';

interface CountryAnalyticsPanelProps {
  country: string;
  displayName: string;
  hasFastReportMatch: boolean;
  getDiseaseColor: (disease: string) => string;
  beaconNews?: BeaconNewsItem[];
  showBeaconNews?: boolean;
}

const PLOT_LAYOUT = {
  // Top room for title + legend; bottom room for rotated period ticks
  margin: { t: 72, b: 72, l: 52, r: 12 },
  hovermode: 'closest' as const,
  showlegend: true,
  legend: {
    orientation: 'h' as const,
    yanchor: 'bottom' as const,
    y: 1.08,
    xanchor: 'left' as const,
    x: 0,
    font: { size: 11 },
  },
  xaxis: {
    tickangle: -45,
    automargin: true,
    tickfont: { size: 10 },
  },
  font: { size: 11 },
};

const PLOT_CONFIG = { responsive: true, displayModeBar: false };

function formatNewsDate(raw?: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const CountryAnalyticsPanel: React.FC<CountryAnalyticsPanelProps> = ({
  country,
  displayName,
  hasFastReportMatch,
  getDiseaseColor,
  beaconNews = [],
  showBeaconNews = true,
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
        const response = await apiService.fastReport.getByCountry(country);
        if (cancelled) return;
        const data = Array.isArray(response.data) ? response.data : [];
        const cleaned = excludeBefDisease(data as FastReportAnalyticsRow[]);
        setRows(cleaned);
        const latest = cleaned[0] as FastReportAnalyticsRow | undefined;
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

    const outbreakEl = outbreakChartRef.current;
    Plotly.newPlot(
      outbreakEl,
      traces,
      {
        ...PLOT_LAYOUT,
        yaxis: {
          title: { text: 'Outbreaks', standoff: 8, font: { size: 11 } },
          automargin: true,
          tickfont: { size: 10 },
        },
        title: { text: 'Outbreaks over time', font: { size: 13 } },
      },
      PLOT_CONFIG
    );

    return () => {
      if (outbreakEl) Plotly.purge(outbreakEl);
    };
  }, [rows, loading, diseaseColorMap]);

  useEffect(() => {
    if (!vaccinationChartRef.current || loading) return;

    const { traces, hasData } = buildVaccinationTraces(rows, diseaseColorMap);
    const vaccinationEl = vaccinationChartRef.current;

    if (!hasData || traces.length === 0) {
      Plotly.purge(vaccinationEl);
      return;
    }

    Plotly.newPlot(
      vaccinationEl,
      traces,
      {
        ...PLOT_LAYOUT,
        barmode: 'group',
        yaxis: {
          title: { text: 'Doses', standoff: 8, font: { size: 11 } },
          automargin: true,
          tickfont: { size: 10 },
        },
        title: { text: 'Vaccination doses over time', font: { size: 13 } },
      },
      PLOT_CONFIG
    );

    return () => {
      if (vaccinationEl) Plotly.purge(vaccinationEl);
    };
  }, [rows, loading, diseaseColorMap]);

  const outbreakStats = buildOutbreakTraces(rows, diseaseColorMap);
  const vaccinationStats = buildVaccinationTraces(rows, diseaseColorMap);

  const newsSection = showBeaconNews ? (
    <div>
      <h5 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#15736d] text-white"
          aria-hidden
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
          </svg>
        </span>
        BEACON news
      </h5>
      {beaconNews.length === 0 ? (
        <p className="text-sm text-gray-500">No BEACON reports for this country in the current filters.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {beaconNews.map((item) => {
            const href = item.url || undefined;
            const Wrapper: React.ElementType = href ? 'a' : 'div';
            const wrapperProps = href
              ? { href, target: '_blank', rel: 'noopener noreferrer' }
              : {};
            return (
              <Wrapper
                key={item.id}
                {...wrapperProps}
                className="block rounded border border-gray-200 bg-gray-50 px-2.5 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {item.diseaseCode ? (
                    <span
                      className="mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded text-white shrink-0"
                      style={{ backgroundColor: getDiseaseColor(item.diseaseCode) }}
                    >
                      {item.diseaseCode}
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900 leading-snug">
                      {item.title || 'Untitled report'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {formatNewsDate(item.publishedAt || item.eventDate)}
                    </div>
                    {item.summary ? (
                      <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
                    ) : null}
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  ) : null;

  if (loading && hasFastReportMatch) {
    return (
      <div className="p-4 text-sm text-gray-600">Loading country history…</div>
    );
  }

  if (!hasFastReportMatch) {
    return (
      <div className="p-4 space-y-4 w-full min-w-[280px] max-w-md">
        <div>
          <h4 className="text-lg font-bold text-gray-800">{displayName}</h4>
          <p className="text-sm text-gray-600 mt-1">
            No Fast Report historical charts for this country.
          </p>
        </div>
        {newsSection}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-sm text-red-600">{error}</div>
        {newsSection}
      </div>
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
          <div ref={outbreakChartRef} className="w-full" style={{ minHeight: 300 }} />
        )}
      </div>

      <div>
        <h5 className="text-sm font-semibold text-gray-800 mb-2">Vaccination</h5>
        {!vaccinationStats.hasData ? (
          <p className="text-sm text-gray-500">No vaccination doses recorded.</p>
        ) : (
          <div ref={vaccinationChartRef} className="w-full" style={{ minHeight: 300 }} />
        )}
      </div>

      {newsSection}
    </div>
  );
};

export default CountryAnalyticsPanel;
