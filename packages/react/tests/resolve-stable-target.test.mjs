import assert from "node:assert/strict";
import test from "node:test";

import { resolveStableTarget } from "../src/resolveStableTarget.js";
import { THREADMARK_TARGET_ATTRIBUTE } from "../src/targetId.js";

function fakeElement(stableId, extra = {}) {
  return { getAttribute: (name) => (name === THREADMARK_TARGET_ATTRIBUTE ? stableId : null), ...extra };
}

function fakeDocument(elements) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, `[${THREADMARK_TARGET_ATTRIBUTE}]`);
      return elements;
    },
  };
}

test("resolves a stable id that matches exactly one element", () => {
  const match = fakeElement("projects.new");
  const result = resolveStableTarget("projects.new", {
    documentRef: fakeDocument([fakeElement("nav.team"), match]),
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.element, match);
  assert.deepEqual(result.candidates, [match]);
});

test("never guesses between several elements with the same stable id", () => {
  const first = fakeElement("team.invite");
  const second = fakeElement("team.invite");
  const result = resolveStableTarget("team.invite", { documentRef: fakeDocument([first, second]) });
  assert.equal(result.status, "ambiguous");
  assert.equal(result.element, null);
  assert.deepEqual(result.candidates, [first, second]);
});

test("lets callers rule elements out before counting matches", () => {
  const hidden = fakeElement("team.invite", { hidden: true });
  const visible = fakeElement("team.invite");
  const result = resolveStableTarget("team.invite", {
    documentRef: fakeDocument([hidden, visible]),
    accept: (element) => !element.hidden,
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.element, visible);
});

test("reports missing targets, empty ids, and absent documents", () => {
  assert.equal(resolveStableTarget("nav.menu", { documentRef: fakeDocument([fakeElement("nav.team")]) }).status, "missing");
  assert.deepEqual(resolveStableTarget("", { documentRef: fakeDocument([]) }), { status: "missing", element: null, candidates: [] });
  assert.equal(resolveStableTarget("nav.team", { documentRef: null }).status, "missing");
});
