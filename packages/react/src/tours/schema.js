import { isValidThreadmarkTargetId } from "../targetId.js";

// Tour file format, schema v1. Keep these key lists in sync with tour.schema.json;
// tests/tours-schema.test.mjs compares them.
export const TOUR_KEYS = ["$schema", "id", "title", "showTo", "start", "repeat", "afterSkip", "steps"];
export const SHOW_TO_KEYS = ["path", "device", "traits", "when"];
export const STEP_KEYS = ["id", "page", "target", "title", "body", "style", "placement", "next", "arrive", "waitFor", "phone"];
export const PHONE_KEYS = ["target", "title", "body", "style", "placement", "next"];
export const STYLES = ["spotlight", "tooltip", "modal"];
export const PLACEMENTS = ["auto", "top", "bottom", "left", "right", "sheet"];
export const NEXT_MODES = ["button", "click"];
export const ARRIVE_MODES = ["navigate", "point"];
export const REPEAT_MODES = ["once", "untilFinished", "everyVisit"];
export const DEVICES = ["any", "desktop", "phone"];

const MAX_STEPS = 20;
const MAX_TITLE = 120;
const MAX_BODY = 600;
const MAX_WAIT_MS = 30_000;
const DEFAULT_WAIT_MS = 5_000;
const UNITS = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export class TourValidationError extends TypeError {
  constructor(errors) {
    super(`Invalid Threadmark tour:\n${errors.map((error) => `  ${error.path}: ${error.message}`).join("\n")}`);
    this.name = "TourValidationError";
    this.errors = errors;
  }
}

/** "500ms", "2s", "5m", "1h", "7d" → milliseconds; null when the value is not a duration. */
export function parseDuration(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) * UNITS[match[2]] : null;
}

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function checker(errors) {
  const fail = (path, message) => {
    errors.push({ path, message });
    return undefined;
  };
  return {
    fail,
    keys(value, allowed, path) {
      for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) fail(`${path}.${key}`, "is not a known field");
      }
    },
    text(value, path, max, { required = false } = {}) {
      if (value === undefined && !required) return undefined;
      if (typeof value !== "string" || !value.trim()) return fail(path, "must be a non-empty string");
      if (value.trim().length > max) return fail(path, `must be at most ${max} characters`);
      return value.trim();
    },
    oneOf(value, options, path, fallback) {
      if (value === undefined) return fallback;
      if (!options.includes(value)) return fail(path, `must be one of ${options.map((option) => `"${option}"`).join(", ")}`);
      return value;
    },
    stableId(value, path, label) {
      if (!isValidThreadmarkTargetId(value)) {
        return fail(path, `must be a ${label}: 1–120 letters, numbers, dots, underscores, colons, or hyphens`);
      }
      return value;
    },
    page(value, path) {
      if (value === undefined) return undefined;
      if (typeof value !== "string" || !/^\/[^\s?#]*$/.test(value)) return fail(path, 'must be a path like "/projects" (no query or hash)');
      return value;
    },
  };
}

function normalizeTraits(traits, check) {
  if (traits === undefined) return undefined;
  if (!isPlainObject(traits)) return check.fail("showTo.traits", "must be an object");
  const result = {};
  for (const [key, condition] of Object.entries(traits)) {
    const path = `showTo.traits.${key}`;
    if (["string", "number", "boolean"].includes(typeof condition)) result[key] = { equals: condition };
    else if (Array.isArray(condition) && condition.length && condition.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
      result[key] = { oneOf: condition };
    } else if (isPlainObject(condition) && Object.keys(condition).length === 1 && parseDuration(condition.within) !== null) {
      result[key] = { withinMs: parseDuration(condition.within) };
    } else {
      check.fail(path, 'must be a value, a list of values, or { "within": "7d" }');
    }
  }
  return result;
}

function normalizeShowTo(showTo, check) {
  if (showTo === undefined) return { device: "any" };
  if (!isPlainObject(showTo)) return check.fail("showTo", "must be an object");
  check.keys(showTo, SHOW_TO_KEYS, "showTo");
  if (showTo.path !== undefined && (typeof showTo.path !== "string" || !/^\/[^\s?#]*\*?$/.test(showTo.path))) {
    check.fail("showTo.path", 'must be a path like "/projects", or end in "*" to match a prefix');
  }
  if (showTo.when !== undefined && typeof showTo.when !== "function") {
    check.fail("showTo.when", "must be a function (only in defineTour files)");
  }
  return {
    path: showTo.path,
    device: check.oneOf(showTo.device, DEVICES, "showTo.device", "any"),
    traits: normalizeTraits(showTo.traits, check),
    when: typeof showTo.when === "function" ? showTo.when : undefined,
  };
}

function normalizeStart(start, check) {
  if (start === undefined || start === "pageLoad") return { kind: "pageLoad", waitMs: 0 };
  if (start === "manual") return { kind: "manual" };
  if (isPlainObject(start)) {
    if (typeof start.on === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/.test(start.on) && Object.keys(start).length === 1) {
      return { kind: "event", event: start.on };
    }
    const waitMs = parseDuration(start.wait);
    if (start.after === "pageLoad" && waitMs !== null && waitMs <= MAX_WAIT_MS && Object.keys(start).length === 2) {
      return { kind: "pageLoad", waitMs };
    }
  }
  return check.fail("start", '"pageLoad", "manual", { "after": "pageLoad", "wait": "2s" } (up to 30s), or { "on": "event.name" }');
}

function normalizeAfterSkip(afterSkip, check) {
  if (afterSkip === undefined || afterSkip === "never") return null;
  const ms = parseDuration(afterSkip);
  if (ms === null || ms === 0) return check.fail("afterSkip", '"never" or a duration such as "7d"');
  return ms;
}

function normalizeStep(step, index, check, stepIds) {
  const path = `steps[${index}]`;
  if (!isPlainObject(step)) return check.fail(path, "must be an object");
  check.keys(step, STEP_KEYS, path);
  const id = check.stableId(step.id, `${path}.id`, "step id");
  if (id && stepIds.has(id)) check.fail(`${path}.id`, `repeats "${id}"; step ids must be unique`);
  if (id) stepIds.add(id);

  const style = check.oneOf(step.style, STYLES, `${path}.style`, "spotlight");
  const target = step.target === undefined && style === "modal" ? undefined : check.stableId(step.target, `${path}.target`, "Threadmark target id");
  const next = check.oneOf(step.next, NEXT_MODES, `${path}.next`, "button");
  if (next === "click" && !target) check.fail(`${path}.next`, '"click" needs a target to click');

  let waitMs = DEFAULT_WAIT_MS;
  if (step.waitFor !== undefined) {
    if (!isPlainObject(step.waitFor)) check.fail(`${path}.waitFor`, 'must be an object such as { "timeout": "5s" }');
    else {
      check.keys(step.waitFor, ["timeout"], `${path}.waitFor`);
      const timeout = parseDuration(step.waitFor.timeout ?? "5s");
      if (timeout === null || timeout > MAX_WAIT_MS) check.fail(`${path}.waitFor.timeout`, "must be a duration up to 30s");
      else waitMs = timeout;
    }
  }

  let phone;
  if (step.phone !== undefined) {
    if (!isPlainObject(step.phone)) check.fail(`${path}.phone`, "must be an object");
    else {
      check.keys(step.phone, PHONE_KEYS, `${path}.phone`);
      phone = {
        target: step.phone.target === undefined ? undefined : check.stableId(step.phone.target, `${path}.phone.target`, "Threadmark target id"),
        title: check.text(step.phone.title, `${path}.phone.title`, MAX_TITLE),
        body: check.text(step.phone.body, `${path}.phone.body`, MAX_BODY),
        style: step.phone.style === undefined ? undefined : check.oneOf(step.phone.style, STYLES, `${path}.phone.style`),
        placement: step.phone.placement === undefined ? undefined : check.oneOf(step.phone.placement, PLACEMENTS, `${path}.phone.placement`),
        next: step.phone.next === undefined ? undefined : check.oneOf(step.phone.next, NEXT_MODES, `${path}.phone.next`),
      };
    }
  }

  return {
    id,
    page: check.page(step.page, `${path}.page`),
    target,
    title: check.text(step.title, `${path}.title`, MAX_TITLE, { required: true }),
    body: check.text(step.body, `${path}.body`, MAX_BODY),
    style,
    placement: check.oneOf(step.placement, PLACEMENTS, `${path}.placement`, "auto"),
    next,
    arrive: check.oneOf(step.arrive, ARRIVE_MODES, `${path}.arrive`, "navigate"),
    waitMs,
    phone,
  };
}

/** Validates a tour and returns `{ ok, errors, tour }`, where `tour` is normalized with defaults applied. */
export function validateTour(input) {
  const errors = [];
  const check = checker(errors);
  if (!isPlainObject(input)) {
    check.fail("tour", "must be an object");
    return { ok: false, errors, tour: null };
  }
  check.keys(input, TOUR_KEYS, "tour");
  const stepIds = new Set();
  const steps = Array.isArray(input.steps) ? input.steps : [];
  if (!Array.isArray(input.steps) || !steps.length || steps.length > MAX_STEPS) {
    check.fail("steps", `must list 1–${MAX_STEPS} steps`);
  }
  const tour = {
    id: check.stableId(input.id, "id", "tour id"),
    title: check.text(input.title, "title", MAX_TITLE, { required: true }),
    showTo: normalizeShowTo(input.showTo, check),
    start: normalizeStart(input.start, check),
    repeat: check.oneOf(input.repeat, REPEAT_MODES, "repeat", "once"),
    afterSkipMs: normalizeAfterSkip(input.afterSkip, check),
    steps: steps.slice(0, MAX_STEPS).map((step, index) => normalizeStep(step, index, check, stepIds)),
  };
  return errors.length ? { ok: false, errors, tour: null } : { ok: true, errors, tour };
}

/** Validates a hand-written tour and returns it unchanged, so it stays plain data. Throws on mistakes. */
export function defineTour(tour) {
  const result = validateTour(tour);
  if (!result.ok) throw new TourValidationError(result.errors);
  return tour;
}
