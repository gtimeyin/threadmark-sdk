import assert from "node:assert/strict";
import test from "node:test";

import { themeToCssVariables } from "../src/tours/theme.js";

test("theme values become CSS variables on the player", () => {
  assert.deepEqual(themeToCssVariables({
    accent: "#035D47",
    surface: "rgb(255 255 255 / 0.96)",
    text: "var(--brand-ink)",
    muted: "color-mix(in srgb, #1a1e1b 60%, white)",
    radius: 8,
    font: '"Geist", system-ui, sans-serif',
  }), {
    "--tm-tour-accent": "#035D47",
    "--tm-tour-surface": "rgb(255 255 255 / 0.96)",
    "--tm-tour-text": "var(--brand-ink)",
    "--tm-tour-muted": "color-mix(in srgb, #1a1e1b 60%, white)",
    "--tm-tour-radius": "8px",
    "--tm-tour-font": '"Geist", system-ui, sans-serif',
  });
});

test("theme values that could load something or break out of the value are dropped", () => {
  for (const value of [
    "url(https://tracker.example/pixel)",
    "URL (https://tracker.example/pixel)",
    "\\75 rl(https://tracker.example/pixel)",
    'image-set("https://tracker.example/a.png" 1x)',
    "-webkit-image-set(url(a.png) 1x)",
    "red; background: blue",
    "red } .x { color: blue",
    "@import 'x'",
    "red /* comment */",
    "</style>",
    "x".repeat(201),
  ]) {
    assert.deepEqual(themeToCssVariables({ accent: value }), {}, value);
  }
  assert.deepEqual(themeToCssVariables(null), {});
});
