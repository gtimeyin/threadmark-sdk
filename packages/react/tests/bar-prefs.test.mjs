import assert from "node:assert/strict";
import test from "node:test";
import { BAR_POSITIONS, nearestBarPosition } from "../src/barPrefs.js";

test("the bar snaps to the nearest of six places", () => {
  assert.equal(BAR_POSITIONS.length, 6);
  assert.equal(nearestBarPosition(50, 40, 1200, 800), "top-left");
  assert.equal(nearestBarPosition(600, 760, 1200, 800), "bottom-center");
  assert.equal(nearestBarPosition(1150, 790, 1200, 800), "bottom-right");
  assert.equal(nearestBarPosition(700, 100, 1200, 800), "top-center");
});
