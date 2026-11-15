import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/thumbnails.jsx', import.meta.url)), formats: ['iife'], name: 'Thumbs' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
test('only real screenshots become thumbnails; a playback is never shown as a broken image', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><button id="target" data-threadmark-id="target" style="margin:100px">Start free</button>' }));
  await page.goto('http://localhost/');
  await page.addScriptTag({ content: bundle });
  await page.getByRole('button', { name: /^Open feedback/ }).click();
  const panel = page.locator('#tm-all-comments');
  await expect(panel.locator('.tm-comment-card')).toHaveCount(2);
  await expect(panel.getByRole('button', { name: /Screenshot failed/ }).locator('img')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /Screenshot failed/ })).toContainText('Screenshot unavailable');
  const real = panel.getByRole('button', { name: /Has a screenshot/ }).locator('img.tm-comment-thumbnail');
  await expect.poll(() => real.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  // The thread picks its screenshot the same way, and must not show the playback either.
  await panel.getByRole('button', { name: /Screenshot failed/ }).click();
  const thread = page.locator('.tm-popover--thread');
  await expect(thread).toBeVisible();
  await expect.poll(() => thread.locator('img').evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth === 0).length)).toBe(0);
  // A posted comment says quietly that it has no screenshot; the composer's "you can still post" is not for it.
  const insideCard = async (popover) => {
    const card = await popover.boundingBox();
    const row = await popover.locator('.tm-replay-open').boundingBox();
    return row.x >= card.x && row.x + row.width <= card.x + card.width;
  };
  await expect(thread.locator('.tm-snapshot__note')).toHaveText('No screenshot. It couldn’t be taken when this was posted.');
  await expect(thread).not.toContainText('You can still post');
  await expect.poll(() => insideCard(thread)).toBe(true);
  // The same thread opened from its pin, as a popover beside it.
  await thread.getByRole('button', { name: 'All comments' }).click();
  await page.getByRole('button', { name: 'Close feedback panel' }).click();
  await page.getByRole('button', { name: 'Edit annotation 1' }).dispatchEvent('click');
  const popover = page.locator('.tm-popover--thread');
  await expect(popover.locator('.tm-replay-open')).toBeVisible();
  await expect.poll(() => insideCard(popover)).toBe(true);
});

test('panel filter options are readable, Esc closes search before the panel, and delete can be undone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><button id="target" data-threadmark-id="target" style="margin:100px">Start free</button>' }));
  await page.goto('http://localhost/');
  await page.addScriptTag({ content: bundle });
  await page.getByRole('button', { name: /^Open feedback/ }).click();
  const panel = page.locator('#tm-all-comments');
  await panel.getByRole('button', { name: /^Show comment filters/ }).click();
  const option = panel.getByRole('dialog', { name: 'Comment filters' }).locator('button').first();
  expect((await option.boundingBox()).width).toBeGreaterThan(150);
  await page.keyboard.press('Escape');
  await panel.getByRole('button', { name: 'Show search comments' }).click();
  await page.keyboard.type('shot');
  await page.keyboard.press('Escape');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Show search comments' })).toBeFocused();
  await panel.getByRole('button', { name: /Has a screenshot/ }).click();
  await page.getByRole('button', { name: /^Actions for comment/ }).click();
  // 23d: nobody replied, so it goes straight away; Undo brings it back in the same place.
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.locator('.tm-delete-confirm')).toHaveCount(0);
  await expect(page.locator('.tm-toast')).toContainText('Comment deleted');
  await page.locator('.tm-toast__action').click();
  await expect(page.locator('.tm-toast')).toContainText('Comment restored');
  await expect(panel).toContainText('Has a screenshot');
  await expect(panel).toContainText('#2 · Start free');
});
