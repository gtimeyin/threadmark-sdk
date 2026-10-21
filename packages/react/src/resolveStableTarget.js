import { THREADMARK_TARGET_ATTRIBUTE } from "./targetId.js";

// Resolves a stable Threadmark ID to exactly one live element. Callers decide which
// elements are acceptable; more than one acceptable match is ambiguous and never guessed.
export function resolveStableTarget(stableId, { documentRef = document, accept = () => true } = {}) {
  if (!stableId || !documentRef) return { status: "missing", element: null, candidates: [] };
  const candidates = [...documentRef.querySelectorAll(`[${THREADMARK_TARGET_ATTRIBUTE}]`)]
    .filter((element) => element.getAttribute(THREADMARK_TARGET_ATTRIBUTE) === stableId)
    .filter((element) => accept(element));
  if (candidates.length === 1) return { status: "resolved", element: candidates[0], candidates };
  if (candidates.length > 1) return { status: "ambiguous", element: null, candidates };
  return { status: "missing", element: null, candidates: [] };
}
