import assert from "node:assert/strict";
import test from "node:test";

import { buildReplayTimeline, describeSerializedNode, isFailedRequest } from "../src/replayTimeline.js";
import {
  EVENT_TYPE,
  INCREMENTAL_SOURCE,
  MOUSE_INTERACTION,
  REPLAY_CONSOLE_EVENT,
  REPLAY_NETWORK_EVENT,
} from "../src/sessionReplay.js";

const kit = { EVENT_TYPE, INCREMENTAL_SOURCE, MOUSE_INTERACTION, REPLAY_CONSOLE_EVENT, REPLAY_NETWORK_EVENT };

const snapshot = {
  type: 0,
  id: 1,
  childNodes: [{
    type: 2, id: 2, tagName: "html", attributes: {}, childNodes: [{
      type: 2, id: 3, tagName: "body", attributes: {}, childNodes: [
        { type: 2, id: 4, tagName: "button", attributes: {}, childNodes: [{ type: 3, id: 5, textContent: "Pay $49" }] },
        { type: 2, id: 6, tagName: "input", attributes: { placeholder: "Promo code" }, childNodes: [] },
      ],
    }],
  }],
};

const events = [
  { type: EVENT_TYPE.Meta, timestamp: 10_000, data: { href: "https://shop.example.test/checkout", width: 1280, height: 800 } },
  { type: EVENT_TYPE.FullSnapshot, timestamp: 10_000, data: { node: snapshot, initialOffset: { top: 0, left: 0 } } },
  { type: EVENT_TYPE.IncrementalSnapshot, timestamp: 11_000, data: { source: INCREMENTAL_SOURCE.Input, id: 6, text: "*****" } },
  { type: EVENT_TYPE.IncrementalSnapshot, timestamp: 12_000, data: { source: INCREMENTAL_SOURCE.Input, id: 6, text: "******" } },
  { type: EVENT_TYPE.IncrementalSnapshot, timestamp: 13_000, data: { source: INCREMENTAL_SOURCE.MouseInteraction, type: MOUSE_INTERACTION.Click, id: 4, x: 10, y: 10 } },
  { type: EVENT_TYPE.Custom, timestamp: 13_900, data: { tag: REPLAY_NETWORK_EVENT, payload: { method: "POST", url: "https://shop.example.test/api/pay", status: 400, durationMs: 600, outcome: "client_error" } } },
  { type: EVENT_TYPE.Custom, timestamp: 14_000, data: { tag: REPLAY_CONSOLE_EVENT, payload: { level: "error", message: "Payment failed", stack: "Error: Payment failed\n    at pay (app.js:1:1)" } } },
  { type: EVENT_TYPE.Custom, timestamp: 14_100, data: { tag: REPLAY_NETWORK_EVENT, payload: { method: "GET", url: "https://shop.example.test/api/cart", status: 200, durationMs: 50, outcome: "successful" } } },
  { type: EVENT_TYPE.IncrementalSnapshot, timestamp: 15_000, data: { source: INCREMENTAL_SOURCE.Scroll, id: 1, x: 0, y: 300 } },
  { type: EVENT_TYPE.IncrementalSnapshot, timestamp: 15_200, data: { source: INCREMENTAL_SOURCE.Scroll, id: 1, x: 0, y: 400 } },
  { type: EVENT_TYPE.Meta, timestamp: 16_000, data: { href: "https://shop.example.test/receipt?order=123", width: 1280, height: 800 } },
];

test("a replay becomes console, network, and action rows on its own clock", () => {
  const timeline = buildReplayTimeline(events, kit);
  assert.equal(timeline.start, 10_000);
  assert.deepEqual(timeline.console, [{ at: 14_000, offsetMs: 4_000, level: "error", message: "Payment failed", detail: "Error: Payment failed\n    at pay (app.js:1:1)" }]);
  assert.deepEqual(timeline.network.map((row) => [row.offsetMs, row.method, row.status, isFailedRequest(row)]), [
    [3_300, "POST", 400, true],
    [4_050, "GET", 200, false],
  ], "requests sit where they started, in order");
  assert.deepEqual(timeline.actions.map((row) => [row.offsetMs, row.kind, row.label]), [
    [2_000, "input", "Typed in input “Promo code” (value hidden)"],
    [3_000, "click", "Clicked button “Pay $49”"],
    [5_000, "scroll", "Scrolled"],
    [6_000, "navigation", "Navigated to /receipt?…"],
  ], "typing in one field folds into one row, and nothing typed is shown");
});

test("unnamed elements and junk entries still read sensibly", () => {
  assert.equal(describeSerializedNode({ type: 2, tagName: "DIV", attributes: {}, childNodes: [] }), "<div>");
  assert.equal(describeSerializedNode(null), "the page");
  const timeline = buildReplayTimeline([
    { type: EVENT_TYPE.Meta, timestamp: 1, data: {} },
    { type: EVENT_TYPE.Custom, timestamp: 2, data: { tag: REPLAY_CONSOLE_EVENT, payload: { level: "shout", message: 42 } } },
    { type: EVENT_TYPE.Custom, timestamp: 3, data: { tag: REPLAY_NETWORK_EVENT, payload: {} } },
  ], kit);
  assert.deepEqual(timeline.console[0], { at: 2, offsetMs: 1, level: "log", message: "42", detail: "" });
  assert.equal(timeline.network[0].outcome, "incomplete");
  assert.equal(isFailedRequest(timeline.network[0]), true);
  assert.deepEqual(buildReplayTimeline(null, kit), { start: 0, console: [], network: [], actions: [] });
});
