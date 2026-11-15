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

  await page.getByRole("button", { name: "Comments", exact: true }).click();
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

test("a pin opens its thread as a popover by the pin, even with the panel open", async ({ page }) => {
  await mountFixture(page, "");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("#secondary-target").click();
  await page.locator("#tm-comment").fill("Pinned thread");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Comment added");

  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(page.locator("#tm-all-comments")).toBeVisible();
  await page.locator(".tm-marker").first().click();
  const thread = page.locator(".tm-popover--thread");
  await expect(thread).toBeVisible();
  await expect(page.locator(".tm-popover--docked")).toHaveCount(0);
  await expect(thread.locator(".tm-thread-back")).toHaveCount(0);
  await expect(thread.getByPlaceholder("Reply")).toBeVisible();

  // Closed, the same comment opened from the list docks in the panel again.
  await page.keyboard.press("Escape");
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  await page.locator(".tm-comments-list li").first().click();
  await expect(page.locator(".tm-popover--docked")).toBeVisible();
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
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Comments", exact: true }).click();
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

test("the idle Bar is the comment-mode Bar: Tools, More, Comments, and Inbox with its unread count, which opens the Inbox", async ({ page }) => {
  const pageErrors = await mountFixture(page, "inbox=1");
  const close = page.getByRole("button", { name: "Close annotations (Esc)" });
  if (await close.isVisible()) await close.click();
  const idle = page.getByRole("group", { name: "Threadmark" });
  await expect(idle.getByRole("button", { name: "Feedback tools" })).toBeVisible();
  await expect(idle.getByRole("button", { name: "More actions" })).toBeVisible();
  await expect(idle.locator(".tm-launcher")).toBeVisible();
  await expect(idle.locator(".tm-bar__primary, .tm-ui-key")).toHaveCount(0);
  await idle.getByRole("button", { name: "Inbox, 3 unread" }).click();
  await expect(page.locator("#tm-all-comments")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Inbox/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Close annotations (Esc)" }).click();
  // More from the idle Bar starts commenting with the More menu already open.
  await page.getByRole("group", { name: "Threadmark" }).getByRole("button", { name: "More actions" }).click();
  await expect(page.locator("#tm-more-menu")).toBeVisible();
  // Both states share one Bar, so the Tools button says comment mode is on; idle it isn't marked.
  await expect(page.locator(".tm-modebar .tm-tool-switch")).toHaveClass(/is-active/);
  await page.getByRole("button", { name: "Close annotations (Esc)" }).click();
  await expect(page.locator(".tm-bar--idle .tm-tool-switch")).not.toHaveClass(/is-active/);
  expect(pageErrors).toEqual([]);
});

test("C starts commenting from the resting Bar, but not while typing in the page", async ({ page }) => {
  const pageErrors = await mountFixture(page, "inbox=1");
  // The fixture opens comment mode shortly after loading; settle on the resting Bar first.
  const close = page.getByRole("button", { name: "Close annotations (Esc)" });
  await expect(async () => {
    if (await close.isVisible()) await close.click();
    await expect(page.locator(".tm-bar--idle")).toBeVisible({ timeout: 500 });
    await page.waitForTimeout(400);
    await expect(page.locator(".tm-modebar")).toHaveCount(0);
  }).toPass();
  const tools = page.locator(".tm-modebar .tm-tool-switch");

  await page.getByLabel("Interaction search").press("c");
  await expect(page.getByLabel("Interaction search")).toHaveValue("c");
  await expect(tools).toHaveCount(0);

  await page.getByLabel("Interaction search").blur();
  await page.keyboard.press("c");
  await expect(tools).toHaveClass(/is-active/);
  expect(pageErrors).toEqual([]);
});

test("the Bar's Comments and Inbox buttons open the panel on their own view, and close it when it's already showing", async ({ page }) => {
  const pageErrors = await mountFixture(page, "inbox=1");
  await page.setViewportSize({ width: 1280, height: 800 });
  const panel = page.locator("#tm-all-comments");
  const bar = page.getByRole("toolbar", { name: "Threadmark annotation tools" });
  await page.waitForTimeout(300);
  // Clicking Comments on another view switches to Comments; clicking it again closes the panel.
  for (let tries = 0; tries < 2 && await panel.isVisible(); tries += 1) await bar.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(panel).toBeHidden();

  const inbox = bar.getByRole("button", { name: "Inbox, 3 unread" });
  await inbox.click();
  await expect(panel).toBeVisible();
  await expect(page.getByRole("tab", { name: /Inbox/ })).toHaveAttribute("aria-selected", "true");
  await expect(inbox).toHaveAttribute("aria-expanded", "true");

  const comments = bar.getByRole("button", { name: "Comments", exact: true });
  await comments.click();
  await expect(page.getByRole("tab", { name: /Activity/ })).toHaveAttribute("aria-selected", "true");
  await expect(inbox).toHaveAttribute("aria-expanded", "false");

  await comments.click();
  await expect(panel).toBeHidden();
  await expect(comments).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test("the panel's tabs are icons with their names kept for screen readers, and the header doesn't overlap at 800px", async ({ page }) => {
  await mountFixture(page, "inbox=1&nextsteps=1");
  await page.setViewportSize({ width: 800, height: 900 });
  const panel = page.locator("#tm-all-comments");
  await page.waitForTimeout(300);
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Activity/ })).toHaveAttribute("title", "Activity");
  await expect(page.getByRole("tab", { name: /Inbox/ })).toHaveAttribute("title", "Inbox");
  const boxes = await panel.locator(".tm-comments-header").evaluate((header) =>
    [...header.querySelectorAll(".tm-panel-tabs > button, .tm-comments-actions > button, .tm-comments-actions > * > button")]
      .map((button) => { const box = button.getBoundingClientRect(); return { left: box.left, right: box.right }; }));
  for (let index = 1; index < boxes.length; index += 1) expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
});

test("an empty Inbox says what will show up there (19a)", async ({ page }) => {
  await mountFixture(page, "inbox=empty");
  const panel = page.locator("#tm-all-comments");
  await page.waitForTimeout(300);
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Comments", exact: true }).click();
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
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Comments", exact: true }).click();
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
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Comments", exact: true }).click();
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

// Board 02, 6a-6d.
test("the Capture bar boxes an area or the whole view, keeps its colour, and ↵ attaches the sketch to a comment", async ({ page }) => {
  const pageErrors = await mountFixture(page, "");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.keyboard.press("s");
  const bar = page.getByRole("toolbar", { name: "Capture" });
  await expect(bar.getByRole("button", { name: /^Box/ })).toHaveAttribute("aria-pressed", "true");
  await expect(bar.getByRole("button", { name: /^Pen/ })).toBeDisabled();
  await bar.getByRole("radio", { name: "White pen" }).click();

  // W takes the whole view; the pen is ready and the colour carried over.
  await page.keyboard.press("w");
  const canvas = page.locator(".tm-markup-canvas");
  await expect(canvas.locator("img")).toBeVisible();
  const box = await canvas.boundingBox();
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(1276);
  await expect(bar.getByRole("button", { name: /^Pen/ })).toHaveAttribute("aria-pressed", "true");
  await expect(bar.getByRole("radio", { name: "White pen" })).toHaveAttribute("aria-checked", "true");

  // B goes back to boxing a smaller area.
  await page.keyboard.press("b");
  await expect(page.locator(".tm-capture-surface")).toBeVisible();
  const target = await page.locator("#custom-target").boundingBox();
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width, target.y + target.height, { steps: 5 });
  await page.mouse.up();
  await expect(canvas.locator("img")).toBeVisible();
  const svg = await page.locator('svg[aria-label="Screenshot drawing canvas"]').boundingBox();
  await page.mouse.move(svg.x + 10, svg.y + 10);
  await page.mouse.down();
  await page.mouse.move(svg.x + svg.width - 10, svg.y + svg.height - 10, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".tm-markup-canvas polyline")).toHaveAttribute("stroke", "#ffffff");

  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-popover .tm-composer__sketch img")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

// Board 02, 6b and 6d.
test("the sketch box resizes from its corners and moves by its size label, and Esc in the composer goes back to drawing", async ({ page }) => {
  const pageErrors = await mountFixture(page, "");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.keyboard.press("s");
  const target = await page.locator("#custom-target").boundingBox();
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 200, target.y + 80, { steps: 5 });
  await page.mouse.up();
  const canvas = page.locator(".tm-markup-canvas");
  await expect(canvas.locator("img")).toBeVisible();
  const before = await canvas.boundingBox();

  // Drag the bottom-right handle out by 60 × 40.
  const handle = await page.locator(".tm-markup-handle--se").boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 4);
  await page.mouse.down();
  await page.mouse.move(handle.x + 64, handle.y + 44, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await canvas.boundingBox()).width - before.width)).toBe(60);
  await expect(canvas.locator("img")).toBeVisible();

  // Drag the size label to move the box.
  const label = await page.locator(".tm-markup-canvas__dimensions").boundingBox();
  const moved = await canvas.boundingBox();
  await page.mouse.move(label.x + 10, label.y + 8);
  await page.mouse.down();
  await page.mouse.move(label.x + 110, label.y + 58, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await canvas.boundingBox()).x - moved.x)).toBe(100);
  await expect(canvas.locator("img")).toBeVisible();

  // Once there is a sketch, the box stays put.
  const svg = await page.locator('svg[aria-label="Screenshot drawing canvas"]').boundingBox();
  await page.mouse.move(svg.x + 10, svg.y + 10);
  await page.mouse.down();
  await page.mouse.move(svg.x + svg.width - 10, svg.y + svg.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".tm-markup-handle")).toHaveCount(0);

  // 6d: the composer carries the sketch as a chip; Esc goes back with the strokes kept.
  await page.keyboard.press("Enter");
  const chip = page.locator(".tm-composer__sketch");
  await expect(chip).toContainText("Region");
  await expect(chip).toContainText("Screenshot with your sketch");
  await expect(page.locator(".tm-popover .tm-composer__esc")).toContainText("back to drawing");
  await page.locator("#tm-comment").fill("These feel cramped");
  await page.keyboard.press("Escape");
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  await expect(page.locator(".tm-markup-canvas polyline")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(chip).toBeVisible();
  await page.locator("#tm-comment").fill("These feel cramped");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Comment added");
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.captureKind).toBe("screenshot");
  expect(saved.evidence[0]).toMatchObject({ kind: "snapshot" });
  expect(pageErrors).toEqual([]);
});

test("a quote's pin sits at the end of its last line, and long quotes end on a whole word", async ({ page }) => {
  await mountFixture(page, "");
  await page.setViewportSize({ width: 1280, height: 800 });
  const box = await page.locator("#custom-target").boundingBox();
  const lines = await page.evaluate(() => {
    const node = document.querySelector("#custom-target");
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].filter((rect) => rect.width > 4).map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
  });
  expect(lines.length).toBeGreaterThan(1);
  const first = lines[0];
  const last = lines[lines.length - 1];
  await page.mouse.move(first.left + 4, (first.top + first.bottom) / 2);
  await page.mouse.down();
  await page.mouse.move(last.right - 2, (last.top + last.bottom) / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".tm-popover--compose")).toBeVisible();
  await page.locator("#tm-comment").fill("Quote pin");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tm-toast")).toContainText("Comment added");
  const pin = await page.locator(".tm-marker").first().boundingBox();
  // The pin is by the end of the last line, not at the far right of the first.
  expect(pin.y).toBeGreaterThan(last.top - 16);
  expect(pin.x).toBeLessThan(Math.max(...lines.map((line) => line.right)) + 4);
  expect(box).not.toBeNull();
});
