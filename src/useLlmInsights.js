// c:\Users\chris\Documents\office-simulator-app\src\useLlmInsights.js
import { useState, useCallback } from 'react';

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const useLlmInsights = () => {
  const [llmInsights, setLlmInsights] = useState("");
  const [isLoadingLlm, setIsLoadingLlm] = useState(false);

  const fetchLlmInsightsData = useCallback(async (simulationData) => {
  const { numEmployees, deskRatio, meanPreference, stdDevPreference, numSimulations, dayWeights, results } = simulationData; // 'results' here is resultsToDisplay

    setIsLoadingLlm(true);
    setLlmInsights(""); // Clears previous insights

    const prompt = `
      Analyze the following Monte Carlo simulation results for office seat utilization.
      The simulation models employees fulfilling weekly attendance targets, with random day selection.
      Results include average employees without desks, attendance distributions, and average preference deviation (how much policy forces attendance away from preference).

      Simulation Parameters:
      - Number of Employees: ${numEmployees}
      - Desk Ratio (Seats / Employees): ${deskRatio} (meaning ${Math.round(numEmployees * deskRatio)} available seats)
      - Average Employee Preference for days in office: ${meanPreference.toFixed(1)} days
      - Standard Deviation of Employee Preference for days in office: ${stdDevPreference.toFixed(1)}
      - Number of Simulated Weeks: ${numSimulations}
      - Day Popularity Weights (Mon-Fri): [${(dayWeights || [1,1,1,1,1]).join(', ')}]

      Simulation Results:
      ${Object.entries(results).map(([scenario, resultObj]) => {
        const dailyAvgString = resultObj.dailyAverages
          ? `Daily Avg Employees Without Desk (Mon-Fri): ${resultObj.dailyAverages.map(d => Math.round(d)).join(', ')}`
          : 'Daily Avg Employees Without Desk: N/A';
        const attendanceDistString = resultObj.attendanceDistribution
          ? `Attendance Distribution (0-5 days, % of employees): ${resultObj.attendanceDistribution.map(p => p.toFixed(1) + '%').join(', ')}`
          : 'Attendance Distribution: N/A';
        const prefDeviationString = typeof resultObj.averagePreferenceDeviation === 'number'
          ? `Avg. Preference Deviation: ${resultObj.averagePreferenceDeviation.toFixed(2)} days`
          : 'Avg. Preference Deviation: N/A';
        const overallAvgString = typeof resultObj.overallAverage === 'number'
          ? `Overall Avg Employees Without Desk: ${Math.round(resultObj.overallAverage)}`
          : (resultObj.overallAverage === null ? 'Overall Avg Employees Without Desk: N/A' : 'Overall Avg Employees Without Desk: Error');
        return `
        - Scenario: ${scenario}
          - ${overallAvgString}
          - ${prefDeviationString}
          - ${dailyAvgString}
          - ${attendanceDistString}
        `;
      }).join('')}

      Please provide the analysis in the following structured Markdown format, keeping each section concise:

      ## Overall Summary (Max 3-4 sentences)
      Briefly summarize the key findings from all scenarios.
      Consider both seat shortage and preference deviation.

      ## Top 2-3 Scenarios Analysis (Balancing Low Shortage & Low Deviation)
      Identify the top 2-3 scenarios (excluding "Imported CSV Data" if it lacks metrics). For each of these top scenarios, provide:
      - ### Scenario Name: [Name of Scenario]
        
        **Key Insight for this Scenario:** (1-2 concise sentences, considering both shortage and deviation)

      ## Actionable Recommendations (3-5 bullet points)
      Based on the entire analysis, provide a few actionable recommendations or key takeaways for policy consideration.
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
        setLlmInsights("Failed to get insights. The response might be empty or in an unexpected format.");
        console.error("LLM response structure unexpected:", result);
      }
    } catch (error) {
      setLlmInsights("Error connecting to the AI service. Please check your network or try again.");
      console.error("Error fetching LLM insights:", error);
    } finally {
      setIsLoadingLlm(false);
    }
  }, []);

  return { llmInsights, isLoadingLlm, fetchLlmInsightsData };
};

export default useLlmInsights;
