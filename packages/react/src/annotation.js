const TYPING_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
].join(",");

export const ANNOTATION_DRAG_THRESHOLD = 8;

export function isTypingTarget(target) {
  if (!target || typeof target !== "object") return false;
  if (target.nodeType === 3) return isTypingTarget(target.parentElement);
  return Boolean(target.closest?.(TYPING_SELECTOR));
}

function deepestActiveElement(target) {
  const documentRef = target?.ownerDocument || (target?.nodeType === 9 ? target : null);
  let active = documentRef?.activeElement || null;
  const visited = new Set();
  while (active?.shadowRoot?.activeElement && !visited.has(active)) {
    visited.add(active);
    active = active.shadowRoot.activeElement;
  }
  return active;
}

export function gestureDistance(start, current) {
  if (!start || !current) return 0;
  return Math.hypot(Number(current.x) - Number(start.x), Number(current.y) - Number(start.y));
}

export function isAnnotationDrag(start, current, threshold = ANNOTATION_DRAG_THRESHOLD) {
  return gestureDistance(start, current) >= threshold;
}

export function suppressHostEvent(event, { preserveDefault = false } = {}) {
  if (!event) return;
  if (!preserveDefault) event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
}

export function shortcutAction(event) {
  if (!event || event.defaultPrevented || event.repeat) return null;
  const key = String(event.key || "").toLowerCase();
  let eventPath = [];
  try {
    eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
  } catch {
    // A synthetic event can expose an unusable composedPath implementation.
  }
  const typing = [event.target, ...eventPath, deepestActiveElement(event.target)].some(isTypingTarget);

  if (key === "escape") return "escape";
  if (typing) return null;

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === "f") return "toggle";
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;

  return {
    p: "pause",
    h: "visibility",
    c: "copy",
    x: "clear",
  }[key] || null;
}

export function rectIntersects(first, second) {
  if (!first || !second) return false;
  const firstRight = first.left + first.width;
  const firstBottom = first.top + first.height;
  const secondRight = second.left + second.width;
  const secondBottom = second.top + second.height;
  return first.left < secondRight
    && firstRight > second.left
    && first.top < secondBottom
    && firstBottom > second.top;
}

export function rectContainsCenter(container, item) {
  if (!container || !item) return false;
  const centerX = item.left + item.width / 2;
  const centerY = item.top + item.height / 2;
  return centerX >= container.left
    && centerX <= container.left + container.width
    && centerY >= container.top
    && centerY <= container.top + container.height;
}

export function formatAnnotationsMarkdown(annotations) {
  const items = Array.isArray(annotations) ? annotations : [];
  if (!items.length) return "";

  const lines = ["# Threadmark annotations", ""];
  items.forEach((annotation, index) => {
    const payload = annotation?.payload || annotation || {};
    const target = payload.target || {};
    const kind = payload.captureKind || "element";
    const label = kind === "text"
      ? `“${target.selectedText || target.visibleText || "Selected text"}”`
      : kind === "multi"
        ? `${payload.targets?.length || 0} selected elements`
        : kind === "region"
          ? `${Math.round(target.bounds?.width || 0)} × ${Math.round(target.bounds?.height || 0)} area`
          : kind === "screenshot"
            ? `${Math.round(target.bounds?.width || 0)} × ${Math.round(target.bounds?.height || 0)} screenshot area`
            : kind === "interaction"
              ? `${payload.interaction?.events?.length || 0} steps over ${((payload.interaction?.durationMs || 0) / 1000).toFixed(1)}s`
            : target.accessibleName || target.visibleText || target.tagName || "Element";
    const locator = target.locatorCandidates?.stableId || target.locatorCandidates?.domPath;

    lines.push(`${index + 1}. **${kind[0].toUpperCase()}${kind.slice(1)} · ${label}**`);
    lines.push(`   ${String(payload.comment || "").replace(/\n/g, "\n   ")}`);
    if (payload.author?.displayName) lines.push(`   - Author: ${payload.author.displayName}`);
    for (const reply of payload.replies || []) {
      const replyAuthor = reply.author?.displayName ? ` — ${reply.author.displayName}` : "";
      lines.push(`   - Reply${replyAuthor}: ${String(reply.comment || "").replace(/\n/g, "\n     ")}`);
    }
    if (kind === "interaction") {
      for (const event of payload.interaction?.events || []) {
        const eventTarget = payload.targets?.[event.targetIndex];
        const eventTargetName = eventTarget?.accessibleName || eventTarget?.visibleText || eventTarget?.tagName;
        const eventDetail = event.type === "keydown" && event.key
          ? ` · ${event.key === " " ? "Space" : event.key}`
          : event.type === "navigation" && event.route
            ? ` · ${event.route}`
            : eventTargetName ? ` · ${eventTargetName}` : "";
        lines.push(`   - ${event.offsetMs}ms · ${event.type}${eventDetail}`);
      }
      lines.push("   - Privacy: input values and printable keystrokes were not recorded");
    }
    if (locator) lines.push(`   - Target: \`${locator}\``);
    if (payload.route) lines.push(`   - Route: \`${payload.route}\``);
    lines.push("");
  });
  return lines.join("\n").trim();
}

export function pausePage(documentRef, { nonce } = {}) {
  if (!documentRef?.head) return () => {};
  const style = documentRef.createElement("style");
  style.setAttribute("data-threadmark-pause", "");
  if (nonce) style.nonce = nonce;
  style.textContent = `
    *, *::before, *::after {
      animation-play-state: paused !important;
      transition-property: none !important;
      scroll-behavior: auto !important;
    }
  `;
  documentRef.head.append(style);

  const animations = typeof documentRef.getAnimations === "function"
    ? documentRef.getAnimations().filter((animation) => animation.playState === "running")
    : [];
  for (const animation of animations) animation.pause?.();

  const media = [...documentRef.querySelectorAll("video, audio")]
    .filter((item) => !item.paused);
  for (const item of media) item.pause?.();

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    style.remove();
    for (const animation of animations) {
      try { animation.play?.(); } catch { /* A removed animation cannot be resumed. */ }
    }
    for (const item of media) {
      try {
        const playback = item.play?.();
        playback?.catch?.(() => {});
      } catch {
        // Browser autoplay policy can prevent resuming media.
      }
    }
  };
}
