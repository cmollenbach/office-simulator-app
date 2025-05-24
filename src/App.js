import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

  // Function to draw the bar chart using D3.js
  const drawChart = useCallback(() => {
    // This function is called by the useEffect below, which already checks
    // if results has data and chartRef.current is available.

    const data = Object.entries(results).map(([name, value]) => ({ name, value }));

    // Clear any existing chart
    if (!chartRef.current) {
      console.warn("Chart ref is not available for drawing.");
      return;
    }
    // Ensure results has data, though the calling useEffect should handle this.
    // This is more of a defensive check within drawChart itself.
    if (data.length === 0) {
      d3.select(chartRef.current).selectAll('*').remove(); // Clear if no data
      return;
    }

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
    const yMax = d3.max(data, d => d.value);
    const y = d3.scaleLinear()
      .domain([0, yMax !== undefined ? yMax * 1.1 : 10]) // 10% buffer, default max if no data
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
  }, [results]); // drawChart will be re-memoized only when 'results' changes.

  // Effect hook to draw the chart whenever results or drawChart (which depends on results) change
  useEffect(() => {
    if (Object.keys(results).length > 0 && chartRef.current) {
      drawChart();
    }
  }, [results, drawChart]); // Now drawChart is a stable dependency


  // Function to get LLM insights
  const getLlmInsights = async () => {
    setIsLoadingLlm(true);
    setLlmInsights(""); // Clear previous insights

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
    const apiKey = ""; // Leave as empty string, Canvas will provide it. Handled by environment.
    const apiUrl = `${GEMINI_API_BASE_URL}?key=${apiKey}`;

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
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-10 pb-6 text-center border-b-2 border-indigo-100">Office Seat Utilization Simulator</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* --- Left Column: Control Panel --- */}
          <div className="md:col-span-1 bg-slate-50 p-6 rounded-xl shadow-lg border border-slate-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-3 border-b border-gray-300">Simulation Parameters</h2>
            {/* Input Section */}
            <div className="space-y-6">
              <div className="flex flex-col">
                <label htmlFor="employees" className="text-gray-700 font-semibold mb-2 text-sm">Number of Employees:</label>
                <input
                  type="number"
                  id="employees"
                  value={numEmployees}
                  onChange={(e) => setNumEmployees(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-150"
                  min="1"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="deskRatio" className="text-gray-700 font-semibold mb-2 text-sm">Desk Ratio (Seats / Employees):</label>
                <input
                  type="number"
                  id="deskRatio"
                  value={deskRatio}
                  onChange={(e) => setDeskRatio(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-150"
                  min="0.1"
                  step="0.05"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="stdDev" className="text-gray-700 font-semibold mb-2 text-sm">Std Dev of Preference (0-5 days):</label>
                <input
                  type="number"
                  id="stdDev"
                  value={stdDevPreference}
                  onChange={(e) => setStdDevPreference(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-150"
                  min="0.1"
                  step="0.1"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="simulations" className="text-gray-700 font-semibold mb-2 text-sm">Number of Simulations:</label>
                <input
                  type="number"
                  id="simulations"
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(Math.max(1000, parseInt(e.target.value, 10) || 1000))}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-150"
                  min="1000"
                  step="1000"
                />
              </div>
            </div>

            {/* Run Simulation Button */}
            <button
              onClick={runAllSimulations}
              className="w-full mt-8 bg-indigo-600 text-white py-3.5 px-6 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors duration-300 shadow-md hover:shadow-lg flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : <span className="mr-2">🚀</span>}
              {isLoading ? 'Running Simulation...' : 'Run Simulation'}
            </button>
          </div>

          {/* --- Right Column: Results & Insights --- */}
          <div className="md:col-span-2 space-y-8">
            {Object.keys(results).length === 0 && !isLoading && (
              <div className="bg-gray-50 p-8 rounded-xl shadow-md text-center text-gray-500">
                <p className="text-xl mb-4">Welcome to the Simulator!</p>
                <p>Adjust the parameters on the left and click "Run Simulation" to see the results.</p>
              </div>
            )}

            {isLoading && Object.keys(results).length === 0 && (
                <div className="bg-gray-50 p-8 rounded-xl shadow-md text-center text-indigo-600">
                    <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-xl">Calculating scenarios... please wait.</p>
                </div>
            )}

            {Object.keys(results).length > 0 && (
              <>
                {/* Results Display Area */}
                <div className="bg-slate-50 p-6 rounded-xl shadow-lg border border-slate-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Simulation Results</h2>
                  <p className="text-gray-600 text-center text-sm mb-6">
                    (Based on {numEmployees} employees and {Math.round(numEmployees * deskRatio)} available seats)
                  </p>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                      <table className="min-w-full bg-white rounded-lg overflow-hidden">
                        <thead className="bg-indigo-600 text-white">
                          <tr>
                            <th className="py-3 px-4 text-left text-sm font-semibold">Scenario</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold">Avg. % Without Seat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries(results).map(([scenario, percentage]) => (
                            <tr key={scenario} className="hover:bg-gray-50 transition-colors duration-150">
                              <td className="py-3 px-4 text-gray-800 text-sm">{scenario}</td>
                              <td className="py-3 px-4 text-gray-800 text-sm font-medium">{percentage.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-700 mb-3 text-center">Visual Comparison</h3>
                      <div className="w-full overflow-x-auto">
                        <svg ref={chartRef} className="w-full h-80"></svg> {/* Adjusted height */}
                      </div>
                    </div>
                  </div>
                </div>

                {/* LLM Insights Section */}
                <div className="bg-indigo-50 p-6 rounded-xl shadow-lg border border-indigo-200">
                  <h2 className="text-2xl font-semibold text-indigo-800 mb-6 pb-3 text-center flex items-center justify-center border-b border-indigo-200">
                    <span className="mr-2">✨</span> Policy Insights
                  </h2>
                  <button
                    onClick={getLlmInsights}
                    className="w-full bg-sky-500 text-white py-3 px-6 rounded-lg font-semibold text-lg hover:bg-sky-600 transition-colors duration-300 shadow-md hover:shadow-lg flex items-center justify-center mb-6"
                    disabled={isLoadingLlm || isLoading}
                  >
                    {isLoadingLlm ? (
                      <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : <span className="mr-2">🧠</span>}
                    {isLoadingLlm ? 'Generating Insights...' : 'Get Policy Insights'}
                  </button>

                  {llmInsights && (
                    <div className="bg-white p-6 rounded-lg border border-indigo-100 text-gray-800 prose prose-sm max-w-none">
                      {llmInsights.split('\n').filter(line => line.trim() !== '').map((line, index) => (
                        <p key={index} className="mb-2 last:mb-0">{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
