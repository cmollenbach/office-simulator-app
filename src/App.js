// c:\Users\chris\Documents\office-simulator-app\src\App.js
import React, { useState, useCallback } from 'react';


import {
  runScenario,
  generateNormalRandom,
  DAYS_IN_WORK_WEEK,
  SCENARIO_NAMES
} from './simulationUtils';

import ParameterInputPanel from './ParameterInputPanel';
import ResultsDisplayPanel from './ResultsDisplayPanel';
import LlmInsightsPanel from './LlmInsightsPanel';
import useD3Chart from './useD3Chart'; // Import custom hook for D3 chart
import useLlmInsights from './useLlmInsights'; // Import custom hook for LLM



// Main App component
const App = () => {
  // Input state variables
  const [numEmployees, setNumEmployees] = useState(100); // Default number of employees
  const [deskRatio, setDeskRatio] = useState(0.7); // Default desk ratio (70% desks compared to employees)
    const [meanPreference, setMeanPreference] = useState(3); // Default average preferred days in office
  const [stdDevPreference, setStdDevPreference] = useState(0.8); // Default standard deviation for preferred days
  const [numSimulations, setNumSimulations] = useState(10000); // Default number of simulation runs (now represents weeks)
const [dayWeights, setDayWeights] = useState([0.8, 1.2, 1.2, 1.1, 0.7]); // Default weights
  // State to store simulation results
  const [results, setResults] = useState({});
  // State to manage loading indicator for simulation
  const [isLoading, setIsLoading] = useState(false);

  // Custom hook for D3 chart
  const chartRef = useD3Chart(results);

// Custom hook for LLM insights
  const { llmInsights, isLoadingLlm, fetchLlmInsightsData } = useLlmInsights();

  // Main function to run all simulations
  const runAllSimulations = useCallback(() => {
    setIsLoading(true);

    const availableSeats = Math.round(numEmployees * deskRatio);

    // Generate preferred days in office for each employee once for this entire simulation run
    const employeePreferences = Array.from({ length: numEmployees }, () => {
       return Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(generateNormalRandom(meanPreference, stdDevPreference))));
    });

   
    const newResults = {};
    // Run simulation for each scenario
    for (const scenarioName of SCENARIO_NAMES) {
      newResults[scenarioName] = runScenario(
        scenarioName,
        numEmployees,
        availableSeats,
        employeePreferences,
         numSimulations,
        dayWeights
      );
    }

    setResults(newResults);
    setIsLoading(false);
    }, [numEmployees, deskRatio, meanPreference, stdDevPreference, numSimulations,dayWeights, setIsLoading, setResults]); // Added dependencies for useCallback

  const handleGetLlmInsights = useCallback(() => {
    fetchLlmInsightsData({
      numEmployees,
      deskRatio,
      meanPreference,   // Added meanPreference to LLM prompt data
      stdDevPreference,
      dayWeights,       // Pass dayWeights for LLM context
      numSimulations,
      results
    });
  
  }, [fetchLlmInsightsData, numEmployees, deskRatio, meanPreference, stdDevPreference, dayWeights, numSimulations, results]);


  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans flex flex-col items-center">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-10 pb-6 text-center border-b-2 border-indigo-100">Office Seat Utilization Simulator</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Parameter Inputs - takes 1 column on large screens */}
          <div className="lg:col-span-1">
            <ParameterInputPanel
              numEmployees={numEmployees}
              setNumEmployees={setNumEmployees}
              deskRatio={deskRatio}
              setDeskRatio={setDeskRatio}
              meanPreference={meanPreference}
              setMeanPreference={setMeanPreference}
              stdDevPreference={stdDevPreference}
              setStdDevPreference={setStdDevPreference}
              numSimulations={numSimulations}
              setNumSimulations={setNumSimulations}
              dayWeights={dayWeights}
              setDayWeights={setDayWeights}
              runAllSimulations={runAllSimulations}
              isLoading={isLoading}
            />
          </div>

          {/* Simulation Results - takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <ResultsDisplayPanel
              results={results}
              isLoading={isLoading}
              chartRef={chartRef}
              numSimulations={numSimulations}
              numEmployees={numEmployees}
              deskRatio={deskRatio}
            />
          </div>

          {/* Policy Insights - takes full 3 columns on large screens, effectively a new row */}
          <div className="lg:col-span-3">
            <LlmInsightsPanel
              results={results}
              getLlmInsights={handleGetLlmInsights}
              isLoadingLlm={isLoadingLlm}
              llmInsights={llmInsights}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
