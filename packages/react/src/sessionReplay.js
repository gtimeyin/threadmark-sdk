// Always-on session replay: an in-memory rolling rrweb recording of the page, plus console and network
// activity, kept in the reviewer's browser. Nothing leaves the page until a reviewer posts feedback
// with the replay attached. Inputs are masked, sensitive and ignored regions are blocked, and request
// bodies, headers, query values, and credentials are never recorded. Console text is scrubbed before it
// is buffered: credentials, key-looking strings, emails, and URL query values are replaced.

export const DEFAULT_REPLAY_BUFFER_MS = 30_000;
export const MAX_REPLAY_HOLD_MS = 3 * 60_000;
export const REPLAY_CHECKOUT_MS = 10_000;
export const MAX_REPLAY_EVENTS = 40_000;
export const MAX_REPLAY_ENTRIES = 50;
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 1500;
const MAX_URL_LENGTH = 300;
export const REPLAY_CONSOLE_EVENT = "threadmark.console";
export const REPLAY_NETWORK_EVENT = "threadmark.network";

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
  if (!value) return { enabled: false, bufferMs: DEFAULT_REPLAY_BUFFER_MS, provider: null };
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
  };
}

/** Keeps origin and path; drops credentials, fragments, and every query value. */
export function sanitizeReplayUrl(raw, base = globalThis.location?.href || "https://threadmark.invalid/") {
  try {
    const url = new URL(String(raw), base);
    if (!/^https?:$/.test(url.protocol)) return url.protocol.replace(":", "") + ":";
    const keys = [...new Set([...url.searchParams.keys()])].slice(0, 10);
    const query = keys.length ? `?${keys.map((key) => `${encodeURIComponent(key)}=…`).join("&")}` : "";
    return `${url.origin}${url.pathname}${query}`.slice(0, MAX_URL_LENGTH);
  } catch {
    return "";
  }
}

const SECRET_KEY = /^(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|session[_-]?(?:id|token))$/i;

/** Best-effort scrubbing of recognizable credentials; arbitrary unlabelled PII still needs host masking. */
export function scrubReplayText(value) {
  return scrubConsoleText(String(value)
    .replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_, quote, url) => `url("${sanitizeReplayUrl(url)}")`));
}

/** Clone recorder events so sanitizing never mutates rrweb's own snapshot/mutation state. */
export function sanitizeReplayEvent(event, base) {
  const visit = (value, key = "") => {
    if (typeof value === "string") {
      if (/^(?:href|src|action|formaction|poster|xlink:href|background|data)$/i.test(key)) return sanitizeReplayUrl(value, base);
      if (/^srcset$/i.test(key)) return ""; // Candidates can contain commas/data URLs; fail closed.
      return scrubReplayText(value);
    }
    if (Array.isArray(value)) return value.map((item) => visit(item));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, SECRET_KEY.test(name) ? "[redacted]" : visit(item, name)]));
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

const REDACTED = "[redacted]";
// Well-known credential shapes: OpenAI/Stripe/Anthropic-style keys, Supabase, Slack, GitHub, GitLab, npm,
// AWS, Google, Resend, and Threadmark's own agent tokens.
const KEY_PATTERNS = [
  /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant|svcacct)?[-_]?[A-Za-z0-9_-]{12,}/g,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{8,}/g,
  /\bxapp-[A-Za-z0-9-]{8,}/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\bnpm_[A-Za-z0-9]{20,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bre_[A-Za-z0-9_]{16,}/g,
  /\btmk_[A-Za-z0-9_-]{10,}/g,
];
const SECRET_NAMES = "password|passwd|pwd|secret|client[_-]?secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|apikey|auth|authorization|session(?:[_-]?id)?|cookie|set-cookie|signature|otp";
const NAMED_SECRET = new RegExp(`(["']?\\b(?:${SECRET_NAMES})\\b["']?\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;&}\\]]+)`, "gi");
// Values that say nothing secret (`token: null`, `auth: true`) and auth schemes handled above stay.
const HARMLESS_VALUE = /^(?:\[redacted\]|…|true|false|null|undefined|\d{1,6}|Bearer|Basic|Token|Digest)$/i;

function looksSecret(run) {
  return /[0-9]/.test(run) && /[a-z]/.test(run) && /[A-Z]/.test(run);
}

/**
 * Console text as it may be stored: URLs keep their origin, path, and query names; credentials, key-looking
 * strings, JWTs, emails, and long hex or base64 runs are replaced.
 */
export function scrubConsoleText(text, base = globalThis.location?.href || "https://threadmark.invalid/") {
  let value = String(text ?? "");
  value = value.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>()[\]{}`]+/gi, (url) => {
    if (!/^https?:/i.test(url)) return url.replace(/[?#].*$/, "");
    return sanitizeReplayUrl(url, base) || REDACTED;
  });
  value = value.replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*/g, "[redacted JWT]");
  value = value.replace(/\b(Bearer|Basic|Token|Digest)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`);
  for (const pattern of KEY_PATTERNS) value = value.replace(pattern, REDACTED);
  value = value.replace(NAMED_SECRET, (match, name, secret) => (HARMLESS_VALUE.test(secret) ? match : `${name}${REDACTED}`));
  value = value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, "[email]");
  value = value.replace(/\b[0-9a-f]{32,}\b/gi, REDACTED);
  value = value.replace(/[A-Za-z0-9_-]{32,}/g, (run) => (looksSecret(run) ? REDACTED : run));
  value = value.replace(/[A-Za-z0-9+/]{40,}={0,2}/g, (run) => (looksSecret(run) ? REDACTED : run));
  return value;
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
        networkEntries.push({
          offsetMs: Math.max(0, offset(event) - Math.round(entry.durationMs || 0)),
          method: entry.method,
          url: entry.url,
          status: entry.status,
          durationMs: entry.durationMs,
          outcome: entry.outcome,
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

export function networkOutcome(status, failedToSend = false) {
  if (failedToSend) return "transport_failure";
  if (!status) return "incomplete";
  if (status >= 500) return "server_error";
  if (status >= 400) return "client_error";
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
export function instrumentPage({ windowRef = globalThis.window, onConsole, onNetwork }) {
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
  const originalFetch = windowRef.fetch;
  if (typeof originalFetch === "function") {
    windowRef.fetch = function threadmarkFetch(input, init) {
      const started = now();
      const method = String(init?.method || input?.method || "GET").toUpperCase().slice(0, 10);
      const url = sanitizeReplayUrl(typeof input === "string" || input instanceof URL ? input : input?.url);
      return originalFetch.apply(this, arguments).then((response) => {
        try {
          onNetwork({ method, url, status: response.status, durationMs: Math.round(now() - started), outcome: networkOutcome(response.status) });
        } catch { /* ignore */ }
        return response;
      }, (error) => {
        try {
          onNetwork({ method, url, status: 0, durationMs: Math.round(now() - started), outcome: networkOutcome(0, error?.name !== "AbortError") });
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
    XHR.prototype.open = function threadmarkOpen(method, url, ...rest) {
      this.__threadmarkRequest = { method: String(method || "GET").toUpperCase().slice(0, 10), url: sanitizeReplayUrl(url) };
      return open.call(this, method, url, ...rest);
    };
    XHR.prototype.send = function threadmarkSend(...args) {
      const request = this.__threadmarkRequest;
      if (request) {
        const started = now();
        const finish = (failed) => {
          try {
            onNetwork({ ...request, status: this.status || 0, durationMs: Math.round(now() - started), outcome: networkOutcome(this.status || 0, failed) });
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
    });
  }

  return () => {
    for (const restore of restores.reverse()) restore();
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
  onError,
  loadRecorder = () => import("rrweb").then((module) => module.record),
} = {}) {
  const record = await loadRecorder();
  const buffer = createReplayBuffer({ bufferMs });
  let stopRecording = null;
  let stopped = false;
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
  });

  const documentRef = windowRef.document;
  let snapshotInProgress = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    documentRef.removeEventListener("DOMContentLoaded", beginWhenReady);
    try { stopRecording?.(); } finally { restore(); buffer.clear(); }
  };
  const begin = () => {
    if (stopped || stopRecording) return;
    try {
      stopRecording = record({
        emit(event, isCheckout) {
          if (stopped) return;
          const { overflow } = buffer.push(sanitizeReplayEvent(event, windowRef.location?.href), isCheckout);
          if (overflow && !snapshotInProgress) {
            // Start a fresh replayable segment before requesting a synchronous rrweb checkout.
            // Otherwise its Meta event is still over budget and recursively requests another snapshot.
            buffer.clear();
            snapshotInProgress = true;
            try { record.takeFullSnapshot?.(true); } finally { snapshotInProgress = false; }
          }
        },
        checkoutEveryNms: REPLAY_CHECKOUT_MS,
        maskAllInputs: true,
        maskInputOptions: { password: true, email: true, tel: true, text: true, textarea: true, number: true, search: true, select: true },
        blockSelector: ["[data-threadmark-root]", "[data-threadmark-sensitive]", "[data-threadmark-ignore]", ...blockSelectors].join(","),
        maskTextSelector: ["[data-threadmark-sensitive]", ...maskTextSelectors].join(",") || null,
        recordCanvas: false,
        collectFonts: false,
        inlineImages: false,
        recordCrossOriginIframes: false,
        slimDOMOptions: "all",
        sampling: { mousemove: 50, scroll: 150, media: 800, input: "last" },
      }) || null;
      if (!stopRecording) throw new Error("Session replay recorder did not start.");
      for (const [tag, payload] of pending.splice(0)) record.addCustomEvent?.(tag, payload);
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
    hold: () => buffer.hold(Date.now()),
    release: () => buffer.release(Date.now()),
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
