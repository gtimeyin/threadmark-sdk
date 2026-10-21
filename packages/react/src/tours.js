// Production-safe entry for Threadmark tours. Keep its import graph free of the review
// overlay and capture code; tests/package.test.mjs enforces this and a size budget.

export { THREADMARK_TARGET_ATTRIBUTE, threadmarkTarget } from "./targetId.js";
