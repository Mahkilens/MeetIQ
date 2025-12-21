require("dotenv").config();

const fs = require("fs");
const os = require("os");
const path = require("path");
const OpenAI = require("openai");

const { supabaseAdmin } = require("../lib/supabaseServer");
const runPipelineV1 = require("../../ai/run.pipeline.v1");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getNextQueuedJob() {
  // IMPORTANT: maybeSingle() prevents "no rows returned" errors
  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return job || null;
}

async function markJob(id, patch) {
  const { error } = await supabaseAdmin
    .from("jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

async function getSignedAudioUrl(audioPath) {
  const { data, error } = await supabaseAdmin.storage
    .from("audio")
    .createSignedUrl(audioPath, 60 * 10); // 10 min

  if (error) throw error;
  return data.signedUrl;
}

async function downloadToTempFile(url, filenameHint = "audio.bin") {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download audio (${resp.status})`);

  const ext = path.extname(filenameHint) || ".bin";
  const tmpPath = path.join(os.tmpdir(), `meetiq_${Date.now()}${ext}`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);

  return tmpPath;
}

async function transcribeFile(filePath) {
  const tr = await openai.audio.transcriptions.create({
    model: "gpt-4o-mini-transcribe",
    file: fs.createReadStream(filePath)
  });

  return tr.text || "";
}

async function processJob(job) {
  if (!job.audio_path) throw new Error("Job missing audio_path");

  // 1) Download audio (signed URL)
  const signedUrl = await getSignedAudioUrl(job.audio_path);
  const tmp = await downloadToTempFile(signedUrl, job.audio_path);

  try {
    // 2) Transcribe
    const transcriptText = await transcribeFile(tmp);
    if (!transcriptText.trim()) throw new Error("Transcription returned empty text");

    // store transcript back onto job
    await markJob(job.id, { transcript_text: transcriptText });

    // 3) Run AI pipeline

// LOG: transcript quality
console.log("🧾 transcript length:", transcriptText.length);
console.log(
  "🧾 transcript preview (first 200):",
  transcriptText.slice(0, 200).replace(/\s+/g, " ")
);

let aiResult = null;

try {
  aiResult = await runPipelineV1({
    transcriptText,
    apiKey: process.env.OPENAI_API_KEY
  });

  // LOG: AI result basics
  const rawPreview =
    typeof aiResult === "string"
      ? aiResult.slice(0, 300)
      : JSON.stringify(aiResult).slice(0, 300);

  console.log("🤖 AI result preview (first 300):", rawPreview);

  // LOG: keys + common fields
  if (aiResult && typeof aiResult === "object") {
    console.log("✅ AI result keys:", Object.keys(aiResult));
    console.log("✅ AI summary keys:", Object.keys(aiResult.summary || {}));
    console.log("✅ AI tldr:", aiResult?.summary?.tldr);
    console.log(
      "✅ AI bullets length:",
      Array.isArray(aiResult?.summary?.bullets) ? aiResult.summary.bullets.length : 0
    );
    console.log(
      "✅ AI action_items length:",
      Array.isArray(aiResult?.action_items) ? aiResult.action_items.length : 0
    );
  } else {
    console.log("⚠️ AI result is not an object. type:", typeof aiResult);
  }
} catch (e) {
  console.log("❌ runPipelineV1 failed:", e.message);
  throw e; // keep your existing error handling behavior
}

    // 4) Insert meeting
    const { data: meeting, error: insertError } = await supabaseAdmin
      .from("meetings")
      .insert({
        user_id: job.user_id,
        title: aiResult?.summary?.title || "Meeting Summary",
        summary_json: aiResult,
        transcript_text: transcriptText,
        summary_mode: job.summary_mode || "Default"
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // 5) Mark job done
    await markJob(job.id, {
      status: "done",
      meeting_id: meeting.id,
      error: null
    });

    console.log("✅ Job done:", job.id, "→ meeting:", meeting.id);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}

async function main() {
  console.log("🧵 Jobs worker started");

  while (true) {
    try {
      const job = await getNextQueuedJob();

      if (!job) {
        await sleep(1500);
        continue;
      }

      console.log("▶️ Processing job:", job.id);

      // claim it
      await markJob(job.id, { status: "processing" });

      try {
        await processJob(job);
      } catch (err) {
        console.error("❌ Job failed:", job.id, err);

        await markJob(job.id, {
          status: "error",
          error: err.message || "Job failed"
        });
      }
    } catch (outer) {
      console.error("Worker loop error:", outer);
      await sleep(2000);
    }
  }
}

main();
