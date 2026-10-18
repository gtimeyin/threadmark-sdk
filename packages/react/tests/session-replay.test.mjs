import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_TYPE,
  INCREMENTAL_SOURCE,
  MAX_REPLAY_HOLD_MS,
  MOUSE_INTERACTION,
  REPLAY_CONSOLE_EVENT,
  REPLAY_NETWORK_EVENT,
  createReplayBuffer,
  decodeReplayEvents,
  describeConsoleArgs,
  instrumentPage,
  networkOutcome,
  resolveSessionReplayOptions,
  sanitizeReplayUrl,
  scrubConsoleText,
  startSessionReplay,
  summarizeReplay,
} from "../src/sessionReplay.js";

const meta = (timestamp) => ({ type: EVENT_TYPE.Meta, timestamp, data: { href: "https://app.test/", width: 1280, height: 800 } });
const full = (timestamp) => ({ type: EVENT_TYPE.FullSnapshot, timestamp, data: {} });
const click = (timestamp) => ({ type: EVENT_TYPE.IncrementalSnapshot, timestamp, data: { source: INCREMENTAL_SOURCE.MouseInteraction, type: MOUSE_INTERACTION.Click, id: 4 } });
const custom = (timestamp, tag, payload) => ({ type: EVENT_TYPE.Custom, timestamp, data: { tag, payload } });

test("replay is opt-in and its buffer length is bounded", () => {
  assert.equal(resolveSessionReplayOptions(undefined).enabled, false);
  assert.equal(resolveSessionReplayOptions(false).enabled, false);
  assert.deepEqual(resolveSessionReplayOptions(true), { enabled: true, bufferMs: 30_000, provider: null });
  assert.equal(resolveSessionReplayOptions({ bufferMs: 999_999 }).bufferMs, 120_000);
  assert.equal(resolveSessionReplayOptions({ bufferMs: 10 }).bufferMs, 5_000);
  const capture = async () => null;
  assert.equal(resolveSessionReplayOptions({ provider: capture }).provider.capture, capture);
  const provider = { capture, hold() {}, release() {} };
  assert.equal(resolveSessionReplayOptions({ provider }).provider, provider);
  assert.equal(resolveSessionReplayOptions({ provider: { hold() {} } }).provider, null);
});

test("recorded URLs keep origin, path, and query names only", () => {
  assert.equal(sanitizeReplayUrl("https://user:secret@api.test/v1/orders?id=42&token=abc#frag"), "https://api.test/v1/orders?id=…&token=…");
  assert.equal(sanitizeReplayUrl("/checkout", "https://shop.test/cart"), "https://shop.test/checkout");
  assert.equal(sanitizeReplayUrl("data:text/plain,hello"), "data:");
  assert.equal(sanitizeReplayUrl("::not a url::", "not a base"), "");
});

test("console arguments become one bounded line without full object dumps", () => {
  const message = describeConsoleArgs(["Checkout failed", new TypeError("x is null"), { order: { id: 4, nested: { deep: true } } }, [1, 2, 3]]);
  assert.equal(message, "Checkout failed TypeError: x is null {order: {id: 4, nested: {…}}} [1, 2, 3]");
  assert.equal(describeConsoleArgs(["x".repeat(2000)]).length, 500);
});

test("console text is scrubbed of credentials, keys, emails, and query values before it's kept", () => {
  // Assembled at runtime so no credential-shaped literal sits in the repository.
  const part = (...pieces) => pieces.join("");
  const jwt = part("eyJhbGciOiJIUzI1NiJ9", ".", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", ".", "c2lnbmF0dXJlLXZhbHVlLWhlcmU");
  const message = describeConsoleArgs([
    `Login for ada@lumen.example.com failed with ${jwt}`,
    part("Authorization: Bearer ", "abcDEF123456789xyz"),
    part("key ", "sk-", "proj-", "Q1w2E3r4T5y6U7i8O9p0"),
    part("slack ", "xox", "b-", "1234567890-abcdefABCDEF"),
    part("agent ", "tm", "k_", "Zx9Yw8Vu7Ts6Rq5Po4"),
    { password: "hunter2", user: { token: "abc123def456" } },
    "GET https://api.lumen.test/v1/orders?id=42&session=s3cr3t#frag",
    part("hash ", "0123456789abcdef".repeat(3)),
    part("blob ", "QWxhZGRpbjpvcGVuIHNlc2FtZQ9xY2lsZW50U2VjcmV0"),
  ]);
  assert.doesNotMatch(message, /ada@lumen/);
  assert.match(message, /Login for \[email\] failed with \[redacted JWT\]/);
  assert.match(message, /Bearer \[redacted\]/);
  assert.doesNotMatch(message, /Q1w2E3r4|abcdefABCDEF|Zx9Yw8|hunter2|abc123def456|s3cr3t|0123456789abcdef0123|QWxhZGRpbj/);
  assert.match(message, /password: \[redacted\]/);
  assert.match(message, /https:\/\/api\.lumen\.test\/v1\/orders\?id=…&session=…/);
  // Ordinary text and identifiers stay readable.
  assert.equal(describeConsoleArgs(["Cart total is undefined at CheckoutSummaryComponentRenderer"]), "Cart total is undefined at CheckoutSummaryComponentRenderer");
  assert.equal(scrubConsoleText("order 7f3c2a10-5b9e-4c11-9a77-0d2e8f61b3c4 not found"), "order 7f3c2a10-5b9e-4c11-9a77-0d2e8f61b3c4 not found");
});

test("captured error stacks and summaries are scrubbed too", () => {
  const consoleRef = { error() {}, warn() {}, log() {}, info() {}, debug() {} };
  const listeners = {};
  const windowRef = {
    console: consoleRef,
    addEventListener: (name, handler) => { listeners[name] = handler; },
    removeEventListener: () => {},
    fetch: undefined,
    XMLHttpRequest: undefined,
  };
  const seen = [];
  const restore = instrumentPage({ windowRef, onConsole: (entry) => seen.push(entry), onNetwork: () => {} });
  const error = new Error("boom");
  error.stack = "Error: boom\n    at https://app.test/assets/main.js?access_token=abcdefgh12345678:1:2 (eve@corp.example)";
  consoleRef.error("Request failed", error);
  restore();
  assert.match(seen[0].stack, /main\.js\?access_token=…/);
  assert.doesNotMatch(seen[0].stack, /abcdefgh12345678|eve@corp/);
  const summary = summarizeReplay([
    meta(0),
    custom(10, REPLAY_CONSOLE_EVENT, { level: "error", message: "from a provider: carol@corp.example" }),
  ]);
  assert.equal(summary.console.entries[0].message, "from a provider: [email]");
});

test("the rolling buffer keeps only whole segments that cover the window, and holds during a review", () => {
  const buffer = createReplayBuffer({ bufferMs: 15_000 });
  buffer.push(meta(0), true);
  buffer.push(full(1), true);
  buffer.push(click(5_000));
  buffer.push(meta(10_000), true);
  buffer.push(full(10_001), true);
  buffer.push(meta(20_000), true);
  buffer.push(full(20_001), true);
  buffer.push(click(26_000));
  // At 26 s the window starts at 11 s; the 10 s segment is needed, the 0 s one is not.
  assert.deepEqual(buffer.events(26_000).map((event) => event.timestamp), [10_000, 10_001, 20_000, 20_001, 26_000]);

  buffer.hold(26_000);
  buffer.push(meta(30_000), true);
  buffer.push(full(30_001), true);
  buffer.push(meta(60_000), true);
  buffer.push(full(60_001), true);
  assert.equal(buffer.events(60_001)[0].timestamp, 10_000, "a held buffer keeps the lead-up to the review");
  assert.equal(buffer.held, true);
  buffer.push(meta(26_000 + MAX_REPLAY_HOLD_MS), true);
  assert.ok(buffer.events(26_000 + MAX_REPLAY_HOLD_MS)[0].timestamp > 10_000, "but never more than the hold limit");
  buffer.release(60_001);
  assert.equal(buffer.held, false);
});

test("events before the first snapshot are dropped so every capture can be replayed", () => {
  const buffer = createReplayBuffer();
  buffer.push(click(1));
  assert.deepEqual(buffer.events(2), []);
});

test("a summary gives agents the errors and failed requests without the raw recording", () => {
  const summary = summarizeReplay([
    meta(1_000),
    full(1_001),
    click(2_000),
    { type: EVENT_TYPE.IncrementalSnapshot, timestamp: 2_500, data: { source: INCREMENTAL_SOURCE.Input, id: 9, text: "***" } },
    custom(3_000, REPLAY_CONSOLE_EVENT, { level: "error", message: "TypeError: total is undefined" }),
    custom(3_100, REPLAY_CONSOLE_EVENT, { level: "log", message: "debug noise" }),
    custom(4_000, REPLAY_NETWORK_EVENT, { method: "POST", url: "https://api.test/checkout", status: 500, durationMs: 400, outcome: "server_error" }),
    custom(4_200, REPLAY_NETWORK_EVENT, { method: "GET", url: "https://api.test/cart", status: 200, durationMs: 50, outcome: "successful" }),
    meta(5_000),
  ]);
  assert.equal(summary.durationMs, 4_000);
  assert.deepEqual(summary.viewport, { width: 1280, height: 800 });
  assert.deepEqual(summary.actions, { clicks: 1, inputs: 1, navigations: 1 });
  assert.deepEqual(summary.console, { errors: 1, warnings: 0, entries: [{ offsetMs: 2_000, level: "error", message: "TypeError: total is undefined" }] });
  assert.deepEqual(summary.network, {
    requests: 2,
    failed: 1,
    entries: [{ offsetMs: 2_600, method: "POST", url: "https://api.test/checkout", status: 500, durationMs: 400, outcome: "server_error" }],
  });
});

test("network outcomes", () => {
  assert.equal(networkOutcome(200), "successful");
  assert.equal(networkOutcome(404), "client_error");
  assert.equal(networkOutcome(503), "server_error");
  assert.equal(networkOutcome(0), "incomplete");
  assert.equal(networkOutcome(0, true), "transport_failure");
});

test("instrumentation records console and fetch calls, keeps the page's behaviour, and restores itself", async () => {
  const calls = [];
  const listeners = new Map();
  const fakeWindow = {
    console: { error: (...args) => calls.push(["error", ...args]), warn() {}, log() {}, info() {}, debug() {} },
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    performance: { now: () => 0 },
    fetch: async (input) => (String(input).includes("fail") ? Promise.reject(new TypeError("offline")) : { status: 404 }),
  };
  const originalFetch = fakeWindow.fetch;
  const consoleEntries = [];
  const network = [];
  const restore = instrumentPage({ windowRef: fakeWindow, onConsole: (entry) => consoleEntries.push(entry), onNetwork: (entry) => network.push(entry) });
  fakeWindow.console.error("Payment failed", { code: 42 });
  assert.deepEqual(calls, [["error", "Payment failed", { code: 42 }]], "the page's own console still receives the call");
  assert.equal(consoleEntries[0].message, "Payment failed {code: 42}");
  assert.equal((await fakeWindow.fetch("https://api.test/items?id=1", { method: "post" })).status, 404);
  await assert.rejects(fakeWindow.fetch("https://api.test/fail"));
  assert.deepEqual(network.map(({ method, url, status, outcome }) => ({ method, url, status, outcome })), [
    { method: "POST", url: "https://api.test/items?id=…", status: 404, outcome: "client_error" },
    { method: "GET", url: "https://api.test/fail", status: 0, outcome: "transport_failure" },
  ]);
  listeners.get("error")({ error: new Error("boom"), filename: "https://app.test/main.js?v=3", lineno: 7, colno: 2 });
  assert.equal(consoleEntries.at(-1).source, "https://app.test/main.js?v=…:7:2");
  restore();
  assert.equal(fakeWindow.fetch, originalFetch);
  assert.equal(listeners.size, 0);
});

test("a recorder session captures a compressed, replayable buffer", async () => {
  let emit;
  const custom = [];
  const record = (options) => {
    emit = options.emit;
    assert.equal(options.maskAllInputs, true);
    assert.match(options.blockSelector, /\[data-threadmark-root\]/);
    assert.match(options.blockSelector, /\.secret-panel/);
    return () => {};
  };
  record.addCustomEvent = (tag, payload) => custom.push([tag, payload]);
  const listeners = new Map();
  const fakeWindow = {
    console: { error() {}, warn() {}, log() {}, info() {}, debug() {} },
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: () => {},
    document: { readyState: "complete", addEventListener() {}, removeEventListener() {} },
  };
  const session = await startSessionReplay({ windowRef: fakeWindow, blockSelectors: [".secret-panel"], loadRecorder: async () => record });
  assert.equal(await session.capture(), null, "nothing to replay before the first snapshot");
  const now = Date.now();
  emit(meta(now - 1_000), true);
  emit(full(now - 999), true);
  emit(click(now - 500));
  fakeWindow.console.error("Broken");
  assert.deepEqual(custom, [[REPLAY_CONSOLE_EVENT, { level: "error", message: "Broken", stack: undefined }]]);
  const capture = await session.capture();
  assert.equal(capture.blob.type, "application/gzip");
  assert.equal(capture.summary.actions.clicks, 1);
  const events = await decodeReplayEvents(capture.blob);
  assert.deepEqual(events.map((event) => event.type), [EVENT_TYPE.Meta, EVENT_TYPE.FullSnapshot, EVENT_TYPE.IncrementalSnapshot]);
  session.stop();
});

test("feedback keeps a bounded replay summary tied to its stored replay", async () => {
  const { createFeedbackPayload } = await import("../src/core.js");
  const target = { tagName: "button", role: "button", accessibleName: "Pay", visibleText: "Pay", bounds: { x: 0, y: 0, width: 10, height: 10 }, locatorCandidates: { stableId: "pay", id: null, domPath: "button" }, route: "/checkout", capturedAt: "2026-10-16T00:00:00Z" };
  const base = {
    projectKey: "demo",
    environment: "local",
    route: "/checkout",
    target,
    targets: [target],
    comment: "Pay does nothing.",
    evidence: [{ id: "rp-1", kind: "replay", mimeType: "application/gzip", byteSize: 2048, durationMs: 24_000, eventCount: 310 }],
  };
  const payload = createFeedbackPayload({
    ...base,
    replay: {
      evidenceId: "rp-1",
      startedAt: "2026-10-16T00:00:00Z",
      durationMs: 24_000,
      eventCount: 310,
      viewport: { width: 1280, height: 800 },
      console: { errors: 1, warnings: 0, entries: [{ offsetMs: 9_000, level: "error", message: "TypeError: amount is undefined" }, { offsetMs: 1, level: "log", message: "noise" }] },
      network: { requests: 4, failed: 1, entries: [{ offsetMs: 9_100, method: "post", url: "https://api.test/pay?card=4242&token=secret", status: 500, durationMs: 320, outcome: "server_error" }] },
      actions: { clicks: 3, inputs: 1, navigations: 0 },
    },
  });
  assert.deepEqual(payload.evidence[0], { id: "rp-1", kind: "replay", source: "rrweb", quality: "captured", mimeType: "application/gzip", byteSize: 2048, durationMs: 24_000, eventCount: 310 });
  assert.deepEqual(payload.replay.console.entries, [{ offsetMs: 9_000, level: "error", message: "TypeError: amount is undefined" }]);
  assert.deepEqual(payload.replay.network.entries, [{ offsetMs: 9_100, method: "POST", url: "https://api.test/pay?card=…&token=…", status: 500, durationMs: 320, outcome: "server_error" }]);
  assert.doesNotMatch(JSON.stringify(payload), /4242|secret/);
  assert.equal(createFeedbackPayload({ ...base, replay: { evidenceId: "missing" } }).replay, undefined, "a summary without its stored replay is dropped");
});

function recorderWindow(readyState = "complete") {
  const listeners = new Map();
  const windowRef = {
    location: { href: "https://app.test/review?token=private#fragment" },
    console: { error() {}, warn() {}, log() {}, info() {}, debug() {} },
    fetch: async () => ({ status: 200 }),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    document: {
      readyState,
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type) => listeners.delete(type),
    },
  };
  return { windowRef, listeners };
}

test("raw snapshots and mutations scrub URL credentials without mutating recorder events", async () => {
  let emit;
  const record = (options) => { emit = options.emit; return () => {}; };
  const { windowRef } = recorderWindow();
  const session = await startSessionReplay({ windowRef, loadRecorder: async () => record });
  const now = Date.now();
  const initial = { ...meta(now), data: { href: "https://user:PASS@node.test/path?token=URL_SECRET#FRAGMENT_SECRET" } };
  const snapshot = { ...full(now), data: { node: { attributes: { href: "/path?q=ATTR_SECRET#FRAGMENT_SECRET", srcset: "/a?token=SRCSET_SECRET 1x, /b 2x", style: 'background:url(https://cdn.test/img?key=STYLE_SECRET);mask:url(/private?token=RELATIVE_STYLE_SECRET)' }, childNodes: [] } } };
  emit(initial, true);
  emit(snapshot);
  emit({ type: 3, timestamp: now, data: { source: 0, attributes: [{ id: 1, attributes: { src: "https://cdn.test/img?token=MUTATION_SECRET#FRAGMENT_SECRET" } }], adds: [{ node: { attributes: { action: "/submit?token=ADD_SECRET" } } }] } });
  const events = await decodeReplayEvents((await session.capture()).blob);
  assert.doesNotMatch(JSON.stringify(events), /PASS|URL_SECRET|FRAGMENT_SECRET|ATTR_SECRET|SRCSET_SECRET|STYLE_SECRET|RELATIVE_STYLE_SECRET|MUTATION_SECRET|ADD_SECRET/);
  assert.match(initial.data.href, /URL_SECRET/, "rrweb's original objects remain intact");
  assert.match(snapshot.data.node.attributes.href, /ATTR_SECRET/);
  assert.match(events[0].data.href, /node.test\/path\?token=…$/);
  session.stop();
});

test("console credentials, nested objects, errors and rejection stacks are scrubbed before capture", async () => {
  const { windowRef, listeners } = recorderWindow();
  const entries = [];
  const restore = instrumentPage({ windowRef, onConsole: (entry) => entries.push(entry), onNetwork() {} });
  windowRef.console.log("Authorization: Bearer BEARER_SECRET", { access_token: "OBJECT_SECRET", nested: { password: "PASSWORD_SECRET" } });
  windowRef.console.warn('apiKey="API_SECRET" token=TOKEN_SECRET');
  windowRef.console.log("token=", "SPLIT_SECRET");
  const error = new Error("Failed https://user:PASS@api.test/x?key=ERROR_SECRET#FRAGMENT_SECRET");
  error.stack = "Error: token=STACK_SECRET\n at https://app.test/x?token=STACK_URL_SECRET#FRAGMENT_SECRET";
  windowRef.console.error(error);
  listeners.get("error")({ error, filename: "https://app.test/x?token=SOURCE_SECRET", lineno: 1, colno: 2 });
  listeners.get("unhandledrejection")({ reason: error });
  assert.doesNotMatch(JSON.stringify(entries), /BEARER_SECRET|OBJECT_SECRET|PASSWORD_SECRET|API_SECRET|TOKEN_SECRET|SPLIT_SECRET|PASS@|ERROR_SECRET|FRAGMENT_SECRET|STACK_SECRET|STACK_URL_SECRET|SOURCE_SECRET/);
  assert.match(JSON.stringify(entries), /redacted/);
  restore();
});

test("event overflow takes one non-reentrant checkout and leaves a replayable bounded buffer", async () => {
  let emit;
  let depth = 0;
  let maxDepth = 0;
  let checkouts = 0;
  const now = Date.now();
  const record = (options) => { emit = options.emit; emit(meta(now), true); emit(full(now)); return () => {}; };
  record.takeFullSnapshot = () => {
    checkouts++;
    maxDepth = Math.max(maxDepth, ++depth);
    assert.ok(depth < 2, "checkout must not recursively request itself");
    emit(meta(now), true);
    emit(full(now));
    depth--;
  };
  const { windowRef } = recorderWindow();
  const session = await startSessionReplay({ windowRef, loadRecorder: async () => record });
  for (let i = 0; i < 40_000; i++) emit(click(now));
  const events = await decodeReplayEvents((await session.capture()).blob);
  assert.equal(checkouts, 1);
  assert.equal(maxDepth, 1);
  assert.equal(events[0].type, EVENT_TYPE.Meta);
  assert.equal(events[1].type, EVENT_TYPE.FullSnapshot);
  assert.ok(events.length < 10);
  session.stop();
});

test("immediate and deferred startup failures restore globals and remove every listener", async () => {
  for (const readyState of ["complete", "loading"]) {
    const { windowRef, listeners } = recorderWindow(readyState);
    const originalFetch = windowRef.fetch;
    const originalConsole = windowRef.console.log;
    const errors = [];
    const start = () => startSessionReplay({ windowRef, onError: (error) => errors.push(error), loadRecorder: async () => () => { throw new Error("recorder failed"); } });
    if (readyState === "complete") await assert.rejects(start(), /recorder failed/);
    else {
      const session = await start();
      listeners.get("DOMContentLoaded")();
      assert.equal(errors[0].message, "recorder failed");
      session.stop();
    }
    assert.equal(windowRef.fetch, originalFetch);
    assert.equal(windowRef.console.log, originalConsole);
    assert.equal(listeners.size, 0);
  }
});
