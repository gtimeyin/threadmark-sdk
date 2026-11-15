import { createPageInspector, collectPageReview } from './pageReview.js';
import { createTargetDescriptor } from './target.js';
import { captureRegionSnapshot } from './snapshot.js';

export const PAGE_OUTLINE_LIMIT = 150;
const INTERACTIVE_ROLES = new Set(['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch', 'option', 'combobox', 'slider']);
const LANDMARKS = new Set(['header', 'nav', 'main', 'footer', 'aside', 'section', 'form', 'table', 'dialog', 'figure']);

function directText(element) {
  let text = '';
  for (const node of element.childNodes) if (node.nodeType === 3) text += node.textContent;
  return text.trim();
}

/** How much an element matters to a review: controls, headings and images first, then text, then layout. */
function weight(element, tag, role) {
  if (['a', 'button', 'summary'].includes(tag) || INTERACTIVE_ROLES.has(role) || /^h[1-6]$/.test(tag) || role === 'heading'
    || tag === 'img' || (tag === 'svg' && role === 'img') || role === 'img') return 3;
  if (directText(element)) return 2;
  if (LANDMARKS.has(tag) || ['banner', 'navigation', 'main', 'contentinfo', 'region', 'dialog'].includes(role)) return 1;
  return 0;
}

/**
 * An outline of what's on screen for an AI page review: up to 150 visible elements that matter (controls,
 * headings, images, text, landmarks), each with an id `e1`…, its tag, role, accessible name, a sample of its
 * text, its box and font size. Private, ignored and form fields are left out, exactly as the rule scan does,
 * and nothing typed is read. `targets` maps each id to its element and stable target, and stays in the browser.
 */
export async function collectPageOutline({ documentRef = document, route = '/', ignoredSelectors = [], limit = PAGE_OUTLINE_LIMIT, signal } = {}) {
  const windowRef = documentRef.defaultView;
  const { excluded, name, visibleText, protectedSelectors } = createPageInspector({ documentRef, ignoredSelectors });
  const viewport = { width: Math.round(windowRef.innerWidth), height: Math.round(windowRef.innerHeight) };
  const candidates = [];
  const walker = documentRef.createTreeWalker(documentRef.body, 1);
  let element, visited = 0;
  while ((element = walker.nextNode()) && visited++ < 5000) {
    if (signal?.aborted) throw new DOMException('Review cancelled', 'AbortError');
    if (visited % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    if (excluded(element)) continue;
    const tag = element.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template', 'br', 'wbr'].includes(tag)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= viewport.height || rect.left >= viewport.width) continue;
    const style = windowRef.getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
    const role = (element.getAttribute('role') || '').toLowerCase();
    const score = weight(element, tag, role);
    if (score) candidates.push({ element, tag, role, rect, style, score, order: candidates.length });
  }
  // Keep the most useful when there are too many, then put them back in page order.
  const kept = [...candidates].sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).sort((a, b) => a.order - b.order);
  const elements = [], targets = new Map();
  kept.forEach((item, index) => {
    const id = `e${index + 1}`;
    const accessibleName = item.score === 3 ? name(item.element).replace(/\s+/g, ' ').slice(0, 120) : '';
    const text = (item.score === 2 ? directText(item.element) || visibleText(item.element) : item.score === 3 && !accessibleName ? visibleText(item.element) : '')
      .replace(/\s+/g, ' ').trim().slice(0, 200);
    const entry = {
      id, tag: item.tag,
      box: { x: Math.round(item.rect.left), y: Math.round(item.rect.top), w: Math.round(item.rect.width), h: Math.round(item.rect.height) },
      fontSize: Math.round(parseFloat(item.style.fontSize) || 0) || undefined,
    };
    if (item.role) entry.role = item.role;
    if (accessibleName) entry.name = accessibleName;
    if (text) entry.text = text;
    if (item.tag === 'img' && !accessibleName) entry.name = (item.element.getAttribute('alt') ?? '').slice(0, 120) || undefined;
    elements.push(entry);
    targets.set(id, { element: item.element, target: createTargetDescriptor(item.element, { route, ignoredSelectors: protectedSelectors }) });
  });
  return { viewport, elements, targets };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Everything Threadmark's `onPageReview` receives: the route and build, the reviewer's focus, the viewport,
 * the outline, a masked screenshot of the viewport (private areas and form fields masked), the rule scan's
 * findings as hints, and the comments already on this page. Resolves to `{ request, targets }`; `targets`
 * stays in the browser so suggestions can be pinned to the right element.
 */
export async function preparePageReview({ documentRef = document, route = '/', buildId, focus = '', ignoredSelectors = [], existing = [], signal } = {}) {
  const outline = await collectPageOutline({ documentRef, route, ignoredSelectors, signal });
  if (!outline.elements.length) throw new Error('Nothing on screen to review.');
  const rules = await collectPageReview({ documentRef, route, buildId, ignoredSelectors, signal });
  const idFor = (target) => {
    const key = target?.locatorCandidates?.stableId || target?.locatorCandidates?.domPath;
    for (const [id, entry] of outline.targets) {
      if (key && (entry.target.locatorCandidates?.stableId || entry.target.locatorCandidates?.domPath) === key) return id;
    }
    return null;
  };
  const hints = rules.findings.map(finding => ({ rule: finding.rule, element: idFor(finding.target) })).filter(hint => hint.element);
  const shot = await captureRegionSnapshot({
    id: `page-review-${Date.now().toString(36)}`,
    region: { left: 0, top: 0, width: outline.viewport.width, height: outline.viewport.height },
    ignoredSelectors: [...ignoredSelectors, '[data-private]'], documentRef, windowRef: documentRef.defaultView, signal,
  });
  if (signal?.aborted) throw new DOMException('Review cancelled', 'AbortError');
  const request = {
    route, buildId: buildId || null, focus: String(focus || '').trim().slice(0, 280) || null,
    viewport: outline.viewport, elements: outline.elements, hints,
    existing: existing.slice(0, 30).map(item => ({ comment: String(item.comment || '').slice(0, 200), ...(idFor(item.target) ? { element: idFor(item.target) } : {}) })).filter(item => item.comment),
    screenshot: { type: shot.blob.type || 'image/webp', base64: await blobToBase64(shot.blob) },
  };
  return { request, targets: outline.targets };
}
