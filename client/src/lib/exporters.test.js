import test from "node:test";
import assert from "node:assert/strict";

import { toExportJSON, toMarkdown } from "./exporters.js";

test("toExportJSON normalizes confidence and priority", () => {
  const data = {
    meeting: {
      id: "m1",
      title: "Test Meeting",
      date: "2026-01-01",
      summaryMode: "Default",
    },
    actionItems: [
      {
        id: "a",
        text: "Fix the prod outage",
        owner: "Jamie",
        priority_label: "P0",
        confidence: 92,
        completed: false,
        due_at: "2026-01-02T10:00:00.000Z",
      },
      {
        id: "b",
        text: "Optional: explore new tool sometime",
        owner: null,
        priority_label: null,
        confidence: null,
        completed: true,
        due_at: "not-a-date",
      },
    ],
  };

  const out = toExportJSON(data);
  assert.equal(out.version, "1.0");
  assert.equal(out.meeting.id, "m1");
  assert.equal(out.actionItems.length, 2);

  assert.deepEqual(out.actionItems[0], {
    id: "a",
    text: "Fix the prod outage",
    assignee: "Jamie",
    priority: "critical",
    confidence: 0.92,
    completed: false,
    dueDate: "2026-01-02T10:00:00.000Z",
  });

  assert.equal(out.actionItems[1].priority, "unknown");
  assert.equal(out.actionItems[1].confidence, 0);
  assert.equal(out.actionItems[1].dueDate, null);
  assert.equal(out.actionItems[1].completed, true);
});

test("toMarkdown renders checklist + omits missing sections", () => {
  const data = {
    meeting: {
      id: "m1",
      title: "Demo",
      date: "2026-01-01",
      summaryMode: "Default",
      outcomeSummary: [],
      missedMeetingBrief: null,
      transcript: null,
    },
    actionItems: [
      {
        id: "a",
        text: "Send deck by tomorrow",
        owner: "Priya",
        priority_label: "high",
        confidence: 0.9,
        completed: false,
      },
      {
        id: "b",
        text: "Done thing",
        owner: "Alex",
        priority_label: "low",
        confidence: 0.8,
        completed: true,
      },
    ],
  };

  const md = toMarkdown(data);
  assert.ok(md.includes("# Demo (2026-01-01)"));
  assert.ok(md.includes("**Meeting ID:** m1"));
  assert.ok(md.includes("## Action Items"));
  assert.ok(md.includes("- [ ] (HIGH, Priya, 90% confidence) Send deck by tomorrow"));
  assert.ok(md.includes("- [x] (LOW, Alex, 80% confidence) Done thing"));

  // Outcome/Missed/Transcript sections omitted
  assert.equal(md.includes("## Outcome Summary"), false);
  assert.equal(md.includes("## Missed-Meeting Brief"), false);
  assert.equal(md.includes("## Transcript"), false);
});
