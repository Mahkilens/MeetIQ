const OpenAI = require("openai");
const buildExtractPrompt = require("./prompt.extract.v1");
const buildWritePrompt = require("./prompt.write.v1");
const validateV1 = require("./validate.v1");
const buildRepairPrompt = require("./prompt.repair.v1");

function mustParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("AI returned invalid JSON");
    err.raw = text;
    throw err;
  }
}

async function repairOnce({ client, badJsonText, ajvErrors }) {
  const repairRes = await client.responses.create({
    model: "gpt-5.2",
    input: buildRepairPrompt({
      badJsonText,
      ajvErrors
    })
  });

  return mustParseJson(repairRes.output_text);
}

module.exports = async function runPipelineV1({ transcriptText, apiKey }) {
  const client = new OpenAI({ apiKey });

  // 1) Extract
  const extractRes = await client.responses.create({
    model: "gpt-5.2",
    input: buildExtractPrompt(transcriptText)
  });
  const extracted = mustParseJson(extractRes.output_text);

  // 2) Write
  const writeRes = await client.responses.create({
    model: "gpt-5.2",
    input: buildWritePrompt(extracted)
  });
  const written = mustParseJson(writeRes.output_text);

  // 3) Merge into your app-facing schema v1
  const finalResult = {
    schema_version: "1.0",
    summary: written.summary,
    action_items: extracted.action_items
  };

  // 4) Validate → repair once → validate again
  try {
    return validateV1(finalResult);
  } catch (e) {
    const repaired = await repairOnce({
      client,
      badJsonText: JSON.stringify(finalResult),
      ajvErrors: e.details || [{ message: e.message }]
    });

    return validateV1(repaired);
  }
};
