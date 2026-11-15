import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNotifications, notificationHeadline } from "../src/notifications.js";

test("notifications keep only well-formed items, newest first", () => {
  const list = normalizeNotifications([
    { id: "a", actor: { displayName: "Maya Patel" }, text: "Replied on the button", kind: "reply", createdAt: "2026-11-08T10:00:00Z" },
    { id: "b", actor: { displayName: "Sam" }, text: "Mentioned you", kind: "mention", createdAt: "2026-11-08T11:00:00Z", read: true },
    { id: "a", actor: { displayName: "Dup" }, text: "dup" },
    { id: "c", actor: {}, text: "no actor" },
    { id: "d", actor: { displayName: "Kemi", avatarUrl: "javascript:alert(1)" }, text: "x", kind: "weird" },
    null,
  ]);
  assert.deepEqual(list.map((item) => item.id), ["b", "a", "d"]);
  assert.equal(list[2].kind, "other");
  assert.equal(list[2].actor.avatarUrl, null);
  assert.equal(list[0].read, true);
  assert.equal(list[1].read, false);
});

test("the bar headline names the person and what they did", () => {
  const [item] = normalizeNotifications([{ id: "x", actor: { displayName: "Maya Patel" }, text: "hi", kind: "mention" }]);
  assert.equal(notificationHeadline(item), "Maya mentioned you");
});

test("Inbox rows say what happened, where, and on which day (board 05, 17b)", async () => {
  const { notificationVerb, notificationDay } = await import("../src/notifications.js");
  const [reply, assigned] = normalizeNotifications([
    { id: "r", kind: "reply", actor: { displayName: "Sam" }, text: "Agree", target: "  Button · Start free  ", createdAt: "2026-11-09T09:00:00" },
    { id: "a", kind: "assigned", actor: { displayName: "Kai" }, text: "Move it", createdAt: "2026-11-07T09:00:00" },
  ]);
  assert.equal(notificationVerb(reply), "replied to your comment");
  assert.equal(notificationVerb(assigned), "assigned you");
  assert.equal(notificationVerb({ kind: "other" }), "left a note");
  assert.equal(reply.target, "Button · Start free");
  assert.equal(assigned.target, null);
  const now = new Date("2026-11-09T18:00:00");
  assert.equal(notificationDay(reply, now), "Today");
  assert.equal(notificationDay(assigned, now), "Earlier");
  assert.equal(notificationDay({ createdAt: null }, now), "Earlier");
});

test("the platform's own kinds read as what happened, not \"left a note\"", async () => {
  const { notificationVerb } = await import("../src/notifications.js");
  const list = normalizeNotifications(["comment", "video", "reopened", "poll", "brand-new"].map((kind, index) => (
    { id: `k${index}`, kind, actor: { displayName: "Sam Okafor" }, text: "hi", createdAt: `2026-11-15T10:0${index}:00Z` })));
  const byId = Object.fromEntries(list.map((item) => [item.id, item]));
  assert.equal(notificationVerb(byId.k0), "left a comment");
  assert.equal(notificationVerb(byId.k1), "posted a video");
  assert.equal(notificationVerb(byId.k2), "reopened a thread");
  assert.equal(notificationVerb(byId.k3), "started a poll");
  assert.equal(byId.k4.kind, "other");
  assert.equal(notificationVerb(byId.k4), "left a note");
});
