// c:\Users\chris\Documents\office-simulator-app\src\LlmInsightsPanel.js
import React from 'react';
import ReactMarkdown from 'react-markdown';

const LlmInsightsPanel = ({
  results,
  getLlmInsights,
  isLoadingLlm,
  llmInsights,
  isLoading, // Main simulation loading state
}) => {
  const hasResults = Object.keys(results).length > 0;

  return (
    <div className="bg-indigo-50 p-6 rounded-xl shadow-lg border border-indigo-300 flex flex-col">
      <h2 className="text-2xl font-semibold text-indigo-700 mb-6 pb-3 text-center flex items-center justify-center border-b-2 border-indigo-200">
        <span className="mr-2">✨</span> Policy Insights
      </h2>
      {hasResults ? (
        <>
          <button
            onClick={getLlmInsights}
            className="w-full bg-sky-500 text-white py-3 px-6 rounded-md font-semibold text-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all duration-150 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center mb-6"
            disabled={isLoadingLlm || isLoading}
          >
            {isLoadingLlm ? (
              <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : <span className="mr-2">🧠</span>}
            {isLoadingLlm ? 'Generating Insights...' : 'Get Policy Insights'}
          </button>
          {llmInsights && (
            <div className="w-full bg-white p-4 sm:p-6 rounded-md border border-indigo-100 text-gray-800 flex-grow overflow-y-auto">
              <div className="w-full prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none custom-prose-full-width"> {/* Added custom-prose-full-width */}
                <ReactMarkdown>{llmInsights}</ReactMarkdown>
              </div>
            </div>
          )}
          {!llmInsights && !isLoadingLlm && (
             <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-500 p-4">
                <p>Click the button above to generate AI-powered policy insights based on the simulation results.</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-indigo-500 p-4">
          <p>Run a simulation to generate policy insights.</p>
        </div>
      )}
    </div>
  );
};

export default LlmInsightsPanel;
