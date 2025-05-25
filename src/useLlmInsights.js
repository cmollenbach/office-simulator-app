// src/useLlmInsights.js
import { useState, useCallback } from 'react';

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"; // Using 2.0 Flash as specified in your original worker

const useLlmInsights = () => {
  const [llmInsights, setLlmInsights] = useState("");
  const [isLoadingLlm, setIsLoadingLlm] = useState(false);

  const formatResultsForPrompt = (title, resultsObject) => {
    if (!resultsObject || Object.keys(resultsObject).length === 0) {
      return `\nNo ${title.toLowerCase()} available.\n`;
    }
    return `\n${title}:\n` + Object.entries(resultsObject).map(([scenario, resultObj]) => {
      const dailyAvgString = resultObj.dailyAverages
        ? `Daily Avg Employees Without Desk (Mon-Fri): ${resultObj.dailyAverages.map(d => typeof d === 'number' ? Math.round(d) : 'N/A').join(', ')}`
        : 'Daily Avg Employees Without Desk: N/A';
      const attendanceDistString = resultObj.attendanceDistribution
        ? `Attendance Distribution (0-5 days, % of employees): ${resultObj.attendanceDistribution.map(p => typeof p === 'number' ? p.toFixed(1) + '%' : 'N/A').join(', ')}`
        : 'Attendance Distribution: N/A';
      const prefDeviationString = typeof resultObj.averagePreferenceDeviation === 'number'
        ? `Avg. Preference Deviation: ${resultObj.averagePreferenceDeviation.toFixed(2)} days`
        : 'Avg. Preference Deviation: N/A';
      const overallAvgString = typeof resultObj.overallAverage === 'number'
        ? `Overall Avg Employees Without Desk: ${Math.round(resultObj.overallAverage)}`
        : (resultObj.overallAverage === null ? 'Overall Avg Employees Without Desk: N/A' : 'Overall Avg Employees Without Desk: Err');
      return `
      - Scenario: ${scenario}
        - ${overallAvgString}
        - ${prefDeviationString}
        - ${dailyAvgString}
        - ${attendanceDistString}
      `;
    }).join('');
  };

  const fetchLlmInsightsData = useCallback(async (simulationData) => {
    // Destructure modeledResults and empiricalResults
    const {
        numEmployees, deskRatio, meanPreference, stdDevPreference,
        numSimulations, dayWeights,
        modeledResults, empiricalResults, csvAvailable // empiricalResults can be null
    } = simulationData;

    setIsLoadingLlm(true);
    setLlmInsights("");

    let empiricalResultsPromptSection = "";
    if (csvAvailable && empiricalResults && Object.keys(empiricalResults).length > 0) {
      empiricalResultsPromptSection = formatResultsForPrompt("Empirical Simulation Results (based on CSV data)", empiricalResults);
    } else if (csvAvailable) {
      empiricalResultsPromptSection = "\nEmpirical Simulation Results (based on CSV data):\nData was imported, but no empirical simulation results are available (e.g., all data was outlier, or simulation with these preferences hasn't been run for all scenarios).\n";
    }


    const prompt = `
      Analyze the following Monte Carlo simulation results for office seat utilization.
      The simulation models employees fulfilling weekly attendance targets.
      "Modeled Results" are based on a normal distribution of employee preferences.
      "Empirical Results" (if provided) are based on preferences derived from imported CSV attendance data.
      Results include average employees without desks, attendance distributions, and average preference deviation (how much policy forces attendance away from preference).

      Simulation Parameters (primarily for Modeled Results, and if CSV was used to estimate these):
      - Number of Employees: ${numEmployees}
      - Desk Ratio (Seats / Employees): ${deskRatio} (meaning ${Math.round(numEmployees * deskRatio)} available seats)
      - Average Employee Preference for days in office (modeled): ${meanPreference.toFixed(1)} days
      - Standard Deviation of Employee Preference for days in office (modeled): ${stdDevPreference.toFixed(1)}
      - Number of Simulated Weeks: ${numSimulations}
      - Day Popularity Weights (Mon-Fri): [${(dayWeights || [1,1,1,1,1]).join(', ')}]
      ${csvAvailable ? "\n- Note: Parameters (Employees, Avg. Preference, Std Dev) might have been updated based on CSV import for modeled scenarios if CSV was processed." : ""}

      ${formatResultsForPrompt("Modeled Simulation Results", modeledResults)}
      ${empiricalResultsPromptSection}

      Please provide the analysis in the following structured Markdown format.
      Your primary goal is to synthesize modeled and empirical results. For each scenario, provide a single, combined key takeaway if the results are broadly aligned or support similar policy implications, even with minor numerical differences.
      Only if the modeled and empirical results lead to substantially different interpretations or actionable conclusions for a scenario should you present separate "Modeled View" and "Empirical View" details, followed by a summary of "Key Differences".


      ## Overall Summary (Max 3-4 sentences)
      Briefly summarize the key findings from all scenarios.
      Consider both seat shortage and preference deviation. If modeled and empirical results are available, synthesize them into a combined summary, noting any major discrepancies if they exist.

      ## Top 2-3 Scenarios Analysis (Balancing Low Shortage & Low Deviation)
      Identify the top 2-3 scenarios (excluding "Imported CSV Data" if it only contains raw distribution).
      For each of these top scenarios:
      - ### Scenario Name: [Name of Scenario]
        
        **Key Takeaway:** (1-2 concise sentences. Synthesize modeled and empirical results into a single takeaway if they are broadly aligned or support similar policy implications, even with minor numerical differences. Only if the results lead to substantially different interpretations or actionable conclusions for this scenario should you present separate "Modeled View" and "Empirical View" details followed by a "Key Differences" summary.)

      ## Actionable Recommendations (3-5 bullet points)
      Based on the entire analysis (considering both modeled and empirical data if available), provide actionable recommendations or key takeaways for policy consideration.
      Keep in mind that senior management has a preference for employees to be in the office for many days per week. Your recommendations should acknowledge this preference, perhaps by suggesting how to balance it with employee flexibility and seat availability, or by highlighting scenarios that best meet this preference while minimizing negative impacts.
      Highlight if modeled vs. empirical data suggests different approaches in light of this management preference.
    `;

    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "";
    const apiUrl = `${GEMINI_API_BASE_URL}?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        setLlmInsights(result.candidates[0].content.parts[0].text.trim());
      } else {
        let errorMessage = "Failed to get insights. The response might be empty or in an unexpected format.";
        if(result.error) {
            errorMessage += ` Server error: ${result.error.message || 'Unknown error'}`;
        }
        setLlmInsights(errorMessage);
        console.error("LLM response structure unexpected or error:", result);
      }
    } catch (error) {
      setLlmInsights("Error connecting to the AI service. Please check your network or try again.");
      console.error("Error fetching LLM insights:", error);
    } finally {
      setIsLoadingLlm(false);
    }
  }, []);

  const clearLlmInsights = useCallback(() => {
    setLlmInsights("");
  }, []);

  return { llmInsights, isLoadingLlm, fetchLlmInsightsData, clearLlmInsights };
};

export default useLlmInsights;