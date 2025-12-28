import { normalizeConfidence } from "./actionItemView.js";

export function normalizePriority(value) {
  const s = String(value || "").toLowerCase().trim();
  if (["critical", "crit", "p0", "urgent", "blocker"].includes(s)) return "critical";
  if (["high", "p1"].includes(s)) return "high";
  if (["medium", "med", "p2"].includes(s)) return "medium";
  if (["low", "p3"].includes(s)) return "low";
  return "unknown";
}

function safeFilenamePart(s) {
  return String(s || "meeting")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "meeting";
}

function transcriptToText(transcript) {
  if (!transcript) return null;
  if (typeof transcript === "string") return transcript.trim() || null;
  if (!Array.isArray(transcript)) return null;

  const lines = transcript
    .map((l) => {
      const t = l?.t ? `[${l.t}] ` : "";
      const s = l?.speaker ? `${l.speaker}: ` : "";
      const text = l?.text ? String(l.text) : "";
      const out = `${t}${s}${text}`.trim();
      return out.length ? out : null;
    })
    .filter(Boolean);

  return lines.length ? lines.join("\n") : null;
}

function normalizeDueDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function toExportJSON(meetingData) {
  const meeting = meetingData?.meeting || meetingData || {};
  const actionItems = meetingData?.actionItems || meeting?.actionItems || [];

  const cleanedActionItems = (actionItems || []).map((it) => {
    const confidence = normalizeConfidence(it?.confidence);
    const priority = normalizePriority(it?.priority_label || it?.priority);

    return {
      id: String(it?.id || ""),
      text: String(it?.text || it?.title || ""),
      assignee: it?.owner || it?.assignee || null,
      priority,
      confidence,
      completed: !!it?.completed || String(it?.status || "").toLowerCase() === "completed",
      dueDate: normalizeDueDate(it?.due_at || it?.dueDate || it?.due_date || it?.due),
    };
  });

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    meeting: {
      id: meeting?.id || null,
      title: meeting?.title || "Meeting",
      date: meeting?.date || null,
      mode: meeting?.summaryMode || meeting?.mode || null,
    },
    outputs: {
      outcomeSummary: Array.isArray(meeting?.outcomeSummary)
        ? meeting.outcomeSummary
        : meeting?.outcomeSummary
          ? [String(meeting.outcomeSummary)]
          : null,
      missedMeetingBrief: meeting?.missedMeetingBrief || null,
      transcript: transcriptToText(meeting?.transcript),
    },
    actionItems: cleanedActionItems,
  };
}

function mdEscape(s) {
  return String(s || "").replace(/\r\n/g, "\n");
}

export function toMarkdown(meetingData) {
  const exported = toExportJSON(meetingData);
  const meeting = exported.meeting;
  const outputs = exported.outputs;

  const titleLine = `# ${mdEscape(meeting.title)}${meeting.date ? ` (${mdEscape(meeting.date)})` : ""}`;
  const metaLines = [
    `**Meeting ID:** ${mdEscape(meeting.id || "—")}`,
    `**Mode:** ${mdEscape(meeting.mode || "—")}`,
  ];

  const lines = [titleLine, "", ...metaLines, ""];

  if (exported.actionItems?.length) {
    lines.push("## Action Items");
    exported.actionItems.forEach((it) => {
      const box = it.completed ? "[x]" : "[ ]";
      const pri = String(it.priority || "unknown").toUpperCase();
      const who = it.assignee ? mdEscape(it.assignee) : "Unassigned";
      const pct = `${Math.round((it.confidence || 0) * 100)}%`;
      const due = it.dueDate ? `, due ${mdEscape(it.dueDate.slice(0, 10))}` : "";
      lines.push(`- ${box} (${pri}, ${who}, ${pct} confidence${due}) ${mdEscape(it.text)}`);
    });
    lines.push("");
  }

  if (outputs.outcomeSummary && outputs.outcomeSummary.length) {
    lines.push("## Outcome Summary");
    outputs.outcomeSummary.forEach((l) => lines.push(mdEscape(l)));
    lines.push("");
  }

  if (outputs.missedMeetingBrief) {
    lines.push("## Missed-Meeting Brief");
    if (outputs.missedMeetingBrief.tldr) {
      lines.push(mdEscape(outputs.missedMeetingBrief.tldr));
      lines.push("");
    }
    if (Array.isArray(outputs.missedMeetingBrief.decisions) && outputs.missedMeetingBrief.decisions.length) {
      lines.push("### Decisions");
      outputs.missedMeetingBrief.decisions.forEach((d) => lines.push(`- ${mdEscape(d)}`));
      lines.push("");
    }
    if (Array.isArray(outputs.missedMeetingBrief.risks) && outputs.missedMeetingBrief.risks.length) {
      lines.push("### Risks");
      outputs.missedMeetingBrief.risks.forEach((r) => lines.push(`- ${mdEscape(r)}`));
      lines.push("");
    }
  }

  if (outputs.transcript) {
    lines.push("## Transcript");
    lines.push(mdEscape(outputs.transcript));
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function downloadFile(filename, mimeType, contentString) {
  const blob = new Blob([contentString], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export async function downloadPdf(meetingData) {
  // Dynamic import so we don't hard-require the dependency.
  // If you want PDF export, install: npm i jspdf
  let jsPDF;
  try {
    ({ jsPDF } = await import("jspdf"));
  } catch (e) {
    const err = new Error(
      "PDF export requires jspdf. Install it in client workspace: npm i jspdf"
    );
    err.cause = e;
    throw err;
  }

  const exported = toExportJSON(meetingData);
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const margin = 40;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${exported.meeting.title}${exported.meeting.date ? ` (${exported.meeting.date})` : ""}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Meeting ID: ${exported.meeting.id || "—"}`, margin, y);
  y += 14;
  doc.text(`Mode: ${exported.meeting.mode || "—"}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Action Items", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const pageHeight = doc.internal.pageSize.height;
  const maxWidth = doc.internal.pageSize.width - margin * 2;

  const items = exported.actionItems || [];
  if (!items.length) {
    doc.text("(No action items)", margin, y);
    y += 14;
  } else {
    items.forEach((it) => {
      const box = it.completed ? "[x]" : "[ ]";
      const pri = String(it.priority || "unknown").toUpperCase();
      const who = it.assignee || "Unassigned";
      const pct = `${Math.round((it.confidence || 0) * 100)}%`;
      const due = it.dueDate ? ` due ${it.dueDate.slice(0, 10)}` : "";
      const header = `${box} ${pri} · ${who} · ${pct}${due}`;

      const headerLines = doc.splitTextToSize(header, maxWidth);
      const textLines = doc.splitTextToSize(it.text || "", maxWidth);

      [...headerLines, ...textLines, ""].forEach((line) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 12;
      });
    });
  }

  const filename = `${safeFilenamePart(exported.meeting.title)}-meeting.pdf`;
  doc.save(filename);
}

export function getDefaultExportFilenames(meetingData) {
  const exported = toExportJSON(meetingData);
  const base = safeFilenamePart(exported.meeting.title);
  return {
    json: `${base}-meeting.json`,
    md: `${base}-meeting.md`,
    pdf: `${base}-meeting.pdf`,
  };
}
