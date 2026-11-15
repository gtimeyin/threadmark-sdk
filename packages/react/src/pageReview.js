import { CAPTURE_PRIVATE_SELECTOR } from './privacy.js';
import { createTargetDescriptor } from './target.js';

const PROTECTED = `[data-threadmark-root], [aria-hidden="true"], script, style, noscript, template, ${CAPTURE_PRIVATE_SELECTOR}`;
export const PAGE_REVIEW_LIMIT = 5;

/**
 * What a page review may read: whether an element is off limits (private, ignored, hidden from assistive tech,
 * or a form field), and its accessible name with private parts removed. Shared by the rule scan and the AI
 * outline, so both leave out exactly the same things.
 */
export function createPageInspector({ documentRef = document, ignoredSelectors = [] } = {}) {
  const protectedSelectors = [PROTECTED, ...ignoredSelectors];
  function excluded(element) {
    return protectedSelectors.some(selector => { try { return Boolean(element.closest(selector)); } catch { return true; } });
  }
  function visibleText(element) {
    const walker = documentRef.createTreeWalker(element, 4);
    let node, text = '';
    while ((node = walker.nextNode())) {
      if (node.parentElement && !excluded(node.parentElement)) text += node.textContent;
    }
    return text;
  }
  function name(element) {
    const ids = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    const labels = ids.map(id => documentRef.getElementById(id)).filter(el => el && !excluded(el));
    const labelText = labels.map(visibleText).join(' ').trim();
    const label = element.getAttribute('aria-label')?.trim() || labelText || visibleText(element).trim();
    if (label) return label;
    const image = Array.from(element.querySelectorAll('img[alt]')).find(el => !excluded(el));
    const title = Array.from(element.querySelectorAll('svg title')).find(el => !excluded(el));
    return (image?.getAttribute('alt') || (title ? visibleText(title) : '')).trim();
  }
  return { excluded, name, visibleText, protectedSelectors };
}

/** Capture observable page issues without reading form values, private text, or running host actions. */
export async function collectPageReview({ documentRef = document, route = '/', buildId, ignoredSelectors = [], signal } = {}) {
  const findings = [];
  const windowRef = documentRef.defaultView;
  const { excluded, name, protectedSelectors } = createPageInspector({ documentRef, ignoredSelectors });
  let headingLevel = 0, visited = 0;
  function add(element, rule) {
    const target = createTargetDescriptor(element, { route, ignoredSelectors: protectedSelectors });
    findings.push({ rule, target });
  }
  // An iterator avoids creating an unbounded element list on a large page.
  const walker = documentRef.createTreeWalker(documentRef.body, 1);
  let element;
  while ((element = walker.nextNode()) && visited++ < 3000 && findings.length < PAGE_REVIEW_LIMIT) {
    if (signal?.aborted) throw new DOMException('Review cancelled', 'AbortError');
    if (visited % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    if (excluded(element)) continue;
    const rect = element.getBoundingClientRect(), style = windowRef.getComputedStyle(element);
    if (rect.width <= 0 || rect.height <= 0 || style.visibility === 'hidden' || style.display === 'none') continue;
    const tag = element.tagName.toLowerCase();
    if ((tag === 'button' || tag === 'a' && element.hasAttribute('href') || ['button', 'link'].includes(element.getAttribute('role')))
      && !element.disabled && !name(element)) add(element, 'unnamed-control');
    else if (tag === 'img' && !element.hasAttribute('alt') && !element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby') && !['none', 'presentation'].includes(element.getAttribute('role'))) add(element, 'missing-alt');
    else if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      if (headingLevel && level > headingLevel + 1) add(element, 'heading-jump');
      headingLevel = level;
    } else if (['p', 'li', 'label'].includes(tag) && parseFloat(style.fontSize) < 12 && name(element)) add(element, 'small-text');
    else if (rect.right > windowRef.innerWidth + 8 && rect.width <= windowRef.innerWidth && style.position !== 'fixed'
      && !element.closest('[aria-hidden="true"]') && element.scrollWidth > 0 && ['p', 'h1', 'h2', 'button', 'img', 'table'].includes(tag)) add(element, 'horizontal-overflow');
  }
  return { version: 1, route, buildId: buildId || '', findings, truncated: visited >= 3000 };
}
