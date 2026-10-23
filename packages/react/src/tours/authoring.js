// Editing tour files from Tour mode. Every function takes a tour as written in its .tour.json
// (not the normalized form the player uses) and returns a new one, so "Save to code" writes
// back exactly what a person would have written by hand.

import { isValidThreadmarkTargetId } from "../targetId.js";
import { stepPagesOf } from "./eligibility.js";
import { validateTour } from "./schema.js";

export const TOUR_SCHEMA_URL = "https://unpkg.com/threadmark-react/tour.schema.json";
const TOUR_KEY_ORDER = ["$schema", "id", "title", "showTo", "start", "repeat", "afterSkip", "steps"];
const STEP_KEY_ORDER = ["id", "page", "target", "title", "body", "style", "placement", "next", "arrive", "waitFor", "phone"];

/** A readable, unique, valid id from free text: "Start something new" → "start-something-new". */
export function slugify(text, taken = [], fallback = "step") {
  const base = String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || fallback;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
}

export function createTour({ title = "New tour", path, takenIds = [] } = {}) {
  const tour = { $schema: TOUR_SCHEMA_URL, id: slugify(title, takenIds, "tour"), title, steps: [] };
  if (path) tour.showTo = { path };
  return tour;
}

function stepIds(tour) {
  return (tour.steps || []).map((step) => step.id);
}

export { stepPagesOf };

/**
 * Adds a step pointing at a stable target. The step only records `page` when it differs
 * from the page the tour would already be on, which keeps files short.
 */
export function addStep(tour, { target, title, page, index } = {}) {
  if (!isValidThreadmarkTargetId(target)) throw new TypeError("Tour steps need a valid Threadmark target id.");
  const steps = [...(tour.steps || [])];
  const at = Number.isInteger(index) ? Math.max(0, Math.min(index, steps.length)) : steps.length;
  const stepTitle = String(title || "").trim() || `Step ${steps.length + 1}`;
  const step = { id: slugify(stepTitle, stepIds(tour)), target, title: stepTitle };
  const pages = stepPagesOf(tour);
  const pageBefore = at === 0 ? stepPagesOf({ ...tour, steps: [{}] })[0] : pages[at - 1];
  if (page && page !== pageBefore) step.page = page;
  steps.splice(at, 0, step);
  return { ...tour, steps };
}

/** Updates one step. `undefined` or empty-string values remove optional fields; ids stay stable. */
export function updateStep(tour, stepId, changes) {
  return {
    ...tour,
    steps: (tour.steps || []).map((step) => {
      if (step.id !== stepId) return step;
      const next = { ...step };
      for (const [key, value] of Object.entries(changes)) {
        if (key === "id") continue;
        const empty = value === undefined || value === null || (typeof value === "string" && !value.trim());
        if (empty && key !== "title") delete next[key];
        else next[key] = value;
      }
      if (next.next === "button") delete next.next;
      if (next.style === "spotlight") delete next.style;
      if (next.placement === "auto") delete next.placement;
      if (next.arrive === "navigate") delete next.arrive;
      return next;
    }),
  };
}

export function moveStep(tour, stepId, offset) {
  const steps = [...(tour.steps || [])];
  const from = steps.findIndex((step) => step.id === stepId);
  const to = from + offset;
  if (from === -1 || to < 0 || to >= steps.length) return tour;
  const [step] = steps.splice(from, 1);
  steps.splice(to, 0, step);
  return { ...tour, steps };
}

export function removeStep(tour, stepId) {
  return { ...tour, steps: (tour.steps || []).filter((step) => step.id !== stepId) };
}

/** Updates top-level settings (title, showTo, start, repeat, afterSkip). Defaults are dropped from the file. */
export function updateTourSettings(tour, changes) {
  const next = { ...tour, ...changes };
  if (next.showTo) {
    const showTo = Object.fromEntries(Object.entries(next.showTo).filter(([key, value]) => value !== undefined && value !== "" && !(key === "device" && value === "any")));
    if (showTo.traits && !Object.keys(showTo.traits).length) delete showTo.traits;
    if (Object.keys(showTo).length) next.showTo = showTo;
    else delete next.showTo;
  }
  if (next.start === "pageLoad") delete next.start;
  if (next.repeat === "once") delete next.repeat;
  if (next.afterSkip === "never") delete next.afterSkip;
  for (const key of ["start", "repeat", "afterSkip"]) if (next[key] === undefined) delete next[key];
  return next;
}

function ordered(object, order) {
  const result = {};
  for (const key of order) if (object[key] !== undefined) result[key] = object[key];
  for (const key of Object.keys(object)) if (!(key in result) && object[key] !== undefined) result[key] = object[key];
  return result;
}

/** The tour as file contents: stable key order, two-space indent, trailing newline. */
export function serializeTour(tour) {
  const clean = ordered({ $schema: TOUR_SCHEMA_URL, ...tour }, TOUR_KEY_ORDER);
  clean.steps = (tour.steps || []).map((step) => ordered(step, STEP_KEY_ORDER));
  return `${JSON.stringify(clean, null, 2)}\n`;
}

export function tourFileName(tour) {
  return `tours/${tour.id}.tour.json`;
}

/** Validation for the editor: a tour with no steps is "in progress", not broken. */
export function tourProblems(tour) {
  if (!(tour.steps || []).length) return [{ path: "steps", message: "Add a step by clicking something on the page." }];
  return validateTour(tour).errors;
}

/** What a developer pastes to give an element a stable id. */
export function stableIdSnippet(id) {
  return `{...threadmarkTarget("${id}")}`;
}

/** A suggested stable id for an untagged element, from its accessible name or text. */
export function suggestTargetId({ name, tag } = {}, takenIds = []) {
  const words = String(name || "").replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).slice(0, 4).join("-").toLowerCase();
  return slugify(words ? `${words}` : tag || "element", takenIds, "element").replace(/-/g, ".");
}
