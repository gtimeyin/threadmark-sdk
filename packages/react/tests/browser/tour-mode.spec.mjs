import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let pickingHtml;
let pickingBundle;

test.use({ viewport: { width: 1100, height: 760 } });

test.beforeAll(async () => {
  pickingHtml = (await readFile(new URL("../fixtures/picking-events.html", import.meta.url), "utf8"))
    .replace('<script type="module" src="./picking-events.jsx"></script>', "");
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [react()],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("../fixtures/picking-events.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkTourModeFixture" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  pickingBundle = output.find((item) => item.type === "chunk")?.code;
});

async function mountFixture(page, query) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/threadmark-fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: pickingBundle });
    return route.fulfill({ status: 200, contentType: "text/html", body: pickingHtml.replace("</body>", '<script src="/threadmark-fixture.js"></script></body>') });
  });
  await page.goto(`http://localhost/picking-events${query}`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  return pageErrors;
}

const panel = (page) => page.getByRole("complementary", { name: "Tour" });

async function fill(page, locator, value) {
  await locator.evaluate((element, text) => {
    const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(element, text);
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, value);
}

test("Tour mode edits a tour by clicking the page, then saves it to code", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?tours=1");
  await page.locator(".tm-launcher").click();
  await page.getByRole("button", { name: "Build a tour" }).click();

  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole("combobox", { name: "Editing" })).toHaveValue("fixture-tour");
  await expect(panel(page).locator(".tm-tour-step")).toHaveCount(1);
  await expect(page.locator(".tm-tour-mark")).toHaveCount(1);

  // Clicking a tagged element adds a step without activating the host's handlers.
  await page.locator("#secondary-target").click();
  await expect(panel(page).locator(".tm-tour-step")).toHaveCount(2);
  await expect(panel(page).locator(".tm-tour-step.is-open code")).toHaveText("secondary-action");
  expect(await page.evaluate(() => window.__threadmarkHostEvents)).not.toContain("secondary-click");
  await expect(page.locator(".tm-tour-mark")).toHaveCount(2);

  await fill(page, panel(page).locator(".tm-tour-step.is-open input"), "Try the secondary action");
  await fill(page, panel(page).locator(".tm-tour-step.is-open textarea"), "It does the other thing.");
  await panel(page).locator(".tm-tour-step.is-open select").first().selectOption("click");
  await panel(page).getByRole("button", { name: "Move step 2 up" }).click();
  await expect(panel(page).locator(".tm-tour-step strong").first()).toHaveText("Try the secondary action");

  await panel(page).getByRole("tab", { name: "Who and when" }).click();
  await panel(page).getByRole("combobox", { name: "Shows" }).selectOption("untilFinished");

  // An element without a stable id gets a suggested id and snippet instead of a step.
  await page.locator("#animated-target").click({ force: true });
  await expect(panel(page).getByText("needs a stable id first")).toBeVisible();
  await expect(panel(page).locator(".tm-tour-untagged code")).toHaveText('{...threadmarkTarget("animated.fixture.target")}');

  await panel(page).getByRole("button", { name: "Save to code" }).click();
  await expect(panel(page).getByText("Saved tours/fixture-tour.tour.json.")).toBeVisible();
  const [saved] = await page.evaluate(() => window.__threadmarkTourSaves);
  expect(saved.file.fileName).toBe("tours/fixture-tour.tour.json");
  const written = JSON.parse(saved.file.contents);
  expect(written).toMatchObject({ id: "fixture-tour", repeat: "untilFinished", $schema: "https://unpkg.com/threadmark-react/tour.schema.json" });
  expect(written.steps.map((step) => [step.target, step.title, step.next])).toEqual([
    ["secondary-action", "Try the secondary action", "click"],
    ["custom-text-control", "The custom control", undefined],
  ]);
  expect(saved.tour.steps).toHaveLength(2);

  // Esc goes back to the review toolbar, and drafts survive coming back.
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Threadmark annotation tools" })).toBeVisible();
  await page.getByRole("button", { name: "Build a tour" }).click();
  await expect(panel(page).locator(".tm-tour-step")).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});

test("Try it plays the draft in a temporary player and saves nothing", async ({ page }) => {
  await mountFixture(page, "?tours=1");
  await page.locator(".tm-launcher").click();
  await page.getByRole("button", { name: "Build a tour" }).click();
  await panel(page).getByRole("button", { name: "Try it" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Trying your tour. Nothing is saved." })).toBeVisible();
  const card = page.locator("[data-threadmark-tours]").getByRole("dialog");
  await expect(card).toHaveAccessibleName("The custom control");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("threadmark:tour")))).toEqual([]);

  await card.getByRole("button", { name: "Finish" }).click();
  await expect(panel(page)).toBeVisible();
  await expect(page.locator("[data-threadmark-tours]")).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("threadmark:tour")))).toEqual([]);
});

test("without onTourSave, Tour mode offers Copy file but not Save to code", async ({ page }) => {
  await mountFixture(page, "");
  await page.locator(".tm-launcher").click();
  await page.getByRole("button", { name: "Build a tour" }).click();
  await expect(panel(page).getByText("Click anything on the page to start a tour")).toBeVisible();
  await page.locator("#custom-target").click();
  await expect(panel(page).locator(".tm-tour-step")).toHaveCount(1);
  await expect(panel(page).getByRole("button", { name: "Copy file" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Save to code" })).toHaveCount(0);
});
