import { TERMINAL_STATUSES } from "./progress.js";

export const DEFAULT_TOUR_RULES = Object.freeze({ perVisit: 1, gapMs: 86_400_000 });

/** The page each step is on: its own `page`, else the previous step's, starting from an exact `showTo.path`. */
export function stepPagesOf(tour) {
  const showToPath = tour?.showTo?.path;
  let page = showToPath && !showToPath.endsWith("*") ? showToPath : undefined;
  return (tour?.steps || []).map((step) => (page = step?.page ?? page));
}

export function pathMatches(pattern, path) {
  if (!pattern) return true;
  return pattern.endsWith("*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
}

function traitTime(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  return Number.NaN;
}

function traitsMatch(conditions, traits = {}, now) {
  return Object.entries(conditions || {}).every(([key, condition]) => {
    const value = traits[key];
    if ("equals" in condition) return value === condition.equals;
    if ("oneOf" in condition) return condition.oneOf.includes(value);
    const time = traitTime(value);
    return Number.isFinite(time) && time <= now && now - time <= condition.withinMs;
  });
}

/**
 * Whether a normalized tour may start for this person, here, now. Returns a reason either way,
 * so results and debugging can say why someone did or didn't see a tour.
 */
export function tourEligibility(tour, { path, device, user, record, now }) {
  const { showTo } = tour;
  if (!pathMatches(showTo.path, path)) return { eligible: false, reason: "path" };
  if (showTo.device !== "any" && showTo.device !== device) return { eligible: false, reason: "device" };
  if (showTo.traits && !traitsMatch(showTo.traits, user?.traits, now)) return { eligible: false, reason: "traits" };
  if (showTo.when) {
    let allowed = false;
    try {
      allowed = Boolean(showTo.when(user || {}));
    } catch {
      allowed = false;
    }
    if (!allowed) return { eligible: false, reason: "when" };
  }
  if (record?.status === "skipped") {
    if (tour.afterSkipMs === null || now - record.updatedAt < tour.afterSkipMs) return { eligible: false, reason: "skipped" };
  }
  if (record?.status === "finished" && tour.repeat !== "everyVisit") return { eligible: false, reason: "finished" };
  return { eligible: true, reason: record && !TERMINAL_STATUSES.has(record.status) && record.seen.length ? "resume" : "new" };
}

/**
 * Picks the tour to show on its own (page load or an app event): the first eligible one in the order given.
 * A tour that's already part-way through is offered again on a later visit, and continues directly
 * when a page load interrupts it mid-visit. A new tour waits when this
 * visit has already shown `perVisit` tours, or when another tour started less than `gapMs` ago.
 */
export function pickTour(tours, context, { records, shownThisVisit, rules = DEFAULT_TOUR_RULES, trigger }) {
  const startedElsewhere = Math.max(0, ...Object.values(records)
    .filter((record) => record && record.status !== "skipped")
    .map((record) => record.startedAt));
  for (const tour of tours) {
    if (trigger.kind === "event" ? tour.start.kind !== "event" || tour.start.event !== trigger.event : tour.start.kind !== "pageLoad") continue;
    const record = records[tour.id] || null;
    if (tour.repeat === "everyVisit" && shownThisVisit.includes(tour.id)) continue;
    const verdict = tourEligibility(tour, { ...context, record });
    if (!verdict.eligible) continue;
    if (verdict.reason === "resume") {
      // Same visit: carry straight on after a page load, but respect a "Not now" from earlier in the visit.
      if (!shownThisVisit.includes(tour.id)) return { tour, record, resume: true };
      if (record.status === "inProgress") return { tour, record, resume: true, continueDirectly: true };
      continue;
    }
    if (shownThisVisit.length >= rules.perVisit) continue;
    const ownStart = record?.startedAt ?? 0;
    if (startedElsewhere > ownStart && context.now - startedElsewhere < rules.gapMs) continue;
    return { tour, record, resume: false };
  }
  return null;
}
