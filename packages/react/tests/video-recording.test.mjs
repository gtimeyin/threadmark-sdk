import assert from "node:assert/strict";
import test from "node:test";

import { formatAnnotationsMarkdown } from "../src/annotation.js";
import { createFeedbackPayload } from "../src/core.js";
import {
  DEFAULT_VIDEO_MAX_DURATION_MS,
  MAX_POINTER_SAMPLES,
  MAX_VIDEO_DURATION_MS,
  activeEventIndex,
  appendPointerSample,
  appendScrollSample,
  baseMimeType,
  createPointerTrack,
  createRecorderSession,
  createRecordingClock,
  detectVideoSupport,
  formatClock,
  openScreenStream,
  pickRecorderMimeType,
  pointerPositionAt,
  resolveVideoRecordingOptions,
  scrollPositionAt,
  suggestVideoTitle,
  videoOffsetAt,
} from "../src/videoRecording.js";

const target = {
  tagName: "button",
  role: "button",
  accessibleName: "Checkout",
  visibleText: "Checkout",
  bounds: { x: 10, y: 20, width: 100, height: 40 },
  locatorCandidates: { stableId: "checkout-submit", id: null, domPath: "main > button" },
  route: "/cart",
  capturedAt: "2026-10-16T10:00:00.000Z",
};

const recordingEvidence = {
  id: "evidence_video",
  kind: "recording",
  mimeType: "video/webm",
  byteSize: 48_000,
  durationMs: 12_400,
  pixelSize: { width: 1280, height: 720 },
  hasAudio: true,
  hasVideo: true,
};

function videoPayload(overrides = {}) {
  return createFeedbackPayload({
    projectKey: "demo",
    environment: "local",
    route: "/cart",
    target,
    targets: [target],
    captureKind: "video",
    evidence: [recordingEvidence],
    comment: "The total jumps after I click checkout.",
    video: {
      version: 1,
      mode: "tab",
      startedAt: "2026-10-16T10:00:00.000Z",
      durationMs: 12_400,
      evidenceId: "evidence_video",
      camera: true,
      microphone: true,
      viewport: { width: 1280, height: 720 },
      pointer: {
        samples: [[0, 10, 10], [50, 40, 30], [120, 60, 40]],
        scrolls: [[0, 0, 0], [900, 0, 320]],
      },
      events: [
        { type: "click", offsetMs: 7_000, targetIndex: 0, button: 0, x: 60, y: 40 },
        { type: "keydown", offsetMs: 8_000, targetIndex: 0, key: "Enter" },
      ],
    },
    ...overrides,
  });
}

test("the videoRecording prop is on by default, can be turned off, and clamps its duration", () => {
  assert.deepEqual(resolveVideoRecordingOptions(undefined), { enabled: true, maxDurationMs: DEFAULT_VIDEO_MAX_DURATION_MS, countdownSeconds: 3 });
  assert.deepEqual(resolveVideoRecordingOptions(true), { enabled: true, maxDurationMs: DEFAULT_VIDEO_MAX_DURATION_MS, countdownSeconds: 3 });
  assert.equal(resolveVideoRecordingOptions(false).enabled, false);
  assert.equal(resolveVideoRecordingOptions({ maxDurationMs: 60_000 }).maxDurationMs, 60_000);
  assert.equal(resolveVideoRecordingOptions({ maxDurationMs: 99 * 60_000 }).maxDurationMs, MAX_VIDEO_DURATION_MS);
  assert.equal(resolveVideoRecordingOptions({ maxDurationMs: 10 }).maxDurationMs, 5_000);
});

test("support detection separates tab capture from voice recording and excludes touch-first devices", () => {
  const recorder = function MediaRecorder() {};
  const desktop = {
    MediaRecorder: recorder,
    navigator: { mediaDevices: { getUserMedia() {}, getDisplayMedia() {} } },
    matchMedia: () => ({ matches: false }),
  };
  assert.deepEqual(detectVideoSupport(desktop), { tab: true, voice: true });
  assert.deepEqual(detectVideoSupport({ ...desktop, matchMedia: () => ({ matches: true }) }), { tab: false, voice: true });
  assert.deepEqual(detectVideoSupport({ ...desktop, MediaRecorder: undefined }), { tab: false, voice: false });
  assert.deepEqual(detectVideoSupport({ navigator: {} }), { tab: false, voice: false });
});

test("recorder formats prefer portable MP4 and fall back to WebM or audio-only containers", () => {
  const chromium = (type) => type.startsWith("video/webm") || type.startsWith("audio/webm");
  assert.equal(pickRecorderMimeType({ video: true, audio: true }, () => true), 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"');
  assert.equal(pickRecorderMimeType({ video: true, audio: true }, chromium), "video/webm;codecs=vp9,opus");
  assert.equal(pickRecorderMimeType({ video: false, audio: true }, chromium), "audio/webm;codecs=opus");
  assert.equal(pickRecorderMimeType({ video: true, audio: false }, () => false), "");
  assert.equal(baseMimeType("video/webm;codecs=vp9,opus"), "video/webm");
  assert.equal(baseMimeType('video/mp4;codecs="avc1"'), "video/mp4");
  assert.equal(baseMimeType("", { video: false }), "audio/webm");
  assert.equal(baseMimeType("video/x-matroska"), "video/webm");
});

test("clock labels and the recording clock exclude paused time", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(61_900), "1:01");
  assert.equal(formatClock(-5), "0:00");
  let now = 1_000;
  const clock = createRecordingClock(() => now);
  now = 4_000;
  assert.equal(clock.elapsed(), 3_000);
  clock.pause();
  now = 9_000;
  assert.equal(clock.paused, true);
  assert.equal(clock.elapsed(), 3_000);
  clock.resume();
  now = 10_000;
  assert.equal(clock.elapsed(), 4_000);
  assert.deepEqual(clock.pauses, [{ offsetMs: 3_000, durationMs: 5_000 }], "each pause is kept in recording time");
  clock.reset();
  assert.equal(clock.elapsed(), 0);
  assert.deepEqual(clock.pauses, []);
});

test("clock-time moments land on the right second of a paused video", () => {
  const video = {
    startedAt: new Date(100_000).toISOString(),
    durationMs: 20_000,
    pauses: [{ offsetMs: 5_000, durationMs: 10_000 }, { offsetMs: 12_000, durationMs: 3_000 }],
  };
  assert.equal(videoOffsetAt(99_000, video), null, "before the recording");
  assert.equal(videoOffsetAt(104_000, video), 4_000);
  assert.equal(videoOffsetAt(108_000, video), 5_000, "during the first pause: where it paused");
  assert.equal(videoOffsetAt(116_000, video), 6_000, "after it, ten seconds less");
  assert.equal(videoOffsetAt(123_500, video), 12_000, "during the second pause");
  assert.equal(videoOffsetAt(131_000, video), 18_000, "after both, thirteen seconds less");
  assert.equal(videoOffsetAt(160_000, video), null, "after the recording");
  assert.equal(videoOffsetAt(104_000, { durationMs: 20_000 }), null, "a video without a start time has no clock");
});

test("pauses travel with a video's payload, ordered and inside the recording", () => {
  const payload = videoPayload({
    video: {
      version: 1,
      mode: "tab",
      startedAt: "2026-10-16T10:00:00.000Z",
      durationMs: 12_400,
      evidenceId: "evidence_video",
      viewport: { width: 1280, height: 720 },
      pointer: { samples: [], scrolls: [] },
      events: [],
      pauses: [{ offsetMs: 9_000, durationMs: 2_000 }, { offsetMs: 99_000, durationMs: 1_000 }, { offsetMs: 1_000, durationMs: 0 }, "junk"],
    },
  });
  assert.deepEqual(payload.video.pauses, [{ offsetMs: 9_000, durationMs: 2_000 }, { offsetMs: 12_400, durationMs: 1_000 }]);
  const unpaused = videoPayload();
  assert.equal("pauses" in unpaused.video, false);
});

test("pointer samples are throttled, need real movement, stay ordered, and are capped", () => {
  const track = createPointerTrack({ width: 800, height: 600, scrollX: 0, scrollY: 40 });
  assert.deepEqual(track.scrolls, [[0, 0, 40]]);
  assert.equal(appendPointerSample(track, 0, 10, 10), true);
  assert.equal(appendPointerSample(track, 20, 200, 200), false, "inside the sampling interval");
  assert.equal(appendPointerSample(track, 80, 11, 10), false, "sub-pixel jitter is ignored");
  assert.equal(appendPointerSample(track, 80, 50, 60), true);
  assert.equal(appendPointerSample(track, 90, 51, 61, { force: true }), true, "pointerdown always lands");
  assert.deepEqual(track.samples, [[0, 10, 10], [80, 50, 60], [90, 51, 61]]);

  const full = createPointerTrack();
  for (let index = 0; index < MAX_POINTER_SAMPLES + 5; index += 1) {
    appendPointerSample(full, index * 100, index * 3, 0);
  }
  assert.equal(full.samples.length, MAX_POINTER_SAMPLES);
});

test("scroll bursts collapse to their final position", () => {
  const track = createPointerTrack();
  appendScrollSample(track, 500, 0, 100);
  appendScrollSample(track, 540, 0, 180);
  appendScrollSample(track, 580, 0, 260);
  appendScrollSample(track, 900, 0, 260);
  appendScrollSample(track, 1_000, 0, 400);
  assert.deepEqual(track.scrolls, [[0, 0, 0], [500, 0, 260], [1_000, 0, 400]]);
});

test("replay positions interpolate the pointer and step the scroll", () => {
  const samples = [[100, 0, 0], [200, 100, 50], [400, 100, 50]];
  assert.equal(pointerPositionAt(samples, 50), null);
  assert.deepEqual(pointerPositionAt(samples, 150), { x: 50, y: 25 });
  assert.deepEqual(pointerPositionAt(samples, 300), { x: 100, y: 50 });
  assert.deepEqual(pointerPositionAt(samples, 5_000), { x: 100, y: 50 });
  assert.deepEqual(scrollPositionAt([[0, 0, 0], [900, 0, 320]], 899), { x: 0, y: 0 });
  assert.deepEqual(scrollPositionAt([[0, 0, 0], [900, 0, 320]], 900), { x: 0, y: 320 });
  assert.equal(activeEventIndex([{ offsetMs: 100 }, { offsetMs: 300 }], 50), -1);
  assert.equal(activeEventIndex([{ offsetMs: 100 }, { offsetMs: 300 }], 300), 1);
});

class FakeRecorder extends EventTarget {
  static instances = [];
  static isTypeSupported(type) {
    return type.startsWith("video/webm") || type.startsWith("audio/webm");
  }

  constructor(stream, options) {
    super();
    this.stream = stream;
    this.options = options;
    this.mimeType = options.mimeType;
    this.state = "inactive";
    FakeRecorder.instances.push(this);
  }

  start() { this.state = "recording"; }
  pause() { this.state = "paused"; }
  resume() { this.state = "recording"; }
  emit(text) {
    const event = new Event("dataavailable");
    event.data = new Blob([text]);
    this.dispatchEvent(event);
  }

  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.dispatchEvent(new Event("stop")));
  }
}

test("a recorder session restarts without re-requesting capture and stops into a typed Blob", async () => {
  FakeRecorder.instances = [];
  let unexpected = 0;
  const session = createRecorderSession({
    stream: { id: "stream" },
    hasVideo: true,
    hasAudio: true,
    RecorderClass: FakeRecorder,
    onUnexpectedStop: () => { unexpected += 1; },
  });
  const first = FakeRecorder.instances[0];
  assert.equal(first.options.mimeType, "video/webm;codecs=vp9,opus");
  assert.equal(first.options.videoBitsPerSecond, 1_200_000, "a 5-minute tab take stays under a 50 MB upload cap");
  assert.equal(first.options.audioBitsPerSecond, 96_000);
  first.emit("discarded take");
  session.pause();
  assert.equal(first.state, "paused");
  session.resume();
  session.restart();
  assert.equal(FakeRecorder.instances.length, 2, "restart reuses the approved stream with a new recorder");
  const second = FakeRecorder.instances[1];
  assert.equal(second.stream, first.stream);
  second.emit("final ");
  second.emit("take");
  const blob = await session.stop();
  assert.equal(blob.type, "video/webm");
  assert.equal(await blob.text(), "final take");
  await Promise.resolve();
  assert.equal(unexpected, 0, "stops requested by the session are not reported as unexpected");
});

test("a recorder that stops on its own reports it so the take can be kept", async () => {
  FakeRecorder.instances = [];
  let unexpected = 0;
  createRecorderSession({
    stream: {},
    hasVideo: false,
    hasAudio: true,
    RecorderClass: FakeRecorder,
    onUnexpectedStop: () => { unexpected += 1; },
  });
  const recorder = FakeRecorder.instances[0];
  assert.equal(recorder.options.mimeType, "audio/webm;codecs=opus");
  assert.equal("videoBitsPerSecond" in recorder.options, false);
  recorder.stop();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(unexpected, 1);
});

test("video feedback payloads keep a recording sidecar, pointer track, and privacy-safe steps", () => {
  const payload = videoPayload();
  assert.equal(payload.captureKind, "video");
  assert.deepEqual(payload.evidence, [{
    id: "evidence_video",
    kind: "recording",
    source: "media-recorder",
    quality: "captured",
    mimeType: "video/webm",
    byteSize: 48_000,
    durationMs: 12_400,
    pixelSize: { width: 1280, height: 720 },
    hasAudio: true,
    hasVideo: true,
  }]);
  assert.equal(payload.video.mode, "tab");
  assert.equal(payload.video.evidenceId, "evidence_video");
  assert.deepEqual(payload.video.pointer.samples, [[0, 10, 10], [50, 40, 30], [120, 60, 40]]);
  assert.deepEqual(payload.video.events[0], { type: "click", offsetMs: 7_000, targetIndex: 0, button: 0, x: 60, y: 40 });
  assert.equal(payload.interaction, undefined);
});

test("video payload normalization rejects leaks, unknown containers, and orphaned media", () => {
  const leaky = videoPayload({
    video: {
      ...videoPayload().video,
      durationMs: 99 * 60_000,
      events: [
        { type: "keydown", offsetMs: 10, key: "a" },
        { type: "input", offsetMs: 20, inputType: "password", value: "hunter2" },
        { type: "click", offsetMs: 30 * 60_000, button: 0 },
        { type: "telemetry", offsetMs: 40 },
      ],
      pointer: {
        samples: [[500, 1, 1], [100, 2, 2], ["x", 3, 3], [1, 2]],
        scrolls: "nope",
      },
    },
  });
  assert.equal(leaky.video.durationMs, MAX_VIDEO_DURATION_MS);
  assert.deepEqual(leaky.video.events, [
    { type: "input", offsetMs: 20, inputType: "password" },
    { type: "click", offsetMs: MAX_VIDEO_DURATION_MS, button: 0 },
  ]);
  assert.doesNotMatch(JSON.stringify(leaky), /hunter2/);
  assert.deepEqual(leaky.video.pointer.samples, [[500, 1, 1], [500, 2, 2], [500, 3, 3]]);
  assert.deepEqual(leaky.video.pointer.scrolls, []);

  const avi = videoPayload({ evidence: [{ ...recordingEvidence, mimeType: "video/x-msvideo" }] });
  assert.equal(avi.evidence[0].quality, "unavailable");
  assert.equal(avi.evidence[0].mimeType, null);
  // Videos from a phone's or Mac's own screen recorder are QuickTime.
  const quicktime = videoPayload({ evidence: [{ ...recordingEvidence, mimeType: "video/quicktime" }] });
  assert.deepEqual([quicktime.evidence[0].quality, quicktime.evidence[0].mimeType], ["captured", "video/quicktime"]);

  const orphaned = videoPayload({ evidence: [{ ...recordingEvidence, id: "someone_else" }] });
  assert.equal(orphaned.video, undefined, "a video without its recording evidence is dropped");
});

test("Markdown export gives agents a timed, code-searchable step list for videos", () => {
  const markdown = formatAnnotationsMarkdown([videoPayload()]);
  assert.match(markdown, /\*\*Video · tab recording · 0:12\*\*/);
  assert.match(markdown, /Recording: `video\/webm` · 0:12 · evidence `evidence_video`/);
  assert.match(markdown, /- 0:07 · click · Checkout \(`checkout-submit`\)/);
  assert.match(markdown, /- 0:08 · keydown · Enter/);
  assert.match(markdown, /omits input values and printable keystrokes/);
});

test("drawings travel with a video's payload, bounded", () => {
  const payload = videoPayload({
    video: {
      version: 1,
      mode: "voice",
      startedAt: "2026-10-16T10:00:00.000Z",
      durationMs: 12_400,
      evidenceId: "evidence_video",
      viewport: { width: 1280, height: 720 },
      pointer: { samples: [], scrolls: [] },
      events: [],
      drawings: [
        { offsetMs: 3_000, points: [[0, 10, 10], [40, 30.4, 12], [20, 50, 14], [90_000, 60, 20]] },
        { offsetMs: 99_000, points: [[0, 1, 1], [10, 2, 2]] },
        { offsetMs: 1_000, points: [[0, 1, 1]] },
        "junk",
      ],
    },
  });
  assert.deepEqual(payload.video.drawings, [
    { offsetMs: 3_000, points: [[0, 10, 10], [40, 30, 12], [40, 50, 14], [10_000, 60, 20]] },
    { offsetMs: 12_400, points: [[0, 1, 1], [10, 2, 2]] },
  ], "times stay in order and within ten seconds; one-point strokes are dropped");
  assert.equal("drawings" in videoPayload().video, false);
});

test("screen recordings ask for any screen or window, never this page, and fall back on older engines", async () => {
  const requests = [];
  const stream = { id: "screen" };
  const mediaDevices = {
    getDisplayMedia: async (constraints) => {
      requests.push(constraints);
      if (requests.length === 1) throw new TypeError("Unknown capture hint");
      return stream;
    },
  };
  assert.equal(await openScreenStream(mediaDevices), stream);
  assert.deepEqual(requests[0], {
    video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    monitorTypeSurfaces: "include",
  });
  assert.deepEqual(requests[1], { video: requests[0].video, audio: false });
  const declined = { getDisplayMedia: async () => { throw new DOMException("No", "NotAllowedError"); } };
  await assert.rejects(openScreenStream(declined), { name: "NotAllowedError" });
});

test("a screen recording keeps its mode, and exports name it", () => {
  const payload = createFeedbackPayload({
    projectKey: "lumen",
    route: "/checkout",
    targets: [{ tagName: "html", locatorCandidates: { domPath: "html" } }],
    captureKind: "video",
    evidence: [{ id: "rec", kind: "recording", mimeType: "video/webm", byteSize: 10, durationMs: 4_000 }],
    video: { mode: "screen", startedAt: "2026-10-23T10:00:00.000Z", durationMs: 4_000, evidenceId: "rec", events: [] },
    comment: "Pay does nothing",
  });
  assert.equal(payload.video.mode, "screen");
  assert.match(formatAnnotationsMarkdown([{ payload }]), /screen recording · 0:04/);
});

test("video titles, moments, trim and host notes survive normalisation (board 02, 7e-7g)", () => {
  const base = videoPayload().video;
  const payload = videoPayload({
    video: {
      ...base,
      title: "  Checkout walkthrough  ",
      moments: [{ offsetMs: 9_000 }, { offsetMs: 2_000 }, { offsetMs: 99_000 }],
      trim: { startMs: 1_000, endMs: 11_000 },
      notes: {
        status: "ready",
        summary: [{ offsetMs: 4_000, text: "Asks for a company name too early." }, { offsetMs: 1, text: "" }],
        chapters: [{ offsetMs: 0, title: "Sign-up" }],
        evil: "<script>",
      },
    },
  });
  assert.equal(payload.video.title, "Checkout walkthrough");
  assert.deepEqual(payload.video.moments, [{ offsetMs: 2_000 }, { offsetMs: 9_000 }, { offsetMs: 12_400 }]);
  assert.deepEqual(payload.video.trim, { startMs: 1_000, endMs: 11_000 });
  assert.deepEqual(payload.video.notes, {
    status: "ready",
    summary: [{ offsetMs: 4_000, text: "Asks for a company name too early." }],
    chapters: [{ offsetMs: 0, text: "Sign-up" }],
  });
});

test("an untrimmed or too-short trim and empty notes are dropped; processing notes are kept", () => {
  const base = videoPayload().video;
  const whole = videoPayload({ video: { ...base, trim: { startMs: 0, endMs: 12_400 }, notes: { status: "ready" } } });
  assert.equal("trim" in whole.video, false);
  assert.equal("notes" in whole.video, false);
  const tiny = videoPayload({ video: { ...base, trim: { startMs: 5_000, endMs: 5_400 }, notes: { status: "processing" } } });
  assert.equal("trim" in tiny.video, false);
  assert.deepEqual(tiny.video.notes, { status: "processing" });
});

test("suggested video titles come from the page title, or the route", () => {
  assert.equal(suggestVideoTitle("Sign-up | Northstar", "/signup"), "Sign-up walkthrough");
  assert.equal(suggestVideoTitle("", "/"), "Home walkthrough");
  assert.equal(suggestVideoTitle("", "/account/billing-settings"), "Billing settings walkthrough");
});

test("the countdown defaults to three seconds and stays between 0 and 5", () => {
  assert.equal(resolveVideoRecordingOptions({ countdownSeconds: 0 }).countdownSeconds, 0);
  assert.equal(resolveVideoRecordingOptions({ countdownSeconds: 30 }).countdownSeconds, 5);
  assert.equal(resolveVideoRecordingOptions({}).countdownSeconds, 3);
});

function fakeDisplay(surface) {
  const stopped = [];
  const track = { kind: "video", stop: () => stopped.push("video"), getSettings: () => (surface === undefined ? {} : { displaySurface: surface }) };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  return { stopped, mediaDevices: { getDisplayMedia: async () => stream }, stream };
}

test("a shared window or whole screen is stopped before anything is recorded; a tab goes through", async () => {
  const { openTabStream, sharedSurface } = await import("../src/videoRecording.js");
  for (const surface of ["window", "monitor"]) {
    const fake = fakeDisplay(surface);
    await assert.rejects(openTabStream(fake.mediaDevices), (error) => error.name === "WrongSurfaceError" && error.surface === surface);
    assert.deepEqual(fake.stopped, ["video"]);
  }
  const tab = fakeDisplay("browser");
  assert.equal(await openTabStream(tab.mediaDevices), tab.stream);
  assert.deepEqual(tab.stopped, []);
  // An engine that doesn't report the surface can't be checked, so it isn't blocked.
  const unknown = fakeDisplay(undefined);
  assert.equal(await openTabStream(unknown.mediaDevices), unknown.stream);
  assert.equal(sharedSurface(unknown.stream), null);
});
