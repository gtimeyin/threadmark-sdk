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
        name: "ThreadmarkVideoFixture",
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  pickingBundle = output.find((item) => item.type === "chunk")?.code;
  if (!pickingBundle) throw new Error("The video fixture did not produce a browser bundle.");
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

test("records the tab with camera and voice, tracks the cursor, and restores the video after reload", async ({ page }) => {
  const pageErrors = await mountFixture(page);
  await openVideoSetup(page);
  await expect(page.getByRole("radio", { name: "This tab" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".tm-video-setup__camera")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__mediaRequests[0])).toEqual({ kind: "user", video: true, audio: true });

  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-recorder")).toBeVisible();
  await expect(page.locator(".tm-camera-bubble video")).toHaveCount(1);
  await expect(page.locator(".tm-cursor-layer")).toHaveCount(1);
  expect(await page.evaluate(() => window.__mediaRequests.find((request) => request.kind === "display")))
    .toEqual({ kind: "display", preferCurrentTab: true, displaySurface: "browser", audio: false });

  // The host application stays fully usable while recording.
  await tracePointer(page, [[40, 40], [80, 60], [120, 80], [160, 100], [180, 120]]);
  await page.locator("#interaction-search").fill("private launch plan");
  await page.locator("#secondary-target").click();
  await expect(page.locator("#interaction-output")).toHaveText("Results updated");
  await expect.poll(() => page.evaluate(() => window.__threadmarkHostEvents)).toContain("secondary-click");
  // An Orange frame while live; M marks a moment (focus is on the button, not a field).
  await expect(page.locator(".tm-video-frame")).toBeVisible();
  await page.keyboard.press("m");
  await expect(page.locator(".tm-video-recorder__note")).toContainText("Moment at 0:0");
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.locator(".tm-video-review video")).toHaveCount(1);
  await expect(page.locator(".tm-video-review")).toContainText("1 moment");
  await expect(page.locator(".tm-video-review__title")).toContainText("walkthrough");
  await expect(page.getByRole("button", { name: /^Post video/ })).toBeFocused();
  await expect(page.locator(".tm-video-frame")).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector("[data-threadmark-root]").shadowRoot.textContent))
    .not.toContain("private launch plan");
  expect(await allCapturedTracksEnded(page)).toBe(true);

  await postFromReview(page, "The secondary action should not reset the results.");
  await page.getByRole("tab", { name: "Steps" }).click();
  await expect(page.locator(".tm-video-events li").filter({ hasText: "Clicked Secondary host action" })).toHaveCount(1);
  await page.getByRole("tab", { name: "Chapters" }).click();
  await expect(page.locator(".tm-video-notes")).toContainText("Moment 1");
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.comment).toBe("The secondary action should not reset the results.");
  expect(saved.video.title).toBe("The secondary action should not reset the results.");
  expect(saved.video.moments).toHaveLength(1);
  expect(saved.captureKind).toBe("video");
  expect(saved.video.mode).toBe("tab");
  expect(saved.video.camera).toBe(true);
  expect(saved.video.microphone).toBe(true);
  expect(saved.video.pointer.samples.length).toBeGreaterThan(3);
  expect(saved.video.events.map((event) => event.type)).toEqual(expect.arrayContaining(["input", "click"]));
  expect(saved.evidence).toHaveLength(1);
  expect(saved.evidence[0]).toMatchObject({ kind: "recording", mimeType: "video/webm", hasAudio: true, hasVideo: true });
  expect(saved.video.evidenceId).toBe(saved.evidence[0].id);
  expect(JSON.stringify(saved)).not.toContain("private launch plan");
  const sidecar = await page.evaluate(() => {
    const [item] = window.__threadmarkFeedbackContexts.at(-1).evidence;
    return { id: item.id, size: item.blob.size, type: item.blob.type };
  });
  expect(sidecar).toEqual({ id: saved.evidence[0].id, size: saved.evidence[0].byteSize, type: "video/webm" });
  expect(sidecar.size).toBeGreaterThan(1000);

  await page.reload({ waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  await page.locator(".tm-launcher").click();
  // The bar opens the Feedback panel when there are comments; close it to reach the pin.
  await page.getByRole("button", { name: "Feedback panel", exact: true }).click();
  await page.locator(".tm-marker").first().click();
  await expect(page.locator(".tm-video-preview video")).toHaveCount(1);
  await page.getByRole("tab", { name: "Steps" }).click();
  await expect(page.locator(".tm-video-events li")).toHaveCount(saved.video.events.length);
  expect(pageErrors).toEqual([]);
});

test("a declined tab share falls back to voice + cursor, which replays over the live page", async ({ page }) => {
  await mountFixture(page);
  await openVideoSetup(page);
  await page.evaluate(() => { window.__declineTab = true; });
  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-setup__hint")).toHaveText(/Tab sharing was declined/);
  await expect(page.getByRole("radio", { name: "Voice + cursor" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("switch", { name: "Camera" }).click();
  await expect(page.getByRole("switch", { name: "Camera" })).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".tm-video-start")).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.__mediaRequests.at(-1))).toEqual({ kind: "user", video: false, audio: true });

  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-recorder")).toContainText("Recording");
  await expect(page.getByRole("button", { name: "Camera" })).toHaveCount(0);
  await expect(page.locator(".tm-camera-bubble")).toHaveCount(0);
  await tracePointer(page, [[60, 60], [100, 80], [140, 100], [180, 120], [220, 140]]);
  await page.locator("#secondary-target").click();
  // Voice recordings have no blur (nothing on screen is recorded), but drawings are kept for the replay.
  await expect(page.getByRole("button", { name: "Blur parts of the page" })).toHaveCount(0);
  await page.getByRole("button", { name: "Draw on the page" }).click();
  await page.mouse.move(80, 200);
  await page.mouse.down();
  for (let step = 1; step <= 5; step += 1) await page.mouse.move(80 + step * 25, 200 + step * 5);
  await page.mouse.up();
  await page.getByRole("button", { name: "Draw on the page" }).click();
  await page.waitForTimeout(1100);
  await page.locator(".tm-recording-stop").click();

  await expect(page.locator(".tm-video-review audio")).toHaveCount(1);
  await postFromReview(page, "Listen to the explanation while the cursor shows the path.");
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.video).toMatchObject({ mode: "voice", camera: false, microphone: true });
  expect(saved.evidence[0]).toMatchObject({ kind: "recording", mimeType: "audio/webm", hasVideo: false });
  expect(saved.video.pointer.samples.length).toBeGreaterThan(3);
  expect(saved.video.drawings).toHaveLength(1);
  expect(await allCapturedTracksEnded(page)).toBe(true);

  await page.getByRole("button", { name: "Replay on page" }).click();
  await expect(page.locator(".tm-replay-bar")).toBeVisible();
  await expect(page.locator(".tm-replay-cursor")).toHaveCount(1);
  await expect(page.locator(".tm-replay-layer .tm-draw-layer")).toHaveAttribute("data-strokes", "1", { timeout: 10_000 });
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  await expect(page.locator(".tm-replay-bar")).toContainText("Replaying Emily R.’s cursor");
  await page.keyboard.press("Escape");
  await expect(page.locator(".tm-replay-bar")).toHaveCount(0);
  await expect(page.locator(".tm-popover")).toBeVisible();
  await expect(page.locator(".tm-video-preview")).toBeVisible();
  expect(await page.evaluate(() => window.__threadmarkHostEvents.filter((event) => event === "secondary-click").length)).toBe(1);
});

test("a running recording ignores Escape; the review asks before Retake or Delete", async ({ page }) => {
  await mountFixture(page, "");
  await openVideoSetup(page);
  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-recorder")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".tm-video-recorder")).toBeVisible();

  // The microphone mutes without stopping; pausing turns the frame into a quiet dashed one.
  const microphone = page.getByRole("button", { name: "Microphone" });
  await microphone.click();
  await expect(microphone).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__mediaStreams.flatMap((stream) => stream.getAudioTracks()).some((track) => track.readyState === "live" && !track.enabled))).toBe(true);
  await microphone.click();
  await expect(microphone).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Pause recording" }).click();
  await expect(page.locator(".tm-video-recorder")).toContainText("Paused");
  await expect(page.locator(".tm-video-frame")).toHaveClass(/is-paused/);
  await page.getByRole("button", { name: "Resume recording" }).click();
  await page.waitForTimeout(1100);
  await page.locator(".tm-recording-stop").click();

  // Esc asks first, and the safe choice has focus.
  const review = page.locator(".tm-video-review");
  await expect(review).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(review).toContainText("Delete this video?");
  await expect(page.getByRole("button", { name: "Keep it" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(review).not.toContainText("Delete this video?");

  await page.getByRole("button", { name: "Retake" }).click();
  await expect(review).toContainText("Record it again?");
  await page.locator(".tm-video-review .tm-video-danger").click();
  await expect(page.locator(".tm-video-setup")).toBeVisible();
  await expect(page.locator(".tm-video-start")).toBeEnabled();
  await page.locator(".tm-video-start").click();
  await page.waitForTimeout(1100);
  await page.locator(".tm-recording-stop").click();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(review).toContainText("Delete this video?");
  await page.locator(".tm-video-review .tm-video-danger").click();
  await expect(review).toHaveCount(0);
  await expect(page.locator(".tm-modebar")).toBeVisible();
  expect(await allCapturedTracksEnded(page)).toBe(true);
  expect(await page.evaluate(() => window.__threadmarkFeedback.length)).toBe(0);
});

test("a 3-2-1 countdown runs before recording, and Esc cancels it", async ({ page }) => {
  await mountFixture(page, "countdown=2");
  await openVideoSetup(page);
  await page.locator(".tm-video-start").click();
  const count = page.getByRole("timer");
  await expect(count).toHaveText("2");
  await expect(page.locator(".tm-video-setup")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(count).toHaveCount(0);
  await expect(page.locator(".tm-video-setup")).toBeVisible();
  await expect(page.locator(".tm-video-recorder")).toHaveCount(0);

  await page.locator(".tm-video-start").click();
  await expect(count).toHaveText("2");
  await expect(count).toHaveText("1");
  await expect(page.locator(".tm-video-recorder")).toBeVisible({ timeout: 3000 });
  await expect(count).toHaveCount(0);
});

test("the review trims the ends, and the duration limit stops the recording", async ({ page }) => {
  await mountFixture(page, "videomax=5000");
  await openVideoSetup(page);
  await expect(page.locator(".tm-video-setup__limit")).toHaveText("Up to 0:05");
  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-review")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".tm-video-review__length")).toHaveText(/0:0[45]/);

  const startHandle = page.getByRole("slider", { name: "Start of the video" });
  await startHandle.focus();
  for (let step = 0; step < 10; step += 1) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tm-video-trim__labels span").first()).toHaveText("0:01");

  await postFromReview(page);
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.video.trim).toEqual({ startMs: 1000, endMs: saved.video.durationMs });
  expect(saved.comment).toMatch(/walkthrough$/);
});

test("hosts can turn video feedback off", async ({ page }) => {
  await mountFixture(page, "novideo=1");
  await page.getByRole("button", { name: "Feedback tools: Comment" }).click();
  await expect(page.getByRole("menuitemradio", { name: /^Record an interaction/ })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /^Record a video/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await expect(page.locator(".tm-video-setup")).toHaveCount(0);
});

test("recordings the host stored elsewhere play from their URL and are handed back unchanged", async ({ page }) => {
  await mountFixture(page, "");
  const stored = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext("2d");
    const timer = setInterval(() => {
      context.fillStyle = `hsl(${Date.now() % 360} 60% 50%)`;
      context.fillRect(0, 0, 160, 90);
    }, 33);
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 700));
    recorder.stop();
    await new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
    clearInterval(timer);
    const blob = new Blob(chunks, { type: "video/webm" });
    return { url: URL.createObjectURL(blob), size: blob.size };
  });
  const target = {
    tagName: "html",
    role: "document",
    accessibleName: "Page interaction",
    visibleText: "",
    bounds: { x: 0, y: 0, width: 600, height: 400 },
    pageBounds: { x: 0, y: 0, width: 600, height: 400 },
    locatorCandidates: { stableId: null, id: null, domPath: "html" },
    route: "/picking-events",
    capturedAt: "2026-10-16T10:00:00.000Z",
  };
  await page.evaluate((record) => window.__threadmarkSetRecords([record]), {
    feedback: {
      id: "stored-video",
      projectKey: "privacy-browser-fixture",
      environment: "local",
      route: "/picking-events",
      target,
      targets: [target],
      captureKind: "video",
      comment: "Recorded earlier and kept in the host's storage.",
      createdAt: "2026-10-16T10:00:00.000Z",
      updatedAt: "2026-10-16T10:00:00.000Z",
      author: { id: "fixture_reviewer", displayName: "Emily R." },
      evidence: [{
        id: "ev-stored", kind: "recording", mimeType: "video/webm", byteSize: stored.size,
        durationMs: 700, pixelSize: { width: 160, height: 90 }, hasAudio: false, hasVideo: true,
      }],
      video: {
        version: 1, mode: "voice", startedAt: "2026-10-16T10:00:00.000Z", durationMs: 700, evidenceId: "ev-stored",
        camera: true, microphone: false, viewport: { width: 600, height: 400 },
        pointer: { samples: [[0, 10, 10], [300, 200, 150]], scrolls: [[0, 0, 0]] }, events: [],
      },
    },
    context: { evidence: [{ id: "ev-stored", url: stored.url }] },
  });

  await page.locator(".tm-marker").first().click();
  await expect(page.locator(".tm-video-preview video")).toHaveAttribute("src", stored.url);
  await page.getByRole("button", { name: "Replay on page" }).click();
  await expect(page.locator(".tm-replay-cursor video")).toHaveAttribute("src", stored.url);
  await page.getByRole("button", { name: "Done" }).click();

  await setComment(page, "Seen on the stored copy too.");
  await page.locator(".tm-submit").click();
  await expect.poll(() => page.evaluate(() => window.__threadmarkFeedbackContexts.length)).toBe(1);
  expect(await page.evaluate(() => window.__threadmarkFeedbackContexts.at(-1).evidence
    .map((item) => ({ id: item.id, url: item.url, hasBlob: "blob" in item }))))
    .toEqual([{ id: "ev-stored", url: stored.url, hasBlob: false }]);
  expect(await page.evaluate(() => window.__threadmarkFeedback.at(-1).replies.at(-1).comment)).toBe("Seen on the stored copy too.");
});

// The picker covers the page, so pick by position, as a reviewer's click lands.
async function clickThrough(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function boxOf(locator) {
  const box = await locator.boundingBox();
  return box && { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
}

test("tab videos blur what the site marked private and what the reviewer picks, and drawings fade", async ({ page }) => {
  const pageErrors = await mountFixture(page);
  // A region another session tool already masks (FullStory's class): blurred without anyone choosing it.
  await page.evaluate(() => {
    const note = document.createElement("p");
    note.id = "card-note";
    note.className = "fs-mask";
    note.textContent = "Card ending 4242, expires 09/29";
    document.body.prepend(note);
  });
  await openVideoSetup(page);
  const blurBoxes = page.locator(".tm-blur-box");
  await expect(blurBoxes).toHaveCount(1);

  // Before recording: pick an element to blur; clicks pick instead of reaching the page.
  await page.getByRole("button", { name: "Blur parts of the page" }).click();
  await expect(page.getByRole("region", { name: "Blur parts of the page" })).toBeVisible();
  await clickThrough(page, page.locator("#secondary-target"));
  await expect(page.getByRole("region", { name: "Blur parts of the page" })).toContainText("1 blurred");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".tm-video-setup")).toBeVisible();
  await expect(page.getByRole("button", { name: "1 blurred" })).toBeVisible();
  expect(await page.evaluate(() => window.__threadmarkHostEvents.filter((event) => event === "secondary-click").length)).toBe(0);
  await expect(blurBoxes).toHaveCount(2);

  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-recorder")).toBeVisible();
  // Each box covers its element, following it on the page.
  const target = await boxOf(page.locator("#secondary-target"));
  const boxes = await Promise.all((await blurBoxes.all()).map(boxOf));
  expect(boxes.some((box) => Math.abs(box.x - (target.x - 4)) <= 1 && Math.abs(box.y - (target.y - 4)) <= 1 && Math.abs(box.width - (target.width + 8)) <= 1)).toBe(true);
  const note = await boxOf(page.locator("#card-note"));
  expect(boxes.some((box) => Math.abs(box.y - (note.y - 4)) <= 1)).toBe(true);

  // During recording, choosing what to blur pauses the recording and resumes it after.
  await page.getByRole("button", { name: "Blur parts of the page" }).click();
  await expect(page.locator(".tm-video-recorder")).toHaveClass(/is-paused/);
  await clickThrough(page, page.locator("#interaction-output"));
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".tm-video-recorder")).not.toHaveClass(/is-paused/);
  await expect(blurBoxes).toHaveCount(3);

  // Drawing: the page doesn't get the pointer, and the stroke fades after three seconds.
  await page.getByRole("button", { name: "Draw on the page" }).click();
  await expect(page.getByRole("button", { name: "Draw on the page" })).toHaveAttribute("aria-pressed", "true");
  const area = await boxOf(page.locator("#custom-target"));
  await page.mouse.move(area.x + 10, area.y + 10);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) await page.mouse.move(area.x + 10 + step * 20, area.y + 10 + step * 4);
  await page.mouse.up();
  await expect(page.locator(".tm-draw-layer").first()).toHaveAttribute("data-strokes", "1");
  expect(await page.evaluate(() => window.__threadmarkHostEvents.filter((event) => event === "click" || event === "pointerdown").length)).toBe(0);
  await expect(page.locator(".tm-draw-layer").first()).toHaveAttribute("data-strokes", "0", { timeout: 6000 });
  await page.getByRole("button", { name: "Draw on the page" }).click();
  await page.waitForTimeout(500);

  await page.locator(".tm-recording-stop").click();
  await expect(page.locator(".tm-video-review")).toBeVisible();
  await expect(blurBoxes).toHaveCount(0);
  await postFromReview(page, "The numbers are blurred.");
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.video.drawings).toHaveLength(1);
  expect(saved.video.drawings[0].points.length).toBeGreaterThan(3);
  expect(saved.video.pauses).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});
