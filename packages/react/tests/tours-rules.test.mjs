import assert from "node:assert/strict";
import test from "node:test";

import { pathMatches, pickTour, tourEligibility } from "../src/tours/eligibility.js";
import {
  createLocalProgressStore,
  mergeProgressRecords,
  normalizeProgressRecord,
  resumeStepIndex,
  storageKey,
} from "../src/tours/progress.js";
import { validateTour } from "../src/tours/schema.js";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-21T09:00:00Z");

function tour(overrides = {}) {
  const result = validateTour({
    id: "welcome",
    title: "Welcome",
    showTo: { path: "/projects" },
    steps: [
      { id: "a", target: "one", title: "A" },
      { id: "b", target: "two", title: "B" },
      { id: "c", target: "three", title: "C" },
    ],
    ...overrides,
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.tour;
}

function record(fields) {
  return { tourId: "welcome", status: "inProgress", seen: [], startedAt: NOW - DAY, updatedAt: NOW - DAY, ...fields };
}

const here = { path: "/projects", device: "desktop", user: null, now: NOW };

test("paths match exactly, or by prefix when they end in *", () => {
  assert.equal(pathMatches(undefined, "/anything"), true);
  assert.equal(pathMatches("/projects", "/projects"), true);
  assert.equal(pathMatches("/projects", "/projects/1"), false);
  assert.equal(pathMatches("/projects/*", "/projects/1"), true);
  assert.equal(pathMatches("/projects/*", "/team"), false);
});

test("eligibility checks page, screen, traits, and the custom rule, and says why", () => {
  const owners = tour({ showTo: { path: "/projects", device: "desktop", traits: { role: "owner", signedUpAt: { within: "7d" } } } });
  const newOwner = { traits: { role: "owner", signedUpAt: new Date(NOW - 2 * DAY).toISOString() } };
  assert.deepEqual(tourEligibility(owners, { ...here, user: newOwner }), { eligible: true, reason: "new" });
  assert.equal(tourEligibility(owners, { ...here, path: "/team", user: newOwner }).reason, "path");
  assert.equal(tourEligibility(owners, { ...here, device: "phone", user: newOwner }).reason, "device");
  assert.equal(tourEligibility(owners, { ...here, user: { traits: { ...newOwner.traits, role: "member" } } }).reason, "traits");
  assert.equal(tourEligibility(owners, { ...here, user: { traits: { role: "owner", signedUpAt: NOW - 30 * DAY } } }).reason, "traits");
  assert.equal(tourEligibility(owners, { ...here, user: null }).reason, "traits");

  const custom = tour({ showTo: { when: (user) => user.traits?.beta === true } });
  assert.equal(tourEligibility(custom, { ...here, user: { traits: { beta: true } } }).eligible, true);
  assert.equal(tourEligibility(custom, here).reason, "when");
  const throwing = tour({ showTo: { when: () => { throw new Error("boom"); } } });
  assert.equal(tourEligibility(throwing, here).reason, "when");
});

test("finished stays finished, and skipped comes back only after afterSkip", () => {
  assert.equal(tourEligibility(tour(), { ...here, record: record({ status: "finished" }) }).reason, "finished");
  assert.equal(tourEligibility(tour({ repeat: "everyVisit" }), { ...here, record: record({ status: "finished" }) }).eligible, true);
  assert.equal(tourEligibility(tour(), { ...here, record: record({ status: "skipped" }) }).reason, "skipped");
  const weekly = tour({ afterSkip: "7d" });
  assert.equal(tourEligibility(weekly, { ...here, record: record({ status: "skipped", updatedAt: NOW - 6 * DAY }) }).reason, "skipped");
  assert.equal(tourEligibility(weekly, { ...here, record: record({ status: "skipped", updatedAt: NOW - 8 * DAY }) }).eligible, true);
  assert.equal(tourEligibility(tour(), { ...here, record: record({ status: "paused", seen: ["a"] }) }).reason, "resume");
});

test("picks the first eligible tour for the trigger and respects the visit and gap rules", () => {
  const welcome = tour();
  const invite = tour({ id: "invite", showTo: { path: "/projects" } });
  const onOpen = tour({ id: "editor", showTo: {}, start: { on: "project.opened" } });
  const options = { records: {}, shownThisVisit: [], trigger: { kind: "pageLoad" } };

  assert.equal(pickTour([welcome, invite, onOpen], here, options).tour.id, "welcome");
  assert.equal(pickTour([welcome, onOpen], here, { ...options, trigger: { kind: "event", event: "project.opened" } }).tour.id, "editor");
  assert.equal(pickTour([welcome], here, { ...options, trigger: { kind: "event", event: "other" } }), null);

  // One new tour per visit, but a tour already part-way through can always be offered.
  assert.equal(pickTour([invite], here, { ...options, shownThisVisit: ["welcome"] }), null);
  const resuming = pickTour([welcome], here, {
    ...options,
    shownThisVisit: ["invite"],
    records: { welcome: record({ status: "paused", seen: ["a"] }) },
  });
  assert.deepEqual([resuming.tour.id, resuming.resume, resuming.continueDirectly], ["welcome", true, undefined]);

  // Within the same visit: a full page load mid-tour carries straight on, but "Not now" is respected.
  const midTour = pickTour([welcome], here, { ...options, shownThisVisit: ["welcome"], records: { welcome: record({ status: "inProgress", seen: ["a"] }) } });
  assert.equal(midTour.continueDirectly, true);
  assert.equal(pickTour([welcome], here, { ...options, shownThisVisit: ["welcome"], records: { welcome: record({ status: "paused", seen: ["a"] }) } }), null);

  // Another tour started an hour ago, so a new one waits a day.
  const recent = { welcome: record({ status: "finished", startedAt: NOW - 3_600_000 }) };
  assert.equal(pickTour([invite], here, { ...options, records: recent }), null);
  assert.equal(pickTour([invite], here, { ...options, records: recent, rules: { perVisit: 1, gapMs: 0 } }).tour.id, "invite");
  assert.equal(pickTour([invite], here, { ...options, records: { welcome: record({ status: "finished", startedAt: NOW - 2 * DAY }) } }).tour.id, "invite");
});

test("manual tours never start on their own", () => {
  const manual = tour({ start: "manual" });
  assert.equal(pickTour([manual], here, { records: {}, shownThisVisit: [], trigger: { kind: "pageLoad" } }), null);
});

test("progress records are validated before use", () => {
  assert.equal(normalizeProgressRecord(null), null);
  assert.equal(normalizeProgressRecord({ tourId: "welcome", status: "done", updatedAt: 1 }), null);
  assert.equal(normalizeProgressRecord({ tourId: "welcome", status: "paused", updatedAt: "soon" }), null);
  assert.deepEqual(normalizeProgressRecord({ tourId: "welcome", status: "paused", updatedAt: 5, seen: ["a", "a", 3] }), {
    tourId: "welcome",
    userId: undefined,
    status: "paused",
    stepId: undefined,
    seen: ["a"],
    startedAt: 5,
    updatedAt: 5,
  });
});

test("merging keeps done as done, otherwise the newest step wins, and seen steps combine", () => {
  const laptop = record({ status: "inProgress", stepId: "c", seen: ["a", "b", "c"], updatedAt: NOW });
  const phoneFinishedEarlier = record({ status: "finished", stepId: "b", seen: ["a", "b"], updatedAt: NOW - 5_000, startedAt: NOW - 2 * DAY });
  const merged = mergeProgressRecords(laptop, phoneFinishedEarlier);
  assert.equal(merged.status, "finished");
  assert.deepEqual(merged.seen, ["a", "b", "c"]);
  assert.equal(merged.startedAt, NOW - 2 * DAY);

  const older = record({ stepId: "a", seen: ["a"], updatedAt: NOW - 10 });
  const newer = record({ status: "paused", stepId: "b", seen: ["b"], updatedAt: NOW });
  assert.deepEqual([mergeProgressRecords(older, newer).stepId, mergeProgressRecords(newer, older).stepId], ["b", "b"]);
  assert.equal(mergeProgressRecords(null, newer).stepId, "b");
});

test("resuming follows step ids, so reordered or added steps resume at the first unseen one", () => {
  const original = tour();
  assert.equal(resumeStepIndex(original, null), 0);
  assert.equal(resumeStepIndex(original, record({ seen: ["a"] })), 1);
  assert.equal(resumeStepIndex(original, record({ seen: ["a", "b", "c"] })), 2);
  const reordered = tour({ steps: [
    { id: "c", target: "three", title: "C" },
    { id: "new", target: "four", title: "New" },
    { id: "a", target: "one", title: "A" },
  ] });
  assert.equal(resumeStepIndex(reordered, record({ seen: ["a", "c"] })), 1);
});

test("the local store survives missing, broken, or blocked storage", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
  const store = createLocalProgressStore(storage);
  const saved = record({ userId: "u_mira", seen: ["a"] });
  store.write(saved);
  assert.ok(memory.has(storageKey("welcome", "u_mira")));
  assert.deepEqual(store.read("welcome", "u_mira"), normalizeProgressRecord(saved));
  assert.equal(store.read("welcome", undefined), null);
  memory.set(storageKey("welcome"), "{not json");
  assert.equal(store.read("welcome"), null);
  store.remove("welcome", "u_mira");
  assert.equal(store.read("welcome", "u_mira"), null);

  const blocked = createLocalProgressStore({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("blocked"); } });
  assert.equal(blocked.read("welcome"), null);
  assert.doesNotThrow(() => blocked.write(saved));
  assert.doesNotThrow(() => blocked.remove("welcome"));
  assert.equal(createLocalProgressStore(undefined).read("welcome"), null);
});
