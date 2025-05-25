// --- Constants ---
const DAYS_IN_WORK_WEEK = 5;

// --- Helper Functions (used by runScenario within this worker) ---

// Determines the TARGET number of days per week an employee should attend
function getTargetDaysPerWeek(scenarioName, preferredDays, scenarioRules) {
  const roundedPreferredDays = Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(preferredDays)));
  const rules = scenarioRules[scenarioName];

  if (!rules) {
    console.warn("Unknown scenario in getTargetDaysPerWeek:", scenarioName, "- defaulting to roundedPreferredDays");
    return roundedPreferredDays;
  }

  if (rules.exactly !== undefined) {
    return rules.exactly;
  }

  let targetDays = roundedPreferredDays;
  if (rules.min !== undefined) {
    targetDays = Math.max(rules.min, targetDays);
  }
  if (rules.max !== undefined) {
    targetDays = Math.min(rules.max, targetDays);
  }
  return targetDays;
}


// --- Core Simulation Logic ---
function runScenario(scenarioName, numEmployees, availableSeats, employeePreferences, numSimulationsConfig, customDayWeights, scenarioRules) {
  const dailyShortageSums = Array(DAYS_IN_WORK_WEEK).fill(0);
  const attendanceDistributionSums = Array(DAYS_IN_WORK_WEEK + 1).fill(0);

  if (numEmployees === 0) {
    return {
      overallAverage: 0,
      dailyAverages: Array(DAYS_IN_WORK_WEEK).fill(0),
      attendanceDistribution: Array(DAYS_IN_WORK_WEEK + 1).fill(0),
      averagePreferenceDeviation: 0,
    };
  }

  let totalPreferenceDeviation = 0;
  for (let i = 0; i < numEmployees; i++) {
    const individualPreference = employeePreferences[i];
    const policyTargetDays = getTargetDaysPerWeek(scenarioName, individualPreference, scenarioRules);
    totalPreferenceDeviation += Math.abs(individualPreference - policyTargetDays);
  }
  const averagePreferenceDeviation = numEmployees > 0 ? totalPreferenceDeviation / numEmployees : 0;

  const currentDayWeights = (customDayWeights && customDayWeights.length === DAYS_IN_WORK_WEEK)
    ? customDayWeights
    : Array(DAYS_IN_WORK_WEEK).fill(1);

  const dailyAttendeeCountsThisWeek = Array(DAYS_IN_WORK_WEEK).fill(0);

  for (let i = 0; i < numSimulationsConfig; i++) {
    for(let day = 0; day < DAYS_IN_WORK_WEEK; day++) {
        dailyAttendeeCountsThisWeek[day] = 0;
    }
    const employeeActualDaysThisWeek = Array(numEmployees).fill(0);

    for (let empIdx = 0; empIdx < numEmployees; empIdx++) {
      const preferredDaysForEmp = employeePreferences[empIdx];
      const targetDaysThisWeek = getTargetDaysPerWeek(scenarioName, preferredDaysForEmp, scenarioRules);

      let daysToAttendCount = targetDaysThisWeek;
      let weekdaysForSelection = Array.from({ length: DAYS_IN_WORK_WEEK }, (_, k) => k);
      let numAvailableWeekdays = DAYS_IN_WORK_WEEK;
      let currentTotalWeightOfAvailableDays = weekdaysForSelection.reduce((sum, dayIndex) => sum + Math.max(0, currentDayWeights[dayIndex]), 0);

      for (let j = 0; j < daysToAttendCount && numAvailableWeekdays > 0; j++) {
        let chosenDayPoolIndex = -1;

        if (currentTotalWeightOfAvailableDays <= 0) {
          if (numAvailableWeekdays > 0) {
            chosenDayPoolIndex = Math.floor(Math.random() * numAvailableWeekdays);
          } else {
            break;
          }
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
        } else if (numAvailableWeekdays > 0) {
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

    for (let empIdx = 0; empIdx < numEmployees; empIdx++) {
      const daysAttended = Math.min(DAYS_IN_WORK_WEEK, Math.max(0, employeeActualDaysThisWeek[empIdx]));
      attendanceDistributionSums[daysAttended]++;
    }

    for (let day = 0; day < DAYS_IN_WORK_WEEK; day++) {
      const peopleWithoutSeat = Math.max(0, dailyAttendeeCountsThisWeek[day] - availableSeats);
      dailyShortageSums[day] += peopleWithoutSeat;
    }
  }

  if (numSimulationsConfig === 0) {
    return {
      overallAverage: 0,
      dailyAverages: Array(DAYS_IN_WORK_WEEK).fill(0),
      attendanceDistribution: Array(DAYS_IN_WORK_WEEK + 1).fill(0),
      averagePreferenceDeviation: 0,
    };
  }

  const averageDailyShortages = dailyShortageSums.map(sum => sum / numSimulationsConfig);
  const overallAverageShortage = averageDailyShortages.reduce((acc, val) => acc + val, 0) / DAYS_IN_WORK_WEEK;
  
  const totalEmployeeWeeksSimulated = numSimulationsConfig * numEmployees;
  const averageAttendanceDistribution = attendanceDistributionSums.map(sum =>
    totalEmployeeWeeksSimulated > 0 ? (sum / totalEmployeeWeeksSimulated) * 100 : 0
  );

  return {
    overallAverage: parseFloat(overallAverageShortage.toFixed(2)),
    dailyAverages: averageDailyShortages.map(avg => parseFloat(avg.toFixed(2))),
    attendanceDistribution: averageAttendanceDistribution,
    averagePreferenceDeviation: parseFloat(averagePreferenceDeviation.toFixed(2))
  };
}

// --- Worker Message Handling ---
// eslint-disable-next-line no-restricted-globals
self.onmessage = function(event) {
  const {
    workerId,
    scenarioName,
    numEmployees,
    availableSeats,
    employeePreferences,
    numSimulationsConfig,
    customDayWeights,
    scenarioRules
  } = event.data;

  console.log(`Worker received job for: ${scenarioName} (${workerId})`);

  try {
    const results = runScenario(
      scenarioName,
      numEmployees,
      availableSeats,
      employeePreferences,
      numSimulationsConfig,
      customDayWeights,
      scenarioRules
    );
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ workerId, scenarioName, results, error: null });
  } catch (e) {
    console.error(`Worker error for ${scenarioName} (${workerId}):`, e);
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ workerId, scenarioName, results: null, error: e.message, stack: e.stack });
  }
};