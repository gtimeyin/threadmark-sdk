import assert from "node:assert/strict";
import test from "node:test";

import { normalizeNextSteps } from "../src/nextSteps.js";

test("no next steps from the host means no tab", () => {
  assert.equal(normalizeNextSteps(undefined), null);
  assert.equal(normalizeNextSteps(null), null);
  assert.equal(normalizeNextSteps(false), null);
  assert.equal(normalizeNextSteps("steps"), null);
  assert.deepEqual(normalizeNextSteps([]).steps, [], "an empty list still shows the tab");
});

test("steps keep only the expected shape, unfinished first", () => {
  const result = normalizeNextSteps({
    canEdit: false,
    status: { state: "failed", error: "  OpenAI is out of credit  ", generatedAt: "2026-10-18T10:00:00.000Z", openThreads: 3.7 },
    steps: [
      { id: "a", title: "Done one", completed: true, completedVia: "agent", completedBy: { displayName: "Ada", email: "ada@example.test" }, completedAt: "nope" },
      { id: "b", title: "  Fix   the\nbutton  ", notes: " - one\n- two ", tag: "bug", source: "person", completed: false,
        sources: [
          { feedbackId: "t1", quote: "q", route: "/checkout", author: "Bea", status: "resolved" },
          { feedbackId: "t2", route: "//evil.example/x" },
          { quote: "no id" },
        ] },
      { id: "b", title: "Duplicate id" },
      { id: "c", title: "", completed: false },
      { title: "No id" },
      { id: "d", title: "Odd tag", tag: "urgent", source: "robot", completedVia: "magic" },
    ],
  });
  assert.equal(result.canEdit, false);
  assert.deepEqual(result.status, { state: "failed", generatedAt: "2026-10-18T10:00:00.000Z", error: "OpenAI is out of credit", openThreads: 3 });
  assert.deepEqual(result.steps.map((step) => step.id), ["b", "d", "a"]);
  assert.deepEqual(result.steps[0], {
    id: "b", title: "Fix the button", notes: "- one\n- two", tag: "bug", source: "person", completed: false, completedVia: null, completedBy: null, completedAt: null,
    sources: [
      { feedbackId: "t1", quote: "q", route: "/checkout", author: "Bea", status: "resolved" },
      { feedbackId: "t2", quote: "", route: null, author: null, status: "open" },
    ],
  });
  assert.deepEqual([result.steps[1].tag, result.steps[1].source, result.steps[1].completedVia], [null, "ai", null]);
  assert.deepEqual(result.steps[2].completedBy, { displayName: "Ada" }, "only the name is kept");
  assert.equal(result.steps[2].completedAt, null);
});

test("an unknown state reads as ready, and errors only show when failed", () => {
  const result = normalizeNextSteps({ steps: [{ id: "a", title: "A" }], status: { state: "weird", error: "hidden" } });
  assert.deepEqual(result.status, { state: "ready", generatedAt: null, error: null, openThreads: null });
  assert.equal(result.canEdit, true);
});
