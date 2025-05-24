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
// import useD3Chart from './useD3Chart'; // No longer using D3 chart
import useLlmInsights from './useLlmInsights'; // Import custom hook for LLM



// Main App component
const App = () => {
  // Input state variables
  const [numEmployees, setNumEmployees] = useState(100); // Default number of employees
  const [deskRatio, setDeskRatio] = useState(0.7); // Default desk ratio (70% desks compared to employees)
  const [meanPreference, setMeanPreference] = useState(3); // Default average preferred days in office
  const [stdDevPreference, setStdDevPreference] = useState(0.8); // Default standard deviation for preferred days
  const [numSimulations, setNumSimulations] = useState(10000); // Default number of simulation runs (now represents weeks)
  const [dayWeights, setDayWeights] = useState([1, 1, 1, 1, 1]); // Default weights
  const [csvEmpiricalPreferences, setCsvEmpiricalPreferences] = useState(null); // To store flat list of preferences from CSV
  const [excludedWeeksLog, setExcludedWeeksLog] = useState([]); // To log excluded outlier weeks


  // State to store simulation results for both views
  const [empiricalResults, setEmpiricalResults] = useState({});
  const [modeledResults, setModeledResults] = useState({});
  const [currentViewMode, setCurrentViewMode] = useState('modeled'); // 'modeled' or 'empirical'
  // State to manage loading indicator for simulation
  const [isLoading, setIsLoading] = useState(false);

  // Custom hook for D3 chart
  // const chartRef = useD3Chart(results); // No longer using D3 chart

  // Custom hook for LLM insights
  const { llmInsights, isLoadingLlm, fetchLlmInsightsData } = useLlmInsights();
  const resultsToDisplay = currentViewMode === 'empirical' && Object.keys(empiricalResults).length > 0 ? empiricalResults : modeledResults;

  // Main function to run all simulations
  const runAllSimulations = useCallback(() => {
    setIsLoading(true);

    const availableSeats = Math.round(numEmployees * deskRatio);

    // --- Run 1: Modeled Preferences (Normal Distribution) ---
    const modeledEmployeePreferences = Array.from({ length: numEmployees }, () => {
      return Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(generateNormalRandom(meanPreference, stdDevPreference))));
    });

    const newModeledResults = {};
    for (const scenarioName of SCENARIO_NAMES) {
      newModeledResults[scenarioName] = runScenario(
        scenarioName,
        numEmployees,
        availableSeats,
        modeledEmployeePreferences,
        numSimulations,
        dayWeights
        // No empirical distribution passed here, so runScenario uses modeledEmployeePreferences
      );
    }
    // Add "Imported CSV Data" to modeledResults if it exists from a previous import,
    // so it's available if the user switches views before running a new empirical sim.
    if (empiricalResults["Imported CSV Data"]) {
      newModeledResults["Imported CSV Data"] = empiricalResults["Imported CSV Data"];
    } else if (modeledResults["Imported CSV Data"]) { // Or if it was already in modeledResults
      newModeledResults["Imported CSV Data"] = modeledResults["Imported CSV Data"];
    }
    setModeledResults(newModeledResults);

    // --- Run 2: Empirical Preferences (if CSV data is available) ---
    if (csvEmpiricalPreferences && csvEmpiricalPreferences.length > 0) {
      // Generate employee preferences by sampling from the empirical distribution
      const empiricalEmployeePreferences = Array.from({ length: numEmployees }, () => {
        return csvEmpiricalPreferences[Math.floor(Math.random() * csvEmpiricalPreferences.length)];
      });

      const newEmpiricalResults = {};
      for (const scenarioName of SCENARIO_NAMES) {
        newEmpiricalResults[scenarioName] = runScenario(
          scenarioName,
          numEmployees,
          availableSeats,
          empiricalEmployeePreferences, // Use preferences sampled from CSV
          numSimulations,
          dayWeights
        );
      }
      // Add "Imported CSV Data" to empiricalResults
      if (empiricalResults["Imported CSV Data"]) {
         newEmpiricalResults["Imported CSV Data"] = empiricalResults["Imported CSV Data"];
      } else if (newModeledResults["Imported CSV Data"]) { // Or if it was just calculated for modeled view
         newEmpiricalResults["Imported CSV Data"] = newModeledResults["Imported CSV Data"];
      }
      setEmpiricalResults(newEmpiricalResults);
      setCurrentViewMode('empirical'); // Default to empirical view if it was just run
    } else {
      setEmpiricalResults({}); // Clear empirical results if no CSV data
      setCurrentViewMode('modeled'); // Default to modeled view
    }

    setIsLoading(false);
    }, [numEmployees, deskRatio, meanPreference, stdDevPreference, numSimulations, dayWeights, csvEmpiricalPreferences, setIsLoading, empiricalResults, modeledResults]);


  const processImportedData = (csvData) => {
    if (!csvData || csvData.length === 0) {
      alert("No data found in CSV or CSV is empty.");
      return;
    }

    // Group data by week
    const weeklyData = {};
    csvData.forEach(row => {
      if (row.length < 3 || typeof row[0] !== 'string' || typeof row[1] !== 'number' || typeof row[2] !== 'number') {
        console.warn("Skipping invalid CSV row:", row);
        return;
      }
      const weekIdentifier = row[0];
      const daysAttended = row[1];
      const peopleCount = row[2];

      if (!weeklyData[weekIdentifier]) {
        weeklyData[weekIdentifier] = {
          totalPeopleThisWeek: 0,
          attendanceDistribution: Array(6).fill(0),
          weightedDaysSum: 0,
        };
      }
      if (daysAttended >= 0 && daysAttended <= 5) {
        weeklyData[weekIdentifier].attendanceDistribution[daysAttended] += peopleCount;
        weeklyData[weekIdentifier].totalPeopleThisWeek += peopleCount;
        weeklyData[weekIdentifier].weightedDaysSum += daysAttended * peopleCount;
      }
    });

    const currentExcludedWeeks = [];
    let lowerBoundTotalAttendance = -Infinity;
    let upperBoundZeroAttendance = Infinity;

    const minWeeksForOutlierDetection = 3;

    // --- Outlier Detection for Low Total Attendance ---
    const weeklyTotals = Object.values(weeklyData).map(week => week.totalPeopleThisWeek);
    if (weeklyTotals.length >= minWeeksForOutlierDetection) {
      const sortedTotals = [...weeklyTotals].sort((a, b) => a - b);
      const q1Total = sortedTotals[Math.floor(sortedTotals.length / 4)];
      const q3Total = sortedTotals[Math.floor(sortedTotals.length * 3 / 4)];
      const iqrTotal = q3Total - q1Total;
      lowerBoundTotalAttendance = q1Total - 1.5 * iqrTotal;
    } else {
      console.warn("Not enough weekly data to perform robust outlier detection for total attendance. Using all data for this metric.");
    }

    // --- Outlier Detection for High Zero Attendance ---
    const weeklyZeroAttendanceCounts = Object.values(weeklyData).map(week => week.attendanceDistribution[0]);
    if (weeklyZeroAttendanceCounts.length >= minWeeksForOutlierDetection) {
        const sortedZeroCounts = [...weeklyZeroAttendanceCounts].sort((a, b) => a - b);
        const q1Zero = sortedZeroCounts[Math.floor(sortedZeroCounts.length / 4)];
        const q3Zero = sortedZeroCounts[Math.floor(sortedZeroCounts.length * 3 / 4)];
        const iqrZero = q3Zero - q1Zero;
        upperBoundZeroAttendance = q3Zero + 1.5 * iqrZero;
    } else {
        console.warn("Not enough weekly data to perform robust outlier detection for zero attendance. Using all data for this metric.");
    }


    const nonOutlierWeeksData = [];
    let totalPeopleSum = 0;
    let allIndividualPreferences = [];
    const csvAttendanceDistributionSums = Array(6).fill(0);
    let csvTotalEmployeeWeeks = 0;

    for (const weekKey in weeklyData) {
      const week = weeklyData[weekKey];
      let isOutlier = false;
      let outlierReason = [];

      if (weeklyTotals.length >= minWeeksForOutlierDetection && week.totalPeopleThisWeek < lowerBoundTotalAttendance) {
        isOutlier = true;
        outlierReason.push("Low total attendance");
      }
      if (weeklyZeroAttendanceCounts.length >= minWeeksForOutlierDetection && week.attendanceDistribution[0] > upperBoundZeroAttendance) {
        isOutlier = true;
        outlierReason.push("High zero attendance");
      }
      
      if (isOutlier) {
        console.log(`Excluding outlier week: ${weekKey} (Total people: ${week.totalPeopleThisWeek}, Zero attendance: ${week.attendanceDistribution[0]}). Reason: ${outlierReason.join(', ')}`);
        currentExcludedWeeks.push(`${weekKey} (Reason: ${outlierReason.join('; ')})`);
      } else {
        nonOutlierWeeksData.push(week);
        totalPeopleSum += week.totalPeopleThisWeek;
        csvTotalEmployeeWeeks += week.totalPeopleThisWeek;

        for (let days = 0; days <= 5; days++) {
          for (let i = 0; i < week.attendanceDistribution[days]; i++) {
            allIndividualPreferences.push(days);
          }
          csvAttendanceDistributionSums[days] += week.attendanceDistribution[days];
        }
      }
    }

    if (nonOutlierWeeksData.length === 0) {
      alert("No valid (non-outlier) weekly data found after processing.");
      setCsvEmpiricalPreferences(null); // Clear any previous empirical preferences
      setExcludedWeeksLog([]); // Clear excluded weeks log
       // Ensure "Imported CSV Data" entry reflects no data if all weeks are outliers
      const noCsvDataEntry = {
        "Imported CSV Data": {
          overallAverage: null,
          dailyAverages: null,
          attendanceDistribution: Array(6).fill(0) // Show all zeros
        }
      };
      setModeledResults(prev => ({ ...prev, ...noCsvDataEntry }));
      setEmpiricalResults(prev => ({ ...prev, ...noCsvDataEntry }));
      return;
    }

    // --- Estimate Parameters from Non-Outlier Data ---
    const estimatedNumEmployees = Math.round(totalPeopleSum / nonOutlierWeeksData.length);
    const estimatedMeanPreference = allIndividualPreferences.length > 0 ? allIndividualPreferences.reduce((sum, val) => sum + val, 0) / allIndividualPreferences.length : 0;
    
    let variance = 0;
    if (allIndividualPreferences.length > 0) {
      const mean = estimatedMeanPreference; // Use the calculated mean
      variance = allIndividualPreferences.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allIndividualPreferences.length;
    }
    const estimatedStdDevPreference = Math.sqrt(variance);

    const csvAverageAttendanceDistribution = csvTotalEmployeeWeeks > 0 ? csvAttendanceDistributionSums.map(sum => (sum / csvTotalEmployeeWeeks) * 100) : Array(6).fill(0);

    const finalNumEmployees = estimatedNumEmployees > 0 ? estimatedNumEmployees : 100;
    const finalMeanPreference = !isNaN(estimatedMeanPreference) && estimatedMeanPreference >= 0 && estimatedMeanPreference <= 5 ? parseFloat(estimatedMeanPreference.toFixed(1)) : 3;
    const finalStdDevPreference = !isNaN(estimatedStdDevPreference) && estimatedStdDevPreference > 0 ? parseFloat(estimatedStdDevPreference.toFixed(1)) : 0.8;


    setNumEmployees(finalNumEmployees);
    setMeanPreference(finalMeanPreference);
    setStdDevPreference(finalStdDevPreference);
    setCsvEmpiricalPreferences(allIndividualPreferences.length > 0 ? allIndividualPreferences : null);
    setExcludedWeeksLog(currentExcludedWeeks);

    const csvResultEntry = {
      "Imported CSV Data": {
        overallAverage: null,
        dailyAverages: null,
        attendanceDistribution: csvAverageAttendanceDistribution
      }
    };
    setModeledResults(prev => ({ ...prev, ...csvResultEntry }));
    setEmpiricalResults(prev => ({ ...prev, ...csvResultEntry }));
    setCurrentViewMode('empirical');

    alert(`Parameters estimated from CSV and applied.\nEmployees: ${finalNumEmployees}\nAvg. Preferred Days: ${finalMeanPreference.toFixed(1)}\nStd Dev: ${finalStdDevPreference.toFixed(1)}\nSimulations will now run with both 'Modeled' and 'Empirical' (from CSV) preference views.${currentExcludedWeeks.length > 0 ? `\nExcluded weeks: ${currentExcludedWeeks.join(', ')}` : ''}`);
  };

  const handleGetLlmInsights = useCallback(() => {
    fetchLlmInsightsData({
      numEmployees,
      deskRatio,
      meanPreference,
      stdDevPreference,
      dayWeights,
      numSimulations,
       results: resultsToDisplay
    });

  }, [fetchLlmInsightsData, numEmployees, deskRatio, meanPreference, stdDevPreference, dayWeights, numSimulations, resultsToDisplay]);


  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans flex flex-col items-center">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-6xl">
        <h1 className="text-4xl font-bold text-indigo-700 mb-10 pb-6 text-center border-b-2 border-indigo-100">Office Seat Utilization Simulator</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
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
              onDataImported={processImportedData}
              runAllSimulations={runAllSimulations}
              isLoading={isLoading}
            />
          </div>

          <div className="lg:col-span-2">
            <ResultsDisplayPanel
              results={resultsToDisplay}
              isLoading={isLoading}
              currentViewMode={currentViewMode}
              setCurrentViewMode={setCurrentViewMode}
              showToggle={!!csvEmpiricalPreferences}
              excludedWeeksLog={excludedWeeksLog}
              numSimulations={numSimulations}
              numEmployees={numEmployees}
              deskRatio={deskRatio}
            />
          </div>

          <div className="lg:col-span-3">
            <LlmInsightsPanel
              results={resultsToDisplay}
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