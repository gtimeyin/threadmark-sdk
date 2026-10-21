import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let fixtureHtml;
let fixtureBundle;

test.use({ viewport: { width: 1024, height: 700 } });

test.beforeAll(async () => {
  fixtureHtml = (await readFile(new URL("../fixtures/tours.html", import.meta.url), "utf8"))
    .replace('<script type="module" src="./tours.jsx"></script>', '<script src="/tours-fixture.js"></script>');
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [react()],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("../fixtures/tours.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkToursFixture" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  fixtureBundle = output.find((item) => item.type === "chunk")?.code;
});

async function open(page, path = "/projects", query = "") {
  const pageErrors = [];
  const outsideRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://localhost" || !["/tours-fixture.js", path, "/projects", "/team"].includes(url.pathname)) outsideRequests.push(request.url());
  });
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/tours-fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: fixtureBundle });
    return route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
  });
  await page.goto(`http://localhost${path}${query}`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__toursMounted)).toBe(true);
  return { pageErrors, outsideRequests };
}

const card = (page) => page.getByRole("dialog");
const activeText = (page) => page.evaluate(() => document.querySelector("[data-threadmark-tours]").shadowRoot.activeElement?.textContent ?? null);
const events = (page) => page.evaluate(() => window.__tourEvents.map((event) => `${event.type}${event.stepId ? `:${event.stepId}` : ""}`));

test("plays a tour on page load, with focus on the title and keyboard controls in the card", async ({ page }) => {
  const { pageErrors, outsideRequests } = await open(page);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveAccessibleName("Start something new");
  await expect(card(page)).toHaveAttribute("aria-modal", "false");
  await expect(card(page).getByText("Step 1 of 4")).toBeVisible();
  await expect.poll(() => activeText(page)).toBe("Start something new");

  // The card sits beside its target with an arrow, and the spotlight surrounds the target.
  const target = await page.getByRole("button", { name: "New project" }).boundingBox();
  const box = await card(page).boundingBox();
  expect(box.y).toBeGreaterThan(target.y + target.height);
  await expect(page.locator(".tmt-spot")).toHaveCount(1);

  await page.keyboard.press("ArrowRight");
  await expect(card(page)).toHaveAccessibleName("Bring your people in");
  await expect.poll(() => activeText(page)).toBe("Bring your people in");
  await expect(card(page).getByText("Use “Invite” to continue.")).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Next" })).toHaveCount(0);

  await page.keyboard.press("ArrowLeft");
  await expect(card(page)).toHaveAccessibleName("Start something new");
  await expect(page.locator(".tmt-live")).toContainText("Step 1 of 4. Start something new. Points to: New project.");

  expect(pageErrors).toEqual([]);
  expect(outsideRequests).toEqual([]);
});

test("a tour started from a button returns focus to that button when it closes", async ({ page }) => {
  await open(page, "/team");
  await page.getByRole("button", { name: "Help" }).click();
  await expect(card(page)).toHaveAccessibleName("How can we help?");
  await expect(card(page)).toHaveAttribute("aria-modal", "true");
  await expect.poll(() => activeText(page)).toBe("How can we help?");

  // Modal steps keep Tab inside the card.
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("Tab");
  expect(await activeText(page)).not.toBeNull();

  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Help" })).toBeFocused();
});

test("Esc pauses the tour, and the tour waits until a later visit", async ({ page, context }) => {
  await open(page);
  await expect(card(page)).toBeVisible();
  await card(page).getByRole("button", { name: "Next" }).click();
  await expect(card(page)).toHaveAccessibleName("Bring your people in");
  await expect.poll(() => activeText(page)).toBe("Bring your people in");
  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);
  expect(await events(page)).toEqual(["started", "stepShown:new", "stepCompleted:new", "stepShown:invite", "paused:invite"]);

  // Same visit: "Not now" is respected.
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__toursMounted)).toBe(true);
  await page.waitForTimeout(500);
  await expect(card(page)).toHaveCount(0);

  // A later visit (new tab, same browser) offers to pick up at the first unseen step.
  const later = await context.newPage();
  await open(later);
  await expect(card(later)).toHaveAccessibleName("Pick up where you left off?");
  await expect(card(later).getByText("Step 3 of 4 · Templates live here")).toBeVisible();
  await card(later).getByRole("button", { name: "Start over" }).click();
  await expect(card(later)).toHaveAccessibleName("Start something new");
});

test("click steps wait for the real element, slow elements get a waiting notice, and pages change with the router", async ({ page }) => {
  await open(page);
  await card(page).getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Getting the next step ready…" })).toBeVisible();
  await expect(card(page)).toHaveAccessibleName("Templates live here");
  await card(page).getByRole("button", { name: "Next" }).click();

  // The next step is on /team, so the player navigates there with the app's router.
  await expect(page).toHaveURL(/\/team$/);
  await expect(card(page)).toHaveAccessibleName("Your team lives here");

  // Wandering off pauses the tour in a small bar instead of chasing the person.
  await page.getByRole("button", { name: "Projects" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tour paused. The next step is on /team." })).toBeVisible();
  await page.getByRole("button", { name: "Back to the tour" }).click();
  await expect(card(page)).toHaveAccessibleName("Your team lives here");

  await card(page).getByRole("button", { name: "Finish" }).click();
  await expect(card(page)).toHaveCount(0);
  expect((await events(page)).at(-1)).toBe("finished:team");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("threadmark:tour:anonymous:welcome")));
  expect(saved.status).toBe("finished");
  expect(saved.seen).toEqual(["new", "invite", "templates", "team"]);
});

test("a missing target gets a kind fallback and a targetMissing event, never a guess", async ({ page }) => {
  await open(page, "/projects", "?missing");
  await card(page).getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(card(page)).toHaveAccessibleName("We couldn’t find this one", { timeout: 4_000 });
  const missing = await page.evaluate(() => window.__tourEvents.find((event) => event.type === "targetMissing"));
  expect(missing).toMatchObject({ stepId: "templates", reason: "missing", target: "projects.nowhere" });
  await card(page).getByRole("button", { name: "Skip ahead" }).click();
  await expect(card(page)).toHaveAccessibleName("Your team lives here");
});

test("on a phone the card is a bottom sheet, uses phone copy, and keeps the target above it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await open(page, "/team");
  await page.evaluate(() => {
    localStorage.setItem("threadmark:tour:anonymous:welcome", JSON.stringify({ tourId: "welcome", status: "inProgress", seen: [], startedAt: 1, updatedAt: 1 }));
  });
  await page.getByRole("button", { name: "Help" }).click();
  await expect(card(page)).toHaveAccessibleName("How can we help?");
  await expect(card(page)).toHaveAttribute("data-mode", "sheet");
  await expect(card(page)).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");

  await page.evaluate(() => window.sessionStorage.clear());
  await page.getByRole("button", { name: "Projects" }).click();
  await expect(card(page)).toHaveAccessibleName("Start something new");
  await expect(card(page)).toHaveAttribute("data-mode", "sheet");
  const sheet = await card(page).boundingBox();
  const target = await page.getByRole("button", { name: "New project" }).boundingBox();
  expect(sheet.y + sheet.height).toBeCloseTo(700, 0);
  expect(target.y + target.height).toBeLessThanOrEqual(sheet.y);
  const buttonHeight = await card(page).getByRole("button", { name: "Next" }).evaluate((element) => element.getBoundingClientRect().height);
  expect(buttonHeight).toBeGreaterThanOrEqual(36);
});

test("notes go to the host, and invalid tours are reported instead of played", async ({ page }) => {
  await open(page, "/projects", "?notes&invalid");
  await expect(card(page)).toHaveAccessibleName("Start something new");
  expect(await page.evaluate(() => window.__tourErrors)).toEqual([{ code: "invalid_tour", tourId: "broken", paths: ["steps[0].target"] }]);

  await card(page).getByRole("button", { name: "Something unclear here?" }).click();
  await card(page).getByRole("textbox", { name: "What’s unclear about this step?" }).fill("Is a blank project free?");
  await card(page).getByRole("button", { name: "Send" }).click();
  await expect(card(page).getByText("Thanks. The team will see this on this step.")).toBeVisible();
  expect(await page.evaluate(() => window.__tourNotes)).toEqual([
    { tourId: "welcome", stepId: "new", stepIndex: 0, text: "Is a blank project free?", path: "/projects" },
  ]);
});

test("reduced motion turns off the player's animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(card(page)).toBeVisible();
  const motion = await page.evaluate(() => {
    const root = document.querySelector("[data-threadmark-tours]").shadowRoot;
    return [getComputedStyle(root.querySelector(".tmt-card")).animationName, getComputedStyle(root.querySelector(".tmt-spot")).transitionProperty];
  });
  expect(motion).toEqual(["none", "none"]);
});
