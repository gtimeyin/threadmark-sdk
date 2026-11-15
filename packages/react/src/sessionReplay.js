// Always-on session replay: an in-memory rolling rrweb recording of the page, plus console and network
// activity, kept in the reviewer's browser. Nothing leaves the page until a reviewer posts feedback
// with the replay attached. Inputs are masked, sensitive and ignored regions are blocked, and query values
// and credentials are never recorded. Requests keep their timing and, for GraphQL, the operation name and
// error codes; their bodies and a few safe headers are kept only when the host opts in (`network.bodies`),
// filtered by networkCapture.js. Console text is scrubbed before it is buffered: credentials, key-looking
// strings, emails, card numbers, and URL query values are replaced.
import {
  DEFAULT_NETWORK_OPTIONS,
  applySanitizer,
  cleanBody,
  createBodyBudget,
  graphqlErrors,
  graphqlOperation,
  isCredentialEndpoint,
  pickHeaders,
  resolveNetworkOptions,
  resourceTiming,
  timingPhases,
} from "./networkCapture.js";
import {
  canvasBlockSelectors,
  canvasFrameBytes,
  createCanvasBudget,
  isCanvasFrameEvent,
  resolveCanvasOptions,
  sanitizeCanvasDataUrl,
  sanitizeCanvasFrame,
} from "./canvasReplay.js";
import { OTHER_TOOLS_BLOCK_SELECTORS, OTHER_TOOLS_MASK_SELECTORS } from "./privacy.js";
import { sanitizeReplayUrl, scrubConsoleText } from "./scrub.js";

export { isSecretName, sanitizeReplayUrl, scrubCardNumbers, scrubConsoleText, scrubCredentials } from "./scrub.js";

export const DEFAULT_REPLAY_BUFFER_MS = 30_000;
// Long enough to cover the longest video (10 minutes) and its lead-up, so a video's console and network
// activity travel with it. The event cap below still bounds memory.
export const MAX_REPLAY_HOLD_MS = 11 * 60_000;
export const REPLAY_CHECKOUT_MS = 10_000;
export const MAX_REPLAY_CHECKOUT_MS = 5 * 60_000;
export const MAX_REPLAY_EVENTS = 40_000;
export const MAX_REPLAY_ENTRIES = 50;
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 1500;
export const REPLAY_CONSOLE_EVENT = "threadmark.console";
export const REPLAY_NETWORK_EVENT = "threadmark.network";
export const REPLAY_TIMING_EVENT = "threadmark.timing";
export const REPLAY_SOCKET_EVENT = "threadmark.websocket";
// Page resources (scripts, stylesheets, images, fonts) and WebSocket messages can arrive in bursts; beyond these
// counts per 10 seconds, the rest are only counted.
const MAX_RESOURCES_PER_WINDOW = 150;
const MAX_SOCKET_MESSAGES_PER_WINDOW = 60;
const RATE_WINDOW_MS = 10_000;
const MAX_SOCKET_DATA_CHARS = 4_000;

// rrweb event and source numbers (stable across rrweb 2.x).
export const EVENT_TYPE = Object.freeze({ FullSnapshot: 2, IncrementalSnapshot: 3, Meta: 4, Custom: 5 });
export const INCREMENTAL_SOURCE = Object.freeze({ MouseInteraction: 2, Scroll: 3, ViewportResize: 4, Input: 5 });
export const MOUSE_INTERACTION = Object.freeze({ Click: 2, DblClick: 4, TouchEnd: 9 });

/**
 * `sessionReplay` prop → effective options. Off unless a host opts in. A `provider` replaces the built-in
 * recorder (a browser extension records in the page's own context and hands captures over); it is
 * `{ capture, hold?, release? }` or just a capture function.
 */
export function resolveSessionReplayOptions(value) {
  if (!value) return { enabled: false, bufferMs: DEFAULT_REPLAY_BUFFER_MS, provider: null, network: DEFAULT_NETWORK_OPTIONS, canvas: null };
  const options = typeof value === "object" ? value : {};
  const requested = Number(options.bufferMs);
  const rawProvider = options.provider;
  const provider = typeof rawProvider === "function"
    ? { capture: rawProvider }
    : typeof rawProvider?.capture === "function" ? rawProvider : null;
  return {
    enabled: true,
    bufferMs: Number.isFinite(requested) ? Math.round(Math.min(120_000, Math.max(5_000, requested))) : DEFAULT_REPLAY_BUFFER_MS,
    provider,
    // Request and response bodies stay out unless the host keeps them (`network: { bodies: true }`).
    network: resolveNetworkOptions(options.network),
    // Canvases (charts, maps, 3D) are sampled as images only when the host opts in (`canvas: true`).
    canvas: resolveCanvasOptions(options.canvas),
  };
}

const SECRET_KEY = /^(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|session[_-]?(?:id|token))$/i;

// Text without any of these can't contain anything scrubReplayText replaces: URLs and `name=value` pairs need
// `:` or `=`, emails `@`, style URLs `url(`, JWTs `eyJ`, auth headers a scheme and a space, card numbers 13
// digits, and every key format and long token a run of 12 or more key characters. Most of a page's text has
// none of them, so a full snapshot skips the scrubbing patterns for nearly every node.
const MAY_NEED_SCRUBBING = /[:=@]|url\(|eyJ|\b(?:bearer|basic|token|digest)\s|\d(?:[ -]?\d){12}|[A-Za-z0-9_+/-]{12}/i;

/** Best-effort scrubbing of recognizable credentials; arbitrary unlabelled PII still needs host masking. */
export function scrubReplayText(value) {
  const text = String(value);
  if (!MAY_NEED_SCRUBBING.test(text)) return text;
  return scrubConsoleText(text
    .replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_, quote, url) => `url("${sanitizeReplayUrl(url)}")`));
}

// How each property name's value is sanitized. A snapshot repeats a few dozen names thousands of times.
const keyKinds = new Map();
function keyKind(name) {
  let kind = keyKinds.get(name);
  if (kind === undefined) {
    kind = SECRET_KEY.test(name) ? "secret"
      : /^(?:href|src|action|formaction|poster|xlink:href|background|data)$/i.test(name) ? "url"
        : /^srcset$/i.test(name) ? "srcset"
          : name === "rr_dataURL" ? "image" : "text";
    if (keyKinds.size < 500) keyKinds.set(name, kind);
  }
  return kind;
}

/** Clone recorder events so sanitizing never mutates rrweb's own snapshot/mutation state. */
export function sanitizeReplayEvent(event, base, keepCanvasImage = () => false) {
  const visit = (value, kind = "text") => {
    if (typeof value === "string") {
      if (kind === "url") return sanitizeReplayUrl(value, base);
      if (kind === "srcset") return ""; // Candidates can contain commas/data URLs; fail closed.
      if (kind === "image") {
        const image = sanitizeCanvasDataUrl(value);
        return image && keepCanvasImage(image.length) ? image : "";
      }
      return scrubReplayText(value);
    }
    if (Array.isArray(value)) {
      const copy = new Array(value.length);
      for (let index = 0; index < value.length; index += 1) copy[index] = visit(value[index]);
      return copy;
    }
    if (!value || typeof value !== "object") return value;
    const copy = {};
    for (const name of Object.keys(value)) {
      const kind = keyKind(name);
      const item = kind === "secret" ? "[redacted]" : visit(value[name], kind);
      // A page can name an attribute `__proto__`; keep it as data rather than a prototype.
      if (name === "__proto__") Object.defineProperty(copy, name, { value: item, enumerable: true, writable: true, configurable: true });
      else copy[name] = item;
    }
    return copy;
  };
  return visit(event);
}

function describeValue(value, depth = 0) {
  if (value instanceof Error) return scrubReplayText(`${value.name}: ${value.message}`);
  if (value === null || ["number", "boolean", "undefined", "bigint"].includes(typeof value)) return String(value);
  if (typeof value === "string") return scrubReplayText(value);
  if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return value.toString();
  if (typeof Element !== "undefined" && value instanceof Element) return `<${value.tagName.toLowerCase()}>`;
  if (depth > 1) return Array.isArray(value) ? "[…]" : "{…}";
  try {
    if (Array.isArray(value)) return `[${value.slice(0, 10).map((item) => describeValue(item, depth + 1)).join(", ")}]`;
    const entries = Object.entries(value).slice(0, 10).map(([key, item]) => `${key}: ${SECRET_KEY.test(key) ? "[redacted]" : describeValue(item, depth + 1)}`);
    return `{${entries.join(", ")}}`;
  } catch {
    return "[object]";
  }
}

/** One bounded, scrubbed line per console call; objects are summarized, never serialized in full. */
export function describeConsoleArgs(args) {
  return scrubReplayText(Array.from(args || []).map((value) => describeValue(value)).join(" ")).replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * Rolling rrweb buffer split at checkouts (full snapshots). It keeps the shortest run of segments that
 * still covers `bufferMs`, so any capture starts at a full snapshot and can always be replayed.
 */
export function createReplayBuffer({ bufferMs = DEFAULT_REPLAY_BUFFER_MS, maxEvents = MAX_REPLAY_EVENTS } = {}) {
  let segments = [];
  let heldSince = null;
  let total = 0;

  const trim = (now) => {
    // A hold keeps the lead-up to a review, but never more than MAX_REPLAY_HOLD_MS of history.
    const cutoff = heldSince === null
      ? now - bufferMs
      : Math.max(heldSince - bufferMs, now - MAX_REPLAY_HOLD_MS);
    while (segments.length > 1 && (segments[1].start <= cutoff || total > maxEvents * 2)) {
      total -= segments[0].events.length;
      segments.shift();
    }
  };

  return {
    push(event, isCheckout = false) {
      if (!event || typeof event.timestamp !== "number") return { overflow: false };
      const startsSegment = event.type === EVENT_TYPE.Meta && (isCheckout || !segments.length);
      if (startsSegment) segments.push({ start: event.timestamp, events: [] });
      if (!segments.length) return { overflow: false };
      segments[segments.length - 1].events.push(event);
      total += 1;
      trim(event.timestamp);
      return { overflow: total > maxEvents };
    },
    /** While held, nothing after `now - bufferMs` is trimmed, so a review keeps its lead-up. */
    hold(now = Date.now()) {
      heldSince ??= now;
    },
    release(now = Date.now()) {
      heldSince = null;
      trim(now);
    },
    get held() {
      return heldSince !== null;
    },
    events(now = Date.now()) {
      trim(now);
      return segments.flatMap((segment) => segment.events);
    },
    clear() {
      segments = [];
      total = 0;
    },
  };
}

/** Counts and the most useful entries, for the payload an agent reads without opening the replay. */
export function summarizeReplay(events) {
  const list = Array.isArray(events) ? events : [];
  const first = list.find((event) => event.type === EVENT_TYPE.Meta) || list[0];
  const last = list[list.length - 1];
  const start = first?.timestamp || 0;
  const offset = (event) => Math.max(0, Math.round((event.timestamp || start) - start));
  const consoleEntries = [];
  const networkEntries = [];
  let errors = 0;
  let warnings = 0;
  let requests = 0;
  let failed = 0;
  let clicks = 0;
  let inputs = 0;
  let navigations = 0;
  let viewport = null;
  for (const event of list) {
    if (event.type === EVENT_TYPE.Meta) {
      navigations += 1;
      viewport ??= { width: Math.round(event.data?.width || 0), height: Math.round(event.data?.height || 0) };
    } else if (event.type === EVENT_TYPE.IncrementalSnapshot) {
      if (event.data?.source === INCREMENTAL_SOURCE.MouseInteraction
        && [MOUSE_INTERACTION.Click, MOUSE_INTERACTION.DblClick, MOUSE_INTERACTION.TouchEnd].includes(event.data.type)) clicks += 1;
      if (event.data?.source === INCREMENTAL_SOURCE.Input) inputs += 1;
    } else if (event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_CONSOLE_EVENT) {
      const entry = event.data.payload || {};
      if (entry.level === "error") errors += 1;
      if (entry.level === "warn") warnings += 1;
      if ((entry.level === "error" || entry.level === "warn") && consoleEntries.length < MAX_REPLAY_ENTRIES) {
        // Scrubbed again: a replay provider (the extension) may hand over entries it built itself.
        consoleEntries.push({ offsetMs: offset(event), level: entry.level, message: scrubConsoleText(String(entry.message || "").slice(0, MAX_MESSAGE_LENGTH * 4)).slice(0, MAX_MESSAGE_LENGTH) });
      }
    } else if (event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_NETWORK_EVENT) {
      const entry = event.data.payload || {};
      requests += 1;
      const failure = entry.outcome !== "successful";
      if (failure) failed += 1;
      if (failure && networkEntries.length < MAX_REPLAY_ENTRIES) {
        const operation = entry.graphql?.name ? `${entry.graphql.type || "query"} ${entry.graphql.name}` : null;
        networkEntries.push({
          offsetMs: Number.isFinite(entry.startedAt)
            ? Math.max(0, Math.round(entry.startedAt - start))
            : Math.max(0, offset(event) - Math.round(entry.durationMs || 0)),
          method: entry.method,
          url: entry.url,
          status: entry.status,
          durationMs: entry.durationMs,
          outcome: entry.outcome,
          ...(operation ? { operation } : {}),
          ...(entry.graphql?.errors?.codes?.length ? { errorCodes: entry.graphql.errors.codes } : {}),
        });
      }
    }
  }
  return {
    durationMs: last ? Math.max(0, Math.round(last.timestamp - start)) : 0,
    eventCount: list.length,
    viewport: viewport || { width: 0, height: 0 },
    console: { errors, warnings, entries: consoleEntries },
    network: { requests, failed, entries: networkEntries },
    actions: { clicks, inputs, navigations: Math.max(0, navigations - 1) },
  };
}

/** A request's outcome; a GraphQL response with errors counts as failed even when its status is 200. */
export function networkOutcome(status, failedToSend = false, graphqlFailed = false) {
  if (failedToSend) return "transport_failure";
  if (!status) return "incomplete";
  if (status >= 500) return "server_error";
  if (status >= 400) return "client_error";
  if (graphqlFailed) return "graphql_error";
  return "successful";
}

async function encodeEvents(events) {
  const json = JSON.stringify(events);
  if (typeof CompressionStream === "function") {
    const stream = new Blob([json], { type: "application/json" }).stream().pipeThrough(new CompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    return new Blob([buffer], { type: "application/gzip" });
  }
  return new Blob([json], { type: "application/json" });
}

/** Reads a stored replay (gzip or plain JSON) back into rrweb events. */
export async function decodeReplayEvents(blob) {
  if (!blob) return [];
  const gzip = blob.type === "application/gzip";
  if (gzip && typeof DecompressionStream !== "function") throw new Error("This browser cannot open compressed replays.");
  const text = gzip
    ? await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text()
    : await blob.text();
  const events = JSON.parse(text);
  return Array.isArray(events) ? events : [];
}

/**
 * Patches console and network APIs for the recorder. Returns a restore function. Runs in the page's
 * own JavaScript context so it sees the application's calls.
 */
export function instrumentPage({ windowRef = globalThis.window, onConsole, onNetwork, onTiming = null, onSocket = null, network = DEFAULT_NETWORK_OPTIONS }) {
  // `network` may be a function, so a running recorder picks up changed options (the extension learns a
  // project's settings after the page has started).
  const getNetworkOptions = () => resolveNetworkOptions(typeof network === "function" ? network() : network);
  const restores = [];
  const consoleRef = windowRef.console;
  for (const level of ["error", "warn", "log", "info", "debug"]) {
    const original = consoleRef?.[level];
    if (typeof original !== "function") continue;
    consoleRef[level] = function threadmarkConsole(...args) {
      try {
        const error = args.find((value) => value instanceof Error);
        onConsole({ level, message: describeConsoleArgs(args), stack: error?.stack ? scrubReplayText(error.stack).slice(0, MAX_STACK_LENGTH) : undefined });
      } catch {
        // Recording must never break the page's own logging.
      }
      return original.apply(this, args);
    };
    restores.push(() => { consoleRef[level] = original; });
  }

  const onError = (event) => {
    try {
      onConsole({
        level: "error",
        message: describeConsoleArgs([event.error || event.message || "Uncaught error"]),
        stack: event.error?.stack ? scrubReplayText(event.error.stack).slice(0, MAX_STACK_LENGTH) : undefined,
        source: event.filename ? `${sanitizeReplayUrl(event.filename)}:${event.lineno || 0}:${event.colno || 0}` : undefined,
      });
    } catch { /* ignore */ }
  };
  const onRejection = (event) => {
    try {
      const reason = event.reason;
      onConsole({
        level: "error",
        message: `Unhandled rejection: ${describeConsoleArgs([reason])}`.slice(0, MAX_MESSAGE_LENGTH),
        stack: reason?.stack ? scrubReplayText(reason.stack).slice(0, MAX_STACK_LENGTH) : undefined,
      });
    } catch { /* ignore */ }
  };
  windowRef.addEventListener("error", onError);
  windowRef.addEventListener("unhandledrejection", onRejection);
  restores.push(() => {
    windowRef.removeEventListener("error", onError);
    windowRef.removeEventListener("unhandledrejection", onRejection);
  });

  const now = () => windowRef.performance?.now?.() ?? Date.now();
  const budget = createBodyBudget();
  // What a finished request becomes: always its outcome and timing, its GraphQL operation and error codes,
  // and (only when the host keeps bodies) its filtered bodies and allowlisted headers.
  const report = (request, { status, failed, durationMs, responseText, responseType, responseHeaders }) => {
    const options = getNetworkOptions();
    const graphql = graphqlOperation(request.method, request.rawUrl, typeof request.body === "string" ? request.body : undefined);
    const errors = graphql && typeof responseText === "string" ? graphqlErrors(responseText) : null;
    const entry = {
      type: request.type,
      method: request.method,
      url: request.url,
      status,
      durationMs,
      startedAt: request.startedAt,
      outcome: networkOutcome(status, failed, Boolean(errors)),
    };
    if (graphql) entry.graphql = { ...graphql, ...(errors ? { errors: { count: errors.count, codes: errors.codes } } : {}) };
    if (options.bodies) {
      if (isCredentialEndpoint(request.rawUrl)) {
        entry.bodies = "credential endpoint";
      } else {
        const kept = applySanitizer(options.sanitize, {
          method: entry.method,
          url: entry.url,
          status,
          request: { headers: pickHeaders(request.headers, "request"), body: cleanBody(request.body, request.contentType) },
          response: { headers: pickHeaders(responseHeaders, "response"), body: responseText == null ? null : cleanBody(responseText, responseType) },
        });
        if (!kept) entry.bodies = "removed by the site";
        else if (!budget.take((kept.request.body?.length || 0) + (kept.response.body?.length || 0))) entry.bodies = "over the memory budget";
        else {
          entry.request = kept.request;
          entry.response = kept.response;
          if (errors?.messages.length) entry.graphql.errors.messages = errors.messages;
        }
      }
    }
    onNetwork(entry);
  };
  // Response text is read only when it can matter (a GraphQL request, or a host that keeps bodies), only for
  // text-like responses of a reasonable size, and never for streams.
  const wantsResponse = (request) => getNetworkOptions().bodies
    || Boolean(graphqlOperation(request.method, request.rawUrl, typeof request.body === "string" ? request.body : undefined));
  const readable = (type, length) => (!type || /json|text\/|graphql|xml|javascript/i.test(type))
    && !/event-stream/i.test(type) && !(Number(length) > 512 * 1024);

  const originalFetch = windowRef.fetch;
  if (typeof originalFetch === "function") {
    windowRef.fetch = function threadmarkFetch(input, init) {
      const started = now();
      let request = null;
      try {
        const rawUrl = String(typeof input === "string" || input instanceof URL ? input : input?.url || "");
        const headers = init?.headers || input?.headers;
        request = {
          type: "fetch",
          method: String(init?.method || input?.method || "GET").toUpperCase().slice(0, 10),
          rawUrl,
          url: sanitizeReplayUrl(rawUrl),
          body: init?.body,
          headers,
          contentType: pickHeaders(headers, "request")["content-type"] || "",
          startedAt: Date.now(),
        };
      } catch {
        request = null;
      }
      return originalFetch.apply(this, arguments).then((response) => {
        if (!request) return response;
        const durationMs = Math.round(now() - started);
        try {
          const type = response.headers?.get?.("content-type") || "";
          let text = Promise.resolve(null);
          if (response.type !== "opaque" && wantsResponse(request) && readable(type, response.headers?.get?.("content-length"))) {
            // The clone is taken before the page reads its copy; reading it never delays the page.
            const copy = response.clone();
            text = Promise.race([copy.text(), new Promise((resolve) => setTimeout(() => resolve(null), 3000))]).catch(() => null);
          }
          text.then((responseText) => {
            try {
              report(request, { status: response.status, failed: false, durationMs, responseText, responseType: type, responseHeaders: response.headers });
            } catch { /* ignore */ }
          });
        } catch { /* ignore */ }
        return response;
      }, (error) => {
        try {
          if (request) report(request, { status: 0, failed: error?.name !== "AbortError", durationMs: Math.round(now() - started) });
        } catch { /* ignore */ }
        throw error;
      });
    };
    restores.push(() => { windowRef.fetch = originalFetch; });
  }

  const XHR = windowRef.XMLHttpRequest;
  if (typeof XHR === "function") {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    const setRequestHeader = XHR.prototype.setRequestHeader;
    XHR.prototype.open = function threadmarkOpen(method, url, ...rest) {
      try {
        this.__threadmarkRequest = { type: "xhr", method: String(method || "GET").toUpperCase().slice(0, 10), rawUrl: String(url), url: sanitizeReplayUrl(url), headers: [] };
      } catch {
        this.__threadmarkRequest = null;
      }
      return open.call(this, method, url, ...rest);
    };
    XHR.prototype.setRequestHeader = function threadmarkSetRequestHeader(name, value) {
      try {
        this.__threadmarkRequest?.headers.push([name, value]);
      } catch { /* ignore */ }
      return setRequestHeader.call(this, name, value);
    };
    XHR.prototype.send = function threadmarkSend(...args) {
      const request = this.__threadmarkRequest;
      if (request) {
        const started = now();
        request.startedAt = Date.now();
        request.body = args[0];
        request.contentType = pickHeaders(request.headers, "request")["content-type"] || "";
        const finish = (failed) => {
          try {
            let responseText = null;
            const type = this.getResponseHeader?.("content-type") || "";
            if (!failed && wantsResponse(request) && readable(type, this.getResponseHeader?.("content-length"))) {
              if (this.responseType === "" || this.responseType === "text") responseText = this.responseText;
              else if (this.responseType === "json" && this.response != null) responseText = JSON.stringify(this.response);
            }
            report(request, {
              status: this.status || 0,
              failed,
              durationMs: Math.round(now() - started),
              responseText,
              responseType: type,
              responseHeaders: failed ? null : this.getAllResponseHeaders?.(),
            });
          } catch { /* ignore */ }
        };
        this.addEventListener("load", () => finish(false), { once: true });
        this.addEventListener("error", () => finish(true), { once: true });
        this.addEventListener("timeout", () => finish(true), { once: true });
      }
      return send.apply(this, args);
    };
    restores.push(() => {
      XHR.prototype.open = open;
      XHR.prototype.send = send;
      XHR.prototype.setRequestHeader = setRequestHeader;
    });
  }

  // Timing phases arrive separately, from the browser's own resource timing, which also lists the page's own
  // resources (scripts, stylesheets, images, fonts, media, frames).
  let observer = null;
  if (onTiming && typeof windowRef.PerformanceObserver === "function") {
    const resources = rateLimit(MAX_RESOURCES_PER_WINDOW);
    try {
      observer = new windowRef.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          try {
            const timing = timingPhases(entry, windowRef.performance?.timeOrigin);
            if (timing) {
              onTiming({ url: sanitizeReplayUrl(entry.name), ...timing });
              continue;
            }
            const resource = resourceTiming(entry, windowRef.performance?.timeOrigin);
            const url = resource && sanitizeReplayUrl(entry.name);
            if (url && /^https?:/.test(url) && resources.take()) onTiming({ url, ...resource });
          } catch { /* ignore */ }
        }
      });
      observer.observe({ type: "resource" });
    } catch {
      observer = null;
    }
  }
  restores.push(() => observer?.disconnect());

  const NativeWebSocket = windowRef.WebSocket;
  if (onSocket && typeof NativeWebSocket === "function") restores.push(watchWebSockets(windowRef, NativeWebSocket, onSocket, getNetworkOptions, budget));

  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/** `take()` is true for at most `limit` calls in each 10-second window. */
function rateLimit(limit, now = () => Date.now()) {
  let windowStart = 0;
  let used = 0;
  return {
    take() {
      const time = now();
      if (time - windowStart >= RATE_WINDOW_MS) {
        windowStart = time;
        used = 0;
      }
      used += 1;
      return used <= limit;
    },
  };
}

function frameSize(data) {
  if (typeof data === "string") return data.length;
  const size = Number(data?.size ?? data?.byteLength);
  return Number.isFinite(size) ? size : 0;
}

/**
 * Records the page's WebSocket connections: when each opens and closes (with its close code) and each
 * message's direction and size. Message text is kept only when the host keeps bodies, filtered like a request
 * body; binary frames are only measured. The constructor keeps its prototype, so `instanceof` and the
 * static constants behave as before.
 */
function watchWebSockets(windowRef, NativeWebSocket, onSocket, getNetworkOptions, budget) {
  const watched = new WeakMap();
  const messages = rateLimit(MAX_SOCKET_MESSAGES_PER_WINDOW);
  let nextId = 0;
  let skipped = 0;
  const message = (state, direction, data) => {
    if (!messages.take()) {
      skipped += 1;
      return;
    }
    const entry = { socket: state.id, event: "message", direction, size: frameSize(data) };
    if (skipped) {
      entry.skipped = skipped;
      skipped = 0;
    }
    const options = getNetworkOptions();
    if (options.bodies && !state.credential) {
      const kept = typeof data === "string" ? cleanBody(data.slice(0, 512 * 1024), "") : cleanBody(data, "");
      if (kept && budget.take(Math.min(kept.length, MAX_SOCKET_DATA_CHARS))) entry.data = kept.slice(0, MAX_SOCKET_DATA_CHARS);
    }
    onSocket(entry);
  };
  function ThreadmarkWebSocket(url, protocols) {
    const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    try {
      const state = { id: `ws${(nextId += 1)}`, credential: isCredentialEndpoint(String(url)) };
      watched.set(socket, state);
      onSocket({ socket: state.id, event: "connecting", url: sanitizeReplayUrl(url) });
      socket.addEventListener("open", () => {
        try { onSocket({ socket: state.id, event: "open", protocol: String(socket.protocol || "").slice(0, 40) }); } catch { /* ignore */ }
      });
      socket.addEventListener("message", (event) => {
        try { message(state, "received", event.data); } catch { /* ignore */ }
      });
      socket.addEventListener("error", () => {
        try { onSocket({ socket: state.id, event: "error" }); } catch { /* ignore */ }
      });
      socket.addEventListener("close", (event) => {
        try { onSocket({ socket: state.id, event: "close", code: Number(event.code) || 0, clean: Boolean(event.wasClean) }); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
    return socket;
  }
  ThreadmarkWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(ThreadmarkWebSocket, NativeWebSocket);
  const send = NativeWebSocket.prototype.send;
  NativeWebSocket.prototype.send = function threadmarkSocketSend(data) {
    try {
      const state = watched.get(this);
      if (state && this.readyState === 1) message(state, "sent", data);
    } catch { /* ignore */ }
    return send.apply(this, arguments);
  };
  windowRef.WebSocket = ThreadmarkWebSocket;
  return () => {
    NativeWebSocket.prototype.send = send;
    if (windowRef.WebSocket === ThreadmarkWebSocket) windowRef.WebSocket = NativeWebSocket;
  };
}

/**
 * Starts recording. `blockSelectors` are removed from the replay entirely (Threadmark's own overlay is
 * always blocked); every input value is masked.
 */
export async function startSessionReplay({
  windowRef = globalThis.window,
  bufferMs = DEFAULT_REPLAY_BUFFER_MS,
  blockSelectors = [],
  maskTextSelectors = [],
  network = DEFAULT_NETWORK_OPTIONS,
  canvas = null,
  onError,
  loadRecorder = () => import("rrweb").then((module) => module.record),
} = {}) {
  const record = await loadRecorder();
  const buffer = createReplayBuffer({ bufferMs });
  const canvasOptions = resolveCanvasOptions(canvas);
  const canvasBudget = canvasOptions ? createCanvasBudget({ bufferMs, maxHoldMs: MAX_REPLAY_HOLD_MS }) : null;
  let stopRecording = null;
  let stopped = false;
  let networkOptions = resolveNetworkOptions(network);
  const pending = [];
  const addCustom = (tag, payload) => {
    if (stopped) return;
    if (stopRecording && typeof record.addCustomEvent === "function") record.addCustomEvent(tag, payload);
    else if (pending.length < 200) pending.push([tag, payload]);
  };
  const restore = instrumentPage({
    windowRef,
    onConsole: (entry) => addCustom(REPLAY_CONSOLE_EVENT, entry),
    onNetwork: (entry) => addCustom(REPLAY_NETWORK_EVENT, entry),
    onTiming: (entry) => addCustom(REPLAY_TIMING_EVENT, entry),
    onSocket: (entry) => addCustom(REPLAY_SOCKET_EVENT, entry),
    network: () => networkOptions,
  });

  const documentRef = windowRef.document;
  let snapshotInProgress = false;
  // Checkouts (fresh full snapshots that let older history go) run on this timer rather than rrweb's: a full
  // snapshot of a large page blocks the main thread, so it waits for an idle moment, comes at most once per
  // buffer length, later still when snapshots of this page are slow (they then take at most ~2% of the
  // time), and skips while a video holds the buffer (which keeps everything anyway).
  const checkoutMs = Math.max(REPLAY_CHECKOUT_MS, bufferMs);
  const timers = typeof windowRef.setTimeout === "function" ? windowRef : globalThis;
  let nextCheckoutMs = checkoutMs;
  let checkoutTimer = null;
  let idleCheckout = null;
  const snapshotTook = (startedAt) => {
    nextCheckoutMs = Math.min(MAX_REPLAY_CHECKOUT_MS, Math.max(checkoutMs, (Date.now() - startedAt) * 50));
  };
  const checkout = () => {
    idleCheckout = null;
    if (stopped) return;
    if (!buffer.held && !snapshotInProgress) {
      const startedAt = Date.now();
      snapshotInProgress = true;
      try { record.takeFullSnapshot?.(true); } catch { /* the next checkout tries again */ } finally { snapshotInProgress = false; }
      snapshotTook(startedAt);
    }
    scheduleCheckout();
  };
  const scheduleCheckout = () => {
    checkoutTimer = timers.setTimeout(() => {
      checkoutTimer = null;
      if (typeof windowRef.requestIdleCallback === "function") idleCheckout = windowRef.requestIdleCallback(checkout, { timeout: 2_000 });
      else checkout();
    }, nextCheckoutMs);
    checkoutTimer?.unref?.();
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    documentRef.removeEventListener("DOMContentLoaded", beginWhenReady);
    timers.clearTimeout(checkoutTimer);
    if (idleCheckout !== null) windowRef.cancelIdleCallback?.(idleCheckout);
    try { stopRecording?.(); } finally { restore(); buffer.clear(); }
  };
  const begin = () => {
    if (stopped || stopRecording) return;
    try {
      const startedAt = Date.now();
      stopRecording = record({
        emit(event, isCheckout) {
          if (stopped) return;
          let kept;
          if (isCanvasFrameEvent(event)) {
            // Frames are images: they skip text scrubbing, keep only their known shape, and share a byte budget.
            kept = canvasOptions ? sanitizeCanvasFrame(event) : null;
            if (!kept || !canvasBudget.take(kept.timestamp, canvasFrameBytes(kept))) return;
          } else {
            kept = sanitizeReplayEvent(event, windowRef.location?.href,
              (bytes) => canvasBudget?.take(event.timestamp, bytes));
          }
          const { overflow } = buffer.push(kept, isCheckout);
          if (overflow && !snapshotInProgress) {
            // Start a fresh replayable segment before requesting a synchronous rrweb checkout.
            // Otherwise its Meta event is still over budget and recursively requests another snapshot.
            buffer.clear();
            snapshotInProgress = true;
            try { record.takeFullSnapshot?.(true); } finally { snapshotInProgress = false; }
          }
        },
        maskAllInputs: true,
        maskInputOptions: { password: true, email: true, tel: true, text: true, textarea: true, number: true, search: true, select: true },
        // Regions a site marked private for another session tool stay out of this one too.
        blockSelector: [
          "[data-threadmark-root]", "[data-threadmark-sensitive]", "[data-threadmark-ignore]", ...OTHER_TOOLS_BLOCK_SELECTORS, ...blockSelectors,
          // A canvas's pixels can't have their text masked, so canvases in masked regions are left out.
          ...(canvasOptions ? canvasBlockSelectors([...OTHER_TOOLS_MASK_SELECTORS, ...maskTextSelectors]) : []),
        ].join(","),
        maskTextSelector: ["[data-threadmark-sensitive]", ...OTHER_TOOLS_MASK_SELECTORS, ...maskTextSelectors].join(",") || null,
        recordCanvas: Boolean(canvasOptions),
        ...(canvasOptions ? { dataURLOptions: { type: "image/webp", quality: canvasOptions.quality } } : {}),
        collectFonts: false,
        inlineImages: false,
        recordCrossOriginIframes: false,
        slimDOMOptions: "all",
        sampling: { mousemove: 50, scroll: 150, media: 800, input: "last", ...(canvasOptions ? { canvas: canvasOptions.fps } : {}) },
      }) || null;
      if (!stopRecording) throw new Error("Session replay recorder did not start.");
      snapshotTook(startedAt); // rrweb takes the first full snapshot as it starts.
      for (const [tag, payload] of pending.splice(0)) record.addCustomEvent?.(tag, payload);
      scheduleCheckout();
    } catch (error) {
      stop();
      throw error;
    }
  };
  const beginWhenReady = () => {
    try { begin(); } catch (error) { onError?.(error); }
  };
  if (documentRef.readyState === "loading") documentRef.addEventListener("DOMContentLoaded", beginWhenReady, { once: true });
  else begin();

  return {
    hold: () => {
      buffer.hold(Date.now());
      canvasBudget?.hold(Date.now());
    },
    release: () => {
      buffer.release(Date.now());
      canvasBudget?.release();
    },
    /** Changes what is kept from requests from now on (`{ network: { bodies, sanitize } }`). */
    configure({ network: next } = {}) {
      networkOptions = resolveNetworkOptions(next);
    },
    /** The buffered replay, or null when nothing replayable was recorded yet. */
    async capture() {
      const events = buffer.events(Date.now());
      if (!events.some((event) => event.type === EVENT_TYPE.FullSnapshot)) return null;
      const summary = summarizeReplay(events);
      const blob = await encodeEvents(events);
      return { blob, summary, startedAt: new Date(events[0].timestamp).toISOString() };
    },
    stop,
  };
}
