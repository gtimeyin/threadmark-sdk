import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/send.jsx', import.meta.url)), formats: ['iife'], name: 'SendTest' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
async function load(page) {
  await page.goto('http://localhost/?threadmark=comment-1');
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('.tm-thread-message--root')).toBeVisible();
}
test('a comment goes to a connected tracker, says plainly when it can’t, and keeps the link both ways', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><button id="target" data-threadmark-id="target" style="margin:100px">Pricing toggle</button>' }));
  await load(page);
  await page.getByRole('button', { name: 'More thread actions' }).click();
  const menu = page.getByRole('menu', { name: 'Thread options' });
  await expect(menu.getByRole('menuitem', { name: 'Send to GitHub' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Send to Slack' })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Send to GitHub' }).click();
  const sheet = page.getByRole('dialog', { name: 'New GitHub issue' });
  await expect(sheet.getByLabel('Title')).toHaveValue('The pricing toggle should default to yearly');
  await expect(sheet.locator('pre')).toContainText('“The pricing toggle should default to yearly.”');
  await sheet.getByLabel('Repository').selectOption('studio/archive');
  await sheet.getByRole('button', { name: /Create issue/ }).click();
  await expect(sheet.getByRole('alert')).toContainText('isn’t installed on studio/archive');
  await expect(sheet.getByRole('link', { name: 'Install on GitHub' })).toHaveAttribute('href', 'https://github.com/apps');
  await sheet.getByLabel('Repository').selectOption('studio/site');
  await sheet.getByRole('button', { name: /Create issue/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('GitHub #482 created')).toBeVisible();
  const link = page.locator('.tm-thread-message--root .tm-comment-link a');
  await expect(link).toHaveText('GitHub #482');
  await expect(link).toHaveAttribute('href', 'https://github.com/studio/site/issues/482');
  const sent = await page.evaluate(() => window.sent);
  expect(sent.map(item => item.targetId)).toEqual(['studio/archive', 'studio/site']);
  await load(page);
  await expect(page.locator('.tm-thread-message--root .tm-comment-link')).toContainText('GitHub #482 · Open');
});
