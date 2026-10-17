// Loom-style video feedback: current-tab capture with voice and an optional camera bubble, or a
// voice (and camera) recording whose pointer path is replayed over the live page when tab capture
// is unavailable. Pure helpers are exported for tests; media access only happens on request.

export const DEFAULT_VIDEO_MAX_DURATION_MS = 5 * 60_000;
export const MAX_VIDEO_DURATION_MS = 10 * 60_000;
export const MIN_VIDEO_DURATION_MS = 5_000;
export const MAX_VIDEO_EVENTS = 500;
export const MAX_POINTER_SAMPLES = 12_000;
export const MAX_SCROLL_SAMPLES = 2_000;
export const POINTER_SAMPLE_INTERVAL_MS = 50;
// Screen content compresses well; these rates keep a 5-minute take under common 50 MB upload caps.
export const TAB_VIDEO_BITS_PER_SECOND = 1_200_000;
export const CAMERA_VIDEO_BITS_PER_SECOND = 800_000;
export const AUDIO_BITS_PER_SECOND = 96_000;
const POINTER_MIN_DISTANCE_PX = 2;
const SCROLL_SAMPLE_INTERVAL_MS = 100;

export const RECORDING_MIME_TYPES = Object.freeze([
  "video/webm",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
]);

const RECORDER_CANDIDATES = {
  videoWithAudio: [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ],
  videoOnly: [
    'video/mp4;codecs="avc1.42E01E"',
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ],
  audioOnly: [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ],
};

/** `videoRecording` prop → effective options. `false` turns the capability off. */
export function resolveVideoRecordingOptions(value) {
  if (value === false) return { enabled: false, maxDurationMs: DEFAULT_VIDEO_MAX_DURATION_MS };
  const requested = Number(value && typeof value === "object" ? value.maxDurationMs : NaN);
  const maxDurationMs = Number.isFinite(requested)
    ? Math.round(Math.min(MAX_VIDEO_DURATION_MS, Math.max(MIN_VIDEO_DURATION_MS, requested)))
    : DEFAULT_VIDEO_MAX_DURATION_MS;
  return { enabled: true, maxDurationMs };
}

/** What this browser can record. Tab capture needs getDisplayMedia, which phones do not offer. */
export function detectVideoSupport(windowRef = globalThis.window) {
  const mediaDevices = windowRef?.navigator?.mediaDevices;
  const recorder = typeof windowRef?.MediaRecorder === "function";
  const userMedia = typeof mediaDevices?.getUserMedia === "function";
  const coarsePointer = Boolean(windowRef?.matchMedia?.("(pointer: coarse)")?.matches);
  return {
    tab: recorder && typeof mediaDevices?.getDisplayMedia === "function" && !coarsePointer,
    voice: recorder && userMedia,
  };
}

/** First container/codec this browser can record, preferring MP4 (H.264/AAC) for portability. */
export function pickRecorderMimeType({ video, audio }, isTypeSupported) {
  const candidates = video
    ? audio ? RECORDER_CANDIDATES.videoWithAudio : RECORDER_CANDIDATES.videoOnly
    : RECORDER_CANDIDATES.audioOnly;
  if (typeof isTypeSupported !== "function") return "";
  return candidates.find((candidate) => {
    try {
      return isTypeSupported(candidate);
    } catch {
      return false;
    }
  }) || "";
}

/** "video/webm;codecs=vp9,opus" → "video/webm"; unknown containers fall back by track kind. */
export function baseMimeType(mimeType, { video = true } = {}) {
  const base = String(mimeType || "").split(";")[0].trim().toLowerCase();
  if (RECORDING_MIME_TYPES.includes(base)) return base;
  return video ? "video/webm" : "audio/webm";
}

export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Pointer path in viewport CSS pixels plus window scroll, each sample as [offsetMs, x, y]. */
export function createPointerTrack({ width = 0, height = 0, scrollX = 0, scrollY = 0 } = {}) {
  return {
    viewport: { width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height)) },
    samples: [],
    scrolls: [[0, Math.round(scrollX), Math.round(scrollY)]],
  };
}

/** Adds a pointer sample at most every POINTER_SAMPLE_INTERVAL_MS and only after real movement. */
export function appendPointerSample(track, offsetMs, x, y, { force = false } = {}) {
  if (!track || track.samples.length >= MAX_POINTER_SAMPLES) return false;
  const sample = [Math.max(0, Math.round(offsetMs)), Math.round(x), Math.round(y)];
  const previous = track.samples[track.samples.length - 1];
  if (previous && !force) {
    if (sample[0] - previous[0] < POINTER_SAMPLE_INTERVAL_MS) return false;
    if (Math.hypot(sample[1] - previous[1], sample[2] - previous[2]) < POINTER_MIN_DISTANCE_PX) return false;
  }
  if (previous && sample[0] < previous[0]) sample[0] = previous[0];
  track.samples.push(sample);
  return true;
}

export function appendScrollSample(track, offsetMs, scrollX, scrollY) {
  if (!track || track.scrolls.length >= MAX_SCROLL_SAMPLES) return false;
  const sample = [Math.max(0, Math.round(offsetMs)), Math.round(scrollX), Math.round(scrollY)];
  const previous = track.scrolls[track.scrolls.length - 1];
  if (previous && previous[1] === sample[1] && previous[2] === sample[2]) return false;
  if (previous && sample[0] - previous[0] < SCROLL_SAMPLE_INTERVAL_MS) {
    // Keep the latest position inside a burst so replay ends where the reviewer stopped.
    previous[1] = sample[1];
    previous[2] = sample[2];
    return true;
  }
  if (previous && sample[0] < previous[0]) sample[0] = previous[0];
  track.scrolls.push(sample);
  return true;
}

function lastIndexAtOrBefore(samples, offsetMs) {
  let low = 0;
  let high = samples.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (samples[middle][0] <= offsetMs) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** Interpolated pointer position at a playback offset, or null before the first movement. */
export function pointerPositionAt(samples, offsetMs) {
  if (!Array.isArray(samples) || !samples.length) return null;
  const index = lastIndexAtOrBefore(samples, offsetMs);
  if (index < 0) return null;
  const current = samples[index];
  const next = samples[index + 1];
  if (!next || next[0] === current[0]) return { x: current[1], y: current[2] };
  const progress = Math.min(1, Math.max(0, (offsetMs - current[0]) / (next[0] - current[0])));
  return {
    x: current[1] + (next[1] - current[1]) * progress,
    y: current[2] + (next[2] - current[2]) * progress,
  };
}

/** Window scroll in effect at a playback offset (scroll is a step function, not interpolated). */
export function scrollPositionAt(scrolls, offsetMs) {
  if (!Array.isArray(scrolls) || !scrolls.length) return { x: 0, y: 0 };
  const index = Math.max(0, lastIndexAtOrBefore(scrolls, offsetMs));
  return { x: scrolls[index][1], y: scrolls[index][2] };
}

/** Index of the last timeline event at or before the playback offset. */
export function activeEventIndex(events, offsetMs) {
  if (!Array.isArray(events)) return -1;
  let active = -1;
  for (let index = 0; index < events.length; index += 1) {
    if ((events[index]?.offsetMs || 0) <= offsetMs) active = index;
    else break;
  }
  return active;
}

/** Elapsed recording time that excludes paused spans. */
export function createRecordingClock(now = () => Date.now()) {
  let startedAt = now();
  let pausedAt = null;
  let pausedTotal = 0;
  return {
    elapsed() {
      const reference = pausedAt ?? now();
      return Math.max(0, reference - startedAt - pausedTotal);
    },
    pause() {
      if (pausedAt == null) pausedAt = now();
    },
    resume() {
      if (pausedAt == null) return;
      pausedTotal += now() - pausedAt;
      pausedAt = null;
    },
    reset() {
      startedAt = now();
      pausedAt = null;
      pausedTotal = 0;
    },
    get paused() {
      return pausedAt != null;
    },
  };
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() || []) {
    try {
      track.stop();
    } catch {
      // A track can already be ended by the browser's own "Stop sharing" control.
    }
  }
}

export { stopStream };

/** Camera and microphone preview for the setup panel; either may be off. */
export async function openPreviewStream({
  camera,
  microphone,
  cameraDeviceId,
  microphoneDeviceId,
  mediaDevices = globalThis.navigator?.mediaDevices,
}) {
  if (!camera && !microphone) return null;
  return mediaDevices.getUserMedia({
    video: camera
      ? {
        ...(cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : {}),
        width: { ideal: 640 },
        height: { ideal: 640 },
        frameRate: { ideal: 30 },
      }
      : false,
    audio: microphone
      ? {
        ...(microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
      : false,
  });
}

export async function listMediaDevices(mediaDevices = globalThis.navigator?.mediaDevices) {
  try {
    const devices = await mediaDevices?.enumerateDevices?.();
    const pick = (kind) => (devices || [])
      .filter((device) => device.kind === kind && device.deviceId)
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || (kind === "videoinput" ? `Camera ${index + 1}` : `Microphone ${index + 1}`),
      }));
    return { cameras: pick("videoinput"), microphones: pick("audioinput") };
  } catch {
    return { cameras: [], microphones: [] };
  }
}

/** Current-tab capture. The browser asks the reviewer to confirm; a refusal rejects. */
export async function openTabStream(mediaDevices = globalThis.navigator?.mediaDevices) {
  const video = {
    displaySurface: "browser",
    frameRate: { ideal: 30 },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
  const preferred = {
    video,
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  };
  try {
    return await mediaDevices.getDisplayMedia(preferred);
  } catch (error) {
    // Older engines reject unknown capture hints with a TypeError; a reviewer's refusal is not retried.
    if (error?.name !== "TypeError") throw error;
    return mediaDevices.getDisplayMedia({ video, audio: false });
  }
}

/**
 * One MediaRecorder run over a composed stream. Restart creates a fresh recorder on the same
 * tracks, so the reviewer never has to approve tab capture twice.
 */
export function createRecorderSession({
  stream,
  hasVideo,
  hasAudio,
  videoBitsPerSecond = TAB_VIDEO_BITS_PER_SECOND,
  RecorderClass = globalThis.MediaRecorder,
  onUnexpectedStop,
}) {
  const recorderMimeType = pickRecorderMimeType(
    { video: hasVideo, audio: hasAudio },
    (type) => RecorderClass.isTypeSupported?.(type),
  );
  const options = {
    ...(recorderMimeType ? { mimeType: recorderMimeType } : {}),
    ...(hasVideo ? { videoBitsPerSecond } : {}),
    ...(hasAudio ? { audioBitsPerSecond: AUDIO_BITS_PER_SECOND } : {}),
  };
  // Recorders this session stopped on purpose; any other stop (an ended track) is unexpected.
  const expectedStops = new WeakSet();
  let recorder = null;
  let chunks = [];
  let finishing = null;

  const blobType = (active) => baseMimeType(active?.mimeType || recorderMimeType, { video: hasVideo });
  const halt = (active) => {
    if (!active || active.state === "inactive") return;
    expectedStops.add(active);
    active.stop();
  };
  const begin = () => {
    const runChunks = [];
    chunks = runChunks;
    finishing = null;
    const next = new RecorderClass(stream, options);
    next.addEventListener("dataavailable", (event) => {
      if (event.data?.size) runChunks.push(event.data);
    });
    next.addEventListener("stop", () => {
      if (!expectedStops.has(next)) onUnexpectedStop?.();
    });
    recorder = next;
    next.start(1000);
  };

  begin();

  return {
    get mimeType() {
      return blobType(recorder);
    },
    pause() {
      if (recorder?.state === "recording") recorder.pause();
    },
    resume() {
      if (recorder?.state === "paused") recorder.resume();
    },
    restart() {
      halt(recorder);
      begin();
    },
    discard() {
      halt(recorder);
      chunks = [];
      finishing = Promise.resolve(null);
    },
    stop() {
      if (finishing) return finishing;
      const active = recorder;
      const runChunks = chunks;
      finishing = new Promise((resolve, reject) => {
        if (!active || active.state === "inactive") {
          resolve(new Blob(runChunks, { type: blobType(active) }));
          return;
        }
        active.addEventListener("stop", () => resolve(new Blob(runChunks, { type: blobType(active) })), { once: true });
        active.addEventListener("error", (event) => reject(event.error || new Error("Recording failed.")), { once: true });
        try {
          halt(active);
        } catch (error) {
          reject(error);
        }
      });
      return finishing;
    },
  };
}

/** Reads duration and dimensions from a recorded Blob; MediaRecorder WebM often reports Infinity. */
export async function readRecordingMetadata(blob, { fallbackDurationMs = 0, documentRef = globalThis.document } = {}) {
  const fallback = { durationMs: Math.max(0, Math.round(fallbackDurationMs)), width: 0, height: 0 };
  if (!blob || !documentRef?.createElement || typeof URL === "undefined") return fallback;
  const url = URL.createObjectURL(blob);
  const element = documentRef.createElement(blob.type.startsWith("audio/") ? "audio" : "video");
  element.preload = "metadata";
  element.muted = true;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 3000);
      element.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(); }, { once: true });
      element.addEventListener("error", () => { clearTimeout(timer); reject(new Error("metadata")); }, { once: true });
      element.src = url;
    });
    const duration = Number(element.duration);
    return {
      durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) : fallback.durationMs,
      width: Math.max(0, Number(element.videoWidth) || 0),
      height: Math.max(0, Number(element.videoHeight) || 0),
    };
  } catch {
    return fallback;
  } finally {
    element.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}
