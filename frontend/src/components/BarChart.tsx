import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface UniqueProduct {
  product: string;
  totalQuantity: number;
  letter: string;
  color: string;
}

interface BarChartProps {
  uniqueProductsArray: UniqueProduct[];
}

const BarChart: React.FC<BarChartProps> = ({ uniqueProductsArray }) => {
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!chartRef.current || uniqueProductsArray.length === 0) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 10, bottom: 40, left: 30 };
    const width = 350 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(uniqueProductsArray.map(d => d.letter))
      .range([0, width])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(uniqueProductsArray, d => d.totalQuantity) || 0])
      .range([height, 0]);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'chart-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Create bars
    g.selectAll('.bar')
      .data(uniqueProductsArray)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.letter) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', d => yScale(d.totalQuantity))
      .attr('height', d => height - yScale(d.totalQuantity))
      .attr('fill', d => d.color)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).style('opacity', 0.7);
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        tooltip.html(`${d.product}<br/>Quantity: ${d.totalQuantity}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 1);
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });

    // Add x-axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('font-weight', 'bold');

    // Add y-axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '12px');

    // Add axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Quantity');

    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 5})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Products');

    // Cleanup function to remove tooltip on unmount
    return () => {
      d3.select('.chart-tooltip').remove();
    };
  }, [uniqueProductsArray]);

  if (uniqueProductsArray.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data to display
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <svg ref={chartRef}></svg>
    </div>
  );
};

export default BarChart;
