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
      lib: { entry: fileURLToPath(new URL("../fixtures/picking-events.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkReplayFixture" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  pickingBundle = output.find((item) => item.type === "chunk")?.code;
});

async function mountFixture(page) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/threadmark-fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: pickingBundle });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 500, contentType: "application/json", body: "{\"error\":\"boom\"}" });
    return route.fulfill({ status: 200, contentType: "text/html", body: pickingHtml.replace("</body>", '<script src="/threadmark-fixture.js"></script></body>') });
  });
  await page.goto("http://localhost/picking-events?replay=1&token=URL_REPLAY_SECRET#FRAGMENT_REPLAY_SECRET", { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  return pageErrors;
}

async function setComment(page, comment) {
  await page.evaluate((value) => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, comment);
}

test("a new comment carries a removable, privacy-safe playback with console, network, and actions", async ({ page }) => {
  const pageErrors = await mountFixture(page);
  // What happened on the page before the reviewer opened Threadmark.
  await page.waitForTimeout(400);
  await page.locator("#interaction-search").fill("private launch plan");
  await page.locator("#secondary-target").click();
  await page.evaluate(async () => {
    console.error("Checkout total is undefined", { cart: 3 });
    console.warn("Authorization: Bearer CONSOLE_REPLAY_SECRET", { password: "OBJECT_REPLAY_SECRET" });
    const link = document.createElement("a");
    link.href = "/account?token=ATTRIBUTE_REPLAY_SECRET#ATTRIBUTE_FRAGMENT_SECRET";
    link.textContent = "Account";
    document.body.append(link);
    await fetch("/api/checkout?card=4242", { method: "POST" });
  });
  await page.waitForTimeout(600);

  await page.locator(".tm-launcher").click();
  await page.locator("#secondary-target").click();
  const chip = page.locator(".tm-replay-attachment");
  await expect(chip).toContainText("Playback attached");
  await expect(chip).toContainText("1 error");
  await expect(chip).toContainText("1 failed request");

  await chip.getByRole("button", { name: "Preview" }).click();
  const dialog = page.locator(".tm-replay-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".tm-replay-dialog__stage iframe")).toHaveCount(1);
  await expect(dialog.getByRole("tab", { name: /Console/ })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.locator(".tm-replay-dialog__rows")).toContainText("Checkout total is undefined {cart: 3}");
  await dialog.getByRole("tab", { name: /Network/ }).click();
  await expect(dialog.locator(".tm-replay-dialog__rows")).toContainText("POST 500");
  await expect(dialog.locator(".tm-replay-dialog__rows")).toContainText("/api/checkout?card=…");
  await dialog.getByRole("tab", { name: /Actions/ }).click();
  await expect(dialog.locator(".tm-replay-dialog__rows")).toContainText("Clicked button “Secondary host action”");
  await expect(dialog.locator(".tm-replay-dialog__rows")).toContainText("(value hidden)");
  await dialog.locator(".tm-replay-dialog__rows li button").first().click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".tm-popover")).toBeVisible();

  await chip.getByRole("button", { name: "Remove" }).click();
  await expect(chip).toContainText("Playback removed");
  await chip.getByRole("button", { name: "Attach again" }).click();
  await expect(chip).toContainText("Playback attached");

  await setComment(page, "Checkout breaks after the secondary action.");
  await page.locator(".tm-submit").click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);

  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.replay.console.errors).toBeGreaterThanOrEqual(1);
  expect(saved.replay.network.failed).toBe(1);
  expect(saved.replay.network.entries[0]).toMatchObject({ method: "POST", status: 500, outcome: "server_error" });
  expect(saved.replay.network.entries[0].url).toMatch(/\/api\/checkout\?card=…$/);
  const replayEvidence = saved.evidence.find((item) => item.kind === "replay");
  expect(replayEvidence).toMatchObject({ mimeType: "application/gzip", source: "rrweb" });
  expect(saved.replay.evidenceId).toBe(replayEvidence.id);
  expect(JSON.stringify(saved)).not.toContain("4242");

  const stored = await page.evaluate(async (id) => {
    const item = window.__threadmarkFeedbackContexts.at(-1).evidence.find((entry) => entry.id === id);
    const text = await new Response(item.blob.stream().pipeThrough(new DecompressionStream("gzip"))).text();
    return { size: item.blob.size, type: item.blob.type, leaksTypedText: text.includes("private launch plan"), leaksCard: text.includes("4242"), leaksSecrets: /URL_REPLAY_SECRET|FRAGMENT_REPLAY_SECRET|CONSOLE_REPLAY_SECRET|OBJECT_REPLAY_SECRET|ATTRIBUTE_REPLAY_SECRET|ATTRIBUTE_FRAGMENT_SECRET/.test(text), events: JSON.parse(text).length };
  }, replayEvidence.id);
  expect(stored).toMatchObject({ size: replayEvidence.byteSize, type: "application/gzip", leaksTypedText: false, leaksCard: false, leaksSecrets: false });
  expect(stored.events).toBeGreaterThan(5);

  await page.locator(".tm-marker").first().click();
  await page.locator(".tm-replay-open").click();
  await expect(page.locator(".tm-replay-dialog .tm-replay-dialog__stage iframe")).toHaveCount(1);
  await expect(page.locator(".tm-replay-dialog__rows")).toContainText("Checkout total is undefined");
  expect(pageErrors).toEqual([]);
});
