import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const fixtureHtml = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Surveys</title></head><body><div id="root"></div><script src="/surveys-fixture.js"></script></body></html>';
let fixtureBundle;

test.use({ viewport: { width: 1024, height: 700 } });

test.beforeAll(async () => {
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [react()],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("../fixtures/surveys.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkSurveysFixture" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  fixtureBundle = output.find((item) => item.type === "chunk")?.code;
});

async function open(page, path = "/pricing", query = "") {
  const pageErrors = [];
  const outsideRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://localhost" || !["/surveys-fixture.js", path].includes(url.pathname)) outsideRequests.push(request.url());
  });
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/surveys-fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: fixtureBundle });
    return route.fulfill({ status: 200, contentType: "text/html", body: fixtureHtml });
  });
  await page.goto(`http://localhost${path}${query}`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__surveysMounted)).toBe(true);
  return { pageErrors, outsideRequests };
}

const card = (page) => page.locator("[data-threadmark-surveys] .tms-card");
const answers = (page) => page.evaluate(() => window.__surveyAnswers);
const events = (page) => page.evaluate(() => window.__surveyEvents);

test("a visitor answers a scale and a follow-up, sees thanks, and isn't asked again", async ({ page }) => {
  const { pageErrors, outsideRequests } = await open(page);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText("1 of 2");
  await expect(card(page).getByRole("button", { name: "Next" })).toBeDisabled();
  await card(page).getByRole("radio", { name: "4 of 5" }).click();
  await expect(card(page).getByRole("radio", { name: "4 of 5" })).toHaveAttribute("aria-checked", "true");
  await card(page).getByRole("button", { name: "Next" }).click();
  await expect(card(page)).toContainText("2 of 2");
  await card(page).getByLabel("What nearly stopped you?").fill("Couldn't tell Team from Pro.");
  await card(page).getByRole("button", { name: "Send" }).click();
  await expect(card(page)).toContainText("Thanks, that helps");
  await expect.poll(() => answers(page)).toEqual([expect.objectContaining({ surveyId: "find-pricing", value: 4, followUp: "Couldn't tell Team from Pro.", page: "/pricing" })]);
  await expect(card(page)).toHaveCount(0, { timeout: 6000 });
  // Once means once: the same person isn't asked again.
  await page.reload();
  await page.waitForTimeout(600);
  await expect(card(page)).toHaveCount(0);
  expect((await events(page)).filter((event) => event.startsWith("error:invalid_survey"))).toHaveLength(1);
  expect(pageErrors).toEqual([]);
  expect(outsideRequests).toEqual([]);
});

test("the follow-up is optional and Skip moves on without asking again", async ({ page }) => {
  await open(page);
  await card(page).getByRole("radio", { name: "2 of 5" }).click();
  await card(page).getByRole("button", { name: "Next" }).click();
  await card(page).getByRole("button", { name: "Send" }).click();
  await expect.poll(() => answers(page)).toEqual([expect.objectContaining({ value: 2, followUp: null })]);
});

test("skipping the question counts as seen; closing only hides it for this visit", async ({ page }) => {
  await open(page);
  await card(page).getByRole("button", { name: "Close question" }).click();
  await expect(card(page)).toHaveCount(0);
  expect(await events(page)).toContain("closed:find-pricing");
  await page.goto("http://localhost/pricing");
  await page.waitForTimeout(600);
  await expect(card(page)).toHaveCount(0);
});

test("polls show as a banner and only on their page; team questions skip visitors", async ({ page }) => {
  await open(page, "/home");
  await expect(card(page)).toBeVisible();
  await expect(page.locator(".tms-layer--banner")).toHaveCount(1);
  await card(page).getByRole("radio", { name: "Build it together." }).click();
  await card(page).getByRole("button", { name: "Send" }).click();
  await expect.poll(() => answers(page)).toEqual([expect.objectContaining({ surveyId: "headline", value: "build-it-together" })]);
  await page.goto("http://localhost/team");
  await page.waitForTimeout(400);
  await expect(card(page)).toHaveCount(0);
});

test("an answer that doesn't send is kept and retried quietly", async ({ page }) => {
  await open(page, "/pricing", "?fail=1");
  await card(page).getByRole("radio", { name: "5 of 5" }).click();
  await card(page).getByRole("button", { name: "Next" }).click();
  await card(page).getByRole("button", { name: "Send" }).click();
  await expect(card(page)).toContainText("Thanks, that helps");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("threadmark:surveys:pending")).length)).toBe(1);
  await expect.poll(() => answers(page), { timeout: 5000 }).toEqual([expect.objectContaining({ value: 5 })]);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("threadmark:surveys:pending")).length)).toBe(0);
});
