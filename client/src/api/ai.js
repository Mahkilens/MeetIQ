import { supabase } from "../lib/supabaseClient";

/**
 * PRIMARY FLOW
 * Creates a meeting:
 * - Authenticates user via Supabase access token
 * - Runs AI pipeline on server
 * - Persists to `public.meetings`
 * - Returns { id }
 */
export async function createMeetingFromTranscript({
  transcriptText,
  summaryMode = "Default"
}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data?.session?.access_token;
  if (!token) throw new Error("Not logged in");

  const res = await fetch("http://localhost:5002/api/meetings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ transcriptText, summaryMode })
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error || `Failed to create meeting (${res.status})`);
  }

  return json; // { id }
}
