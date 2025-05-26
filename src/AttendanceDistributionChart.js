// src/AttendanceDistributionChart.js
import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3'; // Corrected import
import tippy from 'tippy.js'; // Using core tippy.js for D3 elements
import PropTypes from 'prop-types'; // Import PropTypes

const AttendanceDistributionChart = ({ results, chartTitle }) => {
  const chartRef = useRef(null);

  const drawChart = useCallback(() => {
    // Define days array inside useCallback to stabilize dependency
    const days = ["0 Days", "1 Day", "2 Days", "3 Days", "4 Days", "5 Days"];

    if (!results || Object.keys(results).length === 0) {
       d3.select(chartRef.current).selectAll('*').remove();
       const svg = d3.select(chartRef.current)
        .attr('width', 700)
        .attr('height', 450)
        .append('g')
        .attr('transform', 'translate(60, 40)');

      svg.append('text')
        .attr('x', 300)
        .attr('y', 200)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('No data available for this chart.');
      return;
    }

    const scenarios = Object.entries(results)
      .filter(([_key, value]) => value && Array.isArray(value.attendanceDistribution) && value.attendanceDistribution.length === 6)
      .map(([name, value]) => ({
        name,
        distribution: value.attendanceDistribution.map((val, i) => ({ // 'i' is used, so no unused var warning here
          days: days[i],
          value: typeof val === 'number' ? val : 0 // Handle N/A or errors as 0
        }))
      }));

    d3.select(chartRef.current).selectAll('*').remove(); // Clear previous chart

    if (scenarios.length === 0) {
       const svgClear = d3.select(chartRef.current)
        .attr('width', 700)
        .attr('height', 450)
        .append('g')
        .attr('transform', 'translate(60, 40)');
      svgClear.append('text')
        .attr('x', 300)
        .attr('y', 200)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('No valid data for scenarios.');
      return;
    }

    const margin = { top: 60, right: 120, bottom: 110, left: 70 }; // Further increased bottom and left margins
    const width = 700 - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const scenarioNames = scenarios.map(d => d.name);

    const xScale = d3.scaleBand()
      .domain(scenarioNames)
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, 100]) // Percentages
      .range([height, 0]);

    const colorScale = d3.scaleOrdinal()
      .domain(days)
      // Custom color scheme using the new palette, ordered darkest to lightest for the stack
      // (assuming default stack order is bottom to top, and legend order matches visual stack)
      .range([
        '#002346', // signatureBlue (darkest)
        '#003778', // oceanBlue
        '#4673C3', // skyBlue
        '#0069FA', // actionBlue (vibrant mid-tone)
        '#87AAE1', // iceBlue
        '#B9C8E6'  // mistBlue (lightest)
      ]);
      // Note: The original d3.schemeBlues[6].slice().reverse() resulted in darkest at the bottom of the stack.
      // This new range should achieve a similar effect with the custom colors.

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '10px');

    svg.append('g')
      .call(d3.axisLeft(yScale).ticks(10).tickFormat(d => `${d}%`)); // Corrected tick formatting

    // Axis Labels
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', 0 - (height / 2))
      .attr('y', 0 - margin.left + 20) // Adjusted slightly for no x-axis label
      .style('text-anchor', 'middle')
      .attr('dy', '0.75em') // Nudge for better centering after rotation
      .style('font-size', '12px')
      .text('% of Employees');
    
    // Chart Title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 0 - (margin.top / 2) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(chartTitle);

    // Stacked bars
    const stack = d3.stack()
      .keys(days)
      .value((d, key) => {
          const item = d.distribution.find(item => item.days === key); // 'key' is used here
          return item ? item.value : 0;
      });

    const stackedData = stack(scenarios);

    // Create a group for each layer (day category)
    const layers = svg.append('g')
      .selectAll('g.stack-layer')
      .data(stackedData)
      .enter().append('g')
        .attr('class', 'stack-layer')
        .attr('fill', layer => colorScale(layer.key));

    // Add rectangles for each segment in each layer
    layers.selectAll('rect')
      .data(layer => layer) // Bind segment data. Each `segment` is [y0, y1] and `segment.data` is the original scenario object
      .enter().append('rect')
        .attr('x', segment => xScale(segment.data.name))
        .attr('y', segment => yScale(segment[1]))
        .attr('height', segment => yScale(segment[0]) - yScale(segment[1]))
        .attr('width', xScale.bandwidth())
        .attr('data-tippy-content', function(segment) { // Use a regular function to access `this`
            const scenario = segment.data.name;
            // Access the layer's key (dayName) from the parent 'g' element's datum
            const dayName = d3.select(this.parentNode).datum().key;
            const percentage = (segment[1] - segment[0]).toFixed(1);
            return `Scenario: ${scenario}<br>${dayName}: ${percentage}%`;
        });
        
    // Legend
    const legendItemHeight = 20;
    const legendHeight = days.length * legendItemHeight;
    const legendXPosition = width + 5; // Moved legend slightly more in
    const legend = svg.append('g') // A single group for the whole legend
      .attr('class', 'chart-legend')
      .attr('transform', `translate(${legendXPosition}, ${(height - legendHeight) / 2})`); // Position and vertically center legend

    legend.selectAll('.legend-item')
      .data(days.slice().reverse()) // Reverse to match visual stack order (lightest on top)
      .enter().append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0,${i * 20})`) // Vertical spacing for each item
        .style('font-size', '10px')
      .selectAll('rect')
      .data(d => [d]) // Bind the day name to the rect and text
      .join(
        enter => {
          const item = enter.append('g');
          item.append('rect')
            .attr('x', 0) // Relative to the legend item's group
            .attr('width', 18)
            .attr('height', 18)
            .style('fill', d => colorScale(d)); // Use the day name for color lookup

          item.append('text')
            .attr('x', 24) // Position text to the right of the rect
            .attr('y', 9)
            .attr('dy', '.35em')
            .style('text-anchor', 'start') // Align text start
            .text(d => d); // The day name itself
          return item;
        }
      );

    // Initialize Tippy on new rects
    tippy(chartRef.current.querySelectorAll('rect[data-tippy-content]'), { allowHTML: true });

  }, [results, chartTitle]);

  useEffect(() => {
    drawChart();
  }, [results, drawChart]);

  return <svg ref={chartRef}></svg>;
};

AttendanceDistributionChart.propTypes = {
  results: PropTypes.object.isRequired,
  chartTitle: PropTypes.string.isRequired,
};

export default AttendanceDistributionChart;