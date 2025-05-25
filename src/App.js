// src/App.js
import React, { useState, useCallback, useEffect, useRef } from 'react';

import {
  generateNormalRandom, // Still needed here to generate preferences before sending to worker
  DAYS_IN_WORK_WEEK,
  SCENARIO_NAMES,
  SCENARIO_RULES // Import the rules to pass to the worker
} from './simulationUtils';

import ParameterInputPanel from './ParameterInputPanel';
import ResultsDisplayPanel from './ResultsDisplayPanel';
import LlmInsightsPanel from './LlmInsightsPanel';
import useLlmInsights from './useLlmInsights'; // Corrected: This is where useLlmInsights is imported
import 'tippy.js/dist/tippy.css'; // Ensure Tippy CSS is imported

// Main App component
const App = () => {
  // Input state variables
  const [numEmployees, setNumEmployees] = useState(100);
  const [deskRatio, setDeskRatio] = useState(0.4);
  const [meanPreference, setMeanPreference] = useState(3);
  const [stdDevPreference, setStdDevPreference] = useState(1.5);
  const [numSimulations, setNumSimulations] = useState(10000);
  const [dayWeights, setDayWeights] = useState([1, 1, 1, 1, 1]);
  const [csvEmpiricalPreferences, setCsvEmpiricalPreferences] = useState(null);
  const [excludedWeeksLog, setExcludedWeeksLog] = useState([]);

  // State to store simulation results for both views
  const [empiricalResults, setEmpiricalResults] = useState({});
  const [modeledResults, setModeledResults] = useState({});
  const [currentViewMode, setCurrentViewMode] = useState('modeled');
  // State to manage loading indicator for simulation
  const [isLoading, setIsLoading] = useState(false);

  // Custom hook for LLM insights
  const { llmInsights, isLoadingLlm, fetchLlmInsightsData, clearLlmInsights } = useLlmInsights(); // Destructure clearLlmInsights

  // Determine which results to display based on the current view mode
  const resultsToDisplay = currentViewMode === 'empirical' && Object.keys(empiricalResults).length > 0
    ? empiricalResults
    : modeledResults;

  // Worker related state and refs
  const workerRef = useRef(null);
  const pendingJobsRef = useRef(0);
  const currentModeledResultsRef = useRef({});
  const currentEmpiricalResultsRef = useRef({});

  // Effect to initialize and manage the Web Worker
  useEffect(() => {
    const newWorker = new Worker(process.env.PUBLIC_URL + '/simulation.worker.js');
    workerRef.current = newWorker;

    newWorker.onmessage = (event) => {
      const { workerId, scenarioName, results, error } = event.data;

      if (error) {
        console.error(`Error from worker for ${scenarioName} (${workerId}):`, error);
        // Optionally, set a user-facing error state here
      } else {
        if (workerId === 'modeled') {
          currentModeledResultsRef.current[scenarioName] = results;
        } else if (workerId === 'empirical') {
          currentEmpiricalResultsRef.current[scenarioName] = results;
        }
      }

      pendingJobsRef.current -= 1;
      if (pendingJobsRef.current === 0) {
        // All jobs for the current batch (modeled or empirical) are done
        if (workerId === 'modeled') {
          setModeledResults({ ...currentModeledResultsRef.current });
          if (csvEmpiricalPreferences && csvEmpiricalPreferences.length > 0) {
            // If CSV data exists, kick off empirical runs
            const availableSeats = Math.round(numEmployees * deskRatio);
            const empiricalEmployeePreferences = Array.from(
              { length: numEmployees },
              () => csvEmpiricalPreferences[Math.floor(Math.random() * csvEmpiricalPreferences.length)]
            );
            runSimulationsWithPreferences('empirical', empiricalEmployeePreferences, availableSeats);
            setCurrentViewMode('empirical'); // Switch view after empirical starts
            // setIsLoading is still true until empirical runs complete
          } else {
            setCurrentViewMode('modeled');
            setIsLoading(false); // All simulations done
          }
        } else if (workerId === 'empirical') {
          setEmpiricalResults({ ...currentEmpiricalResultsRef.current });
          setIsLoading(false); // All simulations done
          setCurrentViewMode('empirical');
        }
      }
    };

    newWorker.onerror = (errorEvent) => {
      console.error("Critical Worker error:", errorEvent.message, errorEvent);
      pendingJobsRef.current = 0;
      setIsLoading(false);
      alert("A simulation worker error occurred. Please check the console and try again.");
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  // Rerun effect if these change, as they influence how simulations are dispatched
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvEmpiricalPreferences, numEmployees, deskRatio]); // Dependencies for re-initializing or re-running logic related to worker


  // Helper function to dispatch jobs to the worker
  const runSimulationsWithPreferences = (workerId, preferencesToUse, availableSeats) => {
    if (!workerRef.current) {
      console.error("Worker not initialized in runSimulationsWithPreferences");
      setIsLoading(false);
      return;
    }

    pendingJobsRef.current = SCENARIO_NAMES.length;

    // Initialize/clear the correct results ref for the current batch
    if (workerId === 'modeled') {
      currentModeledResultsRef.current = modeledResults["Imported CSV Data"]
        ? { "Imported CSV Data": modeledResults["Imported CSV Data"] }
        : {};
    } else if (workerId === 'empirical') {
      currentEmpiricalResultsRef.current = empiricalResults["Imported CSV Data"]
        ? { "Imported CSV Data": empiricalResults["Imported CSV Data"] }
        : {};
    }


    for (const scenarioName of SCENARIO_NAMES) {
      workerRef.current.postMessage({
        workerId,
        scenarioName,
        numEmployees,
        availableSeats,
        employeePreferences: preferencesToUse,
        numSimulationsConfig: numSimulations,
        customDayWeights: dayWeights,
        scenarioRules: SCENARIO_RULES
      });
    }
  };

  // Main function to run all simulations
  const runAllSimulations = useCallback(() => {
    if (!workerRef.current) {
      alert("Simulation worker is not ready. Please try again in a moment.");
      return;
    }
    setIsLoading(true);
    clearLlmInsights(); // Use the function from the hook to clear insights

    const availableSeats = Math.round(numEmployees * deskRatio);

    // Preserve "Imported CSV Data" if it exists from previous CSV processing
    // This ensures it's not wiped out when new simulations run.
    const initialModeled = modeledResults["Imported CSV Data"]
        ? { "Imported CSV Data": modeledResults["Imported CSV Data"] }
        : {};
    const initialEmpirical = empiricalResults["Imported CSV Data"]
        ? { "Imported CSV Data": empiricalResults["Imported CSV Data"] }
        : {};

    // Set the state immediately to reflect the preserved CSV data (if any)
    // and clear out old scenario results.
    setModeledResults(initialModeled);
    setEmpiricalResults(initialEmpirical);

    // --- Run 1: Modeled Preferences (Normal Distribution) ---
    const modeledEmployeePreferences = Array.from({ length: numEmployees }, () => {
      return Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(generateNormalRandom(meanPreference, stdDevPreference))));
    });
    runSimulationsWithPreferences('modeled', modeledEmployeePreferences, availableSeats);
    setCurrentViewMode('modeled'); // Default to modeled view; will switch if empirical runs

    // Empirical runs are chained via the worker's onmessage handler
  }, [numEmployees, deskRatio, meanPreference, stdDevPreference, numSimulations, dayWeights, setIsLoading, clearLlmInsights, modeledResults, empiricalResults]); // Added clearLlmInsights to dependencies


  const processImportedData = (csvData) => {
    if (!csvData || csvData.length === 0) {
      alert("No data found in CSV or CSV is empty.");
      return;
    }

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
    let allIndividualPreferencesFromCsv = [];
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
            allIndividualPreferencesFromCsv.push(days);
          }
          csvAttendanceDistributionSums[days] += week.attendanceDistribution[days];
        }
      }
    }

    if (nonOutlierWeeksData.length === 0) {
      alert("No valid (non-outlier) weekly data found after processing.");
      setCsvEmpiricalPreferences(null);
      setExcludedWeeksLog([]);
      const noCsvDataEntry = {
        "Imported CSV Data": {
          overallAverage: null,
          dailyAverages: null,
          averagePreferenceDeviation: null,
          attendanceDistribution: Array(6).fill(0)
        }
      };
      setModeledResults(prev => ({ ...prev, ...noCsvDataEntry }));
      setEmpiricalResults(prev => ({ ...prev, ...noCsvDataEntry }));
      return;
    }

    const estimatedNumEmployees = Math.round(totalPeopleSum / nonOutlierWeeksData.length);
    const estimatedMeanPreference = allIndividualPreferencesFromCsv.length > 0 ? allIndividualPreferencesFromCsv.reduce((sum, val) => sum + val, 0) / allIndividualPreferencesFromCsv.length : 0;
    
    let variance = 0;
    if (allIndividualPreferencesFromCsv.length > 0) {
      const mean = estimatedMeanPreference;
      variance = allIndividualPreferencesFromCsv.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allIndividualPreferencesFromCsv.length;
    }
    const estimatedStdDevPreference = Math.sqrt(variance);

    const csvAverageAttendanceDistribution = csvTotalEmployeeWeeks > 0 ? csvAttendanceDistributionSums.map(sum => (sum / csvTotalEmployeeWeeks) * 100) : Array(6).fill(0);

    const finalNumEmployees = estimatedNumEmployees > 0 ? estimatedNumEmployees : 100;
    const finalMeanPreference = !isNaN(estimatedMeanPreference) && estimatedMeanPreference >= 0 && estimatedMeanPreference <= 5 ? parseFloat(estimatedMeanPreference.toFixed(1)) : 3;
    const finalStdDevPreference = !isNaN(estimatedStdDevPreference) && estimatedStdDevPreference > 0 ? parseFloat(estimatedStdDevPreference.toFixed(1)) : 0.8;

    setNumEmployees(finalNumEmployees);
    setMeanPreference(finalMeanPreference);
    setStdDevPreference(finalStdDevPreference);
    setCsvEmpiricalPreferences(allIndividualPreferencesFromCsv.length > 0 ? allIndividualPreferencesFromCsv : null);
    setExcludedWeeksLog(currentExcludedWeeks);

    const csvResultEntry = {
      "Imported CSV Data": {
        overallAverage: null,
        dailyAverages: null,
        averagePreferenceDeviation: null,
        attendanceDistribution: csvAverageAttendanceDistribution
      }
    };
    
    setModeledResults(prev => ({ ...prev, ...csvResultEntry }));
    setEmpiricalResults(prev => ({ ...prev, ...csvResultEntry }));
    // Also update the refs if they exist, to ensure consistency if a simulation is run immediately after
    if (currentModeledResultsRef.current) {
        currentModeledResultsRef.current = { ...currentModeledResultsRef.current, ...csvResultEntry };
    }
    if (currentEmpiricalResultsRef.current) {
        currentEmpiricalResultsRef.current = { ...currentEmpiricalResultsRef.current, ...csvResultEntry };
    }
    
    setCurrentViewMode('empirical');

    let alertMessage = `Parameters estimated from CSV and applied.\nEmployees: ${finalNumEmployees}\nAvg. Preferred Days: ${finalMeanPreference.toFixed(1)}\nStd Dev: ${finalStdDevPreference.toFixed(1)}\nSimulations will now run with both 'Modeled' and 'Empirical' (from CSV) preference views.`;
    if (currentExcludedWeeks.length > 0) {
      alertMessage += `\nExcluded weeks: ${currentExcludedWeeks.join('; ')}`;
    }
    alert(alertMessage);
  };


  const handleGetLlmInsights = useCallback(() => {
    const currentResults = currentViewMode === 'empirical' && Object.keys(empiricalResults).length > 0
      ? empiricalResults
      : modeledResults;

    fetchLlmInsightsData({
      numEmployees,
      deskRatio,
      meanPreference,
      stdDevPreference,
      dayWeights,
      numSimulations,
      results: currentResults // Pass the correctly determined resultsToDisplay
    });
  }, [fetchLlmInsightsData, numEmployees, deskRatio, meanPreference, stdDevPreference, dayWeights, numSimulations, currentViewMode, modeledResults, empiricalResults]);

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
