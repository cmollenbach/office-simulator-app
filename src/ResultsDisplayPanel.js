// c:\Users\chris\Documents\office-simulator-app\src\ResultsDisplayPanel.js
import React from 'react';

const ResultsDisplayPanel = ({
  results,
  isLoading,
  currentViewMode,
  setCurrentViewMode, // For the toggle
  excludedWeeksLog,   // New prop for excluded weeks
  showToggle,         // To conditionally render the toggle
  numSimulations,
  numEmployees,
  deskRatio,
}) => {
  const hasResults = Object.keys(results).length > 0;
  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const attendanceDays = [0, 1, 2, 3, 4, 5];


  return (
    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-300 flex flex-col">
      {/* ... (existing code for no results/loading states) ... */}
      {!hasResults && !isLoading && (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-4">
          <p className="text-xl mb-4">Welcome to the Simulator!</p>
          <p>Adjust the parameters on the left and click "Run Simulation" to see the results.</p>
          <p className="mt-2 text-sm">This simulation models weekly attendance targets.</p>
          <p className="mt-4 text-base font-semibold text-indigo-700">Try importing a CSV to estimate parameters!</p>
        </div>
      )}
      {isLoading && !hasResults && (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-600 p-4">
          <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium">Calculating scenarios... please wait.</p>
        </div>
      )}
      {hasResults && (
        <>
          {showToggle && (
            <div className="mb-4 flex border-b border-gray-300">
              <button
                onClick={() => setCurrentViewMode('modeled')}
                className={`flex-1 py-2 px-4 text-center text-sm font-medium transition-colors focus:outline-none ${currentViewMode === 'modeled' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Modeled View (Normal Dist.)
              </button>
              <button
                onClick={() => setCurrentViewMode('empirical')}
                className={`flex-1 py-2 px-4 text-center text-sm font-medium transition-colors focus:outline-none ${currentViewMode === 'empirical' ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Empirical View (CSV Based)
              </button>
            </div>
          )}
       
          <h2 className="text-xl font-semibold text-indigo-700 mb-2 pb-3 text-center border-b-2 border-indigo-100">Weekly Simulation: Daily Seat Shortage & Metrics</h2> {/* MODIFIED TITLE */}

          <div className="space-y-6 flex-grow">
            <div className="overflow-x-auto rounded-md shadow-lg border border-gray-200">
              <table className="min-w-full bg-white rounded-md overflow-hidden">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold">Scenario</th>
                    <th className="py-3 px-4 text-center text-sm font-semibold tooltip" aria-describedby="avg-shortage-tooltip">Avg Shortage
                        <span id="avg-shortage-tooltip" className="tooltiptext" role="tooltip">Avg. employees without a desk per day.</span>
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-semibold tooltip" aria-describedby="deviation-tooltip">Pref Deviation
                        <span id="deviation-tooltip" className="tooltiptext" role="tooltip">Avg. days an employee's attendance deviates from their preference due to policy. Lower is more flexible.</span>
                    </th>
                    {weekDayNames.map(day => (
                       <th key={day} className="py-3 px-2 text-center text-sm font-semibold">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(results)
                    .filter(([key, value]) => key !== "Imported CSV Data" && value && (Array.isArray(value.dailyAverages) || value.dailyAverages === null))
                    .map(([scenario, resultObj]) => (
                    <tr key={scenario} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-3 px-4 text-gray-800 text-sm">{scenario}</td>
                      <td className="py-3 px-4 text-gray-800 text-sm font-medium text-center">
                         {resultObj && typeof resultObj.overallAverage === 'number' ? Math.round(resultObj.overallAverage) : (resultObj.overallAverage === null ? 'N/A' : 'Err')}
                      </td>
                      {/* ADDED CELL for new metric */}
                      <td className="py-3 px-4 text-gray-800 text-sm font-medium text-center">
                        {resultObj && typeof resultObj.averagePreferenceDeviation === 'number' ? resultObj.averagePreferenceDeviation.toFixed(2) : 'N/A'}
                      </td>
                      {weekDayNames.map((dayName, index) => (
                        <td key={`${scenario}-${dayName}`} className="py-3 px-2 text-gray-800 text-sm text-center">
                          {resultObj && Array.isArray(resultObj.dailyAverages) && typeof resultObj.dailyAverages[index] === 'number'
                                        ? Math.round(resultObj.dailyAverages[index])
                                        : (resultObj.dailyAverages === null ? 'N/A' : 'Err')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ... (existing Attendance Distribution Table) ... */}
            <div className="bg-gray-50 p-4 rounded-md shadow-lg border border-gray-200 mt-6">
              <h3 className="text-xl font-semibold text-indigo-700 mb-4 text-center border-b-2 border-indigo-100 pb-3">Attendance Distribution Comparison (% of Employees)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-md overflow-hidden">
                  <thead className="bg-indigo-600 text-white">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold">Source / Scenario</th>
                      {attendanceDays.map(days => (
                        <th key={days} className="py-3 px-2 text-center text-sm font-semibold">{days} Day{days === 1 ? '' : 's'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(results)
                      .filter(([key, value]) => value && Array.isArray(value.attendanceDistribution) && value.attendanceDistribution.length === 6)
                      .map(([scenarioName, data]) => (
                      <tr key={scenarioName} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="py-3 px-4 text-gray-800 text-sm">{scenarioName}</td>
                        {data.attendanceDistribution.map((percentage, index) => (
                          <td key={`${scenarioName}-dist-${index}`} className="py-3 px-2 text-gray-800 text-sm text-center">
                            {typeof percentage === 'number' ? percentage.toFixed(1) : 'N/A'}%
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* ... (existing Excluded Outlier Weeks display) ... */}
             {excludedWeeksLog && excludedWeeksLog.length > 0 && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-300 rounded-md text-sm">
                <h4 className="font-semibold text-yellow-800 mb-2">Note on Data Processing:</h4>
                <p className="text-yellow-700">The following weeks were identified as potential outliers and were excluded from parameter estimation and the "Imported CSV Data" distribution:</p>
                <ul className="list-disc list-inside mt-2 text-yellow-700">
                  {excludedWeeksLog.map((week, index) => (
                    <li key={index}>{week}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
};

export default ResultsDisplayPanel;