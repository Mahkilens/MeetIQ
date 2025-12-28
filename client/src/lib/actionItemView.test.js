import test from "node:test";
import assert from "node:assert/strict";

import {
  compareActionItems,
  getBucket,
  groupAndSort,
  priorityRank,
  normalizeConfidence,
} from "./actionItemView.js";

test("getBucket grouping rules", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  assert.equal(getBucket({ id: "1", due_at: "2026-01-09T10:00:00.000Z", status: "open" }, now), "Overdue");
  assert.equal(getBucket({ id: "2", due_at: "2026-01-10T09:00:00.000Z", status: "open" }, now), "Today");
  assert.equal(getBucket({ id: "3", due_at: "2026-01-13T09:00:00.000Z", status: "open" }, now), "This Week");
  assert.equal(getBucket({ id: "4", due_at: "2026-02-01T09:00:00.000Z", status: "open" }, now), "Later");
  assert.equal(getBucket({ id: "5", due_at: null, status: "open" }, now), "No due date");

  // Completed always wins even if overdue
  assert.equal(getBucket({ id: "6", due_at: "2026-01-01T09:00:00.000Z", status: "completed" }, now), "Completed");
});

test("priorityRank ordering", () => {
  assert.equal(priorityRank("critical"), 0);
  assert.equal(priorityRank("high"), 1);
  assert.equal(priorityRank("medium"), 2);
  assert.equal(priorityRank("low"), 3);
  assert.equal(priorityRank(null), 4);
});

test("normalizeConfidence supports 0..1 and 0..100", () => {
  assert.equal(normalizeConfidence(null), 0);
  assert.equal(normalizeConfidence(0.9), 0.9);
  assert.equal(normalizeConfidence(90), 0.9);
  assert.equal(normalizeConfidence(120), 1);
});

test("compareActionItems sorting rules", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  const criticalOverdue = {
    id: "a",
    status: "open",
    due_at: "2026-01-09T10:00:00.000Z",
    priority_label: "critical",
    confidence: 0.5,
  };

  const highToday = {
    id: "b",
    status: "open",
    due_at: "2026-01-10T10:00:00.000Z",
    priority_label: "high",
    confidence: 0.9,
  };

  const mediumNoDue = {
    id: "c",
    status: "open",
    due_at: null,
    priority_label: "medium",
    confidence: 0.9,
  };

  const completedCriticalOverdue = {
    id: "d",
    status: "completed",
    due_at: "2026-01-01T10:00:00.000Z",
    priority_label: "critical",
    confidence: 1,
  };

  const items = [completedCriticalOverdue, mediumNoDue, highToday, criticalOverdue];
  const sorted = items.slice().sort((x, y) => compareActionItems(x, y, now));

  assert.deepEqual(
    sorted.map((i) => i.id),
    ["a", "b", "c", "d"],
  );
});

test("groupAndSort returns fixed section keys and sorts within", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  const items = [
    { id: "1", status: "open", due_at: "2026-01-09T10:00:00.000Z", priority_label: "high" },
    { id: "2", status: "open", due_at: "2026-01-09T11:00:00.000Z", priority_label: "critical" },
    { id: "3", status: "open", due_at: null, priority_label: "low" },
  ];

  const grouped = groupAndSort(items, now);
  assert.equal(Array.isArray(grouped.Overdue), true);
  assert.deepEqual(grouped.Overdue.map((i) => i.id), ["2", "1"]);
  assert.deepEqual(grouped["No due date"].map((i) => i.id), ["3"]);
});
