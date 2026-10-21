import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PHONE_KEYS,
  SHOW_TO_KEYS,
  STEP_KEYS,
  TOUR_KEYS,
  TourValidationError,
  defineTour,
  parseDuration,
  validateTour,
} from "../src/tours/schema.js";

const welcome = {
  $schema: "https://unpkg.com/threadmark-react/tour.schema.json",
  id: "welcome",
  title: "Welcome to Launchpad",
  showTo: { path: "/projects", device: "any", traits: { role: "owner", plan: ["free", "pro"], signedUpAt: { within: "7d" } } },
  start: { after: "pageLoad", wait: "2s" },
  repeat: "once",
  afterSkip: "7d",
  steps: [
    { id: "new-project", page: "/projects", target: "projects.new", title: "Start something new", body: "Every project begins here." },
    {
      id: "invite",
      page: "/team",
      target: "team.invite",
      title: "Bring your people in",
      next: "click",
      waitFor: { timeout: "8s" },
      phone: { target: "nav.menu", title: "Invite lives in the menu" },
    },
    { id: "done", title: "You're all set", style: "modal" },
  ],
};

function errorPaths(input) {
  return validateTour(input).errors.map((error) => error.path);
}

test("parses durations into milliseconds and rejects anything else", () => {
  assert.equal(parseDuration("500ms"), 500);
  assert.equal(parseDuration("2s"), 2_000);
  assert.equal(parseDuration("1.5m"), 90_000);
  assert.equal(parseDuration("7d"), 604_800_000);
  assert.equal(parseDuration(250), 250);
  for (const bad of ["", "2", "2 s", "-1s", "soon", null, undefined, -5, Number.NaN]) {
    assert.equal(parseDuration(bad), null, String(bad));
  }
});

test("normalizes a complete tour with defaults applied", () => {
  const result = validateTour(welcome);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const { tour } = result;
  assert.equal(tour.id, "welcome");
  assert.deepEqual(tour.start, { kind: "pageLoad", waitMs: 2_000 });
  assert.equal(tour.afterSkipMs, 604_800_000);
  assert.deepEqual(tour.showTo.traits, {
    role: { equals: "owner" },
    plan: { oneOf: ["free", "pro"] },
    signedUpAt: { withinMs: 604_800_000 },
  });
  assert.deepEqual(tour.steps[0], {
    id: "new-project",
    page: "/projects",
    target: "projects.new",
    title: "Start something new",
    body: "Every project begins here.",
    style: "spotlight",
    placement: "auto",
    next: "button",
    arrive: "navigate",
    waitMs: 5_000,
    phone: undefined,
  });
  assert.equal(tour.steps[1].waitMs, 8_000);
  assert.equal(tour.steps[1].phone.target, "nav.menu");
  assert.equal(tour.steps[2].target, undefined);
});

test("fills in defaults for a minimal tour", () => {
  const { ok, tour } = validateTour({ id: "tiny", title: "Tiny", steps: [{ id: "one", target: "a", title: "One" }] });
  assert.equal(ok, true);
  assert.deepEqual(tour.start, { kind: "pageLoad", waitMs: 0 });
  assert.equal(tour.repeat, "once");
  assert.equal(tour.afterSkipMs, null);
  assert.equal(tour.showTo.device, "any");
  assert.deepEqual(validateTour({ ...welcome, start: "manual" }).tour.start, { kind: "manual" });
  assert.deepEqual(validateTour({ ...welcome, start: { on: "project.opened" } }).tour.start, { kind: "event", event: "project.opened" });
});

test("rejects unknown fields so typos fail before they ship", () => {
  assert.deepEqual(errorPaths({ ...welcome, titel: "x" }), ["tour.titel"]);
  assert.deepEqual(errorPaths({ ...welcome, steps: [{ ...welcome.steps[0], targt: "x" }] }), ["steps[0].targt"]);
  assert.deepEqual(errorPaths({ ...welcome, showTo: { path: "/", audience: "new" } }), ["showTo.audience"]);
});

test("explains invalid ids, targets, text, and options by path", () => {
  const paths = errorPaths({
    id: "bad id",
    title: "",
    start: "soon",
    repeat: "sometimes",
    afterSkip: "later",
    showTo: { path: "projects", device: "watch", traits: { role: { is: "owner" } } },
    steps: [
      { id: "one", target: "has spaces", title: "x".repeat(121) },
      { id: "one", target: "ok", title: "Two", next: "hover", page: "/team?tab=1", waitFor: { timeout: "1m" } },
      { id: "three", title: "Three", style: "modal", next: "click" },
    ],
  });
  for (const expected of [
    "id", "title", "start", "repeat", "afterSkip",
    "showTo.path", "showTo.device", "showTo.traits.role",
    "steps[0].target", "steps[0].title",
    "steps[1].id", "steps[1].next", "steps[1].page", "steps[1].waitFor.timeout",
    "steps[2].next",
  ]) {
    assert.ok(paths.includes(expected), `expected an error at ${expected}; got ${paths.join(", ")}`);
  }
});

test("requires 1–20 steps and a target on every step except modals", () => {
  assert.deepEqual(errorPaths({ ...welcome, steps: [] }), ["steps"]);
  assert.deepEqual(errorPaths({ ...welcome, steps: Array.from({ length: 21 }, (_, i) => ({ id: `s${i}`, target: "a", title: "x" })) }), ["steps"]);
  assert.deepEqual(errorPaths({ ...welcome, steps: [{ id: "one", title: "No target" }] }), ["steps[0].target"]);
});

test("only defineTour files may use a function for showTo.when", () => {
  const when = (user) => user.traits.beta === true;
  assert.equal(validateTour({ ...welcome, showTo: { when } }).tour.showTo.when, when);
  assert.deepEqual(errorPaths({ ...welcome, showTo: { when: "user.beta" } }), ["showTo.when"]);
});

test("defineTour returns the original data and throws a readable error on mistakes", () => {
  assert.equal(defineTour(welcome), welcome);
  assert.throws(
    () => defineTour({ ...welcome, steps: [{ id: "one", title: "No target" }] }),
    (error) => error instanceof TourValidationError
      && error.errors[0].path === "steps[0].target"
      && error.message.includes("steps[0].target"),
  );
});

test("the published JSON Schema lists the same fields as the validator", async () => {
  const schema = JSON.parse(await readFile(new URL("../tour.schema.json", import.meta.url), "utf8"));
  const keys = (object) => Object.keys(object).sort();
  assert.deepEqual(keys(schema.properties), [...TOUR_KEYS].sort());
  assert.deepEqual(keys(schema.properties.showTo.properties), [...SHOW_TO_KEYS].sort());
  assert.deepEqual(keys(schema.$defs.step.properties), [...STEP_KEYS].sort());
  assert.deepEqual(keys(schema.$defs.step.properties.phone.properties), [...PHONE_KEYS].sort());
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.step.additionalProperties, false);
});
