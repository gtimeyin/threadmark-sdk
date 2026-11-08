import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/presence.jsx', import.meta.url)), formats: ['iife'], name: 'PresenceTest' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
test('live cursors anchor, hide, exclude private inputs and keep the connection stable', async ({ page }) => {
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><button data-threadmark-id="hero" style="position:absolute;left:100px;top:100px;width:200px;height:50px">Hero</button><input style="position:absolute;top:200px;left:100px" value="private">' }));
  await page.goto('http://localhost/'); await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => window.deliver);
  await page.evaluate(() => window.deliver([{ connectionId: 'bob-tab', member: { id: 'bob', displayName: 'Bob' }, route: '/', buildId: 'one', updatedAt: Date.now(), cursor: { x: 0, y: 0, targetId: 'hero', offsetX: 0.5, offsetY: 0.5 } }]));
  await expect(page.getByText('1 other reviewer on this page')).toBeVisible();
  await expect(page.locator('.tm-live-cursor')).toHaveCSS('opacity', '1');
  await expect(page.locator('.tm-live-cursor')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 200, 125)');
  await page.getByRole('button', { name: 'Hide cursors' }).click();
  await expect(page.locator('.tm-presence-layer')).toBeHidden();
  await page.getByRole('button', { name: 'Show cursors' }).click();
  await page.mouse.move(140, 120);
  await expect.poll(() => page.evaluate(() => window.publications.at(-1)?.targetId)).toBe('hero');
  await page.mouse.move(140, 205);
  await expect.poll(() => page.evaluate(() => window.publications.at(-1))).toBeNull();
  expect(await page.evaluate(() => window.connections)).toBe(1);
});
