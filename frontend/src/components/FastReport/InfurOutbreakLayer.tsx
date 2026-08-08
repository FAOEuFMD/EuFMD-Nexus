import React from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import type { InfurOutbreakPoint } from '../../utils/fastReport/currentSituation';

const MARKER_RADIUS = 5;

function formatNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return String(n);
}

function formatReportType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (code === 'FUR') return 'FUR (Follow up report)';
  if (code === 'IN') return 'IN (Immediate notification)';
  return raw;
}

interface InfurOutbreakLayerProps {
  points: InfurOutbreakPoint[];
  getDiseaseColor: (disease: string) => string;
}

const InfurOutbreakLayer: React.FC<InfurOutbreakLayerProps> = ({ points, getDiseaseColor }) => {
  return (
    <>
      {points.map((p) => {
        const color = getDiseaseColor(p.disease);
        const key = `${p.outbreakId ?? 'x'}-${p.speciesName ?? ''}-${p.latitude}-${p.longitude}-${p.cases ?? 0}`;
        const reportLabel = formatReportType(p.reportType);
        return (
          <CircleMarker
            key={key}
            center={[p.latitude, p.longitude]}
            radius={MARKER_RADIUS}
            pathOptions={{
              color: '#ffffff',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.85,
            }}
          >
            <Popup maxWidth={300}>
              <div className="text-xs space-y-1 min-w-[200px]">
                <div className="font-bold text-sm" style={{ color }}>
                  {p.disease}
                  {p.diseaseLabel ? (
                    <span className="font-normal text-gray-500"> · {p.diseaseLabel}</span>
                  ) : null}
                </div>
                <div className="font-semibold text-gray-800">
                  {p.country}
                  {p.location ? ` · ${p.location}` : ''}
                </div>
                {p.adminDivision && p.adminDivision !== p.location ? (
                  <div className="text-gray-600">{p.adminDivision}</div>
                ) : null}
                <div className="text-gray-600">
                  Status: <strong>{p.eventStatus || '—'}</strong>
                  {reportLabel ? ` · ${reportLabel}` : ''}
                </div>
                {p.outbreakStartDate ? (
                  <div className="text-gray-600">
                    Outbreak start: <strong>{p.outbreakStartDate}</strong>
                    {p.outbreakEndDate ? ` → ${p.outbreakEndDate}` : ''}
                  </div>
                ) : null}
                {p.speciesName ? (
                  <div className="text-gray-600">
                    Species: <strong>{p.speciesName}</strong>
                    {p.epiUnitType ? ` · ${p.epiUnitType}` : ''}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t border-gray-200 mt-1">
                  <div>
                    Susceptible: <strong>{formatNum(p.susceptible)}</strong>
                  </div>
                  <div>
                    Cases: <strong>{formatNum(p.cases)}</strong>
                  </div>
                  <div>
                    Deaths: <strong>{formatNum(p.deaths)}</strong>
                  </div>
                  <div>
                    Killed: <strong>{formatNum(p.killed)}</strong>
                  </div>
                  <div>
                    Slaughtered: <strong>{formatNum(p.slaughtered)}</strong>
                  </div>
                  <div>
                    Vaccinated: <strong>{formatNum(p.vaccinated)}</strong>
                  </div>
                </div>
                {p.reason ? <div className="text-gray-500 pt-1">{p.reason}</div> : null}
                {(p.outbreakReference || p.nationalReference) && (
                  <div className="text-gray-400 pt-0.5">
                    {[p.outbreakReference, p.nationalReference].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="text-[10px] text-gray-400 uppercase tracking-wide pt-0.5">
                  WAHIS-INFUR
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default InfurOutbreakLayer;
