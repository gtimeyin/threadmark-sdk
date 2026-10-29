import { test, expect } from '@playwright/test';
import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const sdk = fileURLToPath(new URL('../../', import.meta.url));
let bundle;
test.beforeAll(async () => {
  const previous = execFileSync('git', ['show', 'v0.1.0-beta.12:packages/react/src/snapshot.js'], { cwd: sdk, encoding: 'utf8' });
  const result = await build({ root: sdk, configFile: false, logLevel: 'silent', plugins: [{
    name: 'snapshot-baseline', resolveId(id) { if (id === 'beta12-snapshot') return '\0beta12-snapshot'; },
    load(id) { if (id === '\0beta12-snapshot') return previous; },
  }], build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/snapshot-performance.js', import.meta.url)), formats: ['iife'], name: 'SnapshotPerformance' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
for (const dpr of [1, 1.25, 2]) test(`crop rasterization preserves pixels and masking at DPR ${dpr}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  try {
    await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: `<html><body style="margin:0;background:white"><div style="position:absolute;left:100px;top:80px;width:240px;height:120px;background:#78aaee"><span style="position:absolute;left:10px;top:10px;background:#00ff00;width:50px;height:30px"></span><input value="PRIVATE" style="position:absolute;left:80px;top:20px;width:90px;height:25px"><div data-threadmark-ignore style="position:absolute;left:10px;top:60px;width:80px;height:30px;background:red">PRIVATE</div></div><main style="position:absolute;top:1000px">${'<div><span>Account</span></div>'.repeat(800)}</main></body></html>` }));
    await page.goto('http://localhost/'); await page.addScriptTag({ content: bundle });
    const region = { left: 100.25, top: 80.25, width: 240.5, height: 120.5 };
    const previous = await page.evaluate(region => window.captureBenchmark(true, region), region);
    const current = await page.evaluate(region => window.captureBenchmark(false, region), region);
    expect([current.width, current.height]).toEqual([previous.width, previous.height]);
    expect(current.metadata.redactionCount).toBe(previous.metadata.redactionCount);
    expect(current.metadata.warnings).toEqual(previous.metadata.warnings);
    expect(current.metadata.redactionCount).toBe(2);
    const meanError = current.pixels.reduce((sum, value, i) => sum + Math.abs(value - previous.pixels[i]), 0) / current.pixels.length;
    expect(meanError).toBeLessThan(3);
    expect(current.maxCanvasPixels).toBeLessThan(previous.maxCanvasPixels / 4);
    expect(current.canvasPixels).toBeLessThan(previous.canvasPixels / 4);
    // Both private regions remain burned-in masks, not just removed content.
    for (const [x, y] of [[100, 30], [30, 75]]) {
      const scale = current.width / region.width;
      const offset = (Math.floor(y * scale) * current.width + Math.floor(x * scale)) * 4;
      [32, 39, 34].forEach((channel, i) => expect(Math.abs(current.pixels[offset + i] - channel)).toBeLessThanOrEqual(5));
    }
    console.log('SNAPSHOT BENCHMARK', JSON.stringify({ dpr, beta12Ms: previous.duration, cropMs: current.duration,
      beta12MaxCanvasPixels: previous.maxCanvasPixels, cropMaxCanvasPixels: current.maxCanvasPixels,
      beta12CanvasPixels: previous.canvasPixels, cropCanvasPixels: current.canvasPixels, meanPixelError: meanError }));
  } finally { await context.close(); }
});
