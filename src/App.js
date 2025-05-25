// src/App.js
import React, { useState, useCallback, useEffect, useRef } from 'react';

// CORRECTED IMPORT STATEMENT
import {
  generateNormalRandom,
  DAYS_IN_WORK_WEEK,
  SCENARIO_NAMES,
  SCENARIO_RULES // Ensure this is exported from simulationUtils.js
} from './simulationUtils';

import ParameterInputPanel from './ParameterInputPanel';
import ResultsDisplayPanel from './ResultsDisplayPanel';
// LlmInsightsPanel is no longer directly rendered here
import useLlmInsights from './useLlmInsights';
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
  const [activeTab, setActiveTab] = useState('simulation'); // Lifted from ResultsDisplayPanel
  // State to manage loading indicator for simulation
  const [isLoading, setIsLoading] = useState(false);
  const [_scenarioProgress, setScenarioProgress] = useState({}); // Prefixed to satisfy ESLint, as it's used in setScenarioProgress(prev => ...)
  const [overallProgress, setOverallProgress] = useState(0);    // Overall progress for current batch

  // Worker related state and refs
  const workerRef = useRef(null);
  const pendingJobsRef = useRef(0);
  const currentModeledResultsRef = useRef({});
  const currentEmpiricalResultsRef = useRef({});
  const insightsRefreshPendingRef = useRef(false); // To signal a refresh is needed

  // Helper function to dispatch jobs to the worker
  // Wrapped in useCallback to stabilize its reference if other dependencies are stable
  const runSimulationsWithPreferences = useCallback((workerId, preferencesToUse, availableSeats) => {
    if (!workerRef.current) {
      console.log("App.js: runSimulationsWithPreferences - workerRef is null or not initialized. WorkerId:", workerId);
      console.warn("Worker not initialized in runSimulationsWithPreferences for workerId:", workerId, "Might be during cleanup.");
      setIsLoading(false); // Ensure loading state is handled
      return;
    }

    // pendingJobsRef.current is now set *before* calling this function for a new batch

    if (workerId === 'modeled') {
        currentModeledResultsRef.current = currentModeledResultsRef.current["Imported CSV Data"] // Preserve existing CSV data if any
        ? { "Imported CSV Data": currentModeledResultsRef.current["Imported CSV Data"] }
        : {};
    } else if (workerId === 'empirical') {
        currentEmpiricalResultsRef.current = currentEmpiricalResultsRef.current["Imported CSV Data"] // Preserve existing CSV data
        ? { "Imported CSV Data": currentEmpiricalResultsRef.current["Imported CSV Data"] }
        : {};
    }

    for (const scenarioName of SCENARIO_NAMES) {
      console.log(`App.js: Posting job to worker for scenario: ${scenarioName}, workerId: ${workerId}`);
      workerRef.current.postMessage({
        workerId,
        scenarioName,
        numEmployees,
        availableSeats,
        employeePreferences: preferencesToUse,
        numSimulationsConfig: numSimulations, // Ensure this matches worker's expectation
        customDayWeights: dayWeights,
        scenarioRules: SCENARIO_RULES
      });
    }
  }, [numEmployees, numSimulations, dayWeights]); // Removed modeledResults, empiricalResults


  // Effect to initialize and manage the Web Worker
  useEffect(() => {
    console.log("App.js: Worker useEffect - Setting up new worker. Dependencies changed or initial setup.");
    const newWorker = new Worker(process.env.PUBLIC_URL + '/simulation.worker.js');
    workerRef.current = newWorker;

    newWorker.onmessage = (event) => {
      const { type, workerId, scenarioName, results, progress, error } = event.data;

      if (type === 'progress') {
        setScenarioProgress(prev => {
          const updated = { ...prev, [scenarioName]: progress };
          const totalScenariosInBatch = SCENARIO_NAMES.length;
          if (totalScenariosInBatch > 0) {
            const currentProgressSum = Object.values(updated).reduce((sum, p) => sum + p, 0);
            const currentBatchAverageProgress = currentProgressSum / totalScenariosInBatch;

            const willRunEmpirical = csvEmpiricalPreferences && csvEmpiricalPreferences.length > 0;
            const numTotalBatches = willRunEmpirical ? 2 : 1;

            let newOverallProgress = 0;
            if (workerId === 'modeled') {
              newOverallProgress = currentBatchAverageProgress / numTotalBatches;
            } else if (workerId === 'empirical') {
              // Modeled part is 100% / numTotalBatches (e.g., 50% if 2 batches)
              newOverallProgress = (100 / numTotalBatches) + (currentBatchAverageProgress / numTotalBatches);
            }
            setOverallProgress(Math.min(100, Math.round(newOverallProgress)));
          }
          return updated;
        });
      } else if (type === 'result') {
        console.log(`App.js: Worker result received for ${scenarioName} (${workerId}). Pending jobs before: ${pendingJobsRef.current}`);
        setScenarioProgress(prevScenarioProgress => { // Use a different name for prev state to avoid conflict
          const updated = { ...prevScenarioProgress, [scenarioName]: 100 }; // Mark as 100% done
          const totalScenariosInBatch = SCENARIO_NAMES.length;
           if (totalScenariosInBatch > 0) {
            // Recalculate overall progress based on this scenario finishing
            // This logic is now similar to the 'progress' type, ensuring 100% for this scenario
            const currentProgressSum = Object.values(updated).reduce((sum, p) => sum + p, 0);
            const currentBatchAverageProgress = currentProgressSum / totalScenariosInBatch;

            const willRunEmpirical = csvEmpiricalPreferences && csvEmpiricalPreferences.length > 0;
            const numTotalBatches = willRunEmpirical ? 2 : 1;

            let newOverallProgress = 0;
            if (workerId === 'modeled') {
              newOverallProgress = currentBatchAverageProgress / numTotalBatches;
            } else if (workerId === 'empirical') {
              newOverallProgress = (100 / numTotalBatches) + (currentBatchAverageProgress / numTotalBatches);
            }
            setOverallProgress(Math.min(100, Math.round(newOverallProgress)));
          }
          return updated;
        });

        if (workerId === 'modeled') {
          currentModeledResultsRef.current[scenarioName] = results;
        } else if (workerId === 'empirical') {
          currentEmpiricalResultsRef.current[scenarioName] = results;
        }

        pendingJobsRef.current -= 1;
        if (pendingJobsRef.current === 0) {
          // All jobs for the current workerId batch are done
          console.log(`App.js: All jobs completed for workerId: ${workerId}`);
          if (workerId === 'modeled') {
            setModeledResults({ ...currentModeledResultsRef.current });
            if (csvEmpiricalPreferences && csvEmpiricalPreferences.length > 0) {
              const availableSeats = Math.round(numEmployees * deskRatio);
              const empiricalEmployeePreferencesForWorker = Array.from(
                { length: numEmployees },
                () => csvEmpiricalPreferences[Math.floor(Math.random() * csvEmpiricalPreferences.length)]
              );
              
              currentEmpiricalResultsRef.current = currentEmpiricalResultsRef.current["Imported CSV Data"]
                ? { "Imported CSV Data": currentEmpiricalResultsRef.current["Imported CSV Data"] }
                : {};
              
              // Reset progress for the empirical batch
              const initialEmpiricalProgress = SCENARIO_NAMES.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
              setScenarioProgress(initialEmpiricalProgress);
              setOverallProgress(0);

              console.log("App.js: Chaining to empirical simulation.");
              pendingJobsRef.current = SCENARIO_NAMES.length;
              runSimulationsWithPreferences('empirical', empiricalEmployeePreferencesForWorker, availableSeats);
              setCurrentViewMode('empirical');
            } else {
              setCurrentViewMode('modeled');
              setIsLoading(false);
            }
          } else if (workerId === 'empirical') {
            setEmpiricalResults({ ...currentEmpiricalResultsRef.current });
            setIsLoading(false);
            setCurrentViewMode('empirical');
          }
        }
      } else if (type === 'error') {
        console.error(`App.js: Error from worker for ${scenarioName} (${workerId}):`, error.message, error.stack);
        // Potentially set progress to an error state or 0
        setOverallProgress(0); // Or some error indication
        // Decrement pending jobs if an error occurs for one job,
        // to prevent getting stuck if other jobs complete.
        pendingJobsRef.current -=1;
        if (pendingJobsRef.current === 0) setIsLoading(false);
      }
    };

    newWorker.onerror = (errorEvent) => {
      console.error("App.js: Critical Worker error:", errorEvent.message, errorEvent);
      pendingJobsRef.current = 0;
      setIsLoading(false);
      alert("A simulation worker error occurred. Please check the console and try again.");
    };

    return () => {
      console.log("App.js: Worker useEffect - Terminating old worker.");
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvEmpiricalPreferences, numEmployees, deskRatio, runSimulationsWithPreferences]); // Added runSimulationsWithPreferences

  const { llmInsights, isLoadingLlm, fetchLlmInsightsData, clearLlmInsights } = useLlmInsights();

  const handleGetLlmInsights = useCallback(() => {
    fetchLlmInsightsData({
      numEmployees,
      deskRatio,
      meanPreference,
      stdDevPreference,
      dayWeights,
      numSimulations,
      modeledResults,
      empiricalResults: (csvEmpiricalPreferences && Object.keys(empiricalResults).length > 0) ? empiricalResults : null,
      csvAvailable: !!csvEmpiricalPreferences
    });
  }, [fetchLlmInsightsData, numEmployees, deskRatio, meanPreference, stdDevPreference, dayWeights, numSimulations, modeledResults, empiricalResults, csvEmpiricalPreferences]);


  // Effect to automatically refresh insights after a simulation completes if on the insights tab
  useEffect(() => {
    if (!isLoading && activeTab === 'insights' && insightsRefreshPendingRef.current) {
      const hasModeledData = modeledResults && Object.keys(modeledResults).filter(key => key !== "Imported CSV Data").length > 0;
      const hasEmpiricalData = empiricalResults && Object.keys(empiricalResults).filter(key => key !== "Imported CSV Data").length > 0;

      if (hasModeledData || hasEmpiricalData) {
        // console.log("App.js useEffect triggering insights refresh after simulation.");
        handleGetLlmInsights();
      }
      insightsRefreshPendingRef.current = false; // Reset the flag
    }
  }, [isLoading, activeTab, modeledResults, empiricalResults, handleGetLlmInsights]); // handleGetLlmInsights is a dependency

  // Effect to clear the refresh pending flag if the user navigates away from insights tab
  useEffect(() => {
    if (activeTab !== 'insights') insightsRefreshPendingRef.current = false;
  }, [activeTab]);

  const resultsToDisplayForSimulationTab = currentViewMode === 'empirical' && Object.keys(empiricalResults).length > 0
    ? empiricalResults
    : modeledResults;

  const runAllSimulations = useCallback(() => {
    console.log("App.js: runAllSimulations called.");
    if (!workerRef.current) {
      alert("Simulation worker is not ready. Please try again in a moment.");
      console.error("App.js: runAllSimulations - workerRef is null. Cannot start simulation.");
      return;
    }
    setIsLoading(true);
    if (clearLlmInsights) clearLlmInsights();
    insightsRefreshPendingRef.current = true; // Signal that insights should be refreshed after this run
    
    // Reset progress for the modeled batch
    const initialModeledProgress = SCENARIO_NAMES.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
    setScenarioProgress(initialModeledProgress);
    setOverallProgress(0);

    // Set pending jobs for the initial modeled batch
    pendingJobsRef.current = SCENARIO_NAMES.length;

    const availableSeats = Math.round(numEmployees * deskRatio);
    // Preserve "Imported CSV Data" if it exists from a previous CSV import
    const initialModeled = currentModeledResultsRef.current["Imported CSV Data"]
        ? { "Imported CSV Data": currentModeledResultsRef.current["Imported CSV Data"] }
        : {};
    const initialEmpirical = currentEmpiricalResultsRef.current["Imported CSV Data"]
        ? { "Imported CSV Data": currentEmpiricalResultsRef.current["Imported CSV Data"] }
        : {};
    setModeledResults(initialModeled);
    setEmpiricalResults(initialEmpirical);

    const modeledEmployeePreferences = Array.from({ length: numEmployees }, () => {
      return Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(generateNormalRandom(meanPreference, stdDevPreference))));
    });
    console.log("App.js: runAllSimulations - Dispatching 'modeled' simulations.");
    runSimulationsWithPreferences('modeled', modeledEmployeePreferences, availableSeats);
    setCurrentViewMode('modeled');
  }, [
      numEmployees,
      deskRatio,
      meanPreference,
      stdDevPreference,
      runSimulationsWithPreferences,
      clearLlmInsights // Ensure clearLlmInsights is here
    ]);


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
    // If the user was on the insights tab, switch them to simulation results
    // as new data/parameters are now available.
    if (activeTab === 'insights') {
      setActiveTab('simulation');
    }
    alert(alertMessage);
  };

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
              results={resultsToDisplayForSimulationTab}
              modeledResults={modeledResults}      
              empiricalResults={empiricalResults}  
              csvEmpiricalPreferences={csvEmpiricalPreferences} 
              isLoading={isLoading}
              currentViewMode={currentViewMode}
              setCurrentViewMode={setCurrentViewMode}
              showToggle={!!csvEmpiricalPreferences}
              excludedWeeksLog={excludedWeeksLog}
              numSimulations={numSimulations}
              numEmployees={numEmployees}
              deskRatio={deskRatio}
              getLlmInsights={handleGetLlmInsights}
              activeTab={activeTab}         // Pass activeTab down
              setActiveTab={setActiveTab}     // Pass setActiveTab down
              isLoadingLlm={isLoadingLlm}
              _scenarioProgress={_scenarioProgress} // Pass down to mark as "used"
              overallProgress={overallProgress} // Pass overall progress
              llmInsights={llmInsights}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;