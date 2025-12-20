require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { placeholderMeeting } = require("./placeholderMeeting");
const runPipelineV1 = require("../ai/run.pipeline.v1");
const { supabaseAdmin } = require("./lib/supabaseServer");

const PORT = Number(process.env.PORT) || 5002;

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173"
  })
);

app.use(express.json());

/**
 * Create a meeting:
 * - Auth via Supabase access token (Bearer)
 * - Run AI pipeline
 * - Insert into public.meetings
 * - Return { id }
 */
app.post("/api/meetings", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = authData.user;
    const { transcriptText, summaryMode = "Default" } = req.body || {};

    if (!transcriptText || typeof transcriptText !== "string") {
      return res.status(400).json({ error: "transcriptText is required" });
    }

    const aiResult = await runPipelineV1({
      transcriptText,
      apiKey: process.env.OPENAI_API_KEY
    });

    const { data: meeting, error: insertError } = await supabaseAdmin
      .from("meetings")
      .insert({
        user_id: user.id,
        title: aiResult?.summary?.title || "Meeting Summary",
        summary_json: aiResult,
        transcript_text: transcriptText,
        summary_mode: summaryMode
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return res.json({ id: meeting.id });
  } catch (e) {
    console.error("POST /api/meetings failed:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
});

/**
 * AI summarize (returns raw pipeline JSON; useful for dev/debug)
 */
app.post("/api/ai/summarize", async (req, res) => {
  try {
    const { transcriptText } = req.body || {};

    if (!transcriptText || typeof transcriptText !== "string") {
      return res.status(400).json({ error: "transcriptText is required" });
    }

    const result = await runPipelineV1({
      transcriptText,
      apiKey: process.env.OPENAI_API_KEY
    });

    return res.json(result);
  } catch (e) {
    console.error("AI summarize error:", e);
    return res.status(500).json({
      error: e.message || "AI failed",
      raw: e.raw // dev-only; okay for now
    });
  }
});

// ----- Uploads (placeholder/local pipeline pieces) -----

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safeOriginal = (file.originalname || "upload")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);

    const ext = path.extname(safeOriginal);
    const base = path.basename(safeOriginal, ext);
    const stamp = Date.now();
    cb(null, `${base}-${stamp}${ext}`);
  }
});

const upload = multer({ storage });

// In-memory placeholder store (kept for now)
const meetings = new Map();

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "No file uploaded" });
  }

  const meetingId = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const summaryMode = req.body?.summaryMode || "Default";

  const meeting = {
    ...placeholderMeeting,
    id: meetingId,
    summaryMode,
    title: placeholderMeeting.title,
    uploadedFilename: req.file.filename,
    originalFilename: req.file.originalname
  };

  meetings.set(meetingId, meeting);

  return res.json({ ok: true, meetingId, filename: req.file.filename });
});

app.get("/api/meetings/:id", (req, res) => {
  const { id } = req.params;

  const meeting = meetings.get(id);
  if (!meeting) {
    return res.json({ ok: true, meeting: { ...placeholderMeeting, id } });
  }

  return res.json({ ok: true, meeting });
});

app.get("/api/health", (req, res) => {
  return res.json({ ok: true });
});

console.log("OpenAI key loaded:", !!process.env.OPENAI_API_KEY);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
