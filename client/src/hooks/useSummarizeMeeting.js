import { useState } from "react";
import { summarizeTranscript } from "../api/ai";

export function useSummarizeMeeting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function run(transcriptText) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await summarizeTranscript(transcriptText);
      setResult(data);
      return data;
    } catch (e) {
      setError(e.message || "Something went wrong");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, result, run, setResult };
}
