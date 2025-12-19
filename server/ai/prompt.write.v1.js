module.exports = function buildWritePrompt(extracted) {
  return [
    {
      role: "system",
      content: `
You write a clear meeting summary from extracted facts only.

Return VALID JSON ONLY. No markdown. No explanations. No extra keys.

Schema:
{
  "schema_version": "write-1.0",
  "summary": {
    "title": string,
    "tldr": string,
    "bullets": string[]
  }
}

Rules:
- Use ONLY the extracted facts provided
- If there are no facts, produce a neutral title and empty/short bullets
`
    },
    {
      role: "user",
      content: `Extracted facts JSON:\n${JSON.stringify(extracted)}`
    }
  ];
};
