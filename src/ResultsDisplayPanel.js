// src/ResultsDisplayPanel.js
import React from 'react'; // Removed useState as activeTab is now a prop
import Tippy from '@tippyjs/react';
import LlmInsightsPanel from './LlmInsightsPanel'; // Import LlmInsightsPanel

const ResultsDisplayPanel = ({
  results, // This will be either modeledResults or empiricalResults based on viewMode for simulation tab
  modeledResults, // Pass separately for LLM
  empiricalResults, // Pass separately for LLM
  csvEmpiricalPreferences, // To know if empirical data exists for LLM context
  isLoading,
  currentViewMode,  // For the "Simulation Results" tab's internal toggle
  setCurrentViewMode, // For the "Simulation Results" tab's internal toggle
  showToggle,         // For the "Simulation Results" tab's internal toggle
  excludedWeeksLog,
  numSimulations,
  numEmployees,
  deskRatio,
  getLlmInsights,     // For LlmInsightsPanel
  isLoadingLlm,       // For LlmInsightsPanel
  llmInsights,        // For LlmInsightsPanel
  activeTab,          // New prop
  _scenarioProgress,  // Accept the prop to satisfy ESLint in App.js
  overallProgress,    // New prop for progress bar
  setActiveTab,       // New prop
}) => {  const hasSimulationResults = Object.keys(results).length > 0; // For the simulation tab
  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const attendanceDays = [0, 1, 2, 3, 4, 5];

  const renderSimulationResults = () => (
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

      <h2 className="text-xl font-semibold text-indigo-700 mb-2 pb-3 text-center border-b-2 border-indigo-100">Weekly Simulation: Daily Seat Shortage & Metrics</h2>
      <div className="space-y-6 flex-grow">
        <div className="overflow-x-auto rounded-md shadow-lg border border-gray-200">
          <table className="min-w-full bg-white rounded-md overflow-hidden">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold">Scenario</th>
                <Tippy content="Avg. employees without a desk per day." placement="top">
                  <th className="py-3 px-4 text-center text-sm font-semibold">
                    Avg Shortage
                  </th>
                </Tippy>
                <Tippy content="Avg. days an employee's attendance deviates from their preference due to policy. Lower is more flexible." placement="top">
                  <th className="py-3 px-4 text-center text-sm font-semibold">
                    Pref Deviation
                  </th>
                </Tippy>
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
  );

  return (
    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-300 flex flex-col">
      {/* Main Tab Navigation */}
      <div className="mb-4 flex border-b border-gray-300">
        <button
          onClick={() => setActiveTab('simulation')}
          className={`flex-1 py-2 px-4 text-center text-lg font-semibold transition-colors focus:outline-none ${activeTab === 'simulation' ? 'border-b-2 border-indigo-700 text-indigo-700' : 'text-gray-600 hover:text-indigo-600'}`}
        >
          Simulation Results
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 py-2 px-4 text-center text-lg font-semibold transition-colors focus:outline-none ${activeTab === 'insights' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-600 hover:text-sky-600'}`}
        >
          ✨ Policy Insights
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'simulation' && (
        <>
          {!hasSimulationResults && !isLoading && (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-4">
              <p className="text-xl mb-4">Welcome to the Simulator!</p>
              <p>Adjust the parameters on the left and click "Run Simulation" to see the results.</p>
            </div>
          )}
          {isLoading && ( // Show progress bar whenever loading, even if there are old results
            <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-600 p-4">
              <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lg font-medium mb-2">Calculating scenarios... please wait.</p>
              <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
              <p className="text-sm font-medium mt-2">{overallProgress}% Complete</p>
            </div>
          )}
          {!isLoading && hasSimulationResults && renderSimulationResults()}
        </>
      )}

      {activeTab === 'insights' && (
        <LlmInsightsPanel
          // Pass all results for LLM context, not just the currently viewed one
          modeledResults={modeledResults}
          empiricalResults={empiricalResults}
          csvEmpiricalPreferences={csvEmpiricalPreferences}
          getLlmInsights={getLlmInsights}
          isLoadingLlm={isLoadingLlm}
          llmInsights={llmInsights}
          isLoading={isLoading} // Pass main simulation loading state
        />
      )}
    </div>
  );
};

export default ResultsDisplayPanel;