// c:\Users\chris\Documents\office-simulator-app\src\useD3Chart.js
import { useRef, useCallback, useEffect } from 'react';
import * as d3 from 'd3';

const useD3Chart = (results) => {
  const chartRef = useRef(null);


  const simplifyScenarioName = (fullName) => {
    const match = fullName.match(/^(\d+)\)/); // Extracts the leading number like "1)"
    return match ? match[1] : fullName; // Returns "1" or the original name if no match
};
  const drawChart = useCallback(() => {
    // Adapt data extraction for the new results structure
    const data = Object.entries(results).map(([fullName, resultObj]) => ({
      name: simplifyScenarioName(fullName), // Use simplified name for the chart
      value: resultObj.overallAverage  // Use the overallAverage for the chart
    }));

    if (!chartRef.current) {
      console.warn("Chart ref is not available for drawing.");
      return;
    }
    d3.select(chartRef.current).selectAll('*').remove(); // Clear previous chart

    if (data.length === 0) {
      return; // No data to draw
    }

    const margin = { top: 20, right: 30, bottom: 100, left: 60 }; // Adjusted bottom margin
    // Ensure clientWidth is available and positive, otherwise use a default
    const availableWidth = chartRef.current.clientWidth > 0 ? chartRef.current.clientWidth : 600; // Default width if clientWidth is 0
    const width = availableWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.name))
      .padding(0.2);

    const yMaxValue = d3.max(data, d => d.value);
    const yDomainEnd = yMaxValue !== undefined && yMaxValue > 0 ? yMaxValue * 1.1 : 10; // Ensure a minimum y-axis range
    const y = d3.scaleLinear()
      .domain([0, yDomainEnd])
      .range([height, 0]);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", "12px")
      .style("fill", "#333");

      // X-axis Label
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10) // Position relative to the bottom of the chart area
      .style("font-size", "14px")
      .style("fill", "#555")
      .text("Scenarios");


    svg.append("g")
      .call(d3.axisLeft(y).tickFormat(d => Math.round(d))) // Format as whole number
      .style("font-size", "12px")
      .style("fill", "#333");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left + 10)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#555")
      .text("Avg. Employees Without Desk");

    svg.selectAll(".bar")
      .data(data)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.name))
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.value))
      .attr("fill", "#6366F1") // Tailwind indigo-500
      .attr("rx", 6) // Rounded corners for bars
      .attr("ry", 6);

    svg.selectAll(".text")
      .data(data)
      .enter().append("text")
      .attr("class", "value-label")
      .attr("x", d => x(d.name) + x.bandwidth() / 2)
      .attr("y", d => y(d.value) - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#333")
      .text(d => Math.round(d.value)); // Format as whole number
  }, [results]);

  useEffect(() => {
    if (chartRef.current) { // Ensure ref is mounted
        if (Object.keys(results).length > 0) {
            drawChart();
        } else {
            d3.select(chartRef.current).selectAll('*').remove(); // Clear chart if no results
        }
    }
  }, [results, drawChart]);

  return chartRef;
};

export default useD3Chart;
