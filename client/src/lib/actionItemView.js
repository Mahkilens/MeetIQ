export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseDueDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function isCompleted(item) {
  const s = String(item?.status || "").toLowerCase();
  return item?.completed === true || s === "completed" || s === "done";
}

export function isToday(dueDate, now = new Date()) {
  const d = parseDueDate(dueDate);
  if (!d) return false;
  const a = startOfDay(d).getTime();
  const b = startOfDay(now).getTime();
  return a === b;
}

export function isOverdue(dueDate, now = new Date()) {
  const d = parseDueDate(dueDate);
  if (!d) return false;
  return d.getTime() < startOfDay(now).getTime();
}

export function isThisWeek(dueDate, now = new Date()) {
  const d = parseDueDate(dueDate);
  if (!d) return false;

  const startTomorrow = new Date(startOfDay(now));
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const end = new Date(startOfDay(now));
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  return d.getTime() >= startTomorrow.getTime() && d.getTime() <= end.getTime();
}

export function priorityRank(priority) {
  const s = String(priority || "").toLowerCase().trim();
  if (["critical", "crit", "p0", "urgent", "blocker"].includes(s)) return 0;
  if (["high", "p1"].includes(s)) return 1;
  if (["medium", "med", "p2"].includes(s)) return 2;
  if (["low", "p3"].includes(s)) return 3;
  return 4;
}

export function normalizeConfidence(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value <= 1) return Math.max(0, Math.min(1, value));
  return Math.max(0, Math.min(1, value / 100));
}

export function getBucket(item, now = new Date()) {
  if (isCompleted(item)) return "Completed";

  const due = item?.due_at || item?.dueDate || item?.due_date || item?.due;
  const d = parseDueDate(due);
  if (!d) return "No due date";

  if (isOverdue(d, now)) return "Overdue";
  if (isToday(d, now)) return "Today";
  if (isThisWeek(d, now)) return "This Week";
  return "Later";
}

export function compareActionItems(a, b, now = new Date()) {
  const aCompleted = isCompleted(a);
  const bCompleted = isCompleted(b);
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

  const aDue = a?.due_at || a?.dueDate || a?.due_date || a?.due;
  const bDue = b?.due_at || b?.dueDate || b?.due_date || b?.due;

  const aOver = !aCompleted && isOverdue(aDue, now);
  const bOver = !bCompleted && isOverdue(bDue, now);
  if (aOver !== bOver) return aOver ? -1 : 1;

  const pr = priorityRank(a?.priority_label || a?.priority);
  const pr2 = priorityRank(b?.priority_label || b?.priority);
  if (pr !== pr2) return pr - pr2;

  const aDate = parseDueDate(aDue);
  const bDate = parseDueDate(bDue);
  if (aDate && bDate) {
    const t = aDate.getTime() - bDate.getTime();
    if (t !== 0) return t;
  } else if (aDate && !bDate) {
    return -1;
  } else if (!aDate && bDate) {
    return 1;
  }

  const c1 = normalizeConfidence(a?.confidence);
  const c2 = normalizeConfidence(b?.confidence);
  if (c1 !== c2) return c2 - c1;

  const id1 = String(a?.id || a?.text || "");
  const id2 = String(b?.id || b?.text || "");
  return id1.localeCompare(id2);
}

export function groupAndSort(items, now = new Date()) {
  const groups = {
    Overdue: [],
    Today: [],
    "This Week": [],
    Later: [],
    "No due date": [],
    Completed: [],
  };

  (items || []).forEach((item) => {
    const bucket = getBucket(item, now);
    if (!groups[bucket]) groups[bucket] = [];
    groups[bucket].push(item);
  });

  Object.keys(groups).forEach((k) => {
    groups[k] = groups[k].slice().sort((a, b) => compareActionItems(a, b, now));
  });

  return groups;
}
