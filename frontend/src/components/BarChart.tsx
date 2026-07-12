import React, { useEffect, useRef, useId, useMemo } from 'react';
import * as d3 from 'd3';

interface UniqueProduct {
  product: string;
  totalQuantity: number;
  letter: string;
  color: string;
}

interface BarChartProps {
  uniqueProductsArray: UniqueProduct[];
  compact?: boolean;
}

const COMPACT_VIEW_WIDTH = 360;
const COMPACT_PLOT_HEIGHT = 108;
const DEFAULT_PLOT_HEIGHT = 216;

function buildDataKey(items: UniqueProduct[]): string {
  return items.map((d) => `${d.letter}:${d.product}:${d.totalQuantity}:${d.color}`).join('|');
}

const BarChart: React.FC<BarChartProps> = ({ uniqueProductsArray, compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const tooltipId = useId().replace(/:/g, '');
  const dataKey = useMemo(() => buildDataKey(uniqueProductsArray), [uniqueProductsArray]);

  useEffect(() => {
    if (!chartRef.current || uniqueProductsArray.length === 0) return;

    const margin = compact
      ? { top: 8, right: 8, bottom: 28, left: 32 }
      : { top: 20, right: 16, bottom: 48, left: 44 };

    const plotHeight = compact ? COMPACT_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT;

    const renderChart = (plotWidth: number) => {
      if (!chartRef.current) return;

      const width = Math.max(120, plotWidth);
      const height = plotHeight;
      const svgWidth = width + margin.left + margin.right;
      const svgHeight = height + margin.top + margin.bottom;

      const svg = d3.select(chartRef.current);
      svg.selectAll('*').remove();

      if (compact) {
        svg
          .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
          .attr('width', '100%')
          .attr('height', svgHeight)
          .attr('preserveAspectRatio', 'xMidYMid meet');
      } else {
        svg.attr('width', svgWidth).attr('height', svgHeight);
      }

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const xScale = d3.scaleBand()
        .domain(uniqueProductsArray.map((d) => d.letter))
        .range([0, width])
        .padding(0.15);

      const yMax = d3.max(uniqueProductsArray, (d) => d.totalQuantity) || 0;
      const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .nice()
        .range([height, 0]);

      const tooltipClass = `chart-tooltip-${tooltipId}`;
      const getTooltip = (): d3.Selection<HTMLDivElement, unknown, HTMLElement, any> => {
        const existing = d3.select<HTMLDivElement, unknown>(`.${tooltipClass}`);
        if (!existing.empty()) return existing;
        return d3.select('body').append('div')
          .attr('class', tooltipClass)
          .style('opacity', 0)
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.85)')
          .style('color', 'white')
          .style('padding', '8px 10px')
          .style('border-radius', '6px')
          .style('font-size', '12px')
          .style('line-height', '1.4')
          .style('max-width', '280px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');
      };
      const tooltip = getTooltip();

      const showTooltip = (event: MouseEvent, d: UniqueProduct) => {
        tooltip.transition().duration(150).style('opacity', 0.95);
        tooltip
          .html(`<strong>${d.product}</strong><br/>Quantity: ${d.totalQuantity}`)
          .style('left', `${event.pageX + 12}px`)
          .style('top', `${event.pageY - 32}px`);
      };

      const hideTooltip = () => {
        tooltip.transition().duration(200).style('opacity', 0);
      };

      g.selectAll('.bar')
        .data(uniqueProductsArray)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => xScale(d.letter) || 0)
        .attr('width', xScale.bandwidth())
        .attr('y', (d) => yScale(d.totalQuantity))
        .attr('height', (d) => height - yScale(d.totalQuantity))
        .attr('fill', (d) => d.color)
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this).style('opacity', 0.75);
          showTooltip(event, d);
        })
        .on('mouseout', function () {
          d3.select(this).style('opacity', 1);
          hideTooltip();
        });

      const xAxis = g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

      xAxis.selectAll('text')
        .style('font-size', compact ? '10px' : '13px')
        .style('font-weight', 'bold')
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          const letter = d3.select(this).text();
          const item = uniqueProductsArray.find((p) => p.letter === letter);
          if (item) {
            d3.select(this).style('text-decoration', 'underline');
            showTooltip(event as unknown as MouseEvent, item);
          }
        })
        .on('mouseout', function () {
          d3.select(this).style('text-decoration', 'none');
          hideTooltip();
        });

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(compact ? 4 : 5))
        .selectAll('text')
        .style('font-size', compact ? '10px' : '12px');

      if (!compact) {
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', 0 - margin.left + 14)
          .attr('x', 0 - height / 2)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .text('Quantity');

        g.append('text')
          .attr('x', width / 2)
          .attr('y', height + margin.bottom - 8)
          .style('text-anchor', 'middle')
          .style('font-size', '11px')
          .style('fill', '#6b7280')
          .text('Hover a bar or letter for product name');
      }
    };

    if (compact) {
      renderChart(COMPACT_VIEW_WIDTH - margin.left - margin.right);
      return () => {
        d3.select(`.chart-tooltip-${tooltipId}`).remove();
      };
    }

    if (!containerRef.current) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const draw = () => {
      if (!containerRef.current) return;
      const plotWidth = containerRef.current.clientWidth - margin.left - margin.right;
      renderChart(plotWidth);
    };

    draw();

    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 150);
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      d3.select(`.chart-tooltip-${tooltipId}`).remove();
    };
  }, [dataKey, tooltipId, compact]);

  if (uniqueProductsArray.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-500 ${compact ? 'h-32 text-sm' : 'h-64'}`}>
        No data to display
      </div>
    );
  }

  const compactSvgHeight = COMPACT_PLOT_HEIGHT + 8 + 28 + 32;

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={compact ? { height: compactSvgHeight } : undefined}
    >
      <svg
        ref={chartRef}
        className="block w-full max-w-full"
        style={compact ? { height: compactSvgHeight, maxHeight: compactSvgHeight } : undefined}
      />
    </div>
  );
};

export default React.memo(BarChart);
