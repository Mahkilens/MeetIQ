require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { placeholderMeeting } = require("./placeholderMeeting");
const runPipelineV1 = require("../ai/run.pipeline.v1");


const PORT = Number(process.env.PORT) || 5002;

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173"
  })
);

app.use(express.json());

app.post("/api/ai/summarize", async (req, res) => {
  try {
    const { transcriptText } = req.body;

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
      raw: e.raw // keep for dev; remove later if you want
    });
  }
});


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
      .replace(/[^a-zA-Z0-9._-]/g, "_")``
      .slice(0, 120);

    const ext = path.extname(safeOriginal);
    const base = path.basename(safeOriginal, ext);
    const stamp = Date.now();
    cb(null, `${base}-${stamp}${ext}`);
  }
});

const upload = multer({ storage });

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

app.post("/api/ai/summarize", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Summarize this meeting. Include:
- Bullet summary
- Action items
- Owners if mentioned

Transcript:
${text}`,
    });

    res.json({ summary: response.output_text });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

