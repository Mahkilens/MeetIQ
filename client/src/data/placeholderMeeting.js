export const placeholderMeeting = {
  id: "demo-meeting",
  title: "Weekly Product Sync",
  date: "2025-12-16",
  summaryMode: "Default",
  outcomeSummary: [
    "Aligned on Q1 milestones and clarified scope for the onboarding redesign.",
    "Agreed to ship an MVP analytics dashboard before adding custom reports.",
    "Flagged API latency as the top technical risk; action plan created."
  ],
  actionItems: [
    {
      id: "ai-1",
      text: "Draft onboarding redesign PRD",
      owner: "Ava",
      urgency: "High",
      confidence: 0.86
    },
    {
      id: "ai-2",
      text: "Investigate API p95 latency regression (compare last 2 deploys)",
      owner: "Marco",
      urgency: "High",
      confidence: 0.78
    },
    {
      id: "ai-3",
      text: "Propose MVP dashboard metrics list",
      owner: "Sam",
      urgency: "Medium",
      confidence: 0.72
    }
  ],
  missedMeetingBrief: {
    tldr: "We agreed on near-term priorities (onboarding + MVP analytics) and assigned owners for key next steps.",
    decisions: [
      "Onboarding redesign moves forward with PRD first, then design review.",
      "MVP analytics dashboard ships before custom reporting."
    ],
    risks: [
      "API latency may impact analytics UX; investigation underway.",
      "Design bandwidth could delay onboarding iterations."
    ]
  },
  transcript: [
    {
      t: "00:00",
      speaker: "Ava",
      text: "Quick agenda: onboarding redesign, analytics MVP, and performance risks."
    },
    {
      t: "02:14",
      speaker: "Marco",
      text: "Latency is trending up after the last deploy; I can bisect and check the DB queries."
    },
    {
      t: "05:48",
      speaker: "Sam",
      text: "For the MVP dashboard, I suggest we start with activation, retention, and funnel drop-off."
    },
    {
      t: "09:03",
      speaker: "Ava",
      text: "Let’s lock an MVP scope and keep custom reports out of the first release."
    }
  ]
};
