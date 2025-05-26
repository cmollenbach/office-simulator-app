// src/App.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx'; // Import xlsx library

import {
  generateNormalRandom,
  DAYS_IN_WORK_WEEK,
  SCENARIO_NAMES,
  SCENARIO_RULES
} from './simulationUtils';

import ParameterInputPanel from './ParameterInputPanel';
import ResultsDisplayPanel from './ResultsDisplayPanel';
import useLlmInsights from './useLlmInsights';
import 'tippy.js/dist/tippy.css';

const App = () => {
  const [numEmployees, setNumEmployees] = useState(100);
  const [deskRatio, setDeskRatio] = useState(0.45);
  const [meanPreference, setMeanPreference] = useState(3);
  const [stdDevPreference, setStdDevPreference] = useState(1.5);
  const [numSimulations, setNumSimulations] = useState(10000);
  const [dayWeights, setDayWeights] = useState([0.9, 1.1, 1.1, 1.1, 0.8]);
  const [baselineAbsenceRate, setBaselineAbsenceRate] = useState(0.1);
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

  const { llmInsights, isLoadingLlm, fetchLlmInsightsData, clearLlmInsights } = useLlmInsights();

  // --- START WORKER COMMUNICATION LOGIC ---
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
        numEmployees: numActiveSimEmployees,
        numTotalEmployees: numEmployees,
        availableSeats,
        employeePreferences: preferencesToUse,
        numSimulationsConfig: numSimulations,
        customDayWeights: dayWeights,
        scenarioRules: SCENARIO_RULES,
        baselineAbsenceRate: baselineAbsenceRate,
      });
    }
  }, [numEmployees, numSimulations, dayWeights, baselineAbsenceRate]);

  useEffect(() => {
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
              const empiricalEmployeePreferencesForWorker = Array.from(
                { length: numActiveEmployeesForSim },
                () => csvEmpiricalPreferences[Math.floor(Math.random() * csvEmpiricalPreferences.length)]
              );
              currentEmpiricalResultsRef.current = currentEmpiricalResultsRef.current["Imported CSV Data"]
                ? { "Imported CSV Data": currentEmpiricalResultsRef.current["Imported CSV Data"] }
                : {};
              const initialEmpiricalProgress = SCENARIO_NAMES.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
              setScenarioProgress(initialEmpiricalProgress);
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
  }, [csvEmpiricalPreferences, numEmployees, deskRatio, runSimulationsWithPreferences, baselineAbsenceRate]);
  // --- END WORKER COMMUNICATION LOGIC ---

  // --- START LLM INSIGHTS LOGIC ---
  const handleGetLlmInsights = useCallback(() => {
    fetchLlmInsightsData({
      numEmployees,
      deskRatio,
      meanPreference,
      stdDevPreference,
      dayWeights,
      numSimulations,
      baselineAbsenceRate,
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
  // --- END LLM INSIGHTS LOGIC ---

  const resultsToDisplayForSimulationTab = currentViewMode === 'empirical' && Object.keys(empiricalResults).length > 0
    ? empiricalResults
    : modeledResults;

  // --- START SIMULATION RUN LOGIC ---
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
      baselineAbsenceRate,
      runSimulationsWithPreferences,
      clearLlmInsights
    ]);
  // --- END SIMULATION RUN LOGIC ---

  // --- START CSV IMPORT LOGIC ---
  const processImportedData = (rawCsvData) => {
    if (!rawCsvData || rawCsvData.length < 2) { // Need at least header + 1 data row
      alert("No data found in CSV. The file might be empty or contain only a header row.");
      return;
    }

    // First row is header, actual data starts from the second row.
    const csvDataWithoutHeader = rawCsvData.slice(1);
    if (csvDataWithoutHeader.length === 0) {
      alert("CSV contains only a header row. No data to process.");
      return;
    }

    const weeklyData = {};
    csvDataWithoutHeader.forEach((row, dataIndex) => {
      const originalRowNumber = dataIndex + 2; // For user-friendly logging (1-based, includes header)

      // New CSV structure:
      // Col 1 (index 0): Ignored
      // Col 2 (index 1): Number of days (Days In Office)
      // Col 3 (index 2): Date specifying the week (Week of Dates)
      // Col 4 (index 3): Ignored
      // Col 5 (index 4): Attendance number (Distinct count of UserID)

      if (!Array.isArray(row) || row.length < 3) { // Need at least up to "Week of Dates" (index 2)
        console.warn(`Skipping row ${originalRowNumber}: Insufficient columns or not an array. Row:`, row);
        return;
      }

      const daysAttendedRaw = row[1]; // From 2nd column
      const weekIdentifierRaw = row[2]; // From 3rd column

      let daysAttended;
      if (typeof daysAttendedRaw === 'number' && daysAttendedRaw >= 0 && daysAttendedRaw <= DAYS_IN_WORK_WEEK) {
        daysAttended = Math.round(daysAttendedRaw);
      } else {
        console.warn(`Skipping row ${originalRowNumber}: Invalid or missing 'Days In Office' (column 2). Expected a number 0-5. Got: '${daysAttendedRaw}'. Row:`, row);
        return;
      }

      if (typeof weekIdentifierRaw !== 'string' || weekIdentifierRaw.trim() === '') {
        console.warn(`Skipping row ${originalRowNumber}: Invalid or missing 'Week of Dates' (column 3). Expected a non-empty string. Got: '${weekIdentifierRaw}'. Row:`, row);
        return;
      }
      const weekIdentifier = weekIdentifierRaw.trim();

      let peopleCount = 0; // Default to 0
      if (row.length > 4) { // Check if 5th column exists
        const peopleCountRaw = row[4];
        if (typeof peopleCountRaw === 'number' && peopleCountRaw >= 0) {
          peopleCount = Math.round(peopleCountRaw);
        } else if (peopleCountRaw !== null && peopleCountRaw !== undefined && String(peopleCountRaw).trim() !== '') {
          console.warn(`Warning for row ${originalRowNumber}: Invalid 'Attendance Number' (column 5). Got: '${peopleCountRaw}'. Defaulting to 0. Row:`, row);
        }
      }

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
    let allIndividualPreferencesFromCsvActive = [];
    const csvAttendanceDistributionSums = Array(DAYS_IN_WORK_WEEK + 1).fill(0);
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

        for (let days = 0; days <= DAYS_IN_WORK_WEEK; days++) {
          csvAttendanceDistributionSums[days] += week.attendanceDistribution[days];
        }
        
        const numBaselineAbsentThisWeek = Math.round(week.totalPeopleThisWeek * baselineAbsenceRate);
        let remainingBaselineAbsentToAccountFor = numBaselineAbsentThisWeek;

        for (let days = 0; days <= DAYS_IN_WORK_WEEK; days++) {
            let countForThisBucket = week.attendanceDistribution[days];
            let chosenCountForThisBucket = 0;

            if (days === 0) {
                const baselineAbsentFromThisBucket = Math.min(countForThisBucket, remainingBaselineAbsentToAccountFor);
                chosenCountForThisBucket = countForThisBucket - baselineAbsentFromThisBucket;
                remainingBaselineAbsentToAccountFor -= baselineAbsentFromThisBucket;
            } else {
                chosenCountForThisBucket = countForThisBucket;
            }

            for (let i = 0; i < chosenCountForThisBucket; i++) {
                allIndividualPreferencesFromCsvActive.push(days);
            }
        }
      }
    }

    if (nonOutlierWeeksData.length === 0) {
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

    const averagePeoplePerWeek = nonOutlierWeeksData.length > 0 ? totalPeopleSum / nonOutlierWeeksData.length : numEmployees;
    const newNumEmployees = Math.round(averagePeoplePerWeek);
    if (newNumEmployees > 0) {
        setNumEmployees(newNumEmployees);
    }

    if (allIndividualPreferencesFromCsvActive.length === 0) {
      alert("No active employee preferences could be derived from the CSV data (e.g., all attendance was attributed to baseline absence). Parameters not updated.");
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
      setCsvEmpiricalPreferences(null);
      setExcludedWeeksLog(currentExcludedWeeks);
      return;
    }
    
    const csvOverallAverageAttendanceDistribution = csvTotalEmployeeWeeks > 0
      ? csvAttendanceDistributionSums.map(sum => (sum / csvTotalEmployeeWeeks) * 100)
      : Array(DAYS_IN_WORK_WEEK + 1).fill(0);

    const estimatedMeanPreferenceActive = allIndividualPreferencesFromCsvActive.reduce((sum, val) => sum + val, 0) / allIndividualPreferencesFromCsvActive.length;
    let varianceActive = 0;
    const meanActive = estimatedMeanPreferenceActive;
    varianceActive = allIndividualPreferencesFromCsvActive.reduce((sum, val) => sum + Math.pow(val - meanActive, 2), 0) / allIndividualPreferencesFromCsvActive.length;
    const estimatedStdDevPreferenceActive = Math.sqrt(varianceActive);

    setMeanPreference(!isNaN(meanActive) && meanActive >= 0 && meanActive <= DAYS_IN_WORK_WEEK ? parseFloat(meanActive.toFixed(1)) : 3);
    setStdDevPreference(!isNaN(estimatedStdDevPreferenceActive) && estimatedStdDevPreferenceActive > 0 ? parseFloat(estimatedStdDevPreferenceActive.toFixed(1)) : 0.8);
    
    setCsvEmpiricalPreferences(allIndividualPreferencesFromCsvActive);
    setExcludedWeeksLog(currentExcludedWeeks);

    const csvResultEntry = {
      "Imported CSV Data": {
        overallAverage: null, dailyAverages: null, averagePreferenceDeviation: null,
        attendanceDistribution: csvOverallAverageAttendanceDistribution
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
    alert(alertMessage);
    if (activeTab === 'graphs') {
      setActiveTab('simulation');
    }
  };
  // --- END CSV IMPORT LOGIC ---

  // --- START EXCEL EXPORT LOGIC ---
  const handleExportToExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const attendanceDaysHeader = ["0 Days", "1 Day", "2 Days", "3 Days", "4 Days", "5 Days"];

    // Sheet 1: Parameters
    const paramsData = [
      ["Parameter", "Value"],
      ["Total Number of Employees", numEmployees],
      ["Desk Ratio (Seats / Emp.)", deskRatio],
      ["Baseline Absence Rate (%)", (baselineAbsenceRate * 100).toFixed(1)],
      ["Avg. Preferred Days (modeled, active staff)", meanPreference.toFixed(1)],
      ["Std Dev of Pref. (modeled, active staff)", stdDevPreference.toFixed(1)],
      ["Number of Simulated Weeks", numSimulations],
      ["Day Weights (Mon-Fri)", dayWeights.join(', ')],
      ["CSV Data Imported", csvEmpiricalPreferences ? "Yes" : "No"],
    ];
    if (excludedWeeksLog.length > 0) {
      paramsData.push(["Excluded CSV Weeks", excludedWeeksLog.join('; ')]);
    }
    const wsParams = XLSX.utils.aoa_to_sheet(paramsData);
    XLSX.utils.book_append_sheet(wb, wsParams, "Parameters");

    // Helper function to create results sheet
    const createResultsSheet = (resultsData, sheetName) => {
      if (!resultsData || Object.keys(resultsData).length === 0) return;
    
      const aoa = []; // Array of arrays for XLSX
    
      // Table 1: Daily Seat Shortage & Metrics
      aoa.push(["Weekly Simulation: Daily Seat Shortage & Metrics"]); // Title for the first table
      const shortageMetricsHeaders = [
        "Scenario", "Avg Shortage", "Pref Deviation", 
        ...weekDayNames.map(day => `Avg Shortage ${day}`)
      ];
      aoa.push(shortageMetricsHeaders);
    
      Object.entries(resultsData).forEach(([scenario, resultObj]) => {
        // Filter out "Imported CSV Data" for this specific table as it doesn't have shortage/deviation metrics
        if (scenario !== "Imported CSV Data" && resultObj && (Array.isArray(resultObj.dailyAverages) || resultObj.dailyAverages === null)) {
          const row = [
            scenario,
            resultObj.overallAverage !== null && typeof resultObj.overallAverage === 'number' ? Math.round(resultObj.overallAverage) : 'N/A',
            typeof resultObj.averagePreferenceDeviation === 'number' ? resultObj.averagePreferenceDeviation.toFixed(2) : 'N/A',
          ];
          weekDayNames.forEach((_, index) => {
            row.push(
              resultObj.dailyAverages && typeof resultObj.dailyAverages[index] === 'number'
                ? Math.round(resultObj.dailyAverages[index])
                : (resultObj.dailyAverages === null ? 'N/A' : 'Err') // Simplified N/A or Err
            );
          });
          aoa.push(row);
        }
      });
    
      aoa.push([]); // Add an empty row for spacing between tables
    
      // Table 2: Attendance Distribution Comparison
      aoa.push(["Attendance Distribution Comparison (% of Employees)"]); // Title for the second table
      const attendanceDistHeaders = [
        "Source / Scenario", 
        ...attendanceDaysHeader.map(day => `${day} (%)`)
      ];
      aoa.push(attendanceDistHeaders);
    
      Object.entries(resultsData).forEach(([scenario, resultObj]) => {
        if (resultObj && Array.isArray(resultObj.attendanceDistribution) && resultObj.attendanceDistribution.length === 6) {
          const row = [scenario];
          resultObj.attendanceDistribution.forEach(percentage => {
            row.push(typeof percentage === 'number' ? Math.round(percentage) : 'N/A');
          });
          aoa.push(row);
        } else if (resultObj && scenario === "Imported CSV Data" && (!resultObj.attendanceDistribution || resultObj.attendanceDistribution.length !== 6)) {
          // Handle case where "Imported CSV Data" might exist but not have a valid distribution yet
          const row = [scenario, ...Array(6).fill('N/A')];
          aoa.push(row);
        }
      });
    
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Optional: Add merges for the table titles if you want them to span columns
      // This requires knowing the number of columns in each table.
      // For simplicity, this example doesn't add merges, titles will be in the first cell.
      // If you want to merge, you'd add to ws['!merges'] array.
      // e.g., ws['!merges'] = [{ s: {r:0, c:0}, e: {r:0, c:shortageMetricsHeaders.length-1} }];

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    // Sheet 2: Modeled Results
    createResultsSheet(modeledResults, "Modeled Results");

    // Sheet 3: Empirical Results
    if (csvEmpiricalPreferences && Object.keys(empiricalResults).length > 0) {
      createResultsSheet(empiricalResults, "Empirical Results");
    }
    
    // Sheet 4: LLM Insights
    if (llmInsights) {
      // Create a sheet with the LLM insights.
      // For simplicity, putting it in one cell. Could be split by lines if needed.
      const insightsData = [
        ["LLM Policy Insights"],
        [llmInsights]
      ];
      const wsInsights = XLSX.utils.aoa_to_sheet(insightsData);
      // Optional: Set column width for better readability
      wsInsights['!cols'] = [{ wch: 100 }]; // Width of first column

      // Apply text wrapping to the cell A2 (where llmInsights content is placed)
      const insightsCellAddress = 'A2';
    if (wsInsights[insightsCellAddress] && typeof wsInsights[insightsCellAddress].v === 'string' && wsInsights[insightsCellAddress].v.length > 0) { // Check if cell exists and has content
     const cell = wsInsights[insightsCellAddress];
        // Ensure the style object 's' exists
        if (!cell.s) {
          cell.s = {};
        }
        // Ensure the alignment object exists within 's'
        if (!cell.s.alignment) {
          cell.s.alignment = {};
        }
        // Set wrapText to true
        cell.s.alignment.wrapText = true;
        // Align text to the top of the cell, useful for multi-line content
        cell.s.alignment.vertical = "top";
      }
      XLSX.utils.book_append_sheet(wb, wsInsights, "LLM Insights");
    }


    // Generate and download the Excel file
    XLSX.writeFile(wb, "Office_Simulation_Report.xlsx");

  }, [
      numEmployees, deskRatio, meanPreference, stdDevPreference, numSimulations,
      dayWeights, baselineAbsenceRate, csvEmpiricalPreferences, excludedWeeksLog,
      modeledResults, empiricalResults, llmInsights
    ]);
  // --- END EXCEL EXPORT LOGIC ---

  return ( // Removed the extra wrapping div
    <div className="min-h-screen bg-lightSand p-4 sm:p-8 font-sans flex flex-col items-center">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-6xl">
        <h1 className="text-4xl font-bold text-signatureBlue mb-10 pb-6 text-center border-b-2 border-mistBlue">Office Seat Utilization Simulator</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-1">
            <ParameterInputPanel
              numEmployees={numEmployees}
              setNumEmployees={setNumEmployees}
              deskRatio={deskRatio}
              setDeskRatio={setDeskRatio}
              baselineAbsenceRate={baselineAbsenceRate}
              setBaselineAbsenceRate={setBaselineAbsenceRate}
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
              _numSimulations={numSimulations}
              _numEmployees={numEmployees}
              _deskRatio={deskRatio}
              getLlmInsights={handleGetLlmInsights}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isLoadingLlm={isLoadingLlm}
              _scenarioProgress={_scenarioProgress}
              overallProgress={overallProgress}
              llmInsights={llmInsights}
              onExportToExcel={handleExportToExcel} // Pass the export function
            />
          </div>
        </div>
      </div>
    </div> 
  );
};

export default App;