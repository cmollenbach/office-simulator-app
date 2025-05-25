/* eslint-env worker */
// --- Constants ---
const DAYS_IN_WORK_WEEK = 5;

// --- Helper Functions ---
function getTargetDaysPerWeek(scenarioName, preferredDays, scenarioRules) {
  const roundedPreferredDays = Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(preferredDays)));
  const rules = scenarioRules[scenarioName];

  if (!rules) return roundedPreferredDays;
  if (rules.exactly !== undefined) return rules.exactly;

  let targetDays = roundedPreferredDays;
  if (rules.min !== undefined) targetDays = Math.max(rules.min, targetDays);
  if (rules.max !== undefined) targetDays = Math.min(rules.max, targetDays);
  return targetDays;
}

// --- Core Simulation Logic ---
function runScenario(
    workerId, scenarioName, 
    numTotalEmployees, // Renamed from numEmployees to clarify it's the original total
    availableSeats, 
    // employeePreferences now represents preferences for those *potentially* attending
    // Its length might be numActiveEmployees if pre-filtered in App.js, or still numTotalEmployees if worker handles filtering
    employeePreferences, 
    numSimulationsConfig, customDayWeights, scenarioRules,
    baselineAbsenceRate // New parameter
) {
  const dailyShortageSums = Array(DAYS_IN_WORK_WEEK).fill(0);
  const attendanceDistributionSums = Array(DAYS_IN_WORK_WEEK + 1).fill(0);
  let totalPreferenceDeviation = 0;

  const currentDayWeights = (customDayWeights && customDayWeights.length === DAYS_IN_WORK_WEEK)
    ? customDayWeights
    : Array(DAYS_IN_WORK_WEEK).fill(1);

  const progressUpdateInterval = Math.max(1, Math.floor(numSimulationsConfig / 100));

  let activeEmployeesCountForDeviationSum = 0; // Sum of active employees over all simulations for averaging deviation
  for (let i = 0; i < numSimulationsConfig; i++) {
    const dailyAttendeeCountsThisWeek = Array(DAYS_IN_WORK_WEEK).fill(0);
    const employeeActualDaysThisWeek = Array(numTotalEmployees).fill(0); // Track for all original employees

    // Identify active employees for this week's simulation
    // We'll shuffle and pick, or simply iterate and assign absence probabilistically if preferences are for total.
    // For simplicity here, assume employeePreferences list is already for the *potentially active* set,
    // and numTotalEmployees is the original count before baseline absence.
    // The worker will apply baselineAbsenceRate to numTotalEmployees to determine who *doesn't* participate.
    
    const actualNumEmployeesToSimulateThisWeek = numTotalEmployees; // This is the original number passed
    const employeeIsAbsentThisWeek = Array(actualNumEmployeesToSimulateThisWeek).fill(false);
    let currentWeekActiveEmployeesForDeviation = 0;
    
    // Determine baseline absentees for this week
    // Create a shuffled list of employee indices
    const employeeIndices = Array.from({length: actualNumEmployeesToSimulateThisWeek}, (_, k) => k);
    for (let j = employeeIndices.length - 1; j > 0; j--) { // Fisher-Yates shuffle
        const rand = Math.floor(Math.random() * (j + 1));
        [employeeIndices[j], employeeIndices[rand]] = [employeeIndices[rand], employeeIndices[j]];
    }
    
    const numBaselineAbsent = Math.round(actualNumEmployeesToSimulateThisWeek * baselineAbsenceRate);

    for (let j = 0; j < numBaselineAbsent; j++) {
        employeeIsAbsentThisWeek[employeeIndices[j]] = true;
        attendanceDistributionSums[0]++; // These employees attend 0 days
    }

    // Simulate for active employees
    for (let empIdx = 0; empIdx < actualNumEmployeesToSimulateThisWeek; empIdx++) {
      if (employeeIsAbsentThisWeek[empIdx]) {
        employeeActualDaysThisWeek[empIdx] = 0; // Already accounted for in attendanceDistributionSums[0]
        continue; // Skip office day selection for absent employees
      }

      // This employee is active for this week
      const individualPreference = employeePreferences[empIdx % employeePreferences.length]; // Modulo in case preferences array was pre-filtered
      const policyTargetDays = getTargetDaysPerWeek(scenarioName, individualPreference, scenarioRules);
      
      totalPreferenceDeviation += Math.abs(individualPreference - policyTargetDays);
      currentWeekActiveEmployeesForDeviation++;

      let daysToAttendCount = policyTargetDays;
      let weekdaysForSelection = Array.from({ length: DAYS_IN_WORK_WEEK }, (_, k) => k);
      let numAvailableWeekdays = DAYS_IN_WORK_WEEK;
      let currentTotalWeightOfAvailableDays = weekdaysForSelection.reduce((sum, dayIndex) => sum + Math.max(0, currentDayWeights[dayIndex]), 0);

      for (let j = 0; j < daysToAttendCount && numAvailableWeekdays > 0; j++) {
        let chosenDayPoolIndex = -1;
        if (currentTotalWeightOfAvailableDays <= 0) {
          if (numAvailableWeekdays > 0) chosenDayPoolIndex = Math.floor(Math.random() * numAvailableWeekdays);
          else break;
        } else {
          const randomThreshold = Math.random() * currentTotalWeightOfAvailableDays;
          let cumulativeWeight = 0;
          for (let dayPoolIdx = 0; dayPoolIdx < numAvailableWeekdays; dayPoolIdx++) {
            const dayWeight = Math.max(0, currentDayWeights[weekdaysForSelection[dayPoolIdx]]);
            cumulativeWeight += dayWeight;
            if (randomThreshold < cumulativeWeight) {
              chosenDayPoolIndex = dayPoolIdx;
              break;
            }
          }
        }

        if (chosenDayPoolIndex !== -1) {
          const actualChosenDay = weekdaysForSelection[chosenDayPoolIndex];
          dailyAttendeeCountsThisWeek[actualChosenDay]++;
          employeeActualDaysThisWeek[empIdx]++;
          currentTotalWeightOfAvailableDays -= Math.max(0, currentDayWeights[actualChosenDay]);
          weekdaysForSelection[chosenDayPoolIndex] = weekdaysForSelection[numAvailableWeekdays - 1];
          numAvailableWeekdays--;
        } else if (numAvailableWeekdays > 0) { // Fallback if all weights were zero or issue
            chosenDayPoolIndex = 0; 
            const actualChosenDay = weekdaysForSelection[chosenDayPoolIndex];
            dailyAttendeeCountsThisWeek[actualChosenDay]++;
            employeeActualDaysThisWeek[empIdx]++;
            currentTotalWeightOfAvailableDays -= Math.max(0, currentDayWeights[actualChosenDay]);
            weekdaysForSelection[chosenDayPoolIndex] = weekdaysForSelection[numAvailableWeekdays - 1];
            numAvailableWeekdays--;
        } else {
             break;
        }
      }
    }
    
    // Sum up attendance for active employees for this week
    for (let empIdx = 0; empIdx < actualNumEmployeesToSimulateThisWeek; empIdx++) {
        if (!employeeIsAbsentThisWeek[empIdx]) {
            const daysAttended = Math.min(DAYS_IN_WORK_WEEK, Math.max(0, employeeActualDaysThisWeek[empIdx]));
            attendanceDistributionSums[daysAttended]++;
        }
    }

    for (let day = 0; day < DAYS_IN_WORK_WEEK; day++) {
      const peopleWithoutSeat = Math.max(0, dailyAttendeeCountsThisWeek[day] - availableSeats);
      dailyShortageSums[day] += peopleWithoutSeat;
    }
    activeEmployeesCountForDeviationSum += currentWeekActiveEmployeesForDeviation;

    if ((i + 1) % progressUpdateInterval === 0 || (i + 1) === numSimulationsConfig) {
      const progress = Math.round(((i + 1) / numSimulationsConfig) * 100);
      self.postMessage({ type: 'progress', workerId, scenarioName, progress });
    }
  }
  
  const averagePreferenceDeviationValue = activeEmployeesCountForDeviationSum > 0
    ? totalPreferenceDeviation / activeEmployeesCountForDeviationSum
    : 0;

  if (numSimulationsConfig === 0) { // Should ideally not happen with active guard in App.js
    return {
      overallAverage: 0, dailyAverages: Array(DAYS_IN_WORK_WEEK).fill(0),
      attendanceDistribution: Array(DAYS_IN_WORK_WEEK + 1).fill(0), averagePreferenceDeviation: 0,
    };
  }

  const averageDailyShortages = dailyShortageSums.map(sum => sum / numSimulationsConfig);
  const overallAverageShortage = averageDailyShortages.reduce((acc, val) => acc + val, 0) / DAYS_IN_WORK_WEEK;
  
  // Attendance distribution is now based on total employees (including baseline absent ones)
  const totalEmployeeWeeksSimulated = numSimulationsConfig * numTotalEmployees; 
  const averageAttendanceDistribution = attendanceDistributionSums.map(sum =>
    totalEmployeeWeeksSimulated > 0 ? (sum / totalEmployeeWeeksSimulated) * 100 : 0
  );

  return {
    overallAverage: parseFloat(overallAverageShortage.toFixed(2)),
    dailyAverages: averageDailyShortages.map(avg => parseFloat(avg.toFixed(2))),
    attendanceDistribution: averageAttendanceDistribution, // This now includes baseline absences
    averagePreferenceDeviation: parseFloat(averagePreferenceDeviationValue.toFixed(2)) // Based on active employees
  };
}

self.onmessage = function(event) {
  const {
    workerId, scenarioName, 
    numTotalEmployees, // The original total employee count
    availableSeats, employeePreferences,
    numSimulationsConfig, customDayWeights, scenarioRules,
    baselineAbsenceRate // New
  } = event.data;

  try {
    // If App.js sends numEmployees as the *active* count for preference generation,
    // the worker needs the *total* for its baseline absence calculation step.
    // Let's adjust the call to runScenario to expect `numTotalEmployees` and `baselineAbsenceRate`
    // `employeePreferences` will be based on `numActiveEmployeesForSim` from App.js.
    // The worker will then handle the `baselineAbsenceRate` on `numTotalEmployees`.
    
    // For runScenario, `numEmployees` argument should be the total count before baseline absence.
    // The `employeePreferences` array might be shorter (for active employees) if App.js pre-filters.
    // The worker's logic has been updated to handle `numTotalEmployees` and `baselineAbsenceRate`.

    const results = runScenario(
      workerId, scenarioName,
      numTotalEmployees, // Pass the original total employee count
      availableSeats,
      employeePreferences, // Preferences for those who *might* attend
      numSimulationsConfig, customDayWeights, scenarioRules,
      baselineAbsenceRate
    );
    self.postMessage({ type: 'result', workerId, scenarioName, results, error: null });
  } catch (e) {
    console.error(`Worker: Error during runScenario for ${scenarioName} (${workerId}):`, e.message, e.stack);
    self.postMessage({ type: 'error', workerId, scenarioName, results: null, error: e.message, stack: e.stack });
  }
};