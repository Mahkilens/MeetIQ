import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import { supabase } from "../lib/supabaseClient";
import { summarizeTranscript } from "../api/ai"; // ✅ NEW

const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4"
];

const ACCEPTED_EXTENSIONS = ["mp3", "wav", "m4a", "mp4"];

const SUMMARY_MODES = [
  "Default",
  "Missed the Meeting",
  "Student",
  "Developer",
  "Manager",
  "Creator"
];

function isAcceptedFile(file) {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;

  const parts = (file.name || "").toLowerCase().split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export default function UploadMeetingPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [summaryMode, setSummaryMode] = useState("Default");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  // ✅ NEW: transcript demo input
  const [transcriptText, setTranscriptText] = useState(
    "We decided to ship Friday. Alex will email the team by tomorrow."
  );
  const [aiStatus, setAiStatus] = useState("idle"); // idle | loading
  const [aiError, setAiError] = useState(null);

  const canUpload = useMemo(() => {
    return status === "idle" && selectedFile && isAcceptedFile(selectedFile);
  }, [status, selectedFile]);

  async function doUpload() {
    if (!selectedFile) return;

    setError(null);

    try {
      setStatus("uploading");

      // 1. Get authenticated user
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("You must be logged in to upload.");
      }

      // 2. Upload file to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // 3. Create job record
      const { data: job, error: insertError } = await supabase
        .from("jobs")
        .insert({
          user_id: user.id,
          status: "queued",
          audio_path: fileName
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setStatus("success");

      // 4. Navigate to results (this is your real pipeline later)
      navigate(`/results/${job.id}`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed");
      setStatus("error");
    }
  }

  // ✅ NEW: Demo summarize (paste transcript → AI → results)
  async function doSummarizeDemo() {
    setAiError(null);
    if (!transcriptText.trim()) {
      setAiError("Paste a transcript first.");
      return;
    }

    try {
      setAiStatus("loading");

      const result = await summarizeTranscript(transcriptText);

      // For now store result client-side; later you'll store in DB keyed by job.id
      const id = crypto.randomUUID();
      sessionStorage.setItem(`meeting:${id}`, JSON.stringify(result));

      navigate(`/results/${id}`);
    } catch (err) {
      console.error(err);
      setAiError(err.message || "AI summarize failed");
    } finally {
      setAiStatus("idle");
    }
  }

  function handlePickedFile(file) {
    setError(null);
    if (!file) return;

    if (!isAcceptedFile(file)) {
      setSelectedFile(file);
      setError("Unsupported file type. Please upload mp3, wav, m4a, or mp4.");
      return;
    }

    setSelectedFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    handlePickedFile(file);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Upload a meeting
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Drop an audio/video file and get structured notes in seconds. (Placeholder pipeline for now.)
            </p>
          </div>

          <Card>
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={onDrop}
              className={`relative flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                isDragging
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,audio/*,video/mp4"
                className="hidden"
                onChange={(e) => handlePickedFile(e.target.files?.[0] || null)}
              />

              <div className="mx-auto h-12 w-12 rounded-2xl bg-white shadow-sm shadow-slate-200/60 ring-1 ring-slate-200" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-900">
                  Drag and drop your file
                </div>
                <div className="text-xs text-slate-500">
                  Accepts mp3, wav, m4a, mp4
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={status !== "idle"}
                >
                  Browse files
                </Button>
                <Button onClick={doUpload} disabled={!canUpload}>
                  Upload
                </Button>
              </div>

              <div className="mt-2 w-full max-w-md rounded-xl bg-white/70 p-3 text-left ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-700">Selected file</div>
                    <div className="mt-1 truncate text-sm text-slate-900">
                      {selectedFile ? selectedFile.name : "No file selected"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-700">Status</div>
                    <div className="mt-1 text-sm text-slate-900">
                      {status === "idle" && "Idle"}
                      {status === "uploading" && "Uploading…"}
                      {status === "processing" && "Processing…"}
                      {status === "done" && "Done"}
                      {status === "success" && "Uploaded"}
                      {status === "error" && "Error"}
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-slate-700">Summary Mode</div>
                <select
                  value={summaryMode}
                  onChange={(e) => setSummaryMode(e.target.value)}
                  disabled={status !== "idle"}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {SUMMARY_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-700">Privacy</div>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Files stay on your machine. Uploads are stored locally under `server/uploads`.
                </div>
              </div>
            </div>

            {/* ✅ NEW: Transcript → AI demo section */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">
                Quick test (paste transcript → AI)
              </div>
              <div className="mt-1 text-xs text-slate-600">
                This is for frontend hookup testing. Audio → transcript comes next.
              </div>

              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
                rows={5}
                placeholder="Paste transcript text here..."
              />

              {aiError ? (
                <div className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-700">
                  {aiError}
                </div>
              ) : null}

              <div className="mt-3">
                <Button onClick={doSummarizeDemo} disabled={aiStatus === "loading"}>
                  {aiStatus === "loading" ? "Summarizing…" : "Summarize transcript"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="text-sm font-semibold text-slate-900">What you’ll get</div>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                Outcome-focused summary, tuned by persona
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                Action items with owner, urgency, and confidence
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                Searchable transcript with timestamps
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-slate-900">Tip</div>
            <div className="mt-2 text-sm text-slate-600">
              Start with a short clip while iterating. Whisper + Ollama integration is coming next.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
