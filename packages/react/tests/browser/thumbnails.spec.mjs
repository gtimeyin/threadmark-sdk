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
});
