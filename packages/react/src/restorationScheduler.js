import { createRestorationContext } from './target.js';
import { sameRect } from './markerPositions.js';

const MUTATION_DELAY = 200;
const SLICE_MS = 8;

/** Owns matching independently of React array identities. No context survives a DOM mutation. */
export function createRestorationScheduler({ assess, suggest, position, onChange,
  documentRef = document, ignoredSelectors = [], onSlice = () => {}, onPositions = onChange, initiallyActive = true }) {
  const view = documentRef.defaultView;
  const records = new Map(), revisions = new Map(), results = new Map();
  const pending = new Set(), suggestions = new Set(), mutationDirty = new Set();
  const observed = new Set();
  let active = false;
  let disposed = false, timer = null, idle = null, debounce = null, frame = null, context = null;
  const now = () => view.performance.now();
  const publish = () => onChange(Object.fromEntries(results));
  const elements = result => (result?.results || []).map(item => item.element).filter(Boolean);
  const resize = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(() => reposition()) : null;

  function syncObservers() {
    // Reuse the matching result for observer wiring, never resolve the target again.
    const desired = new Set([...results.values()].flatMap(elements).filter(element => element.isConnected));
    for (const element of observed) if (!desired.has(element)) { resize?.unobserve(element); observed.delete(element); }
    for (const element of desired) if (!observed.has(element)) { resize?.observe(element); observed.add(element); }
  }

  function store(id, result) {
    results.set(id, result);
  }

  function schedule() {
    if (active && !disposed && timer === null && pending.size) timer = view.setTimeout(run, 0);
  }

  function scheduleSuggestions() {
    if (!active || disposed || idle !== null || !suggestions.size || pending.size) return;
    idle = view.requestIdleCallback
      ? view.requestIdleCallback(runSuggestions, { timeout: 250 })
      : view.setTimeout(() => runSuggestions(null), 16);
  }

  function run() {
    timer = null;
    if (!active || disposed) return;
    context ||= createRestorationContext();
    const start = now();
    let count = 0;
    for (const id of pending) {
      pending.delete(id);
      const annotation = records.get(id);
      if (!annotation) continue;
      const result = assess(annotation, context, true);
      store(id, result);
      if (result.status === 'missing') suggestions.add(id);
      else suggestions.delete(id);
      count++;
      if (now() - start >= SLICE_MS) break;
    }
    syncObservers();
    onSlice({ phase: 'match', duration: now() - start, count });
    publish();
    if (pending.size) schedule();
    else { context = null; scheduleSuggestions(); }
  }

  function runSuggestions(deadline) {
    idle = null;
    if (!active || disposed) return;
    if (pending.size) { schedule(); return; }
    context ||= createRestorationContext();
    const start = now();
    let count = 0;
    for (const id of suggestions) {
      suggestions.delete(id);
      const annotation = records.get(id), result = results.get(id);
      if (!annotation || !result || mutationDirty.has(id)) continue;
      store(id, suggest(annotation, result, context));
      count++;
      if (now() - start >= SLICE_MS || (deadline && deadline.timeRemaining() < 1)) break;
    }
    syncObservers();
    onSlice({ phase: 'suggest', duration: now() - start, count });
    publish();
    context = null;
    scheduleSuggestions();
  }

  function update(annotations) {
    const ids = new Set(annotations.map(item => item.id));
    for (const id of records.keys()) if (!ids.has(id)) {
      records.delete(id); revisions.delete(id); results.delete(id);
      pending.delete(id); suggestions.delete(id); mutationDirty.delete(id);
    }
    for (const annotation of annotations) {
      const revision = annotation.payload.updatedAt;
      if (!records.has(annotation.id) || revisions.get(annotation.id) !== revision) {
        pending.add(annotation.id); suggestions.delete(annotation.id);
      }
      records.set(annotation.id, annotation); revisions.set(annotation.id, revision);
    }
    // A context must not be reused for a changed record/ignored selector configuration.
    context = null;
    if (active) { syncObservers(); publish(); schedule(); }
  }

  function recheck(id) {
    const annotation = records.get(id);
    if (!annotation || disposed) return null;
    setActive(true);
    pending.delete(id); suggestions.delete(id); mutationDirty.delete(id);
    const result = assess(annotation, createRestorationContext(), false);
    store(id, result); syncObservers(); publish();
    return result;
  }

  function reposition() {
    if (!active || disposed || frame !== null) return;
    frame = view.requestAnimationFrame(() => {
      frame = null;
      const start = now();
      let changed = false;
      for (const [id, result] of results) {
        const next = position(records.get(id), result);
        if (!sameRect(result.rect, next.rect)) { results.set(id, next); changed = true; }
      }
      if (changed) onPositions(Object.fromEntries(results));
      onSlice({ phase: 'position', duration: now() - start, count: results.size });
    });
  }

  function ignored(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    return Boolean(element?.closest?.('[data-threadmark-root], [data-threadmark-ignore]')
      || ignoredSelectors.some(selector => {
        try { return element?.closest?.(selector); } catch { return false; }
      }));
  }

  const mutations = typeof view.MutationObserver === 'function' ? new view.MutationObserver(changes => {
    if (!active || disposed) return;
    const relevant = changes.filter(change => (
      !ignored(change.target)
      // A previously visible target may have just entered an ignored/private region.
      || (change.type === 'attributes' && !change.target.closest?.('[data-threadmark-root]')
        && [...observed].some(element => element === change.target || change.target.contains(element)))
    ) && !(change.type === 'childList' && [...change.addedNodes, ...change.removedNodes].every(ignored)));
    if (!relevant.length || disposed) return;
    context = null;
    // Stable IDs promise uniqueness across the document, including siblings outside a matched subtree.
    const changedStableIds = new Set();
    const collectIds = node => {
      if (node.nodeType !== 1) return;
      const id = node.getAttribute('data-threadmark-id');
      if (id) changedStableIds.add(id);
      for (const element of node.querySelectorAll('[data-threadmark-id]')) changedStableIds.add(element.getAttribute('data-threadmark-id'));
    };
    for (const change of relevant) {
      if (change.type === 'childList') for (const node of [...change.addedNodes, ...change.removedNodes]) collectIds(node);
      else if (change.attributeName === 'data-threadmark-id') {
        changedStableIds.add(change.oldValue);
        changedStableIds.add(change.target.getAttribute('data-threadmark-id'));
      }
    }
    for (const id of records.keys()) {
      const payload = records.get(id).payload;
      const descriptors = payload.pin ? [payload.pin.target] : payload.targets || [payload.target];
      const stableIdentityChanged = descriptors.some(target => target?.locatorCandidates?.stableId
        && changedStableIds.has(target.locatorCandidates.stableId));
      const result = results.get(id), targets = elements(result);
      if (!result || result.status !== 'resolved' || stableIdentityChanged || targets.some(element => !element.isConnected)
        || relevant.some(change => targets.some(element => element === change.target
          || element.contains(change.target)
          // Ancestor attribute changes can hide/rename a whole subtree.
          || (change.type === 'attributes' && change.target.contains(element))))) {
        mutationDirty.add(id); suggestions.delete(id);
      }
    }
    view.clearTimeout(debounce);
    debounce = view.setTimeout(() => {
      debounce = null;
      for (const id of mutationDirty) pending.add(id);
      mutationDirty.clear(); schedule();
    }, MUTATION_DELAY);
  }) : null;
  function cancelWork() {
    view.clearTimeout(timer); view.clearTimeout(debounce); view.cancelAnimationFrame(frame);
    if (view.requestIdleCallback) view.cancelIdleCallback(idle); else view.clearTimeout(idle);
    timer = idle = debounce = frame = null;
    context = null;
  }

  function setActive(value) {
    if (disposed || active === value) return;
    active = value;
    if (!active) {
      cancelWork(); mutations?.disconnect(); resize?.disconnect(); observed.clear();
      view.removeEventListener('resize', reposition); view.removeEventListener('scroll', reposition, true);
      return;
    }
    // No observer runs while closed; all cached matches must be refreshed on reopening.
    results.clear(); suggestions.clear(); mutationDirty.clear(); context = null;
    for (const id of records.keys()) pending.add(id);
    mutations?.observe(documentRef.body, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeOldValue: true, attributeFilter: ['data-threadmark-id', 'data-threadmark-ignore', 'data-threadmark-sensitive',
      'role', 'aria-label', 'aria-hidden', 'alt', 'title', 'hidden', 'class', 'style', 'href', 'contenteditable'] });
    view.addEventListener('resize', reposition);
    view.addEventListener('scroll', reposition, { capture: true, passive: true });

    publish(); schedule();
  }

  setActive(initiallyActive);

  return { update, recheck, reposition, setActive, dispose() {
    disposed = true;
    active = false;
    cancelWork();
    mutations?.disconnect(); resize?.disconnect();
    view.removeEventListener('resize', reposition); view.removeEventListener('scroll', reposition, true);
    records.clear(); results.clear(); pending.clear(); suggestions.clear(); context = null;
  } };
}
