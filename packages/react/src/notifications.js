// Inbox notifications are host-owned, like comments: the host passes them in through the
// `notifications` prop and hears about opens and reads through callbacks. This module only
// validates the shape so the overlay never renders something it can't trust.
const KINDS = new Set(["comment", "video", "reply", "mention", "resolved", "reopened", "reaction", "assigned", "question", "poll", "other"]);

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function avatarUrl(value) {
  const url = text(value, 2048);
  if (!url) return null;
  try {
    const parsed = new URL(url, typeof window === "undefined" ? "https://localhost" : window.location.href);
    return ["https:", "http:", "blob:", "data:"].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Keeps only well-formed notifications, newest first. */
export function normalizeNotifications(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const id = text(item.id, 160);
    const displayName = text(item.actor?.displayName, 120);
    const body = text(item.text, 600);
    if (!id || seen.has(id) || !displayName || !body) continue;
    seen.add(id);
    const created = new Date(item.createdAt).getTime();
    out.push({
      id,
      kind: KINDS.has(item.kind) ? item.kind : "other",
      actor: { id: text(item.actor?.id, 160) || null, displayName, avatarUrl: avatarUrl(item.actor?.avatarUrl) },
      text: body,
      annotationId: text(item.annotationId, 160) || null,
      route: text(item.route, 512) || null,
      // What on the page it is about, e.g. "Field · Company" (board 05, 17b).
      target: text(item.target, 120) || null,
      createdAt: Number.isFinite(created) ? new Date(created).toISOString() : null,
      read: item.read === true,
    });
  }
  return out.sort((a, b) => (Date.parse(b.createdAt || 0) || 0) - (Date.parse(a.createdAt || 0) || 0));
}

const VERBS = { comment: "commented", video: "posted a video", reply: "replied", mention: "mentioned you", resolved: "resolved a thread", reopened: "reopened a thread", reaction: "reacted", assigned: "assigned you", question: "asked a question", poll: "started a poll" };

/** "Maya mentioned you" — the short line the bar shows for the newest unread notification. */
export function notificationHeadline(notification) {
  if (!notification) return "";
  const first = notification.actor.displayName.split(/\s+/)[0];
  return `${first} ${VERBS[notification.kind] || "left a note"}`;
}

// The longer form for Inbox rows (board 05, 17b): "Sam replied to your comment".
const INBOX_VERBS = {
  comment: "left a comment",
  video: "posted a video",
  reply: "replied to your comment",
  reopened: "reopened a thread",
  poll: "started a poll",
  mention: "mentioned you",
  resolved: "resolved your comment",
  reaction: "reacted to your comment",
  assigned: "assigned you",
  question: "asked you a question",
};

/** What happened, after the person's first name: "mentioned you", "replied to your comment"… */
export function notificationVerb(notification) {
  return INBOX_VERBS[notification?.kind] || "left a note";
}

/** "Today" or "Earlier", by the reader's own calendar day. */
export function notificationDay(notification, now = new Date()) {
  const at = Date.parse(notification?.createdAt || "");
  if (!Number.isFinite(at)) return "Earlier";
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return at >= start.getTime() ? "Today" : "Earlier";
}
