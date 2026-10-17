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
  await page.getByRole("button", { name: "Record video feedback" }).click();
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
  await expect(page.locator(".tm-video-recorder__count")).toHaveText(/[2-9] steps/);
  await page.waitForTimeout(1200);

  await page.locator(".tm-recording-stop").click();
  await expect(page.locator(".tm-popover")).toBeVisible();
  await expect(page.locator(".tm-video-preview video")).toHaveCount(1);
  await expect(page.locator(".tm-video-events li").filter({ hasText: "Clicked Secondary host action" })).toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector("[data-threadmark-root]").shadowRoot.textContent))
    .not.toContain("private launch plan");
  expect(await allCapturedTracksEnded(page)).toBe(true);

  await setComment(page, "The secondary action should not reset the results.");
  await submitComposer(page);
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
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
  await page.locator(".tm-marker").first().click();
  await expect(page.locator(".tm-video-preview video")).toHaveCount(1);
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

  await page.getByRole("button", { name: "Camera on" }).click();
  await expect(page.getByRole("button", { name: "Camera off" })).toBeVisible();
  await expect(page.locator(".tm-video-start")).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.__mediaRequests.at(-1))).toEqual({ kind: "user", video: false, audio: true });

  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-recorder")).toContainText("Recording voice + cursor");
  await expect(page.locator(".tm-camera-bubble")).toHaveCount(0);
  await tracePointer(page, [[60, 60], [100, 80], [140, 100], [180, 120], [220, 140]]);
  await page.locator("#secondary-target").click();
  await page.waitForTimeout(1100);
  await page.locator(".tm-recording-stop").click();

  await expect(page.locator(".tm-video-preview audio")).toHaveCount(1);
  await setComment(page, "Listen to the explanation while the cursor shows the path.");
  await submitComposer(page);
  const saved = await page.evaluate(() => window.__threadmarkFeedback.at(-1));
  expect(saved.video).toMatchObject({ mode: "voice", camera: false, microphone: true });
  expect(saved.evidence[0]).toMatchObject({ kind: "recording", mimeType: "audio/webm", hasVideo: false });
  expect(saved.video.pointer.samples.length).toBeGreaterThan(3);
  expect(await allCapturedTracksEnded(page)).toBe(true);

  await page.locator(".tm-marker").first().click();
  await page.getByRole("button", { name: "Replay on page" }).click();
  await expect(page.locator(".tm-replay-bar")).toBeVisible();
  await expect(page.locator(".tm-replay-cursor")).toHaveCount(1);
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  await expect(page.locator(".tm-replay-bar")).toContainText("Replaying Emily R.’s cursor");
  await page.keyboard.press("Escape");
  await expect(page.locator(".tm-replay-bar")).toHaveCount(0);
  await expect(page.locator(".tm-popover")).toBeVisible();
  await expect(page.locator(".tm-video-preview")).toBeVisible();
  expect(await page.evaluate(() => window.__threadmarkHostEvents.filter((event) => event === "secondary-click").length)).toBe(1);
});

test("a running recording ignores Escape and needs a second step to discard or restart", async ({ page }) => {
  await mountFixture(page, "");
  await openVideoSetup(page);
  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-recorder")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".tm-video-recorder")).toBeVisible();

  await page.getByRole("button", { name: "Pause recording" }).click();
  await expect(page.locator(".tm-video-recorder")).toContainText("Paused");
  await page.getByRole("button", { name: "Resume recording" }).click();

  await page.getByRole("button", { name: "Restart recording" }).click();
  await expect(page.locator(".tm-video-recorder")).toContainText("Restart from the beginning?");
  await page.getByRole("button", { name: "Keep recording" }).click();
  await expect(page.locator(".tm-video-recorder__clock")).toBeVisible();

  await page.getByRole("button", { name: "Discard recording" }).click();
  await expect(page.locator(".tm-video-recorder")).toContainText("Discard this recording?");
  await page.locator(".tm-video-danger").click();
  await expect(page.locator(".tm-video-recorder")).toHaveCount(0);
  await expect(page.locator(".tm-modebar")).toBeVisible();
  expect(await allCapturedTracksEnded(page)).toBe(true);
  expect(await page.evaluate(() => window.__threadmarkFeedback.length)).toBe(0);
});

test("dismissing an unposted video asks first, and the duration limit stops the recording", async ({ page }) => {
  await mountFixture(page, "videomax=5000");
  await openVideoSetup(page);
  await expect(page.locator(".tm-video-setup__hint")).toContainText("up to 0:05");
  await page.locator(".tm-video-start").click();
  await expect(page.locator(".tm-video-recorder__limit")).toHaveText("/ 0:05");
  await expect(page.locator(".tm-popover")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".tm-video-preview")).toContainText("0:0");

  await page.keyboard.press("Escape");
  await expect(page.locator(".tm-delete-confirm")).toContainText("Discard this video?");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.locator(".tm-video-preview")).toBeVisible();
});

test("hosts can turn video feedback off", async ({ page }) => {
  await mountFixture(page, "novideo=1");
  await expect(page.getByRole("button", { name: "Record an interaction" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record video feedback" })).toHaveCount(0);
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
