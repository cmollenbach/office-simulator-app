// c:\Users\chris\Documents\office-simulator-app\src\useLlmInsights.js
import { useState, useCallback } from 'react'; // Ensure useCallback is imported

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const useLlmInsights = () => {
  const [llmInsights, setLlmInsights] = useState("");
  const [isLoadingLlm, setIsLoadingLlm] = useState(false);

  const fetchLlmInsightsData = useCallback(async (simulationData) => {
  const { numEmployees, deskRatio, meanPreference, stdDevPreference, numSimulations, dayWeights, results } = simulationData;

    setIsLoadingLlm(true);
    setLlmInsights(""); // Clears previous insights

    const prompt = `
      I have performed a Monte Carlo simulation for office seat utilization.
      The simulation models employees fulfilling a weekly target number of attendance days,
      with the specific days of attendance being random within each week.
      The reported "Avg. % Without Seat" is the average daily shortage over many simulated weeks.
      Daily averages for Monday to Friday are also provided.

      Here are the simulation parameters:
      - Number of Employees: ${numEmployees}
      - Desk Ratio (Seats / Employees): ${deskRatio} (meaning ${Math.round(numEmployees * deskRatio)} available seats)
      - Average Employee Preference for days in office: ${meanPreference.toFixed(1)} days
      - Standard Deviation of Employee Preference for days in office: ${stdDevPreference.toFixed(1)}  
      - Number of Simulated Weeks: ${numSimulations}
      - Day Popularity Weights (Mon-Fri): [${(dayWeights || [1,1,1,1,1]).join(', ')}]

            Here are the simulation results for various scenarios:
      ${Object.entries(results).map(([scenario, resultObj]) => `
        - Scenario: ${scenario}
          - Overall Average Daily % Without Seat: ${resultObj.overallAverage.toFixed(2)}%
          - Daily Averages (Mon-Fri): ${resultObj.dailyAverages.map(d => d.toFixed(2) + '%').join(', ')}
      `).join('')}

      Please provide a brief summary of these results. Then, for the top 2-3 best-performing scenarios (those with the lowest "Avg. % Without Seat"), analyze their potential pros and cons from both the company's and the employees' perspectives.
            Consider the daily breakdown if it reveals significant patterns (e.g., one scenario is good overall but terrible on Wednesdays). Focus on clarity and actionable insights.
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
  }, []); // Empty dependency array because this function itself doesn't depend on any props/state from the component *calling* the hook.
          // It only uses its arguments and the stable `setIsLoadingLlm` and `setLlmInsights`.

  return { llmInsights, isLoadingLlm, fetchLlmInsightsData };
};

export default useLlmInsights;
