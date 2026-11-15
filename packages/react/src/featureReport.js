// Which people features a host has switched on, and what the rest need (decided 2026-11-15: the SDK is the
// capture layer; everything that involves other people needs the host's backend or Threadmark Cloud).
// Threadmark logs this once on local hosts so a developer can see what their reviewers will and won't get.
const FEATURES = [
  { name: "Comments that last", on: (p) => Array.isArray(p.annotations) && typeof p.onFeedbackCreate === "function", needs: "annotations + onFeedbackCreate (comments vanish on reload without them)" },
  { name: "Polls", on: (p) => typeof p.onPollVote === "function", needs: "onPollVote" },
  { name: "Reactions", on: (p) => typeof p.onReactionChange === "function", needs: "onReactionChange" },
  { name: "@mentions", on: (p) => Array.isArray(p.reviewers) && p.reviewers.length > 0, needs: "reviewers" },
  { name: "Inbox", on: (p) => Array.isArray(p.notifications), needs: "notifications + onNotificationsRead" },
  { name: "Share", on: (p) => Boolean(p.shareUrl || p.onInvite), needs: "shareUrl or onInvite (+ members, onMemberChange)" },
  { name: "Your settings", on: (p) => Boolean(p.onReviewerChange || p.onNotificationSettingsChange || p.onLeaveProject), needs: "onReviewerChange, onNotificationSettingsChange or onLeaveProject" },
  { name: "Next steps", on: (p) => p.nextSteps != null, needs: "nextSteps + onNextStepDone" },
  { name: "Surveys", on: (p) => typeof p.onSurveyPublish === "function" || Array.isArray(p.surveys), needs: "surveys + onSurveyPublish" },
  { name: "AI review", on: (p) => typeof p.onAiReview === "function" || typeof p.onPageReview === "function", needs: "onAiReview with your own model" },
  { name: "Ask AI", on: (p) => typeof p.onAskAi === "function", needs: "onAskAi with your own model" },
  { name: "Presence", on: (p) => Boolean(p.presence), needs: "a presence transport" },
  { name: "Page versions", on: (p) => Array.isArray(p.pageVersions) && p.pageVersions.length > 0, needs: "pageVersions" },
];

/** `{ on: [names], off: [{ name, needs }] }` for the props a host passed. Exported for tests. */
export function describeFeatures(props = {}) {
  const on = [];
  const off = [];
  for (const feature of FEATURES) {
    if (feature.on(props)) on.push(feature.name);
    else off.push({ name: feature.name, needs: feature.needs });
  }
  return { on, off };
}

/** The one console message: what's on, and what each feature that's off would need. */
export function featureReportMessage(props = {}) {
  const { on, off } = describeFeatures(props);
  const lines = [
    "[threadmark] Capture works on its own. People features need your backend or Threadmark Cloud (@threadmark/cloud).",
    `On: ${on.length ? on.join(", ") : "none"}.`,
  ];
  if (off.length) lines.push("Off, and what each needs:", ...off.map((item) => `  - ${item.name}: ${item.needs}`));
  return lines.join("\n");
}
