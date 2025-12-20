import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

// ✅ Map AI JSON (v1) into the UI meeting shape this page expects
function mapAiResultToMeeting(ai, id) {
  const title = ai?.summary?.title || "Meeting Summary";
  const tldr = ai?.summary?.tldr || "";
  const bullets = Array.isArray(ai?.summary?.bullets) ? ai.summary.bullets : [];

  const outcomeSummary = [
    ...(tldr ? [tldr] : []),
    ...bullets
  ];

  const actionItems = (ai?.action_items || []).map((a, idx) => ({
    id: `ai-${idx}`,
    text: a.task,
    owner: a.owner || null,
    urgency: a.due_date ? "Medium" : "—",     // placeholder mapping for now
    confidence: 0.9                            // placeholder until we add quality scoring
  }));

  return {
    ...placeholderMeeting,
    id,
    title,
    outcomeSummary,
    actionItems,
    // keep transcript/missedMeetingBrief from placeholder for now
    summaryMode: "Default",
    date: new Date().toLocaleDateString()
  };
}

export default function ResultsPage() {
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState("outcomes");
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [checked, setChecked] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // ✅ 1) Prefer demo AI result stored in sessionStorage
        const stored = sessionStorage.getItem(`meeting:${id}`);
        if (stored) {
          const ai = JSON.parse(stored);
          const m = mapAiResultToMeeting(ai, id);
          if (!cancelled) setMeeting(m);
          return;
        }

        // ✅ 2) Otherwise fall back to your current Supabase job fetch
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        const m = data || { ...placeholderMeeting, id };
        if (!cancelled) setMeeting(m);
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setMeeting({ ...placeholderMeeting, id });
          setError("Could not reach the server. Showing placeholder results.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const filteredTranscript = useMemo(() => {
    const items = meeting?.transcript || [];
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return items;

    return items.filter((line) => {
      const blob = `${line.t} ${line.speaker} ${line.text}`.toLowerCase();
      return blob.includes(q);
    });
  }, [meeting, transcriptQuery]);

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
                This is a starter template. Next steps: add markdown export, PDF, and structured JSON downloads.
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
                Local transcription + summarization integrations are coming (Whisper + Ollama).
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
