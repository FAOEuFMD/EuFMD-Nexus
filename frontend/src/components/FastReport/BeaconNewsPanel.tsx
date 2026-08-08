import React from 'react';

export interface BeaconNewsItem {
  id: string;
  diseaseCode?: string;
  publishedAt?: string | null;
  eventDate?: string | null;
  title?: string | null;
  summary?: string | null;
  locations?: string[];
  diseases?: string[];
  reliabilityScore?: number | null;
  url?: string | null;
  source?: string;
}

interface BeaconNewsPanelProps {
  items: BeaconNewsItem[];
  loading: boolean;
  error: string | null;
  regionLabel: string;
  diseaseLabels: string[];
  getDiseaseColor: (disease: string) => string;
}

function formatDate(raw?: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const BeaconNewsPanel: React.FC<BeaconNewsPanelProps> = ({
  items,
  loading,
  error,
  regionLabel,
  diseaseLabels,
  getDiseaseColor,
}) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-800">BEACON disease news</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Curated briefs for {regionLabel}
            {diseaseLabels.length ? ` · ${diseaseLabels.join(', ')}` : ''} — click a card to open
            the full report on beaconbio.org
          </p>
        </div>
        <span className="text-xs text-gray-400">Not official WAHIS data</span>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {loading && (
          <div className="px-4 py-6 text-sm text-gray-500">Loading BEACON news…</div>
        )}
        {!loading && error && (
          <div className="px-4 py-6 text-sm text-amber-800 bg-amber-50">{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">
            No BEACON reports for the current region and disease filters.
          </div>
        )}
        {!loading &&
          !error &&
          items.map((item) => {
            const code = item.diseaseCode || '';
            const color = code ? getDiseaseColor(code) : '#64748b';
            const href = item.url || undefined;
            const Wrapper: React.ElementType = href ? 'a' : 'div';
            const wrapperProps = href
              ? {
                  href,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }
              : {};

            return (
              <Wrapper
                key={item.id}
                {...wrapperProps}
                className="block px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2">
                  {code ? (
                    <span
                      className="mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {code}
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 leading-snug">
                      {item.title || 'Untitled report'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                      {item.publishedAt || item.eventDate ? (
                        <span>{formatDate(item.publishedAt || item.eventDate)}</span>
                      ) : null}
                      {item.locations && item.locations.length > 0 ? (
                        <span>{item.locations.join(', ')}</span>
                      ) : null}
                    </div>
                    {item.summary ? (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
                    ) : null}
                  </div>
                </div>
              </Wrapper>
            );
          })}
      </div>
    </div>
  );
};

export default BeaconNewsPanel;
