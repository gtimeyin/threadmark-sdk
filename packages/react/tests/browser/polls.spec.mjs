import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let pickingHtml;
let pickingBundle;

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
      lib: { entry: fileURLToPath(new URL("../fixtures/picking-events.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkPollFixture" },
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

async function setComment(page, comment) {
  await page.evaluate((value) => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, comment);
}

test("without a vote handler, the composer posts plain comments only", async ({ page }) => {
  await mountFixture(page, "");
  await page.locator(".tm-launcher").click();
  await page.locator("#secondary-target").click();
  await expect(page.locator("#tm-comment")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "What are you posting?" })).toHaveCount(0);
});

test("designers ask questions and run polls; reviewers vote and change their vote", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?polls=1");

  // A poll pinned to an element.
  await page.locator(".tm-launcher").click();
  await page.locator("#secondary-target").click();
  const kinds = page.getByRole("radiogroup", { name: "What are you posting?" });
  await expect(kinds.getByRole("radio", { name: "Comment" })).toHaveAttribute("aria-checked", "true");
  await kinds.getByRole("radio", { name: "Poll" }).click();
  await setComment(page, "Which label reads better for this button?");
  const submit = page.locator(".tm-submit");
  await expect(submit).toHaveText("Post poll");
  await expect(submit).toBeDisabled();
  await page.getByLabel("Answer 1", { exact: true }).fill("Start free trial");
  await page.getByLabel("Answer 2", { exact: true }).fill("Try it free");
  await page.getByRole("button", { name: "Add answer" }).click();
  await page.getByLabel("Answer 3", { exact: true }).fill("Get started");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);

  const poll = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(poll.comment).toBe("Which label reads better for this button?");
  expect(poll.ask).toEqual({
    kind: "poll",
    multiple: false,
    options: [
      { id: "option-1", label: "Start free trial" },
      { id: "option-2", label: "Try it free" },
      { id: "option-3", label: "Get started" },
    ],
  });

  // Voting, switching, and taking a vote back.
  await page.locator(".tm-marker").last().click();
  const card = page.getByRole("region", { name: "Poll" });
  await expect(card).toContainText("0 votes");
  await card.getByRole("radio", { name: /Try it free/ }).click();
  await expect(card).toContainText("1 vote");
  await expect(card.getByRole("radio", { name: /Try it free/ })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("radio", { name: /Try it free/ })).toContainText("1 · 100%");
  await card.getByRole("radio", { name: /Get started/ }).click();
  await expect(card.getByRole("radio", { name: /Get started/ })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("radio", { name: /Try it free/ })).toHaveAttribute("aria-checked", "false");
  await card.getByRole("radio", { name: /Get started/ }).click();
  await expect(card).toContainText("0 votes");
  expect(await page.evaluate((id) => window.__threadmarkVotes[id], poll.id)).toEqual({});
  await page.keyboard.press("Escape");

  // A question is answered with replies.
  await page.locator("#custom-target").click();
  await page.getByRole("radio", { name: "Question" }).click();
  await setComment(page, "Should this open in a new tab?");
  await expect(page.locator(".tm-submit")).toHaveText("Ask");
  await page.locator(".tm-submit").click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  expect(await page.evaluate(() => window.__threadmarkFeedback.at(-1).ask)).toEqual({ kind: "question" });

  expect(pageErrors).toEqual([]);
});
