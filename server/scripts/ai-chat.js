#!/usr/bin/env node
require("dotenv").config();
const readline = require("readline");
const OpenAI = require("openai");
const buildPrompt = require("../ai/prompt.v1");


if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is not set");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("🧠 Ask MeetIQ AI > ", async (input) => {
  try {
    const res = await client.responses.create({
  model: "gpt-5.2",
  input: buildPrompt(input)
});

const output = res.output_text;

try {
  JSON.parse(output);
} catch {
  console.error("❌ Invalid JSON returned:");
  console.error(output);
  process.exit(1);
}

console.log("\n✅ AI response:\n");
console.log(output);

  } catch (e) {
    console.error("❌ OpenAI call failed:");
    console.error(e);
  } finally {
    rl.close();
  }
});
