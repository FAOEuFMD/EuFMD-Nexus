import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import ChartLegend from '../../components/RMT/ChartLegend';
import wrap from '../../utils/charts/wrapAxisText';

interface DiseaseStatusData {
  name_un: string;
  FMD?: number | null;
  PPR?: number | null;
  LSD?: number | null;
  RVF?: number | null;
  SPGP?: number | null;
}

interface DiseaseStatusBarchartProps {
  diseaseStatus: DiseaseStatusData[];
}

const DiseaseStatusBarchart: React.FC<DiseaseStatusBarchartProps> = ({ diseaseStatus }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const colors = ["#214451", "#469d8f", "#f9e083", "#ef8e5c", "#f5c1c0"];

  useEffect(() => {
    if (!diseaseStatus || diseaseStatus.length === 0 || !chartRef.current) return;
    
    // Clear any existing chart
    d3.select(chartRef.current).select('svg').remove();
    
    createChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diseaseStatus]);

  const createChart = () => {
    if (!chartRef.current) return;

    const width = 400;
    const height = diseaseStatus.length * 100;
    const margin = { top: 10, right: 10, bottom: 20, left: 80 };

    /*
    The disease status is stored like:
        { name_un: 'Country A', FMD: 2, LSD: 1, PPR: 3, RVF: 0, SPGP: 1 }
    However, we need an object for every disease:
        { country: 'Country A', disease: "FMD", score: 2 },
        { country: 'Country A', disease: "LSD", score: 1 },
        { country: 'Country A', disease: "PPR", score: 3 },
        { country: 'Country A', disease: "RVF", score: 0 },
        { country: 'Country A', disease: "SPGP", score: 1 },
    */
    // Format data
    const data = diseaseStatus.flatMap(({ name_un, ...diseases }) =>
      Object.entries(diseases).map(([disease, score]) => ({
        country: name_un,
        disease,
        score: score !== null && score !== undefined ? score : 0
      }))
    );

    // Extract an array with the diseases
    const diseases = Array.from(new Set(data.map(d => d.disease)));
    
    // Save to create the legend later
    setKeys(diseases);
    
    // Create the SVG container
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet") // to maintain aspect ratio
      .classed("w-full h-auto", true);
    
    // Create g
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // x scale
    const x = d3.scaleLinear()
      .domain([0, 3])
      .range([0, width]);
    
    // fy encodes the country
    const fy = d3.scaleBand()
      .domain(Array.from(new Set(data.map(d => d.country))))
      .range([0, height])
      .paddingInner(0.2);
    
    // y scale
    const y = d3.scaleBand()
      .domain(diseases)
      .range([0, fy.bandwidth()])
      .paddingOuter(0.3);
    
    // color scale (one color per disease)
    const color = d3.scaleOrdinal()
      .domain(diseases)
      .range(colors);
    
    // Append bars
    g.append("g")
      .selectAll("g")
      .data(d3.group(data, d => d.country))
      .join("g")
      .attr("transform", ([country]) => `translate(0, ${fy(country) || 0})`)
      .selectAll("rect")
      .data(([, d]) => d) // bind the nested data
      .join("rect")
      .attr("x", x(0))
      .attr("y", d => y(d.disease) || 0)
      .attr("width", d => x(d.score))
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.disease) as string);
    
    // Append x axis
    g.append("g")
      .attr("transform", `translate(0, ${height})`)
      .style("font-size", "14px")
      .style("color", "grey")
      .call(d3.axisBottom(x)
        .tickValues([0, 1, 2, 3])
        .tickFormat(d3.format("d")) // format tick values as integers
      );
    
    // Append y axis
    g.append("g")
      .call(d3.axisLeft(fy)
        .tickSize(0)
        .tickPadding(10))
      .style("font-size", "14px")
      .style("color", "grey")
      .selectAll(".tick text")
      .call(wrap, fy.bandwidth());
  };

  return (
    <div className="max-w rounded overflow-hidden shadow-lg">
      <h3 className="pt-6">Disease Status</h3>
      <div className="px-8 pb-4 grid grid-flow-col">
        <div ref={chartRef}></div>
        <ChartLegend keys={keys} colors={colors} />
      </div>
    </div>
  );
};

export default DiseaseStatusBarchart;
