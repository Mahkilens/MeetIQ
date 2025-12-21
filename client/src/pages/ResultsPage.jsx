import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import { placeholderMeeting } from "../data/placeholderMeeting.js";
import { supabase } from "../lib/supabaseClient.js";

const TABS = [
  { id: "outcomes", label: "Outcome Summary" },
  { id: "actions", label: "Action Items" },
  { id: "transcript", label: "Transcript" },
  { id: "missed", label: "Missed-Meeting Brief" }
];

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200"
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  );
}

function confidenceLabel(value) {
  if (value >= 0.85) return { text: "High", tone: "green" };
  if (value >= 0.7) return { text: "Medium", tone: "amber" };
  return { text: "Low", tone: "red" };
}

function mapDbMeetingToUi(meetingRow) {
  const ai = meetingRow?.summary_json;

  const title = meetingRow?.title || ai?.summary?.title || "Meeting Summary";
  const tldr = ai?.summary?.tldr || "";
  const bullets = Array.isArray(ai?.summary?.bullets) ? ai.summary.bullets : [];

  const outcomeSummary = [...(tldr ? [tldr] : []), ...bullets];

  const actionItems = (ai?.action_items || []).map((a, idx) => ({
    id: `ai-${idx}`,
    text: a.task,
    owner: a.owner || null,
    urgency: a.due_date ? "Medium" : "—",
    confidence: 0.9
  }));

  // If you have raw transcript text stored, show it as a single transcript line for now
  const transcriptText = meetingRow?.transcript_text || "";
  const transcript =
    transcriptText.trim().length > 0
      ? [{ t: "—", speaker: "Transcript", text: transcriptText }]
      : placeholderMeeting.transcript;

  return {
    ...placeholderMeeting,
    id: meetingRow.id,
    title,
    outcomeSummary,
    actionItems,
    transcript,
    summaryMode: meetingRow.summary_mode || "Default",
    date: meetingRow.created_at
      ? new Date(meetingRow.created_at).toLocaleDateString()
      : "—"
  };
}

export default function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("outcomes");
  const [meeting, setMeeting] = useState(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [checked, setChecked] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    async function tryLoadAsMeeting(meetingId) {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId)
        .single();

      if (error) return { ok: false, error };
      return { ok: true, data };
    }

    async function tryLoadAsJob(jobId) {
      const { data, error } = await supabase
        .from("jobs")
        .select("id,status,meeting_id,error,updated_at,created_at")
        .eq("id", jobId)
        .single();

      if (error) return { ok: false, error };
      return { ok: true, data };
    }

    async function load() {
      setLoading(true);
      setProcessing(false);
      setError(null);

      // 1) First: assume :id is a MEETING id
      try {
        const meetingRes = await tryLoadAsMeeting(id);

        if (meetingRes.ok && meetingRes.data) {
          const m = mapDbMeetingToUi(meetingRes.data);
          if (!cancelled) setMeeting(m);
          if (!cancelled) setLoading(false);
          return;
        }
      } catch {
        // ignore and fall through to job path
      }

      // 2) Otherwise: treat :id as a JOB id and poll until it has meeting_id
      setProcessing(true);

      async function checkJobOnce() {
        const jobRes = await tryLoadAsJob(id);

        if (!jobRes.ok) {
          throw jobRes.error;
        }

        const job = jobRes.data;

        // If worker produced a meeting, redirect
        if (job?.meeting_id) {
          // replace so back button doesn’t bounce through job id
          navigate(`/results/${job.meeting_id}`, { replace: true });
          return true;
        }

        // If worker errored, show error
        if (job?.status === "error") {
          throw new Error(job?.error || "Job failed");
        }

        return false;
      }

      try {
        // check immediately once
        const done = await checkJobOnce();
        if (done) return;

        // poll every 2s
        pollTimer = setInterval(async () => {
          try {
            const done2 = await checkJobOnce();
            if (done2 && pollTimer) clearInterval(pollTimer);
          } catch (e) {
            if (pollTimer) clearInterval(pollTimer);
            if (!cancelled) setError(e.message || "Could not process job.");
            if (!cancelled) setProcessing(false);
            if (!cancelled) setLoading(false);
          }
        }, 2000);

        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Could not load results.");
          setProcessing(false);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [id, navigate]);

  const filteredTranscript = useMemo(() => {
    const items = meeting?.transcript || [];
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return items;

    return items.filter((line) => {
      const blob = `${line.t} ${line.speaker} ${line.text}`.toLowerCase();
      return blob.includes(q);
    });
  }, [meeting, transcriptQuery]);

  // UI: processing view (job id)
  if (processing) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Job</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Processing…
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="amber">Queued/Processing</Badge>
              <Badge>Id: {id}</Badge>
            </div>
            <div className="mt-3 text-sm text-slate-600">
              We’re generating your notes now. This page will auto-update.
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>

          <Link to="/">
            <Button variant="outline">New upload</Button>
          </Link>
        </div>

        <div className="mt-6">
          <Card>
            <div className="space-y-3">
              <div className="h-4 w-52 rounded bg-slate-100" />
              <div className="h-4 w-full rounded bg-slate-100" />
              <div className="h-4 w-5/6 rounded bg-slate-100" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>

            <div className="mt-5 text-xs text-slate-500">
              Tip: keep your worker running:
              <span className="ml-2 rounded bg-slate-100 px-2 py-1 font-mono">
                npm run worker:jobs --workspace server
              </span>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Normal meeting view
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">Meeting</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {meeting?.title || "Meeting results"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{meeting?.date || "—"}</Badge>
            <Badge tone="indigo">Mode: {meeting?.summaryMode || "Default"}</Badge>
            <Badge>Id: {id}</Badge>
          </div>
          {error ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="outline">New upload</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                  isActive
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-slate-100" />
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
              </div>
            ) : (
              <>
                {activeTab === "outcomes" ? (
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Outcome Summary</div>
                    <div className="mt-3 space-y-2">
                      {(meeting?.outcomeSummary || []).map((line, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200"
                        >
                          {line}
                        </div>
                      ))}
                      {!meeting?.outcomeSummary?.length ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          No summary yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {activeTab === "actions" ? (
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Action Items</div>
                    <div className="mt-3 space-y-2">
                      {(meeting?.actionItems || []).map((item) => {
                        const isChecked = checked.has(item.id);
                        const conf = confidenceLabel(item.confidence || 0);
                        const urgencyTone =
                          item.urgency === "High"
                            ? "red"
                            : item.urgency === "Medium"
                              ? "amber"
                              : "slate";

                        return (
                          <label
                            key={item.id}
                            className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setChecked((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(item.id);
                                  else next.delete(item.id);
                                  return next;
                                });
                              }}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div
                                  className={`truncate text-sm font-medium ${
                                    isChecked ? "text-slate-400 line-through" : "text-slate-900"
                                  }`}
                                >
                                  {item.text}
                                </div>
                                <Badge>{item.owner || "Unassigned"}</Badge>
                                <Badge tone={urgencyTone}>{item.urgency || "—"}</Badge>
                                <Badge tone={conf.tone}>{conf.text} confidence</Badge>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Confidence: {Math.round((item.confidence || 0) * 100)}%
                              </div>
                            </div>
                          </label>
                        );
                      })}

                      {!meeting?.actionItems?.length ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          No action items yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {activeTab === "transcript" ? (
                  <div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold text-slate-900">Transcript</div>
                      <input
                        value={transcriptQuery}
                        onChange={(e) => setTranscriptQuery(e.target.value)}
                        placeholder="Search transcript…"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:w-72"
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      {filteredTranscript.map((line, idx) => (
                        <div
                          key={`${line.t}-${idx}`}
                          className="grid gap-1 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-[72px_120px_1fr]"
                        >
                          <div className="text-xs font-medium text-slate-500">{line.t}</div>
                          <div className="text-xs font-semibold text-slate-700">{line.speaker}</div>
                          <div className="text-sm text-slate-700">{line.text}</div>
                        </div>
                      ))}

                      {!filteredTranscript.length ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          No matching transcript lines.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {activeTab === "missed" ? (
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Missed-Meeting Brief</div>
                    <div className="mt-3 space-y-3">
                      <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
                        <div className="text-xs font-medium text-indigo-800">TL;DR</div>
                        <div className="mt-1 text-sm text-indigo-900">
                          {meeting?.missedMeetingBrief?.tldr || "—"}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <div className="text-xs font-semibold text-slate-700">Decisions</div>
                          <div className="mt-2 space-y-2">
                            {(meeting?.missedMeetingBrief?.decisions || []).map((d, idx) => (
                              <div key={idx} className="text-sm text-slate-700">
                                {d}
                              </div>
                            ))}
                            {!meeting?.missedMeetingBrief?.decisions?.length ? (
                              <div className="text-sm text-slate-500">—</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <div className="text-xs font-semibold text-slate-700">Risks</div>
                          <div className="mt-2 space-y-2">
                            {(meeting?.missedMeetingBrief?.risks || []).map((r, idx) => (
                              <div key={idx} className="text-sm text-slate-700">
                                {r}
                              </div>
                            ))}
                            {!meeting?.missedMeetingBrief?.risks?.length ? (
                              <div className="text-sm text-slate-500">—</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="text-sm font-semibold text-slate-900">Export</div>
              <div className="mt-2 text-sm text-slate-600">
                Next steps: add markdown export, PDF, and structured JSON downloads.
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="subtle" disabled>
                  Copy summary
                </Button>
                <Button variant="subtle" disabled>
                  Download
                </Button>
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold text-slate-900">Pipeline status</div>
              <div className="mt-2 text-sm text-slate-600">
                Worker polls jobs → runs AI → writes meetings.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
