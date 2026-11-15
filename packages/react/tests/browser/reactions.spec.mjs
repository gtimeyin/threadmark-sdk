import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
let bundle;
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [react()], define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('../fixtures/reactions.jsx', import.meta.url)), formats: ['iife'], name: 'ReactionsTest' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  bundle = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).find(item => item.type === 'chunk').code;
});
async function load(page) {
  await page.goto('http://localhost/?threadmark=comment-1');
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('.tm-thread-message--root')).toBeVisible();
}
test('comment and reply reactions toggle independently, persist and recover from failure', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><button id="target" data-threadmark-id="target" style="margin:100px">Review target</button>' }));
  await load(page);
  const root = page.locator('.tm-thread-message--root');
  const reply = page.locator('.tm-thread-message--reply');
  await root.getByRole('button', { name: 'Thumbs up: 1', exact: true }).click();
  await expect(root.getByRole('button', { name: 'Thumbs up: 2, including you' })).toHaveAttribute('aria-pressed', 'true');
  await root.getByRole('button', { name: 'Thumbs up: 2, including you' }).click();
  await expect(root.getByRole('button', { name: 'Thumbs up: 1', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await reply.getByRole('button', { name: 'Add reaction' }).click();
  await reply.getByRole('button', { name: 'Celebrate: 0', exact: true }).click();
  await expect(reply.getByRole('button', { name: 'Celebrate: 1, including you' })).toBeVisible();
  await load(page);
  await expect(reply.getByRole('button', { name: 'Celebrate: 1, including you' })).toBeVisible();
  await page.evaluate(() => { window.failReaction = true; });
  await root.getByRole('button', { name: 'Thumbs up: 1', exact: true }).click();
  await expect(page.getByText('Your reaction wasn’t saved. Try again.')).toBeVisible();
  await expect(root.getByRole('button', { name: 'Thumbs up: 1', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => { window.failReaction = false; });
  await root.getByRole('button', { name: 'Thumbs up: 1', exact: true }).click();
  await expect(root.getByRole('button', { name: 'Thumbs up: 2, including you' })).toBeVisible();
  await expect(page.getByText('Your reaction wasn’t saved. Try again.')).toBeHidden({ timeout: 10000 });
  await page.locator('.tm-popover--thread').screenshot({ path: '/tmp/threadmark-reactions.png' });
});
