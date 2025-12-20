module.exports = function buildRepairPrompt({ badJsonText, ajvErrors }) {
  return [
    {
      role: "system",
      content: `
You are MeetIQ AI. You MUST output valid JSON only.
You are given:
- A JSON string that FAILED schema validation
- AJV validation errors describing what is wrong

Your task:
- Return a FIXED JSON object that matches the required schema exactly.
Rules:
- Output JSON only (no markdown, no explanation)
- Do not add extra keys
- If a field is missing, add it with null/empty values as appropriate
- If a field has wrong type, coerce to the correct type if possible, otherwise use null
`
    },
    {
      role: "user",
      content:
        `Bad JSON:\n${badJsonText}\n\nAJV errors:\n${JSON.stringify(ajvErrors, null, 2)}`
    }
  ];
};
