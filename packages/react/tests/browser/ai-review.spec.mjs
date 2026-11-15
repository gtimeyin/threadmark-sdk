import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
const html = '<div id="root"></div><main style="padding:120px 200px"><h1 data-threadmark-id="plan">Team plan</h1><button data-threadmark-id="cta">Start free</button><div data-threadmark-id="chart" style="width:300px;height:120px;margin-top:40px;background:#ddd">Usage chart</div></main>';
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/ai-review.jsx', import.meta.url)), formats: ['iife'], name: 'AiReviewTest' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
async function open(page, setup) {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://localhost/');
  if (setup) await page.evaluate(setup);
  await page.addScriptTag({ content: bundle });
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click();
}
async function startReview(page) {
  await page.getByRole('button', { name: 'Feedback tools: Comment' }).click();
  await page.getByRole('menuitemradio', { name: /Ask AI to review this page/ }).click();
  const setup = page.getByRole('dialog', { name: 'Review this page' });
  await expect(setup.getByRole('switch', { name: /Matches your design system/ })).not.toBeChecked();
  await setup.getByRole('button', { name: /Review page/ }).click();
}
test('a page review comes back as drafts; nothing posts until someone says so', async ({ page }) => {
  await open(page);
  await startReview(page);
  const panel = page.getByRole('complementary', { name: 'AI review' });
  await expect(panel).toContainText('2 things worth a look');
  expect(await page.evaluate(() => window.focus)).toEqual(['accessibility', 'copy', 'layout']);
  expect(await page.evaluate(() => window.posted.length)).toBe(0);
  await expect(page.locator('.tm-ai-pin')).toHaveCount(2);
  // A finding whose element isn't on the page can't be posted.
  await expect(panel.locator('[data-finding="ghost"]').getByRole('button', { name: 'Post as comment' })).toBeDisabled();
  await panel.locator('[data-finding="names"]').getByRole('button', { name: 'Dismiss' }).click();
  await page.getByRole('menuitem', { name: 'We already know' }).click();
  expect(await page.evaluate(() => window.dismissed)).toEqual([['names', 'already-known']]);
  await expect(panel.locator('[data-finding="names"]')).toHaveCount(0);
  await panel.locator('[data-finding="contrast"]').getByRole('button', { name: 'Post as comment' }).click();
  await expect(panel.locator('[data-finding="contrast"]')).toContainText('Posted as a comment');
  const posted = await page.evaluate(() => window.posted);
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ source: 'ai', comment: 'Button text is too faint. White on Forest at this size is 3.1:1.', author: { id: 'alice' } });
  expect(posted[0].target.locatorCandidates.stableId).toBe('cta');
  // One suggestion is still undecided: closing asks once, with Keep looking focused.
  await panel.getByRole('button', { name: 'Close AI review' }).click();
  const confirm = panel.getByRole('alertdialog');
  await expect(confirm).toContainText('drop 1 suggestion nobody kept');
  await expect(confirm.getByRole('button', { name: 'Keep looking' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Keep looking' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(panel.locator('[data-finding="ghost"]')).toBeVisible();
  await panel.getByRole('button', { name: 'Close AI review' }).click();
  await panel.getByRole('alertdialog').getByRole('button', { name: 'Drop them' }).click();
  await expect(panel).toHaveCount(0);
});
test('Stop keeps what was found so far, and a clean review says nothing stood out', async ({ page }) => {
  await open(page, () => { window.hangReview = true; });
  await startReview(page);
  await expect(page.getByRole('status').filter({ hasText: 'Reviewing /' })).toContainText('1 of 3 elements');
  await page.keyboard.press('Escape');
  const panel = page.getByRole('complementary', { name: 'AI review' });
  await expect(panel.getByRole('alert')).toContainText('You stopped the review');
  await expect(panel).toContainText('Found before it stopped');
  await expect(panel).toContainText('Button text is too faint');
  await page.evaluate(() => { window.hangReview = false; window.emptyReview = true; });
  await panel.getByRole('button', { name: 'Review again' }).click();
  await page.getByRole('dialog', { name: 'Review this page' }).getByRole('button', { name: /Review page/ }).click();
  await expect(panel).toContainText('Nothing stood out');
});
test('Ask AI looks at one element, takes a follow-up, and posts only when asked', async ({ page }) => {
  await open(page);
  await page.locator('[data-threadmark-id="chart"]').click();
  await page.keyboard.press('Meta+k');
  const card = page.getByRole('dialog', { name: /^AI on / });
  await expect(card).toContainText('The legend runs past the chart.');
  await expect(card).toContainText('Put the legend under the chart.');
  await card.getByRole('textbox', { name: /follow-up/ }).fill('Would a tooltip be enough?');
  await card.getByRole('textbox', { name: /follow-up/ }).press('Enter');
  await expect(card).toContainText('A tooltip hides it until someone hovers.');
  expect((await page.evaluate(() => window.asks)).map((ask) => ask.question)).toEqual([null, 'Would a tooltip be enough?']);
  expect(await page.evaluate(() => window.posted.length)).toBe(0);
  await card.getByRole('button', { name: 'Post as comment' }).click();
  await expect(card).toBeHidden();
  const posted = await page.evaluate(() => window.posted);
  expect(posted).toHaveLength(1);
  expect(posted[0].source).toBe('ai');
  expect(posted[0].comment).toContain('A tooltip hides it until someone hovers.');
});
