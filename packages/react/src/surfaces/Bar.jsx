// The Bar: Threadmark's way in (Figma "Bar" component, Feedback experience board 01).
// When nobody is reviewing it is a small dark bar that says what is waiting on this page:
// Nothing yet ("Leave feedback"), Waiting (new questions or comments), All caught up, or Offline.
// In comment mode the same bar carries the hint ("Click anything, or select text  Esc") and the tools.
import { useEffect, useRef, useState } from "react";
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
export function IdleBar({ annotations = [], notifications = null, route, launcherRef, onOpen, onOpenTools, position = "bottom-center", shrunk = false, onShrink }) {
  const online = useOnline();
  const away = useScrollAway(!shrunk);
  const count = annotations.length;
  const questions = annotations.filter((annotation) => annotation?.payload?.ask && !annotation?.payload?.resolvedAt && annotation?.runtime?.status !== "resolved").length;
  const [seen, setSeen] = useState(() => readSeen(route));
  useEffect(() => setSeen(readSeen(route)), [route]);
  const unread = (notifications || []).filter((item) => !item.read);
  const latest = online ? unread[0] : null;
  const base = barMood({ count, questions, seen, online });
  const { mood, primary, secondary } = latest
    ? { mood: "reply", primary: notificationHeadline(latest), secondary: latest.route ? `on ${latest.route === "/" ? "Home" : latest.route}` : unread.length > 1 ? `${unread.length} new` : "" }
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

  // Shrinking or restoring moves focus to the control that's now there, rather than dropping it.
  const wasShrunk = useRef(shrunk);
  useEffect(() => {
    if (wasShrunk.current !== shrunk) launcherRef?.current?.focus?.({ preventScroll: true });
    wasShrunk.current = shrunk;
  }, [shrunk]);

  // Shrunk to a dot (board 09, 29b): the count stays so nothing new slips past.
  if (shrunk) {
    const waiting = latest ? unread.length : Math.max(0, count - seen);
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

  return (
    <div className={`tm-bar tm-bar--idle tm-bar--${mood} tm-bar--at-${position}${away ? " is-away" : ""}`} role="group" aria-label="Threadmark">
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
      {onShrink && (
        <button type="button" className="tm-bar__shrink" aria-label="Shrink to a dot" title="Shrink to a dot (⌘.)" onClick={() => onShrink(true)}>
          <span aria-hidden="true" />
        </button>
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
