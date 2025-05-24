// c:\Users\chris\Documents\office-simulator-app\src\ParameterInputPanel.js
import React from 'react';

const ParameterInputPanel = ({
  numEmployees,
  setNumEmployees,
  deskRatio,
  setDeskRatio,
    meanPreference,
  setMeanPreference,
  stdDevPreference,
  setStdDevPreference,
  numSimulations,
  setNumSimulations,
    dayWeights,
  setDayWeights,
  runAllSimulations,
  isLoading,
}) => {
      const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const handleDayWeightChange = (index, value) => {
    const newWeights = [...dayWeights];
    const numericValue = parseFloat(value);
    // Ensure weight is not negative, default to 0 if invalid
    newWeights[index] = Math.max(0, isNaN(numericValue) ? 0 : numericValue);
    setDayWeights(newWeights);
  };

  // Ensure dayWeights is always an array of 5 elements for rendering
  const currentDayWeights = Array.isArray(dayWeights) && dayWeights.length === 5
    ? dayWeights
    : [1, 1, 1, 1, 1]; // Default fallback if prop is not as expected

  return (
    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-300 flex flex-col">
      <h2 className="text-2xl font-semibold text-indigo-700 mb-6 pb-3 border-b-2 border-indigo-100">Simulation Parameters</h2>
      <div className="space-y-5">
        <div className="flex flex-col">
          <label htmlFor="employees" className="text-gray-700 font-semibold mb-2 text-sm">Number of Employees:</label>
          <input
            type="number"
            id="employees"
            value={numEmployees}
            onChange={(e) => setNumEmployees(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out"
            min="1"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="deskRatio" className="text-gray-700 font-semibold mb-2 text-sm">Desk Ratio (Seats / Employees):</label>
          <input
            type="number"
            id="deskRatio"
            value={deskRatio}
            onChange={(e) => setDeskRatio(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out"
            min="0.1"
            step="0.05"
          />
        </div>
        <div className="flex flex-col">
                      <label htmlFor="meanPreference" className="text-gray-700 font-semibold mb-2 text-sm">Avg. Preferred Days (0-5):</label>
          <input
            type="number"
            id="meanPreference"
            value={meanPreference}
            onChange={(e) => setMeanPreference(Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out"
            min="0"
            max="5"
            step="0.1"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="stdDev" className="text-gray-700 font-semibold mb-2 text-sm">Std Dev of Preference (0-5 days):</label>
          <input
            type="number"
            id="stdDev"
            value={stdDevPreference}
            onChange={(e) => setStdDevPreference(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out"
            min="0.1"
            step="0.1"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="simulations" className="text-gray-700 font-semibold mb-2 text-sm">Number of Simulated Weeks:</label>
          <input
            type="number"
            id="simulations"
            value={numSimulations}
            onChange={(e) => setNumSimulations(Math.max(100, parseInt(e.target.value, 10) || 100))}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out"
            min="100"
            step="100"
          />
        </div>
                <div>
          <h3 className="text-gray-700 font-semibold mb-3 text-sm">Day of Week Popularity Weights:</h3>
          <div className="grid grid-cols-5 gap-2">
            {weekDayNames.map((dayName, index) => (
              <div key={dayName} className="flex flex-col items-center">
                <label htmlFor={`dayWeight-${dayName}`} className="text-gray-600 text-xs mb-1">{dayName}</label>
                <input
                  type="number"
                  id={`dayWeight-${dayName}`}
                  value={currentDayWeights[index]}
                  onChange={(e) => handleDayWeightChange(index, e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-center text-sm"
                  min="0"
                  step="0.1"
                  aria-label={`${dayName} weight`}
                />
              </div>
            ))}
          </div>
           <p className="text-xs text-gray-500 mt-2 italic">
            Higher values mean the day is more popular for in-office attendance.
          </p>
        </div>
      </div>

      <button
        onClick={runAllSimulations}
        className="w-full mt-8 bg-indigo-600 text-white py-3 px-6 rounded-md font-semibold text-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center"
        disabled={isLoading}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : <span className="mr-2">🚀</span>}
        {isLoading ? 'Running Simulation...' : 'Run Simulation'}
      </button>
    </div>
  );
};

export default ParameterInputPanel;
