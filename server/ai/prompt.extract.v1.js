module.exports = function buildExtractPrompt(transcriptText) {
  return [
    {
      role: "system",
      content: `
You are MeetIQ AI: extract structured facts from a meeting transcript.

Return VALID JSON ONLY. No markdown. No explanations. No extra keys.

Schema:
{
  "schema_version": "extract-1.0",
  "action_items": [
    {
      "task": string,
      "owner": string|null,
      "due_date": string|null,
      "evidence": { "start_s": number|null, "end_s": number|null }
    }
  ],
  "decisions": [
    { "decision": string, "evidence": { "start_s": number|null, "end_s": number|null } }
  ],
  "open_questions": [
    { "question": string, "assigned_to": string|null, "evidence": { "start_s": number|null, "end_s": number|null } }
  ]
}

Rules:
- Do NOT guess or infer
- If unknown, use null
- If timestamps aren’t present, use null for start_s/end_s (never invent timestamps)
- Keep tasks concise and actionable (verb-first)
`
    },
    {
      role: "user",
      content: `Transcript:\n"""\n${transcriptText}\n"""`
    }
  ];
};
