// Production-safe entry for Threadmark tours. Keep its import graph free of the review
// overlay and capture code; tests/package.test.mjs enforces this and a size budget.

export { THREADMARK_TARGET_ATTRIBUTE, threadmarkTarget } from "./targetId.js";
export { ThreadmarkTours, useThreadmarkTours } from "./tours/ThreadmarkTours.jsx";
export { TourValidationError, defineTour, validateTour } from "./tours/schema.js";
export { checkTourTheme } from "./tours/theme.js";
