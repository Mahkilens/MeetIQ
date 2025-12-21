import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import { supabase } from "../lib/supabaseClient";
import { createMeetingFromTranscript } from "../api/ai";

/**
 * UploadMeetingPage (production-ready)
 * - Robust Supabase auth session tracking (v2)
 * - Clear auth + upload error handling
 * - Harder file type detection (mime + extension)
 * - Prevents upload when not authed / invalid file
 * - Removes "mock" behavior; keeps transcript summarize feature as a real workflow
 */

const ACCEPTED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "video/mp4"
]);

const ACCEPTED_EXTENSIONS = new Set(["mp3", "wav", "m4a", "mp4"]);

const SUMMARY_MODES = [
  "Default",
  "Missed the Meeting",
  "Student",
  "Developer",
  "Manager",
  "Creator"
];

function getFileExtension(name) {
  const ext = (name || "").split(".").pop();
  return (ext || "").toLowerCase();
}

function isAcceptedFile(file) {
  if (!file) return false;
  if (file.type && ACCEPTED_MIME_TYPES.has(file.type)) return true;
  const ext = getFileExtension(file.name);
  return ACCEPTED_EXTENSIONS.has(ext);
}

function humanFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let b = bytes;
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i += 1;
  }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function UploadMeetingPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // -------------------------
  // Auth state
  // -------------------------
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("idle"); // idle | loading
  const [authError, setAuthError] = useState(null);
  const [authInfo, setAuthInfo] = useState(null);
  const [session, setSession] = useState(null);

  // Keep session in sync (Supabase v2)
  useEffect(() => {
    let ignore = false;

    async function load() {
      const { data, error } = await supabase.auth.getSession();
      if (!ignore) setSession(data?.session ?? null);
      if (error) console.error("supabase.auth.getSession error:", error);
    }

    load();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const isLoggedIn = !!session?.user;

  async function signIn() {
    setAuthError(null);
    setAuthInfo(null);

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Enter email and password.");
      return;
    }

    try {
      setAuthStatus("loading");
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword
      });

      if (error) {
        // Common dev gotcha
        if (
          (error.message || "").toLowerCase().includes("email") &&
          (error.message || "").toLowerCase().includes("confirm")
        ) {
          setAuthError(
            "Email not confirmed. Check your inbox for the confirmation link (or disable email confirmation in Supabase while developing)."
          );
          return;
        }
        throw error;
      }
    } catch (e) {
      setAuthError(e?.message || "Sign in failed");
    } finally {
      setAuthStatus("idle");
    }
  }

  async function signUp() {
    setAuthError(null);
    setAuthInfo(null);

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Enter email and password.");
      return;
    }

    try {
      setAuthStatus("loading");

      // NOTE: If "Confirm email" is enabled in Supabase, user must confirm before sign-in succeeds.
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword
      });

      if (error) throw error;

      // If a session is returned, confirmation is likely disabled.
      if (data?.session) {
        setAuthInfo("Account created and signed in.");
      } else {
        setAuthInfo(
          "Account created. Please check your email to confirm your address, then sign in."
        );
      }
    } catch (e) {
      setAuthError(e?.message || "Sign up failed");
    } finally {
      setAuthStatus("idle");
    }
  }

  async function signOut() {
    setAuthError(null);
    setAuthInfo(null);

    try {
      setAuthStatus("loading");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      setAuthError(e?.message || "Sign out failed");
    } finally {
      setAuthStatus("idle");
    }
  }

  // -------------------------
  // Upload state
  // -------------------------
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [summaryMode, setSummaryMode] = useState("Default");

  const [status, setStatus] = useState("idle"); // idle | uploading | success | error
  const [error, setError] = useState(null);

  // Transcript → AI (real workflow)
  const [transcriptText, setTranscriptText] = useState("");
  const [aiStatus, setAiStatus] = useState("idle");
  const [aiError, setAiError] = useState(null);

  const fileMeta = useMemo(() => {
    if (!selectedFile) return null;
    const ext = getFileExtension(selectedFile.name);
    return {
      ext,
      mime: selectedFile.type || "unknown",
      size: selectedFile.size
    };
  }, [selectedFile]);

  const canUpload = useMemo(() => {
    return (
      status === "idle" &&
      isLoggedIn &&
      !!selectedFile &&
      isAcceptedFile(selectedFile)
    );
  }, [status, isLoggedIn, selectedFile]);

  function handlePickedFile(file) {
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Clear previous success/error when changing files
    setStatus("idle");

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
    handlePickedFile(file || null);
  }

  async function doUpload() {
    if (!selectedFile) return;

    setError(null);

    try {
      if (!session?.user) {
        throw new Error("You must be logged in to upload.");
      }

      if (!isAcceptedFile(selectedFile)) {
        throw new Error("Unsupported file type. Please upload mp3, wav, m4a, or mp4.");
      }

      setStatus("uploading");

      const user = session.user;

      // 1) Upload to Supabase Storage
      const fileExt = getFileExtension(selectedFile.name) || "mp4";
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type || undefined,
          upsert: false
        });

      if (uploadError) {
        // Helpful message for common storage/RLS issues
        const msg = uploadError.message || "Upload failed";
        if (msg.toLowerCase().includes("row-level security")) {
          throw new Error(
            "Upload blocked by Supabase Storage policy (RLS). Create a Storage policy allowing authenticated users to upload to the audio bucket."
          );
        }
        throw uploadError;
      }

      // 2) Create processing job row
      const { data: job, error: insertError } = await supabase
        .from("jobs")
        .insert({
          user_id: user.id,
          status: "queued",
          audio_path: fileName,
          summary_mode: summaryMode,
          // If you later add Whisper, store transcript output here
          transcript_text: null
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setStatus("success");

      // 3) Navigate to results by job id
      navigate(`/results/${job.id}`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Upload failed");
      setStatus("error");
    }
  }

  async function doSummarizeTranscript() {
    setAiError(null);

    if (!isLoggedIn) {
      setAiError("Please sign in first.");
      return;
    }

    if (!transcriptText.trim()) {
      setAiError("Paste a transcript first.");
      return;
    }

    try {
      setAiStatus("loading");

      const { id } = await createMeetingFromTranscript({
        transcriptText: transcriptText.trim(),
        summaryMode
      });

      navigate(`/results/${id}`);
    } catch (err) {
      console.error(err);
      setAiError(err?.message || "AI summarize failed");
    } finally {
      setAiStatus("idle");
    }
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
              Drop an audio/video file and get structured notes in seconds.
            </p>
          </div>

          {/* Auth */}
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Account</div>
                <div className="mt-1 text-sm text-slate-600">
                  {isLoggedIn ? (
                    <>
                      Signed in as{" "}
                      <span className="font-medium text-slate-900">
                        {session.user.email}
                      </span>
                    </>
                  ) : (
                    "Sign in to upload and generate summaries."
                  )}
                </div>
              </div>

              {isLoggedIn ? (
                <Button
                  variant="outline"
                  onClick={signOut}
                  disabled={authStatus === "loading"}
                >
                  {authStatus === "loading" ? "Signing out…" : "Sign out"}
                </Button>
              ) : null}
            </div>

            {!isLoggedIn ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-slate-700">Email</div>
                  <input
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="you@email.com"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700">Password</div>
                  <input
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    type="password"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                {authInfo ? (
                  <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    {authInfo}
                  </div>
                ) : null}

                {authError ? (
                  <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {authError}
                  </div>
                ) : null}

                <div className="flex gap-2 sm:col-span-2">
                  <Button onClick={signIn} disabled={authStatus === "loading"}>
                    {authStatus === "loading" ? "Signing in…" : "Sign in"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={signUp}
                    disabled={authStatus === "loading"}
                  >
                    {authStatus === "loading" ? "Signing up…" : "Sign up"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {/* Upload */}
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
                <div className="text-xs text-slate-500">Accepts mp3, wav, m4a, mp4</div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={status === "uploading"}
                >
                  Browse files
                </Button>
                <Button onClick={doUpload} disabled={!canUpload}>
                  {status === "uploading" ? "Uploading…" : "Upload"}
                </Button>
              </div>

              <div className="mt-2 w-full max-w-md rounded-xl bg-white/70 p-3 text-left ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700">Selected file</div>
                    <div className="mt-1 truncate text-sm text-slate-900">
                      {selectedFile ? selectedFile.name : "No file selected"}
                    </div>
                    {selectedFile ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {fileMeta?.mime} • {humanFileSize(fileMeta?.size)}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-700">Status</div>
                    <div className="mt-1 text-sm text-slate-900">
                      {status === "idle" && "Idle"}
                      {status === "uploading" && "Uploading…"}
                      {status === "success" && "Uploaded"}
                      {status === "error" && "Error"}
                    </div>
                  </div>
                </div>
              </div>

              {!isLoggedIn && selectedFile ? (
                <div className="w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-700">
                  Please sign in (and confirm your email if prompted) to upload.
                </div>
              ) : null}

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
                  disabled={status === "uploading"}
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
                  Audio uploads go to Supabase Storage. You can move transcription local later.
                </div>
              </div>
            </div>

            {/* Transcript → AI */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">
                Summarize an existing transcript
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Paste a transcript to generate notes right now (useful while wiring Whisper).
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
                <Button
                  onClick={doSummarizeTranscript}
                  disabled={aiStatus === "loading" || !isLoggedIn}
                >
                  {aiStatus === "loading" ? "Summarizing…" : "Summarize transcript"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right rail */}
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
              If sign-in says “Email not confirmed”, either confirm the email or disable confirmation
              in Supabase Auth while developing.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
