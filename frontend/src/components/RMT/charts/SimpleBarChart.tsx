import React, { useMemo, useState } from 'react';

interface SimpleBarChartProps {
  pathwayScores: Array<{
    name_un: string;
    scores: {
      airborne: number;
      vectorborne: number;
      wildAnimals: number;
      animalProduct: number;
      liveAnimal: number;
      fomite: number;
    };
    diseaseScores?: {
      [key: string]: {
        airborne: number;
        vectorborne: number;
        wildAnimals: number;
        animalProduct: number;
        liveAnimal: number;
        fomite: number;
      };
    };
  }>;
}

const DISEASES = ['FMD', 'PPR', 'LSD', 'RVF', 'SPGP'] as const;

const pathwayConfig = {
  airborne: { color: '#8DD3C7', label: 'Airborne' },
  vectorborne: { color: '#FFFFB3', label: 'Vector-borne' },
  wildAnimals: { color: '#BEBADA', label: 'Wild Animals' },
  animalProduct: { color: '#FB8072', label: 'Animal Product' },
  liveAnimal: { color: '#80B1D3', label: 'Live Animal' },
  fomite: { color: '#FDB462', label: 'Fomite' },
} as const;

const pathwayKeys = Object.keys(pathwayConfig) as Array<keyof typeof pathwayConfig>;

const PLOT_HEIGHT = 220;
const BAR_WIDTH = 42;
const BAR_GAP = 28;
const MARGIN = { top: 20, right: 130, bottom: 72, left: 52 };

const formatScore = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const niceAxisMax = (maxValue: number): number => {
  if (maxValue <= 0) return 5;
  const padded = maxValue * 1.05;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const niceUnit = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceUnit * magnitude;
};

const buildTicks = (axisMax: number, tickCount = 5): number[] => {
  const step = axisMax / tickCount;
  const ticks: number[] = [];
  for (let value = 0; value <= axisMax + 0.0001; value += step) {
    ticks.push(Math.round(value * 10) / 10);
  }
  return ticks;
};

const wrapLabel = (text: string, maxCharsPerLine = 12): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    current = word.length > maxCharsPerLine ? `${word.slice(0, maxCharsPerLine - 1)}…` : word;
  });

  if (current) lines.push(current);
  return lines.length > 0 ? lines.slice(0, 3) : [text];
};

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ pathwayScores }) => {
  const [selectedDisease, setSelectedDisease] = useState<string>('FMD');

  const chartData = useMemo(() => {
    return pathwayScores.map((country) => {
      const scores = country.diseaseScores?.[selectedDisease] || country.scores;
      const pathways = pathwayKeys.map((pathway) => ({
        pathway,
        value: scores[pathway] || 0,
        color: pathwayConfig[pathway].color,
        label: pathwayConfig[pathway].label,
      }));
      const total = pathways.reduce((sum, item) => sum + item.value, 0);
      return { country: country.name_un, pathways, total };
    });
  }, [pathwayScores, selectedDisease]);

  const axisMax = useMemo(() => {
    const maxTotal = Math.max(...chartData.map((item) => item.total), 0);
    return niceAxisMax(maxTotal);
  }, [chartData]);

  const yTicks = useMemo(() => buildTicks(axisMax), [axisMax]);

  const plotWidth = Math.max(
    chartData.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP,
    240,
  );
  const svgWidth = plotWidth + MARGIN.left + MARGIN.right;
  const svgHeight = PLOT_HEIGHT + MARGIN.top + MARGIN.bottom;

  const valueToY = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (value / axisMax) * PLOT_HEIGHT;

  const segmentHeight = (value: number) => (value / axisMax) * PLOT_HEIGHT;

  if (!pathwayScores || pathwayScores.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No pathway scores data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rmt-step mb-6">
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <h3 className="text-lg font-semibold">Risk Pathway Scores</h3>
        <div className="flex flex-wrap gap-2">
          {DISEASES.map((disease) => (
            <button
              key={disease}
              type="button"
              onClick={() => setSelectedDisease(disease)}
              className={`px-3 py-1 rounded text-sm ${
                selectedDisease === disease
                  ? 'bg-[#15736d] text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {disease}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label={`Risk pathway scores for ${selectedDisease}`}
        >
          {/* Y-axis line */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top}
            x2={MARGIN.left}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="#9CA3AF"
            strokeWidth={1}
          />
          {/* X-axis line */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top + PLOT_HEIGHT}
            x2={MARGIN.left + plotWidth}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="#9CA3AF"
            strokeWidth={1}
          />

          {/* Grid lines and Y-axis labels share the same scale */}
          {yTicks.map((tick) => {
            const y = valueToY(tick);
            return (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  y1={y}
                  x2={MARGIN.left + plotWidth}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs font-bold fill-gray-700"
                >
                  {formatScore(tick)}
                </text>
              </g>
            );
          })}

          {chartData.map((countryData, countryIndex) => {
            const barX =
              MARGIN.left + BAR_GAP + countryIndex * (BAR_WIDTH + BAR_GAP);
            let cumulative = 0;

            return (
              <g key={countryData.country}>
                {countryData.pathways.map((pathway) => {
                  if (pathway.value <= 0) return null;

                  const height = segmentHeight(pathway.value);
                  const y = valueToY(cumulative + pathway.value);
                  cumulative += pathway.value;

                  const showLabel = height >= 16;

                  return (
                    <g key={pathway.pathway}>
                      <rect
                        x={barX}
                        y={y}
                        width={BAR_WIDTH}
                        height={height}
                        fill={pathway.color}
                        stroke="#9CA3AF"
                        strokeWidth={0.5}
                      >
                        <title>{`${pathway.label}: ${formatScore(pathway.value)}`}</title>
                      </rect>
                      {showLabel && (
                        <text
                          x={barX + BAR_WIDTH / 2}
                          y={y + height / 2 + 4}
                          textAnchor="middle"
                          className="text-[10px] font-bold fill-gray-900"
                        >
                          {formatScore(pathway.value)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {countryData.total > 0 && (
                  <text
                    x={barX + BAR_WIDTH / 2}
                    y={valueToY(countryData.total) - 6}
                    textAnchor="middle"
                    className="text-[10px] font-semibold fill-gray-700"
                  >
                    {formatScore(countryData.total)}
                  </text>
                )}

                {wrapLabel(countryData.country).map((line, lineIndex) => (
                  <text
                    key={`${countryData.country}-${lineIndex}`}
                    x={barX + BAR_WIDTH / 2}
                    y={MARGIN.top + PLOT_HEIGHT + 18 + lineIndex * 12}
                    textAnchor="middle"
                    className="text-[10px] font-bold fill-gray-700"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          <text
            x={MARGIN.left + plotWidth / 2}
            y={svgHeight - 10}
            textAnchor="middle"
            className="text-sm font-bold fill-gray-700"
          >
            Country
          </text>

          {/* Legend */}
          {pathwayKeys.map((pathway, index) => (
            <g
              key={pathway}
              transform={`translate(${MARGIN.left + plotWidth + 12}, ${MARGIN.top + index * 24})`}
            >
              <rect
                x={0}
                y={0}
                width={14}
                height={14}
                fill={pathwayConfig[pathway].color}
                stroke="#9CA3AF"
                strokeWidth={0.5}
              />
              <text x={20} y={11} className="text-[11px] fill-gray-700">
                {pathwayConfig[pathway].label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Stacked segments show each pathway&apos;s contribution to the total risk score for {selectedDisease}.
        Segment heights use the same scale as the Y-axis, so they add up to the total shown above each bar.
      </p>
    </div>
  );
};

export default SimpleBarChart;
