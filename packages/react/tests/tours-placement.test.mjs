import assert from "node:assert/strict";
import test from "node:test";

import { placeCard, scrollForSheet } from "../src/tours/placement.js";

const desktop = { width: 1280, height: 800 };
const card = { width: 320, height: 180 };
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });

test("phones and explicit sheets always use a bottom sheet", () => {
  assert.deepEqual(placeCard({ target: rect(10, 10, 50, 20), card, viewport: { width: 390, height: 844 } }), { mode: "sheet" });
  assert.deepEqual(placeCard({ target: rect(10, 10, 50, 20), card, viewport: desktop, placement: "sheet" }), { mode: "sheet" });
});

test("steps with nothing to point at sit in the centre", () => {
  assert.deepEqual(placeCard({ target: null, card, viewport: desktop }), { mode: "center" });
});

test("auto placement prefers below, then above, right, and left", () => {
  assert.equal(placeCard({ target: rect(500, 100, 120, 36), card, viewport: desktop }).side, "bottom");
  assert.equal(placeCard({ target: rect(500, 700, 120, 36), card, viewport: desktop }).side, "top");
  assert.equal(placeCard({ target: rect(20, 120, 200, 600), card, viewport: desktop }).side, "right");
  assert.equal(placeCard({ target: rect(940, 120, 330, 600), card, viewport: desktop }).side, "left");
});

test("a preferred side wins when it fits and falls back when it doesn't", () => {
  assert.equal(placeCard({ target: rect(500, 300, 120, 36), card, viewport: desktop, placement: "right" }).side, "right");
  assert.equal(placeCard({ target: rect(1100, 300, 120, 36), card, viewport: desktop, placement: "right" }).side, "bottom");
});

test("cards centre on the target, stay inside the viewport, and aim the arrow at the target", () => {
  const centred = placeCard({ target: rect(500, 100, 120, 36), card, viewport: desktop });
  assert.deepEqual(centred, { mode: "anchored", side: "bottom", left: 400, top: 148, arrowOffset: 160 });

  const nearRightEdge = placeCard({ target: rect(1200, 100, 60, 30), card, viewport: desktop });
  assert.equal(nearRightEdge.left, desktop.width - 12 - card.width);
  assert.equal(nearRightEdge.arrowOffset, 1230 - nearRightEdge.left);

  const pastTheEdge = placeCard({ target: rect(1262, 100, 18, 30), card, viewport: desktop });
  assert.equal(pastTheEdge.arrowOffset, card.width - 18);

  const above = placeCard({ target: rect(500, 700, 120, 36), card, viewport: desktop });
  assert.equal(above.top, 700 - 12 - card.height);
});

test("a target with no room on any side falls back to a sheet", () => {
  assert.deepEqual(placeCard({ target: rect(0, 0, 1280, 800), card, viewport: desktop }), { mode: "sheet" });
});

test("sheets scroll the page so the target sits above them", () => {
  const phone = { width: 390, height: 844 };
  assert.equal(scrollForSheet({ target: rect(20, 100, 120, 40), sheetHeight: 240, viewport: phone }), 0);
  const hidden = scrollForSheet({ target: rect(20, 700, 120, 40), sheetHeight: 240, viewport: phone });
  assert.ok(hidden > 0);
  const after = rect(20, 700 - hidden, 120, 40);
  assert.ok(after.top >= 16 && after.bottom <= phone.height - 240 - 16);
  assert.ok(scrollForSheet({ target: rect(20, -200, 120, 40), sheetHeight: 240, viewport: phone }) < 0);
  assert.equal(scrollForSheet({ target: null, sheetHeight: 240, viewport: phone }), 0);
});
