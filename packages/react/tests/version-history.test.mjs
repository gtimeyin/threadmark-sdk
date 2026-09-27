import assert from "node:assert/strict";
import test from "node:test";
import { buildPageVersionUrl, normalizePageVersions } from "../src/versionHistory.js";

test("page version URLs use the current route and discard deployment query or hash data", () => {
  assert.equal(
    buildPageVersionUrl("https://preview.example.test/source?token=secret#old", "/settings/profile"),
    "https://preview.example.test/settings/profile",
  );
  assert.equal(buildPageVersionUrl("javascript:alert(1)", "/settings"), null);
  assert.equal(buildPageVersionUrl("not a url", "/settings", "not a url"), null);
});
test("page versions are bounded, normalized, and current-first", () => {
  const versions = normalizePageVersions([
    {
      id: "previous",
      buildId: "build-1",
      url: "https://previous.example.test",
      createdAt: "2026-08-30T10:00:00.000Z",
      state: "ready",
      feedbackCount: 4.8,
    },
    {
      id: "current",
      buildId: "build-2",
      url: "https://current.example.test/base",
      createdAt: "2026-08-29T10:00:00.000Z",
      state: "unexpected",
      feedbackCount: -2,
    },
    { id: "unsafe", url: "data:text/html,unsafe" },
  ], {
    currentBuildId: "build-2",
    route: "/review-targets",
    currentUrl: "https://app.example.test/review-targets",
  });

  assert.equal(versions.length, 2);
  assert.deepEqual(versions.map(({ id }) => id), ["current", "previous"]);
  assert.equal(versions[0].current, true);
  assert.equal(versions[0].state, "ready");
  assert.equal(versions[0].feedbackCount, 0);
  assert.equal(versions[0].url, "https://current.example.test/review-targets");
  assert.equal(versions[1].feedbackCount, 4);
});
