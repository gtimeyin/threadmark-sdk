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
      lib: {
        entry: fileURLToPath(new URL("../fixtures/picking-events.jsx", import.meta.url)),
        formats: ["iife"],
        name: "ThreadmarkComposerFixture",
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  pickingBundle = output.find((item) => item.type === "chunk")?.code;
  if (!pickingBundle) throw new Error("The composer fixture did not produce a browser bundle.");
});

// Real camera, microphone, and tab pickers cannot run headless; canvas and oscillator streams stand in
// for them so MediaRecorder still encodes genuine media.
async function stubMediaDevices(page) {
  await page.addInitScript(() => {
    const canvasStream = (color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext("2d");
      let frame = 0;
      setInterval(() => {
        context.fillStyle = color;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#ffffff";
        context.fillText(String(frame += 1), 12, 24);
      }, 33);
      return canvas.captureStream(30);
    };
    const audioTrack = () => {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const destination = audio.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      return destination.stream.getAudioTracks()[0];
    };
    window.__mediaRequests = [];
    window.__mediaStreams = [];
    window.__declineTab = false;
    const remember = (stream) => {
      window.__mediaStreams.push(stream);
      return stream;
    };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__mediaRequests.push({ kind: "user", video: Boolean(constraints.video), audio: Boolean(constraints.audio) });
      const tracks = [];
      if (constraints.video) tracks.push(...canvasStream("#0b4f3a").getVideoTracks());
      if (constraints.audio) tracks.push(audioTrack());
      return remember(new MediaStream(tracks));
    };
    navigator.mediaDevices.getDisplayMedia = async (constraints) => {
      window.__mediaRequests.push({
        kind: "display",
        preferCurrentTab: constraints.preferCurrentTab,
        displaySurface: constraints.video?.displaySurface,
        audio: constraints.audio,
      });
      if (window.__declineTab) throw new DOMException("The reviewer declined.", "NotAllowedError");
      return remember(canvasStream("#e5483c"));
    };
    navigator.mediaDevices.enumerateDevices = async () => [
      { kind: "videoinput", deviceId: "camera-1", label: "Fixture Camera", groupId: "a" },
      { kind: "audioinput", deviceId: "mic-1", label: "Fixture Microphone", groupId: "b" },
    ];
  });
}

async function mountFixture(page, query = "persist=1") {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubMediaDevices(page);
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
  await page.goto(`http://localhost/picking-events?${query}`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.locator(".tm-launcher").click();
  return pageErrors;
}

// Pointer samples are taken at most every 50ms, so move at a human pace rather than in one burst.
async function tracePointer(page, points) {
  for (const [x, y] of points) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(70);
  }
}

async function openVideoSetup(page) {
  await page.getByRole("button", { name: "Feedback tools: Comment" }).click();
  await page.getByRole("menuitemradio", { name: /^Record a video/ }).click();
  await expect(page.locator(".tm-video-setup")).toBeVisible();
  await expect(page.locator(".tm-video-start")).toBeEnabled();
}

async function allCapturedTracksEnded(page) {
  return page.evaluate(() => window.__mediaStreams
    .flatMap((stream) => stream.getTracks())
    .every((track) => track.readyState === "ended"));
}

async function setComment(page, comment) {
  await page.evaluate((value) => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, comment);
}

// Stop opens the review (board 02, 7e); Post turns it into a comment and opens its thread.
async function postFromReview(page, title) {
  const review = page.locator(".tm-video-review");
  await expect(review).toBeVisible();
  if (title) {
    await page.locator(".tm-video-review__title").click();
    await page.getByRole("textbox", { name: "Video title" }).fill(title);
    await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: /^Post video/ }).click();
  await expect(review).toHaveCount(0);
  await expect(page.locator(".tm-popover--thread .tm-video-preview")).toBeVisible();
}

async function submitComposer(page) {
  await expect(page.locator(".tm-submit")).toBeEnabled();
  await page.locator(".tm-submit").click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);
}

// Board 01, 2c-2d; board 05, 18c; board 07, 23d.
test("the composer is one quiet card: Esc, @, + and a Lime send; ↵ posts, Shift+↵ adds a line, and the bar says what is happening", async ({ page }) => {
  const pageErrors = await mountFixture(page, "");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("#secondary-target").click();
  const composer = page.locator(".tm-popover--compose");
  await expect(composer).toBeVisible();
  await expect(composer.locator(".tm-composer__target")).toContainText("Secondary host action");
  await expect(composer.getByRole("button", { name: "Cancel comment" })).toContainText("Esc");
  await expect(page.locator(".tm-modebar--writing")).toContainText("Writing a comment");

  // Typing fast past the end of the first line used to drop a key (an effect re-rendered on every key).
  const field = page.locator("#tm-comment");
  await field.pressSequentially("Could this say Start for free? It feels more welcoming.");
  await page.keyboard.press("Shift+Enter");
  await field.pressSequentially("Second line.");
  await expect(field).toHaveValue("Could this say Start for free? It feels more welcoming.\nSecond line.");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Comment added");
  await expect(page.locator(".tm-modebar--writing")).toHaveCount(0);
  expect(await page.evaluate(() => window.__threadmarkFeedback.at(-1).comment)).toBe("Could this say Start for free? It feels more welcoming.\nSecond line.");
  expect(pageErrors).toEqual([]);
});

test("a thread opened from the panel opens in the panel, with a way back to the list", async ({ page }) => {
  await mountFixture(page, "");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("#secondary-target").click();
  await page.locator("#tm-comment").fill("Docked thread");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Comment added");

  await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  await page.locator(".tm-comments-list li").first().click();
  const thread = page.locator(".tm-popover--docked");
  await expect(thread).toBeVisible();
  const box = await thread.boundingBox();
  expect(Math.round(box.x + box.width)).toBeGreaterThanOrEqual(1270);
  await expect(thread.locator(".tm-thread-back")).toContainText("Secondary host action");
  await thread.getByRole("button", { name: "All comments" }).click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  await expect(page.locator("#tm-all-comments")).toBeVisible();
  await expect(page.locator("#tm-all-comments")).toContainText("Docked thread");
});

test("deleting a comment nobody replied to is instant, and Undo creates it again", async ({ page }) => {
  await mountFixture(page, "");
  await page.locator("#secondary-target").click();
  await page.locator("#tm-comment").fill("Delete me, then bring me back");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Comment added");
  await page.locator(".tm-marker").first().click();
  await page.getByRole("button", { name: "Actions for comment by Emily R." }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.locator(".tm-delete-confirm")).toHaveCount(0);
  await expect(page.locator(".tm-toast")).toContainText("Comment deleted");
  await expect(page.locator(".tm-marker")).toHaveCount(0);
  const created = await page.evaluate(() => window.__threadmarkFeedback.length);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".tm-toast")).toContainText("Comment restored");
  await expect(page.locator(".tm-marker")).toHaveCount(1);
  const restored = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(await page.evaluate(() => window.__threadmarkFeedback.length)).toBe(created + 1);
  expect(restored.comment).toBe("Delete me, then bring me back");
});

test("the Inbox shows Unread or All, grouped by day; opening an item and Mark all read clear it", async ({ page }) => {
  const pageErrors = await mountFixture(page, "inbox=1");
  await page.setViewportSize({ width: 1280, height: 800 });
  const panel = page.locator("#tm-all-comments");
  await page.waitForTimeout(300);
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();

  const views = panel.getByRole("radiogroup", { name: "Show" });
  await expect(views.getByRole("radio", { name: /Unread/ })).toHaveAttribute("aria-checked", "true");
  await expect(views.getByRole("radio", { name: /Unread/ })).toContainText("3");
  await expect(panel.locator(".tm-inbox-group")).toHaveCount(1);
  await expect(panel.locator(".tm-inbox-group h3")).toHaveText("Today");
  await expect(panel.locator(".tm-inbox-item").filter({ hasText: "Maya mentioned you" })).toContainText("/signup · Field · Company");
  await expect(panel.locator(".tm-inbox-item").filter({ hasText: "Sam replied to your comment" })).toBeVisible();
  // Maya's face comes from the project's members.
  await expect(panel.locator(".tm-inbox-item").filter({ hasText: "Maya" }).locator("img")).toHaveCount(1);

  await views.getByRole("radio", { name: "All" }).click();
  await expect(panel.locator(".tm-inbox-group h3")).toHaveText(["Today", "Earlier"]);
  await expect(panel.locator(".tm-inbox-item")).toHaveCount(4);

  await panel.locator(".tm-inbox-item").filter({ hasText: "Kai assigned you" }).click();
  await expect.poll(() => page.evaluate(() => window.__threadmarkNotificationsRead)).toEqual(["n-assigned"]);
  await expect(page.getByRole("tab", { name: /Inbox/ })).toContainText("2");

  await panel.getByRole("button", { name: "Mark all read" }).click();
  await views.getByRole("radio", { name: /Unread/ }).click();
  await expect(panel.locator(".tm-inbox-empty")).toContainText("You’re all caught up");
  await panel.getByRole("button", { name: "Show all" }).click();
  await expect(panel.locator(".tm-inbox-item")).toHaveCount(4);
  expect(pageErrors).toEqual([]);
});

test("an empty Inbox says what will show up there (19a)", async ({ page }) => {
  await mountFixture(page, "inbox=empty");
  const panel = page.locator("#tm-all-comments");
  await page.waitForTimeout(300);
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await expect(panel.locator(".tm-inbox-empty")).toContainText("Nothing needs you");
  await expect(panel.locator(".tm-inbox-empty")).toContainText("Mentions, replies to your comments and things assigned to you");
});

test("an Inbox item opens its thread in the panel, with a way back to the Inbox (17c)", async ({ page }) => {
  await mountFixture(page, "inbox=empty");
  await page.setViewportSize({ width: 1280, height: 800 });
  const panel = page.locator("#tm-all-comments");
  await page.locator("#secondary-target").click();
  await page.locator("#tm-comment").fill("Can we drop the company field?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Comment added");
  const id = await page.evaluate(() => window.__threadmarkFeedback.at(-1).id);
  await page.evaluate((annotationId) => window.__threadmarkSetNotifications([{ id: "n1", kind: "mention", actor: { id: "maya", displayName: "Maya Patel" },
    text: "@Emily can we drop the company field here?", annotationId, route: "/picking-events", createdAt: new Date().toISOString() }]), id);
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await panel.locator(".tm-inbox-item").first().click();
  const thread = page.locator(".tm-popover--docked");
  await expect(thread).toBeVisible();
  await expect(thread.locator(".tm-thread-back button")).toHaveText("Inbox");
  await thread.locator(".tm-thread-back button").click();
  await expect(panel.getByRole("tab", { name: /Inbox/ })).toHaveAttribute("aria-selected", "true");
});
