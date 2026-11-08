import { createTargetDescriptor } from './target.js';

const PROTECTED = '[data-threadmark-root], [data-threadmark-ignore], [data-threadmark-sensitive], [data-private], input, textarea, select, [contenteditable]:not([contenteditable="false"])';
export const PAGE_REVIEW_LIMIT = 5;

/** Capture observable page issues without reading form values, private text, or running host actions. */
export async function collectPageReview({ documentRef = document, route = '/', buildId, ignoredSelectors = [], signal } = {}) {
  const findings = [];
  const windowRef = documentRef.defaultView;
  let headingLevel = 0, visited = 0;
  function excluded(element) {
    if (element.closest(PROTECTED) || element.closest('[aria-hidden="true"]')) return true;
    return ignoredSelectors.some(selector => { try { return Boolean(element.closest(selector)); } catch { return true; } });
  }
  function name(element) {
    const ids = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    const labels = ids.map(id => documentRef.getElementById(id)).filter(el => el && !excluded(el));
    const clone = element.cloneNode(true);
    clone.querySelectorAll(`${PROTECTED}, [aria-hidden="true"]`).forEach(el => el.remove());
    for (const selector of ignoredSelectors) { try { clone.querySelectorAll(selector).forEach(el => el.remove()); } catch {} }
    const labelText = labels.map(el => { const copy = el.cloneNode(true); copy.querySelectorAll(`${PROTECTED}, [aria-hidden="true"]`).forEach(child => child.remove()); return copy.textContent; }).join(' ');
    return (element.getAttribute('aria-label') || labelText || clone.textContent
      || element.querySelector('img[alt]')?.getAttribute('alt') || element.querySelector('svg title')?.textContent || '').trim();
  }
  function add(element, rule) {
    const target = createTargetDescriptor(element, { route, ignoredSelectors: [...ignoredSelectors, '[data-private]'] });
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
