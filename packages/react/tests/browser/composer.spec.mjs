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
    if (url.pathname.startsWith("/faces/")) {
      const color = url.pathname.slice(7, 13);
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#${color}"/></svg>` });
    }
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

async function openPanel(page) {
  const panel = page.locator("#tm-all-comments");
  await page.waitForTimeout(300);
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  return panel;
}

// Board 08, 27a-28b.
test("your face opens a You menu; a new face shows everywhere, settings save, and leaving asks once", async ({ page }) => {
  const pageErrors = await mountFixture(page, "people=1");
  await page.setViewportSize({ width: 1280, height: 800 });
  const panel = await openPanel(page);
  const you = panel.getByRole("button", { name: "You", exact: true });
  await you.click();
  const menu = page.getByRole("menu", { name: "You" });
  await expect(menu).toContainText("emily@studio.co");
  await expect(menu.getByRole("menuitem")).toHaveText(["Your face and name", "Notifications", "Keyboard shortcuts?", "Hide on this page⌘⇧F", "Sign out"]);
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(you).toBeFocused();

  await you.click();
  await page.getByRole("menuitem", { name: "Your face and name" }).click();
  const faces = page.getByRole("radiogroup", { name: "Your face" });
  await expect(faces.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
  await faces.getByRole("radio", { name: "Lime face" }).click();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Your face is set");
  expect(await page.evaluate(() => window.__threadmarkReviewerChanges.at(-1))).toEqual({ displayName: "Emily R.", avatarUrl: "/faces/e0f354.svg" });
  await expect(you.locator("img")).toHaveAttribute("src", "/faces/e0f354.svg");

  await you.click();
  await page.getByRole("menuitem", { name: "Notifications" }).click();
  await page.getByText("New comments on my pages").click();
  await expect(page.getByRole("switch", { name: /New comments on my pages/ })).toBeChecked();
  await page.getByRole("button", { name: /^Save/ }).click();
  expect(await page.evaluate(() => window.__threadmarkNotificationSettings)).toMatchObject({ mentionsAndReplies: true, myPages: true });

  await you.click();
  await page.getByRole("menuitem", { name: "Notifications" }).click();
  await page.getByRole("button", { name: "Leave Marketing site" }).click();
  const leave = page.getByRole("alertdialog", { name: "Leave Marketing site?" });
  await expect(leave.getByRole("button", { name: /^Stay/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(leave).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Your settings" })).toBeVisible();
  await page.getByRole("button", { name: "Leave Marketing site" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__threadmarkLeft)).toBe(true);
  await expect(page.locator(".tm-toast")).toContainText("You left Marketing site");
  expect(pageErrors).toEqual([]);
});

// Board 04, 15b and 15f.
test("Share invites several people as chips with suggestions and a note, and each person's access is one menu", async ({ page }) => {
  await mountFixture(page, "people=1");
  await page.setViewportSize({ width: 1280, height: 800 });
  const panel = await openPanel(page);
  await panel.getByRole("button", { name: "Share" }).click();
  const sheet = page.getByRole("dialog", { name: "Share Marketing site" });
  const field = sheet.getByRole("combobox", { name: "Name or email to invite" });
  await field.pressSequentially("kai@studio.co,");
  await expect(sheet.locator(".tm-share__chip")).toHaveText(["kai@studio.co"]);
  await field.pressSequentially("jo");
  const suggestions = sheet.getByRole("listbox", { name: "Suggestions" });
  await expect(suggestions.getByRole("option")).toHaveCount(2);
  await expect(suggestions.getByRole("option").first()).toContainText("jo@studio.co · in Emily’s studio");
  await page.keyboard.press("Enter");
  await field.pressSequentially("new@client.com");
  await expect(suggestions.getByRole("option").last()).toContainText("new@client.com");
  await expect(suggestions.getByRole("option").last().locator("small")).toHaveText("new");
  await page.keyboard.press("Enter");
  await expect(sheet.locator(".tm-share__chip")).toHaveText(["kai@studio.co", "jo@studio.co", "new@client.com"]);
  await page.keyboard.press("Backspace");
  await expect(sheet.locator(".tm-share__chip")).toHaveCount(2);
  await sheet.getByRole("textbox", { name: "Note for the invite" }).fill("Could you look before Friday?");
  await sheet.getByRole("button", { name: "Invite", exact: true }).click();
  expect(await page.evaluate(() => window.__threadmarkInvites.at(-1))).toEqual({
    entries: ["kai@studio.co", "jo@studio.co"], role: "comment", message: "Could you look before Friday?",
  });
  await expect(sheet).toContainText("Invited 2 people.");

  // 15f: one menu per person; Remove is Orange and asks once.
  await sheet.getByRole("button", { name: "Access for Sam" }).click();
  const roles = page.getByRole("menu", { name: "Access for Sam" });
  await expect(roles.getByRole("menuitemradio", { name: /Can comment/ })).toHaveAttribute("aria-checked", "true");
  await roles.getByRole("menuitemradio", { name: /Can view/ }).click();
  expect(await page.evaluate(() => window.__threadmarkMemberChanges.at(-1))).toEqual({ id: "sam", change: { role: "view" } });
  await sheet.getByRole("button", { name: "Access for Sam" }).click();
  await page.getByRole("menuitem", { name: "Remove access" }).click();
  await expect(sheet.locator(".tm-share__confirm")).toContainText("Remove Sam?");
  await expect(sheet.getByRole("button", { name: "Keep" })).toBeFocused();
  await sheet.getByRole("button", { name: "Remove", exact: true }).click();
  expect(await page.evaluate(() => window.__threadmarkMemberChanges.at(-1))).toEqual({ id: "sam", change: { remove: true } });
  await expect(sheet).toContainText("Sam can’t open this any more.");
});
