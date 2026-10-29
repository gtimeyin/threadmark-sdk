function fingerprint(value) {
  try { return JSON.stringify(value); } catch { return null; }
}
function sameEvidence(left = [], right = []) {
  return left.length === right.length && left.every((item, i) => item?.id === right[i]?.id
    && item?.url === right[i]?.url && item?.blob === right[i]?.blob);
}

/** Per-instance, bounded to the latest authorized scope. Blobs stay references, never serialized. */
export function createAnnotationHydrator(normalize) {
  let cache = new Map(), scope = null, previous = [];
  return {
    hydrate(records, nextScope) {
      if (scope !== nextScope) { cache.clear(); previous = []; scope = nextScope; }
      const nextCache = new Map(), annotations = [];
      for (const record of records) {
        const source = record?.feedback;
        if (!source?.id || !source.target) continue;
        // Detect changed content even when a host forgets to advance updatedAt.
        const content = fingerprint(source), poll = fingerprint(record.context?.poll ?? null);
        const old = cache.get(source.id);
        const reusePayload = content !== null && old?.revision === source.updatedAt && old.content === content;
        const evidence = record.context?.evidence || [];
        if (!Array.isArray(evidence)) continue;
        const reuseAll = reusePayload && poll !== null && old.poll === poll && sameEvidence(old.evidence, evidence);
        const annotation = reuseAll ? old.annotation : normalize(record, reusePayload ? old.annotation.payload : null);
        if (!annotation) continue;
        annotations.push(annotation);
        nextCache.set(source.id, { annotation, content, poll, revision: source.updatedAt,
          evidence: evidence.map(item => ({ id: item?.id, url: item?.url, blob: item?.blob })) });
      }
      cache = nextCache;
      if (annotations.length === previous.length && annotations.every((item, i) => item === previous[i])) return previous;
      previous = annotations;
      return annotations;
    },
    clear() { cache.clear(); scope = null; previous = []; },
  };
}
