// c:\Users\chris\Documents\office-simulator-app\src\simulationUtils.js

export const SCENARIO_NAMES = [
  "1) No rules",
  "2) Min 2 days/week, no max",
  "3) Min 3 days/week, no max",
  "4) Min 2 days/week, max 4 days/week",
  "5) Exactly 3 days/week",
];
export const DAYS_IN_WORK_WEEK = 5;

// Helper function to generate a random number from a standard normal distribution (mean 0, std dev 1)
// using the Box-Muller transform.
function generateStandardNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Helper function to generate a random number from a normal distribution with specified mean and standard deviation
export function generateNormalRandom(mean, stdDev) {
  return mean + stdDev * generateStandardNormal();
}

// Determines the TARGET number of days per week an employee should attend
// based on their raw preference and the scenario rules.
export function getTargetDaysPerWeek(scenarioName, preferredDays) {
  const roundedPreferredDays = Math.min(DAYS_IN_WORK_WEEK, Math.max(0, Math.round(preferredDays)));
  switch (scenarioName) {
    case "1) No rules":
      return roundedPreferredDays;
    case "2) Min 2 days/week, no max":
      return Math.max(2, roundedPreferredDays);
    case "3) Min 3 days/week, no max":
      return Math.max(3, roundedPreferredDays);
    case "4) Min 2 days/week, max 4 days/week":
      return Math.min(4, Math.max(2, roundedPreferredDays));
    case "5) Exactly 3 days/week":
      return 3;
    default:
      console.warn("Unknown scenario in getTargetDaysPerWeek:", scenarioName, "- defaulting to roundedPreferredDays");
      return roundedPreferredDays;
  }
}

// Function to run the Monte Carlo simulation for a single scenario
// Now simulates weeks and distributes attendance within each week, considering day weights.
export function runScenario(scenarioName, numEmployees, availableSeats, employeePreferences, numSimulationsConfig, customDayWeights) {
  // Initialize sums for daily shortages (Mon, Tue, Wed, Thu, Fri)
  const dailyShortageSums = Array(DAYS_IN_WORK_WEEK).fill(0);
  // Initialize sums for attendance distribution (0 to 5 days)
  const attendanceDistributionSums = Array(DAYS_IN_WORK_WEEK + 1).fill(0);

  if (numEmployees === 0) {
    return {
      overallAverage: 0,
      dailyAverages: Array(DAYS_IN_WORK_WEEK).fill(0),
      attendanceDistribution: Array(DAYS_IN_WORK_WEEK + 1).fill(0)
    };
  }

  // Ensure customDayWeights is a valid array, otherwise default to equal weights
  const currentDayWeights = (customDayWeights && customDayWeights.length === DAYS_IN_WORK_WEEK)
    ? customDayWeights
    : Array(DAYS_IN_WORK_WEEK).fill(1);

  for (let i = 0; i < numSimulationsConfig; i++) {
    const weeklyAttendance = Array(numEmployees).fill(null).map(() => Array(DAYS_IN_WORK_WEEK).fill(0));
    const employeeActualDaysThisWeek = Array(numEmployees).fill(0);

    for (let empIdx = 0; empIdx < numEmployees; empIdx++) {
      const preferredDaysForEmp = employeePreferences[empIdx]; // This now comes pre-determined (either modeled or empirical)
      const targetDaysThisWeek = getTargetDaysPerWeek(scenarioName, preferredDaysForEmp);

      let daysToAttendCount = targetDaysThisWeek;
      // Create a mutable list of weekdays for this employee's selection process
      let weekdaysForSelection = Array.from({ length: DAYS_IN_WORK_WEEK }, (_, k) => k);
      let numAvailableWeekdays = DAYS_IN_WORK_WEEK;

      for (let j = 0; j < daysToAttendCount && numAvailableWeekdays > 0; j++) {
        let totalWeightOfAvailableDays = 0;
        for (let dayPoolIdx = 0; dayPoolIdx < numAvailableWeekdays; dayPoolIdx++) {
          // Ensure weights are non-negative for this calculation
          totalWeightOfAvailableDays += Math.max(0, currentDayWeights[weekdaysForSelection[dayPoolIdx]]);
        }

        let chosenDayPoolIndex = -1; // Index within weekdaysForSelection

        if (totalWeightOfAvailableDays <= 0) {
          // Fallback: All remaining weights are zero or negative. Pick randomly (unweighted).
          if (numAvailableWeekdays > 0) {
            chosenDayPoolIndex = Math.floor(Math.random() * numAvailableWeekdays);
          } else {
            break; // No more days to pick from
          }
        } else {
          // Weighted random sampling
          const randomThreshold = Math.random() * totalWeightOfAvailableDays;
          let cumulativeWeight = 0;
          for (let dayPoolIdx = 0; dayPoolIdx < numAvailableWeekdays; dayPoolIdx++) {
            cumulativeWeight += Math.max(0, currentDayWeights[weekdaysForSelection[dayPoolIdx]]);
            if (randomThreshold < cumulativeWeight) {
              chosenDayPoolIndex = dayPoolIdx;
              break;
            }
          }
        }

        if (chosenDayPoolIndex !== -1) {
          const actualChosenDay = weekdaysForSelection[chosenDayPoolIndex];
          weeklyAttendance[empIdx][actualChosenDay] = 1;
          employeeActualDaysThisWeek[empIdx]++;

          // "Remove" the chosen day by swapping it with the last available day and decrementing count
          weekdaysForSelection[chosenDayPoolIndex] = weekdaysForSelection[numAvailableWeekdays - 1];
          numAvailableWeekdays--;
        } else {
          // This should ideally not be reached if numAvailableWeekdays > 0.
          // For robustness, if there are still days, pick one.
          if (numAvailableWeekdays > 0) {
              const actualChosenDay = weekdaysForSelection[0]; // Pick the first available
              weeklyAttendance[empIdx][actualChosenDay] = 1;
              employeeActualDaysThisWeek[empIdx]++;
              weekdaysForSelection[0] = weekdaysForSelection[numAvailableWeekdays - 1];
              numAvailableWeekdays--;
          } else {
            break;
          }
        }
      }
    }

    // Calculate attendance distribution for this week
    for (let empIdx = 0; empIdx < numEmployees; empIdx++) {
      // Ensure days attended is within 0-5 range for indexing
      const daysAttended = Math.min(DAYS_IN_WORK_WEEK, Math.max(0, employeeActualDaysThisWeek[empIdx]));
      attendanceDistributionSums[daysAttended]++;
    }


    for (let day = 0; day < DAYS_IN_WORK_WEEK; day++) {
      let currentDayAttendees = 0;
      for (let empIdx = 0; empIdx < numEmployees; empIdx++) {
        if (weeklyAttendance[empIdx][day] === 1) {
          currentDayAttendees++;
        }
      }
      const peopleWithoutSeat = Math.max(0, currentDayAttendees - availableSeats);
      // Accumulate shortage for the specific day of the week
      dailyShortageSums[day] += peopleWithoutSeat;
    }
  }

  if (numSimulationsConfig === 0) { // Should be caught by the numEmployees check earlier, but good for safety
    return {
      overallAverage: 0,
      dailyAverages: Array(DAYS_IN_WORK_WEEK).fill(0),
      attendanceDistribution: Array(DAYS_IN_WORK_WEEK + 1).fill(0)
    };
  }

  const averageDailyShortages = dailyShortageSums.map(sum => sum / numSimulationsConfig);
  const overallAverageShortage = averageDailyShortages.reduce((acc, val) => acc + val, 0) / DAYS_IN_WORK_WEEK;
  // Calculate average attendance distribution as percentage of total employee-weeks simulated
  const totalEmployeeWeeksSimulated = numSimulationsConfig * numEmployees;
  const averageAttendanceDistribution = attendanceDistributionSums.map(sum =>
    totalEmployeeWeeksSimulated > 0 ? (sum / totalEmployeeWeeksSimulated) * 100 : 0
  );


  return {
    overallAverage: overallAverageShortage,
    dailyAverages: averageDailyShortages,
    attendanceDistribution: averageAttendanceDistribution
  };
}
