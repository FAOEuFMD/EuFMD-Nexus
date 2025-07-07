import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import wrap from '../../utils/charts/wrapAxisText';

interface ScoresPerPathway {
  name_un: string;
  scores: {
    [disease: string]: {
      [pathway: string]: number;
    }
  };
}

interface RiskPathwayChartProps {
  disease: string;
  scoresPerPathway: ScoresPerPathway[];
  onKeysChange: (keys: string[]) => void;
  onColorsChange: (colors: string[]) => void;
}

const RiskPathwayChart: React.FC<RiskPathwayChartProps> = ({ 
  disease, 
  scoresPerPathway,
  onKeysChange,
  onColorsChange
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const colors = ["#214451", "#469d8f", "#f9e083", "#ef8e5c", "#f5c1c0", "#a0729c"];

  useEffect(() => {
    if (scoresPerPathway && scoresPerPathway.length > 0 && chartRef.current) {
      // Clear any existing chart
      d3.select(chartRef.current).select("svg").remove();
      createChart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disease, scoresPerPathway]);

  const createChart = () => {
    if (!chartRef.current || !containerRef.current) return;

    // Format data for a simpler grouped bar chart instead of a stacked chart
    const formattedData: { country: string; pathway: string; score: number }[] = [];
    
    scoresPerPathway.forEach(({ name_un, scores }) => {
      if (scores[disease]) {
        Object.entries(scores[disease]).forEach(([pathway, score]) => {
          formattedData.push({
            country: name_un,
            pathway,
            score
          });
        });
      }
    });

    // The keys for the ChartLegend are the pathways' names
    const pathways = Array.from(new Set(formattedData.map(d => d.pathway)));
    onKeysChange(pathways);
    onColorsChange(colors);

    // Define the dimensions and margins for the chart
    const containerWidth = containerRef.current.clientWidth;
    const width = containerWidth || 500;
    const height = scoresPerPathway.length * 100;
    const margin = { top: 10, right: 20, bottom: 50, left: 90 };

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

    // Group data by country
    const countries = Array.from(new Set(formattedData.map(d => d.country)));
    
    // x scale - linear scale for the score
    const x = d3.scaleLinear()
      .domain([0, d3.max(formattedData, d => d.score) || 100])
      .range([0, width]);
    
    // y scale - band scale for countries
    const y = d3.scaleBand()
      .domain(countries)
      .range([0, height])
      .padding(0.2);
      
    // Color scale (one color per pathway)
    const color = d3.scaleOrdinal<string>()
      .domain(pathways)
      .range(colors);
    
    // Group bars by country - we define groups but use direct selection in the next step
    g.selectAll(".country-group")
      .data(countries)
      .enter()
      .append("g")
      .attr("class", "country-group")
      .attr("transform", d => `translate(0,${y(d)})`);
    
    // For each country, create bars for each pathway
    countries.forEach(country => {
      const countryData = formattedData.filter(d => d.country === country);
      
      g.selectAll(`.bar-${country.replace(/\s+/g, '-')}`)
        .data(countryData)
        .enter()
        .append("rect")
        .attr("class", d => `bar-${d.country.replace(/\s+/g, '-')}`)
        .attr("x", 0)
        .attr("y", d => y(d.country) || 0)
        .attr("height", y.bandwidth() / pathways.length - 5)
        .attr("width", d => x(d.score))
        .attr("fill", d => color(d.pathway))
        .attr("transform", (d, i) => {
          const pathwayIndex = pathways.indexOf(d.pathway);
          return `translate(0,${pathwayIndex * (y.bandwidth() / pathways.length)})`;
        });
    });
    
    // Add x-axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .style("font-size", "14px")
      .style("color", "grey");
    
    // Add y-axis
    g.append("g")
      .call(d3.axisLeft(y))
      .style("font-size", "15px")
      .style("color", "grey")
      .selectAll(".tick text")
      .call(wrap, margin.left - 10);
  };

  return (
    <div className="max-w rounded overflow-hidden shadow-lg">
      <h3 className="pt-6">{disease} score by pathway</h3>
      <div ref={containerRef} className="px-6 flex justify-center">
        <div ref={chartRef} className="w-full h-auto max-w-xs text-center"></div>
      </div>
    </div>
  );
};

export default RiskPathwayChart;
