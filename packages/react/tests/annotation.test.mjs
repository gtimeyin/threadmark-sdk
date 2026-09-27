import assert from "node:assert/strict";
import test from "node:test";

import {
  ANNOTATION_DRAG_THRESHOLD,
  formatAnnotationsMarkdown,
  gestureDistance,
  isAnnotationDrag,
  pausePage,
  rectContainsCenter,
  rectIntersects,
  shortcutAction,
  suppressHostEvent,
} from "../src/annotation.js";

test("uses an inclusive eight-pixel annotation drag threshold", () => {
  assert.equal(ANNOTATION_DRAG_THRESHOLD, 8);
  assert.equal(gestureDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(gestureDistance(null, { x: 3, y: 4 }), 0);
  assert.equal(isAnnotationDrag({ x: 10, y: 10 }, { x: 17.99, y: 10 }), false);
  assert.equal(isAnnotationDrag({ x: 10, y: 10 }, { x: 18, y: 10 }), true);
  assert.equal(isAnnotationDrag({ x: 0, y: 0 }, { x: 3, y: 4 }, 5), true);
});

test("blocks host handlers while preserving native text-selection defaults when requested", () => {
  const calls = [];
  const event = {
    preventDefault: () => calls.push("preventDefault"),
    stopPropagation: () => calls.push("stopPropagation"),
    stopImmediatePropagation: () => calls.push("stopImmediatePropagation"),
  };

  suppressHostEvent(event);
  assert.deepEqual(calls, ["preventDefault", "stopPropagation", "stopImmediatePropagation"]);

  calls.length = 0;
  suppressHostEvent(event, { preserveDefault: true });
  assert.deepEqual(calls, ["stopPropagation", "stopImmediatePropagation"]);
  assert.doesNotThrow(() => suppressHostEvent(null));
});

test("maps annotation shortcuts and ignores unrelated or modified keys", () => {
  assert.equal(shortcutAction({ key: "f", metaKey: true, shiftKey: true }), "toggle");
  assert.equal(shortcutAction({ key: "F", ctrlKey: true, shiftKey: true }), "toggle");
  assert.equal(shortcutAction({ key: "Escape" }), "escape");

  for (const [key, expected] of Object.entries({
    p: "pause",
    h: "visibility",
    c: "copy",
    x: "clear",
  })) {
    assert.equal(shortcutAction({ key }), expected, key);
    assert.equal(shortcutAction({ key: key.toUpperCase() }), expected, key.toUpperCase());
  }

  assert.equal(shortcutAction({ key: "p", shiftKey: true }), null);
  assert.equal(shortcutAction({ key: "h", metaKey: true }), null);
  assert.equal(shortcutAction({ key: "f", metaKey: true }), null);
  assert.equal(shortcutAction({ key: "z" }), null);
  assert.equal(shortcutAction({ key: "p", defaultPrevented: true }), null);
  assert.equal(shortcutAction({ key: "p", repeat: true }), null);
  assert.equal(shortcutAction(null), null);
});

test("guards shortcuts while typing but keeps Escape available", () => {
  const typingTarget = { closest: () => ({}) };
  const textNode = { nodeType: 3, parentElement: typingTarget };

  for (const target of [typingTarget, textNode]) {
    assert.equal(shortcutAction({ key: "p", target }), null);
    assert.equal(shortcutAction({ key: "h", target }), null);
    assert.equal(shortcutAction({ key: "x", target }), null);
    assert.equal(
      shortcutAction({ key: "f", metaKey: true, shiftKey: true, target }),
      null,
    );
    assert.equal(shortcutAction({ key: "Escape", target }), "escape");
  }

  const ordinaryTarget = { closest: () => null };
  assert.equal(shortcutAction({ key: "p", target: ordinaryTarget }), "pause");

  assert.equal(
    shortcutAction({
      key: "h",
      target: ordinaryTarget,
      composedPath: () => [typingTarget, ordinaryTarget],
    }),
    null,
    "typing inside the Shadow DOM must not trigger the global H shortcut",
  );

  const retargetedHost = { closest: () => null, shadowRoot: { activeElement: typingTarget } };
  retargetedHost.ownerDocument = { activeElement: retargetedHost };
  assert.equal(
    shortcutAction({ key: "h", target: retargetedHost, composedPath: () => [retargetedHost] }),
    null,
    "a key event retargeted to a Shadow DOM host must inspect the deepest active element",
  );
  assert.equal(
    shortcutAction({
      key: "p",
      target: ordinaryTarget,
      composedPath: () => { throw new Error("synthetic event"); },
    }),
    "pause",
  );
});

test("detects strict rectangle intersections", () => {
  const base = { left: 10, top: 20, width: 100, height: 50 };

  assert.equal(rectIntersects(base, { left: 20, top: 30, width: 10, height: 10 }), true);
  assert.equal(rectIntersects(base, { left: 0, top: 0, width: 200, height: 200 }), true);
  assert.equal(rectIntersects(base, { left: 110, top: 20, width: 10, height: 10 }), false);
  assert.equal(rectIntersects(base, { left: 20, top: 70, width: 10, height: 10 }), false);
  assert.equal(rectIntersects(base, null), false);
});

test("checks whether an item's center lies inside a rectangle", () => {
  const container = { left: 10, top: 20, width: 100, height: 50 };

  assert.equal(
    rectContainsCenter(container, { left: 20, top: 30, width: 20, height: 20 }),
    true,
  );
  assert.equal(
    rectContainsCenter(container, { left: 100, top: 60, width: 20, height: 20 }),
    true,
    "centers on the inclusive boundary are contained",
  );
  assert.equal(
    rectContainsCenter(container, { left: 100.1, top: 60, width: 20, height: 20 }),
    false,
  );
  assert.equal(rectContainsCenter(null, { left: 0, top: 0, width: 1, height: 1 }), false);
});

test("formats text, multi-select, and area annotations deterministically", () => {
  const annotations = [
    {
      payload: {
        captureKind: "text",
        comment: "Replace this quote.\nKeep it concise.",
        route: "/article",
        target: {
          selectedText: "A selected sentence",
          locatorCandidates: { stableId: "article-intro", domPath: "main > p" },
        },
      },
    },
    {
      captureKind: "multi",
      comment: "Align these cards.",
      route: "/dashboard",
      targets: [{}, {}],
      target: {
        locatorCandidates: { stableId: null, domPath: "main > article:nth-of-type(1)" },
      },
    },
    {
      payload: {
        captureKind: "region",
        comment: "Reduce this gap.",
        route: "/pricing",
        target: { bounds: { width: 319.6, height: 180.5 } },
      },
    },
  ];

  assert.equal(formatAnnotationsMarkdown(annotations), `# Threadmark annotations

1. **Text · “A selected sentence”**
   Replace this quote.
   Keep it concise.
   - Target: \`article-intro\`
   - Route: \`/article\`

2. **Multi · 2 selected elements**
   Align these cards.
   - Target: \`main > article:nth-of-type(1)\`
   - Route: \`/dashboard\`

3. **Region · 320 × 181 area**
   Reduce this gap.
   - Route: \`/pricing\``);

  assert.equal(formatAnnotationsMarkdown([]), "");
  assert.equal(formatAnnotationsMarkdown(null), "");
});

test("formats screenshot annotations as selected-area evidence", () => {
  assert.equal(formatAnnotationsMarkdown([{
    payload: {
      captureKind: "screenshot",
      comment: "Move the marked action closer to the heading.",
      route: "/dashboard",
      target: { bounds: { width: 1440, height: 900 } },
    },
  }]), `# Threadmark annotations

1. **Screenshot · 1440 × 900 screenshot area**
   Move the marked action closer to the heading.
   - Route: \`/dashboard\``);
});

test("formats interaction traces as agent-readable, privacy-safe steps", () => {
  assert.equal(formatAnnotationsMarkdown([{
    payload: {
      captureKind: "interaction",
      comment: "Keep focus in the search field after submitting.",
      route: "/dashboard",
      target: {
        accessibleName: "Search posts",
        locatorCandidates: { stableId: "search-posts" },
      },
      targets: [{ accessibleName: "Search posts" }, { accessibleName: "Submit search" }],
      interaction: {
        version: 1,
        startedAt: "2026-08-28T08:00:00.000Z",
        durationMs: 2100,
        events: [
          { type: "click", offsetMs: 100, targetIndex: 0, button: 0 },
          { type: "input", offsetMs: 450, targetIndex: 0, inputType: "search" },
          { type: "keydown", offsetMs: 900, targetIndex: 0, key: "Enter", modifiers: [] },
          { type: "navigation", offsetMs: 2100, route: "/results" },
        ],
      },
    },
  }]), `# Threadmark annotations

1. **Interaction · 4 steps over 2.1s**
   Keep focus in the search field after submitting.
   - 100ms · click · Search posts
   - 450ms · input · Search posts
   - 900ms · keydown · Enter
   - 2100ms · navigation · /results
   - Privacy: input values and printable keystrokes were not recorded
   - Target: \`search-posts\`
   - Route: \`/dashboard\``);
});

test("includes reviewer attribution in copied annotation markdown", () => {
  assert.equal(formatAnnotationsMarkdown([{
    payload: {
      captureKind: "element",
      target: { tagName: "button" },
      comment: "Make the action clearer.",
      author: { id: "user_42", displayName: "Emily R.", avatarUrl: null },
      route: "/settings",
    },
  }]), `# Threadmark annotations

1. **Element · button**
   Make the action clearer.
   - Author: Emily R.
   - Route: \`/settings\``);
});

test("includes threaded replies in copied annotation markdown", () => {
  const output = formatAnnotationsMarkdown([{
    payload: {
      captureKind: "element",
      comment: "Clarify this action.",
      author: { displayName: "Emily R." },
      replies: [{ comment: "I can update the label.", author: { displayName: "Jordan Lee" } }],
      target: { tagName: "button" },
      route: "/dashboard",
    },
  }]);

  assert.match(output, /Reply — Jordan Lee: I can update the label\./);
});

test("pauses and restores only animations and media that were running", () => {
  const calls = {
    append: 0,
    remove: 0,
    runningPause: 0,
    runningPlay: 0,
    idlePause: 0,
    idlePlay: 0,
    mediaPause: 0,
    mediaPlay: 0,
    mediaCatch: 0,
    idleMediaPause: 0,
    idleMediaPlay: 0,
  };
  const styleAttributes = {};
  const style = {
    nonce: "",
    textContent: "",
    setAttribute(name, value) { styleAttributes[name] = value; },
    remove() { calls.remove += 1; },
  };
  const runningAnimation = {
    playState: "running",
    pause() { calls.runningPause += 1; },
    play() { calls.runningPlay += 1; },
  };
  const idleAnimation = {
    playState: "paused",
    pause() { calls.idlePause += 1; },
    play() { calls.idlePlay += 1; },
  };
  const playingMedia = {
    paused: false,
    pause() { calls.mediaPause += 1; this.paused = true; },
    play() {
      calls.mediaPlay += 1;
      return { catch() { calls.mediaCatch += 1; } };
    },
  };
  const idleMedia = {
    paused: true,
    pause() { calls.idleMediaPause += 1; },
    play() { calls.idleMediaPlay += 1; },
  };
  const documentRef = {
    head: {
      append(node) {
        calls.append += 1;
        assert.equal(node, style);
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "style");
      return style;
    },
    getAnimations() { return [runningAnimation, idleAnimation]; },
    querySelectorAll(selector) {
      assert.equal(selector, "video, audio");
      return [playingMedia, idleMedia];
    },
  };

  const restore = pausePage(documentRef, { nonce: "nonce-123" });

  assert.deepEqual(styleAttributes, { "data-threadmark-pause": "" });
  assert.equal(style.nonce, "nonce-123");
  assert.match(style.textContent, /animation-play-state: paused !important/);
  assert.match(style.textContent, /transition-property: none !important/);
  assert.equal(calls.append, 1);
  assert.equal(calls.runningPause, 1);
  assert.equal(calls.idlePause, 0);
  assert.equal(calls.mediaPause, 1);
  assert.equal(calls.idleMediaPause, 0);

  restore();
  restore();

  assert.equal(calls.remove, 1, "restoration is idempotent");
  assert.equal(calls.runningPlay, 1);
  assert.equal(calls.idlePlay, 0);
  assert.equal(calls.mediaPlay, 1);
  assert.equal(calls.mediaCatch, 1);
  assert.equal(calls.idleMediaPlay, 0);
});

test("pausePage is a safe no-op without a document head", () => {
  const restore = pausePage({ head: null });
  assert.doesNotThrow(restore);
});
