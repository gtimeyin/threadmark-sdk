import assert from "node:assert/strict";
import test from "node:test";

import {
  addMarkupStroke,
  clearMarkupStrokes,
  composeMarkupSnapshot,
  mapMarkupPoint,
  simplifyMarkupPoints,
  undoMarkupStroke,
} from "../src/snapshot.js";

test("maps client coordinates into intrinsic screenshot coordinates", () => {
  const displayRect = { left: 100, top: 50, width: 400, height: 200 };
  const bitmapSize = { width: 800, height: 400 };

  assert.deepEqual(
    mapMarkupPoint({ x: 300, y: 150 }, displayRect, bitmapSize),
    { x: 400, y: 200 },
  );
  assert.deepEqual(
    mapMarkupPoint({ x: 100, y: 50 }, displayRect, bitmapSize),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    mapMarkupPoint({ x: 500, y: 250 }, displayRect, bitmapSize),
    { x: 800, y: 400 },
  );
});

test("clamps markup points to the screenshot and handles unusable geometry", () => {
  const displayRect = { left: 100, top: 50, width: 400, height: 200 };
  const bitmapSize = { width: 800, height: 400 };

  assert.deepEqual(
    mapMarkupPoint({ x: -50, y: 500 }, displayRect, bitmapSize),
    { x: 0, y: 400 },
  );
  assert.deepEqual(
    mapMarkupPoint(
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      { left: 0, top: 0, width: 0, height: 0 },
      bitmapSize,
    ),
    { x: 0, y: 0 },
  );
});

test("simplifies dense markup points while preserving endpoints", () => {
  const input = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 4 },
    { x: 4, y: 5 },
    { x: 10, y: 10 },
  ];

  const result = simplifyMarkupPoints(input, 5);

  assert.deepEqual(result, [
    { x: 0, y: 0 },
    { x: 3, y: 4 },
    { x: 10, y: 10 },
  ]);
  assert.notEqual(result, input);
  assert.deepEqual(input, [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 4 },
    { x: 4, y: 5 },
    { x: 10, y: 10 },
  ]);
});

test("normalizes malformed stroke point input without mutating it", () => {
  const input = [
    { x: 1, y: 2 },
    null,
    { x: Number.NaN, y: 3 },
    { x: 6, y: 8 },
  ];

  assert.deepEqual(simplifyMarkupPoints(input, -1), [
    { x: 1, y: 2 },
    { x: 6, y: 8 },
  ]);
  assert.equal(input.length, 4);
  assert.equal(input[1], null);
});

test("adds, undoes, and clears strokes immutably", () => {
  const first = {
    id: "stroke-1",
    color: "#ff5c4d",
    width: 5,
    points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  };
  const second = {
    id: "stroke-2",
    color: "#3478f6",
    width: 8,
    points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
  };
  const original = [first];

  const added = addMarkupStroke(original, second);
  assert.deepEqual(added, [first, second]);
  assert.notEqual(added, original);
  assert.deepEqual(original, [first]);

  const undone = undoMarkupStroke(added);
  assert.deepEqual(undone, [first]);
  assert.notEqual(undone, added);
  assert.deepEqual(added, [first, second]);

  const cleared = clearMarkupStrokes(added);
  assert.deepEqual(cleared, []);
  assert.notEqual(cleared, added);
  assert.deepEqual(added, [first, second]);

  assert.deepEqual(undoMarkupStroke([]), []);
  assert.deepEqual(clearMarkupStrokes(null), []);
});

test("rejects incomplete strokes instead of creating invisible history entries", () => {
  const original = [{
    id: "stroke-1",
    color: "#ff5c4d",
    width: 5,
    points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  }];

  for (const incomplete of [
    null,
    {},
    { id: "empty", points: [] },
    { id: "dot", points: [{ x: 1, y: 2 }] },
  ]) {
    const result = addMarkupStroke(original, incomplete);
    assert.deepEqual(result, original);
    assert.notEqual(result, original);
  }
  assert.equal(original.length, 1);
});

test("composes valid round strokes into the base raster without serializing stroke data", async () => {
  const calls = [];
  const decoded = {
    width: 320,
    height: 180,
    close() { calls.push(["close"]); },
  };
  const context = {
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    beginPath() { calls.push(["beginPath"]); },
    moveTo(x, y) { calls.push(["moveTo", x, y]); },
    lineTo(x, y) { calls.push(["lineTo", x, y]); },
    stroke() { calls.push(["stroke"]); },
    set lineCap(value) { calls.push(["lineCap", value]); },
    set lineJoin(value) { calls.push(["lineJoin", value]); },
    set strokeStyle(value) { calls.push(["strokeStyle", value]); },
    set lineWidth(value) { calls.push(["lineWidth", value]); },
  };
  const outputBlob = { type: "image/webp", size: 12345 };
  const canvas = {
    width: 0,
    height: 0,
    getContext(kind, options) {
      assert.equal(kind, "2d");
      assert.deepEqual(options, { alpha: false });
      return context;
    },
    toBlob(callback, type, quality) {
      calls.push(["toBlob", type, quality]);
      callback(outputBlob);
    },
  };
  const documentRef = {
    createElement(tagName) {
      assert.equal(tagName, "canvas");
      return canvas;
    },
  };
  const windowRef = {
    async createImageBitmap(blob) {
      calls.push(["decode", blob]);
      return decoded;
    },
    CSS: {
      supports(property, value) {
        return property === "color" && value === "#ff5c4d";
      },
    },
  };
  const inputBlob = { type: "image/webp", size: 10000 };
  const metadata = {
    id: "evidence_1",
    kind: "snapshot",
    source: "dom-renderer",
    quality: "captured",
    mimeType: "image/webp",
    byteSize: 10000,
    pixelSize: { width: 320, height: 180 },
    redactionCount: 2,
    warnings: [],
    strokes: [{ sensitive: "must-not-survive" }],
  };

  const result = await composeMarkupSnapshot({
    blob: inputBlob,
    metadata,
    documentRef,
    windowRef,
    strokes: [
      {
        color: "#ff5c4d",
        width: 6,
        points: [{ x: 10, y: 20 }, { x: 20, y: 30 }, { x: 30, y: 40 }],
      },
      {
        color: "url(unsafe)",
        width: 8,
        points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      },
      {
        color: "#ff5c4d",
        width: 8,
        points: [{ x: 1, y: 2 }],
      },
    ],
  });

  assert.equal(canvas.width, 320);
  assert.equal(canvas.height, 180);
  assert.equal(result.blob, outputBlob);
  assert.deepEqual(result.metadata, {
    id: "evidence_1",
    kind: "snapshot",
    source: "dom-renderer",
    quality: "captured",
    mimeType: "image/webp",
    byteSize: 12345,
    pixelSize: { width: 320, height: 180 },
    redactionCount: 2,
    warnings: [],
  });
  assert.equal("strokes" in result.metadata, false);
  assert.deepEqual(calls, [
    ["decode", inputBlob],
    ["drawImage", decoded, 0, 0, 320, 180],
    ["beginPath"],
    ["lineCap", "round"],
    ["lineJoin", "round"],
    ["strokeStyle", "#ff5c4d"],
    ["lineWidth", 6],
    ["moveTo", 10, 20],
    ["lineTo", 20, 30],
    ["lineTo", 30, 40],
    ["stroke"],
    ["toBlob", "image/webp", 0.82],
    ["close"],
  ]);
});
