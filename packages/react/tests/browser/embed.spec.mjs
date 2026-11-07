import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Exercises the built script-tag bundle (dist/embed/), served from a CDN-like path on a page with no React.
const embedDirectory = fileURLToPath(new URL('../../dist/embed/', import.meta.url));
const CDN = 'http://localhost/cdn/threadmark/';

async function serve(page, body) {
  await page.route('http://localhost/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.startsWith('/cdn/threadmark/')) {
      const file = pathname.slice('/cdn/threadmark/'.length);
      try {
        const contents = await readFile(embedDirectory + file);
        return route.fulfill({ contentType: file.endsWith('.map') ? 'application/json' : 'text/javascript', body: contents });
      } catch {
        return route.fulfill({ status: 404, body: 'missing' });
      }
    }
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>` });
  });
}

const feedbackButton = page => page.getByRole('button', { name: 'Review page', exact: true });

test('a script tag with data attributes mounts the overlay on a page without React', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await serve(page, `<h1>Plain HTML site</h1><button id="cta">Sign up</button>
    <script type="module" src="${CDN}threadmark.js" data-project-key="plain-site" data-ignored-selectors=".private, #promo"></script>`);
  await page.goto('http://localhost/');
  await expect(feedbackButton(page)).toBeVisible();
  expect(await page.locator('[data-threadmark-root]').count()).toBe(1);
  expect(await page.evaluate(() => typeof window.Threadmark?.mount)).toBe('function');
  expect(await page.evaluate(() => typeof window.React)).toBe('undefined');

  // Opening the toolbar pulls lazy chunks (fonts, feature styles) from the CDN path next to threadmark.js.
  const missing = [];
  page.on('response', response => { if (response.status() === 404) missing.push(response.url()); });
  await feedbackButton(page).click();
  await expect(page.getByRole('button', { name: 'Feedback panel', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

test('without a project key nothing mounts until mount() is called, and unmount() removes it', async ({ page }) => {
  await serve(page, `<h1>Manual setup</h1>
    <script type="module">
      import { mount } from "${CDN}threadmark.js";
      window.created = [];
      window.instance = mount({ projectKey: "manual-site", onFeedbackCreate: feedback => { window.created.push(feedback.id); } });
      window.again = mount({ projectKey: "manual-site" });
    </script>`);
  await page.goto('http://localhost/');
  await expect(feedbackButton(page)).toBeVisible();
  expect(await page.evaluate(() => window.instance === window.again)).toBe(true);
  expect(await page.locator('[data-threadmark-root]').count()).toBe(1);

  await page.evaluate(() => window.instance.unmount());
  await expect(page.locator('[data-threadmark-root]')).toHaveCount(0);
  await expect(page.locator('[data-threadmark-embed]')).toHaveCount(0);

  await page.evaluate(() => { window.next = window.Threadmark.mount({ projectKey: 'manual-site' }); });
  await expect(feedbackButton(page)).toBeVisible();
  expect(await page.evaluate(() => window.next !== window.instance)).toBe(true);
});

test('a script tag on a non-local host stays off unless enabled and allowlisted', async ({ page }) => {
  await page.route('http://staging.example.test/**', route => route.fulfill({ contentType: 'text/html', body: `<h1>Staging</h1>
    <script type="module" src="http://localhost/cdn/threadmark/threadmark.js" data-project-key="site" data-environment="staging"></script>` }));
  await serve(page, '');
  await page.goto('http://staging.example.test/');
  await page.waitForFunction(() => window.Threadmark);
  await expect(page.locator('[data-threadmark-root]')).toHaveCount(0);
});
