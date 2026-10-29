import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const sdk = fileURLToPath(new URL('../../', import.meta.url));
let bundle;
test.beforeAll(async () => {
  const result = await build({ root: sdk, configFile: false, logLevel: 'silent', plugins: [react(), {
    name: 'hydration-counter', transform(code, id) {
      if (id.endsWith('/src/Threadmark.jsx')) return code.replace('    let payload = reusablePayload || createFeedbackPayload({',
        '    if(window.__listCounters) { if(reusablePayload) window.__listCounters.contextRefreshes++; else window.__listCounters.payloads++; }\n    let payload = reusablePayload || createFeedbackPayload({');
    },
  }], define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false,
    lib: { entry: fileURLToPath(new URL('../fixtures/list-hydration-performance.jsx', import.meta.url)), formats: ['iife'], name: 'ListHydrationPerformance' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
async function load(page, count) {
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
  await page.goto('http://localhost/'); await page.addScriptTag({ content: bundle });
  await page.evaluate(count => window.setupListBenchmark(count), count);
  await expect(page.getByRole('button', { name: `Review page, ${count} comments` })).toBeVisible();
}
async function openList(page) {
  await page.getByRole('button', { name: /Review page/ }).click();
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Feedback' })).toBeVisible();
}
for (const count of [60, 200, 1000]) test(`${count} comments: bounded list DOM and incremental host hydration`, async ({ page }) => {
  await load(page, count);
  expect(await page.evaluate(() => window.__listCounters.payloads)).toBe(count);
  const unchanged = await page.evaluate(() => window.pollListRecords());
  expect(unchanged.payloads + unchanged.contextRefreshes).toBe(0);
  const changed = await page.evaluate(() => window.pollListRecords(true));
  expect(changed.payloads).toBe(1);
  await openList(page);
  const list = page.locator('.tm-comments-list');
  await expect.poll(() => list.locator('.tm-comment-card').count()).toBeGreaterThan(0);
  const mounted = await list.locator('.tm-comment-card').count();
  expect(mounted).toBeLessThan(25);
  await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.getByRole('button', { name: `Open comment ${count}: Changed newest comment`, exact: true })).toBeVisible();
  expect(await list.locator('.tm-comment-card').count()).toBeLessThan(25);
  // Settle lazy fonts and row measurements before isolating the host refresh.
  await page.evaluate(async () => {
    await document.fonts.ready;
    const node = document.querySelector('[data-threadmark-root]').shadowRoot.querySelector('.tm-comments-list');
    let previous = '', stable = 0;
    for (let frame = 0; frame < 60 && stable < 5; frame++) {
      await new Promise(requestAnimationFrame);
      const next = `${node.scrollTop}:${node.scrollHeight}`;
      stable = next === previous ? stable + 1 : 0;
      previous = next;
    }
  });
  // A refresh must not reset the reader's position.
  const top = await list.evaluate(node => node.scrollTop);
  await page.evaluate(() => window.pollListRecords());
  expect(await list.evaluate(node => node.scrollTop)).toBeCloseTo(top);
  console.log('LIST/HYDRATION BENCHMARK', JSON.stringify({ comments: count, mountedRows: mounted,
    unchangedPayloadBuilds: unchanged.payloads, editedPayloadBuilds: changed.payloads, unchangedPollMs: unchanged.elapsedMs }));
});
test('search, filters, variable row heights and keyboard reach every comment', async ({ page }) => {
  await load(page, 200); await openList(page);
  const panel = page.getByRole('complementary', { name: 'Feedback' });
  const list = panel.locator('.tm-comments-list');
  const first = list.locator('.tm-comment-card').first(); await first.focus();
  await page.keyboard.press('End');
  await expect(list.locator('.tm-comment-card:focus')).toHaveAttribute('aria-label', /^Open comment 200:/);
  await expect(list.locator('.tm-comment-card:focus')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(list.locator('.tm-comment-card:focus')).toHaveAttribute('aria-label', /^Open comment 1:/);
  await page.keyboard.press('ArrowDown');
  await expect(list.locator('.tm-comment-card:focus')).toHaveAttribute('aria-label', /^Open comment 2:/);
  await page.keyboard.press('Tab');
  await expect(list.locator('.tm-comment-card:focus')).toHaveAttribute('aria-label', /^Open comment 3:/);
  // Wheeling away does not unmount the focused row.
  await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(list.locator('.tm-comment-card:focus')).toHaveAttribute('aria-label', /^Open comment 3:/);
  expect(await list.locator('.tm-comment-card').count()).toBeLessThan(25);
  await panel.getByRole('button', { name: 'Show search comments' }).click();
  await panel.getByRole('textbox', { name: 'Search comments' }).fill('Comment 199');
  await expect(list.locator('.tm-comment-card')).toHaveCount(1);
  await expect(list.locator('.tm-comment-card')).toHaveAttribute('aria-label', /^Open comment 200:/);
  await panel.getByRole('textbox', { name: 'Search comments' }).fill('');
  await panel.getByRole('button', { name: 'Show comment filters' }).click();
  await panel.getByRole('button', { name: 'Only your threads' }).click();
  await expect(panel.getByRole('status')).toHaveText('100 of 200 threads');
  await page.keyboard.press('Escape');
  await list.locator('.tm-comment-card').first().click();
  await expect(page.getByRole('button', { name: 'Cancel comment', exact: true })).toBeVisible();
});

test('virtualized thumbnails refresh same-revision evidence and revoke off-screen Blob URLs', async ({ page }) => {
  await load(page, 200); await page.evaluate(() => window.attachListEvidence()); await openList(page);
  const list = page.locator('.tm-comments-list');
  const first = list.locator('.tm-comment-thumbnail').first(); await expect(first).toBeVisible();
  const original = await first.getAttribute('src');
  await page.evaluate(() => window.replaceListEvidence());
  await expect.poll(() => first.getAttribute('src')).not.toBe(original);
  expect(await page.evaluate(url => window.activeListEvidenceUrls.has(url), original)).toBe(false);
  const current = await first.getAttribute('src');
  await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(list.getByRole('button', { name: /^Open comment 200:/ })).toBeVisible();
  await expect.poll(() => page.evaluate(url => window.activeListEvidenceUrls.has(url), current)).toBe(false);
  expect(await page.evaluate(() => window.activeListEvidenceUrls.size)).toBeLessThan(25);
  await page.getByRole('button', { name: 'Close feedback panel', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.activeListEvidenceUrls.size)).toBe(0);
});
