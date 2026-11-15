import assert from "node:assert/strict";
import test from "node:test";

import {
  CANVAS_MUTATION_SOURCE,
  MAX_CANVAS_BYTES,
  canvasBlockSelectors,
  createCanvasBudget,
  createCanvasPainter,
  resolveCanvasOptions,
  sanitizeCanvasFrame,
} from "../src/canvasReplay.js";
import { OTHER_TOOLS_BLOCK_SELECTORS, OTHER_TOOLS_MASK_SELECTORS, SITE_PRIVATE_SELECTOR } from "../src/privacy.js";
import { EVENT_TYPE, decodeReplayEvents, resolveSessionReplayOptions, sanitizeReplayEvent, startSessionReplay } from "../src/sessionReplay.js";

// A long base64 run, which text scrubbing would redact.
const PIXELS = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA".repeat(4);
const frame = (timestamp, id = 7, base64 = PIXELS, type = "image/webp") => ({
  type: EVENT_TYPE.IncrementalSnapshot,
  timestamp,
  data: {
    source: CANVAS_MUTATION_SOURCE,
    id,
    type: 0,
    commands: [
      { property: "clearRect", args: [0, 0, 300, 150] },
      { property: "drawImage", args: [{ rr_type: "ImageBitmap", args: [{ rr_type: "Blob", data: [{ rr_type: "ArrayBuffer", base64 }], type }] }, 0, 0] },
    ],
  },
});
const meta = (timestamp) => ({ type: EVENT_TYPE.Meta, timestamp, data: { href: "https://app.test/", width: 1280, height: 800 } });
const full = (timestamp) => ({ type: EVENT_TYPE.FullSnapshot, timestamp, data: {} });

function recorderWindow() {
  return {
    location: { href: "https://app.test/" },
    console: { error() {}, warn() {}, log() {}, info() {}, debug() {} },
    fetch: async () => ({ status: 200 }),
    addEventListener() {},
    removeEventListener() {},
    document: { readyState: "complete", addEventListener() {}, removeEventListener() {} },
  };
}

test("canvas capture is opt-in and its rate and quality are bounded", () => {
  assert.equal(resolveSessionReplayOptions(true).canvas, null);
  assert.equal(resolveSessionReplayOptions(false).canvas, null);
  assert.deepEqual(resolveSessionReplayOptions({ canvas: true }).canvas, { fps: 2, quality: 0.6 });
  assert.deepEqual(resolveCanvasOptions({ fps: 60, quality: 1 }), { fps: 4, quality: 0.9 });
  assert.deepEqual(resolveCanvasOptions({ fps: 0, quality: 0 }), { fps: 1, quality: 0.3 });
  assert.deepEqual(resolveCanvasOptions(resolveCanvasOptions({ fps: 3, quality: 0.5 })), { fps: 3, quality: 0.5 }, "resolving twice changes nothing");
});

test("Quality's privacy attributes block and mask like other tools' markers", () => {
  assert.ok(OTHER_TOOLS_BLOCK_SELECTORS.includes("[data-quality-block]"));
  assert.ok(OTHER_TOOLS_MASK_SELECTORS.includes("[data-quality-mask]"));
  assert.match(SITE_PRIVATE_SELECTOR, /\[data-quality-block\]/);
  assert.match(SITE_PRIVATE_SELECTOR, /\[data-quality-mask\]/);
});

test("only sampled image frames are kept, rebuilt from known fields", () => {
  const kept = sanitizeCanvasFrame({ ...frame(10), extra: "<script>", data: { ...frame(10).data, extra: "x" } });
  assert.deepEqual(kept, frame(10));
  assert.equal(sanitizeCanvasFrame(frame(10, 7, PIXELS, "text/html")), null, "only raster image types");
  assert.equal(sanitizeCanvasFrame(frame(10, 7, "not base64!")), null);
  assert.equal(sanitizeCanvasFrame(frame(10, "7")), null);
  const commandMode = { type: 3, timestamp: 10, data: { source: CANVAS_MUTATION_SOURCE, id: 7, type: 0, property: "fillText", args: ["Jane Doe", 0, 0] } };
  assert.equal(sanitizeCanvasFrame(commandMode), null, "per-call recording (which carries drawn text) is dropped");
});

test("a snapshot's canvas image is kept only as an inline raster data URL", () => {
  const event = (value) => ({ type: 2, timestamp: 1, data: { node: { tagName: "canvas", attributes: { rr_dataURL: value } } } });
  const safe = `data:image/webp;base64,${PIXELS}`;
  assert.equal(sanitizeReplayEvent(event(safe), undefined, () => true).data.node.attributes.rr_dataURL, safe);
  assert.equal(sanitizeReplayEvent(event(safe)).data.node.attributes.rr_dataURL, "");
  const budget = createCanvasBudget({ bufferMs: 30_000, maxHoldMs: 660_000, maxBytes: safe.length });
  const keep = (bytes) => budget.take(1, bytes);
  assert.equal(sanitizeReplayEvent(event(safe), undefined, keep).data.node.attributes.rr_dataURL, safe);
  assert.equal(sanitizeReplayEvent(event(safe), undefined, keep).data.node.attributes.rr_dataURL, "");
  assert.equal(sanitizeReplayEvent(event("data:text/html;base64,PHNjcmlwdD4="), undefined, () => true).data.node.attributes.rr_dataURL, "");
  assert.equal(sanitizeReplayEvent(event("https://cdn.test/a.png?token=SECRET")).data.node.attributes.rr_dataURL, "");
});

test("canvases inside masked regions are blocked, since pixels can't be masked", () => {
  assert.deepEqual(canvasBlockSelectors(["[data-quality-mask]", ""]), [":is([data-quality-mask]) canvas", "canvas:is([data-quality-mask])"]);
});

test("the byte budget rolls with the history window and grows while a video holds it", () => {
  const budget = createCanvasBudget({ bufferMs: 30_000, maxHoldMs: 660_000, maxBytes: 100, maxHeldBytes: 250 });
  assert.equal(budget.take(0, 60), true);
  assert.equal(budget.take(1_000, 60), false, "over budget within the window");
  assert.equal(budget.take(31_000, 60), true, "older frames roll off");
  budget.hold(31_000);
  assert.equal(budget.take(32_000, 100), true);
  assert.equal(budget.take(33_000, 100), false, "the held budget is bounded too");
  budget.release();
  assert.equal(budget.take(70_000, 60), true);
  assert.equal(MAX_CANVAS_BYTES, 6_000_000);
});

test("the recorder samples canvases only when asked, and keeps frame pixels unscrubbed", async () => {
  let options;
  const record = (value) => { options = value; return () => {}; };
  const off = await startSessionReplay({ windowRef: recorderWindow(), loadRecorder: async () => record });
  assert.equal(options.recordCanvas, false);
  assert.equal(options.sampling.canvas, undefined);
  assert.doesNotMatch(options.blockSelector, /canvas/);
  const now = Date.now();
  options.emit(meta(now), true);
  options.emit(full(now));
  options.emit(frame(now + 1));
  assert.equal((await decodeReplayEvents((await off.capture()).blob)).length, 2, "frames are dropped when canvas capture is off");
  off.stop();

  const on = await startSessionReplay({ windowRef: recorderWindow(), canvas: { fps: 3, quality: 0.5 }, loadRecorder: async () => record });
  assert.equal(options.recordCanvas, true);
  assert.equal(options.sampling.canvas, 3);
  assert.deepEqual(options.dataURLOptions, { type: "image/webp", quality: 0.5 });
  assert.match(options.blockSelector, /:is\(\[data-quality-mask\]\) canvas/);
  options.emit(meta(now), true);
  options.emit(full(now));
  options.emit(frame(now + 1));
  options.emit({ type: 3, timestamp: now + 2, data: { source: CANVAS_MUTATION_SOURCE, id: 7, type: 0, property: "fillText", args: ["Jane Doe"] } });
  const events = await decodeReplayEvents((await on.capture()).blob);
  assert.equal(events.length, 3);
  assert.equal(events[2].data.commands[1].args[0].args[0].data[0].base64, PIXELS);
  assert.doesNotMatch(JSON.stringify(events), /Jane Doe/);
  on.stop();
});

test("the player paints the latest frame at the playback position onto the replay's canvas", async () => {
  const drawn = [];
  const canvas = { nodeName: "CANVAS", width: 300, height: 150, getContext: () => ({ clearRect() {}, drawImage: (bitmap) => drawn.push(bitmap) }) };
  const nodes = new Map([[7, canvas], [8, { nodeName: "DIV" }]]);
  let time = 0;
  const replayer = { getMetaData: () => ({ startTime: 1_000 }), getCurrentTime: () => time, getMirror: () => ({ getNode: (id) => nodes.get(id) ?? null }) };
  const events = [meta(1_000), frame(1_500, 7, "QQ=="), frame(2_000, 7, "Qg=="), frame(1_200, 8), frame(1_100, 9)];
  let clock = 0;
  const painter = createCanvasPainter(events, { decode: async (image) => image.base64, clock: () => clock });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  painter.paint(replayer);
  await settle();
  assert.deepEqual(drawn, [], "nothing before the first frame; non-canvas and missing nodes are skipped");
  time = 600;
  painter.paint(replayer);
  painter.paint(replayer);
  await settle();
  assert.deepEqual(drawn, ["QQ=="], "an unchanged frame is painted once");
  time = 5_000;
  painter.paint(replayer);
  await settle();
  assert.deepEqual(drawn, ["QQ==", "Qg=="]);
  painter.reset();
  painter.paint(replayer);
  await settle();
  assert.equal(drawn.length, 3, "after a rebuild the current frame is painted again");
  clock = 1_000;
  painter.paint(replayer);
  await settle();
  assert.equal(drawn.length, 3);
  painter.destroy();
});
