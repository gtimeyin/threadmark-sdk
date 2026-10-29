import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const sdk = fileURLToPath(new URL('../../', import.meta.url));
let current, previous;
async function consumerBuild(baseline) {
  const files = new Set(['Threadmark.jsx', 'ThreadmarkOverlay.jsx', 'tours/ThreadmarkTours.jsx', 'ReplayPlayer.jsx', 'snapshot.js']);
  const result = await build({ root: sdk, configFile: false, logLevel: 'silent', plugins: [react(), {
    name: 'bundle-baseline',
    load(id) {
      const relative = id.slice(resolve(sdk, 'src').length + 1);
      if (baseline && id.startsWith(resolve(sdk, 'src') + '/') && files.has(relative)) return execFileSync('git', ['show', `v0.1.0-beta.12:packages/react/src/${relative}`], { cwd: sdk, encoding: 'utf8' });
    },
  }], define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false,
    rollupOptions: { input: resolve(sdk, 'tests/fixtures/bundle-performance.jsx'), output: { entryFileNames: 'entry.js', chunkFileNames: '[name]-[hash].js' } } } });
  const output = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output);
  const chunks = new Map(output.filter(item => item.type === 'chunk').map(item => [item.fileName, item]));
  const initial = new Set();
  function visit(name) { if (initial.has(name)) return; initial.add(name); for (const child of chunks.get(name).imports) visit(child); }
  visit('entry.js');
  return { output, initial, chunks, gzip: [...initial].reduce((sum, name) => sum + gzipSync(chunks.get(name).code).length, 0) };
}
test.beforeAll(async () => { current = await consumerBuild(false); previous = await consumerBuild(true); });
test('optional UI, fonts and styles stay out of the initial consumer graph', async () => {
  const modules = [...current.initial].flatMap(name => Object.keys(current.chunks.get(name).modules));
  for (const feature of ['fonts.js', 'VideoFeedback.jsx', 'videoStyles.js', 'TourPanel.jsx', 'tours/ThreadmarkTours.jsx', 'ReplayPlayer.jsx']) {
    expect(modules.some(id => id.endsWith(`/src/${feature}`)), feature).toBe(false);
  }
  expect(current.gzip).toBeLessThan(previous.gzip * .8);
  console.log('BUNDLE BENCHMARK', JSON.stringify({ beta12InitialGzip: previous.gzip, initialGzip: current.gzip,
    reductionPercent: Math.round((1 - current.gzip / previous.gzip) * 100) }));
});
test('real chunks load on demand and preserve strict CSP styling', async ({ page }) => {
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://localhost/**', route => {
    const path = new URL(route.request().url()).pathname.slice(1);
    const asset = current.output.find(item => item.fileName === path);
    if (asset) { requests.push(path); return route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: asset.type === 'chunk' ? asset.code : asset.source }); }
    return route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'" }, body: '<div id="root"></div><script type="module" src="/entry.js"></script>' });
  });
  await page.goto('http://localhost/');
  await expect(page.getByRole('button', { name: 'Review page' })).toBeVisible();
  expect(requests.some(name => name.startsWith('fonts-'))).toBe(false);
  expect(requests.some(name => name.startsWith('videoFeatures-'))).toBe(false);
  await page.getByRole('button', { name: 'Review page' }).click();
  await expect.poll(() => requests.some(name => name.startsWith('fonts-'))).toBe(true);
  expect(requests.some(name => name.startsWith('videoFeatures-'))).toBe(false);
  await page.getByRole('button', { name: /Feedback tools/ }).click();
  await page.getByRole('menuitemradio', { name: /Record a video/ }).click();
  await expect(page.getByRole('dialog', { name: /Record video/ })).toBeVisible();
  await expect.poll(() => requests.some(name => name.startsWith('videoFeatures-'))).toBe(true);
  expect(await page.evaluate(() => document.querySelector('[data-threadmark-root]').shadowRoot.adoptedStyleSheets.length)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
