// c:\Users\chris\Documents\office-simulator-app\src\LlmInsightsPanel.js
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';

const LlmInsightsPanel = ({
  modeledResults, // Expect modeledResults directly
  empiricalResults, // Expect empiricalResults directly
  // csvEmpiricalPreferences is not directly used here for rendering logic, but by the hook
  getLlmInsights,
  isLoadingLlm,
  llmInsights,
  isLoading, // Main simulation loading state
}) => {
  // Check if either modeled or empirical results have data (excluding "Imported CSV Data" placeholder if it's the only entry)
  const hasModeledData = modeledResults && Object.keys(modeledResults).filter(key => key !== "Imported CSV Data").length > 0;
  const hasEmpiricalData = empiricalResults && Object.keys(empiricalResults).filter(key => key !== "Imported CSV Data").length > 0;
  const canGenerateInsights = hasModeledData || hasEmpiricalData;

  useEffect(() => {
    // Automatically fetch insights if conditions are met when the panel becomes active
    if (canGenerateInsights && !llmInsights && !isLoadingLlm && !isLoading) {
      getLlmInsights();
    }
  }, [canGenerateInsights, llmInsights, isLoadingLlm, isLoading, getLlmInsights]);

  return (
    <div className="flex flex-col flex-grow"> {/* Removed specific background, padding, and border */}
      {canGenerateInsights ? (
        <>
          {isLoadingLlm && (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-600 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
              <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-base font-medium">Generating Insights...</p>
            </div>
          )}
          {!isLoadingLlm && llmInsights && (
            // This is the "white one", now with more prominent styling
            <div className="w-full bg-white p-6 rounded-xl shadow-lg border border-gray-200 text-gray-800 flex-grow overflow-y-auto">
              {/* Inner div for prose typography styling with our custom class */}
              <div className="w-full prose prose-sm max-w-none custom-prose-full-width">
                <ReactMarkdown>{llmInsights}</ReactMarkdown>
              </div>
            </div>
          )}
          {!isLoadingLlm && !llmInsights && canGenerateInsights && ( // Shown if insights can be generated but haven't been (and not loading)
             <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-500 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
                <p>Policy insights will be generated here based on the simulation results.</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-500 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
          <p>Run a simulation to generate policy insights.</p>
        </div>
      )}
    </div>
  );
};

LlmInsightsPanel.propTypes = {
  modeledResults: PropTypes.object,
  empiricalResults: PropTypes.object,
  getLlmInsights: PropTypes.func.isRequired,
  isLoadingLlm: PropTypes.bool.isRequired,
  llmInsights: PropTypes.string,
  isLoading: PropTypes.bool.isRequired,
  // csvEmpiricalPreferences: PropTypes.array, // Not directly used for rendering, but passed to hook. Add if validation desired.
};
export default LlmInsightsPanel;