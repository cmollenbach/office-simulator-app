// src/simulationUtils.js

export const SCENARIO_NAMES = [
  "1) No rules",
  "2) Min 2 days/week, no max",
  "3) Min 2 days/week, max 4 days/week",
  "4) Min 3 days/week, no max",
  "5) Min 3 days/week, max 4 days/week",
  "6) Exactly 3 days/week",
];

export const DAYS_IN_WORK_WEEK = 5;

// Define scenario rules here to be passed to the worker
// This makes the worker more self-contained and testable with rules directly.
export const SCENARIO_RULES = {
  "1) No rules": {},
  "2) Min 2 days/week, no max": { min: 2 },
  "3) Min 2 days/week, max 4 days/week": { min: 2, max: 4 },
  "4) Min 3 days/week, no max": { min: 3 },
  "5) Min 3 days/week, max 4 days/week": { min: 3, max: 4 },
  "6) Exactly 3 days/week": { exactly: 3 },
};

// Helper function to generate a random number from a standard normal distribution (mean 0, std dev 1)
// This might still be needed in App.js for generating preferences before sending to worker.
function generateStandardNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Helper function to generate a random number from a normal distribution with specified mean and standard deviation
// This might still be needed in App.js.
export function generateNormalRandom(mean, stdDev) {
  return mean + stdDev * generateStandardNormal();
}

// getTargetDaysPerWeek is now primarily in the worker.
// If needed in App.js for some pre-calculation before sending to worker,
// you could keep a version here or call a simplified version.
// For now, let's assume App.js will use the SCENARIO_RULES to understand policies
// but the worker does the final target day calculation.