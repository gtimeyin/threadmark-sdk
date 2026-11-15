import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let bundle;

test.beforeAll(async () => {
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("../fixtures/canvas-replay.js", import.meta.url)), formats: ["iife"], name: "ThreadmarkCanvasReplayFixture" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  bundle = output.find((item) => item.type === "chunk")?.code;
});

const PAGE = `<!doctype html><html><body style="margin:0;background:#fff">
<canvas id="chart" width="120" height="80"></canvas>
<div data-quality-mask><canvas id="private-chart" width="120" height="80"></canvas></div>
<script src="/fixture.js"></script></body></html>`;

async function open(page) {
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: bundle });
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
  });
  await page.goto("http://localhost/canvas", { waitUntil: "load" });
}

const draw = (page, color) => page.evaluate((fill) => {
  for (const id of ["chart", "private-chart"]) {
    const context = document.getElementById(id).getContext("2d");
    context.fillStyle = fill;
    context.fillRect(0, 0, 120, 80);
  }
}, color);

test("with canvas capture on, playback shows what a canvas drew, except in masked regions", async ({ page }) => {
  await open(page);
  await draw(page, "#ff0000");
  await page.evaluate(() => window.startCanvasReplay(true));
  await page.waitForTimeout(800);
  await draw(page, "#00c000"); // Drawn after the snapshot, so only a sampled frame carries it.
  await page.waitForTimeout(1_500);
  const events = await page.evaluate(() => window.captureCanvasReplay());
  expect(events.some((event) => event.type === 3 && event.data.source === 9)).toBe(true);

  const result = await page.evaluate((recorded) => window.playCanvasReplay(recorded), events);
  expect(result.scripts).not.toContain("allow-scripts");
  const [red, green, blue, alpha] = result.chart;
  expect(alpha).toBeGreaterThan(200);
  expect(green).toBeGreaterThan(150);
  expect(red).toBeLessThan(60);
  expect(blue).toBeLessThan(60);
  // A canvas inside a masked region is blocked: rrweb leaves a placeholder, never its pixels.
  expect(result.privateTag).not.toBe("CANVAS");
});

test("without canvas capture, no canvas frames or pixels are recorded", async ({ page }) => {
  await open(page);
  await draw(page, "#ff0000");
  await page.evaluate(() => window.startCanvasReplay(false));
  await page.waitForTimeout(800);
  await draw(page, "#00c000");
  await page.waitForTimeout(1_000);
  const events = await page.evaluate(() => window.captureCanvasReplay());
  expect(events.some((event) => event.type === 3 && event.data.source === 9)).toBe(false);
  expect(JSON.stringify(events)).not.toContain("rr_dataURL");
});
