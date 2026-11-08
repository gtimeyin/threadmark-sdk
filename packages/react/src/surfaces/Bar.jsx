// The Bar: Threadmark's way in (Figma "Bar" component, Feedback experience board 01).
// When nobody is reviewing it is a small dark bar that says what is waiting on this page:
// Nothing yet ("Leave feedback"), Waiting (new questions or comments), All caught up, or Offline.
// In comment mode the same bar carries the hint ("Click anything, or select text  Esc") and the tools.
import { useEffect, useState } from "react";
import { AddIcon, CommentIcon, ResolveIcon } from "../icons.jsx";
import { Avatar, Key } from "../ui/primitives.jsx";
import { notificationHeadline } from "../notifications.js";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
export const openShortcutLabel = () => (isMac() ? "⌘⇧F" : "Ctrl⇧F");

const seenKey = (route) => `threadmark:seen:${route || "/"}`;

function readSeen(route) {
  try {
    const value = Number(window.localStorage.getItem(seenKey(route)));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** Remember how many comments the reviewer has seen on this page, so the bar can say "All caught up". */
export function markFeedbackSeen(route, count) {
  try {
    window.localStorage.setItem(seenKey(route), String(Math.max(0, count | 0)));
  } catch {
    // Private windows and blocked storage simply keep showing what is waiting.
  }
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Works out what the idle bar should say. Exported for tests. */
export function barMood({ count, questions, seen, online }) {
  if (!online) return { mood: "offline", primary: "Offline", secondary: count ? plural(count, "comment") : "Comments will wait" };
  if (!count) return { mood: "nothing", primary: "Leave feedback" };
  const fresh = Math.max(0, count - seen);
  if (questions > 0) return { mood: "waiting", primary: plural(questions, "question"), secondary: plural(count, "comment") };
  if (fresh > 0) return { mood: "waiting", primary: `${fresh} new`, secondary: plural(count, "comment") };
  return { mood: "caught-up", primary: "All caught up", secondary: plural(count, "comment") };
}

/** The idle bar. `onOpen` opens the review (and the panel when there is something to read). */
export function IdleBar({ annotations = [], notifications = null, route, launcherRef, onOpen, onOpenTools, position }) {
  const online = useOnline();
  const count = annotations.length;
  const questions = annotations.filter((annotation) => annotation?.payload?.ask && !annotation?.payload?.resolvedAt && annotation?.runtime?.status !== "resolved").length;
  const [seen, setSeen] = useState(() => readSeen(route));
  useEffect(() => setSeen(readSeen(route)), [route]);
  const unread = (notifications || []).filter((item) => !item.read);
  const latest = online ? unread[0] : null;
  const base = barMood({ count, questions, seen, online });
  const { mood, primary, secondary } = latest
    ? { mood: "reply", primary: notificationHeadline(latest), secondary: latest.route ? `on ${latest.route}` : unread.length > 1 ? `${unread.length} new` : "" }
    : base;
  const shortcut = openShortcutLabel();
  const label = latest
    ? `Open inbox: ${primary}${unread.length > 1 ? `, ${unread.length} unread` : ""}`
    : count
      ? `Open feedback, ${plural(count, "comment")}${mood === "waiting" ? `, ${primary}` : ""}`
      : "Leave feedback";

  const open = () => {
    if (count) {
      markFeedbackSeen(route, count);
      setSeen(count);
    }
    onOpen?.(count > 0, Boolean(latest));
  };

  return (
    <div className={`tm-bar tm-bar--idle tm-bar--${mood}`} role="group" aria-label="Threadmark" style={position}>
      {(count > 0 || latest) && (
        <>
          <button type="button" className="tm-bar__tools" aria-label="Comment on the page" title="Comment on the page (C)" onClick={onOpenTools}>
            <AddIcon aria-hidden="true" focusable="false" />
          </button>
          <span className="tm-bar__divider" aria-hidden="true" />
        </>
      )}
      <button ref={launcherRef} type="button" className="tm-launcher tm-bar__main" aria-label={label} aria-keyshortcuts="Meta+Shift+F Control+Shift+F" onClick={open}>
        {mood === "nothing" && <AddIcon aria-hidden="true" focusable="false" className="tm-bar__lead-icon" />}
        {mood === "caught-up" && <ResolveIcon aria-hidden="true" focusable="false" className="tm-bar__lead-icon tm-bar__lead-icon--lime" />}
        {(mood === "waiting" || mood === "offline" || mood === "reply") && <span className={`tm-bar__dot tm-bar__dot--${mood}`} aria-hidden="true" />}
        {mood === "reply" && <Avatar name={latest.actor.displayName} src={latest.actor.avatarUrl} size={20} />}
        <span className="tm-bar__primary">{primary}</span>
        {secondary && <span className="tm-bar__sep" aria-hidden="true">·</span>}
        {secondary && <span className="tm-bar__secondary">{secondary}</span>}
        <Key className="tm-bar__key">{shortcut}</Key>
      </button>
    </div>
  );
}

/** The hint at the start of the comment-mode bar. */
export function BarHint({ children }) {
  return (
    <span className="tm-bar__hint" aria-hidden="true">
      <CommentIcon className="tm-bar__lead-icon tm-bar__lead-icon--lime" />
      <span className="tm-bar__primary">{children}</span>
      <Key className="tm-bar__key">Esc</Key>
    </span>
  );
}
