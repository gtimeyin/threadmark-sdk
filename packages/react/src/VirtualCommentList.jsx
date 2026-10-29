import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

const ESTIMATE = 190;
const OVERSCAN = 3;
const THRESHOLD = 50;

function MeasuredRow({ id, index, top, total, measure, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const read = () => { const height = node.getBoundingClientRect().height; if (height > 0) measure(id, height); };
    read();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(read) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [id, measure]);
  return <li ref={ref} data-comment-index={index} aria-posinset={index + 1} aria-setsize={total}
    style={{ position: 'absolute', top, left: 12, right: 12, display: 'flow-root', ...(index === 0 ? { borderTop: 0 } : {}) }}>{children}</li>;
}

/** Variable-height window with logical list positions and keyboard access to every row. */
export function VirtualCommentList({ items, renderRow, hidden = false, resetKey = "" }) {
  const ref = useRef(null), heights = useRef(new Map()), focusPending = useRef(null);
  const [version, setVersion] = useState(0), [viewport, setViewport] = useState({ top: 0, height: 400 });
  const [focusedId, setFocusedId] = useState(null);
  const virtual = items.length > THRESHOLD;
  const orderKey = JSON.stringify(items.map(item => item.id));
  const measure = useCallback((id, height) => {
    if (heights.current.get(id) !== height) { heights.current.set(id, height); setVersion(value => value + 1); }
  }, []);
  const offsets = useMemo(() => {
    const positions = [0];
    for (const item of items) positions.push(positions.at(-1) + (heights.current.get(item.id) || ESTIMATE));
    return positions;
  }, [items, version]);
  useLayoutEffect(() => {
    const ids = new Set(items.map(item => item.id));
    for (const id of heights.current.keys()) if (!ids.has(id)) heights.current.delete(id);
    if (focusedId && !ids.has(focusedId)) setFocusedId(null);
  }, [orderKey]);
  useLayoutEffect(() => {
    // Reset only for user-selected filters, never an unrelated host edit or insertion.
    const node = ref.current;
    if (node) { node.scrollTop = 0; setViewport({ top: 0, height: node.clientHeight || 400 }); }
  }, [resetKey]);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || hidden) return;
    const read = () => setViewport(previous => {
      const next = { top: node.scrollTop, height: node.clientHeight || 400 };
      return previous.top === next.top && previous.height === next.height ? previous : next;
    });
    read();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(read) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [hidden, virtual]);
  let first = 0, last = items.length;
  if (virtual) {
    while (first < items.length && offsets[first + 1] < viewport.top) first++;
    last = first;
    while (last < items.length && offsets[last] < viewport.top + viewport.height) last++;
    first = Math.max(0, first - OVERSCAN); last = Math.min(items.length, last + OVERSCAN);
  }
  const indices = new Set(Array.from({ length: last - first }, (_, i) => first + i));
  const focusedIndex = items.findIndex(item => item.id === focusedId);
  // Keep the focused row mounted even when the user wheels away; focus never drops into the page.
  if (virtual && focusedIndex >= 0) indices.add(focusedIndex);
  useLayoutEffect(() => {
    if (focusPending.current == null) return;
    const button = ref.current?.querySelector(`[data-comment-index="${focusPending.current}"] button`);
    if (button) { button.focus({ preventScroll: true }); focusPending.current = null; }
  });
  function onKeyDown(event) {
    if (!virtual) return;
    const row = event.target.closest('[data-comment-index]');
    if (!row) return;
    const current = Number(row.dataset.commentIndex);
    let next;
    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) next = current + 1;
    else if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) next = current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next == null || next < 0 || next >= items.length) return;
    event.preventDefault();
    focusPending.current = next;
    setFocusedId(items[next].id);
    const node = ref.current;
    if (offsets[next] < node.scrollTop) node.scrollTop = offsets[next];
    else if (offsets[next + 1] > node.scrollTop + node.clientHeight) node.scrollTop = offsets[next + 1] - node.clientHeight;
    setViewport({ top: node.scrollTop, height: node.clientHeight || 400 });
  }
  return <ol ref={ref} className={`tm-comments-list${virtual ? ' tm-comments-list--virtual' : ''}`}
    style={virtual ? { position: 'relative', overflowAnchor: 'none' } : undefined}
    onScroll={event => { if (!virtual) return; const node = event.currentTarget; setViewport({ top: node.scrollTop, height: node.clientHeight || 400 }); }}
    onKeyDown={onKeyDown} onFocus={event => { const row = event.target.closest('[data-comment-index]'); if (row) setFocusedId(items[Number(row.dataset.commentIndex)]?.id); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null); }}>
    {virtual && <li role="presentation" aria-hidden="true" style={{ height: offsets.at(-1), pointerEvents: 'none', border: 0 }} />}
    {hidden ? null : [...indices].sort((a, b) => a - b).map(index => virtual
      ? <MeasuredRow key={items[index].id} id={items[index].id} index={index} top={offsets[index]} total={items.length} measure={measure}>{renderRow(items[index])}</MeasuredRow>
      : <li key={items[index].id}>{renderRow(items[index])}</li>)}
  </ol>;
}
