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
  await expect(page.getByRole("button", { name: "Add a poll" })).toHaveCount(0);
});

test("a poll is attached to a comment; reviewers vote and change their vote", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?polls=1");

  // A poll pinned to an element.
  await page.locator(".tm-launcher").click();
  await page.locator("#secondary-target").click();
  // Every post is a comment; a poll is attached to it from the composer's tools.
  const addPoll = page.getByRole("button", { name: "Add a poll" });
  await expect(addPoll).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Answer 1", { exact: true })).toHaveCount(0);
  await addPoll.click();
  await expect(addPoll).toHaveAttribute("aria-pressed", "true");
  await setComment(page, "Which label reads better for this button?");
  const submit = page.locator(".tm-submit");
  await expect(submit).toHaveText("Post");
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
  // The reply box has the same @ button as the composer; it starts a mention at the cursor.
  await page.locator(".tm-reply").getByRole("button", { name: "Mention someone" }).click();
  await expect(page.locator("#tm-comment")).toHaveValue("@");
  await setComment(page, "");
  const card = page.getByRole("region", { name: "Poll" });
  const answer = (label) => card.getByRole("radio", { name: label, exact: true });
  const results = card.getByRole("list", { name: "Results" });
  // Before you vote: round marks, no shares.
  await expect(card).toContainText("Pick one");
  await expect(card).toContainText("0 votes · Results show after you vote");
  await expect(card).not.toContainText("%");
  await answer("Try it free").click();
  // After: results, a tick on your vote, the Lime bar on the leader, and a visible Change vote.
  await expect(card).toContainText("1 vote · Change vote");
  await expect(results.locator(".tm-poll-result.is-chosen")).toContainText("Try it free");
  await expect(results.locator(".tm-poll-result.is-chosen")).toContainText("100%");
  await expect(results.locator(".tm-poll-result.is-leading")).toHaveCount(1);
  await expect(card.getByRole("radio")).toHaveCount(0);
  // Change vote goes back to the answers with yours marked; picking another moves the vote.
  await card.getByRole("button", { name: "Change vote" }).click();
  await expect(answer("Try it free")).toHaveAttribute("aria-checked", "true");
  await answer("Get started").click();
  await expect(results.locator(".tm-poll-result.is-chosen")).toContainText("Get started");
  // Picking your own answer again takes the vote back.
  await card.getByRole("button", { name: "Change vote" }).click();
  await answer("Get started").click();
  await expect(card).toContainText("0 votes · Results show after you vote");
  expect(await page.evaluate((id) => window.__threadmarkVotes[id], poll.id)).toEqual({});
  await answer("Try it free").click();
  await page.keyboard.press("Escape");

  // In the Comments list, the poll shows its answers and shares, read-only, in a sunken well.
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  const summary = page.locator(".tm-comment-card .tm-comment-poll");
  await expect(summary).toContainText("1 vote · You voted");
  await expect(summary.locator(".tm-comment-poll__option")).toHaveCount(3);
  await expect(summary.locator(".tm-comment-poll__option.is-chosen")).toContainText("Try it free");
  await expect(summary.locator(".tm-comment-poll__option.is-chosen")).toContainText("100%");
  expect(await summary.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0.24)");
  await page.getByRole("button", { name: "Close feedback panel" }).click();

  // Removing the poll leaves a plain comment; there is no separate Question kind.
  await page.locator("#custom-target").click();
  await page.getByRole("button", { name: "Add a poll" }).click();
  await page.getByLabel("Answer 1", { exact: true }).fill("Yes");
  await page.getByRole("button", { name: "Remove poll" }).click();
  await expect(page.getByLabel("Answer 1", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a poll" })).toHaveAttribute("aria-pressed", "false");
  await setComment(page, "Should this open in a new tab?");
  await page.locator(".tm-submit").click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  expect(await page.evaluate(() => window.__threadmarkFeedback.at(-1).ask)).toBeUndefined();

  expect(pageErrors).toEqual([]);
});

test("reviewers ask people a survey question in three steps; problems are named next to their field", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?surveys=1");
  await page.locator(".tm-launcher").click();
  await page.getByRole("button", { name: /^Feedback tools/ }).click();
  await page.getByRole("menuitemradio", { name: /Ask a question/ }).click();
  const builder = page.getByRole("dialog", { name: "Ask a question" });
  await expect(builder).toBeVisible();

  // Next with nothing filled in says what's missing, beside the fields, and stays on step 1.
  await builder.getByRole("button", { name: /^Next/ }).click();
  await expect(builder.getByText("Write the question people will see.")).toBeVisible();
  await expect(builder.getByText("Add at least two answers.")).toBeVisible();
  await expect(builder.locator('[aria-current="step"]')).toContainText("Question");

  await builder.getByRole("radio", { name: "Scale" }).click();
  await builder.getByLabel("Question", { exact: true }).fill("How easy was it to find pricing?");
  await builder.getByLabel("Low end").fill("Hard");
  await builder.getByLabel("High end").fill("Easy");
  await builder.getByRole("radio", { name: "7" }).click();
  await builder.getByRole("button", { name: /^Next/ }).click();
  await expect(builder.locator('[aria-current="step"]')).toContainText("Where");
  await builder.getByRole("radio", { name: "Banner" }).click();
  await expect(page.locator(".tm-survey-ghost--banner")).toHaveCount(1);
  await builder.getByRole("button", { name: /^Next/ }).click();
  await expect(builder.getByText("Live on /picking-events")).toBeVisible();
  await builder.getByRole("button", { name: /^Publish/ }).click();
  await expect(builder).toHaveCount(0);
  await expect(page.locator(".tm-toast")).toContainText("Your question is live on /picking-events");

  const published = await page.evaluate(() => window.__threadmarkSurveys);
  expect(published).toEqual([expect.objectContaining({
    status: "live",
    pages: ["/picking-events"],
    audience: "visitors",
    placement: { kind: "page", position: "banner", target: null },
    question: expect.objectContaining({ kind: "scale", text: "How easy was it to find pricing?", scale: { points: 7, display: "numbers", low: "Hard", high: "Easy" } }),
  })]);

  // The team sees it at the top of Comments and can read the answers, then end it.
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await page.getByRole("button", { name: /How easy was it to find pricing\?/ }).click();
  const results = page.getByRole("tabpanel", { name: /^Answers:/ });
  await expect(results).toContainText("4.3 of 7 · 3 answers");
  await expect(results).toContainText("“Wanted to see the price per seat.”");
  // 11d: Export saves a CSV; Share results copies a short read to paste anywhere.
  const download = page.waitForEvent("download");
  await results.getByRole("button", { name: "Export" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("how-easy-was-it-to-find-pricing-answers.csv");
  const csv = await (await import("node:fs/promises")).readFile(await file.path(), "utf8");
  expect(csv).toContain('"Average","4.3 of 7"');
  expect(csv).toContain('"Wanted to see the price per seat."');
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost" });
  await results.getByRole("button", { name: "Share results" }).click();
  await expect(page.locator(".tm-toast")).toContainText("Results copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("4.3 of 7 · 3 answers");
  await results.getByRole("button", { name: "End survey" }).click();
  await expect(results).toContainText("Ended");
  expect(pageErrors).toEqual([]);
});

test("with Pick any, quick picks on a slow host keep each other instead of the last one winning", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?polls=slow");
  await page.locator(".tm-launcher").click();
  await page.locator("#secondary-target").click();
  await page.getByRole("button", { name: "Add a poll" }).click();
  await setComment(page, "Which should stay?");
  await page.getByLabel("Answer 1", { exact: true }).fill("Search");
  await page.getByLabel("Answer 2", { exact: true }).fill("Filters");
  await page.getByLabel("Pick any").check();
  await page.locator(".tm-submit").click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  const poll = await page.evaluate(() => window.__threadmarkFeedback.at(-1));

  await page.locator(".tm-marker").last().click();
  const card = page.getByRole("region", { name: "Poll" });
  const answer = (label) => card.getByRole("checkbox", { name: label, exact: true });
  await answer("Search").click();
  // Picked before the host answered the first vote.
  await answer("Filters").click();
  await expect(answer("Search")).toHaveAttribute("aria-checked", "true");
  await expect(answer("Filters")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => page.evaluate((id) => window.__threadmarkVotes[id]?.fixture_reviewer, poll.id)).toEqual(["option-1", "option-2"]);
  expect(pageErrors).toEqual([]);
});
