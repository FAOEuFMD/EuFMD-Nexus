import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import ChartLegend from '../../components/RMT/ChartLegend';
import { pathwaysScores } from '../../utils/charts/pathwaysScores';

const PathwaysChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const colors = ["#214451", "#469d8f", "#f9e083", "#ef8e5c", "#f5c1c0"];

  useEffect(() => {
    // Clear any existing chart
    if (chartRef.current) {
      d3.select(chartRef.current).select('svg').remove();
      createChart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createChart = () => {
    if (!chartRef.current) return;

    const width = 500;
    const height = 200;
    const margin = { top: 10, right: 20, bottom: 40, left: 20 };

    // Format data
    const data = pathwaysScores.flatMap(({ pathway, ...diseases }) =>
      Object.entries(diseases).map(([disease, score]) => ({
        pathway,
        disease,
        score
      }))
    );

    // Extract an array with the diseases
    const diseases = Array.from(new Set(data.map(d => d.disease)));

    // Save to create the legend
    setKeys(diseases);

    // Extract an array with the pathways (this will be used in the fx domain)
    const pathways = Array.from(new Set(data.map(d => d.pathway)));

    // SVG container
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet") //to maintain aspect ratio
      .classed("w-full h-auto", true);

    // Append g
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // fx encodes the pathway
    const fx = d3.scaleBand()
      .domain(pathways)
      .range([0, width])
      .paddingInner(0.3);

    // x scale
    const x = d3.scaleBand()
      .domain(diseases)
      .range([0, fx.bandwidth()])
      .paddingOuter(0.3);

    // y scale
    const y = d3.scaleLinear()
      .domain([0, 3])
      .range([height, 0]);

    // color scale
    const color = d3.scaleOrdinal()
      .domain(diseases)
      .range(colors);

    // append bars
    g.append("g")
      .selectAll("g")
      .data(d3.group(data, d => d.pathway))
      .join("g")
      .attr("transform", ([pathway]) => `translate(${fx(pathway) || 0})`)
      .selectAll("rect")
      .data(([, d]) => d)
      .join("rect")
      .attr("x", d => x(d.disease) || 0)
      .attr("y", d => y(d.score))
      .attr("width", x.bandwidth())
      .attr("height", d => y(0) - y(d.score))
      .attr("fill", d => color(d.disease) as string);

    // append x axis
    g.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(fx)
        .tickSize(0)
        .tickPadding(10))
      .style("font-size", "13px")
      .style("color", "grey");

    // append y axis
    g.append("g")
      .call(d3.axisLeft(y)
        .tickValues([0, 1, 2, 3]) // to show only these numbers
        .tickFormat(d3.format("d"))) // format tick values as integers
      .style("font-size", "14px")
      .style("color", "grey");
  };

  return (
    <div className="max-w rounded overflow-hidden shadow-lg">
      <h3 className="pt-12">Pathways Effectiveness</h3>
      <div className="px-8 pb-4 grid grid-flow-col">
        <div ref={chartRef}></div>
        <ChartLegend keys={keys} colors={colors} />
      </div>
    </div>
  );
};

export default PathwaysChart;
