/** Geometry is independent of comment content: scroll subscribers never rerender the full overlay. */
export function sameRect(left, right) {
  return left === right || Boolean(left && right && left.left === right.left && left.top === right.top
    && left.width === right.width && left.height === right.height);
}

export function createMarkerPositions() {
  const rects = new Map(), listeners = new Map();
  return {
    get: id => rects.get(id) || null,
    subscribe(id, listener) {
      if (!id) return () => {};
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(listener);
      return () => {
        const group = listeners.get(id);
        group?.delete(listener);
        if (!group?.size) listeners.delete(id);
      };
    },
    update(results) {
      const changed = new Set();
      for (const [id, result] of Object.entries(results)) {
        const rect = result.rect || null;
        if (!sameRect(rects.get(id) || null, rect)) { rects.set(id, rect); changed.add(id); }
      }
      for (const id of rects.keys()) if (!Object.hasOwn(results, id)) { rects.delete(id); changed.add(id); }
      // Publish after the whole batch, so every subscriber sees a consistent geometry snapshot.
      for (const id of changed) for (const listener of listeners.get(id) || []) listener();
    },
  };
}
