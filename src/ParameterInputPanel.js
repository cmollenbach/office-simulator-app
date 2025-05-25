// c:\Users\chris\Documents\office-simulator-app\src\ParameterInputPanel.js
import React from 'react';
import Papa from 'papaparse';
import PropTypes from 'prop-types';

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
  // New props for baseline absence rate
  baselineAbsenceRate,
  setBaselineAbsenceRate,
  runAllSimulations,
  isLoading,
  onDataImported,
}) => {
  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const handleDayWeightChange = (index, value) => {
    const newWeights = [...dayWeights];
    const numericValue = parseFloat(value);
    newWeights[index] = Math.max(0, isNaN(numericValue) ? 0 : numericValue);
    setDayWeights(newWeights);
  };

  const currentDayWeights = Array.isArray(dayWeights) && dayWeights.length === 5
    ? dayWeights
    : [1, 1, 1, 1, 1];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (onDataImported) {
            onDataImported(results.data);
          }
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
          alert("Error parsing CSV file. Please check the console.");
        }
      });
      event.target.value = null;
    }
  };

  return (
    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-300 flex flex-col">
      <h2 className="text-2xl font-bold text-indigo-700 mb-6 pb-3 text-center border-b-2 border-indigo-100">Parameters</h2>
      <div className="space-y-4">
        <fieldset className="border border-gray-300 p-4 rounded-md">
          <legend className="text-sm font-semibold text-indigo-600 px-2">Workforce & Capacity</legend>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col">
                <label htmlFor="employees" className="text-gray-700 font-medium mb-1 text-xs">Number of Employees:</label>
                <input
                  type="number"
                  id="employees"
                  value={numEmployees}
                  onChange={(e) => setNumEmployees(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out text-sm"
                  min="1"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="deskRatio" className="text-gray-700 font-medium mb-1 text-xs">Desk Ratio (Seats / Emp.):</label>
                <input
                  type="number"
                  id="deskRatio"
                  value={deskRatio}
                  onChange={(e) => setDeskRatio(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out text-sm"
                  min="0.1"
                  step="0.05"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <div> {/* Keep Baseline Absence Rate on its own line due to help text */}
                <label htmlFor="baselineAbsenceRate" className="text-gray-700 font-medium mb-1 text-xs">Baseline Absence Rate (%):</label>
                <input
                  type="number"
                  id="baselineAbsenceRate"
                  value={baselineAbsenceRate * 100} // Display as percentage
                  onChange={(e) => setBaselineAbsenceRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) / 100)} // Store as decimal
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out text-sm"
                  min="0"
                  max="100"
                  step="0.5"
                />
                <p className="text-xs text-gray-500 mt-1 italic">
                  For illness, leave etc. Applied before policy.
                </p>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-gray-300 p-4 rounded-md">
          <legend className="text-sm font-semibold text-indigo-600 px-2">Employee Preferences (Active Staff)</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <div className="flex flex-col">
              <label htmlFor="meanPreference" className="text-gray-700 font-medium mb-1 text-xs">Avg. Preferred Days (0-5):</label>
              <input
                type="number"
                id="meanPreference"
                value={meanPreference}
                onChange={(e) => setMeanPreference(Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out text-sm"
                min="0"
                max="5"
                step="0.1"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="stdDev" className="text-gray-700 font-medium mb-1 text-xs">Std Dev of Pref. (0-5 days):</label>
              <input
                type="number"
                id="stdDev"
                value={stdDevPreference}
                onChange={(e) => setStdDevPreference(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out text-sm"
                min="0.1"
                step="0.1"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-gray-300 p-4 rounded-md">
          <legend className="text-sm font-semibold text-indigo-600 px-2">Simulation Settings</legend>
          <div className="space-y-3">
            <div className="flex flex-col">
              <label htmlFor="simulations" className="text-gray-700 font-medium mb-1 text-xs">Number of Simulated Weeks:</label>
              <input
                type="number"
                id="simulations"
                value={numSimulations}
                onChange={(e) => setNumSimulations(Math.min(100000, Math.max(1000, parseInt(e.target.value, 10) || 1000)))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150 ease-in-out text-sm"
                min="1000"
                step="1000"
                max="100000"
              />
            </div>
            <div>
              <h3 className="text-gray-700 font-medium mb-2 text-xs">Day of Week Popularity Weights:</h3>
              <div className="grid grid-cols-5 gap-1.5">
                {weekDayNames.map((dayName, index) => (
                  <div key={dayName} className="flex flex-col items-center">
                    <label htmlFor={`dayWeight-${dayName}`} className="text-gray-600 text-xs mb-1">{dayName}</label>
                    <input
                      type="number"
                      id={`dayWeight-${dayName}`}
                      value={currentDayWeights[index]}
                      onChange={(e) => handleDayWeightChange(index, e.target.value)}
                      className="w-full p-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-center text-xs"
                      min="0"
                      step="0.1"
                      aria-label={`${dayName} weight`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1.5 italic">
                Higher values mean the day is more popular for in-office attendance.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-gray-300 p-4 rounded-md">
          <legend className="text-sm font-semibold text-blue-600 px-2">Historical Data</legend>
          <label
            htmlFor="csvUpload"
            className="w-full inline-block bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded-md cursor-pointer transition-colors duration-150 ease-in-out text-sm shadow text-center"
          >
            Import Attendance CSV
          </label>
          <input
            type="file"
            id="csvUpload"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-1 italic">
            CSV format: Date, DaysAttended (0-5), UniquePeopleCount.
            Ensure data reflects discretionary attendance if using Baseline Absence Rate for adjustments.
          </p>
        </fieldset>
      </div>

      <button
        onClick={runAllSimulations}
        className="w-full mt-6 bg-indigo-600 text-white py-2.5 px-5 rounded-md font-semibold text-base hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center"
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

ParameterInputPanel.propTypes = {
  numEmployees: PropTypes.number.isRequired,
  setNumEmployees: PropTypes.func.isRequired,
  deskRatio: PropTypes.number.isRequired,
  setDeskRatio: PropTypes.func.isRequired,
  meanPreference: PropTypes.number.isRequired,
  setMeanPreference: PropTypes.func.isRequired,
  stdDevPreference: PropTypes.number.isRequired,
  setStdDevPreference: PropTypes.func.isRequired,
  numSimulations: PropTypes.number.isRequired,
  setNumSimulations: PropTypes.func.isRequired,
  dayWeights: PropTypes.arrayOf(PropTypes.number).isRequired,
  setDayWeights: PropTypes.func.isRequired,
  baselineAbsenceRate: PropTypes.number.isRequired,
  setBaselineAbsenceRate: PropTypes.func.isRequired,
  runAllSimulations: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onDataImported: PropTypes.func.isRequired,
};

export default ParameterInputPanel;