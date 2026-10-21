// Next steps are host-owned, like everything else Threadmark shows: the host supplies the checklist (for
// example one its review service distilled from open feedback) through the `nextSteps` prop and stores ticks
// through `onNextStepDone`. This only checks the shape, so the overlay renders plain text and nothing more.

export const NEXT_STEP_TAGS = ["bug", "polish", "copy", "idea", "question"];
const STATES = ["ready", "pending", "generating", "failed", "off"];
const MAX_STEPS = 200;
const MAX_SOURCES = 20;

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const time = (value) => (typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null);

function person(value) {
  const displayName = text(value?.displayName, 120);
  return displayName ? { displayName } : null;
}

function source(value) {
  const feedbackId = text(value?.feedbackId, 160);
  if (!feedbackId) return null;
  const route = text(value.route, 600);
  return {
    feedbackId,
    quote: text(value.quote, 300),
    route: route.startsWith("/") && !route.startsWith("//") ? route : null,
    author: text(value.author, 120) || null,
    status: value.status === "resolved" ? "resolved" : "open",
  };
}

function step(value) {
  const id = text(value?.id, 120);
  const title = text(value?.title, 200).replace(/\s+/g, " ");
  if (!id || !title) return null;
  return {
    id,
    title,
    notes: text(value.notes, 4000),
    tag: NEXT_STEP_TAGS.includes(value.tag) ? value.tag : null,
    source: value.source === "person" ? "person" : "ai",
    completed: value.completed === true,
    completedVia: ["person", "agent", "resolved"].includes(value.completedVia) ? value.completedVia : null,
    completedBy: person(value.completedBy),
    completedAt: time(value.completedAt),
    sources: (Array.isArray(value.sources) ? value.sources : []).slice(0, MAX_SOURCES).map(source).filter(Boolean),
  };
}

/**
 * `{ steps, status?, canEdit? }` (or just an array of steps) → the shape the overlay renders, or null when the
 * host supplies none. Unfinished steps keep the host's order, finished ones follow.
 */
export function normalizeNextSteps(value) {
  if (value == null || value === false) return null;
  const input = Array.isArray(value) ? { steps: value } : value;
  if (typeof input !== "object") return null;
  const seen = new Set();
  const steps = (Array.isArray(input.steps) ? input.steps : []).slice(0, MAX_STEPS).map(step).filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const state = STATES.includes(input.status?.state) ? input.status.state : "ready";
  return {
    steps: [...steps.filter((item) => !item.completed), ...steps.filter((item) => item.completed)],
    status: {
      state,
      generatedAt: time(input.status?.generatedAt),
      error: state === "failed" ? text(input.status?.error, 300) || null : null,
      openThreads: Number.isFinite(input.status?.openThreads) ? Math.max(0, Math.floor(input.status.openThreads)) : null,
    },
    canEdit: input.canEdit !== false,
  };
}
