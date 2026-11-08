import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let pickingHtml;
let pickingBundle;

test.beforeAll(async () => {
  pickingHtml = (await readFile(new URL("../fixtures/picking-events.html", import.meta.url), "utf8"))
    .replace('<script type="module" src="./picking-events.jsx"></script>', "");
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [react()],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("../fixtures/picking-events.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkCaptureDetailsFixture" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  pickingBundle = output.find((item) => item.type === "chunk")?.code;
});

async function mountFixture(page, query) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/threadmark-fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: pickingBundle });
    return route.fulfill({ status: 200, contentType: "text/html", body: pickingHtml.replace("</body>", '<script src="/threadmark-fixture.js"></script></body>') });
  });
  await page.goto(`http://localhost/picking-events${query}`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  return pageErrors;
}

async function postComment(page, comment) {
  await page.locator("#secondary-target").click();
  await page.evaluate((value) => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, comment);
  await page.locator(".tm-submit").click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  return page.evaluate(() => window.__threadmarkFeedback.at(-1));
}

test("a new comment records the browser and device, and the host's app context as it is when posted", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 760 });
  const pageErrors = await mountFixture(page, "?metadata=1");
  await page.locator(".tm-launcher").click();
  // The context is read when the comment is posted, not when Threadmark loaded.
  await page.evaluate(() => { window.__threadmarkCart = 3; });
  const feedback = await postComment(page, "The total is wrong");

  const expected = await page.evaluate(() => ({ language: navigator.language, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  expect(feedback.device.browser.name).toMatch(/\S/);
  expect(feedback.device.browser.version).toMatch(/^\d+(\.\d+)*$/);
  expect(["macOS", "Linux", "Windows"]).toContain(feedback.device.os.name);
  expect(feedback.device.viewport).toEqual({ width: 1180, height: 760 });
  expect(feedback.device).toMatchObject({ type: "desktop", touch: false, language: expected.language, timeZone: expected.timeZone, colorScheme: "light", reducedMotion: false });
  expect(feedback.metadata).toEqual({ appVersion: "2.4.1", flags: { newCheckout: true }, cartItems: 3, apiKey: "[redacted]" });
  expect(await page.evaluate(() => window.__threadmarkErrors)).toEqual([]);

  // A reply keeps the original capture's details untouched.
  await page.evaluate(() => { window.__threadmarkCart = 9; });
  await page.locator(".tm-marker").last().click();
  await page.evaluate(() => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, "Still wrong after a refresh");
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  });
  await page.locator(".tm-submit").click();
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.at(-1).replies?.length)).toBe(1);
  const replied = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(replied.metadata.cartItems).toBe(3);
  expect(replied.device).toEqual(feedback.device);
  expect(pageErrors).toEqual([]);
});

for (const [mode, message] of [
  ["throw", /threw/],
  ["slow", /longer than 2 seconds/],
  ["window", /plain object/],
]) {
  test(`app context that ${mode === "throw" ? "throws" : mode === "slow" ? "never answers" : "isn't a plain object"} never blocks the comment`, async ({ page }) => {
    const pageErrors = await mountFixture(page, `?metadata=${mode}`);
    await page.locator(".tm-launcher").click();
    const feedback = await postComment(page, "Posted anyway");
    expect(feedback.comment).toBe("Posted anyway");
    expect(feedback.metadata).toBeUndefined();
    const errors = await page.evaluate(() => window.__threadmarkErrors);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("metadata_failed");
    expect(errors[0].message).toMatch(message);
    expect(pageErrors).toEqual([]);
  });
}

test("deviceDetails={false} leaves the browser and device out", async ({ page }) => {
  await mountFixture(page, "?nodevice");
  await page.locator(".tm-launcher").click();
  const feedback = await postComment(page, "No details please");
  expect(feedback.device).toBeUndefined();
  expect(feedback.metadata).toBeUndefined();
});
