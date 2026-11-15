import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackPayload, normalizeLinks } from "../src/core.js";

test("comment links keep a label, an http(s) url and an open or closed status", () => {
  assert.deepEqual(normalizeLinks([
    { destination: "github", label: "GitHub #482", url: "https://github.com/studio/site/issues/482", status: "open" },
    { label: "Linear PAR-12", url: "javascript:alert(1)", status: "weird" },
    { url: "https://example.com" },
    null,
  ]), [
    { destination: "github", label: "GitHub #482", url: "https://github.com/studio/site/issues/482", status: "open" },
    { destination: null, label: "Linear PAR-12", url: null, status: null },
  ]);
});

test("links survive a payload rebuild and are left out when empty", () => {
  const base = { id: "c1", projectKey: "p", route: "/", comment: "Hi", target: { kind: "element", selector: "#a" } };
  const withLinks = createFeedbackPayload({ ...base, links: [{ label: "GitHub #1", url: "https://github.com/x", status: "closed" }] });
  assert.equal(createFeedbackPayload(withLinks).links[0].status, "closed");
  assert.equal("links" in createFeedbackPayload(base), false);
});
