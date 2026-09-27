import assert from "node:assert/strict";
import test from "node:test";

import { computePopoverPosition } from "../src/popover.js";

const popover = { width: 320, height: 180 };
const viewport = { width: 1200, height: 800 };

test("centers the popover below its target when it fits", () => {
  assert.deepEqual(computePopoverPosition({
    anchor: { left: 440, top: 200, width: 200, height: 60 },
    popover,
    viewport,
  }), {
    left: 380,
    top: 268,
    side: "below",
  });
});

test("flips above a target near the bottom edge", () => {
  const result = computePopoverPosition({
    anchor: { left: 440, top: 730, width: 200, height: 40 },
    popover,
    viewport,
  });

  assert.equal(result.side, "above");
  assert.equal(result.top, 542);
});

test("keeps the popover inside the viewport when no side fully fits", () => {
  const result = computePopoverPosition({
    anchor: { left: 2, top: 2, width: 12, height: 12 },
    popover: { width: 320, height: 756 },
    viewport: { width: 360, height: 780 },
  });

  assert.ok(result.left >= 12);
  assert.ok(result.top >= 12);
  assert.ok(result.left + 320 <= 348);
  assert.ok(result.top + 756 <= 768);
});
