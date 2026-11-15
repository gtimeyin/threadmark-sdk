// The Bar: Threadmark's way in (Figma "Bar" component, Feedback experience board 01).
// When nobody is reviewing it is the same bar as comment mode (grip, Tools, More | Comments, Inbox) with the
// shrink dot in Close's place. What is waiting (new, questions, offline) is in the Comments button's name and badge.
// In comment mode the same bar carries the tools, plus a hint while something is happening (a multi-select, a drag, a repin).
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, CommentIcon, DragIcon, InboxIcon, MoreIcon, SelectIcon, ThreadsIcon } from "../icons.jsx";
import { Key } from "../ui/primitives.jsx";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
export const openShortcutLabel = () => (isMac() ? "⌘⇧F" : "Ctrl⇧F");

// Which comments this browser has seen, by id and per project: a count went wrong when one comment was deleted
// and another added. Anything not in the set is new. The overlay marks the whole list seen whenever the
// Comments panel opens, however it was opened.
const seenKey = (scope) => `threadmark:seen-ids:${scope || "default"}`;

export function readSeenIds(scope) {
  try {
    const list = JSON.parse(window.localStorage.getItem(seenKey(scope)) || "[]");
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** Remember these comments as seen, so the Comments badge stops calling them new. */
export function markFeedbackSeen(scope, ids) {
  try {
    window.localStorage.setItem(seenKey(scope), JSON.stringify([...new Set(ids)].slice(-1000)));
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
export function barMood({ count, questions, fresh = 0, online }) {
  if (!online) return { mood: "offline", primary: "Offline", secondary: count ? plural(count, "comment") : "Comments will wait" };
  if (!count) return { mood: "nothing", primary: "Leave feedback" };
  if (questions > 0) return { mood: "waiting", primary: plural(questions, "question"), secondary: plural(count, "comment") };
  if (fresh > 0) return { mood: "waiting", primary: `${fresh} new`, secondary: plural(count, "comment") };
  return { mood: "caught-up", primary: "All caught up", secondary: plural(count, "comment") };
}

/** On phones the bar steps out of the way while you scroll down and comes back when you scroll up (board 11, 35a). */
export function useScrollAway(enabled = true) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!enabled || typeof window.matchMedia !== "function") return undefined;
    const phone = window.matchMedia("(max-width: 599px)");
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (!phone.matches) { setAway(false); last = y; return; }
      if (y > last + 12 && y > 80) setAway(true);
      else if (y < last - 12 || y <= 80) setAway(false);
      if (Math.abs(y - last) > 12) last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
  return away;
}

/** The idle bar. `onOpen` opens the review (and the panel when there is something to read). */
export function IdleBar({ annotations = [], notifications = null, seenScope, seenVersion = 0, launcherRef, onOpen, onOpenTools, onOpenMore, drag, style, position = "bottom-center", shrunk = false, onShrink }) {
  const online = useOnline();
  const away = useScrollAway(!shrunk);
  const count = annotations.length;
  const questions = annotations.filter((annotation) => annotation?.payload?.ask && !annotation?.payload?.resolvedAt && annotation?.runtime?.status !== "resolved").length;
  // `annotations` is the whole project, so the badge reads the same here and in comment mode.
  const seen = useMemo(() => readSeenIds(seenScope), [seenScope, seenVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const fresh = annotations.filter((annotation) => annotation?.id && !seen.has(annotation.id)).length;
  const unread = (notifications || []).filter((item) => !item.read);
  const latest = online ? unread[0] : null;
  const base = barMood({ count, questions, fresh, online });
  const shortcut = openShortcutLabel();
  const baseLabel = !online
    ? `Offline${count ? `, ${plural(count, "comment")}` : ""}`
    : count
      ? `Open feedback, ${plural(count, "comment")}${base.mood === "waiting" ? `, ${base.primary}` : ""}`
      : "Leave feedback";
  const open = () => onOpen?.(count > 0, false);

  // Shrinking or restoring moves focus to the control that's now there, rather than dropping it.
  const wasShrunk = useRef(shrunk);
  useEffect(() => {
    if (wasShrunk.current !== shrunk) launcherRef?.current?.focus?.({ preventScroll: true });
    wasShrunk.current = shrunk;
  }, [shrunk]);

  // Shrunk to a dot (board 09, 29b): the count stays so nothing new slips past.
  if (shrunk) {
    const waiting = latest ? unread.length : fresh;
    return (
      <div className={`tm-bar tm-bar--shrunk tm-bar--at-${position}`} role="group" aria-label="Threadmark">
        <button ref={launcherRef} type="button" className="tm-launcher tm-bar__main"
          aria-label={`Show the Threadmark bar${count ? `, ${plural(count, "comment")}` : ""}`} aria-keyshortcuts="Meta+. Control+."
          onClick={() => onShrink?.(false)}>
          <span className={`tm-bar__dot tm-bar__dot--${waiting ? "waiting" : "quiet"}`} aria-hidden="true" />
          {(waiting > 0 || count > 0) && <span className="tm-bar__primary">{waiting || count}</span>}
        </button>
      </div>
    );
  }

  // Idle and comment mode share one Bar (2026-11-15): grip, Tools, More | Comments, Inbox | and the shrink dot
  // where comment mode has Close. Tools and More start commenting with that menu open, so nothing jumps.
  // What is waiting (new comments, questions, offline) is in the Comments button's name and badge.
  const waitingCount = fresh;
  const badge = (value) => <span className="tm-count-badge" aria-hidden="true">{value > 99 ? "99+" : value}</span>;
  return (
    <div className={`tm-bar tm-bar--idle tm-bar--${base.mood} tm-bar--at-${position}${away ? " is-away" : ""}`} role="group" aria-label="Threadmark"
      style={style}>
      {drag && (
        <button type="button" className="tm-drag-handle" aria-label="Move the Threadmark bar" title="Drag the bar"
          onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerUp}>
          <DragIcon aria-hidden="true" focusable="false" />
        </button>
      )}
      <button type="button" className="tm-tool-switch" aria-label="Feedback tools" title="Feedback tools (C to comment)" aria-haspopup="menu" onClick={onOpenTools}>
        <SelectIcon aria-hidden="true" focusable="false" />
        <ChevronDownIcon aria-hidden="true" focusable="false" className="tm-tool-switch__chevron" />
      </button>
      {onOpenMore && (
        <button type="button" className="tm-toolbar-more" aria-label="More actions" title="More actions" aria-haspopup="menu" onClick={onOpenMore}>
          <MoreIcon aria-hidden="true" focusable="false" />
        </button>
      )}
      <span className="tm-toolbar-divider" aria-hidden="true" />
      <button ref={launcherRef} type="button" className={`tm-launcher tm-all-comments-trigger${waitingCount || questions ? " is-waiting" : ""}`}
        aria-label={baseLabel} title={online ? `Comments (${shortcut})` : "Offline: comments will wait"}
        aria-keyshortcuts="Meta+Shift+F Control+Shift+F" onClick={open}>
        {/* Threads, not the single bubble: that one means "add a comment". */}
        <ThreadsIcon aria-hidden="true" focusable="false" />
        {!online && <span className="tm-bar__dot tm-bar__dot--offline tm-bar__icon-dot" aria-hidden="true" />}
        {online && count > 0 && badge(count)}
      </button>
      {notifications && (
        <button type="button" className="tm-all-comments-trigger" aria-label={unread.length ? `Inbox, ${unread.length} unread` : "Inbox"} title="Inbox"
          onClick={() => onOpen?.(count > 0, true)}>
          <InboxIcon aria-hidden="true" focusable="false" />
          {unread.length > 0 && badge(unread.length)}
        </button>
      )}
      {onShrink && (
        <>
          <span className="tm-toolbar-divider" aria-hidden="true" />
          <button type="button" className="tm-bar__shrink" aria-label="Shrink to a dot" title="Shrink to a dot (⌘.)" onClick={() => onShrink(true)}>
            <span aria-hidden="true" />
          </button>
        </>
      )}
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

/**
 * A bar that says what is happening (board 06, 20d; board 12, 37c): an icon, what it is, how far along,
 * a Lime Stop and Esc. It takes the bar's place, wherever the bar sits.
 */
export function BarStatus({ icon: Icon, title, detail, onStop, position = "bottom-center", hint }) {
  return (
    <div className={`tm-modebar tm-bar-status tm-bar--at-${position}`} role="status" title={hint}>
      {Icon && <Icon className="tm-bar-status__icon" aria-hidden="true" focusable="false" />}
      <strong>{title}</strong>
      {detail && <span className="tm-bar-status__detail">{detail}</span>}
      {onStop && <button type="button" className="tm-bar-status__stop" onClick={onStop}>Stop</button>}
      <Key>Esc</Key>
    </div>
  );
}
