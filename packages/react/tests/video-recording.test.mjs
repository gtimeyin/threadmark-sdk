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
  pickRecorderMimeType,
  pointerPositionAt,
  resolveVideoRecordingOptions,
  scrollPositionAt,
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
  assert.deepEqual(resolveVideoRecordingOptions(undefined), { enabled: true, maxDurationMs: DEFAULT_VIDEO_MAX_DURATION_MS });
  assert.deepEqual(resolveVideoRecordingOptions(true), { enabled: true, maxDurationMs: DEFAULT_VIDEO_MAX_DURATION_MS });
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
  clock.reset();
  assert.equal(clock.elapsed(), 0);
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

  const quicktime = videoPayload({ evidence: [{ ...recordingEvidence, mimeType: "video/quicktime" }] });
  assert.equal(quicktime.evidence[0].quality, "unavailable");
  assert.equal(quicktime.evidence[0].mimeType, null);

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
