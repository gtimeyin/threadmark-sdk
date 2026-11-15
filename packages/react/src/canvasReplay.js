// Canvases in session replays (`sessionReplay.canvas`). rrweb samples each visible canvas a couple of times a
// second (2D and WebGL alike) and emits the frame as a compressed image. This module keeps only frames of
// that exact shape, bounds how many bytes of them a replay holds, and paints them back in the player.
//
// The player paints frames itself instead of using rrweb's `UNSAFE_replayCanvas`, which would let scripts
// run in the replay's iframe. Frames are pixels: anything drawn on a canvas is recorded as it appears, so
// canvases inside regions a site marked private are blocked, not masked.

export const CANVAS_MUTATION_SOURCE = 9;
const INCREMENTAL_SNAPSHOT = 3;
const IMAGE_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const SAFE_IMAGE_DATA_URL = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]*={0,2}$/;

export const DEFAULT_CANVAS_FPS = 2;
export const DEFAULT_CANVAS_QUALITY = 0.6;
/** Canvas frame bytes a replay keeps within its normal history window. */
export const MAX_CANVAS_BYTES = 6_000_000;
/** …and while a review holds the buffer (a video can keep up to 11 minutes). */
export const MAX_HELD_CANVAS_BYTES = 24_000_000;

/** `sessionReplay.canvas` → `{ fps, quality }`, or null when canvases stay out (the default). */
export function resolveCanvasOptions(value) {
  if (!value) return null;
  const options = typeof value === "object" ? value : {};
  const fps = Number(options.fps);
  const quality = Number(options.quality);
  return {
    fps: Number.isFinite(fps) ? Math.round(Math.min(4, Math.max(1, fps))) : DEFAULT_CANVAS_FPS,
    quality: Number.isFinite(quality) ? Math.min(0.9, Math.max(0.3, quality)) : DEFAULT_CANVAS_QUALITY,
  };
}

/** Selectors that block canvases inside regions whose text is masked: their pixels cannot be masked. */
export function canvasBlockSelectors(maskSelectors) {
  return maskSelectors.filter(Boolean).flatMap((selector) => [`:is(${selector}) canvas`, `canvas:is(${selector})`]);
}

export function isCanvasFrameEvent(event) {
  return event?.type === INCREMENTAL_SNAPSHOT && event.data?.source === CANVAS_MUTATION_SOURCE;
}

/** A canvas's image in a page snapshot (`rr_dataURL`) is kept only as an inline raster image. */
export function sanitizeCanvasDataUrl(value) {
  return typeof value === "string" && SAFE_IMAGE_DATA_URL.test(value) ? value : "";
}

/** The image a sampled frame carries, or null when the frame isn't one. */
function frameImage(data) {
  const commands = Array.isArray(data?.commands) ? data.commands : [];
  if (commands.length !== 2 || commands[0]?.property !== "clearRect" || commands[1]?.property !== "drawImage") return null;
  const [clearArgs, drawArgs] = [commands[0].args, commands[1].args];
  if (!Array.isArray(clearArgs) || clearArgs.length !== 4 || !clearArgs.every(Number.isFinite)) return null;
  const bitmap = Array.isArray(drawArgs) ? drawArgs[0] : null;
  const blob = bitmap?.rr_type === "ImageBitmap" && Array.isArray(bitmap.args) ? bitmap.args[0] : null;
  const buffer = blob?.rr_type === "Blob" && Array.isArray(blob.data) ? blob.data[0] : null;
  if (!buffer || buffer.rr_type !== "ArrayBuffer" || typeof buffer.base64 !== "string") return null;
  if (!IMAGE_TYPES.has(blob.type) || !BASE64.test(buffer.base64)) return null;
  return { type: blob.type, base64: buffer.base64, width: clearArgs[2], height: clearArgs[3] };
}

/**
 * Rebuilds a sampled canvas frame from known fields only, or returns null. Other canvas events (rrweb's
 * per-call command recording) are never kept.
 */
export function sanitizeCanvasFrame(event) {
  if (!isCanvasFrameEvent(event) || !Number.isInteger(event.data.id) || typeof event.timestamp !== "number") return null;
  const image = frameImage(event.data);
  if (!image) return null;
  return {
    type: INCREMENTAL_SNAPSHOT,
    timestamp: event.timestamp,
    data: {
      source: CANVAS_MUTATION_SOURCE,
      id: event.data.id,
      type: 0,
      commands: [
        { property: "clearRect", args: [0, 0, image.width, image.height] },
        {
          property: "drawImage",
          args: [{ rr_type: "ImageBitmap", args: [{ rr_type: "Blob", data: [{ rr_type: "ArrayBuffer", base64: image.base64 }], type: image.type }] }, 0, 0],
        },
      ],
    },
  };
}

/** Approximate bytes a sanitized frame holds. */
export function canvasFrameBytes(frame) {
  return frame.data.commands[1].args[0].args[0].data[0].base64.length;
}

/**
 * Rolling byte budget for canvas frames, over the same window the replay buffer keeps. Frames over budget
 * are dropped; the replay then shows the canvas's last kept frame.
 */
export function createCanvasBudget({ bufferMs, maxHoldMs, maxBytes = MAX_CANVAS_BYTES, maxHeldBytes = MAX_HELD_CANVAS_BYTES }) {
  let entries = [];
  let total = 0;
  let heldSince = null;
  return {
    take(timestamp, bytes) {
      const cutoff = heldSince === null ? timestamp - bufferMs : Math.max(heldSince - bufferMs, timestamp - maxHoldMs);
      while (entries.length && entries[0][0] < cutoff) total -= entries.shift()[1];
      if (total + bytes > (heldSince === null ? maxBytes : maxHeldBytes)) return false;
      entries.push([timestamp, bytes]);
      total += bytes;
      return true;
    },
    hold(now) {
      heldSince ??= now;
    },
    release() {
      heldSince = null;
    },
  };
}

function decodeFrame(image) {
  const binary = atob(image.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return createImageBitmap(new Blob([bytes], { type: image.type }));
}

/**
 * Paints recorded canvas frames onto the replay's canvases. Call `paint(replayer)` whenever the playback
 * position may have changed, and `reset()` after rrweb rebuilds the page from a snapshot.
 */
export function createCanvasPainter(events, { decode = decodeFrame, cacheSize = 24, clock = () => Date.now() } = {}) {
  const tracks = new Map();
  for (const event of events) {
    if (!isCanvasFrameEvent(event)) continue;
    const image = frameImage(event.data);
    if (!image) continue;
    if (!tracks.has(event.data.id)) tracks.set(event.data.id, []);
    tracks.get(event.data.id).push({ timestamp: event.timestamp, image });
  }
  for (const frames of tracks.values()) frames.sort((a, b) => a.timestamp - b.timestamp);
  const painted = new Map();
  const cache = new Map();
  // After a rebuild rrweb loads each canvas's snapshot image asynchronously, which can land after a frame
  // was painted; frames are repainted for a short while so the newer frame wins.
  let repaintUntil = 0;

  const bitmapFor = (id, index) => {
    const key = `${id}:${index}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = Promise.resolve().then(() => decode(tracks.get(id)[index].image));
      cache.set(key, pending);
      if (cache.size > cacheSize) {
        const [oldest, evicted] = cache.entries().next().value;
        cache.delete(oldest);
        evicted.then((bitmap) => bitmap?.close?.(), () => {});
      }
    }
    return pending;
  };

  return {
    get size() {
      return tracks.size;
    },
    paint(replayer) {
      if (!tracks.size || !replayer) return;
      const start = replayer.getMetaData?.().startTime;
      if (!Number.isFinite(start)) return;
      const now = start + replayer.getCurrentTime();
      const mirror = replayer.getMirror?.();
      for (const [id, frames] of tracks) {
        let low = 0;
        let high = frames.length - 1;
        let index = -1;
        while (low <= high) {
          const middle = (low + high) >> 1;
          if (frames[middle].timestamp <= now) { index = middle; low = middle + 1; } else high = middle - 1;
        }
        if (index < 0 || (painted.get(id) === index && clock() >= repaintUntil)) continue;
        const node = mirror?.getNode(id);
        if (!node || node.nodeName !== "CANVAS") continue;
        painted.set(id, index);
        bitmapFor(id, index).then((bitmap) => {
          if (painted.get(id) !== index || mirror.getNode(id) !== node) return;
          const context = node.getContext("2d");
          if (!context) return;
          context.clearRect(0, 0, node.width, node.height);
          context.drawImage(bitmap, 0, 0);
        }).catch(() => { /* a frame that can't be decoded leaves the previous one */ });
      }
    },
    reset() {
      painted.clear();
      repaintUntil = clock() + 500;
    },
    destroy() {
      painted.clear();
      for (const pending of cache.values()) pending.then((bitmap) => bitmap?.close?.(), () => {});
      cache.clear();
    },
  };
}
