// c:\Users\chris\Documents\office-simulator-app\src\ResultsDisplayPanel.js
import React from 'react';

const ResultsDisplayPanel = ({
  results,
  isLoading,
  chartRef,
  numSimulations,
  numEmployees,
  deskRatio,
}) => {
  const hasResults = Object.keys(results).length > 0;
  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-300 flex flex-col">
      {!hasResults && !isLoading && (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-4">
          <p className="text-xl mb-4">Welcome to the Simulator!</p>
          <p>Adjust the parameters on the left and click "Run Simulation" to see the results.</p>
          <p className="mt-2 text-sm">This simulation models weekly attendance targets.</p>
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
          <h2 className="text-2xl font-semibold text-indigo-700 mb-2 pb-3 text-center border-b-2 border-indigo-100">Weekly Simulation: Daily Seat Shortage</h2>
          <p className="text-gray-500 text-center text-xs italic mb-6"> 
            (Avg. employees without a desk per day over {numSimulations} simulated weeks, with {numEmployees} employees and {Math.round(numEmployees * deskRatio)} available seats)
          </p>
          <div className="space-y-6 flex-grow">
            <div className="overflow-x-auto rounded-md shadow-lg border border-gray-200">
              <table className="min-w-full bg-white rounded-md overflow-hidden">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold">Scenario</th>
                    <th className="py-3 px-4 text-center text-sm font-semibold">Overall</th>
                    {weekDayNames.map(day => (
                       <th key={day} className="py-3 px-2 text-center text-sm font-semibold">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(results).map(([scenario, resultObj]) => (
                    <tr key={scenario} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-3 px-4 text-gray-800 text-sm">{scenario}</td>
                      <td className="py-3 px-4 text-gray-800 text-sm font-medium text-center">
                         {resultObj && typeof resultObj.overallAverage === 'number' ? Math.round(resultObj.overallAverage) : 'N/A'}
                      </td>
                      {weekDayNames.map((dayName, index) => (
                        <td key={`${scenario}-${dayName}`} className="py-3 px-2 text-gray-800 text-sm text-center">
                          {resultObj && Array.isArray(resultObj.dailyAverages) && typeof resultObj.dailyAverages[index] === 'number'
                                        ? Math.round(resultObj.dailyAverages[index])
                            : 'N/A'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 p-4 rounded-md shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">Visual comparison for each scenario</h3>
              <div className="w-full overflow-x-auto">
                <svg ref={chartRef} className="w-full h-80"></svg>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ResultsDisplayPanel;
