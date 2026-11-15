import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

let bundle;
const html = `<div id="root"></div>
<main style="font-family: sans-serif; padding: 24px">
  <h1>Pricing</h1>
  <p class="plan">Starter <span style="color:#bbb">$29 a month</span></p>
  <a href="#start" data-threadmark-id="start">Get started</a>
  <div data-threadmark-sensitive>secret-sentinel account balance</div>
  <div class="private-test">hidden-sentinel</div>
  <div class="rr-block">blocked-region-sentinel</div>
  <button>Open <span class="rr-mask">masked-child-sentinel</span></button>
  <div class="label-wrapper"><span id="public-label">Save <span class="masked-label">label-child-sentinel</span></span></div>
  <button aria-labelledby="public-label">Update</button>
  <button><img class="rr-block" alt="private-image-sentinel"><svg class="rr-mask"><title>private-title-sentinel</title></svg></button>
  <label>Email <input value="typed-sentinel@example.com"></label>
  <textarea>draft-sentinel</textarea>
  <p style="margin-top: 3000px">far-below-sentinel</p>
</main>`;

test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/hosted-page-review.jsx', import.meta.url)), formats: ['iife'], name: 'AiPageReviewTest' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});

async function open(page) {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://localhost/pricing'); await page.addScriptTag({ content: bundle });
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click();
  await page.getByRole('button', { name: /^Feedback tools/ }).click();
  await expect(page.getByRole('menuitemradio', { name: /Review this page/ })).toContainText('AI suggests comments');
  await page.getByRole('menuitemradio', { name: /Review this page/ }).click();
}

test('the review sends only what is on screen, with private parts and typed values left out', async ({ page }) => {
  await open(page);
  await page.getByLabel(/What should it look at/).fill('The plans');
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Suggestions' }).getByRole('listitem')).toHaveCount(3);
  const request = await page.evaluate(() => window.requests[0]);
  expect(request.route).toBe('/pricing');
  expect(request.buildId).toBe('b1');
  expect(request.focus).toBe('The plans');
  expect(request.viewport).toEqual({ width: 1200, height: 800 });
  expect(request.elements.length).toBeGreaterThan(2);
  expect(request.elements.length).toBeLessThanOrEqual(150);
  expect(request.elements.every((item, index) => item.id === `e${index + 1}`)).toBe(true);
  expect(request.elements.some(item => /Get started/.test(item.name || item.text))).toBe(true);
  const sent = JSON.stringify({ ...request, screenshot: null });
  for (const sentinel of ['secret-sentinel', 'hidden-sentinel', 'typed-sentinel', 'draft-sentinel', 'far-below-sentinel', 'blocked-region-sentinel', 'masked-child-sentinel', 'label-child-sentinel', 'private-image-sentinel', 'private-title-sentinel']) expect(sent).not.toContain(sentinel);
  expect(sent).not.toContain('Threadmark');
  expect(request.screenshot.type).toMatch(/^image\/(webp|png|jpeg)$/);
  expect(request.screenshot.base64.length).toBeGreaterThan(100);
  expect(request.screenshot.base64).not.toMatch(/^data:/);
});

test('keeping a suggestion posts it as the reviewer\'s comment, marked with where it came from', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await page.getByRole('button', { name: /^Keep: "Get started"/ }).click();
  await expect(page.getByText('1 kept')).toBeVisible();
  const [saved] = await page.evaluate(() => window.saved);
  expect(saved.feedback.comment).toBe('"Get started" doesn\'t say what happens next.');
  expect(saved.feedback.source).toBe('ai_review');
  expect(saved.feedback.aiReview).toEqual({ reviewId: '11111111-1111-4111-8111-111111111111', findingId: 'f1' });
  expect(saved.feedback.target.locatorCandidates.stableId).toBe('start');
  expect(saved.feedback.captureKind).toBe('element');
  expect(saved.feedback.route).toBe('/pricing');
  expect(saved.feedback.author.id).toBe('mo');
  expect(saved.evidence).toHaveLength(1);
  expect(saved.evidence[0].size).toBeGreaterThan(0);
  expect(saved.feedback.evidence[0].id).toBe(saved.evidence[0].id);

  // Edit, then keep: the edited words are saved.
  const second = page.getByRole('list', { name: 'Suggestions' }).getByRole('listitem').filter({ hasText: 'light grey' });
  await second.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Edit suggestion').fill('Darken the price so it passes contrast.');
  // While editing, only the edited suggestion has a plain "Keep" button (the others are labelled with their text).
  await page.getByRole('list', { name: 'Suggestions' }).getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.getByText('2 kept')).toBeVisible();
  expect((await page.evaluate(() => window.saved))[1].feedback.comment).toBe('Darken the price so it passes contrast.');

  // Dismissing tells the host and removes it from the list.
  await page.getByRole('button', { name: /^Dismiss: The heading/ }).click();
  await expect(page.getByText('All done · 2 kept')).toBeVisible();
  expect(await page.evaluate(() => window.dismissed)).toEqual([['f3', '11111111-1111-4111-8111-111111111111']]);

  // The kept comment opens as an ordinary thread, labelled as an AI suggestion.
  await page.getByRole('button', { name: 'Close page review' }).click();
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  await page.getByText('"Get started" doesn\'t say what happens next.').first().click();
  await expect(page.getByText('From an AI review', { exact: true })).toBeVisible();
});

test('a failed review says why and keeps the panel usable', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.failReview = true; });
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'At most 10 page reviews an hour' })).toBeVisible();
  await page.evaluate(() => { window.failReview = false; });
  await page.getByRole('button', { name: 'Review this page', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Suggestions' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('list', { name: 'Suggestions' }).getByRole('listitem').first().hover();
  await expect(page.locator('.tm-agent-highlight')).toBeVisible();
});
