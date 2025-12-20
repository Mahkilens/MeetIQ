export async function summarizeTranscript(transcriptText) {
  const res = await fetch("http://localhost:5002/api/ai/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcriptText })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.data = data;
    throw err;
  }

  return data;
}
