// src/ResultsDisplayPanel.js
import React from 'react';
import PropTypes from 'prop-types';
import Tippy from '@tippyjs/react';
import LlmInsightsPanel from './LlmInsightsPanel';
import PreferenceVsShortageScatterPlot from './PreferenceVsShortageScatterPlot';
import AttendanceDistributionChart from './AttendanceDistributionChart';

const ResultsDisplayPanel = ({
  results,
  modeledResults,
  empiricalResults,
  csvEmpiricalPreferences,
  isLoading,
  currentViewMode,
  setCurrentViewMode,
  showToggle,
  excludedWeeksLog,
  _numSimulations,
  _numEmployees,
  _deskRatio,
  getLlmInsights,
  isLoadingLlm,
  llmInsights,
  activeTab,
  _scenarioProgress,
  overallProgress,
  setActiveTab,
  onExportToExcel, // New prop for export function
}) => {
  const hasSimulationResults = (results && Object.keys(results).length > 0) || (modeledResults && Object.keys(modeledResults).length > 0) || (empiricalResults && Object.keys(empiricalResults).length > 0);
  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const attendanceDays = [0, 1, 2, 3, 4, 5];

  const chartDataSource = (csvEmpiricalPreferences && empiricalResults && Object.keys(empiricalResults).length > 0)
    ? empiricalResults
    : modeledResults;
  
  const chartDataViewName = (csvEmpiricalPreferences && empiricalResults && Object.keys(empiricalResults).length > 0)
    ? "Empirical Data"
    : "Modeled Data";

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
            className={`flex-1 py-2 px-4 text-center text-sm font-medium transition-colors focus:outline-none ${currentViewMode === 'empirical' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
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
                .filter(([_key, value]) => _key !== "Imported CSV Data" && value && (Array.isArray(value.dailyAverages) || value.dailyAverages === null))
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
                  .filter(([_key, value]) => value && Array.isArray(value.attendanceDistribution) && value.attendanceDistribution.length === 6)
                  .map(([scenarioName, data]) => (
                  <tr key={scenarioName} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="py-3 px-4 text-gray-800 text-sm">{scenarioName}</td>
                    {data.attendanceDistribution.map((percentage, index) => (
                      <td key={`${scenarioName}-dist-${index}`} className="py-3 px-2 text-gray-800 text-sm text-center">
                        {typeof percentage === 'number' ? Math.round(percentage) : 'N/A'}%
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
            <p className="text-yellow-700">The following weeks were identified as potential outliers and were excluded from parameter estimation and the &quot;Imported CSV Data&quot; distribution:</p>
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

  const renderGraphsTab = () => (
    <div className="space-y-8 py-4">
       {!hasSimulationResults && !isLoading && (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-4">
          <p className="text-xl mb-4">Run a simulation to view graphs.</p>
        </div>
      )}
      {isLoading && (
         <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-600 p-4">
            <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium mb-2">Calculating scenarios... please wait.</p>
         </div>
      )}
      {!isLoading && hasSimulationResults && (
        <>
            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                <PreferenceVsShortageScatterPlot results={chartDataSource} chartTitle={`Preference Deviation vs. Shortage (${chartDataViewName})`} />
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 mt-8">
                <AttendanceDistributionChart results={chartDataSource} chartTitle={`Attendance Distribution (${chartDataViewName})`} />
            </div>
        </>
      )}
    </div>
  );

  return (
    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-300 flex flex-col">
      <div className="flex justify-between items-center mb-4 border-b border-gray-300">
        {/* Main Tab Navigation */}
        <div className="flex">
            <button
            onClick={() => setActiveTab('simulation')}
            className={`py-2 px-4 text-center text-lg font-semibold transition-colors focus:outline-none ${activeTab === 'simulation' ? 'border-b-2 border-indigo-700 text-indigo-700' : 'text-gray-600 hover:text-indigo-600'}`}
            >
            Simulation Results
            </button>
            <button
            onClick={() => setActiveTab('graphs')} 
            className={`py-2 px-4 text-center text-lg font-semibold transition-colors focus:outline-none ${activeTab === 'graphs' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
            >
            📊 Graphs
            </button>
            <button
            onClick={() => setActiveTab('insights')}
            className={`py-2 px-4 text-center text-lg font-semibold transition-colors focus:outline-none ${activeTab === 'insights' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-600 hover:text-sky-600'}`}
            >
            ✨ Policy Insights
            </button>
        </div>
        <div> {/* Container for the export button to ensure it's on the right */}
          {/* Export Button - visible only if there are results and not loading */}
          {!isLoading && hasSimulationResults && (
            <button
              onClick={onExportToExcel}
              className="ml-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded-md text-sm shadow transition-colors duration-150 ease-in-out"
              title="Export parameters and results to Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1.5 -mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export to Excel
            </button>
          )}
        </div>
      </div>


      {/* Tab Content */}
      {activeTab === 'simulation' && (
        <>
          {!hasSimulationResults && !isLoading && (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 p-4">
              <p className="text-xl mb-4">Welcome to the Simulator!</p>
              <p>Adjust the parameters on the left and click &quot;Run Simulation&quot; to see the results.</p>
            </div>
          )}
          {isLoading && ( 
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
      
      {activeTab === 'graphs' && renderGraphsTab()}

      {activeTab === 'insights' && (
        <LlmInsightsPanel
          modeledResults={modeledResults}
          empiricalResults={empiricalResults}
          csvEmpiricalPreferences={csvEmpiricalPreferences}
          getLlmInsights={getLlmInsights}
          isLoadingLlm={isLoadingLlm}
          llmInsights={llmInsights}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

ResultsDisplayPanel.propTypes = {
  results: PropTypes.object.isRequired,
  modeledResults: PropTypes.object.isRequired,
  empiricalResults: PropTypes.object.isRequired,
  csvEmpiricalPreferences: PropTypes.array,
  isLoading: PropTypes.bool.isRequired,
  currentViewMode: PropTypes.string.isRequired,
  setCurrentViewMode: PropTypes.func.isRequired,
  showToggle: PropTypes.bool.isRequired,
  excludedWeeksLog: PropTypes.arrayOf(PropTypes.string).isRequired,
  _numSimulations: PropTypes.number.isRequired,
  _numEmployees: PropTypes.number.isRequired,
  _deskRatio: PropTypes.number.isRequired,
  getLlmInsights: PropTypes.func.isRequired,
  isLoadingLlm: PropTypes.bool.isRequired,
  llmInsights: PropTypes.string.isRequired,
  activeTab: PropTypes.string.isRequired,
  _scenarioProgress: PropTypes.object.isRequired,
  overallProgress: PropTypes.number.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  onExportToExcel: PropTypes.func.isRequired, // New prop type
};

ResultsDisplayPanel.defaultProps = {
  csvEmpiricalPreferences: null,
};

export default ResultsDisplayPanel;
