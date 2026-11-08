import assert from "node:assert/strict";
import test from "node:test";

import { MAX_METADATA_BYTES, createFeedbackPayload, normalizeDevice, normalizeMetadata } from "../src/core.js";
import { loadClientHints, readDeviceInfo } from "../src/deviceInfo.js";
import { isSecretName, scrubCredentials } from "../src/sessionReplay.js";

const target = {
  tagName: "button",
  role: "button",
  accessibleName: "Pay",
  visibleText: "Pay",
  bounds: { x: 0, y: 0, width: 100, height: 40 },
  locatorCandidates: { stableId: null, id: null, domPath: "main > button" },
  route: "/checkout",
  capturedAt: "2026-10-22T10:00:00.000Z",
};

function fakeWindow({ userAgent, userAgentData, touchPoints = 0, connection, dark = false, width = 1404, height = 1245 } = {}) {
  return {
    navigator: { userAgent, userAgentData, maxTouchPoints: touchPoints, language: "en-GB", connection },
    screen: { width: 1512, height: 982 },
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 2,
    matchMedia: (query) => ({ matches: dark && query === "(prefers-color-scheme: dark)" }),
  };
}

const CHROME_MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

test("client hints give Chromium's real browser and macOS versions, which the user agent freezes", async () => {
  const userAgentData = {
    platform: "macOS",
    mobile: false,
    brands: [{ brand: "Not_A Brand", version: "99" }, { brand: "Chromium", version: "142" }, { brand: "Google Chrome", version: "142" }],
    getHighEntropyValues: async () => ({
      architecture: "arm",
      bitness: "64",
      platformVersion: "26.0.0",
      model: "",
      fullVersionList: [{ brand: "Not_A Brand", version: "99.0.0.0" }, { brand: "Chromium", version: "142.0.7444.176" }, { brand: "Google Chrome", version: "142.0.7444.176" }],
    }),
  };
  const windowRef = fakeWindow({ userAgent: CHROME_MAC_UA, userAgentData, connection: { effectiveType: "4g", downlink: 10, rtt: 50, saveData: false }, dark: true });
  const hints = await loadClientHints(windowRef);
  assert.equal(await loadClientHints(windowRef), hints, "asked once per window");

  const device = readDeviceInfo(windowRef, hints);
  assert.deepEqual(device.browser, { name: "Chrome", version: "142.0.7444.176" });
  assert.deepEqual(device.os, { name: "macOS", version: "26.0.0", architecture: "arm" });
  assert.equal(device.type, "desktop");
  assert.deepEqual(device.viewport, { width: 1404, height: 1245 });
  assert.deepEqual(device.screen, { width: 1512, height: 982 });
  assert.equal(device.devicePixelRatio, 2);
  assert.equal(device.colorScheme, "dark");
  assert.deepEqual(device.network, { effectiveType: "4g", downlinkMbps: 10, rttMs: 50, saveData: false });

  const before = readDeviceInfo(windowRef, null);
  assert.deepEqual(before.browser, { name: "Chrome", version: "142" }, "until the hints arrive, the major version from the brands");
  assert.deepEqual(before.os, { name: "macOS", version: "" }, "and no made-up macOS version");
});

test("client hints tell Windows 11 from Windows 10 and name Edge", async () => {
  const userAgentData = {
    platform: "Windows",
    mobile: false,
    brands: [{ brand: "Microsoft Edge", version: "141" }, { brand: "Chromium", version: "141" }],
    getHighEntropyValues: async () => ({ architecture: "x86", bitness: "64", platformVersion: "15.0.0", fullVersionList: [{ brand: "Microsoft Edge", version: "141.0.3537.85" }, { brand: "Chromium", version: "141.0.7390.108" }] }),
  };
  const windowRef = fakeWindow({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0", userAgentData });
  const device = readDeviceInfo(windowRef, await loadClientHints(windowRef));
  assert.deepEqual(device.browser, { name: "Edge", version: "141.0.3537.85" });
  assert.deepEqual(device.os, { name: "Windows", version: "11", architecture: "x86-64" });
  const old = readDeviceInfo(fakeWindow({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0" }));
  assert.deepEqual(old.browser, { name: "Firefox", version: "133.0" });
  assert.deepEqual(old.os, { name: "Windows", version: "10 or 11" }, "without client hints the two can't be told apart");
});

test("Safari, iPhone, iPad, and Android come from the user agent", () => {
  const safari = readDeviceInfo(fakeWindow({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15" }));
  assert.deepEqual(safari.browser, { name: "Safari", version: "18.1" });
  assert.equal(safari.os.name, "macOS");
  assert.equal(safari.network, undefined, "Safari has no network estimate");

  const iphone = readDeviceInfo(fakeWindow({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", touchPoints: 5 }));
  assert.deepEqual(iphone.os, { name: "iOS", version: "18.1" });
  assert.equal(iphone.type, "mobile");
  assert.equal(iphone.touch, true);

  const ipad = readDeviceInfo(fakeWindow({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15", touchPoints: 5 }));
  assert.equal(ipad.os.name, "iPadOS", "an iPad asking for the desktop site gives itself away by touch");
  assert.equal(ipad.type, "tablet");

  const pixel = readDeviceInfo(fakeWindow({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36", touchPoints: 5 }), { model: "Pixel 9" });
  assert.deepEqual(pixel.os, { name: "Android", version: "15" });
  assert.equal(pixel.type, "mobile");
  assert.equal(pixel.model, "Pixel 9");
});

test("device details are bounded labels and numbers, whatever a client sends", () => {
  const device = normalizeDevice({
    browser: { name: "x".repeat(500), version: 142 },
    os: { name: "macOS", version: "26.0.0", architecture: "arm" },
    type: "spaceship",
    screen: { width: 1e12, height: -4 },
    viewport: { width: "1404", height: 1245.6 },
    devicePixelRatio: 2.123456,
    language: "en-GB",
    timeZone: "Europe/London",
    colorScheme: "<script>",
    network: { effectiveType: "5g", downlinkMbps: 10, rttMs: 50, saveData: "yes" },
    extra: "dropped",
  });
  assert.equal(device.browser.name.length, 60);
  assert.equal(device.browser.version, "", "versions must be strings");
  assert.equal(device.type, "desktop");
  assert.deepEqual(device.screen, { width: 100_000, height: 0 });
  assert.deepEqual(device.viewport, { width: 1404, height: 1246 });
  assert.equal(device.devicePixelRatio, 2.12);
  assert.equal(device.colorScheme, "light");
  assert.deepEqual(device.network, { effectiveType: null, downlinkMbps: 10, rttMs: 50, saveData: true });
  assert.equal("extra" in device, false);
  assert.equal(normalizeDevice("Chrome"), null);
});

test("app context keeps plain values and hides credentials", () => {
  const metadata = normalizeMetadata({
    appVersion: "2.4.1",
    commit: "3f9a1c0d2b7e4f6a8c9d0e1f2a3b4c5d6e7f8a9b",
    userEmail: "ada@example.com",
    flags: { newCheckout: true, darkMode: false },
    cart: [{ sku: "A1", qty: 2 }],
    maxTokens: 4096,
    tokenCount: 812,
    apiKey: "sk_live_abcdefghijklmnop",
    accessToken: "anything",
    csrf_token: "abc",
    password: "hunter2",
    session: { authorization: "Bearer xyz", userId: 7 },
    note: "Signed in with Bearer abcdefghijklmnopqrstuvwx and sk_test_123456789012345678",
    nested: { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } },
    nothing: undefined,
    when: Number.NaN,
  });
  assert.equal(metadata.appVersion, "2.4.1");
  assert.equal(metadata.commit, "3f9a1c0d2b7e4f6a8c9d0e1f2a3b4c5d6e7f8a9b", "commit hashes are useful context, not secrets");
  assert.equal(metadata.userEmail, "ada@example.com", "the host chose to send it");
  assert.deepEqual(metadata.flags, { newCheckout: true, darkMode: false });
  assert.deepEqual(metadata.cart, [{ sku: "A1", qty: 2 }]);
  assert.equal(metadata.maxTokens, 4096, "keys that only mention tokens stay");
  assert.equal(metadata.tokenCount, 812);
  for (const key of ["apiKey", "accessToken", "csrf_token", "password"]) assert.equal(metadata[key], "[redacted]", key);
  assert.deepEqual(metadata.session, { authorization: "[redacted]", userId: 7 });
  assert.equal(metadata.note, "Signed in with Bearer [redacted] and [redacted]");
  assert.equal(metadata.nested.a.b.c.d.e, "[…]", "deep nesting is cut off");
  assert.equal("nothing" in metadata, false, "undefined values are dropped, as JSON drops them");
  assert.equal(metadata.when, null);
});

test("app context that isn't a plain JSON object, or is too large, is left out", () => {
  assert.equal(normalizeMetadata(null), null);
  assert.equal(normalizeMetadata(["a"]), null);
  assert.equal(normalizeMetadata("flags"), null);
  assert.equal(normalizeMetadata(new Map([["a", 1]])), null);
  assert.equal(normalizeMetadata({}), null, "nothing to show");
  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.equal(normalizeMetadata(cyclic), null);
  assert.equal(normalizeMetadata({ big: 1n }), null);
  const tooMuch = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`part${index}`, "x".repeat(1500)]));
  assert.ok(JSON.stringify(tooMuch).length > MAX_METADATA_BYTES);
  assert.equal(normalizeMetadata(tooMuch), null, "over 10 KB in all is left out, not cut");
  assert.equal(normalizeMetadata({ state: "x".repeat(5000) }).state.length, 2000, "one long string is shortened");
});

test("credential names are recognized by their words", () => {
  for (const key of ["password", "Password", "apiKey", "api_key", "x-api-key", "accessToken", "refresh_token", "csrfToken", "authorization", "Cookie", "secret", "clientSecret", "privateKey", "sessionId", "auth", "jwt"]) {
    assert.equal(isSecretName(key), true, key);
  }
  for (const key of ["maxTokens", "tokenCount", "tokens", "keyboardLayout", "author", "authProvider", "primaryKey", "monkey", "sessionLength", "passengers"]) {
    assert.equal(isSecretName(key), false, key);
  }
  assert.equal(scrubCredentials("token=abc123def password: hunter22 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl"), "token=[redacted] password: [redacted] [redacted JWT]");
  assert.equal(scrubCredentials("user ada@example.com on /checkout?id=4"), "user ada@example.com on /checkout?id=4", "only credentials go");
});

test("comments carry device details and app context through every later edit", () => {
  const payload = createFeedbackPayload({
    projectKey: "demo",
    environment: "local",
    route: "/checkout",
    target,
    targets: [target],
    captureKind: "element",
    evidence: [],
    comment: "Total is wrong",
    device: { browser: { name: "Chrome", version: "142" }, os: { name: "macOS", version: "26.0.0" }, type: "desktop", viewport: { width: 1404, height: 1245 } },
    metadata: { appVersion: "2.4.1", password: "x" },
  });
  assert.equal(payload.device.browser.name, "Chrome");
  assert.deepEqual(payload.metadata, { appVersion: "2.4.1", password: "[redacted]" });
  const edited = createFeedbackPayload({ ...payload, now: payload.createdAt, comment: "Total is wrong after a coupon" });
  assert.deepEqual(edited.device, payload.device, "normalizing again changes nothing");
  assert.deepEqual(edited.metadata, payload.metadata);
  const plain = createFeedbackPayload({ projectKey: "demo", environment: "local", route: "/", target, comment: "No extras" });
  assert.equal("device" in plain, false);
  assert.equal("metadata" in plain, false);
});

test("the Markdown export names the browser and the app context", async () => {
  const { formatAnnotationsMarkdown } = await import("../src/annotation.js");
  const payload = createFeedbackPayload({
    projectKey: "demo",
    environment: "local",
    route: "/checkout",
    target,
    comment: "Total is wrong",
    device: { browser: { name: "Firefox", version: "133.0" }, os: { name: "Windows", version: "10 or 11" }, type: "desktop", viewport: { width: 1280, height: 720 } },
    metadata: { appVersion: "2.4.1", note: "use `x`" },
  });
  const markdown = formatAnnotationsMarkdown([{ payload }]);
  assert.match(markdown, /- Browser: Firefox 133\.0 on Windows 10 or 11 · desktop · viewport 1280×720/);
  assert.match(markdown, /- App context: `\{"appVersion":"2\.4\.1","note":"use 'x'"\}`/);
});
