import assert from "node:assert/strict";
import test from "node:test";
import { captureEnvironment, normalizeCaptureEnvironment } from "../src/captureEnvironment.js";
import { createFeedbackPayload } from "../src/core.js";

test("collects coarse browser context without raw identifiers", () => {
  const value = captureEnvironment({ navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.1", onLine: true, connection: { effectiveType: "4g", downlink: 12, rtt: 50, ssid: "private-office" } }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 });
  assert.deepEqual(value, { browser: "Edge 130.0.1", os: "Windows", device: "desktop", viewport: { width: 1280, height: 720, devicePixelRatio: 2 }, connection: { online: true, effectiveType: "4g", downlinkMbps: 12, rttMs: 50 } });
  assert.equal(captureEnvironment({}), undefined);
});
test("handles iPad desktop mode and unavailable network estimates", () => {
  assert.deepEqual(captureEnvironment({ navigator: { userAgent: "Mozilla/5.0 (Macintosh) Version/17.1 Safari/605", maxTouchPoints: 5, onLine: false } }), { browser: "Safari 17.1", os: "iOS", device: "tablet", connection: { online: false } });
});
test("normalization drops unexpected metadata and preserves original payload context", () => {
  const context = normalizeCaptureEnvironment({ browser: "secret@example.com", os: "Linux", ip: "192.0.2.1", viewport: { width: Infinity, height: -1 }, connection: { rttMs: NaN, online: false } });
  assert.deepEqual(context, { os: "Linux", connection: { online: false } });
  const input = { id: "one", projectKey: "p", environment: "preview", route: "/", comment: "test", captureEnvironment: context };
  const first = createFeedbackPayload(input);
  assert.deepEqual(createFeedbackPayload({ ...first, comment: "edited", now: first.createdAt }).captureEnvironment, context);
  assert.equal("captureEnvironment" in createFeedbackPayload({ ...input, captureEnvironment: undefined }), false);
});
