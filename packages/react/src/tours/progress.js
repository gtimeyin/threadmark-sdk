// Tour progress records: one per person per tour. Progress follows step ids, not positions,
// so reordering or adding steps never sends people somewhere they've already been.

export const TERMINAL_STATUSES = new Set(["finished", "skipped"]);
const STATUSES = new Set(["inProgress", "paused", "finished", "skipped"]);
const STORAGE_PREFIX = "threadmark:tour:";

export function createProgressRecord(tourId, userId, now) {
  return { tourId, userId: userId || undefined, status: "inProgress", stepId: undefined, seen: [], startedAt: now, updatedAt: now };
}

/** Accepts records from the host or storage; returns null for anything that isn't a usable record. */
export function normalizeProgressRecord(value) {
  if (!value || typeof value !== "object" || typeof value.tourId !== "string" || !STATUSES.has(value.status)) return null;
  const updatedAt = Number(value.updatedAt);
  if (!Number.isFinite(updatedAt)) return null;
  const startedAt = Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : updatedAt;
  return {
    tourId: value.tourId,
    userId: typeof value.userId === "string" ? value.userId : undefined,
    status: value.status,
    stepId: typeof value.stepId === "string" ? value.stepId : undefined,
    seen: Array.isArray(value.seen) ? [...new Set(value.seen.filter((id) => typeof id === "string"))] : [],
    startedAt,
    updatedAt,
  };
}

/**
 * Merges two copies of the same person's progress (another device, a stale tab).
 * Done stays done: a finished or skipped record beats any in-progress one, whatever its age.
 * Otherwise the copy that moved last wins. Seen steps are always combined.
 */
export function mergeProgressRecords(left, right) {
  const a = normalizeProgressRecord(left);
  const b = normalizeProgressRecord(right);
  if (!a || !b) return a || b;
  const aDone = TERMINAL_STATUSES.has(a.status);
  const bDone = TERMINAL_STATUSES.has(b.status);
  const winner = aDone !== bDone ? (aDone ? a : b) : (b.updatedAt > a.updatedAt ? b : a);
  return {
    ...winner,
    seen: [...new Set([...a.seen, ...b.seen])],
    startedAt: Math.min(a.startedAt, b.startedAt),
  };
}

/** Index of the step to show when someone picks a tour back up: the first one they haven't seen. */
export function resumeStepIndex(tour, record) {
  if (!record || !record.seen.length) return 0;
  const seen = new Set(record.seen);
  const unseen = tour.steps.findIndex((step) => !seen.has(step.id));
  return unseen === -1 ? tour.steps.length - 1 : unseen;
}

export function storageKey(tourId, userId) {
  return `${STORAGE_PREFIX}${userId || "anonymous"}:${tourId}`;
}

/** Progress kept in this browser. Every access is guarded: storage can be missing, full, or blocked. */
export function createLocalProgressStore(storage = globalThis.localStorage) {
  return {
    read(tourId, userId) {
      try {
        return normalizeProgressRecord(JSON.parse(storage?.getItem(storageKey(tourId, userId)) || "null"));
      } catch {
        return null;
      }
    },
    write(record) {
      try {
        storage?.setItem(storageKey(record.tourId, record.userId), JSON.stringify(record));
      } catch {
        // Progress is a convenience; a blocked write must never break the tour.
      }
    },
    remove(tourId, userId) {
      try {
        storage?.removeItem(storageKey(tourId, userId));
      } catch {
        // Ignore blocked storage.
      }
    },
  };
}
