import assert from "node:assert/strict";
import test from "node:test";

import {
  TOUR_SCHEMA_URL,
  addStep,
  createTour,
  moveStep,
  removeStep,
  serializeTour,
  slugify,
  stableIdSnippet,
  stepPagesOf,
  suggestTargetId,
  tourFileName,
  tourProblems,
  updateStep,
  updateTourSettings,
} from "../src/tours/authoring.js";
import { validateTour } from "../src/tours/schema.js";

test("slugs are readable, valid ids and never collide", () => {
  assert.equal(slugify("Start something new"), "start-something-new");
  assert.equal(slugify("Café & “quotes”!"), "cafe-quotes");
  assert.equal(slugify(""), "step");
  assert.equal(slugify("Intro", ["intro", "intro-2"]), "intro-3");
  assert.equal(slugify("x".repeat(80)).length, 48);
});

test("a new tour starts on the current page and becomes valid once it has a step", () => {
  const tour = createTour({ title: "Welcome to Launchpad", path: "/projects", takenIds: ["welcome-to-launchpad"] });
  assert.deepEqual(tour, { $schema: TOUR_SCHEMA_URL, id: "welcome-to-launchpad-2", title: "Welcome to Launchpad", showTo: { path: "/projects" }, steps: [] });
  assert.deepEqual(tourProblems(tour), [{ path: "steps", message: "Add a step by clicking something on the page." }]);
  const withStep = addStep(tour, { target: "projects.new", title: "Start something new", page: "/projects" });
  assert.deepEqual(tourProblems(withStep), []);
  assert.equal(validateTour(withStep).ok, true);
});

test("steps only record a page when it changes, and ids stay unique", () => {
  let tour = createTour({ title: "Invite", path: "/projects" });
  tour = addStep(tour, { target: "nav.team", title: "Your team", page: "/projects" });
  tour = addStep(tour, { target: "team.invite", title: "Invite", page: "/team" });
  tour = addStep(tour, { target: "team.role", title: "Invite", page: "/team" });
  assert.deepEqual(tour.steps.map((step) => [step.id, step.page]), [["your-team", undefined], ["invite", "/team"], ["invite-2", undefined]]);
  assert.deepEqual(stepPagesOf(tour), ["/projects", "/team", "/team"]);
  assert.throws(() => addStep(tour, { target: "not valid" }), TypeError);

  const inserted = addStep(tour, { target: "nav.menu", title: "Menu", page: "/projects", index: 0 });
  assert.equal(inserted.steps[0].id, "menu");
  assert.equal(inserted.steps[0].page, undefined);
  assert.equal(addStep(createTour({ title: "x" }), { target: "a" }).steps[0].title, "Step 1");
});

test("editing a step keeps its id, drops defaults, and removes cleared fields", () => {
  let tour = addStep(createTour({ title: "T", path: "/" }), { target: "a.b", title: "Old" });
  const id = tour.steps[0].id;
  tour = updateStep(tour, id, { id: "renamed", title: "New title", body: "Some text", next: "click", style: "tooltip" });
  assert.deepEqual(tour.steps[0], { id, target: "a.b", title: "New title", body: "Some text", next: "click", style: "tooltip" });
  tour = updateStep(tour, id, { body: "  ", next: "button", style: "spotlight", placement: "auto", arrive: "navigate" });
  assert.deepEqual(tour.steps[0], { id, target: "a.b", title: "New title" });
  assert.equal(updateStep(tour, id, { title: "" }).steps[0].title, "");
  assert.ok(tourProblems(updateStep(tour, id, { title: "" })).some((problem) => problem.path === "steps[0].title"));
});

test("steps move and disappear without touching the others", () => {
  let tour = createTour({ title: "T" });
  for (const target of ["a", "b", "c"]) tour = addStep(tour, { target, title: target });
  assert.deepEqual(moveStep(tour, "c", -1).steps.map((step) => step.id), ["a", "c", "b"]);
  assert.deepEqual(moveStep(tour, "a", -1).steps.map((step) => step.id), ["a", "b", "c"]);
  assert.deepEqual(moveStep(tour, "nope", 1), tour);
  assert.deepEqual(removeStep(tour, "b").steps.map((step) => step.id), ["a", "c"]);
});

test("tour settings drop defaults and empty values so files stay short", () => {
  const tour = createTour({ title: "T", path: "/projects" });
  const set = updateTourSettings(tour, { showTo: { path: "/projects", device: "phone" }, start: { after: "pageLoad", wait: "2s" }, repeat: "untilFinished", afterSkip: "7d" });
  assert.deepEqual([set.showTo, set.start, set.repeat, set.afterSkip], [{ path: "/projects", device: "phone" }, { after: "pageLoad", wait: "2s" }, "untilFinished", "7d"]);
  const reset = updateTourSettings(set, { showTo: { path: "", device: "any", traits: {} }, start: "pageLoad", repeat: "once", afterSkip: "never" });
  for (const key of ["showTo", "start", "repeat", "afterSkip"]) assert.equal(key in reset, false, key);
});

test("tours serialize with a stable key order and the schema link, ready to save", () => {
  let tour = { steps: [], title: "Welcome", id: "welcome", repeat: "untilFinished" };
  tour = addStep(tour, { target: "projects.new", title: "Start" });
  tour = updateStep(tour, "start", { body: "Begin here", next: "click" });
  const text = serializeTour(tour);
  assert.ok(text.endsWith("}\n"));
  const parsed = JSON.parse(text);
  assert.deepEqual(Object.keys(parsed), ["$schema", "id", "title", "repeat", "steps"]);
  assert.deepEqual(Object.keys(parsed.steps[0]), ["id", "target", "title", "body", "next"]);
  assert.equal(parsed.$schema, TOUR_SCHEMA_URL);
  assert.equal(tourFileName(tour), "tours/welcome.tour.json");
  assert.equal(validateTour(parsed).ok, true);
});

test("untagged elements get a suggested id and a paste-ready snippet", () => {
  assert.equal(suggestTargetId({ name: "Invite people", tag: "button" }), "invite.people");
  assert.equal(suggestTargetId({ name: "", tag: "button" }), "button");
  assert.equal(suggestTargetId({ name: "Save", tag: "button" }, ["save"]), "save.2");
  assert.equal(stableIdSnippet("invite.people"), '{...threadmarkTarget("invite.people")}');
});
