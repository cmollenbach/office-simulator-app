// src/PreferenceVsShortageScatterPlot.js
import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3'; // Corrected import
import PropTypes from 'prop-types'; // Import PropTypes
import tippy from 'tippy.js'; // Using core tippy.js for D3 elements

const PreferenceVsShortageScatterPlot = ({ results, chartTitle }) => {
  const chartRef = useRef(null);

  const drawChart = useCallback(() => {
    if (!results || Object.keys(results).length === 0) {
      d3.select(chartRef.current).selectAll('*').remove(); // Clear previous chart
      const svg = d3.select(chartRef.current)
        .attr('width', 600)
        .attr('height', 400)
        .append('g')
        .attr('transform', 'translate(50, 20)'); // Base translation

      svg.append('text')
        .attr('x', 250)
        .attr('y', 180)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('No data available for this chart.');
      return;
    }

    const data = Object.entries(results)
      .filter(([key, value]) => key !== "Imported CSV Data" && value && typeof value.overallAverage === 'number' && typeof value.averagePreferenceDeviation === 'number')
      .map(([scenario, resultObj]) => ({
        name: scenario,
        shortage: resultObj.overallAverage,
        deviation: resultObj.averagePreferenceDeviation,
      }));

    d3.select(chartRef.current).selectAll('*').remove(); // Clear previous chart

    if (data.length === 0) {
      const svgClear = d3.select(chartRef.current)
        .attr('width', 600)
        .attr('height', 400)
        .append('g')
        .attr('transform', 'translate(50, 20)');
      svgClear.append('text')
        .attr('x', 250)
        .attr('y', 180)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('No valid data for scenarios.');
      return;
    }

    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.deviation) * 1.1 || 1])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.shortage) * 1.1 || 1])
      .range([height, 0]);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-35)');


    svg.append('g')
      .call(d3.axisLeft(yScale));

    // Axis Labels
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 15) // Positioned relative to bottom margin
      .style('font-size', '12px')
      .text('Average Preference Deviation (days)');

    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left + 15)
      .attr('x', 0 - (height / 2))
      .style('font-size', '12px')
      .text('Average Seat Shortage (employees)');

    // Chart Title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 0 - (margin.top / 2) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(chartTitle);

    // Points
    svg.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.deviation))
      .attr('cy', d => yScale(d.shortage))
      .attr('r', 7)
      .style('fill', '#4673C3') // skyBlue
      .style('opacity', 0.7)
      .attr('data-tippy-content', d => `Scenario: ${d.name}<br>Shortage: ${d.shortage.toFixed(1)}<br>Deviation: ${d.deviation.toFixed(2)}`)
      .on('mouseover', function () { // Removed event and d as they are not used here anymore
        d3.select(this).style('opacity', 1).style('stroke', 'black').style('stroke-width', 2);
      })
      .on('mouseout', function () {
        d3.select(this).style('opacity', 0.7).style('stroke', 'none');
      });

    // Initialize Tippy on new circles
    // This direct DOM manipulation is okay for Tippy after D3 creates elements.
    // Ensure Tippy() is available or use a React-based Tippy wrapper if preferred for managing Tippy instances.
    // For simplicity in this D3-focused component:
    tippy(chartRef.current.querySelectorAll('circle[data-tippy-content]'), { allowHTML: true });


  }, [results, chartTitle]);

  useEffect(() => {
    drawChart();
  }, [results, drawChart]);

  return <svg ref={chartRef}></svg>;
};

PreferenceVsShortageScatterPlot.propTypes = {
  results: PropTypes.object.isRequired,
  chartTitle: PropTypes.string.isRequired,
};

export default PreferenceVsShortageScatterPlot;