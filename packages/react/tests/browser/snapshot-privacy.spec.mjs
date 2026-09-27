import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const MASK = [32, 39, 34];
const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let fixtureHtml;
let fixtureBundle;
let pickingHtml;
let pickingBundle;

async function bundleFixture(entry, name) {
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [react()],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: fileURLToPath(entry),
        formats: ["iife"],
        name,
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  const bundle = output.find((item) => item.type === "chunk")?.code;
  if (!bundle) throw new Error(`${name} did not produce a browser bundle.`);
  return bundle;
}

test.beforeAll(async () => {
  fixtureHtml = (await readFile(new URL("../fixtures/snapshot-privacy.html", import.meta.url), "utf8"))
    .replace('<script type="module" src="./snapshot-privacy.js"></script>', "");
  fixtureBundle = await bundleFixture(
    new URL("../fixtures/snapshot-privacy.js", import.meta.url),
    "ThreadmarkSnapshotPrivacyFixture",
  );
  pickingHtml = (await readFile(new URL("../fixtures/picking-events.html", import.meta.url), "utf8"))
    .replace('<script type="module" src="./picking-events.jsx"></script>', "");
  pickingBundle = await bundleFixture(
    new URL("../fixtures/picking-events.jsx", import.meta.url),
    "ThreadmarkPickingEventsFixture",
  );
});

async function mountPickingFixture(page) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://localhost/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: pickingHtml,
  }));
  await page.goto("http://localhost/picking-events", { waitUntil: "load" });
  await page.addScriptTag({ content: pickingBundle });
  await expect.poll(() => page.evaluate(() => window.__threadmarkFixtureState)).toBe("rendered");
  expect(pageErrors).toEqual([]);
  await expect.poll(() => page.evaluate(() => ({
    statuses: window.__threadmarkStatuses,
    errors: window.__threadmarkErrors,
    hostCount: document.querySelectorAll("[data-threadmark-root]").length,
  }))).toEqual({ statuses: ["ready"], errors: [], hostCount: 1 });
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-launcher").click();
  });
}

async function mountPersistentPickingFixture(page) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/threadmark-fixture.js") {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: pickingBundle });
    }
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: pickingHtml.replace("</body>", '<script src="/threadmark-fixture.js"></script></body>'),
    });
  });
  await page.goto("http://localhost/picking-events?persist=1", { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  expect(pageErrors).toEqual([]);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-launcher").click();
  });
}

async function setComposerComment(page, comment) {
  await page.evaluate((value) => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, comment);
}

async function waitForComposer(page) {
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover"),
  ))).toBe(true);
}

// Saved comments are edited in place on the thread message; saving keeps the discussion open.
async function editOriginalComment(page, comment) {
  await page.locator(".tm-thread-message--root .tm-thread-message__menu-toggle").click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await setComposerComment(page, comment);
  await page.locator(".tm-thread-message--root .tm-submit").click();
  await expect(page.locator(".tm-thread-message--root p")).toHaveText(comment);
}

async function submitComposer(page) {
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-submit")?.disabled
  ))).toBe(false);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-submit").click();
  });
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover"),
  ))).toBe(false);
}

test("picking a custom text control does not invoke its host pointer handlers", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });

  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover"),
  ))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__threadmarkHostEvents)).toEqual([]);
});

test("shows host-supplied page versions and carries a comment only when requested", async ({ page }) => {
  await mountPickingFixture(page);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector('button[aria-label="Feedback panel"]').click();
  });
  await page.getByRole("tab", { name: /^Versions/ }).click();

  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      labels: [...shadow.querySelectorAll(".tm-version-row__title strong")].map((node) => node.textContent),
      current: shadow.querySelector(".tm-version-state--current")?.textContent,
      feedback: [...shadow.querySelectorAll(".tm-version-feedback")].map((node) => node.textContent.trim()),
      openActions: shadow.querySelectorAll(".tm-version-open").length,
    };
  })).toEqual({
    labels: ["Current preview", "Previous preview", "Expired preview"],
    current: "Current",
    feedback: ["0", "3", "2"],
    openActions: 1,
  });

  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-version-open").click();
  });
  await expect.poll(() => page.evaluate(() => window.__threadmarkVersionSelections.map((item) => ({
    id: item.version.id,
    route: item.context.route,
    url: item.context.url,
  })))).toEqual([{
    id: "fixture-previous",
    route: "/picking-events",
    url: "http://localhost/picking-events",
  }]);

  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await setComposerComment(page, "Carry this issue to the previous deployment.");
  await submitComposer(page);
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-marker"),
  ))).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-marker").click();
  });
  await waitForComposer(page);
  await page.getByRole("button", { name: "More thread actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Carry forward", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-carry-forward__list button"),
  ))).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector(".tm-carry-forward__list button").click();
  });
  await expect.poll(() => page.evaluate(() => window.__threadmarkCarryForwards.map((item) => ({
    comment: item.feedback.comment,
    versionId: item.version.id,
    route: item.context.route,
  })))).toEqual([{
    comment: "Carry this issue to the previous deployment.",
    versionId: "fixture-previous",
    route: "/picking-events",
  }]);
});

test("Feedback uses readable glass in both tabs and a solid high-contrast fallback", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await mountPickingFixture(page);
  await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Feedback", exact: true });
  const glassStyle = () => panel.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      background: style.backgroundColor,
      blur: style.backdropFilter,
      opacity: style.opacity,
      headingColor: getComputedStyle(element.querySelector("h2")).color,
      metadataColor: getComputedStyle(element.querySelector("header p")).color,
      withinViewport: bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
    };
  });
  await expect(panel).toBeVisible();
  const expectedGlass = {
    background: "rgba(251, 250, 246, 0.74)",
    blur: "blur(10px) saturate(1.2)",
    opacity: "1",
    headingColor: "rgb(26, 30, 27)",
    metadataColor: "rgb(26, 30, 27)",
    withinViewport: true,
  };
  expect(await glassStyle()).toEqual(expectedGlass);
  await panel.getByRole("tab", { name: /^Versions/ }).click();
  await expect(panel.getByRole("tabpanel", { name: "Page versions" })).toBeVisible();
  expect(await glassStyle()).toEqual(expectedGlass);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await glassStyle()).toEqual(expectedGlass);
  await panel.getByRole("tab", { name: /^Comments/ }).click();
  await panel.getByRole("button", { name: "Show search comments" }).click();
  await expect(panel.getByRole("textbox", { name: "Search comments" })).toBeVisible();
  await page.emulateMedia({ forcedColors: "active" });
  const accessibleStyle = await glassStyle();
  expect(accessibleStyle.blur).toBe("none");
  expect(accessibleStyle.background).toBe("rgb(255, 255, 255)");
  expect(accessibleStyle.withinViewport).toBe(true);
  await panel.getByRole("button", { name: "Close feedback panel" }).click();
  await expect(panel).toBeHidden();
});

test("records and restores a privacy-safe interaction trace while leaving the page usable", async ({ page }) => {
  await mountPersistentPickingFixture(page);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector('button[aria-label="Record an interaction"]').click();
  });
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-interaction-recorder"),
  ))).toBe(true);

  await page.locator("#interaction-search").fill("private launch plan");
  await page.locator("#interaction-search").press("Space");
  await page.locator("#secondary-target").click();
  await expect(page.locator("#interaction-output")).toHaveText("Results updated");
  await expect.poll(() => page.evaluate(() => window.__threadmarkHostEvents)).toContain("secondary-click");

  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-recording-stop").click();
  });
  await waitForComposer(page);
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      preview: Boolean(shadow?.querySelector(".tm-interaction-preview")),
      privacy: shadow?.querySelector(".tm-interaction-privacy")?.textContent,
      leakedInOverlay: shadow?.textContent.includes("private launch plan"),
    };
  })).toEqual({
    preview: true,
    privacy: "Typed content and printable keystrokes were not recorded.",
    leakedInOverlay: false,
  });

  await setComposerComment(page, "Keep the results stable while searching.");
  await submitComposer(page);
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.captureKind).toBe("interaction");
  expect(saved.interaction.events.map((event) => event.type)).toContain("input");
  expect(saved.interaction.events.map((event) => event.type)).toContain("click");
  expect(JSON.stringify(saved)).not.toContain("private launch plan");
  expect(saved.interaction.events.filter((event) => event.type === "keydown" && event.key === " ")).toEqual([]);

  await page.reload({ waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-launcher").click();
  });
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-marker"),
  ))).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-marker").click();
  });
  await waitForComposer(page);
  await expect.poll(() => page.evaluate(() => ({
    preview: Boolean(document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-interaction-preview")),
    steps: document.querySelectorAll("[data-threadmark-root]")[0]?.shadowRoot.querySelectorAll(".tm-interaction-events li").length,
  }))).toEqual({ preview: true, steps: saved.interaction.events.length });
});

test("keeps reviewer identity out of the composer and attributes submitted feedback", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);

  await expect.poll(() => page.evaluate(() => {
    const shadowRoot = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    const disclosure = shadowRoot?.querySelector(".tm-context-disclosure");
    return {
      contextIsCollapsed: disclosure?.open === false,
      contextLabel: disclosure?.querySelector("summary")?.textContent,
      hasVisibleReviewer: Boolean(shadowRoot?.querySelector(".tm-reviewer")),
      fieldLabelIsVisuallyHidden: shadowRoot?.querySelector('label[for="tm-comment"]')?.classList.contains("tm-sr-only"),
    };
  })).toEqual({
    contextIsCollapsed: true,
    contextLabel: "Selected context",
    hasVisibleReviewer: false,
    fieldLabelIsVisuallyHidden: true,
  });

  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]")
      ?.shadowRoot.querySelector(".tm-context-disclosure > summary")
      ?.click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")
      ?.shadowRoot.querySelector(".tm-context-disclosure")?.open
  ))).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const content = document.querySelector("[data-threadmark-root]")
      ?.shadowRoot.querySelector(".tm-context-disclosure__content");
    return content ? getComputedStyle(content).paddingBottom : null;
  })).toBe("11px");
  await expect.poll(() => page.evaluate(() => {
    const tag = document.querySelector("[data-threadmark-root]")
      ?.shadowRoot.querySelector(".tm-context-tag");
    return tag ? getComputedStyle(tag).fontFamily : null;
  })).toContain("ui-monospace");

  await setComposerComment(page, "Attribute this note to the signed-in reviewer.");
  await submitComposer(page);

  await expect.poll(() => page.evaluate(() => {
    const feedback = window.__threadmarkFeedback.at(-1);
    return {
      author: feedback?.author,
      lastEditedBy: feedback?.lastEditedBy,
      hasUpdatedAt: typeof feedback?.updatedAt === "string",
    };
  })).toEqual({
    author: { id: "fixture_reviewer", displayName: "Emily R.", avatarUrl: null },
    lastEditedBy: { id: "fixture_reviewer", displayName: "Emily R.", avatarUrl: null },
    hasUpdatedAt: true,
  });
});

test("replies to a previous comment and confirms reply or annotation deletion with impact", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await setComposerComment(page, "Clarify the behavior of this control.");
  await submitComposer(page);

  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(1);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-marker").click();
  });
  await waitForComposer(page);
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      messages: shadow?.querySelectorAll(".tm-thread-message").length,
      author: shadow?.querySelector(".tm-thread-message__meta strong")?.textContent,
      comment: shadow?.querySelector(".tm-thread-message p")?.textContent,
    };
  })).toEqual({
    messages: 1,
    author: "Emily R.",
    comment: "Clarify the behavior of this control.",
  });

  await expect(page.locator(".tm-form__footer")).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    return Math.round(shadow.querySelector(".tm-popover").getBoundingClientRect().bottom
      - shadow.querySelector(".tm-reply").getBoundingClientRect().bottom);
  })).toBe(15);

  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector(".tm-thread-message__actions button").click();
  });
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      mode: shadow?.querySelector(".tm-composer-mode span")?.textContent,
      value: shadow?.querySelector("#tm-comment")?.value,
      submit: shadow?.querySelector(".tm-submit")?.textContent.trim(),
    };
  })).toEqual({ mode: "Replying to Emily R.", value: "", submit: "Reply" });

  await setComposerComment(page, "I can update the label in this release.");
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-submit").click();
  });
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.at(-1)?.replies?.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-thread-message").length
  ))).toBe(2);

  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector('button[aria-label="Delete reply by Emily R."]').click();
  });
  await expect.poll(() => page.evaluate(() => {
    const bar = document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-delete-confirm");
    return {
      heading: bar?.querySelector("strong")?.textContent,
      impact: bar?.querySelector("span")?.textContent,
      finalAction: bar?.querySelector(".tm-delete-final")?.textContent.trim(),
      standardToolbarVisible: Boolean(document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-form__actions")),
    };
  })).toEqual({
    heading: "Delete this reply?",
    impact: "Only this reply will be removed. The annotation and 1 other comment stay.",
    finalAction: "Delete reply",
    standardToolbarVisible: false,
  });
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-delete-final").click();
  });
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.at(-1)?.replies?.length)).toBe(0);

  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector('button[aria-label="Delete annotation"]').click();
  });
  await expect.poll(() => page.evaluate(() => {
    const bar = document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-delete-confirm");
    return {
      impact: bar?.querySelector("span")?.textContent,
      finalAction: bar?.querySelector(".tm-delete-final")?.textContent.trim(),
    };
  })).toEqual({ impact: "1 comment and its screenshot will be removed.", finalAction: "Delete annotation" });
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-delete-final").click();
  });
  await expect.poll(() => page.evaluate(() => window.__threadmarkDeletes.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover"),
  ))).toBe(false);
});

test("native text-range dragging still works while host pointer handlers stay blocked", async ({ page }) => {
  await mountPickingFixture(page);
  const bounds = await page.locator("#custom-target").boundingBox();
  await page.mouse.move(bounds.x + 28, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 245, bounds.y + 30, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.getSelection().toString().trim().length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover"),
  ))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__threadmarkHostEvents)).toEqual([]);
});

test("modifier selection creates one ordered multi-target annotation without host activation", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ modifiers: ["Meta", "Shift"] });
  await page.locator("#secondary-target").click({ modifiers: ["Meta", "Shift"] });

  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return shadow?.querySelector(".tm-button--primary")?.textContent.trim();
  })).toBe("Comment 2");
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-button--primary").click();
  });
  await waitForComposer(page);
  await setComposerComment(page, "Treat these controls as one related group.");
  await submitComposer(page);

  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.length)).toBe(1);
  const result = await page.evaluate(() => ({
    feedback: window.__threadmarkFeedback[0],
    hostEvents: window.__threadmarkHostEvents,
  }));
  expect(result.hostEvents).toEqual([]);
  expect(result.feedback.captureKind).toBe("multi");
  expect(result.feedback.targets.map((target) => target.locatorCandidates.stableId)).toEqual([
    "custom-text-control",
    "secondary-action",
  ]);
  expect(result.feedback.comment).toBe("Treat these controls as one related group.");
});

test("dragging empty space captures one region and keeps its approved evidence beside the comment", async ({ page }) => {
  await mountPickingFixture(page);
  const bounds = await page.locator("#region-space").boundingBox();
  const startY = bounds.y + 5;
  const endY = Math.min(bounds.y + bounds.height - 5, 392);
  await page.mouse.move(bounds.x + 32, startY);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 208, endY, { steps: 8 });
  await page.mouse.up();

  await waitForComposer(page);
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot
      .querySelector(".tm-snapshot img")?.complete
  ))).toBe(true);
  // Region snapshots are attached automatically; there is no approval checkbox.
  await expect(page.locator(".tm-snapshot__approval")).toHaveCount(0);
  await setComposerComment(page, "Keep this empty region visually balanced.");
  await submitComposer(page);

  const result = await page.evaluate(() => ({
    feedback: window.__threadmarkFeedback.at(-1),
    evidence: window.__threadmarkFeedbackContexts.at(-1)?.evidence.map((item) => ({
      id: item.id,
      type: item.blob.type,
      size: item.blob.size,
    })),
  }));
  expect(result.feedback.captureKind).toBe("region");
  expect(result.feedback.target.kind).toBe("region");
  expect(result.feedback.comment).toBe("Keep this empty region visually balanced.");
  expect(result.evidence).toHaveLength(1);
  expect(result.evidence[0].type).toMatch(/^image\//);
  expect(result.evidence[0].size).toBeGreaterThan(0);
});

test("toolbar shortcuts pause the page, hide markers, copy feedback, and confirm clear", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost" });
  await mountPickingFixture(page);
  await page.locator("#secondary-target").click();
  await waitForComposer(page);
  await setComposerComment(page, "Lock down the toolbar shortcuts.");
  await submitComposer(page);

  const markerCount = () => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ));
  await expect.poll(markerCount).toBe(1);

  await page.keyboard.press("h");
  await expect.poll(markerCount).toBe(0);
  await page.keyboard.press("h");
  await expect.poll(markerCount).toBe(1);

  await expect(page.locator("#animated-target")).toHaveCSS("animation-play-state", "running");
  await page.keyboard.press("p");
  await expect(page.locator("#animated-target")).toHaveCSS("animation-play-state", "paused");
  await page.keyboard.press("p");
  await expect(page.locator("#animated-target")).toHaveCSS("animation-play-state", "running");

  await page.keyboard.press("c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Lock down the toolbar shortcuts.");

  await page.keyboard.press("x");
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot
      .querySelector('[aria-label="Confirm clear annotations (X)"]'),
  ))).toBe(true);
  await page.keyboard.press("x");
  await expect.poll(markerCount).toBe(0);
});

test("a failed async save keeps the exact draft open and can be retried", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#secondary-target").click();
  await waitForComposer(page);
  await setComposerComment(page, "Do not lose this draft when persistence fails.");
  await page.evaluate(() => { window.__threadmarkRejectNextSave = true; });
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-submit").click();
  });

  await expect.poll(() => page.evaluate(() => ({
    open: Boolean(document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover")),
    value: document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector("#tm-comment")?.value,
    disabled: document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-submit")?.disabled,
    errors: window.__threadmarkErrors.map((item) => item.code),
  }))).toEqual({
    open: true,
    value: "Do not lose this draft when persistence fails.",
    disabled: false,
    errors: ["feedback_submit_failed"],
  });

  await submitComposer(page);
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.length)).toBe(1);
});

test("saved targets re-anchor after replacement and fail visibly when stable IDs become ambiguous", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await setComposerComment(page, "Keep this marker attached after a rerender.");
  await submitComposer(page);
  await page.evaluate(() => {
    window.__threadmarkOriginalPrimary = document.querySelector("#custom-target");
    window.__threadmarkRerenderPrimary();
  });

  await expect.poll(() => page.evaluate(() => ({
    replaced: !window.__threadmarkOriginalPrimary.isConnected,
    markers: document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length,
    warning: Boolean(document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-marker--warning")),
  }))).toEqual({ replaced: true, markers: 1, warning: false });

  await page.evaluate(() => {
    history.pushState({}, "", "/another-route");
    window.__threadmarkRerenderPrimary();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(0);
  await page.evaluate(() => {
    history.pushState({}, "", "/picking-events");
    window.__threadmarkRerenderPrimary();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(1);

  await page.evaluate(() => window.__threadmarkDuplicatePrimary(true));
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return Boolean(shadow?.querySelector('button[aria-label*="need repair"]'));
  })).toBe(true);
  await page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    shadow.querySelector('button[aria-label*="need repair"]').click();
  });
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      title: shadow?.querySelector(".tm-repair-state strong")?.textContent,
      detail: shadow?.querySelector(".tm-repair-state span")?.textContent,
      comment: shadow?.querySelector(".tm-thread-message--root p")?.textContent,
    };
  })).toEqual({
    title: "Target needs repair",
    detail: "More than one live element matches this saved target, so Threadmark will not guess.",
    comment: "Keep this marker attached after a rerender.",
  });

  await page.evaluate(() => window.__threadmarkDuplicatePrimary(false));
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      banner: Boolean(shadow?.querySelector(".tm-repair-state")),
      markers: shadow?.querySelectorAll(".tm-marker").length,
    };
  })).toEqual({ banner: false, markers: 1 });
});

test("remounting after a prop change keeps supplied annotations", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await setComposerComment(page, "Survive a remount.");
  await submitComposer(page);
  const markers = () => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ));
  await expect.poll(markers).toBe(1);
  await page.evaluate(() => window.__threadmarkRemount());
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-launcher"),
  ))).toBe(true);
  await page.evaluate(() => document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-launcher").click());
  await expect.poll(markers).toBe(1);
});

test("a malformed record returned by onFeedbackCreate keeps the local record instead of breaking the overlay", async ({ page }) => {
  await mountPickingFixture(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => { window.__threadmarkAuthoritative = () => ({ feedback: { id: "server-record" } }); });
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await setComposerComment(page, "Host returned something malformed.");
  await submitComposer(page);
  const markers = () => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ));
  await expect.poll(markers).toBe(1);
  expect(errors).toEqual([]);
});

test("fingerprint restoration never re-anchors to a structural look-alike with different content", async ({ page }) => {
  const targetBundle = await bundleFixture(new URL("../../src/target.js", import.meta.url), "ThreadmarkTarget");
  await page.setContent(`<main>
    <ul><li><p>First card</p></li><li><p>Second card</p></li><li><p>Third card</p></li></ul>
    <div id="modal"><button id="delete">Delete</button></div>
  </main>`);
  await page.addScriptTag({ content: targetBundle });
  const result = await page.evaluate(() => {
    const { createTargetDescriptor, restoreTargetDescriptor } = window.ThreadmarkTarget;
    const card = createTargetDescriptor(document.querySelectorAll("li p")[1]);
    const button = createTargetDescriptor(document.querySelector("#delete"));
    const before = restoreTargetDescriptor(card).element?.textContent;
    document.querySelectorAll("li")[1].remove();
    document.querySelector("#delete").replaceWith(Object.assign(document.createElement("button"), { textContent: "Cancel" }));
    return {
      before,
      card: restoreTargetDescriptor(card).status,
      button: restoreTargetDescriptor(button).status,
    };
  });
  expect(result).toEqual({ before: "Second card", card: "missing", button: "missing" });
});

test("building a multi-selection does not capture a snapshot until the composer opens", async ({ page }) => {
  await mountPickingFixture(page);
  await page.evaluate(() => {
    window.__canvasCount = 0;
    const create = document.createElement.bind(document);
    document.createElement = (name, options) => {
      if (String(name).toLowerCase() === "canvas") window.__canvasCount += 1;
      return create(name, options);
    };
  });
  await page.locator("#custom-target").click({ modifiers: ["Meta", "Shift"] });
  await page.locator("#secondary-target").click({ modifiers: ["Meta", "Shift"] });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__canvasCount)).toBe(0);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-button--primary").click();
  });
  await waitForComposer(page);
  await expect.poll(() => page.evaluate(() => window.__canvasCount)).toBeGreaterThan(0);
});

test("a changed element shows a suggested location that the reviewer confirms as a repin", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#secondary-target").click();
  await waitForComposer(page);
  await setComposerComment(page, "Rename this action.");
  await submitComposer(page);
  // A new deployment edits the button's copy and drops its stable ID.
  await page.evaluate(() => {
    const button = document.querySelector("#secondary-target");
    button.removeAttribute("data-threadmark-id");
    button.textContent = "Secondary host action now";
  });
  await expect(page.locator(".tm-marker--suggested")).toHaveCount(1);
  await expect(page.locator(".tm-outline--suggested")).toHaveCount(1);
  await page.locator(".tm-marker--suggested").click();
  await expect(page.locator(".tm-repair-state strong")).toHaveText("This element changed");
  await expect(page.locator(".tm-repair-state span")).toContainText("Now: “Secondary host action now”");
  expect(await page.evaluate(() => window.__threadmarkFeedback.length)).toBe(1);

  await page.getByRole("button", { name: "Confirm location", exact: true }).click();
  await expect(page.locator(".tm-marker--suggested")).toHaveCount(0);
  await expect(page.locator(".tm-repair-state")).toHaveCount(0);
  const moved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(moved.pin.target.visibleText).toBe("Secondary host action now");
  expect(moved.pinHistory).toHaveLength(1);
  expect(moved.target.visibleText).toBe("Secondary host action");
});

test("a removed element's comment stays visible as a ghost at its last known position", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#secondary-target").click();
  await waitForComposer(page);
  await setComposerComment(page, "This button is going away.");
  await submitComposer(page);
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1).target.pageBounds);
  expect(saved.width).toBeGreaterThan(0);
  await page.evaluate(() => window.__threadmarkShowSecondary(false));
  await expect(page.locator(".tm-marker--ghost")).toHaveCount(1);
  const outline = await page.locator(".tm-outline--ghost").boundingBox();
  expect(Math.round(outline.width)).toBe(saved.width);
  await page.locator(".tm-marker--ghost").click();
  await expect(page.locator(".tm-repair-state strong")).toHaveText("Element removed");
  await expect(page.getByRole("button", { name: "Repin comment", exact: true }).first()).toBeVisible();
});

test("a restored multi-target annotation reports partial target loss without shrinking", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ modifiers: ["Meta", "Shift"] });
  await page.locator("#secondary-target").click({ modifiers: ["Meta", "Shift"] });
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-button--primary").click();
  });
  await waitForComposer(page);
  await setComposerComment(page, "Keep both targets in this group.");
  await submitComposer(page);
  await page.evaluate(() => window.__threadmarkShowSecondary(false));

  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return Boolean(shadow?.querySelector(".tm-marker--warning"));
  })).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-marker").click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-repair-state span")?.textContent
  ))).toBe("1 of 2 targets restored. The remaining targets need repair.");

  await page.locator('.tm-repair-state button').click();
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await expect(page.locator('.tm-submit')).toHaveText('Repin comment');
  await expect(page.locator('p[role="status"]', { hasText: 'covers 2 elements' })).toContainText('moves it to the one element you chose');
});

test("typing shortcut letters in the composer does not hide markers and outside dismiss stays isolated", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await setComposerComment(page, "Create a persistent marker.");
  await submitComposer(page);
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(1);

  await page.locator("#secondary-target").click();
  await waitForComposer(page);
  const composer = page.locator("[data-threadmark-root] #tm-comment");
  await composer.click();
  await composer.press("h");

  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      value: shadow?.querySelector("#tm-comment")?.value,
      markers: shadow?.querySelectorAll(".tm-marker").length,
    };
  })).toEqual({ value: "h", markers: 1 });

  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-dismiss-layer").click();
  });
  // A typed draft is never dropped by an outside click; the reviewer confirms first.
  await expect(page.getByText("Discard this comment?", { exact: true })).toBeVisible();
  await expect(composer).toHaveValue("h");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover"),
  ))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__threadmarkHostEvents)).toEqual([]);
});

test("outside dismiss and Escape confirm before discarding a typed draft", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  const composer = page.locator("[data-threadmark-root] #tm-comment");
  const popoverOpen = () => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover"),
  ));
  await setComposerComment(page, "Keep this draft");
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-dismiss-layer").click();
  });
  await expect(page.getByText("Discard this comment?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByText("Discard this comment?", { exact: true })).toHaveCount(0);
  await expect(composer).toHaveValue("Keep this draft");

  await composer.press("Escape");
  await expect(page.getByText("Discard this comment?", { exact: true })).toBeVisible();
  await composer.press("Escape");
  await expect(page.getByText("Discard this comment?", { exact: true })).toHaveCount(0);
  expect(await popoverOpen()).toBe(true);

  await setComposerComment(page, "");
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-dismiss-layer").click();
  });
  await expect.poll(popoverOpen).toBe(false);
});

for (const action of ["Cancel", "Cancel comment"]) {
  test(`${action} confirms before discarding a new comment`, async ({ page }) => {
    await mountPickingFixture(page);
    await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
    await setComposerComment(page, "Keep this explicit-dismiss draft");
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByText("Discard this comment?", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page.locator("#tm-comment")).toHaveValue("Keep this explicit-dismiss draft");
    await page.getByRole("button", { name: action, exact: true }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.locator(".tm-popover")).toHaveCount(0);
    expect(await page.evaluate(() => window.__threadmarkFeedback)).toEqual([]);
  });
}

for (const mode of ["reply", "edit"]) {
  test(`closing a saved thread protects its ${mode} draft`, async ({ page }) => {
    await mountPickingFixture(page);
    await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
    await setComposerComment(page, "Original comment");
    await submitComposer(page);
    await page.locator(".tm-marker").click();
    if (mode === "edit") {
      await page.locator(".tm-thread-message--root .tm-thread-message__menu-toggle").click();
      await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    }
    await setComposerComment(page, "Unposted thread draft");
    await page.getByRole("button", { name: "Cancel comment", exact: true }).click();
    await expect(page.getByText(mode === "edit" ? "Discard your edits?" : "Discard this reply?", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page.locator("#tm-comment")).toHaveValue("Unposted thread draft");
    await page.getByRole("button", { name: "Cancel comment", exact: true }).click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await page.locator(".tm-marker").click();
    await expect(page.locator("#tm-comment")).toHaveValue("");
    await expect(page.locator(".tm-thread-message--root p")).toHaveText("Original comment");
  });
}

test("reply and edit drafts survive mode switches, cancellation, failure and successful edit saves", async ({ page }) => {
  await mountPickingFixture(page);
  await page.locator("#custom-target").click({ position: { x: 80, y: 25 } });
  await setComposerComment(page, "Original comment");
  await submitComposer(page);
  await page.locator(".tm-marker").click();
  const rootMenu = page.locator(".tm-thread-message--root .tm-thread-message__menu-toggle");
  await setComposerComment(page, "Reply draft");
  await rootMenu.click();
  await page.getByRole("menuitem", { name: "Reply", exact: true }).click();
  await expect(page.locator("#tm-comment")).toHaveValue("Reply draft");
  await page.getByRole("button", { name: "Cancel reply", exact: true }).click();
  await expect(page.locator("#tm-comment")).toHaveValue("Reply draft");
  await rootMenu.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await setComposerComment(page, "Cancelled edit");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#tm-comment")).toHaveValue("Reply draft");

  await rootMenu.click();
  await page.getByRole("menuitem", { name: "Reply", exact: true }).click();
  await rootMenu.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await setComposerComment(page, "Saved edit");
  await page.evaluate(() => { window.__threadmarkRejectNextSave = true; });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Feedback wasn’t saved. Try again.", { exact: true })).toBeVisible();
  await expect(page.locator("#tm-comment")).toHaveValue("Saved edit");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".tm-thread-message--root p")).toHaveText("Saved edit");
  await expect(page.locator("#tm-comment")).toHaveValue("Reply draft");
  await expect(page.getByText("Replying to Emily R.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel comment", exact: true }).click();
  await expect(page.getByText("Discard this reply?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.locator(".tm-thread-message--reply p")).toHaveText("Reply draft");

  await rootMenu.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await setComposerComment(page, "Temporarily hidden edit");
  await page.locator(".tm-thread-message--reply .tm-thread-message__menu-toggle").click();
  await page.getByRole("menuitem", { name: "Reply", exact: true }).click();
  await expect(page.locator("#tm-comment")).toHaveValue("");
  await page.getByRole("button", { name: "Cancel comment", exact: true }).click();
  await expect(page.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await setComposerComment(page, "Separate reply");
  await rootMenu.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.locator("#tm-comment")).toHaveValue("Temporarily hidden edit");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#tm-comment")).toHaveValue("Separate reply");
});

test("narrow toolbars keep Feedback, Close and group Comment visible outside scrolling tools", async ({ page }) => {
  await mountPickingFixture(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ["Feedback panel", "Close annotations (Esc)"]) {
      const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.locator("#custom-target").click({ position: { x: 24, y: 25 }, modifiers: ["Meta", "Shift"] });
  await page.locator("#secondary-target").click({ modifiers: ["Meta", "Shift"] });
  for (const name of ["Comment 2", "Feedback panel", "Close annotations (Esc)"]) {
    const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Feedback", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close feedback panel", exact: true }).click();
  await page.getByRole("button", { name: "Close annotations (Esc)", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review page", exact: true })).toBeVisible();
});

test("pencil markup stays aligned to the selected crop and submits one approved Blob sidecar", async ({ page }) => {
  await mountPickingFixture(page);
  await page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    shadow.querySelector('button[aria-label="Select screenshot area to mark up"]').click();
  });

  const target = await page.locator("#custom-target").boundingBox();
  const crop = {
    left: target.x + 12,
    top: target.y + 8,
    right: target.x + target.width - 12,
    bottom: target.y + target.height - 8,
  };
  await page.mouse.move(crop.left, crop.top);
  await page.mouse.down();
  await page.mouse.move(crop.right, crop.bottom, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-canvas img"),
  ))).toBe(true);
  const alignment = await page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    const canvas = shadow.querySelector(".tm-markup-canvas").getBoundingClientRect();
    return { left: canvas.left, top: canvas.top, right: canvas.right, bottom: canvas.bottom };
  });
  expect(alignment.left).toBeCloseTo(crop.left, 0);
  expect(alignment.top).toBeCloseTo(crop.top, 0);
  expect(alignment.right).toBeCloseTo(crop.right, 0);
  expect(alignment.bottom).toBeCloseTo(crop.bottom, 0);

  const drawingSurface = await page.evaluate(() => {
    const bounds = document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector('.tm-markup-canvas svg[aria-label="Screenshot drawing canvas"]')
      .getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  await page.mouse.move(drawingSurface.x + 18, drawingSurface.y + 16);
  await page.mouse.down();
  await page.mouse.move(
    drawingSurface.x + drawingSurface.width - 18,
    drawingSurface.y + drawingSurface.height - 16,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => {
    const line = document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-canvas polyline");
    return line?.getAttribute("points")?.split(" ").length || 0;
  })).toBeGreaterThan(2);

  await page.evaluate(() => {
    const buttons = [...document.querySelector("[data-threadmark-root]").shadowRoot.querySelectorAll("button")];
    buttons.find((button) => button.textContent.includes("Use screenshot")).click();
  });
  await waitForComposer(page);
  await setComposerComment(page, "Use the marked-up crop as visual evidence.");
  await submitComposer(page);

  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.length)).toBe(1);
  const result = await page.evaluate(() => {
    const feedback = window.__threadmarkFeedback[0];
    const context = window.__threadmarkFeedbackContexts[0];
    const evidence = context.evidence[0];
    return {
      captureKind: feedback.captureKind,
      targetKind: feedback.target.kind,
      comment: feedback.comment,
      metadata: feedback.evidence[0],
      contextEvidenceCount: context.evidence.length,
      blob: {
        size: evidence.blob.size,
        type: evidence.blob.type,
      },
    };
  });
  expect(result.captureKind).toBe("screenshot");
  expect(result.targetKind).toBe("screenshot");
  expect(result.comment).toBe("Use the marked-up crop as visual evidence.");
  expect(result.contextEvidenceCount).toBe(1);
  expect(result.metadata.byteSize).toBe(result.blob.size);
  expect(result.metadata.mimeType).toBe(result.blob.type);
  expect(result.blob.size).toBeGreaterThan(0);
});

test("pencil tools change pen style, undo, clear, and cancel without creating feedback", async ({ page }) => {
  await mountPickingFixture(page);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector('button[aria-label="Select screenshot area to mark up"]').click();
  });

  const target = await page.locator("#custom-target").boundingBox();
  await page.mouse.move(target.x + 16, target.y + 12);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width - 16, target.y + target.height - 12, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-canvas img"),
  ))).toBe(true);

  await page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    shadow.querySelector('button[aria-label="Coral pen"]').click();
    shadow.querySelector('button[aria-label="Bold pen thickness"]').click();
  });
  const drawingSurface = await page.evaluate(() => {
    const rect = document.querySelector("[data-threadmark-root]").shadowRoot
      .querySelector('.tm-markup-canvas svg[aria-label="Screenshot drawing canvas"]')
      .getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const drawStroke = async (offset = 0) => {
    await page.mouse.move(drawingSurface.x + 20, drawingSurface.y + 18 + offset);
    await page.mouse.down();
    await page.mouse.move(drawingSurface.x + drawingSurface.width - 20, drawingSurface.y + 24 + offset, { steps: 6 });
    await page.mouse.up();
  };
  await drawStroke();
  await expect.poll(() => page.evaluate(() => {
    const line = document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-canvas polyline");
    return line ? { stroke: line.getAttribute("stroke"), width: Number(line.getAttribute("stroke-width")) } : null;
  })).toEqual({ stroke: "#e5483c", width: expect.any(Number) });

  await page.evaluate(() => {
    const buttons = [...document.querySelector("[data-threadmark-root]").shadowRoot.querySelectorAll("button")];
    buttons.find((button) => button.textContent.trim() === "Undo").click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-markup-canvas polyline").length
  ))).toBe(0);

  await drawStroke(8);
  await page.evaluate(() => {
    const buttons = [...document.querySelector("[data-threadmark-root]").shadowRoot.querySelectorAll("button")];
    buttons.find((button) => button.textContent.trim() === "Clear").click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-markup-canvas polyline").length
  ))).toBe(0);

  await page.evaluate(() => {
    const buttons = [...document.querySelector("[data-threadmark-root]").shadowRoot.querySelectorAll("button")];
    buttons.find((button) => button.textContent.trim() === "Cancel").click();
  });
  await expect.poll(() => page.evaluate(() => ({
    markupOpen: Boolean(document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-overlay")),
    toolbarOpen: Boolean(document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-modebar")),
    feedbackCount: window.__threadmarkFeedback.length,
  }))).toEqual({ markupOpen: false, toolbarOpen: true, feedbackCount: 0 });
});

test("reopening a screenshot annotation restores its approved preview", async ({ page }) => {
  await mountPickingFixture(page);
  await page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    shadow.querySelector('button[aria-label="Select screenshot area to mark up"]').click();
  });

  const target = await page.locator("#custom-target").boundingBox();
  await page.mouse.move(target.x + 10, target.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width - 10, target.y + target.height - 10, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-editor, .tm-markup-overlay"),
  ))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-canvas img"),
  ))).toBe(true);
  await page.evaluate(() => {
    const buttons = [...document.querySelector("[data-threadmark-root]").shadowRoot.querySelectorAll("button")];
    buttons.find((button) => button.textContent.includes("Use screenshot")).click();
  });

  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover .tm-snapshot img"),
  ))).toBe(true);
  await setComposerComment(page, "Keep this screenshot visible when reopened.");
  await submitComposer(page);

  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(1);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-marker").click();
  });

  await expect.poll(() => page.evaluate(() => {
    const image = document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-popover .tm-snapshot img");
    return Boolean(image?.src?.startsWith("blob:"));
  })).toBe(true);
});

test("persisted screenshot annotations survive reload, edit, and delete", async ({ page }) => {
  await mountPersistentPickingFixture(page);
  await page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    shadow.querySelector('button[aria-label="Select screenshot area to mark up"]').click();
  });

  const target = await page.locator("#custom-target").boundingBox();
  await page.mouse.move(target.x + 10, target.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width - 10, target.y + target.height - 10, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-markup-canvas img"),
  ))).toBe(true);
  await page.evaluate(() => {
    const buttons = [...document.querySelector("[data-threadmark-root]").shadowRoot.querySelectorAll("button")];
    buttons.find((button) => button.textContent.includes("Use screenshot")).click();
  });
  await waitForComposer(page);
  await setComposerComment(page, "Persist this screenshot across reloads.");
  await submitComposer(page);

  await page.reload({ waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-launcher").click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(1);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-marker").click();
  });
  await expect.poll(() => page.evaluate(() => ({
    comment: document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-thread-message--root p")?.textContent,
    preview: document.querySelector("[data-threadmark-root]")?.shadowRoot
      .querySelector(".tm-popover .tm-snapshot img")?.src?.startsWith("blob:"),
  }))).toEqual({ comment: "Persist this screenshot across reloads.", preview: true });

  await editOriginalComment(page, "Updated after restoring the screenshot.");
  await page.reload({ waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-launcher").click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(1);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-marker").click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-thread-message--root p")?.textContent
  ))).toBe("Updated after restoring the screenshot.");

  await page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]").shadowRoot;
    shadow.querySelector('button[aria-label="Delete annotation"]').click();
  });
  await expect.poll(() => page.evaluate(() => Boolean(
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelector(".tm-delete-final"),
  ))).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-delete-final").click();
  });
  await expect.poll(() => page.evaluate(() => window.__threadmarkDeletes.length)).toBe(1);
  await page.reload({ waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.evaluate(() => {
    document.querySelector("[data-threadmark-root]").shadowRoot.querySelector(".tm-launcher").click();
  });
  await expect.poll(() => page.evaluate(() => (
    document.querySelector("[data-threadmark-root]")?.shadowRoot.querySelectorAll(".tm-marker").length
  ))).toBe(0);
});

test("persisted text ranges restore and an annotation deep link opens the exact comment", async ({ page }) => {
  await mountPersistentPickingFixture(page);
  const bounds = await page.locator("#custom-target").boundingBox();
  await page.mouse.move(bounds.x + 28, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 245, bounds.y + 30, { steps: 8 });
  await page.mouse.up();
  await waitForComposer(page);
  await setComposerComment(page, "Restore this exact text annotation from its link.");
  await submitComposer(page);
  const feedbackId = await page.evaluate(() => window.__threadmarkFeedback[0].id);
  await page.evaluate((id) => {
    const url = new URL(window.location.href);
    url.searchParams.set("threadmark", id);
    history.replaceState({}, "", url);
  }, feedbackId);

  await page.reload({ waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const shadow = document.querySelector("[data-threadmark-root]")?.shadowRoot;
    return {
      comment: shadow?.querySelector(".tm-thread-message--root p")?.textContent,
      markers: shadow?.querySelectorAll(".tm-marker").length,
      repair: Boolean(shadow?.querySelector(".tm-repair-state")),
    };
  })).toEqual({
    comment: "Restore this exact text annotation from its link.",
    markers: 1,
    repair: false,
  });
});

function closeTo(actual, expected, tolerance = 18) {
  return expected.every((channel, index) => Math.abs(actual[index] - channel) <= tolerance);
}

test("renders public content while masking every configured privacy boundary", async ({ page }) => {
  await page.setContent(fixtureHtml, { waitUntil: "load" });
  await page.addScriptTag({ content: fixtureBundle });
  await page.waitForFunction(() => typeof window.runPrivacyCapture === "function");

  const result = await page.evaluate(() => window.runPrivacyCapture());

  expect(closeTo(result.pixels.public, [255, 214, 0])).toBe(true);
  for (const key of ["input", "sensitive", "ignored", "iframe", "canvas"]) {
    expect(closeTo(result.pixels[key], MASK), `${key} should be covered by the opaque mask`).toBe(true);
  }
  expect(closeTo(result.pixels.shadow, [255, 64, 64])).toBe(false);
  expect(result.fetches.some((url) => url.includes("cross-origin.invalid"))).toBe(false);
  expect(result.metadata.redactionCount).toBeGreaterThanOrEqual(5);
  expect(result.metadata.warnings).toContain("embedded_content_masked");
  expect(result.metadata.warnings).toContain("cross_origin_asset_omitted");
});

test("keeps a selected crop aligned after the page scrolls", async ({ page }) => {
  await page.setContent(fixtureHtml, { waitUntil: "load" });
  await page.addScriptTag({ content: fixtureBundle });
  await page.waitForFunction(() => typeof window.runOffsetCapture === "function");

  const result = await page.evaluate(() => window.runOffsetCapture());

  expect(result.scrollY).toBeGreaterThan(0);
  expect(result.rect.top).toBeGreaterThanOrEqual(0);
  expect(closeTo(result.pixel, [249, 115, 22]), JSON.stringify(result)).toBe(true);
});

test("preserves the host page's loaded web font in captured text", async ({ page }) => {
  await page.setContent(fixtureHtml, { waitUntil: "load" });
  await page.addScriptTag({ content: fixtureBundle });
  await page.evaluate(() => document.fonts.load('600 48px "Snapshot Brand"'));
  const reference = await page.locator("#font-sample").screenshot();
  const captured = await page.evaluate(() => window.runFontCapture());
  const similarity = await page.evaluate(async ({ referenceData, capturedData }) => {
    const decode = async (url) => {
      const bitmap = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const referencePixels = await decode(referenceData);
    const capturedPixels = await decode(capturedData);
    let matching = 0;
    let ink = 0;
    for (let index = 0; index < referencePixels.length; index += 4) {
      const inReference = referencePixels[index] < 140;
      const inCapture = capturedPixels[index] < 140;
      if (inReference || inCapture) {
        ink += 1;
        if (inReference === inCapture) matching += 1;
      }
    }
    return matching / ink;
  }, { referenceData: `data:image/png;base64,${reference.toString("base64")}`, capturedData: captured });
  expect(similarity).toBeGreaterThan(0.8);
});

test("ordinary comments keep screenshots and repin history through failure, cancellation and reload", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await mountPersistentPickingFixture(page);
  await page.locator("#secondary-target").click();
  await waitForComposer(page);
  await setComposerComment(page, "Keep the original evidence when this button moves.");
  // The masked screenshot is captured in the background; Post stays disabled until it is ready.
  await expect(page.locator('.tm-submit')).toHaveText('Post');
  expect(await page.evaluate(() => window.__threadmarkFeedback.length)).toBe(0);
  await submitComposer(page);
  const original = await page.evaluate(() => window.__threadmarkFeedback[0]);
  expect(original.evidence[0].quality).not.toBe("unavailable");
  expect(original.evidence[0].capture.buildId).toBe("fixture-build-current");
  expect(await page.evaluate(() => window.__threadmarkFeedbackContexts[0].evidence[0].blob.size)).toBe(original.evidence[0].byteSize);

  // Simulate a deployment removing the old element. The thread and evidence remain accessible.
  await page.evaluate(() => window.__threadmarkShowSecondary(false));
  await page.locator('button[aria-label*="need repair"]').click();
  await expect(page.locator('.tm-repair-state')).toBeVisible();
  await expect(page.locator('.tm-snapshot img')).toBeVisible();
  await page.locator('.tm-repair-state button').click();
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await expect(page.locator('.tm-submit')).toHaveText('Repin comment');
  await page.locator('.tm-cancel').click();
  expect(await page.evaluate(() => window.__threadmarkFeedback.length)).toBe(1);

  await page.locator('button[aria-label*="need repair"]').click();
  await page.locator('.tm-repair-state button').click();
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await page.evaluate(() => { window.__threadmarkRejectNextSave = true; });
  await page.locator('.tm-submit').click();
  await expect(page.locator('.tm-toast')).toContainText('wasn’t saved');
  expect(await page.evaluate(() => window.__threadmarkFeedback.length)).toBe(1);
  await page.locator('.tm-submit').click();
  await expect(page.locator('.tm-repair-state')).toHaveCount(0);
  await expect(page.locator('.tm-thread-message--root p')).toHaveText(original.comment);
  const moved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(moved.id).toBe(original.id);
  expect(moved.target).toEqual(original.target);
  expect(moved.evidence).toEqual(original.evidence);
  expect(moved.createdAt).toBe(original.createdAt);
  expect(moved.author).toEqual(original.author);
  expect(moved.pin.target.locatorCandidates.stableId).toBe('custom-text-control');
  expect(moved.pinHistory).toHaveLength(1);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.locator('.tm-launcher').click();
  await page.locator('.tm-marker').click();
  await expect(page.locator('.tm-snapshot img')).toBeVisible();
  await expect(page.locator('.tm-repair-state')).toHaveCount(0);
  await expect(page.locator('summary').filter({ hasText: 'Pin location history' })).toBeVisible();
  await editOriginalComment(page, 'Edited after repinning');
  const edited = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(edited.pin).toEqual(moved.pin);
  expect(edited.evidence).toEqual(original.evidence);
  expect(await page.evaluate(() => window.__threadmarkFeedbackContexts.at(-1).evidence[0].blob.size)).toBe(original.evidence[0].byteSize);
});

test("ordinary comments always attach their masked screenshot without showing a preview or approval", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await mountPickingFixture(page);
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await expect(page.locator('.tm-popover .tm-snapshot')).toHaveCount(0);
  await expect(page.locator('.tm-snapshot__approval')).toHaveCount(0);
  await setComposerComment(page, 'Screenshot comes along automatically');
  await submitComposer(page);
  const evidence = await page.evaluate(() => window.__threadmarkFeedbackContexts[0].evidence);
  expect(evidence).toHaveLength(1);
  expect(await page.evaluate(() => window.__threadmarkFeedback[0].evidence[0].quality)).toBe('captured');
});

test("capture failure leaves a postable comment and a persistent unavailable state", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await mountPickingFixture(page);
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); };
  });
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await waitForComposer(page);
  await setComposerComment(page, 'Preserve this even if the screenshot fails');
  await submitComposer(page);
  expect(await page.evaluate(() => window.__threadmarkFeedback[0].evidence[0].quality)).toBe('unavailable');
  expect(await page.evaluate(() => window.__threadmarkFeedbackContexts[0].evidence)).toEqual([]);
  await page.locator('.tm-marker').click();
  await expect(page.locator('.tm-snapshot__state--error')).toBeVisible();
});

test("a region pin needs repair on a new build and repinning retains its original evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await mountPickingFixture(page);
  const box = await page.locator('#region-space').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 80, { steps: 8 });
  await page.mouse.up();
  await waitForComposer(page);
  await expect(page.locator('.tm-snapshot img')).toBeVisible();
  await setComposerComment(page, 'Original region on build one');
  await submitComposer(page);
  const original = await page.evaluate(() => window.__threadmarkFeedback[0]);
  expect(original.captureKind).toBe('region');
  await page.evaluate(() => window.__threadmarkSetBuild('fixture-build-next'));
  await page.locator('button[aria-label*="need repair"]').click();
  await page.locator('.tm-repair-state button').click();
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await page.locator('.tm-submit').click();
  await expect(page.locator('.tm-repair-state')).toHaveCount(0);
  const moved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(moved.buildId).toBe('fixture-build-current');
  expect(moved.pin.buildId).toBe('fixture-build-next');
  expect(moved.target).toEqual(original.target);
  expect(moved.evidence).toEqual(original.evidence);
});

test("all comments lists saved threads, filters, and opens missing targets without losing the list", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await mountPickingFixture(page);
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Feedback' })).toBeVisible();
  await expect(page.getByText('No comments yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close feedback panel', exact: true }).click();
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await setComposerComment(page, 'Heading needs clearer wording');
  await submitComposer(page);
  await page.locator('#secondary-target').click();
  await setComposerComment(page, 'Button needs contrast');
  await submitComposer(page);
  await page.evaluate(() => window.__threadmarkShowSecondary(false));
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Feedback' });
  await expect(panel.locator('.tm-comment-card')).toHaveCount(2);
  await expect(panel.getByAltText('Saved screenshot')).toHaveCount(2);
  await expect(panel.getByRole('textbox', { name: 'Search comments' })).toHaveCount(0);
  await expect(panel.getByRole('combobox')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Show search comments', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Search comments' }).fill('wording');
  await expect(panel.locator('.tm-comment-card')).toHaveCount(1);
  await panel.getByRole('textbox', { name: 'Search comments' }).fill('no match');
  await expect(panel.getByText('No matching comments', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await panel.getByRole('button', { name: 'Show comment filters', exact: true }).click();
  await panel.getByRole('button', { name: 'More filters', exact: true }).click();
  await panel.getByRole('combobox', { name: 'Filter comments by reviewer' }).selectOption('fixture_reviewer');
  await panel.getByRole('combobox', { name: 'Filter comments by target' }).selectOption('repair');
  await expect(panel.locator('.tm-comment-card')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await panel.getByRole('button', { name: 'Open comment 2: Button needs contrast', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('.tm-repair-state')).toBeVisible();
  await expect(page.locator('.tm-snapshot img')).toBeVisible();
  // Closing a thread opened from the Feedback panel returns to the same filtered list.
  await page.getByRole('button', { name: 'Cancel comment', exact: true }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /^Show comment filters/ }).click();
  await expect(panel.getByRole('button', { name: 'Needs target repair', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('dialog', { name: 'Comment filters' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Threadmark annotation tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Feedback panel', exact: true })).toBeFocused();
});

test("comment filters float over the list, retain search, and dismiss accessibly", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await mountPickingFixture(page);
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await setComposerComment(page, 'Local issue');
  await submitComposer(page);
  await page.evaluate(() => {
    const feedback = window.__threadmarkFeedback[0];
    window.__threadmarkSetRecords([
      { feedback, context: window.__threadmarkFeedbackContexts[0] },
      { feedback: { ...feedback, id: 'other-reviewer', comment: 'Other reviewer issue', author: { id: 'other', displayName: 'Other reviewer' } } },
      { feedback: { ...feedback, id: 'other-page', comment: 'Other page issue', route: '/other' } },
      { feedback: { ...feedback, id: 'resolved', comment: 'Resolved issue', workflow: { status: 'resolved' } } },
    ]);
  });
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Feedback', exact: true });
  await expect(panel.locator('.tm-comment-card')).toHaveCount(4);
  await panel.getByRole('button', { name: 'Show search comments', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Search comments' }).fill('issue');
  const listBefore = await panel.locator('.tm-comments-list').boundingBox();
  await panel.getByRole('button', { name: 'Show comment filters', exact: true }).click();
  const popup = panel.getByRole('dialog', { name: 'Comment filters', exact: true });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Show resolved comments', exact: true })).toBeFocused();
  await expect(panel.getByRole('textbox', { name: 'Search comments' })).toBeVisible();
  const listAfter = await panel.locator('.tm-comments-list').boundingBox();
  expect(listAfter.y).toBe(listBefore.y);
  expect(listAfter.height).toBe(listBefore.height);
  await expect(popup.getByRole('combobox')).toHaveCount(0);
  await popup.getByRole('button', { name: 'Show resolved comments', exact: true }).click();
  await expect(panel.locator('.tm-comment-card')).toHaveCount(3);
  await popup.getByRole('button', { name: 'Only your threads', exact: true }).click();
  await expect(panel.locator('.tm-comment-card')).toHaveCount(2);
  await popup.getByRole('button', { name: 'Only current page', exact: true }).click();
  await expect(panel.locator('.tm-comment-card')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /^Show comment filters/ })).toBeFocused();
  await expect(panel.getByRole('textbox', { name: 'Search comments' })).toHaveValue('issue');
  await panel.getByRole('button', { name: /^Show comment filters/ }).click();
  await expect(popup.getByRole('button', { name: 'Only your threads', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('heading', { name: 'Feedback', exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(panel.locator('.tm-comment-card')).toHaveCount(1);
  await panel.getByRole('button', { name: /^Show comment filters/ }).click();
  await popup.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(panel.locator('.tm-comment-card')).toHaveCount(4);
  await page.setViewportSize({ width: 320, height: 480 });
  await popup.getByRole('button', { name: 'More filters', exact: true }).click();
  await expect(popup.getByRole('combobox')).toHaveCount(5);
  const popupBounds = await popup.boundingBox();
  const panelBounds = await panel.boundingBox();
  expect(popupBounds.x).toBeGreaterThanOrEqual(panelBounds.x);
  expect(popupBounds.x + popupBounds.width).toBeLessThanOrEqual(panelBounds.x + panelBounds.width);
  expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(panelBounds.y + panelBounds.height);
  await panel.getByRole('tab', { name: /^Versions/ }).focus();
  await expect(popup).toHaveCount(0);
  await panel.getByRole('tab', { name: /^Versions/ }).click();
  await expect(popup).toHaveCount(0);
  await panel.getByRole('tab', { name: /^Comments/ }).click();
  await expect(popup).toHaveCount(0);
});

test("deployment comparison brings an off-screen target into view before capturing it", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await mountPickingFixture(page);
  await page.evaluate(() => { document.body.style.paddingBottom = "3000px"; });
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await setComposerComment(page, 'Compare after scrolling'); await submitComposer(page);
  await page.locator('.tm-marker').click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const offscreen = await page.evaluate(() => document.querySelector('#custom-target').getBoundingClientRect().bottom < 0);
  expect(offscreen).toBe(true);
  await page.getByRole('button', { name: 'More thread actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Compare with current page', exact: true }).click();
  await expect(page.getByAltText('Current deployment', { exact: true })).toBeVisible();
  const visible = await page.evaluate(() => {
    const rect = document.querySelector('#custom-target').getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  expect(visible).toBe(true);
  const comparison = page.getByRole("dialog", { name: "Deployment comparison", exact: true });
  const close = comparison.getByRole("button", { name: "Close comparison", exact: true });
  const recapture = comparison.getByRole("button", { name: "Recapture", exact: true });
  const verify = comparison.getByRole("button", { name: "Mark fix verified", exact: true });
  await expect(close).toBeFocused();
  expect(await page.locator("#root").evaluate((element) => element.inert)).toBe(true);
  expect(await page.locator(".tm-popover").evaluate((element) => element.inert)).toBe(true);
  await verify.focus();
  await verify.press("Tab");
  await expect(recapture).toBeFocused();
  await recapture.press("Shift+Tab");
  await expect(verify).toBeFocused();
  await verify.press("Escape");
  await expect(comparison).toHaveCount(0);
  expect(await page.locator("#root").evaluate((element) => element.inert)).toBe(false);
  expect(await page.locator(".tm-popover").evaluate((element) => element.inert)).toBe(false);
  await expect(page.getByRole("button", { name: "More thread actions", exact: true })).toBeFocused();
});

test("workflow controls preserve evidence through inline mention, verification, resolution and reopening", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1100 });
  await mountPickingFixture(page);
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await setComposerComment(page, 'Verify this before resolving'); await submitComposer(page);
  const original = await page.evaluate(() => window.__threadmarkFeedback[0]);
  await page.locator('.tm-marker').click();
  // Reviewers are mentioned inline by typing "@" in the reply field and choosing a suggestion.
  const reply = page.locator('#tm-comment');
  await reply.click();
  await reply.pressSequentially('Can you check this @Sa');
  await expect(page.getByRole('option', { name: 'Sam Okafor' })).toBeVisible();
  await reply.press('Enter');
  await expect(reply).toHaveValue('Can you check this @Sam Okafor ');
  await reply.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.at(-1).workflow.mentions[0]?.id)).toBe('sam');
  expect(await page.evaluate(() => window.__threadmarkFeedback.at(-1).replies.at(-1).comment)).toBe('Can you check this @Sam Okafor');
  await page.getByRole('button', { name: 'More thread actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Compare with current page', exact: true }).click();
  await expect(page.getByAltText('Current deployment', { exact: true })).toBeVisible();
  await expect(page.getByAltText('Original deployment', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark fix verified', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedback.at(-1).workflow.history.at(-1).action)).toBe('verified');
  expect(await page.evaluate(() => window.__threadmarkFeedback.at(-1).workflow.status)).toBe('open');
  await page.getByRole('button', { name: 'Resolve comment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reopen comment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel comment', exact: true }).click();
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  await page.getByRole('button', { name: 'Show comment filters', exact: true }).click();
  await page.getByRole('button', { name: 'More filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter comments by status' }).selectOption('open');
  await expect(page.locator('.tm-comment-card')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Filter comments by status' }).selectOption('resolved');
  await page.keyboard.press('Escape');
  await page.locator('.tm-comment-card').click();
  await page.getByRole('button', { name: 'Reopen comment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resolve comment', exact: true })).toBeVisible();
  const latest = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(latest.evidence).toEqual(original.evidence);
  expect(latest.workflow.history.at(-1).actor.id).toBe('fixture_reviewer');
  expect(latest.workflow.mentions.map((member) => member.id)).toEqual(['sam']);
});

test("project comments include authorized supplied pages, filter deployments and navigate to the exact thread", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await mountPickingFixture(page);
  await page.locator('#custom-target').click({ position: { x: 80, y: 25 } });
  await setComposerComment(page, 'On this page'); await submitComposer(page);
  await page.evaluate(() => {
    const feedback = window.__threadmarkFeedback[0];
    window.__threadmarkSetRecords([{ feedback, context: window.__threadmarkFeedbackContexts[0] },
      { feedback: { ...feedback, id: 'other-page', route: '/other', buildId: 'next-build', comment: 'Another page' } },
      { feedback: { ...feedback, id: 'foreign', projectKey: 'foreign-project', route: '/private', comment: 'Do not show' } }]);
  });
  await page.getByRole('button', { name: 'Feedback panel', exact: true }).click();
  await expect(page.locator('.tm-comment-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Show comment filters', exact: true }).click();
  await page.getByRole('button', { name: 'More filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter comments by deployment' }).selectOption('next-build');
  await expect(page.locator('.tm-comment-card')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.locator('.tm-comment-card').click();
  await expect(page).toHaveURL('http://localhost/other?threadmark=other-page');
});
