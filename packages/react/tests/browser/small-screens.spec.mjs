import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
const html = '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><main style="padding:40px 16px"><h1 data-threadmark-id="plan">Team plan</h1><p style="height:1200px">Long page</p><button data-threadmark-id="cta">Start free</button><div style="height:1600px"></div></main>';
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/ai-review.jsx', import.meta.url)), formats: ['iife'], name: 'SmallScreens' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
async function open(page) {
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://localhost/');
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('.tm-bar')).toBeVisible();
}
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the bar steps away on scroll; the composer and panel rise as bottom sheets with 44px targets', async ({ page }) => {
    await open(page);
    // No keyboard hints on touch.
    await expect(page.locator('.tm-bar .tm-ui-key')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(page.locator('.tm-bar--idle')).toHaveClass(/is-away/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.tm-bar--idle')).not.toHaveClass(/is-away/);

    await page.getByRole('button', { name: 'Leave feedback', exact: true }).click();
    await expect.poll(async () => Math.min(...await page.locator('.tm-modebar button:visible').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height)))).toBeGreaterThanOrEqual(44);
    await page.locator('[data-threadmark-id="cta"]').scrollIntoViewIfNeeded();
    await page.locator('[data-threadmark-id="cta"]').tap();
    const sheet = page.locator('.tm-popover');
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(844);
    // What the comment is about stays in view above the sheet.
    await expect.poll(async () => (await page.locator('[data-threadmark-id="cta"]').boundingBox()).y).toBeLessThan(box.y);
  });
  test('the panel is a tall sheet that drops to half height', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Leave feedback', exact: true }).click();
    await page.getByRole('button', { name: /^Feedback panel/ }).click();
    const panel = page.locator('#tm-all-comments');
    await expect(panel).toBeVisible();
    const tall = await panel.boundingBox();
    expect(tall.y).toBeLessThan(844 * 0.15);
    await page.getByRole('button', { name: 'Make the panel shorter' }).click();
    await expect.poll(async () => Math.round((await panel.boundingBox()).y)).toBe(422);
  });
});
test.describe('on a tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  test('the panel is a 380px drawer, and tapping the page closes it', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Leave feedback', exact: true }).click();
    await page.getByRole('button', { name: /^Feedback panel/ }).click();
    const panel = page.locator('#tm-all-comments');
    await expect.poll(async () => { const box = await panel.boundingBox(); return [Math.round(box.width), Math.round(box.x + box.width), Math.round(box.height)]; }).toEqual([380, 768, 1024]);
    await page.mouse.click(100, 500);
    await expect(panel).toBeHidden();
  });
});
