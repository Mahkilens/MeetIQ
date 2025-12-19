// server/ai/run.v1.js
const OpenAI = require("openai");
const buildPrompt = require("./prompt.v1");

module.exports = async function runAiV1({ transcriptText, apiKey }) {
  const client = new OpenAI({ apiKey });

  const res = await client.responses.create({
    model: "gpt-5.2",
    input: buildPrompt(transcriptText)
  });

  const output = res.output_text;

  // fail fast if not JSON
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    const err = new Error("AI returned invalid JSON");
    err.raw = output;
    throw err;
  }

  return parsed;
};
