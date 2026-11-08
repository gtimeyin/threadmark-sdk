// Privacy markers sites already use for other session tools, so a site's existing setup also protects what
// Threadmark captures: screenshots mask them, session replays block or mask them, and tab videos blur them.

/** Regions other tools leave out entirely. */
export const OTHER_TOOLS_BLOCK_SELECTORS = Object.freeze([
  ".rr-block",
  ".rr-ignore",
  ".fs-exclude",
  ".fs-block",
  "[data-hj-suppress]",
  "[data-private]",
  ".sentry-block",
  "[data-sentry-block]",
  "[data-openreplay-hidden]",
  ".highlight-block",
  ".highlight-ignore",
  ".heap-ignore",
  "[data-heap-ignore]",
]);

/** Regions other tools show with their text hidden. */
export const OTHER_TOOLS_MASK_SELECTORS = Object.freeze([
  ".rr-mask",
  ".fs-mask",
  "[data-hj-masked]",
  "[data-clarity-mask]",
  ".sentry-mask",
  "[data-sentry-mask]",
  "[data-openreplay-obscured]",
  ".highlight-mask",
  "[data-cs-mask]",
  "[data-cs-encrypt]",
  "[data-matomo-mask]",
  "[data-heap-redact-text]",
  "[data-amp-mask]",
  "[data-jam-blur]:not([data-jam-blur='false']):not([data-jam-blur='no'])",
]);

/** Every region a site marked as private, its own (`data-threadmark-sensitive`) or another tool's. */
export const SITE_PRIVATE_SELECTOR = ["[data-threadmark-sensitive]", ...OTHER_TOOLS_BLOCK_SELECTORS, ...OTHER_TOOLS_MASK_SELECTORS].join(",");

/** Fields whose visible value is private on its own: card details. Password fields already show dots. */
export const PRIVATE_FIELD_SELECTOR = [
  "input[autocomplete='cc-number']",
  "input[autocomplete='cc-csc']",
  "input[autocomplete='cc-exp']",
  "input[autocomplete='cc-exp-month']",
  "input[autocomplete='cc-exp-year']",
].join(",");
