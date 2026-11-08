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
