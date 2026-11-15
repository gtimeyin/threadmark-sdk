import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const BUSY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Busy page</title>
<style>body{margin:0;font:14px/1.4 system-ui,sans-serif}table{border-collapse:collapse;width:100%}td,th{padding:6px 10px;text-align:left}
.spinner{width:14px;height:14px;border:2px solid #ccc;border-top-color:#333;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>
</head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`;
let busyBundle;
let pickingBundle;
let pickingHtml;

async function bundle(entry, name) {
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [react()],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL(entry, import.meta.url)), formats: ["iife"], name },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  return output.find((item) => item.type === "chunk")?.code;
}

test.beforeAll(async () => {
  busyBundle = await bundle("../fixtures/busy-page.jsx", "ThreadmarkBusyPage");
  pickingBundle = await bundle("../fixtures/picking-events.jsx", "ThreadmarkSavingFixture");
  pickingHtml = (await readFile(new URL("../fixtures/picking-events.html", import.meta.url), "utf8"))
    .replace('<script type="module" src="./picking-events.jsx"></script>', '<script src="/fixture.js"></script>');
});

async function mount(page, { html, script, path }) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: script });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 200, contentType: "text/html", body: html });
  });
  await page.goto(`http://localhost${path}`, { waitUntil: "load" });
  return pageErrors;
}

const shadow = (page, selector) => page.locator("[data-threadmark-root]").locator(selector);

async function setComment(page, value) {
  await page.evaluate((text) => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, value);
}

test("recorded DOM paths find exactly what the selector engine finds", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = await mount(page, { html: BUSY_HTML, script: busyBundle, path: "/customers?rows=400" });
  await expect(page.locator("tr[data-row='399']")).toHaveCount(1);
  const result = await page.evaluate(() => {
    const { buildDomPath, queryDomPath } = window.__threadmarkDomPaths;
    const same = (path) => {
      const expected = [...document.querySelectorAll(path)];
      const actual = queryDomPath(document, path);
      return expected.length === actual.length && expected.every((element, index) => element === actual[index]);
    };
    const paths = [...document.querySelectorAll("#root *")].filter((_, index) => index % 7 === 0).map(buildDomPath);
    // A stable id partway up, paths that match many elements, paths that match nothing, and nested matches.
    document.querySelector("#customers").setAttribute("data-threadmark-id", "customers-table");
    paths.push(buildDomPath(document.querySelector("tr[data-row='250'] .name")));
    paths.push("td:nth-of-type(2)", "tr:nth-of-type(3) > td:nth-of-type(1)", "span:nth-of-type(1)", "tr:nth-of-type(9999) > td:nth-of-type(1)");
    const nested = document.createElement("div");
    nested.innerHTML = "<div><div><div><p>deep</p></div></div></div>";
    document.querySelector("main").append(nested);
    paths.push("div:nth-of-type(1) > div:nth-of-type(1)", "div:nth-of-type(1) > div:nth-of-type(1) > p:nth-of-type(1)");
    return { checked: paths.length, mismatches: paths.filter((path) => !same(path)), stable: paths.at(-7) };
  });
  expect(result.checked).toBeGreaterThan(400);
  expect(result.stable).toMatch(/^\[data-threadmark-id="customers-table"\] > tbody:nth-of-type\(1\)/);
  expect(result.mismatches).toEqual([]);
  expect(errors).toEqual([]);
});

test("saved comments on a page that keeps changing don't keep the main thread busy", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longTasks.push([entry.startTime, entry.duration]);
    }).observe({ type: "longtask", buffered: true });
  });
  const errors = await mount(page, { html: BUSY_HTML, script: busyBundle, path: "/customers?rows=1500" });
  await page.locator(".tm-launcher").click();
  for (const row of [0, 40, 80]) {
    await page.locator(`tr[data-row="${row}"] .name`).click();
    await expect(shadow(page, "#tm-comment")).toBeVisible();
    await setComment(page, `Row ${row} looks off`);
    await shadow(page, ".tm-submit").click();
    await expect(shadow(page, ".tm-popover")).toHaveCount(0);
  }
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.length)).toBe(3);
  // The clock re-renders four times a second; matching three comments against 1,500 rows used to block for
  // most of every second.
  const start = await page.evaluate(() => performance.now());
  await page.waitForTimeout(6_000);
  const blocked = await page.evaluate((from) => window.__longTasks
    .filter(([at]) => at >= from)
    .reduce((total, [, duration]) => total + duration, 0), start);
  expect(blocked).toBeLessThan(1_200);
  await expect(page.locator(".name").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a host that reports its upload shows how far the post has got", async ({ page }) => {
  const errors = await mount(page, { html: pickingHtml, script: pickingBundle, path: "/picking-events?uploads=1" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.locator(".tm-launcher").click();
  await page.locator("#secondary-target").click();
  await setComment(page, "The secondary action is hard to find.");
  await shadow(page, ".tm-submit").click();
  await expect(shadow(page, ".tm-submit")).toHaveText("Uploading 50%");
  await expect(shadow(page, '[role="progressbar"][aria-label="Uploading"]')).toHaveAttribute("aria-valuenow", "50");
  await page.evaluate(() => window.__threadmarkFinishUpload());
  await expect(shadow(page, ".tm-popover")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.length)).toBe(1);
  expect(errors).toEqual([]);
});
