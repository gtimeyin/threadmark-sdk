// What session replay may keep about a request beyond its method, path, status, and duration:
//
// - Timing phases from the browser's resource timing (DNS, connection, TLS, waiting, download). Always on.
// - For GraphQL: the operation's name and type, read from the request, and whether the response carried errors
//   despite HTTP 200, with their error codes. Always on: names and codes are identifiers in the app's code.
// - Bodies and a few headers, only when the host opts in (`sessionReplay.network.bodies`), and strictly
//   filtered: JSON, form, and text only; credential-named fields redacted at any depth; emails, card numbers,
//   JWTs, and key-shaped strings scrubbed; nothing from sign-in, token, or password endpoints; headers from a
//   short allowlist only; each body at most 16,000 characters; and a rolling budget so a chatty page can't fill
//   memory. A host's own `sanitize` hook runs last, and if it throws, the bodies are dropped.

import { isSecretName, scrubConsoleText } from "./scrub.js";

export const MAX_BODY_CHARS = 16_000;
const MAX_PARSE_CHARS = 512 * 1024;
const BODY_BUDGET_CHARS = 4_000_000;
const BODY_BUDGET_WINDOW_MS = 2 * 60_000;
const IDENTIFIER = /^[_A-Za-z][_0-9A-Za-z]{0,99}$/;
const ERROR_CODE = /^[A-Za-z0-9_.:-]{1,60}$/;
const CREDENTIAL_ENDPOINT = /\/(?:log-?in|log-?out|sign-?in|sign-?out|sign-?up|register|auth|oauth2?|authorize|token|tokens|password|passwords|session|sessions|mfa|2fa|otp|verify|reset)(?=$|[/.?#_-])/i;
const REQUEST_HEADERS = new Set(["content-type", "accept"]);
const RESPONSE_HEADERS = new Set([
  "content-type", "content-length", "cache-control", "age", "etag", "retry-after", "server-timing",
  "x-request-id", "x-correlation-id", "x-trace-id", "traceparent", "x-cache",
]);

export const DEFAULT_NETWORK_OPTIONS = Object.freeze({ bodies: false, sanitize: null });

/** `sessionReplay.network` → `{ bodies, sanitize }`. Bodies stay off unless `bodies` is exactly true. */
export function resolveNetworkOptions(value) {
  if (!value || typeof value !== "object") return DEFAULT_NETWORK_OPTIONS;
  return { bodies: value.bodies === true, sanitize: typeof value.sanitize === "function" ? value.sanitize : null };
}

/** True for paths that sign people in or handle passwords and tokens: their bodies are never kept. */
export function isCredentialEndpoint(url, base = globalThis.location?.href || "https://threadmark.invalid/") {
  try {
    return CREDENTIAL_ENDPOINT.test(new URL(String(url), base).pathname);
  } catch {
    return true;
  }
}

function parseJson(text) {
  if (typeof text !== "string" || text.length > MAX_PARSE_CHARS) return undefined;
  const trimmed = text.trimStart();
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function operationFromQuery(query) {
  const match = /^\s*(?:#[^\n]*\n\s*)*(query|mutation|subscription)\b\s*([_A-Za-z][_0-9A-Za-z]*)?/.exec(String(query || ""));
  if (match) return { type: match[1], name: match[2] || null };
  return /^\s*\{/.test(String(query || "")) ? { type: "query", name: null } : null;
}

/**
 * A GraphQL request's operation, `{ type, name, batch? }`, from a POST body (`{ query, operationName }`, a
 * persisted query, or a batch) or a GET's `query`/`operationName` parameters; null for anything else.
 */
export function graphqlOperation(method, rawUrl, body, base = globalThis.location?.href || "https://threadmark.invalid/") {
  let payload = typeof body === "string" ? parseJson(body) : undefined;
  if (payload === undefined && String(method).toUpperCase() === "GET") {
    try {
      const params = new URL(String(rawUrl), base).searchParams;
      if (params.has("query") || params.has("operationName")) {
        payload = { query: params.get("query") || "", operationName: params.get("operationName") || null };
      }
    } catch {
      payload = undefined;
    }
  }
  const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const first = items[0];
  if (!first || typeof first !== "object") return null;
  const persisted = first.extensions && typeof first.extensions === "object" && first.extensions.persistedQuery;
  if (typeof first.query !== "string" && !persisted) return null;
  const parsed = operationFromQuery(first.query);
  const name = typeof first.operationName === "string" && IDENTIFIER.test(first.operationName)
    ? first.operationName
    : parsed?.name && IDENTIFIER.test(parsed.name) ? parsed.name : null;
  return { type: parsed?.type || "query", name, ...(items.length > 1 ? { batch: Math.min(items.length, 100) } : {}) };
}

/**
 * Errors in a GraphQL response body (servers answer 200 with `errors`): their count, codes from
 * `extensions.code`, and (scrubbed, for hosts that keep bodies) their messages. Null when there are none.
 */
export function graphqlErrors(text) {
  const payload = parseJson(text);
  const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const errors = items.flatMap((item) => (item && Array.isArray(item.errors) ? item.errors : []));
  if (!errors.length) return null;
  const codes = [...new Set(errors.map((error) => error?.extensions?.code).filter((code) => typeof code === "string" && ERROR_CODE.test(code)))].slice(0, 5);
  const messages = errors.map((error) => (typeof error?.message === "string" ? scrubConsoleText(error.message).slice(0, 300) : "")).filter(Boolean).slice(0, 3);
  return { count: Math.min(errors.length, 999), codes, messages };
}

function cleanJsonValue(value, depth) {
  if (typeof value === "string") return scrubConsoleText(value).slice(0, 2000);
  if (value === null || typeof value !== "object") return value;
  if (depth > 20) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => cleanJsonValue(item, depth + 1));
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 200)) {
    result[key] = isSecretName(key) ? "[redacted]" : cleanJsonValue(item, depth + 1);
  }
  return result;
}

function truncate(text) {
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}… [${text.length - MAX_BODY_CHARS} more characters not kept]` : text;
}

/**
 * A body as it may be kept: JSON with credential fields redacted and strings scrubbed; form fields the same;
 * plain text scrubbed; anything else described, not kept.
 */
export function cleanBody(body, contentType = "") {
  if (body == null || body === "") return null;
  const type = String(contentType || "").toLowerCase();
  if (typeof body !== "string") {
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return cleanBody(body.toString(), "application/x-www-form-urlencoded");
    if (typeof FormData !== "undefined" && body instanceof FormData) return `[form data: ${[...body.keys()].length} fields, not kept]`;
    const size = Number(body?.size ?? body?.byteLength);
    return `[binary: ${Number.isFinite(size) ? `${size} bytes` : "body"}, not kept]`;
  }
  const json = parseJson(body);
  if (json !== undefined) return truncate(JSON.stringify(cleanJsonValue(json, 0)));
  if (type.includes("x-www-form-urlencoded") || (!type && /^[\w.%-]+=[^&]*(&[\w.%-]+=[^&]*)*$/.test(body.slice(0, 2000)))) {
    try {
      const params = new URLSearchParams(body);
      const cleaned = new URLSearchParams();
      for (const [key, value] of params) cleaned.append(key, isSecretName(key) ? "[redacted]" : scrubConsoleText(value).slice(0, 2000));
      return truncate(cleaned.toString());
    } catch {
      return "[form body, not kept]";
    }
  }
  if (!type || /^text\/|json|xml|graphql|javascript/.test(type)) {
    if (body.length > MAX_PARSE_CHARS) return `[text: ${body.length} characters, not kept]`;
    return truncate(scrubConsoleText(body));
  }
  return `[${type.split(";")[0]}: ${body.length} characters, not kept]`;
}

/** Only allowlisted headers, lowercased, values scrubbed and short. */
export function pickHeaders(headers, kind) {
  const allow = kind === "request" ? REQUEST_HEADERS : RESPONSE_HEADERS;
  const result = {};
  const add = (name, value) => {
    const key = String(name).toLowerCase();
    if (allow.has(key) && value != null) result[key] = scrubConsoleText(String(value)).slice(0, 300);
  };
  try {
    if (!headers) return result;
    if (typeof headers.forEach === "function" && typeof headers.get === "function") headers.forEach((value, name) => add(name, value));
    else if (Array.isArray(headers)) for (const [name, value] of headers) add(name, value);
    else if (typeof headers === "string") {
      for (const line of headers.split(/\r?\n/)) {
        const index = line.indexOf(":");
        if (index > 0) add(line.slice(0, index).trim(), line.slice(index + 1).trim());
      }
    } else if (typeof headers === "object") for (const [name, value] of Object.entries(headers)) add(name, value);
  } catch {
    return {};
  }
  return result;
}

/** A rolling allowance of body characters, so a chatty page can't fill the reviewer's memory. */
export function createBodyBudget({ limit = BODY_BUDGET_CHARS, windowMs = BODY_BUDGET_WINDOW_MS, now = () => Date.now() } = {}) {
  const spent = [];
  return {
    take(size) {
      const time = now();
      while (spent.length && spent[0][0] < time - windowMs) spent.shift();
      const used = spent.reduce((total, [, amount]) => total + amount, 0);
      if (used + size > limit) return false;
      spent.push([time, size]);
      return true;
    },
  };
}

/**
 * Applies the host's `sanitize(entry)` to a request's kept details. It returns the entry (edited or not) or
 * null to drop the bodies and headers; if it throws or returns anything else, they are dropped too.
 */
export function applySanitizer(sanitize, entry) {
  if (!sanitize) return entry;
  try {
    const result = sanitize({ ...entry, request: { ...entry.request }, response: { ...entry.response } });
    if (!result || typeof result !== "object") return null;
    const pick = (side) => ({
      headers: side?.headers && typeof side.headers === "object" ? pickHeaders(side.headers, side === result.request ? "request" : "response") : {},
      body: typeof side?.body === "string" ? truncate(side.body) : null,
    });
    return { ...entry, request: pick(result.request), response: pick(result.response) };
  } catch {
    return null;
  }
}

const span = (from, to) => (from > 0 && to >= from ? Math.round(to - from) : null);

const FETCH_INITIATORS = ["fetch", "xmlhttprequest", "beacon"];

/**
 * Timing phases of a resource-timing entry (`fetch`/`xmlhttprequest`). Cross-origin responses without
 * `Timing-Allow-Origin` hide the phases; then only the total is known.
 */
export function timingPhases(entry, timeOrigin) {
  if (!entry || !FETCH_INITIATORS.includes(entry.initiatorType)) return null;
  return measureTiming(entry, timeOrigin);
}

const RESOURCE_EXTENSIONS = [
  [/\.(?:woff2?|ttf|otf|eot)$/i, "font"],
  [/\.css$/i, "css"],
  [/\.m?js$/i, "js"],
  [/\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i, "img"],
  [/\.(?:mp4|webm|mov|m4a|mp3|ogg|wav|m3u8)$/i, "media"],
];
const RESOURCE_INITIATORS = { script: "js", link: "css", css: "css", img: "img", image: "img", video: "media", audio: "media", track: "media", iframe: "doc", frame: "doc" };

/** What a page resource is (js, css, img, font, media, doc, or other), from its file extension, then its initiator. */
export function resourceKind(initiatorType, url) {
  let path = String(url || "");
  try {
    path = new URL(path).pathname;
  } catch {
    // Keep the raw text.
  }
  for (const [pattern, kind] of RESOURCE_EXTENSIONS) if (pattern.test(path)) return kind;
  return RESOURCE_INITIATORS[initiatorType] || "other";
}

/**
 * A resource the browser loaded for the page itself (script, stylesheet, image, font, media, frame), from
 * its resource-timing entry: its kind, timing, and its status when the browser exposes it. Fetch and XHR
 * requests are recorded by the patched APIs instead.
 */
export function resourceTiming(entry, timeOrigin) {
  if (!entry?.initiatorType || FETCH_INITIATORS.includes(entry.initiatorType)) return null;
  const status = Number(entry.responseStatus);
  return { resource: resourceKind(entry.initiatorType, entry.name), ...measureTiming(entry, timeOrigin), ...(status > 0 ? { status } : {}) };
}

function measureTiming(entry, timeOrigin) {
  const phases = {
    queuedMs: span(entry.startTime || entry.fetchStart, entry.domainLookupStart || entry.connectStart || entry.requestStart),
    dnsMs: span(entry.domainLookupStart, entry.domainLookupEnd),
    connectMs: span(entry.connectStart, entry.secureConnectionStart > 0 ? entry.secureConnectionStart : entry.connectEnd),
    tlsMs: span(entry.secureConnectionStart, entry.connectEnd),
    waitMs: span(entry.requestStart, entry.responseStart),
    downloadMs: span(entry.responseStart, entry.responseEnd),
  };
  const known = Object.values(phases).some((value) => value != null);
  return {
    startedAt: Math.round((timeOrigin || 0) + entry.startTime),
    durationMs: Math.round(entry.duration),
    phases: known ? phases : null,
    transferBytes: Number.isFinite(entry.transferSize) && entry.transferSize > 0 ? Math.round(entry.transferSize) : null,
    protocol: typeof entry.nextHopProtocol === "string" && entry.nextHopProtocol ? entry.nextHopProtocol.slice(0, 12) : null,
  };
}
