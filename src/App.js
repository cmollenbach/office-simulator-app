// src/App.js
import React, { useState, useCallback, useEffect, useRef } from 'react';

import {
  generateNormalRandom,
  DAYS_IN_WORK_WEEK,
  SCENARIO_NAMES,
  SCENARIO_RULES
} from './simulationUtils'; // cmollenbach/office-simulator-app/office-simulator-app-3dcf7f354f7e30b9980f5170ed854316c41c8c9c/src/simulationUtils.js

import ParameterInputPanel from './ParameterInputPanel'; // cmollenbach/office-simulator-app/office-simulator-app-3dcf7f354f7e30b9980f5170ed854316c41c8c9c/src/ParameterInputPanel.js
import ResultsDisplayPanel from './ResultsDisplayPanel'; // cmollenbach/office-simulator-app/office-simulator-app-3dcf7f354f7e30b9980f5170ed854316c41c8c9c/src/ResultsDisplayPanel.js
import useLlmInsights from './useLlmInsights'; // cmollenbach/office-simulator-app/office-simulator-app-3dcf7f354f7e30b9980f5170ed854316c41c8c9c/src/useLlmInsights.js
import 'tippy.js/dist/tippy.css';

const App = () => {
  const [numEmployees, setNumEmployees] = useState(100);
  const [deskRatio, setDeskRatio] = useState(0.45);
  const [meanPreference, setMeanPreference] = useState(3);
  const [stdDevPreference, setStdDevPreference] = useState(1.5);
  const [numSimulations, setNumSimulations] = useState(10000);
  const [dayWeights, setDayWeights] = useState([0.9, 1.1, 1.1, 1.1, 0.8]);
  const [baselineAbsenceRate, setBaselineAbsenceRate] = useState(0.1); // New state, default 5%
  const [csvEmpiricalPreferences, setCsvEmpiricalPreferences] = useState(null);
  const [excludedWeeksLog, setExcludedWeeksLog] = useState([]);

  const [empiricalResults, setEmpiricalResults] = useState({});
  const [modeledResults, setModeledResults] = useState({});
  const [currentViewMode, setCurrentViewMode] = useState('modeled');
  const [activeTab, setActiveTab] = useState('simulation');
  const [isLoading, setIsLoading] = useState(false);
  const [_scenarioProgress, setScenarioProgress] = useState({});
  const [overallProgress, setOverallProgress] = useState(0);

  const workerRef = useRef(null);
  const pendingJobsRef = useRef(0);
  const currentModeledResultsRef = useRef({});
  const currentEmpiricalResultsRef = useRef({});
  const insightsRefreshPendingRef = useRef(false);

  const runSimulationsWithPreferences = useCallback((workerId, preferencesToUse, numActiveSimEmployees, availableSeats) => {
    if (!workerRef.current) {
      console.warn("Worker not initialized in runSimulationsWithPreferences for workerId:", workerId);
      setIsLoading(false);
      return;
    }

    if (workerId === 'modeled') {
        currentModeledResultsRef.current = currentModeledResultsRef.current["Imported CSV Data"]
        ? { "Imported CSV Data": currentModeledResultsRef.current["Imported CSV Data"] }
        : {};
    } else if (workerId === 'empirical') {
        currentEmpiricalResultsRef.current = currentEmpiricalResultsRef.current["Imported CSV Data"]
        ? { "Imported CSV Data": currentEmpiricalResultsRef.current["Imported CSV Data"] }
        : {};
    }

    for (const scenarioName of SCENARIO_NAMES) {
      workerRef.current.postMessage({
        workerId,
        scenarioName,
        numEmployees: numActiveSimEmployees, // Use active employees for simulation
        numTotalEmployees: numEmployees, // Pass total for context if needed by worker for specific metrics
        availableSeats,
        employeePreferences: preferencesToUse,
        numSimulationsConfig: numSimulations,
        customDayWeights: dayWeights,
        scenarioRules: SCENARIO_RULES,
        baselineAbsenceRate: baselineAbsenceRate, // Pass the rate to the worker
      });
    }
  }, [numEmployees, numSimulations, dayWeights, baselineAbsenceRate]); // Added baselineAbsenceRate

  useEffect(() => {
    const newWorker = new Worker(process.env.PUBLIC_URL + '/simulation.worker.js');
    workerRef.current = newWorker;

    newWorker.onmessage = (event) => {
      const { type, workerId, scenarioName, results, progress, error } = event.data;

      if (type === 'progress') {
        // ... (progress logic largely unchanged, ensure it accounts for batches correctly)
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
              newOverallProgress = (100 / numTotalBatches) + (currentBatchAverageProgress / numTotalBatches);
            }
            setOverallProgress(Math.min(100, Math.round(newOverallProgress)));
          }
          return updated;
        });
      } else if (type === 'result') {
         setScenarioProgress(prevScenarioProgress => {
          const updated = { ...prevScenarioProgress, [scenarioName]: 100 };
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
          const numActiveEmployeesForSim = Math.round(numEmployees * (1 - baselineAbsenceRate));
          if (workerId === 'modeled') {
            setModeledResults({ ...currentModeledResultsRef.current });
            if (csvEmpiricalPreferences && csvEmpiricalPreferences.length > 0) {
              const availableSeats = Math.round(numEmployees * deskRatio);
              // Ensure empirical preferences are sampled for the *active* number of employees
              const empiricalEmployeePreferencesForWorker = Array.from(
                { length: numActiveEmployeesForSim }, // Use active employees
                () => csvEmpiricalPreferences[Math.floor(Math.random() * csvEmpiricalPreferences.length)]
              );
              
              currentEmpiricalResultsRef.current = currentEmpiricalResultsRef.current["Imported CSV Data"]
                ? { "Imported CSV Data": currentEmpiricalResultsRef.current["Imported CSV Data"] }
                : {};
              
              const initialEmpiricalProgress = SCENARIO_NAMES.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
              setScenarioProgress(initialEmpiricalProgress);
               // Overall progress reset handled by the first progress event of the new batch

              pendingJobsRef.current = SCENARIO_NAMES.length;
              runSimulationsWithPreferences('empirical', empiricalEmployeePreferencesForWorker, numActiveEmployeesForSim, availableSeats);
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
        setOverallProgress(0);
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
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [csvEmpiricalPreferences, numEmployees, deskRatio, runSimulationsWithPreferences, baselineAbsenceRate]); // Added baselineAbsenceRate dependency

  const { llmInsights, isLoadingLlm, fetchLlmInsightsData, clearLlmInsights } = useLlmInsights();

  const handleGetLlmInsights = useCallback(() => {
    fetchLlmInsightsData({
      numEmployees, // This should be the total employees for context
      deskRatio,
      meanPreference, // This preference is for the active set
      stdDevPreference, // This preference is for the active set
      dayWeights,
      numSimulations,
      baselineAbsenceRate, // Add new rate
      modeledResults,
      empiricalResults: (csvEmpiricalPreferences && Object.keys(empiricalResults).length > 0) ? empiricalResults : null,
      csvAvailable: !!csvEmpiricalPreferences
    });
  }, [fetchLlmInsightsData, numEmployees, deskRatio, meanPreference, stdDevPreference, dayWeights, numSimulations, baselineAbsenceRate, modeledResults, empiricalResults, csvEmpiricalPreferences]);

  useEffect(() => {
    if (!isLoading && activeTab === 'insights' && insightsRefreshPendingRef.current) {
      const hasModeledData = modeledResults && Object.keys(modeledResults).filter(key => key !== "Imported CSV Data").length > 0;
      const hasEmpiricalData = empiricalResults && Object.keys(empiricalResults).filter(key => key !== "Imported CSV Data").length > 0;

      if (hasModeledData || hasEmpiricalData) {
        handleGetLlmInsights();
      }
      insightsRefreshPendingRef.current = false;
    }
  }, [isLoading, activeTab, modeledResults, empiricalResults, handleGetLlmInsights]);

  useEffect(() => {
    if (activeTab !== 'insights') insightsRefreshPendingRef.current = false;
  }, [activeTab]);

  const resultsToDisplayForSimulationTab = currentViewMode === 'empirical' && Object.keys(empiricalResults).length > 0
    ? empiricalResults
    : modeledResults;

  const runAllSimulations = useCallback(() => {
    if (!workerRef.current) {
      alert("Simulation worker is not ready. Please try again in a moment.");
      return;
    }
    setIsLoading(true);
    if (clearLlmInsights) clearLlmInsights();
    insightsRefreshPendingRef.current = true;
    
    const initialModeledProgress = SCENARIO_NAMES.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
    setScenarioProgress(initialModeledProgress);
    setOverallProgress(0);

    pendingJobsRef.current = SCENARIO_NAMES.length;

    const availableSeats = Math.round(numEmployees * deskRatio);
    const numActiveEmployeesForSim = Math.round(numEmployees * (1 - baselineAbsenceRate));

    const initialModeled = currentModeledResultsRef.current["Imported CSV Data"]
        ? { "Imported CSV Data": currentModeledResultsRef.current["Imported CSV Data"] }
        : {};
    const initialEmpirical = currentEmpiricalResultsRef.current["Imported CSV Data"]
        ? { "Imported CSV Data": currentEmpiricalResultsRef.current["Imported CSV Data"] }
        : {};
    setModeledResults(initialModeled);
    setEmpiricalResults(initialEmpirical);

    // Generate preferences for the active number of employees
    const modeledEmployeePreferences = Array.from({ length: numActiveEmployeesForSim }, () => {
      return Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(generateNormalRandom(meanPreference, stdDevPreference))));
    });
    
    runSimulationsWithPreferences('modeled', modeledEmployeePreferences, numActiveEmployeesForSim, availableSeats);
    setCurrentViewMode('modeled');
  }, [
      numEmployees,
      deskRatio,
      meanPreference,
      stdDevPreference,
      baselineAbsenceRate, // Add new rate
      runSimulationsWithPreferences,
      clearLlmInsights
    ]);


  const processImportedData = (csvData) => {
    if (!csvData || csvData.length === 0) {
      alert("No data found in CSV or CSV is empty.");
      return;
    }

    // ... (existing weeklyData aggregation) ...
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
    // ... (existing outlier detection - this might need review in context of baselineAbsenceRate) ...
    // For simplicity, the baselineAbsenceRate primarily affects the interpretation of mean/stdDev preference
    // rather than directly altering the raw CSV sum for "Imported CSV Data" display.
    // The simulation's empirical run will use preferences from employees *not* part of the baseline absence.

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
    }

    const weeklyZeroAttendanceCounts = Object.values(weeklyData).map(week => week.attendanceDistribution[0]);
    if (weeklyZeroAttendanceCounts.length >= minWeeksForOutlierDetection) {
        const sortedZeroCounts = [...weeklyZeroAttendanceCounts].sort((a, b) => a - b);
        const q1Zero = sortedZeroCounts[Math.floor(sortedZeroCounts.length / 4)];
        const q3Zero = sortedZeroCounts[Math.floor(sortedZeroCounts.length * 3 / 4)];
        const iqrZero = q3Zero - q1Zero;
        upperBoundZeroAttendance = q3Zero + 1.5 * iqrZero;
    }
    
    const nonOutlierWeeksData = [];
    let totalPeopleSum = 0;
    let allIndividualPreferencesFromCsvActive = []; // For active employees
    const csvAttendanceDistributionSums = Array(DAYS_IN_WORK_WEEK + 1).fill(0); // Raw distribution sum
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
        currentExcludedWeeks.push(`${weekKey} (Reason: ${outlierReason.join('; ')})`);
      } else {
        nonOutlierWeeksData.push(week);
        totalPeopleSum += week.totalPeopleThisWeek;
        csvTotalEmployeeWeeks += week.totalPeopleThisWeek;

        // Store raw distribution for the "Imported CSV Data" display
        for (let days = 0; days <= DAYS_IN_WORK_WEEK; days++) {
          csvAttendanceDistributionSums[days] += week.attendanceDistribution[days];
        }
        
        // Create preference list for *active* employees from this week's data.
        // Account for baselineAbsenceRate by primarily removing from the 0-day bucket.
        const numBaselineAbsentThisWeek = Math.round(week.totalPeopleThisWeek * baselineAbsenceRate);
        let remainingBaselineAbsentToAccountFor = numBaselineAbsentThisWeek;

        for (let days = 0; days <= DAYS_IN_WORK_WEEK; days++) {
            let countForThisBucket = week.attendanceDistribution[days];
            let chosenCountForThisBucket = 0;

            if (days === 0) {
                // Of those who attended 0 days, how many were baseline absent vs. chose 0?
                const baselineAbsentFromThisBucket = Math.min(countForThisBucket, remainingBaselineAbsentToAccountFor);
                chosenCountForThisBucket = countForThisBucket - baselineAbsentFromThisBucket;
                remainingBaselineAbsentToAccountFor -= baselineAbsentFromThisBucket;
            } else {
                // For days > 0, assume all are choices by active employees.
                chosenCountForThisBucket = countForThisBucket;
            }

            for (let i = 0; i < chosenCountForThisBucket; i++) {
                allIndividualPreferencesFromCsvActive.push(days);
            }
        }
      }
    }

    if (nonOutlierWeeksData.length === 0) { // Check if any valid weeks remain
      alert("No valid (non-outlier) weekly data found after processing.");
      setCsvEmpiricalPreferences(null);
      setExcludedWeeksLog([]);
      const noCsvDataEntry = {
        "Imported CSV Data": {
          overallAverage: null, dailyAverages: null, averagePreferenceDeviation: null,
          attendanceDistribution: Array(DAYS_IN_WORK_WEEK + 1).fill(0)
        }
      };
      setModeledResults(prev => ({ ...prev, ...noCsvDataEntry }));
      setEmpiricalResults(prev => ({ ...prev, ...noCsvDataEntry }));
      return;
    }

    // Update numEmployees based on average from CSV
    const averagePeoplePerWeek = nonOutlierWeeksData.length > 0 ? totalPeopleSum / nonOutlierWeeksData.length : numEmployees;
    const newNumEmployees = Math.round(averagePeoplePerWeek);
    if (newNumEmployees > 0) {
        setNumEmployees(newNumEmployees);
    }

    if (allIndividualPreferencesFromCsvActive.length === 0) {
      alert("No active employee preferences could be derived from the CSV data (e.g., all attendance was attributed to baseline absence). Parameters not updated.");
      // Potentially reset CSV related states or show the raw distribution only
      const csvResultEntryOnlyRaw = {
        "Imported CSV Data": {
          overallAverage: null, dailyAverages: null, averagePreferenceDeviation: null,
          attendanceDistribution: csvTotalEmployeeWeeks > 0
            ? csvAttendanceDistributionSums.map(sum => (sum / csvTotalEmployeeWeeks) * 100)
            : Array(DAYS_IN_WORK_WEEK + 1).fill(0)
        }
      };
      setModeledResults(prev => ({ ...prev, ...csvResultEntryOnlyRaw }));
      setEmpiricalResults(prev => ({ ...prev, ...csvResultEntryOnlyRaw }));
      setCsvEmpiricalPreferences(null); // No preferences for empirical run
      setExcludedWeeksLog(currentExcludedWeeks);
      return;
    }
    
    // Calculate overall CSV distribution (raw, for display)
    const csvOverallAverageAttendanceDistribution = csvTotalEmployeeWeeks > 0
      ? csvAttendanceDistributionSums.map(sum => (sum / csvTotalEmployeeWeeks) * 100)
      : Array(DAYS_IN_WORK_WEEK + 1).fill(0);

    // Parameters estimated from the *active* CSV preferences
    const estimatedMeanPreferenceActive = allIndividualPreferencesFromCsvActive.reduce((sum, val) => sum + val, 0) / allIndividualPreferencesFromCsvActive.length;
    let varianceActive = 0;
    const meanActive = estimatedMeanPreferenceActive; // Use this for clarity
    varianceActive = allIndividualPreferencesFromCsvActive.reduce((sum, val) => sum + Math.pow(val - meanActive, 2), 0) / allIndividualPreferencesFromCsvActive.length;
    const estimatedStdDevPreferenceActive = Math.sqrt(varianceActive);

    // Update global parameters based on the active set's preferences
    setMeanPreference(!isNaN(meanActive) && meanActive >= 0 && meanActive <= DAYS_IN_WORK_WEEK ? parseFloat(meanActive.toFixed(1)) : 3);
    setStdDevPreference(!isNaN(estimatedStdDevPreferenceActive) && estimatedStdDevPreferenceActive > 0 ? parseFloat(estimatedStdDevPreferenceActive.toFixed(1)) : 0.8);
    
    setCsvEmpiricalPreferences(allIndividualPreferencesFromCsvActive); // This list is for active employees
    setExcludedWeeksLog(currentExcludedWeeks);

    const csvResultEntry = {
      "Imported CSV Data": {
        overallAverage: null, dailyAverages: null, averagePreferenceDeviation: null,
        attendanceDistribution: csvOverallAverageAttendanceDistribution // Display raw historical distribution
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
    let alertMessage = `CSV data processed. Parameters updated based on the active workforce derived from the CSV (after ${(baselineAbsenceRate*100).toFixed(1)}% baseline absence rate considered):
- Number of Employees (avg. from CSV): ${newNumEmployees}
- Avg. Preferred Days (for active staff): ${(!isNaN(meanActive) && meanActive >= 0 && meanActive <= DAYS_IN_WORK_WEEK ? parseFloat(meanActive.toFixed(1)) : 'N/A')}
- Std Dev of Preference (for active staff): ${(!isNaN(estimatedStdDevPreferenceActive) && estimatedStdDevPreferenceActive > 0 ? parseFloat(estimatedStdDevPreferenceActive.toFixed(1)) : 'N/A')}
Simulations will now run with both 'Modeled' and 'Empirical' (from CSV) preference views.`;
    if (currentExcludedWeeks.length > 0) {
      alertMessage += `\n\nExcluded outlier weeks: ${currentExcludedWeeks.join('; ')}`;
    }
    if (activeTab === 'insights') setActiveTab('simulation');
    alert(alertMessage);
  };


  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans flex flex-col items-center">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-6xl">
        <h1 className="text-4xl font-bold text-indigo-700 mb-10 pb-6 text-center border-b-2 border-indigo-100">Office Seat Utilization Simulator</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-1">
            <ParameterInputPanel
              numEmployees={numEmployees} // This will now reflect CSV update if any
              setNumEmployees={setNumEmployees}
              deskRatio={deskRatio}
              setDeskRatio={setDeskRatio}
              baselineAbsenceRate={baselineAbsenceRate}
              setBaselineAbsenceRate={setBaselineAbsenceRate}
              meanPreference={meanPreference} // This will reflect CSV update if any
              setMeanPreference={setMeanPreference}
              stdDevPreference={stdDevPreference} // This will reflect CSV update if any
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
              numEmployees={numEmployees} // Pass total for display, reflects CSV update
              deskRatio={deskRatio}
              getLlmInsights={handleGetLlmInsights}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isLoadingLlm={isLoadingLlm}
              _scenarioProgress={_scenarioProgress}
              overallProgress={overallProgress}
              llmInsights={llmInsights}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;