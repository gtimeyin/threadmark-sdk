// Leaf module: no imports, so the production tours entry can use stable IDs without pulling in capture code.

export const THREADMARK_TARGET_ATTRIBUTE = "data-threadmark-id";

const STABLE_TARGET_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;

export function threadmarkTarget(id) {
  const normalized = String(id || "").trim();
  if (!normalized) throw new TypeError("threadmarkTarget(id) requires a non-empty stable id.");
  if (!isValidThreadmarkTargetId(normalized)) {
    throw new TypeError(
      "threadmarkTarget(id) accepts 1–120 letters, numbers, dots, underscores, colons, or hyphens.",
    );
  }
  return { [THREADMARK_TARGET_ATTRIBUTE]: normalized };
}

export function isValidThreadmarkTargetId(id) {
  return STABLE_TARGET_ID_PATTERN.test(String(id || ""));
}
