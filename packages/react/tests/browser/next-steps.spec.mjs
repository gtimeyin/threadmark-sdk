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
      lib: { entry: fileURLToPath(new URL("../fixtures/picking-events.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkNextStepsFixture" },
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

async function openNextSteps(page) {
  await page.locator(".tm-launcher").click();
  await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Feedback", exact: true });
  await panel.getByRole("tab", { name: /^Next steps/ }).click();
  return panel;
}

test("without next steps from the host, the Feedback panel has no Next steps tab", async ({ page }) => {
  await mountFixture(page, "");
  await page.locator(".tm-launcher").click();
  await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Feedback", exact: true });
  await expect(panel.getByRole("tab", { name: /^Versions/ })).toBeVisible();
  await expect(panel.getByRole("tab", { name: /^Next steps/ })).toHaveCount(0);
});

test("reviewers work through the host's next steps on the page", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?nextsteps=1");
  const panel = await openNextSteps(page);
  await expect(panel.getByRole("tab", { name: /^Next steps/ })).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("tab", { name: /^Next steps/ })).toContainText("2");
  const list = panel.getByRole("tabpanel", { name: "Next steps" });
  await expect(list).toContainText("1 of 3 done");
  await expect(list).toContainText("Updated 5m ago");
  await expect(list.getByRole("progressbar", { name: "Steps done" })).toHaveAttribute("aria-valuenow", "1");
  // Host text is plain text, never markup.
  await expect(list.getByText("<b>Shorten</b> the hero heading")).toBeVisible();
  await expect(list.locator("b")).toHaveCount(0);
  await expect(list.locator(".tm-step-tag--bug")).toHaveText("Bug");

  // A step opens to the feedback behind it.
  await list.getByRole("button", { name: /Fix the Buy button on mobile/ }).click();
  await expect(list.getByText("Seen on iPhone 15", { exact: false })).toBeVisible();
  await expect(list.getByRole("list", { name: "Feedback behind this step" })).toContainText("Sam Okafor/checkout");
  await expect(list).toContainText("Suggested from reviewers' feedback");

  // Ticking shows at once and goes to the host.
  await list.getByRole("checkbox", { name: "Mark done: <b>Shorten</b> the hero heading" }).click();
  await expect(list.getByRole("checkbox", { name: "Mark not done: <b>Shorten</b> the hero heading" })).toBeChecked();
  await expect(list).toContainText("2 of 3 done");
  expect(await page.evaluate(() => window.__threadmarkNextStepTicks)).toEqual([["step-hero", true]]);

  // Finished steps sit under Done, with who finished them.
  await list.getByRole("button", { name: /Pick the plan name/ }).click();
  await expect(list).toContainText("Done by Emily R. through an AI agent");

  // Copy for agent hands every step to the host.
  await panel.getByRole("button", { name: "Copy the open steps for an AI agent" }).click();
  expect(await page.evaluate(() => window.__threadmarkNextStepCopies)).toEqual([["step-buy", "step-hero", "step-plan"]]);
  await expect(page.getByText("Copied the open steps as a prompt for your AI agent.")).toBeVisible();

  // A source on another page opens there with its thread link.
  await list.getByRole("button", { name: /Fix the Buy button on mobile/ }).click();
  await list.getByRole("button", { name: /Sam Okafor/ }).click();
  await expect(page).toHaveURL("http://localhost/checkout?threadmark=thread-elsewhere");
  expect(pageErrors).toEqual([]);
});

test("a thread missing from this page says so, and a failed tick is put back", async ({ page }) => {
  await mountFixture(page, "?nextsteps=fail");
  const panel = await openNextSteps(page);
  const list = panel.getByRole("tabpanel", { name: "Next steps" });
  await list.getByRole("button", { name: /Shorten<\/b> the hero heading/ }).click();
  await list.getByRole("button", { name: /Emily R\./ }).click();
  await expect(page.getByText("That thread isn’t available on this page.")).toBeVisible();

  await list.getByRole("checkbox", { name: "Mark done: Fix the Buy button on mobile" }).click();
  await expect(page.getByText("The step wasn’t updated. Try again.")).toBeVisible();
  await expect(list.getByRole("checkbox", { name: "Mark done: Fix the Buy button on mobile" })).not.toBeChecked();
  expect(await page.evaluate(() => window.__threadmarkErrors.map((error) => error.code))).toContain("next_step_failed");
});

test("a read-only list can't be ticked", async ({ page }) => {
  await mountFixture(page, "?nextsteps=readonly");
  const panel = await openNextSteps(page);
  const list = panel.getByRole("tabpanel", { name: "Next steps" });
  await expect(list.getByRole("checkbox", { name: "Mark done: Fix the Buy button on mobile" })).toBeDisabled();
  await expect(list.getByRole("checkbox", { name: "Mark not done: Pick the plan name" })).toBeDisabled();
});
