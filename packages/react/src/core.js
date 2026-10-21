import { normalizeCaptureEnvironment } from "./captureEnvironment.js";
import {
  MAX_REPLAY_ENTRIES,
  sanitizeReplayUrl,
} from "./sessionReplay.js";
import {
  MAX_POINTER_SAMPLES,
  MAX_SCROLL_SAMPLES,
  MAX_VIDEO_DURATION_MS,
  MAX_VIDEO_EVENTS,
  RECORDING_MIME_TYPES,
} from "./videoRecording.js";

export { THREADMARK_TARGET_ATTRIBUTE, isValidThreadmarkTargetId, threadmarkTarget } from "./targetId.js";

export const DEFAULT_ALLOWED_HOSTS = Object.freeze([
  "localhost",
  "*.localhost",
  "127.0.0.1",
  "::1",
]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const REVIEW_ENVIRONMENTS = new Set(["local", "development", "preview", "staging"]);
const CAPTURE_KINDS = new Set(["text", "element", "multi", "region", "screenshot", "interaction", "video"]);
const INTERACTION_EVENT_TYPES = new Set(["click", "input", "keydown", "scroll", "submit", "navigation"]);
const INTERACTION_KEYS = new Set([
  "Enter",
  "Escape",
  "Tab",
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
const INTERACTION_INPUT_TYPES = new Set([
  "text", "search", "email", "tel", "url", "number", "range", "date", "datetime-local",
  "month", "week", "time", "color", "checkbox", "radio", "select", "file", "password",
]);
const EVIDENCE_QUALITIES = new Set(["captured", "degraded", "unavailable"]);
const EVIDENCE_MIME_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
const RECORDING_EVIDENCE_MIME_TYPES = new Set(RECORDING_MIME_TYPES);
const REPLAY_MIME_TYPES = new Set(["application/gzip", "application/json"]);
const REPLAY_OUTCOMES = new Set(["successful", "client_error", "server_error", "transport_failure", "incomplete"]);
const MAX_REPLAY_DURATION_MS = 5 * 60_000;
const VIDEO_MODES = new Set(["tab", "voice"]);

function normalizeHostname(hostname = "") {
  return String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

export function isLocalHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith(".localhost");
}

export function matchesAllowedHost(hostname, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  const normalizedHost = normalizeHostname(hostname);
  if (!normalizedHost || !Array.isArray(allowedHosts)) return false;

  return allowedHosts.some((rawPattern) => {
    const pattern = normalizeHostname(rawPattern);
    if (!pattern) return false;
    if (!pattern.includes("*")) return normalizedHost === pattern;
    if (!pattern.startsWith("*.") || pattern.slice(2).includes("*")) return false;

    const suffix = pattern.slice(2);
    return normalizedHost !== suffix && normalizedHost.endsWith(`.${suffix}`);
  });
}

export function isThreadmarkEnabled({
  enabled,
  environment,
  hostname,
  allowedHosts = DEFAULT_ALLOWED_HOSTS,
} = {}) {
  if (enabled === false) return false;

  const normalizedEnvironment = String(
    environment || (isLocalHostname(hostname) ? "local" : "production"),
  ).trim().toLowerCase();

  // Only known review environments activate. A future origin-bound server grant can
  // add environments without turning arbitrary client labels into a safety bypass.
  if (!REVIEW_ENVIRONMENTS.has(normalizedEnvironment)) return false;

  if (enabled !== true) {
    return isLocalHostname(hostname);
  }

  return matchesAllowedHost(hostname, allowedHosts);
}

function clean(value) {
  return String(value || "").trim();
}

function cleanComment(value) {
  if (typeof value !== "string") {
    throw new TypeError("Threadmark feedback comment must be a string.");
  }
  return value.trim().slice(0, 6000);
}

export function sanitizeRoute(value) {
  const rawRoute = clean(value) || "/";

  try {
    return new URL(rawRoute, "https://threadmark.invalid").pathname || "/";
  } catch {
    return "/";
  }
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanAvatarUrl(value) {
  const avatarUrl = cleanString(value, 2048);
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("/") && !avatarUrl.startsWith("//")) return avatarUrl;

  try {
    const parsed = new URL(avatarUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? avatarUrl : null;
  } catch {
    return null;
  }
}

function normalizeReply(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanString(value.id, 160);
  if (!id || typeof value.comment !== "string") return null;
  const comment = cleanComment(value.comment);
  if (!comment) return null;
  const createdAt = cleanString(value.createdAt, 48) || new Date().toISOString();

  return {
    id,
    parentId: cleanString(value.parentId, 160) || null,
    comment,
    createdAt,
    updatedAt: cleanString(value.updatedAt, 48) || createdAt,
    author: normalizeReviewer(value.author),
    lastEditedBy: normalizeReviewer(value.lastEditedBy),
  };
}

export function normalizeReviewer(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanString(value.id, 160);
  const displayName = cleanString(value.displayName, 120);
  if (!id || !displayName) return null;

  return {
    id,
    displayName,
    avatarUrl: cleanAvatarUrl(value.avatarUrl),
  };
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function cleanBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return undefined;
  return {
    x: cleanNumber(bounds.x),
    y: cleanNumber(bounds.y),
    width: Math.max(0, cleanNumber(bounds.width)),
    height: Math.max(0, cleanNumber(bounds.height)),
  };
}

function normalizeTarget(target, fallbackRoute) {
  if (!target || typeof target !== "object") return null;
  const normalized = {};
  if (["region", "text", "screenshot"].includes(target.kind)) normalized.kind = target.kind;

  for (const [key, maxLength] of Object.entries({
    tagName: 40,
    role: 80,
    accessibleName: 160,
    visibleText: 240,
    selectedText: 1000,
    capturedAt: 48,
  })) {
    if (typeof target[key] === "string") normalized[key] = cleanString(target[key], maxLength);
  }

  for (const key of ["bounds", "viewportBounds", "pageBounds", "normalizedBounds"]) {
    const bounds = cleanBounds(target[key]);
    if (bounds) normalized[key] = bounds;
  }

  if (target.viewport && typeof target.viewport === "object") {
    normalized.viewport = {
      width: Math.max(0, cleanNumber(target.viewport.width)),
      height: Math.max(0, cleanNumber(target.viewport.height)),
      scrollX: cleanNumber(target.viewport.scrollX),
      scrollY: cleanNumber(target.viewport.scrollY),
      devicePixelRatio: Math.max(0, cleanNumber(target.viewport.devicePixelRatio)),
      visualScale: Math.max(0, cleanNumber(target.viewport.visualScale)),
    };
  }

  if (target.locatorCandidates && typeof target.locatorCandidates === "object") {
    normalized.locatorCandidates = {
      stableId: cleanString(target.locatorCandidates.stableId, 120) || null,
      id: null,
      domPath: cleanString(target.locatorCandidates.domPath, 600),
    };
  }

  normalized.route = sanitizeRoute(target.route || fallbackRoute);
  return normalized;
}

// A recorded video or voice clip. Byte size and container type must match the Blob sidecar exactly.
function normalizeRecordingEvidence(item, id) {
  const mimeType = RECORDING_EVIDENCE_MIME_TYPES.has(item.mimeType) ? item.mimeType : null;
  const byteSize = Math.max(0, Math.round(cleanNumber(item.byteSize)));
  const hasMedia = Boolean(mimeType && byteSize > 0);
  const pixelSize = {
    width: Math.max(0, Math.round(cleanNumber(item.pixelSize?.width))),
    height: Math.max(0, Math.round(cleanNumber(item.pixelSize?.height))),
  };
  return {
    id,
    kind: "recording",
    source: "media-recorder",
    quality: hasMedia ? "captured" : "unavailable",
    mimeType: hasMedia ? mimeType : null,
    byteSize: hasMedia ? byteSize : 0,
    durationMs: Math.max(0, Math.min(MAX_VIDEO_DURATION_MS, Math.round(cleanNumber(item.durationMs)))),
    pixelSize: hasMedia ? pixelSize : { width: 0, height: 0 },
    hasAudio: Boolean(item.hasAudio),
    hasVideo: Boolean(item.hasVideo) && Boolean(mimeType?.startsWith("video/")),
  };
}

// An rrweb session replay stored as gzip (or plain) JSON.
function normalizeReplayEvidence(item, id) {
  const mimeType = REPLAY_MIME_TYPES.has(item.mimeType) ? item.mimeType : null;
  const byteSize = Math.max(0, Math.round(cleanNumber(item.byteSize)));
  const available = Boolean(mimeType && byteSize > 0);
  return {
    id,
    kind: "replay",
    source: "rrweb",
    quality: available ? "captured" : "unavailable",
    mimeType: available ? mimeType : null,
    byteSize: available ? byteSize : 0,
    durationMs: Math.max(0, Math.min(MAX_REPLAY_DURATION_MS, Math.round(cleanNumber(item.durationMs)))),
    eventCount: Math.max(0, Math.round(cleanNumber(item.eventCount))),
  };
}

function normalizeEvidence(item) {
  if (!item || typeof item !== "object") return null;
  const id = cleanString(item.id, 120);
  if (!id) return null;
  if (item.kind === "recording") return normalizeRecordingEvidence(item, id);
  if (item.kind === "replay") return normalizeReplayEvidence(item, id);
  const mimeType = EVIDENCE_MIME_TYPES.has(item.mimeType) ? item.mimeType : null;
  const byteSize = Math.max(0, Math.round(cleanNumber(item.byteSize)));
  const pixelSize = {
    width: Math.max(0, Math.round(cleanNumber(item.pixelSize?.width))),
    height: Math.max(0, Math.round(cleanNumber(item.pixelSize?.height))),
  };
  const requestedQuality = EVIDENCE_QUALITIES.has(item.quality) ? item.quality : "unavailable";
  const hasRaster = mimeType && byteSize > 0 && pixelSize.width > 0 && pixelSize.height > 0;
  const quality = hasRaster
    ? requestedQuality === "unavailable" ? "degraded" : requestedQuality
    : "unavailable";
  return {
    id,
    kind: "snapshot",
    source: "dom-renderer",
    quality,
    mimeType: hasRaster ? mimeType : null,
    byteSize: hasRaster ? byteSize : 0,
    pixelSize: hasRaster ? pixelSize : { width: 0, height: 0 },
    ...(item.capture ? { capture: {
      capturedAt: cleanString(item.capture.capturedAt, 48),
      route: sanitizeRoute(item.capture.route),
      buildId: cleanString(item.capture.buildId, 240) || null,
      bounds: cleanBounds(item.capture.bounds),
      pin: { x: Math.min(1, Math.max(0, cleanNumber(item.capture.pin?.x))), y: Math.min(1, Math.max(0, cleanNumber(item.capture.pin?.y))) },
    } } : {}),
    redactionCount: Math.max(0, Math.round(cleanNumber(item.redactionCount))),
    warnings: Array.isArray(item.warnings)
      ? item.warnings.slice(0, 20).map((warning) => cleanString(warning, 80)).filter(Boolean)
      : [],
  };
}

function normalizeInteractionEvent(value, targetCount, maxOffsetMs = 30_000) {
  if (!value || typeof value !== "object" || !INTERACTION_EVENT_TYPES.has(value.type)) return null;
  const event = {
    type: value.type,
    offsetMs: Math.max(0, Math.min(maxOffsetMs, Math.round(cleanNumber(value.offsetMs)))),
  };
  const rawTargetIndex = Number(value.targetIndex);
  const targetIndex = Math.round(rawTargetIndex);
  if (value.targetIndex != null && Number.isFinite(rawTargetIndex) && Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < targetCount) {
    event.targetIndex = targetIndex;
  }
  if (value.type === "click") {
    event.button = Math.max(0, Math.min(4, Math.round(cleanNumber(value.button))));
    if (Number.isFinite(Number(value.x))) event.x = Math.round(cleanNumber(value.x));
    if (Number.isFinite(Number(value.y))) event.y = Math.round(cleanNumber(value.y));
  }
  if (value.type === "input") {
    event.inputType = INTERACTION_INPUT_TYPES.has(value.inputType) ? value.inputType : "text";
  }
  if (value.type === "keydown" && !INTERACTION_KEYS.has(value.key)) return null;
  if (value.type === "keydown") {
    event.key = value.key;
    event.modifiers = ["alt", "control", "meta", "shift"]
      .filter((modifier) => Boolean(value.modifiers?.includes?.(modifier)));
  }
  if (value.type === "scroll") {
    event.scrollX = Math.round(cleanNumber(value.scrollX));
    event.scrollY = Math.round(cleanNumber(value.scrollY));
  }
  if (value.type === "navigation") event.route = sanitizeRoute(value.route);
  return event;
}

function normalizeInteraction(value, targetCount) {
  if (!value || typeof value !== "object") return null;
  const startedAt = cleanString(value.startedAt, 48);
  const events = (Array.isArray(value.events) ? value.events : [])
    .slice(0, 100)
    .map((event) => normalizeInteractionEvent(event, targetCount))
    .filter(Boolean);
  if (!startedAt || !events.length) return null;
  const durationMs = Math.max(
    events[events.length - 1]?.offsetMs || 0,
    Math.min(30_000, Math.round(cleanNumber(value.durationMs))),
  );
  return {
    version: 1,
    startedAt,
    durationMs,
    events,
  };
}

function normalizeSampleList(value, limit, maxOffsetMs) {
  const samples = [];
  let previousOffset = 0;
  for (const item of Array.isArray(value) ? value.slice(0, limit) : []) {
    if (!Array.isArray(item) || item.length < 3) continue;
    const [offset, x, y] = item.map((part) => Math.round(cleanNumber(part)));
    const offsetMs = Math.max(previousOffset, Math.min(maxOffsetMs, Math.max(0, offset)));
    previousOffset = offsetMs;
    samples.push([offsetMs, x, y]);
  }
  return samples;
}

// Video feedback keeps the media in a Blob sidecar; the payload carries only what an agent or a
// replay needs: timing, the pointer path, and the same privacy-safe event timeline as interactions.
function normalizeVideo(value, targetCount, evidence) {
  if (!value || typeof value !== "object") return null;
  const evidenceId = cleanString(value.evidenceId, 120);
  const recording = evidence.find((item) => item.id === evidenceId && item.kind === "recording");
  const startedAt = cleanString(value.startedAt, 48);
  if (!evidenceId || !recording || !startedAt) return null;
  const durationMs = Math.max(
    recording.durationMs,
    Math.min(MAX_VIDEO_DURATION_MS, Math.max(0, Math.round(cleanNumber(value.durationMs)))),
  );
  const events = (Array.isArray(value.events) ? value.events : [])
    .slice(0, MAX_VIDEO_EVENTS)
    .map((event) => normalizeInteractionEvent(event, targetCount, durationMs))
    .filter(Boolean);
  return {
    version: 1,
    mode: VIDEO_MODES.has(value.mode) ? value.mode : "voice",
    startedAt,
    durationMs,
    evidenceId,
    camera: Boolean(value.camera),
    microphone: Boolean(value.microphone),
    viewport: {
      width: Math.max(0, Math.round(cleanNumber(value.viewport?.width))),
      height: Math.max(0, Math.round(cleanNumber(value.viewport?.height))),
    },
    pointer: {
      samples: normalizeSampleList(value.pointer?.samples, MAX_POINTER_SAMPLES, durationMs),
      scrolls: normalizeSampleList(value.pointer?.scrolls, MAX_SCROLL_SAMPLES, durationMs),
    },
    events,
  };
}

const count = (value) => Math.max(0, Math.round(cleanNumber(value)));

// A replay summary an agent can read without opening the recording. URLs are sanitized again here, so a
// host or client cannot smuggle query values or credentials into stored feedback.
function normalizeReplay(value, evidence) {
  if (!value || typeof value !== "object") return null;
  const evidenceId = cleanString(value.evidenceId, 120);
  const stored = evidence.find((item) => item.id === evidenceId && item.kind === "replay");
  if (!evidenceId || !stored) return null;
  const durationMs = Math.max(stored.durationMs, Math.min(MAX_REPLAY_DURATION_MS, count(value.durationMs)));
  const offset = (item) => Math.min(durationMs, count(item?.offsetMs));
  const consoleEntries = (Array.isArray(value.console?.entries) ? value.console.entries : [])
    .slice(0, MAX_REPLAY_ENTRIES)
    .filter((item) => item && ["error", "warn"].includes(item.level))
    .map((item) => ({ offsetMs: offset(item), level: item.level, message: cleanString(item.message, 500) }));
  const networkEntries = (Array.isArray(value.network?.entries) ? value.network.entries : [])
    .slice(0, MAX_REPLAY_ENTRIES)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      offsetMs: offset(item),
      method: cleanString(item.method, 10).toUpperCase().replace(/[^A-Z]/g, "") || "GET",
      url: sanitizeReplayUrl(cleanString(item.url, 600), "https://threadmark.invalid/"),
      status: Math.min(999, count(item.status)),
      durationMs: Math.min(600_000, count(item.durationMs)),
      outcome: REPLAY_OUTCOMES.has(item.outcome) ? item.outcome : "incomplete",
    }));
  return {
    version: 1,
    evidenceId,
    startedAt: cleanString(value.startedAt, 48),
    durationMs,
    eventCount: Math.max(stored.eventCount, count(value.eventCount)),
    viewport: { width: count(value.viewport?.width), height: count(value.viewport?.height) },
    console: { errors: count(value.console?.errors), warnings: count(value.console?.warnings), entries: consoleEntries },
    network: { requests: count(value.network?.requests), failed: count(value.network?.failed), entries: networkEntries },
    actions: { clicks: count(value.actions?.clicks), inputs: count(value.actions?.inputs), navigations: count(value.actions?.navigations) },
  };
}

const ASK_KINDS = new Set(["question", "poll"]);
export const MAX_POLL_OPTIONS = 8;

/**
 * A question (answered in replies) or a poll (answered by votes) that someone asked about an element or
 * page. Poll options keep stable ids, so votes stay attached if a label is corrected.
 */
export function normalizeAsk(value) {
  if (!value || typeof value !== "object" || !ASK_KINDS.has(value.kind)) return null;
  if (value.kind === "question") return { kind: "question" };
  const seen = new Set();
  const options = (Array.isArray(value.options) ? value.options : [])
    .map((option, index) => ({
      id: cleanString(option?.id, 40) || `option-${index + 1}`,
      label: cleanString(option?.label, 200),
    }))
    .filter((option) => option.label && !seen.has(option.id) && seen.add(option.id))
    .slice(0, MAX_POLL_OPTIONS);
  if (options.length < 2) return null;
  return { kind: "poll", options, multiple: Boolean(value.multiple) };
}

/** Poll results a host supplies as `context.poll`: per-option counts, the voter's own choice, and who voted. */
export function normalizePollResults(value, ask) {
  if (ask?.kind !== "poll" || !value || typeof value !== "object") return null;
  const ids = new Set(ask.options.map((option) => option.id));
  const counts = Object.fromEntries(ask.options.map((option) => [option.id, Math.max(0, Math.round(cleanNumber(value.counts?.[option.id])))]));
  return {
    counts,
    total: Math.max(0, Math.round(cleanNumber(value.total))),
    mine: (Array.isArray(value.mine) ? value.mine : []).filter((id) => ids.has(id)),
    voters: (Array.isArray(value.voters) ? value.voters : []).slice(0, 200)
      .map((voter) => ({
        reviewer: normalizeReviewer(voter?.reviewer),
        optionIds: (Array.isArray(voter?.optionIds) ? voter.optionIds : []).filter((id) => ids.has(id)),
      }))
      .filter((voter) => voter.reviewer),
  };
}

export function createFeedbackPayload({
  id,
  now = new Date().toISOString(),
  updatedAt = now,
  projectKey,
  environment,
  captureEnvironment,
  buildId,
  route,
  target,
  targets,
  captureKind,
  evidence,
  comment,
  replies,
  interaction,
  video,
  replay,
  author,
  lastEditedBy,
  pin,
  pinHistory,
  workflow,
  ask,
}) {
  const payloadId = cleanString(id, 160)
    || globalThis.crypto?.randomUUID?.()
    || `tm_${Date.now().toString(36)}`;

  const hasCaptureContract = Array.isArray(targets) || captureKind || Array.isArray(evidence);
  const normalizedTargets = (Array.isArray(targets) ? targets : [target])
    .slice(0, 20)
    .map((item) => normalizeTarget(item, route))
    .filter(Boolean);
  const primaryTarget = normalizedTargets[0] || null;
  const payload = {
    id: payloadId,
    projectKey: cleanString(clean(projectKey), 240),
    environment: cleanString(clean(environment), 80),
    buildId: cleanString(clean(buildId), 240) || null,
    route: sanitizeRoute(route),
    target: primaryTarget,
    comment: cleanComment(comment),
    createdAt: cleanString(now, 48) || new Date().toISOString(),
    updatedAt: cleanString(updatedAt, 48) || cleanString(now, 48) || new Date().toISOString(),
    author: normalizeReviewer(author),
    lastEditedBy: normalizeReviewer(lastEditedBy),
  };

  const capturedEnvironment = normalizeCaptureEnvironment(captureEnvironment);
  if (capturedEnvironment) payload.captureEnvironment = capturedEnvironment;

  const normalizePin = (value) => {
    const target = normalizeTarget(value?.target, value?.route || route);
    if (!target) return null;
    return {
      target,
      route: sanitizeRoute(value.route || route),
      buildId: cleanString(value.buildId, 240) || null,
      movedAt: cleanString(value.movedAt, 48),
      movedBy: normalizeReviewer(value.movedBy),
    };
  };
  if (pin) payload.pin = normalizePin(pin);
  if (Array.isArray(pinHistory)) payload.pinHistory = pinHistory.slice(-50).map(normalizePin).filter(Boolean);

  const normalizedAsk = normalizeAsk(ask);
  if (normalizedAsk) payload.ask = normalizedAsk;

  if (workflow && typeof workflow === "object") {
    payload.workflow = {
      status: workflow.status === "resolved" ? "resolved" : "open",
      assignee: normalizeReviewer(workflow.assignee),
      mentions: (Array.isArray(workflow.mentions) ? workflow.mentions : []).slice(0, 20).map(normalizeReviewer).filter(Boolean),
      // Keep the newest entries; a malformed entry is dropped rather than discarding the whole discussion.
      history: (Array.isArray(workflow.history) ? workflow.history : []).slice(-200)
        .filter((item) => item && typeof item === "object").map((item) => ({
        action: ["resolved", "reopened", "assigned", "mentioned", "verified", "verification_failed"].includes(item.action) ? item.action : "mentioned",
        at: cleanString(item.at, 48), actor: normalizeReviewer(item.actor),
        buildId: cleanString(item.buildId, 240) || null,
        assignee: normalizeReviewer(item.assignee),
      })),
    };
  }
  if (Array.isArray(replies)) {
    payload.replies = replies
      .slice(0, 200)
      .map(normalizeReply)
      .filter(Boolean);
  }

  if (hasCaptureContract) {
    payload.captureKind = CAPTURE_KINDS.has(captureKind)
      ? captureKind
      : normalizedTargets.length > 1
        ? "multi"
        : normalizedTargets[0]?.kind === "region"
          ? "region"
          : normalizedTargets[0]?.kind === "text"
            ? "text"
            : normalizedTargets[0]?.kind === "screenshot" ? "screenshot" : "element";
    payload.targets = normalizedTargets;
    payload.evidence = (Array.isArray(evidence) ? evidence : [])
      .slice(0, 4)
      .map(normalizeEvidence)
      .filter(Boolean);
    if (payload.captureKind === "interaction") {
      const normalizedInteraction = normalizeInteraction(interaction, normalizedTargets.length);
      if (normalizedInteraction) payload.interaction = normalizedInteraction;
    }
    if (payload.captureKind === "video") {
      const normalizedVideo = normalizeVideo(video, normalizedTargets.length, payload.evidence);
      if (normalizedVideo) payload.video = normalizedVideo;
    }
    const normalizedReplay = normalizeReplay(replay, payload.evidence);
    if (normalizedReplay) payload.replay = normalizedReplay;
  }

  return payload;
}
