import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const sdk = fileURLToPath(new URL('../../', import.meta.url));
let current, previous;
async function bundle(baseline) {
  const overridden = new Set(['Threadmark.jsx', 'ThreadmarkOverlay.jsx', 'restorationScheduler.js']);
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react(), {
    name: 'idle-scroll-instrumentation',
    load(id) {
      if (baseline && overridden.has(id.split('/').at(-1)) && id.startsWith(resolve(sdk, 'src') + '/')) {
        return execFileSync('git', ['show', `v0.1.0-beta.12:packages/react/src/${id.split('/').at(-1)}`], { cwd: sdk, encoding: 'utf8' });
      }
    },
    transform(code, id) {
      if (id === resolve(sdk, 'src/Threadmark.jsx')) return code
        .replace('  const [mode, setMode]', '  if(window.__performanceCounters) window.__performanceCounters.rootRenders++;\n  const [mode, setMode]')
        .replace(/function assessAnnotation\((.*?)\) \{/, '$&\nif(window.__performanceCounters) window.__performanceCounters.assess++;');
      if (id === resolve(sdk, 'src/ThreadmarkOverlay.jsx')) return code
        .replace('  const targets = editingAnnotation', '  if(window.__performanceCounters) window.__performanceCounters.overlayRenders++;\n  const targets = editingAnnotation')
        .replace(/function Marker\([^)]*\) \{/, '$&\nif(window.__performanceCounters) window.__performanceCounters.markerRenders++;');
      if (id === resolve(sdk, 'src/restorationScheduler.js')) return code
        .replace('onSlice = () => {}', 'onSlice = slice => { if(window.__performanceCounters) window.__performanceCounters.positionSlices.push(slice); }')
        .replace('new view.MutationObserver(changes => {', 'new view.MutationObserver(changes => { if(window.__performanceCounters) window.__performanceCounters.mutationCallbacks++;');
    },
  }], define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false,
    lib: { entry: resolve(sdk, 'tests/fixtures/idle-scroll-performance.jsx'), formats: ['iife'], name: 'IdleScrollPerformance' },
    rollupOptions: { output: { inlineDynamicImports: true } } } });
  return (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
}
test.beforeAll(async () => { current = await bundle(false); previous = await bundle(true); });
async function load(page, source, count) {
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
  await page.goto('http://localhost/'); await page.addScriptTag({ content: source });
  await page.evaluate(count => window.setupIdleScroll(count), count);
  await expect(page.getByRole('button', { name: `Review page, ${count} comments` })).toBeVisible();
}
async function open(page, count) {
  await page.getByRole('button', { name: /Review page/ }).click();
  await expect(page.locator('.tm-marker')).toHaveCount(count);
  await page.waitForTimeout(100);
}
for (const count of [60, 200, 1000]) {
  test(`${count} comments: closed review does no restoration work; scroll avoids React renders`, async ({ page }) => {
    await load(page, previous, count);
    await page.waitForTimeout(300);
    const beta12Idle = await page.evaluate(() => window.__performanceCounters.assess);
    await open(page, count);
    const beta12Scroll = await page.evaluate(() => window.runScrollFrames());

    await load(page, current, count);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__performanceCounters.assess)).toBe(0);
    await page.evaluate(() => { window.resetPerformanceCounters(); window.burstMutations(); });
    await page.evaluate(() => window.runScrollFrames(5)); await page.waitForTimeout(250);
    const idle = await page.evaluate(() => window.__performanceCounters);
    expect(idle.assess).toBe(0); expect(idle.mutationCallbacks).toBe(0);
    expect(idle.geometryReads).toBe(0); expect(idle.rootRenders).toBe(0);
    expect(idle.positionSlices).toEqual([]);
    await open(page, count);
    expect(await page.evaluate(() => window.__performanceCounters.assess)).toBe(count);
    const fixedBefore = await page.locator('.tm-marker').first().getAttribute('style');
    const scroll = await page.evaluate(() => window.runScrollFrames());
    expect(scroll.assess).toBe(0); expect(scroll.rootRenders).toBe(0);
    expect(scroll.overlayRenders).toBe(0); expect(scroll.markerRenders).toBe(0);
    const slices = scroll.positionSlices.filter(slice => slice.phase === 'position');
    expect(slices.length).toBeGreaterThan(0); expect(slices.length).toBeLessThanOrEqual(60);
    expect(Math.max(...slices.map(slice => slice.duration))).toBeLessThan(50);
    expect(await page.locator('.tm-marker').first().getAttribute('style')).toBe(fixedBefore);
    // Pins still follow their live elements, including off-screen targets.
    const alignment = await page.evaluate(() => {
      const marker = document.querySelector('[data-threadmark-root]').shadowRoot.querySelectorAll('.tm-marker')[1];
      const target = document.getElementById('target-1').getBoundingClientRect();
      return { left: parseFloat(marker.style.left), top: parseFloat(marker.style.top), expectedLeft: target.right, expectedTop: target.top + 15 };
    });
    expect(alignment.left).toBeCloseTo(alignment.expectedLeft); expect(alignment.top).toBeCloseTo(alignment.expectedTop);
    const still = await page.evaluate(() => window.runScrollFrames(5, false));
    expect(still.rootRenders + still.overlayRenders + still.markerRenders).toBe(0);
    expect(still.pinWrites).toBe(0);
    console.log('IDLE/SCROLL BENCHMARK', JSON.stringify({ comments: count, beta12IdleMatches: beta12Idle,
      idleMatches: idle.assess, beta12RootRenders: beta12Scroll.rootRenders,
      rootRenders: scroll.rootRenders, beta12MarkerRenders: beta12Scroll.markerRenders,
      markerRenders: scroll.markerRenders, maxPositionMs: Math.max(...slices.map(slice => slice.duration)), frameP95: scroll.frameP95 }));
  });
}

test('closing cancels queued work; reopening refreshes changed and removed targets', async ({ page }) => {
  await load(page, current, 60); await open(page, 60);
  await page.evaluate(() => window.burstMutations());
  await page.getByRole('button', { name: 'Close annotations (Esc)', exact: true }).click();
  await expect(page.getByRole('button', { name: /Review page/ })).toBeVisible();
  await page.waitForTimeout(50);
  await page.evaluate(() => { window.resetPerformanceCounters(); document.getElementById('target-1').remove(); document.getElementById('target-2').textContent = 'Portfolio account 2 updated'; window.burstMutations(); });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__performanceCounters.assess)).toBe(0);
  expect(await page.evaluate(() => window.__performanceCounters.mutationCallbacks)).toBe(0);
  await page.getByRole('button', { name: /Review page/ }).click();
  await expect(page.locator('.tm-marker--warning')).toHaveCount(2);
  await expect(page.locator('.tm-marker--suggested')).toHaveCount(1);
  expect(await page.evaluate(() => window.__performanceCounters.assess)).toBe(60);
  // A thread remains anchored while scrolling, and only its overlay subscribes to geometry.
  await page.locator('.tm-marker').nth(3).click();
  await expect(page.getByRole('button', { name: 'Cancel comment', exact: true })).toBeVisible();
  const counts = await page.evaluate(() => window.runScrollFrames(5));
  expect(counts.assess).toBe(0); expect(counts.rootRenders).toBe(0);
});
