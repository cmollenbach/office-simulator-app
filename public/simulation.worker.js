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
function runScenario(workerId, scenarioName, numEmployees, availableSeats, employeePreferences, numSimulationsConfig, customDayWeights, scenarioRules) { // Added workerId
  console.log(`Worker: runScenario started for ${scenarioName}. Simulating ${numSimulationsConfig} weeks.`);
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

  // Pre-calculate target days per week for each employee based on policy
  const policyTargetDaysPerEmployee = employeePreferences.map(individualPreference =>
    getTargetDaysPerWeek(scenarioName, individualPreference, scenarioRules)
  );

  let totalPreferenceDeviation = 0;
  for (let i = 0; i < numEmployees; i++) {
    const individualPreference = employeePreferences[i];
    // Use the pre-calculated policy target days
    const policyTargetDays = policyTargetDaysPerEmployee[i];
    totalPreferenceDeviation += Math.abs(individualPreference - policyTargetDays);
  }
  // Average preference deviation is calculated once, which is good.
  const averagePreferenceDeviation = numEmployees > 0 ? totalPreferenceDeviation / numEmployees : 0;

  const currentDayWeights = (customDayWeights && customDayWeights.length === DAYS_IN_WORK_WEEK)
    ? customDayWeights
    : Array(DAYS_IN_WORK_WEEK).fill(1);

  const dailyAttendeeCountsThisWeek = Array(DAYS_IN_WORK_WEEK).fill(0);

  const progressUpdateInterval = Math.max(1, Math.floor(numSimulationsConfig / 100)); // Aim for ~100 updates

  for (let i = 0; i < numSimulationsConfig; i++) {
    for(let day = 0; day < DAYS_IN_WORK_WEEK; day++) {
        dailyAttendeeCountsThisWeek[day] = 0;
    }
    const employeeActualDaysThisWeek = Array(numEmployees).fill(0);

    for (let empIdx = 0; empIdx < numEmployees; empIdx++) {
      // Use the pre-calculated target days for this employee
      const targetDaysThisWeek = policyTargetDaysPerEmployee[empIdx];

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

    // Send progress update
    if ((i + 1) % progressUpdateInterval === 0 || (i + 1) === numSimulationsConfig) {
      const progress = Math.round(((i + 1) / numSimulationsConfig) * 100);
      // console.log(`Worker: Progress for ${scenarioName} (${workerId}): ${progress}%`); // Optional: can be very noisy
      // eslint-disable-next-line no-restricted-globals -- self.postMessage is standard in workers
      self.postMessage({
        type: 'progress', workerId, scenarioName, progress
      });
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
// eslint-disable-next-line no-restricted-globals -- self is the global scope in a Web Worker
self.onmessage = function(event) {
  console.log("Worker: Message received in worker", event.data);
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

  try {
    const results = runScenario(
      workerId, // Pass workerId here
      scenarioName,
      numEmployees,
      availableSeats,
      employeePreferences,
      numSimulationsConfig,
      customDayWeights,
      scenarioRules
    );
    console.log(`Worker: Finished scenario ${scenarioName} (${workerId}). Posting result.`);
    // Send final result with a specific type
    // eslint-disable-next-line no-restricted-globals -- self.postMessage is standard in workers
    self.postMessage({ type: 'result', workerId, scenarioName, results, error: null });
  } catch (e) {
    console.error(`Worker: Error during runScenario for ${scenarioName} (${workerId}):`, e.message, e.stack);
    // eslint-disable-next-line no-restricted-globals
    // eslint-disable-next-line no-restricted-globals -- self.postMessage is standard in workers
    self.postMessage({ type: 'error', workerId, scenarioName, results: null, error: e.message, stack: e.stack });
  }
};