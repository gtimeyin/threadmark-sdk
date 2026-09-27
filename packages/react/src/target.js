import { THREADMARK_TARGET_ATTRIBUTE, isValidThreadmarkTargetId } from "./core.js";

const SENSITIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable]:not([contenteditable='false'])",
  "[data-threadmark-sensitive]",
].join(",");

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='tab']",
].join(",");
const NON_CONTENT_TAGS = new Set(["script", "style", "template", "noscript"]);

function normalizeText(value, maxLength = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function rectFromRange(range) {
  const rects = [...(range?.getClientRects?.() || [])]
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!rects.length) {
    const rect = range?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left, top, width: right - left, height: bottom - top };
}

function escapeAttribute(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function elementRole(element) {
  const explicitRole = element.getAttribute("role");
  if (explicitRole) return explicitRole;

  const tag = element.tagName.toLowerCase();
  if (tag === "button") return "button";
  if (tag === "a" && element.hasAttribute("href")) return "link";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "nav") return "navigation";
  if (tag === "main") return "main";
  if (tag === "img") return "img";
  return "";
}

function accessibleName(element, ignoredSelectors) {
  return normalizeText(
    element.getAttribute("aria-label")
      || element.getAttribute("alt")
      || element.getAttribute("title")
      || safeVisibleText(element, ignoredSelectors),
    160,
  );
}

function isVisuallyHidden(element) {
  const view = element.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return false;
  const style = view.getComputedStyle(element);
  return style.display === "none" || style.visibility === "hidden";
}

function safeVisibleText(root, ignoredSelectors) {
  const text = [];

  const visit = (node) => {
    if (node.nodeType === 3) {
      text.push(node.nodeValue || "");
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node;
    const tag = element.tagName.toLowerCase();
    if (
      element !== root
      && (
        isSensitiveElement(element)
        || matchesIgnoredSelector(element, ignoredSelectors)
        || element.hidden
        || element.getAttribute("aria-hidden") === "true"
        || NON_CONTENT_TAGS.has(tag)
        || isVisuallyHidden(element)
      )
    ) {
      return;
    }
    for (const child of element.childNodes) visit(child);
  };

  visit(root);
  return normalizeText(text.join(" "));
}

function nthOfType(element) {
  const parent = element.parentElement;
  if (!parent) return 1;
  const siblings = [...parent.children].filter((candidate) => candidate.tagName === element.tagName);
  return siblings.indexOf(element) + 1;
}

export function buildDomPath(element) {
  const rawStableId = element.getAttribute(THREADMARK_TARGET_ATTRIBUTE);
  const stableId = isValidThreadmarkTargetId(rawStableId) ? rawStableId : null;
  if (stableId) return `[${THREADMARK_TARGET_ATTRIBUTE}="${escapeAttribute(stableId)}"]`;

  const segments = [];
  let current = element;
  while (current && current.tagName && segments.length < 7) {
    const rawCurrentStableId = current.getAttribute(THREADMARK_TARGET_ATTRIBUTE);
    const currentStableId = isValidThreadmarkTargetId(rawCurrentStableId)
      ? rawCurrentStableId
      : null;
    if (currentStableId) {
      segments.unshift(`[${THREADMARK_TARGET_ATTRIBUTE}="${escapeAttribute(currentStableId)}"]`);
      break;
    }
    const tag = current.tagName.toLowerCase();
    segments.unshift(`${tag}:nth-of-type(${nthOfType(current)})`);
    current = current.parentElement;
    if (current?.tagName?.toLowerCase() === "body") break;
  }
  return segments.join(" > ");
}

export function isSensitiveElement(element) {
  return Boolean(element?.closest?.(SENSITIVE_SELECTOR));
}

function matchesIgnoredSelector(element, ignoredSelectors) {
  if (element.closest?.("[data-threadmark-ignore]")) return true;
  return (ignoredSelectors || []).some((selector) => {
    try {
      return Boolean(element.closest?.(selector));
    } catch {
      return false;
    }
  });
}

function restorationCandidateAllowed(element, ignoredSelectors) {
  return Boolean(
    element
    && !isSensitiveElement(element)
    && !matchesIgnoredSelector(element, ignoredSelectors)
    && !element.hidden
    && element.getAttribute("aria-hidden") !== "true"
    && !isVisuallyHidden(element),
  );
}

// Tag (2) plus a name (4) or text (4-5) match; tag and role alone never re-anchor a target.
const FINGERPRINT_MIN_SCORE = 6;

function targetFingerprintScore(element, target, ignoredSelectors) {
  if (!restorationCandidateAllowed(element, ignoredSelectors)) return -1;
  const expectedTag = String(target?.tagName || "").toLowerCase();
  if (expectedTag && element.tagName.toLowerCase() !== expectedTag) return -1;
  let score = expectedTag ? 2 : 0;
  const expectedRole = normalizeText(target?.role, 80);
  const actualRole = elementRole(element);
  if (expectedRole) {
    if (actualRole !== expectedRole) return -1;
    score += 2;
  }
  const expectedName = normalizeText(target?.accessibleName, 160);
  const actualName = accessibleName(element, ignoredSelectors);
  const hasExpectedName = Boolean(expectedName && expectedName !== "Selected text");
  const nameMatches = hasExpectedName && actualName === expectedName;
  if (nameMatches) score += 4;
  const expectedText = normalizeText(target?.visibleText, 240);
  const actualText = safeVisibleText(element, ignoredSelectors);
  let textMatches = false;
  if (expectedText && actualText === expectedText) { score += 5; textMatches = true; }
  else if (target?.kind === "text" && expectedText && actualText.includes(expectedText)) { score += 4; textMatches = true; }
  // A recorded name or text is the target's identity; structure alone must not stand in for it.
  if ((hasExpectedName || expectedText) && !nameMatches && !textMatches) return -1;
  return score;
}

function matchingStableElements(stableId, documentRef, ignoredSelectors) {
  if (!stableId) return [];
  return [...documentRef.querySelectorAll(`[${THREADMARK_TARGET_ATTRIBUTE}]`)]
    .filter((element) => element.getAttribute(THREADMARK_TARGET_ATTRIBUTE) === stableId)
    .filter((element) => restorationCandidateAllowed(element, ignoredSelectors));
}

export function restoreTargetDescriptor(
  target,
  { documentRef = document, ignoredSelectors = [] } = {},
) {
  if (!target || !documentRef) return { status: "missing", element: null, candidates: [] };
  if (["region", "screenshot"].includes(target.kind)) {
    return { status: "resolved", element: null, candidates: [] };
  }

  const stableId = target.locatorCandidates?.stableId;
  const stableMatches = matchingStableElements(stableId, documentRef, ignoredSelectors);
  if (stableMatches.length === 1) {
    return { status: "resolved", element: stableMatches[0], candidates: stableMatches };
  }
  if (stableMatches.length > 1) {
    return { status: "ambiguous", element: null, candidates: stableMatches };
  }

  const domPath = target.locatorCandidates?.domPath;
  if (domPath) {
    try {
      const pathMatches = [...documentRef.querySelectorAll(domPath)]
        .filter((element) => targetFingerprintScore(element, target, ignoredSelectors) >= 2);
      if (pathMatches.length === 1) {
        return { status: "resolved", element: pathMatches[0], candidates: pathMatches };
      }
      if (pathMatches.length > 1) {
        return { status: "ambiguous", element: null, candidates: pathMatches };
      }
    } catch {
      // Malformed or obsolete paths fall through to conservative fingerprint matching.
    }
  }

  const tag = String(target.tagName || "").toLowerCase();
  if (!tag || !/^[a-z][a-z0-9-]*$/.test(tag)) {
    return { status: "missing", element: null, candidates: [] };
  }
  const scored = [...documentRef.querySelectorAll(tag)]
    .map((element) => ({ element, score: targetFingerprintScore(element, target, ignoredSelectors) }))
    .filter(({ score }) => score >= FINGERPRINT_MIN_SCORE)
    .sort((left, right) => right.score - left.score);
  if (!scored.length) {
    return { status: "missing", element: null, candidates: [], suggestion: suggestChangedTarget(target, documentRef, ignoredSelectors) };
  }
  const best = scored[0].score;
  const bestMatches = scored.filter(({ score }) => score === best).map(({ element }) => element);
  if (bestMatches.length === 1) {
    return { status: "resolved", element: bestMatches[0], candidates: bestMatches };
  }
  return { status: "ambiguous", element: null, candidates: bestMatches };
}

/** Privacy-safe short label for a live element, used to show what a suggested location now says. */
export function describeTargetElement(element, ignoredSelectors = []) {
  if (!element) return "";
  return accessibleName(element, ignoredSelectors) || safeVisibleText(element, ignoredSelectors) || element.tagName.toLowerCase();
}

const MAX_SUGGESTION_CANDIDATES = 1500;

function words(value) {
  return new Set(String(value || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

function similarity(expected, actual) {
  const left = words(expected), right = words(actual);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * A likely new home for a target whose exact identity no longer matches (edited text, moved in the layout).
 * Only ever offered as a suggestion for a reviewer to confirm; it never resolves the target by itself.
 * Requires the same tag and role, and either similar text/name or the same DOM position; ties give no suggestion.
 */
function suggestChangedTarget(target, documentRef, ignoredSelectors) {
  const tag = String(target.tagName || "").toLowerCase();
  if (!tag || !/^[a-z][a-z0-9-]*$/.test(tag)) return null;
  const expectedRole = normalizeText(target.role, 80);
  const expectedName = normalizeText(target.accessibleName, 160);
  const expectedText = normalizeText(target.visibleText, 240);
  const hasIdentity = Boolean((expectedName && expectedName !== "Selected text") || expectedText);
  let pathElement = null;
  try {
    const path = target.locatorCandidates?.domPath;
    const matches = path ? documentRef.querySelectorAll(path) : [];
    if (matches.length === 1) pathElement = matches[0];
  } catch {
    // An obsolete path simply offers no positional hint.
  }
  const scored = [];
  for (const element of [...documentRef.querySelectorAll(tag)].slice(0, MAX_SUGGESTION_CANDIDATES)) {
    if (!restorationCandidateAllowed(element, ignoredSelectors)) continue;
    if (expectedRole && elementRole(element) !== expectedRole) continue;
    const textScore = Math.max(
      similarity(expectedText, safeVisibleText(element, ignoredSelectors)),
      expectedName === "Selected text" ? 0 : similarity(expectedName, accessibleName(element, ignoredSelectors)),
    );
    const samePosition = element === pathElement;
    const qualifies = hasIdentity ? textScore >= 0.5 || (samePosition && textScore >= 0.2) : samePosition;
    if (qualifies) scored.push({ element, score: textScore + (samePosition ? 0.5 : 0) });
  }
  scored.sort((left, right) => right.score - left.score);
  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].element;
}

function normalizedTextMap(element) {
  const documentRef = element?.ownerDocument;
  if (!documentRef) return { text: "", positions: [] };
  const walker = documentRef.createTreeWalker(
    element,
    documentRef.defaultView?.NodeFilter?.SHOW_TEXT || 4,
  );
  const positions = [];
  let text = "";
  let previousWasSpace = false;
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || "";
    for (let offset = 0; offset < value.length; offset += 1) {
      const character = value[offset];
      if (/\s/.test(character)) {
        if (!previousWasSpace && text.length) {
          text += " ";
          positions.push({ node, offset });
        }
        previousWasSpace = true;
      } else {
        text += character;
        positions.push({ node, offset });
        previousWasSpace = false;
      }
    }
    node = walker.nextNode();
  }
  return { text: text.trim(), positions };
}

export function restoreTextTargetDescriptor(
  target,
  { documentRef = document, ignoredSelectors = [] } = {},
) {
  const container = restoreTargetDescriptor(target, { documentRef, ignoredSelectors });
  if (container.status !== "resolved" || !container.element) {
    return { ...container, range: null };
  }
  const quote = normalizeText(target.selectedText || target.visibleText, 1000);
  if (!quote) return { status: "missing", element: container.element, candidates: [], range: null };
  const mapped = normalizedTextMap(container.element);
  const occurrences = [];
  let from = 0;
  while (from <= mapped.text.length - quote.length) {
    const index = mapped.text.indexOf(quote, from);
    if (index < 0) break;
    occurrences.push(index);
    from = index + 1;
  }
  if (!occurrences.length) {
    return { status: "missing", element: container.element, candidates: [], range: null };
  }
  if (occurrences.length > 1) {
    return { status: "ambiguous", element: null, candidates: [container.element], range: null };
  }
  const start = mapped.positions[occurrences[0]];
  const end = mapped.positions[occurrences[0] + quote.length - 1];
  if (!start || !end) return { status: "missing", element: container.element, candidates: [], range: null };
  const range = documentRef.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return { status: "resolved", element: container.element, candidates: [container.element], range };
}

function rangeTouchesProtectedContent(range, ignoredSelectors) {
  const common = range?.commonAncestorContainer;
  const documentRef = common?.ownerDocument;
  if (!common || !documentRef) return true;
  const commonElement = common.nodeType === 1 ? common : common.parentElement;
  if (!commonElement || isSensitiveElement(commonElement) || matchesIgnoredSelector(commonElement, ignoredSelectors)) {
    return true;
  }

  const walker = documentRef.createTreeWalker(
    commonElement,
    documentRef.defaultView?.NodeFilter?.SHOW_TEXT || 4,
  );
  let node = common.nodeType === 3 ? common : walker.nextNode();
  while (node) {
    let intersects = false;
    try { intersects = range.intersectsNode(node); } catch { intersects = false; }
    if (intersects) {
      const parent = node.parentElement;
      if (!parent || isSensitiveElement(parent) || matchesIgnoredSelector(parent, ignoredSelectors)) return true;
    }
    if (common.nodeType === 3) break;
    node = walker.nextNode();
  }
  return false;
}

export function createRegionTargetDescriptor(region, { route = "/", windowRef = window } = {}) {
  const viewportWidth = Math.max(1, windowRef.innerWidth);
  const viewportHeight = Math.max(1, windowRef.innerHeight);
  const rounded = {
    x: Math.round(region.left),
    y: Math.round(region.top),
    width: Math.round(region.width),
    height: Math.round(region.height),
  };

  return {
    kind: "region",
    tagName: "region",
    role: "",
    accessibleName: "Drawn region",
    visibleText: "",
    bounds: rounded,
    viewportBounds: rounded,
    pageBounds: {
      ...rounded,
      x: Math.round(region.left + windowRef.scrollX),
      y: Math.round(region.top + windowRef.scrollY),
    },
    normalizedBounds: {
      x: region.left / viewportWidth,
      y: region.top / viewportHeight,
      width: region.width / viewportWidth,
      height: region.height / viewportHeight,
    },
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
      scrollX: Math.round(windowRef.scrollX),
      scrollY: Math.round(windowRef.scrollY),
      devicePixelRatio: Number(windowRef.devicePixelRatio) || 1,
      visualScale: Number(windowRef.visualViewport?.scale) || 1,
    },
    locatorCandidates: { stableId: null, id: null, domPath: "" },
    route,
    capturedAt: new Date().toISOString(),
  };
}

export function findInvalidIgnoredSelector(ignoredSelectors, documentRef) {
  const root = documentRef?.createDocumentFragment?.();
  if (!root) return null;

  for (const selector of ignoredSelectors || []) {
    if (typeof selector !== "string") return String(selector);
    try {
      root.querySelector(selector);
    } catch {
      return selector;
    }
  }
  return null;
}

export function findSelectableTarget(rawTarget, shadowHost, ignoredSelectors = []) {
  const ElementConstructor = rawTarget?.ownerDocument?.defaultView?.Element;
  if (!ElementConstructor || !(rawTarget instanceof ElementConstructor)) return null;
  if (shadowHost && (rawTarget === shadowHost || shadowHost.contains(rawTarget))) return null;
  if (matchesIgnoredSelector(rawTarget, ignoredSelectors) || isSensitiveElement(rawTarget)) return null;

  const interactive = rawTarget.closest(INTERACTIVE_SELECTOR);
  const candidate = interactive && !isSensitiveElement(interactive) ? interactive : rawTarget;
  if (["html", "body"].includes(candidate.tagName.toLowerCase())) return null;

  const rect = candidate.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return candidate;
}

export function createTextTargetDescriptor(
  range,
  { route = "/", ignoredSelectors = [], shadowHost = null, windowRef } = {},
) {
  const documentRef = range?.commonAncestorContainer?.ownerDocument;
  const resolvedWindow = windowRef || documentRef?.defaultView;
  const rawText = normalizeText(range?.toString?.(), 1000);
  const rect = rectFromRange(range);
  const common = range?.commonAncestorContainer;
  const commonElement = common?.nodeType === 1 ? common : common?.parentElement;
  if (
    !documentRef
    || !resolvedWindow
    || !rawText
    || !rect
    || range.collapsed
    || rangeTouchesProtectedContent(range, ignoredSelectors)
    || (shadowHost && (commonElement === shadowHost || shadowHost.contains(commonElement)))
  ) {
    return null;
  }

  const selectable = findSelectableTarget(commonElement, shadowHost, ignoredSelectors) || commonElement;
  if (!selectable || ["html", "body"].includes(selectable.tagName?.toLowerCase?.())) return null;
  const base = createTargetDescriptor(selectable, { route, ignoredSelectors });
  const viewportWidth = Math.max(1, resolvedWindow.innerWidth);
  const viewportHeight = Math.max(1, resolvedWindow.innerHeight);
  const rounded = {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };

  return {
    ...base,
    kind: "text",
    accessibleName: "Selected text",
    visibleText: normalizeText(rawText),
    selectedText: rawText,
    bounds: rounded,
    viewportBounds: rounded,
    pageBounds: {
      ...rounded,
      x: Math.round(rect.left + resolvedWindow.scrollX),
      y: Math.round(rect.top + resolvedWindow.scrollY),
    },
    normalizedBounds: {
      x: rect.left / viewportWidth,
      y: rect.top / viewportHeight,
      width: rect.width / viewportWidth,
      height: rect.height / viewportHeight,
    },
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
      scrollX: Math.round(resolvedWindow.scrollX),
      scrollY: Math.round(resolvedWindow.scrollY),
      devicePixelRatio: Number(resolvedWindow.devicePixelRatio) || 1,
      visualScale: Number(resolvedWindow.visualViewport?.scale) || 1,
    },
  };
}

function intersectsMarquee(selectionRect, candidateRect) {
  const intersectionWidth = Math.max(
    0,
    Math.min(selectionRect.left + selectionRect.width, candidateRect.right)
      - Math.max(selectionRect.left, candidateRect.left),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(selectionRect.top + selectionRect.height, candidateRect.bottom)
      - Math.max(selectionRect.top, candidateRect.top),
  );
  if (!intersectionWidth || !intersectionHeight) return false;
  const centerX = candidateRect.left + candidateRect.width / 2;
  const centerY = candidateRect.top + candidateRect.height / 2;
  const centerInside = centerX >= selectionRect.left
    && centerX <= selectionRect.left + selectionRect.width
    && centerY >= selectionRect.top
    && centerY <= selectionRect.top + selectionRect.height;
  const candidateArea = Math.max(1, candidateRect.width * candidateRect.height);
  return centerInside || (intersectionWidth * intersectionHeight) / candidateArea >= 0.65;
}

export function findMarqueeTargets(
  selectionRect,
  { documentRef = document, shadowHost = null, ignoredSelectors = [], maxTargets = 20 } = {},
) {
  if (!selectionRect || selectionRect.width < 1 || selectionRect.height < 1) return [];
  const stableSelector = `[${THREADMARK_TARGET_ATTRIBUTE}]`;
  const semanticSelector = [
    stableSelector,
    "button",
    "a[href]",
    "summary",
    "article",
    "section",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "img",
    "[role]",
  ].join(",");
  const candidates = [...documentRef.querySelectorAll(semanticSelector)]
    .map((element) => findSelectableTarget(element, shadowHost, ignoredSelectors))
    .filter(Boolean)
    .filter((element, index, list) => list.indexOf(element) === index)
    .filter((element) => intersectsMarquee(selectionRect, element.getBoundingClientRect()));
  const stable = candidates.filter((element) => element.hasAttribute(THREADMARK_TARGET_ATTRIBUTE));
  const selected = stable.length
    ? stable
    : candidates.filter((candidate) => !candidates.some(
      (other) => other !== candidate && other.contains(candidate),
    ));

  return selected
    .sort((first, second) => {
      const position = first.compareDocumentPosition(second);
      const following = first.ownerDocument.defaultView?.Node?.DOCUMENT_POSITION_FOLLOWING || 4;
      return position & following ? -1 : 1;
    })
    .slice(0, Math.max(1, maxTargets) + 1);
}

export function createTargetDescriptor(element, { route = "/", ignoredSelectors = [] } = {}) {
  const rect = element.getBoundingClientRect();
  const rawStableId = element.getAttribute(THREADMARK_TARGET_ATTRIBUTE);
  const stableId = isValidThreadmarkTargetId(rawStableId) ? rawStableId : null;

  return {
    tagName: element.tagName.toLowerCase(),
    role: elementRole(element),
    accessibleName: accessibleName(element, ignoredSelectors),
    visibleText: safeVisibleText(element, ignoredSelectors),
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    // Page position lets a removed element's comment be shown where it used to be.
    pageBounds: {
      x: Math.round(rect.x + (element.ownerDocument?.defaultView?.scrollX || 0)),
      y: Math.round(rect.y + (element.ownerDocument?.defaultView?.scrollY || 0)),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    locatorCandidates: {
      stableId: stableId || null,
      id: null,
      domPath: buildDomPath(element),
    },
    route,
    capturedAt: new Date().toISOString(),
  };
}
