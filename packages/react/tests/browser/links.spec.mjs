import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/links.jsx', import.meta.url)), formats: ['iife'], name: 'LinksTest' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
async function load(page, dashboardUrl) {
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><button id="target" data-threadmark-id="target" style="margin:100px">Pricing toggle</button>' }));
  await page.goto('http://localhost/?threadmark=comment-1');
  if (dashboardUrl !== undefined) await page.evaluate((url) => { window.dashboardUrl = url; }, dashboardUrl);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('.tm-thread-message--root')).toBeVisible();
}

test('a thread shows the tracker links it was given, and offers no Send to', async ({ page }) => {
  await load(page);
  const link = page.locator('.tm-thread-message--root .tm-comment-link a');
  await expect(link).toHaveText('GitHub #482');
  await expect(link).toHaveAttribute('href', 'https://github.com/studio/site/issues/482');
  await expect(page.locator('.tm-thread-message--root .tm-comment-link')).toContainText('GitHub #482 · Open');
  await page.getByRole('button', { name: 'More thread actions' }).click();
  const menu = page.getByRole('menu', { name: 'Thread options' });
  await expect(menu.getByRole('menuitem', { name: /Send to/ })).toHaveCount(0);
});

test('the Bar and panel link to the dashboard only when the host gives a safe address', async ({ page }) => {
  await load(page, 'https://app.example.com/acme');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Open the dashboard' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Send feedback to…' })).toHaveCount(0);

  await load(page, 'javascript:alert(1)');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Open the dashboard' })).toHaveCount(0);
});
