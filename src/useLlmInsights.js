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
      I have performed a Monte Carlo simulation for office seat utilization.
      The simulation models employees fulfilling a weekly target number of attendance days,
      with the specific days of attendance being random within each week.
      The results include the average number of employees without a desk per day (overall and for Mon-Fri),
      and the average distribution of how many days employees attend per week (0 to 5 days).

      Here are the simulation parameters:
      - Number of Employees: ${numEmployees}
      - Desk Ratio (Seats / Employees): ${deskRatio} (meaning ${Math.round(numEmployees * deskRatio)} available seats)
      - Average Employee Preference for days in office: ${meanPreference.toFixed(1)} days
      - Standard Deviation of Employee Preference for days in office: ${stdDevPreference.toFixed(1)}
      - Number of Simulated Weeks: ${numSimulations}
      - Day Popularity Weights (Mon-Fri): [${(dayWeights || [1,1,1,1,1]).join(', ')}]

      Here are the simulation results for various scenarios and potentially imported CSV data:
      ${Object.entries(results).map(([scenario, resultObj]) => {
        // Format daily averages if available
        const dailyAvgString = resultObj.dailyAverages
          ? `Daily Average Employees Without Desk (Mon-Fri): ${resultObj.dailyAverages.map(d => Math.round(d)).join(', ')}`
          : 'Daily Average Employees Without Desk: N/A';

        // Format attendance distribution if available
        const attendanceDistString = resultObj.attendanceDistribution
          ? `Attendance Distribution (0-5 days, % of employees): ${resultObj.attendanceDistribution.map(p => p.toFixed(1) + '%').join(', ')}`
          : 'Attendance Distribution: N/A';

        // Format overall average if available
        const overallAvgString = typeof resultObj.overallAverage === 'number'
          ? `Overall Average Employees Without Desk: ${Math.round(resultObj.overallAverage)}`
          : (resultObj.overallAverage === null ? 'Overall Average Employees Without Desk: N/A' : 'Overall Average Employees Without Desk: Error');


        return `
        - Source/Scenario: ${scenario}
          - ${overallAvgString}
          - ${dailyAvgString}
          - ${attendanceDistString}
        `;
      }).join('')}

      Please provide a brief summary of these results. Compare the "Imported CSV Data" distribution to the simulated scenarios. Then, for the top 2-3 best-performing scenarios (those with the lowest "Overall Average Employees Without Desk", excluding "Imported CSV Data" if it doesn't have this metric), analyze their potential pros and cons from both the company's and the employees' perspectives.
      Consider the daily breakdown and the attendance distribution patterns if they reveal significant insights (e.g., how policies shift the number of days people come in). Focus on clarity and actionable insights.
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
