import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3'; // For charting

// Helper function to generate a random number from a standard normal distribution (mean 0, std dev 1)
// using the Box-Muller transform.
function generateStandardNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Helper function to generate a random number from a normal distribution with specified mean and standard deviation
function generateNormalRandom(mean, stdDev) {
  return mean + stdDev * generateStandardNormal();
}

// Main App component
const App = () => {
  // Input state variables
  const [numEmployees, setNumEmployees] = useState(100); // Default number of employees
  const [deskRatio, setDeskRatio] = useState(0.7); // Default desk ratio (70% desks compared to employees)
  const [stdDevPreference, setStdDevPreference] = useState(0.8); // Default standard deviation for preferred days
  const [numSimulations, setNumSimulations] = useState(10000); // Default number of simulation runs

  // State to store simulation results
  const [results, setResults] = useState({});
  // State to manage loading indicator for simulation
  const [isLoading, setIsLoading] = useState(false);

  // State for LLM-generated insights
  const [llmInsights, setLlmInsights] = useState("");
  // State to manage loading indicator for LLM
  const [isLoadingLlm, setIsLoadingLlm] = useState(false);

  // Ref for the D3 chart SVG element
  const chartRef = useRef(null);

  // Function to run the Monte Carlo simulation for a single scenario
  const runScenario = (scenarioName, numEmployees, availableSeats, employeePreferences, dailyAttendanceLogic) => {
    let totalShortagePercentage = 0;

    // Loop through each simulation run (representing a 'day')
    for (let i = 0; i < numSimulations; i++) {
      let currentDayAttendees = 0;

      // For each employee, determine if they are in the office today based on the scenario's logic
      for (let j = 0; j < numEmployees; j++) {
        const preferredDays = employeePreferences[j];
        // Get the daily probability of attendance based on the scenario's rules
        const dailyProb = dailyAttendanceLogic(preferredDays);

        // Randomly decide if the employee is in the office today
        if (Math.random() < dailyProb) {
          currentDayAttendees++;
        }
      }

      // Calculate the number of people without a seat for this simulated day
      const peopleWithoutSeat = Math.max(0, currentDayAttendees - availableSeats);
      // Convert to percentage of total employees and add to running total
      totalShortagePercentage += (peopleWithoutSeat / numEmployees) * 100;
    }

    // Calculate the average percentage of employees without a seat over all simulations
    return totalShortagePercentage / numSimulations;
  };

  // Main function to run all simulations
  const runAllSimulations = () => {
    setIsLoading(true); // Set loading state to true
    setLlmInsights(""); // Clear previous LLM insights when running new simulation

    // Calculate available seats based on employee count and desk ratio
    const availableSeats = Math.round(numEmployees * deskRatio);

    // Generate preferred days in office for each employee once
    // These preferences are fixed for each employee across all scenarios
    const employeePreferences = Array.from({ length: numEmployees }, () => {
      // Generate a normally distributed preference, round to nearest integer, and clamp between 0 and 5
      return Math.min(5, Math.max(0, Math.round(generateNormalRandom(3, stdDevPreference))));
    });

    // Define the attendance logic for each scenario
    const scenarios = {
      "1) No rules": (preferredDays) => preferredDays / 5, // Daily probability is preferred days / 5
      "2) Min 2 days/week, no max": (preferredDays) => Math.max(2, preferredDays) / 5, // At least 2 days
      "3) Min 3 days/week, no max": (preferredDays) => Math.max(3, preferredDays) / 5, // At least 3 days
      "4) Min 2 days/week, max 4 days/week": (preferredDays) => Math.min(4, Math.max(2, preferredDays)) / 5, // Between 2 and 4 days
      "5) Exactly 3 days/week": () => 3 / 5, // Fixed 3 days for everyone
    };

    const newResults = {};
    // Run simulation for each scenario
    for (const scenarioName in scenarios) {
      newResults[scenarioName] = runScenario(
        scenarioName,
        numEmployees,
        availableSeats,
        employeePreferences,
        scenarios[scenarioName]
      );
    }

    setResults(newResults); // Update results state
    setIsLoading(false); // Set loading state to false
  };

  // Effect hook to draw the chart whenever results change
  useEffect(() => {
    if (Object.keys(results).length > 0 && chartRef.current) {
      drawChart();
    }
  }, [results]);

  // Function to draw the bar chart using D3.js
  const drawChart = () => {
    const data = Object.entries(results).map(([name, value]) => ({ name, value }));

    // Clear any existing chart
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 120, left: 60 }; // Increased bottom margin for labels
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X scale (scenarios)
    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.name))
      .padding(0.2);

    // Y scale (percentage without seat)
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1]) // 10% buffer for max value
      .range([height, 0]);

    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)") // Rotate labels for better readability
      .style("text-anchor", "end")
      .style("font-size", "12px")
      .style("fill", "#333");

    // Add Y axis
    svg.append("g")
      .call(d3.axisLeft(y).tickFormat(d => `${d.toFixed(1)}%`)) // Format Y axis as percentage
      .style("font-size", "12px")
      .style("fill", "#333");

    // Y axis label
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left + 10)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#555")
      .text("Average % Employees Without a Seat");

    // Add bars
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

    // Add values on top of bars
    svg.selectAll(".text")
      .data(data)
      .enter().append("text")
      .attr("class", "value-label")
      .attr("x", d => x(d.name) + x.bandwidth() / 2)
      .attr("y", d => y(d.value) - 5) // Position slightly above the bar
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#333")
      .text(d => `${d.value.toFixed(2)}%`);
  };

  // Function to get LLM insights
  const getLlmInsights = async () => {
    setIsLoadingLlm(true);
    setLlmInsights(""); // Clear previous insights

    const sortedResults = Object.entries(results).sort(([, a], [, b]) => a - b);
    const topScenarios = sortedResults.slice(0, 3); // Get top 3 best scenarios

    const prompt = `
      I have performed a Monte Carlo simulation for office seat utilization.
      Here are the simulation parameters:
      - Number of Employees: ${numEmployees}
      - Desk Ratio (Seats / Employees): ${deskRatio} (meaning ${Math.round(numEmployees * deskRatio)} available seats)
      - Standard Deviation of Employee Preference: ${stdDevPreference}
      - Number of Simulations: ${numSimulations}

      Here are the average percentages of employees potentially without a seat for various scenarios:
      ${Object.entries(results).map(([scenario, percentage]) => `- ${scenario}: ${percentage.toFixed(2)}%`).join('\n')}

      Please provide a brief summary of these results. Then, for the top 2-3 best-performing scenarios (those with the lowest "Avg. % Without Seat"), analyze their potential pros and cons from both the company's and the employees' perspectives.
      Focus on clarity and actionable insights.
    `;

    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    const apiKey = ""; // Leave as empty string, Canvas will provide it
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setLlmInsights(text);
      } else {
        setLlmInsights("Failed to get insights from LLM. Please try again.");
        console.error("LLM response structure unexpected:", result);
      }
    } catch (error) {
      setLlmInsights("Error connecting to LLM. Please check your network or try again.");
      console.error("Error fetching LLM insights:", error);
    } finally {
      setIsLoadingLlm(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans flex flex-col items-center">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Office Seat Utilization Simulator</h1>

        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="flex flex-col">
            <label htmlFor="employees" className="text-gray-700 font-medium mb-2">Number of Employees:</label>
            <input
              type="number"
              id="employees"
              value={numEmployees}
              onChange={(e) => setNumEmployees(Math.max(1, parseInt(e.target.value) || 0))}
              className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              min="1"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="deskRatio" className="text-gray-700 font-medium mb-2">Desk Ratio (Seats / Employees):</label>
            <input
              type="number"
              id="deskRatio"
              value={deskRatio}
              onChange={(e) => setDeskRatio(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              min="0.1"
              step="0.05"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="stdDev" className="text-gray-700 font-medium mb-2">Std Dev of Preference (0-5 days):</label>
            <input
              type="number"
              id="stdDev"
              value={stdDevPreference}
              onChange={(e) => setStdDevPreference(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              min="0.1"
              step="0.1"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="simulations" className="text-gray-700 font-medium mb-2">Number of Simulations:</label>
            <input
              type="number"
              id="simulations"
              value={numSimulations}
              onChange={(e) => setNumSimulations(Math.max(1000, parseInt(e.target.value) || 0))}
              className="p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              min="1000"
              step="1000"
            />
          </div>
        </div>

        {/* Run Simulation Button */}
        <button
          onClick={runAllSimulations}
          className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors duration-300 shadow-md flex items-center justify-center"
          disabled={isLoading}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : null}
          {isLoading ? 'Running Simulation...' : 'Run Simulation'}
        </button>

        {/* Results Section */}
        {Object.keys(results).length > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Simulation Results</h2>
            <p className="text-gray-600 text-center mb-6">
              Average percentage of employees potentially without a seat on a given day.
              <br/>
              (Based on {numEmployees} employees and {Math.round(numEmployees * deskRatio)} available seats)
            </p>

            {/* Results Table */}
            <div className="overflow-x-auto mb-8 rounded-lg shadow-md">
              <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-indigo-500 text-white">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold">Scenario</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold">Avg. % Without Seat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(results).map(([scenario, percentage]) => (
                    <tr key={scenario} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-3 px-4 text-gray-800">{scenario}</td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{percentage.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Results Chart */}
            <div className="bg-gray-50 p-4 rounded-xl shadow-inner">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Visual Comparison</h3>
              <div className="w-full overflow-x-auto">
                <svg ref={chartRef} className="w-full h-96"></svg>
              </div>
            </div>

            {/* LLM Insights Section */}
            <div className="mt-10 bg-blue-50 p-6 rounded-xl shadow-md border border-blue-200">
              <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center flex items-center justify-center">
                <span className="mr-2">✨</span> Policy Insights
              </h2>
              <button
                onClick={getLlmInsights}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors duration-300 shadow-md flex items-center justify-center mb-4"
                disabled={isLoadingLlm}
              >
                {isLoadingLlm ? (
                  <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                {isLoadingLlm ? 'Generating Insights...' : 'Get Policy Insights'}
              </button>

              {llmInsights && (
                <div className="bg-white p-4 rounded-lg border border-blue-100 text-gray-800 prose max-w-none">
                  {llmInsights.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
