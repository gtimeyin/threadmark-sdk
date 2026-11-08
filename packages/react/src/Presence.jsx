import { useEffect, useRef, useState } from 'react';
import { SelectIcon as MousePointer2 } from "./icons.jsx";
const colors = ['#0B4F3A', '#6550A1', '#216BA5', '#9A5B16', '#AC3863'];
const colorFor = id => colors[Array.from(id).reduce((n, ch) => n + ch.charCodeAt(0), 0) % colors.length];

/** Movement lives in refs and DOM transforms, never in the host application's React state. */
export function Presence({ transport, route, buildId, projectKey, ignoredSelectors = [] }) {
  const [members, setMembers] = useState([]), [hidden, setHidden] = useState(false);
  const positions = useRef([]), nodes = useRef(new Map());
  useEffect(() => {
    if (!transport) return;
    let connection, idleTimer;
    const anchorsById = new Map();
    const start = () => {
      if (document.hidden || connection) return;
      connection = transport.connect({ route, buildId, projectKey }, next => {
        positions.current = next;
        setMembers(previous => {
          const keys = list => list.map(item => `${item.connectionId}:${item.member.id}:${item.member.displayName}`).join('|');
          return keys(previous) === keys(next) ? previous : next;
        });
      });
    };
    const move = event => {
      if (!connection || event.pointerType === 'touch') return;
      const target = event.target;
      const excluded = event.composedPath().some(node => node?.hasAttribute?.('data-threadmark-root'))
        || target?.closest?.('input, textarea, [contenteditable], [data-threadmark-ignore], [data-private]')
        || ignoredSelectors.some(selector => { try { return target?.closest?.(selector); } catch { return true; } });
      let cursor = excluded ? null : { x: event.pageX, y: event.pageY };
      const anchor = target?.closest?.('[data-threadmark-id]');
      if (cursor && anchor) {
        const rect = anchor.getBoundingClientRect();
        if (rect.width && rect.height) cursor = { ...cursor, targetId: anchor.getAttribute('data-threadmark-id'),
          offsetX: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          offsetY: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
      }
      connection.publish(cursor);
      clearTimeout(idleTimer); idleTimer = setTimeout(() => connection?.publish(null), 5000);
    };
    const leave = () => connection?.publish(null);
    const visibility = () => {
      if (document.hidden) { connection?.close(); connection = undefined; } else start();
    };
    start();
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave); document.addEventListener('visibilitychange', visibility);
    let frame;
    const paint = () => {
      for (const item of positions.current) {
        const node = nodes.current.get(item.connectionId); if (!node) continue;
        const cursor = item.cursor;
        let x = cursor?.x - window.scrollX, y = cursor?.y - window.scrollY;
        if (cursor?.targetId) {
          let anchor = anchorsById.get(cursor.targetId);
          if (!anchor?.isConnected) {
            const matches = Array.from(document.querySelectorAll('[data-threadmark-id]')).filter(el => el.getAttribute('data-threadmark-id') === cursor.targetId);
            anchor = matches.length === 1 ? matches[0] : null;
            anchorsById.set(cursor.targetId, anchor);
          }
          if (!anchor) { node.style.opacity = '0'; continue; }
          const rect = anchor.getBoundingClientRect(); x = rect.left + rect.width * cursor.offsetX; y = rect.top + rect.height * cursor.offsetY;
        }
        node.style.opacity = cursor && Date.now() - item.updatedAt < 6000 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? '1' : '0';
        if (cursor) node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => {
      clearTimeout(idleTimer); cancelAnimationFrame(frame); connection?.close();
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [transport, route, buildId, projectKey, ignoredSelectors]);
  const people = [...new Map(members.map(item => [item.member.id, item.member])).values()];
  return <>
    {people.length > 0 && <div className="tm-presence-bar"><span title={people.map(p => p.displayName).join(', ')}>{people.length} {people.length === 1 ? 'other reviewer' : 'other reviewers'} on this page</span><button type="button" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? 'Show cursors' : 'Hide cursors'}</button></div>}
    <div className="tm-presence-layer" aria-hidden="true" style={{ display: hidden ? 'none' : undefined }}>
      {members.map(item => <div className="tm-live-cursor" key={item.connectionId} ref={node => { if (node) nodes.current.set(item.connectionId, node); else nodes.current.delete(item.connectionId); }} style={{ color: colorFor(item.member.id) }}><MousePointer2 size={20} fill="currentColor" stroke="white" /><span style={{ background: colorFor(item.member.id) }}>{item.member.displayName}</span></div>)}
    </div>
  </>;
}
