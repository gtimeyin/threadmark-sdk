import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const src = fileURLToPath(new URL('../../src/', import.meta.url));
let bundle;
test.beforeAll(async () => {
  // Freeze the published beta.11 matching behavior; this baseline never reads the working tree target.js.
  const original = execFileSync('git', ['show', '4ce77ac:packages/react/src/target.js'], { cwd: src, encoding: 'utf8' });
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react(), {
    name: 'restoration-baseline',
    resolveId(id) { if (id === 'beta11-target') return '\0beta11-target'; },
    load(id) { if (id === '\0beta11-target') return original.replaceAll('"./resolveStableTarget.js"', JSON.stringify(resolve(src, 'resolveStableTarget.js'))).replaceAll('"./targetId.js"', JSON.stringify(resolve(src, 'targetId.js'))); },
    transform(code, id) {
      if (id === resolve(src, 'target.js')) return code.replace('  if (!target || !documentRef)', '  window.__restoreCount = (window.__restoreCount || 0) + 1;\n  if (!target || !documentRef)');
      if (id === resolve(src, 'Threadmark.jsx')) return code.replace(/function assessAnnotation\((.*?)\) \{/, '$&\nwindow.__assessCounts ||= {}; window.__assessCounts[annotation.id] = (window.__assessCounts[annotation.id] || 0) + 1;');
    },
  }], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: resolve(dirname(src), 'tests/fixtures/restoration-performance.jsx'), formats: ['iife'], name: 'RestorationPerformance' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
test.beforeEach(async ({ page }) => {
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
  await page.goto('http://localhost/'); await page.addScriptTag({ content: bundle });
  expect(await page.evaluate(() => restorationFixture.setup())).toEqual({ elements: 1600, comments: 60 });
});
async function settled(page) {
  await expect.poll(() => page.evaluate(() => Object.keys(restorationFixture.stats.results).length)).toBe(60);
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.slices.filter(slice => slice.phase === 'suggest').reduce((n, slice) => n + slice.count, 0))).toBe(35);
}

test('beta.11 parity, shared DOM reads and bounded restoration slices', async ({ page }) => {
  const expected = await page.evaluate(() => restorationFixture.expected());
  expect(expected.filter(item => item.status === 'resolved')).toHaveLength(20);
  expect(expected.filter(item => item.status === 'ambiguous')).toHaveLength(5);
  await page.evaluate(() => restorationFixture.start()); await settled(page);
  const stats = await page.evaluate(() => restorationFixture.stats);
  expect(Object.values(stats.results)).toEqual(expected);
  expect(Object.values(stats.calls)).toEqual(Array(60).fill(1));
  expect(stats.snapshots.some(states => states.includes('missing'))).toBe(true);
  const matches = stats.slices.filter(slice => slice.phase === 'match');
  const metrics = { beta11Ms: stats.baselineMs, matchingMs: matches.reduce((n, slice) => n + slice.duration, 0),
    suggestionMs: stats.slices.filter(slice => slice.phase === 'suggest').reduce((n, slice) => n + slice.duration, 0),
    maxSliceMs: Math.max(...stats.slices.map(slice => slice.duration)), longTasks: stats.longTasks };
  console.log('RESTORATION BENCHMARK', JSON.stringify(metrics));
  expect(metrics.longTasks).toEqual([]);
  // Keep the 150ms reference target while accounting for shared-runner CPU speed.
  expect(metrics.matchingMs + metrics.suggestionMs).toBeLessThanOrEqual(Math.max(150, metrics.beta11Ms * 0.5));
  expect(metrics.maxSliceMs).toBeLessThanOrEqual(50);
  expect(await page.evaluate(() => restorationFixture.cacheCheck())).toBe(1);
  for (const [actual, previous] of await page.evaluate(() => restorationFixture.parityCases())) expect(actual).toEqual(previous);
});

test('incremental invalidation, identity stability, positioning and cleanup', async ({ page }) => {
  await page.evaluate(() => restorationFixture.expected());
  await page.evaluate(() => restorationFixture.start()); await settled(page);
  await page.evaluate(() => restorationFixture.update()); await page.waitForTimeout(50);
  expect(await page.evaluate(() => Object.values(restorationFixture.stats.calls))).toEqual(Array(60).fill(1));
  await page.evaluate(() => { window.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => Object.values(restorationFixture.stats.calls))).toEqual(Array(60).fill(1));
  await page.evaluate(() => { restorationFixture.stats.slices = []; document.getElementById('unrelated').append(document.createElement('div')); });
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.calls['comment-25'])).toBe(2);
  expect(await page.evaluate(() => Object.entries(restorationFixture.stats.calls).filter(([id]) => +id.split('-')[1] < 20).map(([, count]) => count))).toEqual(Array(20).fill(1));
  const incrementalMs = await page.evaluate(() => restorationFixture.stats.slices.filter(s => s.phase === 'match').reduce((n, s) => n + s.duration, 0));
  const baselineMs = await page.evaluate(() => restorationFixture.stats.baselineMs);
  expect(incrementalMs).toBeLessThanOrEqual(Math.max(10, baselineMs / 30));
  await page.evaluate(() => document.getElementById('title-0').firstChild.textContent = 'Edited title');
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.calls['comment-0'])).toBe(2);
  expect(await page.evaluate(() => restorationFixture.stats.calls['comment-1'])).toBe(1);
  await page.evaluate(() => document.getElementById('title-1').remove());
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.calls['comment-1'])).toBe(2);
  await page.evaluate(() => restorationFixture.change('comment-2'));
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.calls['comment-2'])).toBe(2);
  expect(await page.evaluate(() => restorationFixture.stats.calls['comment-3'])).toBe(1);
  await page.evaluate(() => restorationFixture.add());
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.calls.added)).toBe(1);
  await page.evaluate(() => { restorationFixture.remove('added'); restorationFixture.dispose(); });
  const before = await page.evaluate(() => JSON.stringify(restorationFixture.stats.calls));
  await page.evaluate(() => document.getElementById('unrelated').append(document.createElement('div')));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.stringify(restorationFixture.stats.calls))).toBe(before);
});

test('mutation bursts debounce, ignored trees stay quiet, immediate rechecks keep suggestions', async ({ page }) => {
  await page.evaluate(() => restorationFixture.start()); await settled(page);
  await page.evaluate(() => {
    const ignored = document.createElement('div'); ignored.dataset.threadmarkIgnore = ''; document.body.append(ignored);
    ignored.append(document.createElement('div'));
    const overlay = document.createElement('div'); overlay.dataset.threadmarkRoot = ''; document.body.append(overlay);
    overlay.append(document.createElement('div'));
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Object.values(restorationFixture.stats.calls))).toEqual(Array(60).fill(1));
  await page.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      document.getElementById('unrelated').append(document.createElement('i'));
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => restorationFixture.stats.calls['comment-25'])).toBeLessThanOrEqual(6);
  expect(await page.evaluate(() => restorationFixture.stats.calls['comment-0'])).toBe(1);
  const immediate = await page.evaluate(() => { const result = restorationFixture.recheck('comment-25'); return { status: result.status, suggestion: result.suggestion?.id }; });
  expect(immediate.status).toBe('changed');
  expect(immediate.suggestion).toBeTruthy();
});

test('React hydration resolves once and fresh host arrays do not restart it', async ({ page }) => {
  await page.evaluate(() => restorationFixture.mount());
  await expect(page.getByRole('button', { name: /Review page/ })).toBeVisible();
  expect(await page.evaluate(() => window.__restoreCount)).toBe(0);
  await page.getByRole('button', { name: /Review page/ }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__assessCounts).length)).toBe(60);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => Object.values(window.__assessCounts))).toEqual(Array(60).fill(1));
  expect(await page.evaluate(() => window.__restoreCount)).toBe(60);
  await page.evaluate(() => window.renderAgain()); await page.waitForTimeout(250);
  expect(await page.evaluate(() => Object.values(window.__assessCounts))).toEqual(Array(60).fill(1));
  expect(await page.evaluate(() => window.__restoreCount)).toBe(60);
});


test('idle fallback and transitions into ignored regions invalidate safely', async ({ page }) => {
  await page.evaluate(() => { window.requestIdleCallback = undefined; window.cancelIdleCallback = undefined; restorationFixture.start(); });
  await settled(page);
  await page.evaluate(() => document.getElementById('title-0').setAttribute('data-threadmark-ignore', ''));
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.calls['comment-0'])).toBe(2);
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.results['comment-0'].status)).toBe('missing');
  expect(await page.evaluate(() => restorationFixture.stats.calls['comment-1'])).toBe(1);
  await page.evaluate(() => document.getElementById('title-0').removeAttribute('data-threadmark-ignore'));
  await expect.poll(() => page.evaluate(() => restorationFixture.stats.results['comment-0'].status)).toBe('resolved');
});
