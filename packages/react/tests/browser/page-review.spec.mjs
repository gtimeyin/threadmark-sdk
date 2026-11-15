import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
const html = '<div id="root"></div><h1>Agent fixture</h1><h3 data-threadmark-id="jump">Skipped heading</h3><button data-threadmark-id="unnamed" style="width:40px;height:30px"></button><p data-threadmark-id="tiny" style="font-size:11px">Small copy</p><div data-threadmark-sensitive><button style="width:40px;height:30px"></button>secret-sentinel</div><div class="private-test"><img src="data:image/png;base64,iVBORw0KGgo=" style="width:30px;height:30px">hidden-sentinel</div><input value="password-sentinel"><button aria-labelledby="button-name"> <svg aria-hidden="true"></svg></button><span id="button-name">Named through a label</span>';
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/page-review.jsx', import.meta.url)), formats: ['iife'], name: 'PageReviewTest' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
async function open(page) {
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://localhost/'); await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => window.scanPage);
}
test('page scanning bounds findings and excludes protected content and labelled controls', async ({ page }) => {
  await open(page);
  const input = await page.evaluate(() => {
    document.querySelector('[data-threadmark-id="tiny"]').insertAdjacentHTML('beforeend', '<span class="rr-mask">masked-sentinel</span>');
    document.body.insertAdjacentHTML('beforeend', '<div class="rr-block"><button style="width:40px;height:30px"></button></div>');
    return window.scanPage();
  });
  expect(input.findings.map(item => item.rule)).toEqual(['heading-jump', 'unnamed-control', 'small-text']);
  expect(JSON.stringify(input)).not.toContain('sentinel');
  await page.evaluate(() => { for (let i = 0; i < 10; i++) { const el = document.createElement('button'); el.style.cssText = 'width:30px;height:30px'; document.body.append(el); } });
  expect((await page.evaluate(() => window.scanPage())).findings).toHaveLength(5);
});
test('requested review posts saved agent discussions, attaches evidence and skips duplicate reruns', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Ask Threadmark' }).click();
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Added 3 comments.' })).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => window.lastEvidence)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Skipped 3 duplicates.' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Close agent panel' }).click();
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  await expect(page.getByText('Threadmark Agent', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('This control has no accessible name.', { exact: false }).first()).toBeVisible();
});

test('stop prevents a pending local review from posting and retains a safe retry', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.pauseReview = true; });
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Ask Threadmark' }).click();
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await page.waitForFunction(() => window.resumeReview);
  await page.getByRole('button', { name: 'Stop review' }).click();
  await page.evaluate(() => { window.pauseReview = false; window.resumeReview(); });
  await expect(page.getByRole('status').filter({ hasText: 'Stopped locally.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit annotation/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Added 3 comments.' })).toBeVisible({ timeout: 30000 });
});
