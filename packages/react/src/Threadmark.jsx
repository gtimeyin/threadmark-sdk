import { normalizeNotifications } from "./notifications.js";
import { nearestBarPosition, readBarPrefs, readHiddenPages, writeBarPrefs, writeHiddenPages } from "./barPrefs.js";
import { normalizeSurveys, surveyPageMatches } from "./surveys/schema.js";
import { normalizeReactions } from "./reactions.js";
import { createAnnotationHydrator } from "./annotationHydration.js";
import { captureEnvironment } from "./captureEnvironment.js";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatAnnotationsMarkdown,
  isAnnotationDrag,
  isTypingTarget,
  pausePage,
  shortcutAction,
  suppressHostEvent,
} from "./annotation.js";
import {
  MAX_METADATA_BYTES,
  createFeedbackPayload,
  normalizeLinks,
  isLocalHostname,
  isThreadmarkEnabled,
  normalizeMetadata,
  normalizeReviewer,
  sanitizeRoute,
  normalizePollResults,
} from "./core.js";
import { overlayStyles } from "./overlayStyles.js";
import {
  captureRegionSnapshot,
  composeMarkupSnapshot,
  normalizeDrawRect,
} from "./snapshot.js";
import {
  Overlay,
  createInteractionPageTarget,
  createScreenshotTargetDescriptor,
  interactionTargetKey,
} from "./ThreadmarkOverlay.jsx";
import {
  createRestorationContext,
  suggestChangedTarget,
  createRegionTargetDescriptor,
  createTargetDescriptor,
  createTextTargetDescriptor,
  describeTargetElement,
  findMarqueeTargets,
  findInvalidIgnoredSelector,
  findSelectableTarget,
  restoreTargetDescriptor,
  restoreTextTargetDescriptor,
} from "./target.js";
import { createMarkerPositions } from "./markerPositions.js";
import { createRestorationScheduler } from "./restorationScheduler.js";
import { normalizePageVersions } from "./versionHistory.js";
import { normalizeNextSteps } from "./nextSteps.js";
import { resolveStableTarget } from "./resolveStableTarget.js";
import { THREADMARK_TARGET_ATTRIBUTE, isValidThreadmarkTargetId } from "./targetId.js";
import { getMountedTourPlayer } from "./tours/playerRegistry.js";
const ThreadmarkTours = lazy(() => import("./tours/ThreadmarkTours.jsx").then(module => ({ default: module.ThreadmarkTours })));
import { loadClientHints, readDeviceInfo } from "./deviceInfo.js";
import { resolveSessionReplayOptions, startSessionReplay } from "./sessionReplay.js";
import {
  CAMERA_VIDEO_BITS_PER_SECOND,
  MAX_VIDEO_EVENTS,
  TAB_VIDEO_BITS_PER_SECOND,
  appendPointerSample,
  appendScrollSample,
  createPointerTrack,
  createRecorderSession,
  createRecordingClock,
  detectVideoSupport,
  listMediaDevices,
  openPreviewStream,
  openTabStream,
  readRecordingMetadata,
  resolveVideoRecordingOptions,
  stopStream,
  suggestVideoTitle,
} from "./videoRecording.js";

import { AgentReview } from "./AgentReview.jsx";
import { Presence } from "./Presence.jsx";

const MAX_MULTI_TARGETS = 20;
const EMPTY_IGNORED_SELECTORS = [];
const MIN_REGION_SIZE = 12;
const ANNOTATION_QUERY_PARAM = "threadmark";
const MAX_INTERACTION_DURATION_MS = 15_000;
const MAX_INTERACTION_EVENTS = 100;
const MAX_INTERACTION_TARGETS = 20;
const INTERACTION_COMMAND_KEYS = new Set([
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

function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

function rectFromElement(element) {
  if (!element?.isConnected) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function rectFromRange(range) {
  const rect = range?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  // A quote's pin sits at the end of its last line, next to the words, not at the far corner of
  // the box around every line it covers.
  const lines = [...(range.getClientRects?.() || [])].filter((line) => line.width > 0 && line.height > 0);
  const last = lines[lines.length - 1];
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    ...(last && lines.length > 1 ? { pinX: last.right, pinY: last.top + Math.min(18, last.height / 2) } : {}),
  };
}

function rectFromTarget(target) {
  const page = target?.pageBounds;
  if (!page) return null;
  return {
    left: page.x - window.scrollX,
    top: page.y - window.scrollY,
    width: page.width,
    height: page.height,
  };
}

function resolveTargetElement(target) {
  return restoreTargetDescriptor(target, { documentRef: document }).element;
}

function rectFromAnnotation(annotation) {
  if (annotation?.payload?.pin) return rectFromElement(resolveTargetElement(annotation.payload.pin.target));
  const runtime = annotation?.runtime;
  const targets = annotation?.payload?.targets || [annotation?.payload?.target].filter(Boolean);
  const fallbackTarget = targets[targets.length - 1];
  if (runtime?.kind === "text") return rectFromRange(runtime.range) || rectFromTarget(fallbackTarget);
  if (runtime?.kind === "screenshot") {
    const point = runtime.anchorPagePoint;
    if (!point) return rectFromTarget(fallbackTarget);
    return {
      left: point.x - window.scrollX,
      top: point.y - window.scrollY,
      width: 1,
      height: 1,
    };
  }
  if (runtime?.kind === "region") {
    const page = runtime.pageBounds;
    if (!page) return rectFromTarget(fallbackTarget);
    return {
      left: page.x - window.scrollX,
      top: page.y - window.scrollY,
      width: page.width,
      height: page.height,
    };
  }
  // A page-level recording targets <html>; its useful position is the viewport where it was recorded.
  const pageElement = document.documentElement;
  const connected = (runtime?.elements || []).filter((element) => element?.isConnected && element !== pageElement);
  const repaired = resolveTargetElement(fallbackTarget);
  return rectFromElement(connected[connected.length - 1] || (repaired === pageElement ? null : repaired))
    || rectFromTarget(fallbackTarget);
}

// Hosts may hand stored evidence back as a URL (such as a signed storage URL) instead of a Blob.
function isRemoteEvidenceUrl(value) {
  if (typeof value !== "string" || value.length > 8192) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      || url.protocol === "blob:"
      || (url.protocol === "http:" && isLocalHostname(url.hostname));
  } catch {
    return false;
  }
}

function recordToAnnotation(record, reusablePayload = null) {
  const source = record?.feedback;
  if (!source?.id || !source?.target) return null;
  try {
    let payload = reusablePayload || createFeedbackPayload({
      id: source.id,
      now: source.createdAt,
      updatedAt: source.updatedAt,
      projectKey: source.projectKey,
      environment: source.environment,
      captureEnvironment: source.captureEnvironment,
      buildId: source.buildId || undefined,
      route: source.route,
      target: source.target,
      targets: source.targets,
      captureKind: source.captureKind,
      evidence: source.evidence,
      pin: source.pin,
      pinHistory: source.pinHistory,
      workflow: source.workflow,
      ask: source.ask,
      tourStep: source.tourStep,
      links: source.links,
      source: source.source,
      comment: source.comment,
      replies: source.replies,
      reactions: source.reactions,
      interaction: source.interaction,
      video: source.video,
      replay: source.replay,
      author: source.author,
      lastEditedBy: source.lastEditedBy,
      device: source.device,
      metadata: source.metadata,
    });
    const evidence = (record.context?.evidence || []).flatMap((item) => {
      const metadata = payload.evidence?.find((candidate) => candidate.id === item?.id);
      if (!metadata) return [];
      if (item.blob instanceof Blob) {
        return metadata.byteSize === item.blob.size && metadata.mimeType === item.blob.type
          ? [{ id: item.id, blob: item.blob }]
          : [];
      }
      // A stored copy cannot be size-checked here; the host vouches for it, and it is only displayed.
      return isRemoteEvidenceUrl(item.url) ? [{ id: item.id, url: item.url }] : [];
    });
    const targets = payload.targets || [payload.target];
    const primary = targets[targets.length - 1];
    const pageBounds = primary?.pageBounds;
    const captureKind = payload.captureKind || "element";
    const runtime = captureKind === "screenshot"
      ? {
        kind: "screenshot",
        anchorPagePoint: pageBounds ? {
          x: pageBounds.x + pageBounds.width,
          y: pageBounds.y + Math.min(18, pageBounds.height / 2),
        } : null,
        evidence,
      }
      : captureKind === "region"
        ? { kind: "region", pageBounds: pageBounds ? { ...pageBounds } : null, evidence }
        : captureKind === "text"
          ? { kind: "text", range: null }
          : {
            kind: captureKind,
            elements: [],
            interaction: captureKind === "interaction" ? payload.interaction : null,
            video: captureKind === "video" ? payload.video : null,
          };
    runtime.evidence = evidence;
    return { id: payload.id, payload, runtime, poll: normalizePollResults(record.context?.poll, payload.ask) };
  } catch {
    return null;
  }
}

// A record returned by onFeedbackCreate is host data: normalize it like a hydrated record, and keep the
// local evidence when the host omits context. A malformed return keeps the local payload rather than crashing.
function acceptAuthoritative(payload, evidence, result) {
  if (!result?.feedback) return { payload, evidence, poll: null };
  const accepted = recordToAnnotation({
    feedback: result.feedback,
    context: { evidence: result.context?.evidence ?? evidence, poll: result.context?.poll },
  });
  return accepted ? { payload: accepted.payload, evidence: accepted.runtime.evidence, poll: accepted.poll } : { payload, evidence, poll: null };
}

function mergeAccepted(item, previousId, accepted) {
  return item.id === previousId
    ? {
      ...item,
      id: accepted.payload.id,
      payload: accepted.payload,
      runtime: item.runtime && { ...item.runtime, evidence: accepted.evidence },
      ...(accepted.poll ? { poll: accepted.poll } : {}),
    }
    : item;
}

const emptyPoll = (ask) => normalizePollResults({ counts: {}, total: 0, mine: [], voters: [] }, ask);

function annotationTargets(payload) {
  return payload?.pin ? [payload.pin.target] : payload?.targets || [payload?.target].filter(Boolean);
}

/**
 * Where a saved annotation belongs on the current page.
 * - resolved / partial: its element(s) still match exactly.
 * - changed: no exact match, but a likely element exists; shown as a suggestion the reviewer must confirm.
 * - missing (ghost): nothing matches; shown faded at its last known page position when one was recorded.
 * - ambiguous: several elements match equally, so Threadmark does not guess.
 */
function assessAnnotation(annotation, ignoredSelectors = [], buildId, context = createRestorationContext(), deferSuggestions = false) {
  const payload = annotation?.payload;
  const targets = annotationTargets(payload);
  const captureKind = payload?.pin ? "element" : payload?.captureKind || "element";
  if (["region", "screenshot"].includes(captureKind)) {
    const otherBuild = Boolean(payload.buildId && buildId && payload.buildId !== buildId);
    return positionRestoration(annotation, {
      status: otherBuild ? "missing" : "resolved",
      ghost: otherBuild,
      resolvedCount: otherBuild ? 0 : targets.length,
      total: targets.length,
      missingIndexes: otherBuild ? targets.map((_, index) => index) : [],
      ambiguousIndexes: [],
      results: [],
    });
  }

  const results = targets.map((target) => (
    captureKind === "text"
      ? restoreTextTargetDescriptor(target, { documentRef: document, ignoredSelectors, context, deferSuggestions })
      : restoreTargetDescriptor(target, { documentRef: document, ignoredSelectors, context, deferSuggestions })
  ));
  const resolvedCount = results.filter((result) => result.status === "resolved").length;
  const missingIndexes = results
    .map((result, index) => result.status === "missing" ? index : -1)
    .filter((index) => index >= 0);
  const ambiguousIndexes = results
    .map((result, index) => result.status === "ambiguous" ? index : -1)
    .filter((index) => index >= 0);
  const suggestion = resolvedCount === 0 && !ambiguousIndexes.length
    ? [...results].reverse().find((result) => result.suggestion?.isConnected)?.suggestion || null
    : null;
  const status = resolvedCount === results.length
    ? "resolved"
    : resolvedCount > 0
      ? "partial"
      : ambiguousIndexes.length
        ? "ambiguous"
        : suggestion ? "changed" : "missing";
  return positionRestoration(annotation, {
    status,
    ghost: status === "missing",
    suggestion,
    suggestionLabel: suggestion ? describeTargetElement(suggestion, ignoredSelectors, context) : "",
    resolvedCount,
    total: results.length,
    missingIndexes,
    ambiguousIndexes,
    results,
  });
}

// Deferred suggestions reuse the exact results; they never rerun exact matching.
function suggestAnnotation(annotation, restoration, ignoredSelectors, context) {
  if (restoration.status !== "missing") return restoration;
  const targets = annotationTargets(annotation.payload);
  const results = restoration.results.map((result, index) => result.status === "missing"
    ? { ...result, suggestion: suggestChangedTarget(targets[index], document, ignoredSelectors, context) }
    : result);
  const suggestion = [...results].reverse().find(result => result.suggestion?.isConnected)?.suggestion || null;
  return positionRestoration(annotation, { ...restoration, results, suggestion,
    status: suggestion ? "changed" : "missing", ghost: !suggestion,
    suggestionLabel: suggestion ? describeTargetElement(suggestion, ignoredSelectors, context) : "" });
}

/** Recomputes only the on-screen rectangle, so scrolling does not rerun target matching. */
function positionRestoration(annotation, restoration) {
  const payload = annotation?.payload;
  const captureKind = payload?.pin ? "element" : payload?.captureKind || "element";
  let rect = null;
  if (["region", "screenshot"].includes(captureKind)) rect = rectFromAnnotation(annotation);
  else if (restoration.status === "changed") rect = rectFromElement(restoration.suggestion);
  else if (restoration.ghost) {
    const targets = annotationTargets(payload);
    rect = rectFromTarget(targets[targets.length - 1]);
  } else {
    const lastResolved = [...restoration.results].reverse().find((result) => result.status === "resolved");
    const targets = annotationTargets(payload);
    rect = captureKind === "text"
      ? rectFromRange(lastResolved?.range)
      : lastResolved?.element === document.documentElement
        ? rectFromTarget(targets[targets.length - 1])
        : rectFromElement(lastResolved?.element);
  }
  return { ...restoration, rect };
}

function sameRect(left, right) {
  return left === right || Boolean(left && right && left.top === right.top && left.left === right.left
    && left.width === right.width && left.height === right.height);
}

function sameRects(current, next) {
  const ids = Object.keys(next);
  return ids.length === Object.keys(current).length && ids.every((id) => sameRect(current[id], next[id]));
}

function sameRestorations(current, next) {
  const ids = Object.keys(next);
  return ids.length === Object.keys(current).length && ids.every((id) => {
    const left = current[id];
    const right = next[id];
    return Boolean(left)
      && left.status === right.status && left.ghost === right.ghost && left.total === right.total
      && left.resolvedCount === right.resolvedCount && left.suggestion === right.suggestion
      && left.suggestionLabel === right.suggestionLabel && sameRect(left.rect, right.rect)
      && left.results.length === right.results.length
      && left.results.every((result, index) => (
        result.status === right.results[index].status
        && result.element === right.results[index].element
        && result.range === right.results[index].range
      ));
  });
}

function describeMediaError(error, { camera, microphone }) {
  const sources = camera && microphone ? "camera and microphone" : camera ? "camera" : "microphone";
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return `Access to the ${sources} was blocked. Allow it in the browser, or turn it off here.`;
  }
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") {
    return `No ${sources} was found. Choose another device or turn it off.`;
  }
  if (error?.name === "NotReadableError") return `The ${sources} is in use by another app.`;
  return `The ${sources} couldn’t be started.`;
}

function makeId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** "Cards", "Pricing table": a short name for what sits under the middle of a boxed region. */
function regionPlaceLabel(rect) {
  if (typeof document === "undefined" || !document.elementsFromPoint) return "";
  const element = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    .find((node) => !node.closest?.("[data-threadmark-root]") && node !== document.documentElement && node !== document.body);
  if (!element) return "";
  const labelled = element.closest?.("[aria-label], section, article, nav, header, footer, form, h1, h2, h3, button, a") || element;
  const raw = labelled.getAttribute?.("aria-label") || labelled.querySelector?.("h1, h2, h3")?.textContent || labelled.textContent || "";
  const words = raw.replace(/\s+/g, " ").trim();
  if (!words) return "";
  return words.length > 28 ? `${words.slice(0, 28).replace(/\s+\S*$/, "")}…` : words;
}

function revokePreview(regionSelection) {
  if (regionSelection?.snapshot?.previewUrl && typeof URL !== "undefined") {
    URL.revokeObjectURL(regionSelection.snapshot.previewUrl);
  }
}

function callbackTarget(target) {
  return {
    kind: target.kind,
    tagName: target.tagName,
    role: target.role,
    accessibleName: "",
    visibleText: "",
    selectedText: target.selectedText == null ? undefined : "",
    bounds: target.bounds,
    viewportBounds: target.viewportBounds,
    pageBounds: target.pageBounds,
    normalizedBounds: target.normalizedBounds,
    viewport: target.viewport,
    locatorCandidates: {
      stableId: target.locatorCandidates?.stableId || null,
      id: null,
      domPath: "",
    },
    route: target.route,
    capturedAt: target.capturedAt,
  };
}

// Reviewers are mentioned inline as "@Display Name"; record any newly mentioned member on the thread workflow.
function withInlineMentions(workflow, text, reviewers, actor, buildId) {
  const base = workflow || { status: "open", mentions: [], history: [] };
  const known = new Set((base.mentions || []).map((member) => member.id));
  const added = reviewers.filter((member) => member?.id && member.displayName
    && !known.has(member.id) && String(text || "").includes(`@${member.displayName}`));
  if (!added.length) return base;
  const at = new Date().toISOString();
  return {
    ...base,
    mentions: [...(base.mentions || []), ...added],
    history: [...(base.history || []), ...added.map(() => ({ action: "mentioned", at, actor, buildId: buildId || null, assignee: null }))],
  };
}

export function Threadmark({
  projectKey,
  reviewer,
  reviewers = [],
  presence,
  enabled,
  environment,
  buildId,
  route,
  allowedHosts,
  ignoredSelectors = EMPTY_IGNORED_SELECTORS,
  styleNonce,
  annotations: persistedAnnotations,
  pageVersions,
  nextSteps,
  notifications,
  surveys,
  surveyResults,
  faces,
  notificationSettings,
  projectName,
  videoRecording,
  sessionReplay,
  deviceDetails = true,
  metadata,
  onReady,
  onStatusChange,
  onOpenChange,
  onTargetSelect,
  onSelectionChange,
  onFeedbackCreate,
  onFeedbackDelete,
  onFeedbackClear,
  onPageReviewRequested,
  onPageVersionSelect,
  onFeedbackCarryForward,
  onPollVote,
  onReactionChange,
  destinations,
  onSendTo,
  onConnectDestination,
  onAiReview,
  onAskAi,
  onAiDismiss,
  onNextStepDone,
  onNextStepsCopy,
  onNotificationOpen,
  onNotificationsRead,
  onSurveyPublish,
  onSurveyEnd,
  onReviewerChange,
  onNotificationSettingsChange,
  onLeaveProject,
  onSignOut,
  inviteSuggestions,
  shareUrl,
  linkAccess,
  members,
  onInvite,
  onMemberChange,
  onResendInvite,
  onLinkAccessChange,
  tours,
  onTourSave,
  aiConnection,
  onTourSendToAi,
  onConnectAi,
  onError,
}) {
  const [portalRoot, setPortalRoot] = useState(null);
  const [shadowHost, setShadowHost] = useState(null);
  const [mode, setMode] = useState("idle");
  // Tour mode: drafts start as copies of the `tours` prop and stay here until saved.
  const [tourDrafts, setTourDrafts] = useState(null);
  const [tourActiveId, setTourActiveId] = useState(null);
  const [tourPick, setTourPick] = useState(null);
  const [tourPreview, setTourPreview] = useState(null);
  const [tourCodeRules, setTourCodeRules] = useState([]);
  // Set while commenting on a tour step from Tour mode: the step to link and where to return.
  const tourCommentRef = useRef(null);
  const [hoverElement, setHoverElement] = useState(null);
  const [hoverRect, setHoverRect] = useState(null);
  const [selections, setSelections] = useState([]);
  const [selectionRects, setSelectionRects] = useState({});
  const [textSelection, setTextSelection] = useState(null);
  const [regionSelection, setRegionSelection] = useState(null);
  const [screenshotSelection, setScreenshotSelection] = useState(null);
  const [interactionSelection, setInteractionSelection] = useState(null);
  const [interactionRecording, setInteractionRecording] = useState(null);
  const [videoSetup, setVideoSetup] = useState(null);
  const [videoRecordingState, setVideoRecordingState] = useState(null);
  const [videoSelection, setVideoSelection] = useState(null);
  // 3-2-1 before recording (7c) and the review after Stop (7e): title, trim and where it posts.
  const [videoCountdown, setVideoCountdown] = useState(null);
  const [videoReview, setVideoReview] = useState(null);
  // What the reviewer chose to blur in a tab recording, and the tool in use (blur or draw).
  const [videoBlurred, setVideoBlurred] = useState([]);
  const [videoTool, setVideoTool] = useState(null);
  const blurPausedRef = useRef(false);
  const [replayDraft, setReplayDraft] = useState(null);
  const [drawRect, setDrawRect] = useState(null);
  const [commentSnapshot, setCommentSnapshot] = useState(null);
  const [repinningId, setRepinningId] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const annotationHydrator = useMemo(() => createAnnotationHydrator(recordToAnnotation), []);
  const otherPageHydrator = useMemo(() => createAnnotationHydrator(recordToAnnotation), []);
  const [otherPageAnnotations, setOtherPageAnnotations] = useState([]);
  const otherPageScope = useRef(null);
  const [annotationRects, setAnnotationRects] = useState({});
  const [annotationRestorations, setAnnotationRestorations] = useState({});
  const restorationSchedulerRef = useRef(null);
  const markerPositions = useMemo(() => createMarkerPositions(), []);
  const [observedLocation, setObservedLocation] = useState("");
  const [markersHidden, setMarkersHidden] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState(null);
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [toolbarDragging, setToolbarDragging] = useState(false);
  const [barPrefs, setBarPrefs] = useState(() => (typeof window === "undefined" ? { position: "bottom-center", shrunk: false } : readBarPrefs()));
  const [hiddenPages, setHiddenPages] = useState(() => (typeof window === "undefined" ? [] : readHiddenPages()));
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const updateBarPrefs = useCallback((change) => setBarPrefs((current) => {
    const next = { ...current, ...change };
    writeBarPrefs(next);
    return next;
  }), []);
  const [comment, setComment] = useState("");
  const [composerMode, setComposerMode] = useState("new");
  const [editingReplyId, setEditingReplyId] = useState(null);
  // A new comment can instead ask a question (answered in replies) or run a poll (answered by votes).
  const [askKind, setAskKind] = useState("comment");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const replyDraftRef = useRef(null);
  const editDraftRef = useRef(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [discardPending, setDiscardPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allCommentsOpen, setAllCommentsOpen] = useState(false);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  // Ticks shown at once while the host stores them; the next `nextSteps` from the host replaces them.
  const [nextStepTicks, setNextStepTicks] = useState({});
  const [carryingVersionId, setCarryingVersionId] = useState(null);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Share of a new comment's files sent so far (0–1), when the host reports uploads; null otherwise.
  const [uploadProgress, setUploadProgress] = useState(null);
  useEffect(() => { if (!submitting) setUploadProgress(null); }, [submitting]);
  const [composingScreenshot, setComposingScreenshot] = useState(false);
  const launcherRef = useRef(null);
  const returnFocusRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const readyEmittedRef = useRef(false);
  const lastStatusRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const clearTimerRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const toolbarDragRef = useRef(null);
  const captureControllerRef = useRef(null);
  const markupGenerationRef = useRef(0);
  const submitGenerationRef = useRef(0);
  const suppressedKeyRef = useRef(null);
  const deepLinkHandledRef = useRef(null);
  const interactionRecordingRef = useRef(null);
  const videoSessionRef = useRef(null);
  const videoPreviewStreamRef = useRef(null);
  const videoPreviewGenerationRef = useRef(0);
  const finishVideoRecordingRef = useRef(null);
  const removeAnnotationRef = useRef(null);
  const videoCountdownCancelRef = useRef(null);
  const postVideoPendingRef = useRef(null);
  const replayRecorderRef = useRef(null);
  const clientHintsRef = useRef(null);
  const metadataRef = useLatest(metadata);

  const normalizedNotifications = useMemo(() => normalizeNotifications(notifications), [notifications]);
  const normalizedSurveys = useMemo(() => normalizeSurveys(surveys), [surveys]);
  const callbacks = {
    onReady: useLatest(onReady),
    onStatusChange: useLatest(onStatusChange),
    onOpenChange: useLatest(onOpenChange),
    onTargetSelect: useLatest(onTargetSelect),
    onSelectionChange: useLatest(onSelectionChange),
    onFeedbackCreate: useLatest(onFeedbackCreate),
    onFeedbackDelete: useLatest(onFeedbackDelete),
    onFeedbackClear: useLatest(onFeedbackClear),
    onPageVersionSelect: useLatest(onPageVersionSelect),
    onFeedbackCarryForward: useLatest(onFeedbackCarryForward),
    onPollVote: useLatest(onPollVote),
    onReactionChange: useLatest(onReactionChange),
    onSendTo: useLatest(onSendTo),
    onNextStepDone: useLatest(onNextStepDone),
    onNextStepsCopy: useLatest(onNextStepsCopy),
    onNotificationOpen: useLatest(onNotificationOpen),
    onNotificationsRead: useLatest(onNotificationsRead),
    onSurveyPublish: useLatest(onSurveyPublish),
    onSurveyEnd: useLatest(onSurveyEnd),
    onTourSave: useLatest(onTourSave),
    onTourSendToAi: useLatest(onTourSendToAi),
    onError: useLatest(onError),
  };
  const toursRef = useLatest(tours);
  const modeRef = useLatest(mode);
  const selectionsRef = useLatest(selections);
  const textRef = useLatest(textSelection);
  const regionRef = useLatest(regionSelection);
  const screenshotRef = useLatest(screenshotSelection);
  const interactionRef = useLatest(interactionSelection);
  const videoRef = useLatest(videoSelection);
  const replayDraftRef = useLatest(replayDraft);
  const videoSetupRef = useLatest(videoSetup);
  const annotationsRef = useLatest(annotations);
  const editingIdRef = useLatest(editingAnnotationId);
  const editingAnnotation = annotations.find((annotation) => annotation.id === editingAnnotationId) || null;
  useEffect(() => {
    if (editingAnnotationId !== null) return;
    replyDraftRef.current = null;
    editDraftRef.current = null;
  }, [editingAnnotationId]);
  const normalizedReviewer = useMemo(
    () => normalizeReviewer(reviewer),
    [reviewer?.avatarUrl, reviewer?.displayName, reviewer?.id],
  );

  const allowedHostsKey = useMemo(() => (allowedHosts || []).join("\n"), [allowedHosts]);
  const ignoredSelectorsKey = useMemo(() => ignoredSelectors.join("\n"), [ignoredSelectors]);
  const videoOptions = useMemo(
    () => resolveVideoRecordingOptions(videoRecording),
    [videoRecording === false, videoRecording?.maxDurationMs, videoRecording?.countdownSeconds],
  );
  const replayOptions = resolveSessionReplayOptions(sessionReplay);
  const replayProviderRef = useLatest(replayOptions.provider);
  const replayNetworkRef = useLatest(replayOptions.network);
  const hasReplayProvider = Boolean(replayOptions.provider);
  const browserHref = typeof window === "undefined" ? "https://threadmark.invalid/" : window.location.href;
  const activeRoute = sanitizeRoute(
    route || (observedLocation ? new URL(observedLocation).pathname : new URL(browserHref).pathname) || "/",
  );
  const normalizedPageVersions = useMemo(() => normalizePageVersions(pageVersions, {
    currentBuildId: String(buildId || ""),
    route: activeRoute,
    currentUrl: observedLocation || browserHref,
  }), [activeRoute, browserHref, buildId, observedLocation, pageVersions]);
  const normalizedNextSteps = useMemo(() => normalizeNextSteps(nextSteps), [nextSteps]);
  useEffect(() => { setNextStepTicks({}); }, [nextSteps]);
  const shownNextSteps = useMemo(() => {
    if (!normalizedNextSteps || !Object.keys(nextStepTicks).length) return normalizedNextSteps;
    const steps = normalizedNextSteps.steps.map((step) => {
      if (!Object.hasOwn(nextStepTicks, step.id) || nextStepTicks[step.id] === step.completed) return step;
      const done = nextStepTicks[step.id];
      return { ...step, completed: done, completedVia: done ? "person" : null, completedBy: done && reviewer?.displayName ? { displayName: String(reviewer.displayName) } : null };
    });
    return { ...normalizedNextSteps, steps: [...steps.filter((step) => !step.completed), ...steps.filter((step) => step.completed)] };
  }, [normalizedNextSteps, nextStepTicks, reviewer?.displayName]);

  const safeCall = useCallback((callbackRef, ...args) => {
    try {
      callbackRef.current?.(...args);
    } catch {
      // Consumer callbacks are isolated from the review overlay.
    }
  }, []);

  const emitStatus = useCallback((status) => {
    if (lastStatusRef.current === status) return;
    lastStatusRef.current = status;
    safeCall(callbacks.onStatusChange, status);
  }, [callbacks.onStatusChange, safeCall]);

  const releaseRegion = useCallback(() => {
    captureControllerRef.current?.abort();
    captureControllerRef.current = null;
    setRegionSelection((current) => {
      revokePreview(current);
      return null;
    });
  }, []);

  const releaseScreenshot = useCallback(() => {
    markupGenerationRef.current += 1;
    captureControllerRef.current?.abort();
    captureControllerRef.current = null;
    setScreenshotSelection((current) => {
      revokePreview(current);
      if (current?.original?.previewUrl && typeof URL !== "undefined") URL.revokeObjectURL(current.original.previewUrl);
      return null;
    });
    setComposingScreenshot(false);
  }, []);

  const releaseInteraction = useCallback(() => {
    interactionRecordingRef.current = null;
    setInteractionRecording(null);
    setInteractionSelection(null);
  }, []);

  // Stops every camera, microphone, and tab track and drops any unsaved recording.
  const releaseVideo = useCallback(() => {
    const session = videoSessionRef.current;
    videoSessionRef.current = null;
    videoPreviewGenerationRef.current += 1;
    videoCountdownCancelRef.current?.();
    postVideoPendingRef.current = null;
    setVideoReview(null);
    session?.recorder?.discard();
    stopStream(session?.displayStream);
    stopStream(videoPreviewStreamRef.current);
    videoPreviewStreamRef.current = null;
    setVideoSetup(null);
    setVideoRecordingState(null);
    setVideoSelection(null);
    setVideoBlurred([]);
    setVideoTool(null);
    blurPausedRef.current = false;
  }, []);

  const clearCapture = useCallback(() => {
    setRepinningId(null);
    releaseRegion();
    releaseScreenshot();
    releaseInteraction();
    releaseVideo();
    setReplayDraft(null);
    setSelections([]);
    setSelectionRects({});
    setTextSelection(null);
    setHoverElement(null);
    setHoverRect(null);
    setDrawRect(null);
    gestureRef.current = null;
    suppressClickRef.current = false;
    setAskKind("comment");
    setPollOptions(["", ""]);
    setPollMultiple(false);
    try { window.getSelection()?.removeAllRanges(); } catch { /* Selection may belong to another realm. */ }
  }, [releaseInteraction, releaseRegion, releaseScreenshot, releaseVideo]);

  const invalidateSubmission = useCallback(() => {
    submitGenerationRef.current += 1;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const stopVideoMedia = () => {
      const session = videoSessionRef.current;
      videoSessionRef.current = null;
      videoPreviewGenerationRef.current += 1;
      session?.recorder?.discard();
      stopStream(session?.displayStream);
      stopStream(videoPreviewStreamRef.current);
      videoPreviewStreamRef.current = null;
    };

    const clearMountState = () => {
      submitGenerationRef.current += 1;
      markupGenerationRef.current += 1;
      if (modeRef.current !== "idle") safeCall(callbacks.onOpenChange, false);
      modeRef.current = "idle";
      captureControllerRef.current?.abort();
      revokePreview(regionRef.current);
      revokePreview(screenshotRef.current);
      setPortalRoot(null);
      setShadowHost(null);
      setMode("idle");
      setHoverElement(null);
      setHoverRect(null);
      setSelections([]);
      setSelectionRects({});
      setTextSelection(null);
      setRegionSelection(null);
      setScreenshotSelection(null);
      setInteractionSelection(null);
      setInteractionRecording(null);
      interactionRecordingRef.current = null;
      stopVideoMedia();
      setVideoSetup(null);
      setVideoRecordingState(null);
      setVideoSelection(null);
      setDrawRect(null);
      setAnnotations([]);
      setAnnotationRects({});
      setAnnotationRestorations({});
      setMarkersHidden(false);
      setClearArmed(false);
      setComposerMode("new");
      setReplyTarget(null);
      setPendingDelete(null);
      setDeleting(false);
      setPaused(false);
      setEditingAnnotationId(null);
      setToolbarPosition(null);
      setComment("");
      setNotice("");
      setSubmitting(false);
      setComposingScreenshot(false);
    };

    const invalidIgnoredSelector = findInvalidIgnoredSelector(ignoredSelectors, document);
    if (invalidIgnoredSelector !== null) {
      clearMountState();
      emitStatus("error");
      safeCall(callbacks.onError, {
        code: "invalid_ignored_selector",
        message: `Threadmark could not use ignored selector: ${invalidIgnoredSelector}`,
      });
      return undefined;
    }

    if (!String(projectKey || "").trim()) {
      clearMountState();
      emitStatus("error");
      safeCall(callbacks.onError, {
        code: "missing_project_key",
        message: "Threadmark requires a public project key.",
      });
      return undefined;
    }

    const shouldMount = isThreadmarkEnabled({
      enabled,
      environment,
      hostname: window.location.hostname,
      allowedHosts,
    });

    if (!shouldMount) {
      clearMountState();
      emitStatus("disabled");
      return undefined;
    }

    if (document.querySelector("[data-threadmark-root]")) {
      clearMountState();
      emitStatus("error");
      safeCall(callbacks.onError, {
        code: "duplicate_instance",
        message: "Only one Threadmark instance can be mounted on a page.",
      });
      return undefined;
    }

    const host = document.createElement("div");
    host.setAttribute("data-threadmark-root", "");
    const shadow = host.attachShadow({ mode: "open" });
    // A constructed stylesheet is not an inline style, so strict style-src policies (and pages reviewed
    // through the browser extension) cannot block it. Older engines fall back to a nonce'd <style>.
    const css = overlayStyles;
    let adopted = false;
    try {
      if ("adoptedStyleSheets" in shadow && typeof CSSStyleSheet.prototype.replaceSync === "function") {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        shadow.adoptedStyleSheets = [sheet];
        adopted = true;
      }
    } catch {
      adopted = false;
    }
    if (!adopted) {
      const style = document.createElement("style");
      if (styleNonce) style.nonce = styleNonce;
      style.textContent = css;
      shadow.append(style);
    }
    const root = document.createElement("div");
    root.setAttribute("data-threadmark-overlay", "");
    shadow.append(root);
    document.body.append(host);
    setMode("idle");
    setHoverElement(null);
    setHoverRect(null);
    setSelections([]);
    setSelectionRects({});
    setTextSelection(null);
    setRegionSelection(null);
    setScreenshotSelection(null);
    setInteractionSelection(null);
    setInteractionRecording(null);
    interactionRecordingRef.current = null;
    stopVideoMedia();
    setVideoSetup(null);
    setVideoRecordingState(null);
    setVideoSelection(null);
    setDrawRect(null);
      setAnnotations([]);
      setAnnotationRects({});
      setAnnotationRestorations({});
    setMarkersHidden(false);
    setPaused(false);
    setEditingAnnotationId(null);
    setToolbarPosition(null);
    setComment("");
    setComposerMode("new");
    setReplyTarget(null);
    setPendingDelete(null);
    setDeleting(false);
    setNotice("");
    setSubmitting(false);
    setComposingScreenshot(false);
    setShadowHost(host);
    setPortalRoot(root);
    setObservedLocation(window.location.href);
    emitStatus("ready");
    if (!readyEmittedRef.current) {
      readyEmittedRef.current = true;
      safeCall(callbacks.onReady);
    }

    return () => {
      submitGenerationRef.current += 1;
      markupGenerationRef.current += 1;
      clearTimeout(noticeTimerRef.current);
      clearTimeout(clearTimerRef.current);
      captureControllerRef.current?.abort();
      interactionRecordingRef.current = null;
      stopVideoMedia();
      revokePreview(regionRef.current);
      revokePreview(screenshotRef.current);
      if (modeRef.current !== "idle") safeCall(callbacks.onOpenChange, false);
      modeRef.current = "idle";
      host.remove();
    };
  }, [
    projectKey,
    enabled,
    environment,
    allowedHostsKey,
    ignoredSelectorsKey,
    styleNonce,
    emitStatus,
    safeCall,
    callbacks.onError,
    callbacks.onOpenChange,
    callbacks.onReady,
  ]);

  // Always-on replay: record in memory while Threadmark is mounted, so a comment can carry what led to it.
  useEffect(() => {
    if (!portalRoot || !replayOptions.enabled) {
      replayRecorderRef.current = null;
      return undefined;
    }
    if (hasReplayProvider) {
      replayRecorderRef.current = {
        capture: () => replayProviderRef.current?.capture?.(),
        hold: () => replayProviderRef.current?.hold?.(),
        release: () => replayProviderRef.current?.release?.(),
        configure: (options) => replayProviderRef.current?.configure?.(options),
      };
      return () => { replayRecorderRef.current = null; };
    }
    let active = true;
    let session = null;
    startSessionReplay({
      bufferMs: replayOptions.bufferMs, blockSelectors: ignoredSelectors, network: replayNetworkRef.current,
      onError: () => safeCall(callbacks.onError, { code: "replay_unavailable", message: "Session replay could not start on this page." }),
    })
      .then((started) => {
        if (!active) {
          started.stop();
          return;
        }
        session = started;
        replayRecorderRef.current = started;
      })
      .catch(() => {
        safeCall(callbacks.onError, { code: "replay_unavailable", message: "Session replay could not start on this page." });
      });
    return () => {
      active = false;
      replayRecorderRef.current = null;
      session?.stop();
    };
  }, [portalRoot, replayOptions.enabled, replayOptions.bufferMs, hasReplayProvider, ignoredSelectorsKey]);

  useEffect(() => () => { annotationHydrator.clear(); otherPageHydrator.clear(); }, [annotationHydrator, otherPageHydrator]);

  // A video's console and network activity must cover the whole recording, so the replay buffer keeps
  // everything from the moment a video starts until it's posted or discarded. Nothing else holds it: a held
  // buffer grows by a full page snapshot at every checkout, and each comment would carry all of it.
  const holdReplay = Boolean(videoRecordingState || videoSelection);
  useEffect(() => {
    if (!holdReplay) return undefined;
    replayRecorderRef.current?.hold?.();
    return () => replayRecorderRef.current?.release?.();
  }, [holdReplay]);

  // Whether request bodies are kept can change while recording (the extension learns a project's setting
  // after the page has started), without restarting the recorder.
  const keepBodies = replayOptions.network.bodies;
  const sanitizeBodies = replayOptions.network.sanitize;
  useEffect(() => {
    replayRecorderRef.current?.configure?.({ network: { bodies: keepBodies, sanitize: sanitizeBodies } });
  }, [portalRoot, keepBodies, sanitizeBodies, hasReplayProvider]);

  // Exact browser and OS versions come from Chromium's client hints, which only answer asynchronously.
  useEffect(() => {
    if (!portalRoot || deviceDetails === false) return undefined;
    let active = true;
    loadClientHints(window).then((hints) => { if (active) clientHintsRef.current = hints; });
    return () => { active = false; };
  }, [portalRoot, deviceDetails]);

  /**
   * The host's app context for a new comment, read when it's posted. A failing or unusable `metadata`
   * never blocks the comment: it's posted without it and `onError` explains why.
   */
  const readMetadata = useCallback(async () => {
    const source = metadataRef.current;
    if (source == null) return undefined;
    const fail = (message) => {
      safeCall(callbacks.onError, { code: "metadata_failed", message });
      return undefined;
    };
    let value;
    try {
      value = typeof source === "function"
        ? await Promise.race([
          Promise.resolve().then(() => source()),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
        ])
        : source;
    } catch (error) {
      return fail(error?.message === "timeout"
        ? "The metadata function took longer than 2 seconds. The comment was posted without app context."
        : "The metadata function threw. The comment was posted without app context.");
    }
    if (value == null) return undefined;
    const normalized = normalizeMetadata(value);
    return normalized || fail(`Metadata must be a plain object that JSON can hold, under ${Math.round(MAX_METADATA_BYTES / 1024)} KB. The comment was posted without app context.`);
  }, [callbacks.onError, safeCall]);

  useEffect(() => {
    if (!Array.isArray(persistedAnnotations)) { annotationHydrator.clear(); otherPageHydrator.clear(); setOtherPageAnnotations([]); return; }
    const activeProject = String(projectKey || "").trim();
    const activeRoute = sanitizeRoute(route || new URL(observedLocation || window.location.href).pathname || "/");
    const records = [], otherPages = [];
    for (const record of persistedAnnotations) {
      if (String(record?.feedback?.projectKey || "").trim() !== activeProject) continue;
      (sanitizeRoute(record.feedback.route || "/") === activeRoute ? records : otherPages).push(record);
    }
    const scope = JSON.stringify([activeProject, activeRoute]);
    otherPageScope.current = scope;
    setAnnotations(annotationHydrator.hydrate(records, scope));
    setOtherPageAnnotations(otherPageHydrator.hydrate(otherPages, scope));
    // portalRoot changes on every remount, which clears annotations; reload the supplied records then too.
  }, [observedLocation, persistedAnnotations, portalRoot, projectKey, route]);

  useEffect(() => {
    if (!portalRoot) return undefined;
    const refreshLocation = () => setObservedLocation((current) => (
      current === window.location.href ? current : window.location.href
    ));
    window.addEventListener("popstate", refreshLocation);
    window.addEventListener("hashchange", refreshLocation);
    window.navigation?.addEventListener?.("navigatesuccess", refreshLocation);
    return () => {
      window.removeEventListener("popstate", refreshLocation);
      window.removeEventListener("hashchange", refreshLocation);
      window.navigation?.removeEventListener?.("navigatesuccess", refreshLocation);
    };
  }, [portalRoot]);

  const closeReview = useCallback(() => {
    // A tour preview belongs to Tour mode; closing review ends it and its temporary player.
    if (modeRef.current === "tour-preview") getMountedTourPlayer()?.stopPreview?.();
    setTourPreview(null);
    tourCommentRef.current = null;
    invalidateSubmission();
    modeRef.current = "idle";
    restoreFocusRef.current = true;
    clearCapture();
    setMode("idle");
    setPaused(false);
    setClearArmed(false);
    setAllCommentsOpen(false);
    setEditingAnnotationId(null);
    setComment("");
    setComposerMode("new");
    setReplyTarget(null);
    setPendingDelete(null);
    setDeleting(false);
    setSubmitting(false);
    emitStatus("ready");
    safeCall(callbacks.onOpenChange, false);
  }, [callbacks.onOpenChange, clearCapture, emitStatus, invalidateSubmission, safeCall]);

  const startReview = useCallback(() => {
    getMountedTourPlayer()?.pause?.();
    returnFocusRef.current = document.activeElement;
    restoreFocusRef.current = false;
    clearCapture();
    modeRef.current = "picking";
    setMode("picking");
    setEditingAnnotationId(null);
    setComment("");
    setComposerMode("new");
    setReplyTarget(null);
    setPendingDelete(null);
    setNotice("");
    emitStatus("selecting");
    safeCall(callbacks.onOpenChange, true);
  }, [callbacks.onOpenChange, clearCapture, emitStatus, safeCall]);

  const startTourMode = useCallback(() => {
    clearCapture();
    setAllCommentsOpen(false);
    setTourDrafts((current) => current ?? (Array.isArray(toursRef.current)
      ? toursRef.current.filter((tour) => tour && typeof tour === "object").map((tour) => JSON.parse(JSON.stringify(tour)))
      : []));
    // Rules written as functions (`showTo.when` in defineTour files) can't be saved as JSON; Tour mode
    // keeps those tours out of Save to code and Copy file so the rule is never silently dropped.
    setTourCodeRules(Array.isArray(toursRef.current)
      ? toursRef.current.filter((tour) => typeof tour?.showTo?.when === "function").map((tour) => tour.id)
      : []);
    modeRef.current = "tour";
    setMode("tour");
    setHoverElement(null);
    setHoverRect(null);
  }, [clearCapture]);

  const exitTourMode = useCallback(() => {
    modeRef.current = "picking";
    setMode("picking");
    setHoverElement(null);
    setHoverRect(null);
  }, []);

  const changeTourDrafts = useCallback((drafts, activeId) => {
    setTourDrafts(drafts);
    setTourActiveId(activeId);
  }, []);

  const previewTour = useCallback((tour) => {
    modeRef.current = "tour-preview";
    setMode("tour-preview");
    setHoverElement(null);
    setHoverRect(null);
    setTourPreview({ tour, needsPlayer: false });
  }, []);

  const stopTourPreview = useCallback(() => {
    getMountedTourPlayer()?.stopPreview?.();
  }, []);

  const copyText = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const backToSelection = useCallback(() => {
    if (submitting) return;
    invalidateSubmission();
    clearCapture();
    setEditingAnnotationId(null);
    setComposerMode("new");
    setReplyTarget(null);
    setPendingDelete(null);
    modeRef.current = "picking";
    setMode("picking");
    setComment("");
    setSubmitting(false);
    emitStatus("selecting");
  }, [clearCapture, emitStatus, invalidateSubmission, submitting]);

  // Dismissal also protects drafts temporarily hidden by a message-mode switch.
  const hasUnsavedComment = (composerMode === "edit"
    ? comment.trim() !== (editingAnnotation?.payload.comment || "").trim()
    : comment.trim() !== "")
    || Boolean(videoSelection)
    || Boolean(replyDraftRef.current?.comment.trim())
    || (editDraftRef.current !== null
      && editDraftRef.current.trim() !== (editingAnnotation?.payload.comment || "").trim());

  const requestDismiss = useCallback(() => {
    if (submitting) return;
    if (hasUnsavedComment) setDiscardPending(true);
    else backToSelection();
  }, [backToSelection, hasUnsavedComment, submitting]);

  // Only clear it when it is showing: an unconditional setState here re-rendered on every keystroke, and
  // fast typing that wrapped the text could pile those up until React gave up and dropped a key.
  useEffect(() => {
    if (discardPending) setDiscardPending(false);
  }, [comment, composerMode, editingAnnotationId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const openComposer = useCallback(() => {
    const targets = textRef.current
      ? [textRef.current.target]
      : regionRef.current
        ? [regionRef.current.target]
        : selectionsRef.current.map((selection) => selection.target);
    if (targets.length < 2 && !textRef.current && !regionRef.current) return;
    modeRef.current = "selected";
    setMode("selected");
    setHoverElement(null);
    setHoverRect(null);
    emitStatus("selected");
  }, [emitStatus, regionRef, selectionsRef, textRef]);

  // A notice is words, or { message, action: { label, run } } for one follow-up such as Undo or Open.
  // Notices with an action stay a little longer so there's time to use it.
  const showNotice = useCallback((message, action = null) => {
    setNotice(action ? { message, action: { label: action.label, run: () => { setNotice(""); action.run(); } } } : message);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), action ? 6000 : 2200);
  }, []);

  const commentOnTourStep = useCallback(({ tourId, stepId, target }) => {
    const found = resolveStableTarget(target, { accept: (element) => element.isConnected && element.getClientRects().length > 0 });
    if (found.status !== "resolved") {
      showNotice(found.status === "ambiguous"
        ? "More than one element has this step’s id, so the comment can’t be pinned."
        : "This step’s element isn’t on this page.");
      return;
    }
    const element = found.element;
    element.scrollIntoView({ block: "center", inline: "nearest" });
    clearCapture();
    tourCommentRef.current = { tourStep: { tourId, stepId }, returnToTour: true };
    const selection = {
      id: makeId("target"),
      element,
      target: createTargetDescriptor(element, { route: sanitizeRoute(route || window.location.pathname || "/"), ignoredSelectors }),
    };
    setSelections([selection]);
    setSelectionRects({ [selection.id]: rectFromElement(element) });
    setEditingAnnotationId(null);
    setComposerMode("new");
    setComment("");
    modeRef.current = "selected";
    setMode("selected");
    emitStatus("selected");
  }, [clearCapture, emitStatus, ignoredSelectorsKey, route, showNotice]);


  const togglePause = useCallback(() => {
    setPaused((current) => {
      showNotice(current ? "Page resumed" : "Animations paused");
      return !current;
    });
  }, [showNotice]);

  const toggleMarkers = useCallback(() => {
    if (!annotationsRef.current.length) return;
    setMarkersHidden((current) => !current);
  }, [annotationsRef]);

  const clearAllAnnotations = useCallback(async () => {
    invalidateSubmission();
    const existing = annotationsRef.current;
    try {
      if (callbacks.onFeedbackClear.current) {
        await callbacks.onFeedbackClear.current(existing.map((annotation) => annotation.payload));
      } else if (callbacks.onFeedbackDelete.current) {
        await Promise.all(existing.map((annotation) => callbacks.onFeedbackDelete.current(annotation.payload)));
      }
    } catch {
      showNotice("Comments weren’t cleared. Try again.");
      safeCall(callbacks.onError, {
        code: "feedback_delete_failed",
        message: "The feedback clear callback did not complete successfully.",
      });
      return;
    }
    clearCapture();
    setAnnotations([]);
    setAnnotationRects({});
    setMarkersHidden(false);
    setClearArmed(false);
    clearTimeout(clearTimerRef.current);
    setEditingAnnotationId(null);
    setComment("");
    setComposerMode("new");
    setReplyTarget(null);
    setPendingDelete(null);
    setSubmitting(false);
    if (modeRef.current !== "idle") {
      modeRef.current = "picking";
      setMode("picking");
      emitStatus("selecting");
    }
    showNotice("Comments cleared");
  }, [annotationsRef, callbacks.onError, callbacks.onFeedbackClear, callbacks.onFeedbackDelete, clearCapture, emitStatus, invalidateSubmission, modeRef, safeCall, showNotice]);

  const requestClearAll = useCallback(() => {
    const hasDraft = Boolean(
      selectionsRef.current.length
      || textRef.current
      || regionRef.current
      || interactionRef.current
      || videoRef.current
      || screenshotRef.current
    );
    if (!annotationsRef.current.length && !hasDraft) return;
    if (clearArmed) {
      clearAllAnnotations();
      return;
    }
    setClearArmed(true);
    showNotice("Clear all annotations and the current draft? Repeat Clear to confirm.");
    clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setClearArmed(false), 3500);
  }, [annotationsRef, clearAllAnnotations, clearArmed, interactionRef, regionRef, screenshotRef, selectionsRef, showNotice, textRef]);

  const copyAnnotations = useCallback(async () => {
    const markdown = formatAnnotationsMarkdown(annotationsRef.current);
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      showNotice(`${annotationsRef.current.length} annotation${annotationsRef.current.length === 1 ? "" : "s"} copied`);
    } catch {
      showNotice("Couldn’t copy annotations");
    }
  }, [annotationsRef, showNotice]);

  const editAnnotation = useCallback((id) => {
    const annotation = annotationsRef.current.find((item) => item.id === id);
    if (!annotation) return;
    restorationSchedulerRef.current?.recheck(id);
    clearCapture();
    replyDraftRef.current = null;
    editDraftRef.current = null;
    setEditingAnnotationId(id);
    // A saved thread opens ready for a reply; the original comment is edited in place from its own Edit action.
    setComment("");
    setComposerMode("reply");
    setReplyTarget(null);
    setPendingDelete(null);
    modeRef.current = "selected";
    setMode("selected");
    emitStatus("selected");
  }, [annotationsRef, clearCapture, emitStatus, modeRef]);

  const beginReply = useCallback((id, name) => {
    if (!editingIdRef.current || submitting) return;
    if (composerMode === "edit") {
      editDraftRef.current = comment;
      setComment(replyDraftRef.current?.comment || "");
      replyDraftRef.current = null;
    }
    setComposerMode("reply");
    setReplyTarget({ id, name });
    setPendingDelete(null);
  }, [comment, composerMode, editingIdRef, submitting]);

  // Edits the original comment, or (board 07, 23a) one of your own replies when given its id.
  const beginEdit = useCallback((replyId = null) => {
    const annotation = annotationsRef.current.find((item) => item.id === editingIdRef.current);
    if (!annotation || submitting || composerMode === "edit") return;
    const reply = typeof replyId === "string" ? (annotation.payload.replies || []).find((item) => item.id === replyId) : null;
    if (typeof replyId === "string" && (!reply || reply.author?.id !== normalizedReviewer?.id)) return;
    replyDraftRef.current = { comment, target: replyTarget };
    setEditingReplyId(reply ? reply.id : null);
    setComposerMode("edit");
    setReplyTarget(null);
    setPendingDelete(null);
    setComment(reply ? reply.comment : editDraftRef.current ?? annotation.payload.comment);
    editDraftRef.current = null;
  }, [annotationsRef, comment, composerMode, editingIdRef, normalizedReviewer?.id, replyTarget, submitting]);

  // Leaving an inline edit or a targeted reply returns to replying to the thread.
  const cancelReply = useCallback(() => {
    if (!editingIdRef.current || submitting) return;
    setEditingReplyId(null);
    if (composerMode === "edit") {
      setComment(replyDraftRef.current?.comment || "");
      setReplyTarget(replyDraftRef.current?.target || null);
      replyDraftRef.current = null;
      editDraftRef.current = null;
    } else {
      // Cancelling reply targeting changes the recipient, not the typed draft.
      setReplyTarget(null);
    }
    setComposerMode("reply");
  }, [composerMode, editingIdRef, submitting]);

  // 23d: a comment nobody has replied to goes straight away, with Undo. A thread asks first (23e).
  const requestDelete = useCallback((intent) => {
    if (!intent?.id || !["annotation", "reply"].includes(intent.kind)) return;
    const annotation = intent.kind === "annotation" ? annotationsRef.current.find((item) => item.id === intent.id) : null;
    if (annotation && !(annotation.payload.replies || []).length) {
      setPendingDelete(null);
      removeAnnotationRef.current?.(intent.id);
      return;
    }
    setPendingDelete(intent);
  }, [annotationsRef]);

  const recheckAnnotation = useCallback((id) => {
    if (!annotationsRef.current.some((annotation) => annotation.id === id)) return;
    restorationSchedulerRef.current?.recheck(id);
    showNotice("Target checked again");
  }, [annotationsRef, showNotice]);

  const copyAnnotationLink = useCallback(async (id) => {
    if (!annotationsRef.current.some((annotation) => annotation.id === id)) return;
    try {
      // Share only the page and the annotation; other query parameters and fragments may carry tokens.
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set(ANNOTATION_QUERY_PARAM, id);
      await navigator.clipboard.writeText(url.toString());
      showNotice("Link copied");
    } catch {
      showNotice("Couldn’t copy annotation link");
    }
  }, [annotationsRef, showNotice]);

  const selectPageVersion = useCallback(async (version) => {
    if (!version?.url || version.current || version.state !== "ready") return;
    const context = { route: activeRoute, url: version.url };
    try {
      if (callbacks.onPageVersionSelect.current) {
        await callbacks.onPageVersionSelect.current(version, context);
        showNotice(`Opened ${version.label}`);
      } else {
        window.location.assign(version.url);
      }
    } catch {
      showNotice("This page version couldn’t be opened.");
      safeCall(callbacks.onError, {
        code: "page_version_navigation_failed",
        message: "The page version callback did not complete successfully.",
      });
    }
  }, [activeRoute, callbacks.onError, callbacks.onPageVersionSelect, safeCall, showNotice]);

  const carryFeedbackForward = useCallback(async (version) => {
    const annotation = annotationsRef.current.find((item) => item.id === editingIdRef.current);
    if (!annotation || !version?.url || version.current || version.state !== "ready") return;
    if (!callbacks.onFeedbackCarryForward.current) return;
    setCarryingVersionId(version.id);
    try {
      await callbacks.onFeedbackCarryForward.current(
        annotation.payload,
        version,
        { route: activeRoute, url: version.url },
      );
      showNotice(`Comment carried to ${version.label}`);
    } catch {
      showNotice("The comment wasn’t carried forward.");
      safeCall(callbacks.onError, {
        code: "feedback_carry_forward_failed",
        message: "The feedback carry-forward callback did not complete successfully.",
      });
    } finally {
      setCarryingVersionId(null);
    }
  }, [activeRoute, annotationsRef, callbacks.onError, callbacks.onFeedbackCarryForward, editingIdRef, safeCall, showNotice]);

  useEffect(() => {
    if (!portalRoot || !observedLocation) return;
    const url = new URL(observedLocation);
    const id = url.searchParams.get(ANNOTATION_QUERY_PARAM);
    if (!id) {
      deepLinkHandledRef.current = null;
      return;
    }
    const annotation = annotations.find((item) => item.id === id);
    if (!annotation) return;
    const key = `${url.pathname}:${id}`;
    if (deepLinkHandledRef.current === key) return;
    deepLinkHandledRef.current = key;
    returnFocusRef.current = document.activeElement;
    restoreFocusRef.current = false;
    if (modeRef.current === "idle") safeCall(callbacks.onOpenChange, true);
    editAnnotation(id);
  }, [annotations, callbacks.onOpenChange, editAnnotation, modeRef, observedLocation, portalRoot, safeCall]);

  // Undo for a deleted comment (board 07, 23d): it is created again with the same id, text and evidence,
  // back in its old place in the list.
  const restoreAnnotation = useCallback(async (snapshot, index) => {
    if (annotationsRef.current.some((item) => item.id === snapshot.id)) return;
    try {
      const evidence = snapshot.runtime?.evidence || [];
      const accepted = acceptAuthoritative(snapshot.payload, evidence, await callbacks.onFeedbackCreate.current?.(snapshot.payload, { evidence }));
      const restored = { ...snapshot, id: accepted.payload.id, payload: accepted.payload, runtime: { ...snapshot.runtime, evidence: accepted.evidence } };
      setAnnotations((current) => {
        const rest = current.filter((item) => item.id !== restored.id);
        return [...rest.slice(0, index), restored, ...rest.slice(index)];
      });
      showNotice("Comment restored");
    } catch {
      showNotice("Couldn’t bring the comment back. Try again.");
      safeCall(callbacks.onError, { code: "feedback_submit_failed", message: "The feedback callback did not complete successfully." });
    }
  }, [annotationsRef, callbacks.onError, callbacks.onFeedbackCreate, safeCall, showNotice]);

  const removeAnnotation = useCallback(async (id, { undoable = true } = {}) => {
    const annotation = annotationsRef.current.find((item) => item.id === id);
    if (!annotation) return false;
    const index = annotationsRef.current.indexOf(annotation);
    try {
      await callbacks.onFeedbackDelete.current?.(annotation.payload);
    } catch {
      showNotice("Comment wasn’t deleted. Try again.");
      safeCall(callbacks.onError, {
        code: "feedback_delete_failed",
        message: "The feedback delete callback did not complete successfully.",
      });
      return false;
    }
    setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
    setAnnotationRects((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (editingIdRef.current === id) {
      setEditingAnnotationId(null);
      setComment("");
      modeRef.current = "picking";
      setMode("picking");
      emitStatus("selecting");
    }
    if (undoable) showNotice("Comment deleted", { label: "Undo", run: () => restoreAnnotation(annotation, index) });
    else showNotice("Comment removed");
    return true;
  }, [annotationsRef, callbacks.onError, callbacks.onFeedbackDelete, editingIdRef, emitStatus, modeRef, restoreAnnotation, safeCall, showNotice]);

  removeAnnotationRef.current = removeAnnotation;

  const removeReply = useCallback(async (annotationId, replyId) => {
    const annotation = annotationsRef.current.find((item) => item.id === annotationId);
    const replies = annotation?.payload.replies || [];
    if (!annotation || !replies.some((reply) => reply.id === replyId)) return false;
    let payload = createFeedbackPayload({
      ...annotation.payload,
      now: annotation.payload.createdAt,
      updatedAt: new Date().toISOString(),
      replies: replies.filter((reply) => reply.id !== replyId),
      lastEditedBy: normalizedReviewer,
    });
    const context = { evidence: annotation.runtime?.evidence || [] };
    let accepted;
    try {
      accepted = acceptAuthoritative(payload, context.evidence, await callbacks.onFeedbackCreate.current?.(payload, context));
    } catch {
      showNotice("Reply wasn’t removed. Try again.");
      safeCall(callbacks.onError, {
        code: "feedback_delete_failed",
        message: "The reply delete callback did not complete successfully.",
      });
      return false;
    }
    setAnnotations((current) => current.map((item) => mergeAccepted(item, annotationId, accepted)));
    if (replyTarget?.id === replyId) {
      setComposerMode("reply");
      setReplyTarget({ id: accepted.payload.id, name: annotation.payload.author?.displayName || "thread" });
      setComment("");
    }
    showNotice("Reply removed");
    return true;
  }, [annotationsRef, callbacks.onError, callbacks.onFeedbackCreate, normalizedReviewer, replyTarget?.id, safeCall, showNotice]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const removed = pendingDelete.kind === "annotation"
      ? await removeAnnotation(pendingDelete.id)
      : await removeReply(editingIdRef.current, pendingDelete.id);
    setDeleting(false);
    if (removed) setPendingDelete(null);
  }, [deleting, editingIdRef, pendingDelete, removeAnnotation, removeReply]);

  const onToolbarPointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    const toolbar = event.currentTarget.closest(".tm-modebar");
    const bounds = toolbar?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setToolbarDragging(true);
    toolbarDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width,
      height: bounds.height,
    };
  }, []);

  const onToolbarPointerMove = useCallback((event) => {
    const drag = toolbarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setToolbarPosition({
      left: Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX)),
      top: Math.max(8, Math.min(window.innerHeight - drag.height - 8, event.clientY - drag.offsetY)),
    });
  }, []);

  const onToolbarPointerUp = useCallback((event) => {
    const drag = toolbarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    toolbarDragRef.current = null;
    setToolbarDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Capture may already be released. */ }
    // It snaps to the nearest of six places and remembers it (board 09, 29a). A tap without moving keeps it put.
    const moved = Math.abs(event.clientX - (drag.startX ?? event.clientX)) + Math.abs(event.clientY - (drag.startY ?? event.clientY)) > 4;
    if (!moved) return;
    updateBarPrefs({ position: nearestBarPosition(event.clientX, event.clientY, window.innerWidth, window.innerHeight) });
    setToolbarPosition(null);
  }, [updateBarPrefs]);

  useEffect(() => {
    if (!toolbarPosition) return undefined;
    const clampToolbar = () => {
      const toolbar = portalRoot?.querySelector(".tm-modebar");
      const bounds = toolbar?.getBoundingClientRect();
      if (!bounds) return;
      setToolbarPosition((current) => current ? {
        left: Math.max(8, Math.min(window.innerWidth - bounds.width - 8, current.left)),
        top: Math.max(8, Math.min(window.innerHeight - bounds.height - 8, current.top)),
      } : current);
    };
    window.addEventListener("resize", clampToolbar);
    return () => window.removeEventListener("resize", clampToolbar);
  }, [portalRoot, toolbarPosition?.left, toolbarPosition?.top]);

  const startScreenshotSelection = useCallback(() => {
    clearCapture();
    setEditingAnnotationId(null);
    setComment("");
    setNotice("");
    setComposingScreenshot(false);
    modeRef.current = "screenshot-select";
    setMode("screenshot-select");
    emitStatus("selecting");
  }, [clearCapture, emitStatus]);

  const captureScreenshotArea = useCallback(async (rect) => {
    const target = createScreenshotTargetDescriptor(rect, {
      route: sanitizeRoute(route || window.location.pathname || "/"),
    });
    const id = makeId("screenshot");
    const evidenceId = makeId("evidence");
    const draft = {
      id,
      target,
      anchorRect: rect,
      anchorPagePoint: {
        x: rect.left + rect.width + window.scrollX,
        y: rect.top + Math.min(18, rect.height / 2) + window.scrollY,
      },
      strokes: [],
      // 6d: what is under the box, for the composer's "Region · Cards" chip.
      placeLabel: regionPlaceLabel(rect),
      snapshot: {
        status: "capturing",
        approved: false,
        id: evidenceId,
        previewUrl: null,
        metadata: null,
        blob: null,
      },
    };
    setScreenshotSelection(draft);
    modeRef.current = "markup";
    setMode("markup");

    captureControllerRef.current?.abort();
    const controller = new AbortController();
    captureControllerRef.current = controller;
    try {
      const result = await captureRegionSnapshot({
        id: evidenceId,
        region: rect,
        ignoredSelectors,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const previewUrl = URL.createObjectURL(result.blob);
      setScreenshotSelection((current) => {
        if (!current || current.id !== id) {
          URL.revokeObjectURL(previewUrl);
          return current;
        }
        return {
          ...current,
          snapshot: {
            status: "ready",
            approved: false,
            id: evidenceId,
            previewUrl,
            metadata: result.metadata,
            blob: result.blob,
          },
        };
      });
      emitStatus("selected");
      safeCall(callbacks.onTargetSelect, callbackTarget(target));
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") return;
      setScreenshotSelection((current) => current?.id === id ? {
        ...current,
        snapshot: {
          status: "failed",
          approved: false,
          id: evidenceId,
          previewUrl: null,
          metadata: null,
          blob: null,
        },
      } : current);
      safeCall(callbacks.onError, {
        code: "snapshot_capture_failed",
        message: "Threadmark could not prepare the selected screenshot area.",
      });
    }
  }, [callbacks.onError, callbacks.onTargetSelect, clearCapture, emitStatus, ignoredSelectorsKey, route, safeCall]);

  const cancelScreenshotMarkup = useCallback(() => {
    releaseScreenshot();
    modeRef.current = "picking";
    setMode("picking");
    emitStatus("selecting");
    showNotice("Screenshot discarded");
  }, [emitStatus, releaseScreenshot, showNotice]);

  const updateScreenshotStrokes = useCallback((strokes) => {
    setScreenshotSelection((current) => current ? { ...current, strokes } : current);
  }, []);

  const confirmScreenshotMarkup = useCallback(async () => {
    const current = screenshotRef.current;
    if (!current?.snapshot?.blob || current.snapshot.status !== "ready" || composingScreenshot) return;
    const markupGeneration = markupGenerationRef.current + 1;
    markupGenerationRef.current = markupGeneration;
    setComposingScreenshot(true);
    try {
      const result = await composeMarkupSnapshot({
        blob: current.snapshot.blob,
        metadata: current.snapshot.metadata,
        strokes: current.strokes,
      });
      if (markupGeneration !== markupGenerationRef.current) return;
      const previewUrl = URL.createObjectURL(result.blob);
      setScreenshotSelection((selection) => {
        if (!selection || selection.id !== current.id) {
          URL.revokeObjectURL(previewUrl);
          return selection;
        }
        // Keep the unsketched capture so Esc in the composer can go back to drawing (6d).
        if (selection.original) revokePreview(selection);
        return {
          ...selection,
          original: selection.original || {
            previewUrl: selection.snapshot.previewUrl,
            blob: selection.snapshot.blob,
            metadata: selection.snapshot.metadata,
          },
          snapshot: {
            ...selection.snapshot,
            status: "ready",
            approved: true,
            previewUrl,
            blob: result.blob,
            metadata: result.metadata,
          },
        };
      });
      modeRef.current = "selected";
      setMode("selected");
      emitStatus("selected");
    } catch {
      if (markupGeneration !== markupGenerationRef.current) return;
      showNotice("Couldn’t prepare the marked-up screenshot");
      safeCall(callbacks.onError, {
        code: "snapshot_capture_failed",
        message: "Threadmark could not composite the screenshot markup.",
      });
    } finally {
      if (markupGeneration === markupGenerationRef.current) setComposingScreenshot(false);
    }
  }, [callbacks.onError, composingScreenshot, emitStatus, safeCall, screenshotRef, showNotice]);

  // 6d: Esc in the composer goes back to the sketch, strokes and all.
  const backToDrawing = useCallback(() => {
    const current = screenshotRef.current;
    if (!current?.original || modeRef.current !== "selected") return;
    setScreenshotSelection((selection) => {
      if (!selection?.original) return selection;
      revokePreview(selection);
      return {
        ...selection,
        original: null,
        snapshot: { ...selection.snapshot, status: "ready", approved: false, ...selection.original },
      };
    });
    modeRef.current = "markup";
    setMode("markup");
    emitStatus("selected");
  }, [emitStatus, modeRef, screenshotRef]);

  const startInteractionRecording = useCallback(() => {
    clearCapture();
    setEditingAnnotationId(null);
    setComment("");
    setNotice("");
    const startedAtMs = Date.now();
    interactionRecordingRef.current = {
      id: makeId("interaction"),
      startedAt: new Date(startedAtMs).toISOString(),
      startedAtMs,
      events: [],
      targets: [],
      targetKeys: new Map(),
      lastScrollAt: 0,
    };
    setInteractionRecording({ elapsedMs: 0, eventCount: 0 });
    modeRef.current = "recording";
    setMode("recording");
    emitStatus("selecting");
  }, [clearCapture, emitStatus, modeRef]);

  const cancelInteractionRecording = useCallback(() => {
    interactionRecordingRef.current = null;
    setInteractionRecording(null);
    setInteractionSelection(null);
    modeRef.current = "picking";
    setMode("picking");
    emitStatus("selecting");
    showNotice("Interaction recording discarded");
  }, [emitStatus, modeRef, showNotice]);

  const finishInteractionRecording = useCallback(() => {
    const recording = interactionRecordingRef.current;
    if (!recording) return;
    if (!recording.events.length) {
      showNotice("Interact with the page before stopping the recording.");
      return;
    }
    const durationMs = Math.min(
      MAX_INTERACTION_DURATION_MS,
      Math.max(recording.events[recording.events.length - 1]?.offsetMs || 0, Date.now() - recording.startedAtMs),
    );
    const fallbackTarget = createInteractionPageTarget({
      route: sanitizeRoute(route || window.location.pathname || "/"),
    });
    const targetItems = recording.targets.length
      ? recording.targets
      : [{ key: "html", target: fallbackTarget, element: document.documentElement }];
    const primaryItem = [...targetItems].reverse().find((item) => item.element?.isConnected) || targetItems[0];
    const displayRect = rectFromElement(primaryItem.element) || rectFromTarget(primaryItem.target) || {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 1,
      height: 1,
    };
    const selection = {
      id: recording.id,
      targets: targetItems.map((item) => item.target),
      elements: targetItems.map((item) => item.element).filter(Boolean),
      displayRect,
      interaction: {
        version: 1,
        startedAt: recording.startedAt,
        durationMs,
        events: recording.events,
      },
    };
    interactionRecordingRef.current = null;
    setInteractionRecording(null);
    setInteractionSelection(selection);
    setComment("");
    modeRef.current = "selected";
    setMode("selected");
    emitStatus("selected");
    for (const target of selection.targets) safeCall(callbacks.onTargetSelect, callbackTarget(target));
  }, [callbacks.onTargetSelect, emitStatus, modeRef, route, safeCall, showNotice]);

  const refreshVideoPreview = useCallback(async (settings) => {
    const generation = videoPreviewGenerationRef.current + 1;
    videoPreviewGenerationRef.current = generation;
    stopStream(videoPreviewStreamRef.current);
    videoPreviewStreamRef.current = null;
    const wantsMedia = settings.camera || settings.microphone;
    setVideoSetup((current) => current && {
      ...current,
      ...settings,
      previewStream: null,
      status: wantsMedia ? "requesting" : "ready",
      error: "",
    });
    if (!wantsMedia) return;
    try {
      const stream = await openPreviewStream(settings);
      if (generation !== videoPreviewGenerationRef.current) {
        stopStream(stream);
        return;
      }
      videoPreviewStreamRef.current = stream;
      const devices = await listMediaDevices();
      if (generation !== videoPreviewGenerationRef.current) return;
      setVideoSetup((current) => current && {
        ...current,
        previewStream: stream,
        devices,
        cameraDeviceId: stream.getVideoTracks()[0]?.getSettings?.().deviceId || current.cameraDeviceId,
        microphoneDeviceId: stream.getAudioTracks()[0]?.getSettings?.().deviceId || current.microphoneDeviceId,
        status: "ready",
        error: "",
      });
    } catch (error) {
      if (generation !== videoPreviewGenerationRef.current) return;
      setVideoSetup((current) => current && { ...current, status: "error", error: describeMediaError(error, settings) });
    }
  }, []);

  const startVideoSetup = useCallback(() => {
    if (!videoOptions.enabled) return;
    const support = detectVideoSupport(window);
    if (!support.tab && !support.voice) {
      showNotice("This browser can’t record video feedback.");
      return;
    }
    clearCapture();
    setEditingAnnotationId(null);
    setComment("");
    setNotice("");
    const settings = {
      mode: support.tab ? "tab" : "voice",
      camera: true,
      microphone: true,
      cameraDeviceId: "",
      microphoneDeviceId: "",
    };
    setVideoSetup({
      ...settings,
      support,
      devices: { cameras: [], microphones: [] },
      previewStream: null,
      status: "requesting",
      error: "",
    });
    modeRef.current = "video-setup";
    setMode("video-setup");
    emitStatus("selecting");
    refreshVideoPreview(settings);
  }, [clearCapture, emitStatus, modeRef, refreshVideoPreview, showNotice, videoOptions.enabled]);

  const updateVideoSetup = useCallback((patch) => {
    const current = videoSetupRef.current;
    if (!current || modeRef.current !== "video-setup") return;
    const next = { ...current, ...patch };
    const sourcesChanged = ["camera", "microphone", "cameraDeviceId", "microphoneDeviceId"]
      .some((key) => key in patch && patch[key] !== current[key]);
    if (sourcesChanged) {
      refreshVideoPreview({
        mode: next.mode,
        camera: next.camera,
        microphone: next.microphone,
        cameraDeviceId: next.cameraDeviceId,
        microphoneDeviceId: next.microphoneDeviceId,
      });
      return;
    }
    setVideoSetup((value) => value && {
      ...value,
      ...patch,
      error: value.status === "error" ? value.error : "",
    });
  }, [modeRef, refreshVideoPreview, videoSetupRef]);

  const cancelVideoSetup = useCallback(() => {
    releaseVideo();
    modeRef.current = "picking";
    setMode("picking");
    emitStatus("selecting");
  }, [emitStatus, modeRef, releaseVideo]);

  // Resolves true when the count reaches zero, false when Esc cancels it.
  const runVideoCountdown = useCallback((seconds) => new Promise((resolve) => {
    let left = seconds;
    setVideoCountdown(left);
    let timer = null;
    const finish = (finished) => {
      clearInterval(timer);
      videoCountdownCancelRef.current = null;
      setVideoCountdown(null);
      resolve(finished);
    };
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) finish(true);
      else setVideoCountdown(left);
    }, 1000);
    videoCountdownCancelRef.current = () => finish(false);
  }), []);
  const cancelVideoCountdown = useCallback(() => { videoCountdownCancelRef.current?.(); }, []);

  const beginVideoRecording = useCallback(async () => {
    const setup = videoSetupRef.current;
    if (!setup || modeRef.current !== "video-setup" || ["requesting", "starting", "error"].includes(setup.status)) return;
    const generation = videoPreviewGenerationRef.current;
    setVideoSetup((current) => current && { ...current, status: "starting", error: "" });
    let displayStream = null;
    if (setup.mode === "tab") {
      try {
        displayStream = await openTabStream();
      } catch (error) {
        if (generation !== videoPreviewGenerationRef.current || modeRef.current !== "video-setup") return;
        const declined = error?.name === "NotAllowedError";
        // Tab capture is a privilege the reviewer can refuse; voice + cursor still records the review.
        setVideoSetup((current) => current && {
          ...current,
          mode: current.support.voice ? "voice" : current.mode,
          status: "ready",
          error: declined
            ? "Tab sharing was declined. Record voice and cursor instead, or choose This tab to try again."
            : "This tab couldn’t be captured here. Record voice and cursor instead.",
        });
        return;
      }
    }
    if (generation !== videoPreviewGenerationRef.current || modeRef.current !== "video-setup") {
      stopStream(displayStream);
      return;
    }
    // The tab is already shared, so what the reviewer sees during the count is what will be recorded.
    if (videoOptions.countdownSeconds > 0) {
      setVideoSetup((current) => current && { ...current, status: "countdown" });
      const finished = await runVideoCountdown(videoOptions.countdownSeconds);
      const current = generation === videoPreviewGenerationRef.current && modeRef.current === "video-setup";
      if (!finished || !current) {
        stopStream(displayStream);
        if (current) setVideoSetup((value) => value && { ...value, status: "ready", error: "" });
        return;
      }
    }
    const preview = videoPreviewStreamRef.current;
    const audioTracks = setup.microphone ? preview?.getAudioTracks?.() || [] : [];
    const cameraTracks = setup.camera ? preview?.getVideoTracks?.() || [] : [];
    const videoTracks = displayStream ? displayStream.getVideoTracks() : cameraTracks;
    if (!videoTracks.length && !audioTracks.length) {
      stopStream(displayStream);
      setVideoSetup((current) => current && { ...current, status: "ready", error: "Turn on the microphone or camera to record." });
      return;
    }
    const session = {
      kind: "video",
      id: makeId("video"),
      evidenceId: makeId("evidence"),
      mode: displayStream ? "tab" : "voice",
      camera: cameraTracks.length > 0,
      microphone: audioTracks.length > 0,
      hasVideo: videoTracks.length > 0,
      hasAudio: audioTracks.length > 0,
      startedAt: new Date().toISOString(),
      clock: createRecordingClock(),
      maxDurationMs: videoOptions.maxDurationMs,
      maxEvents: MAX_VIDEO_EVENTS,
      events: [],
      drawings: [],
      moments: [],
      targets: [],
      targetKeys: new Map(),
      lastScrollAt: 0,
      pointer: createPointerTrack({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      }),
      displayStream,
      recorder: null,
      finishing: false,
    };
    try {
      session.recorder = createRecorderSession({
        stream: new MediaStream([...videoTracks, ...audioTracks]),
        hasVideo: session.hasVideo,
        hasAudio: session.hasAudio,
        videoBitsPerSecond: displayStream ? TAB_VIDEO_BITS_PER_SECOND : CAMERA_VIDEO_BITS_PER_SECOND,
        onUnexpectedStop: () => {
          if (videoSessionRef.current === session) finishVideoRecordingRef.current?.();
        },
      });
    } catch {
      stopStream(displayStream);
      setVideoSetup((current) => current && { ...current, status: "ready", error: "This browser couldn’t start the recorder." });
      safeCall(callbacks.onError, {
        code: "video_capture_failed",
        message: "Threadmark could not start the video recorder.",
      });
      return;
    }
    // The browser's own "Stop sharing" control ends the tab track; keep what was recorded.
    displayStream?.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (videoSessionRef.current === session) finishVideoRecordingRef.current?.();
    }, { once: true });
    videoSessionRef.current = session;
    setVideoSetup((current) => current && { ...current, status: "recording", error: "" });
    setVideoRecordingState({
      elapsedMs: 0,
      paused: false,
      finishing: false,
      eventCount: 0,
      moments: 0,
      lastMomentMs: null,
      mode: session.mode,
      maxDurationMs: session.maxDurationMs,
      microphone: session.microphone,
      camera: session.camera,
      microphoneOn: true,
      cameraOn: true,
    });
    modeRef.current = "video-recording";
    setMode("video-recording");
  }, [callbacks.onError, modeRef, runVideoCountdown, safeCall, videoOptions.countdownSeconds, videoOptions.maxDurationMs, videoSetupRef]);

  // Mute the microphone or turn the camera off mid-recording without stopping (7d). The recorder keeps
  // the same tracks, so the video carries silence or a still frame for that stretch.
  const toggleVideoSource = useCallback((kind) => {
    const session = videoSessionRef.current;
    if (!session || session.finishing) return;
    const preview = videoPreviewStreamRef.current;
    const tracks = kind === "microphone" ? preview?.getAudioTracks?.() || [] : preview?.getVideoTracks?.() || [];
    if (!tracks.length) return;
    const next = !tracks[0].enabled;
    for (const track of tracks) track.enabled = next;
    setVideoRecordingState((current) => current && { ...current, [kind === "microphone" ? "microphoneOn" : "cameraOn"]: next });
  }, []);

  // M marks a moment worth talking about later; moments become ticks on the trim bar and chapters.
  const markVideoMoment = useCallback(() => {
    const session = videoSessionRef.current;
    if (!session || session.finishing || session.clock.paused || session.moments.length >= 50) return;
    const offsetMs = session.clock.elapsed();
    session.moments.push({ offsetMs });
    setVideoRecordingState((current) => current && { ...current, moments: session.moments.length, lastMomentMs: offsetMs });
  }, []);

  const toggleVideoPause = useCallback(() => {
    const session = videoSessionRef.current;
    if (!session || session.finishing) return;
    if (session.clock.paused) {
      session.clock.resume();
      session.recorder.resume();
    } else {
      session.clock.pause();
      session.recorder.pause();
    }
    setVideoRecordingState((current) => current && {
      ...current,
      paused: session.clock.paused,
      elapsedMs: session.clock.elapsed(),
    });
  }, []);

  // Choosing what to blur pauses the recording (so the choosing isn't in the video) and resumes it after.
  const chooseVideoTool = useCallback((tool) => {
    const session = videoSessionRef.current;
    if (tool === "blur" && session && !session.finishing && !session.clock.paused) {
      toggleVideoPause();
      blurPausedRef.current = true;
    } else if (tool !== "blur" && blurPausedRef.current) {
      blurPausedRef.current = false;
      if (session && !session.finishing && session.clock.paused) toggleVideoPause();
    }
    setVideoTool(tool || null);
  }, [toggleVideoPause]);

  const toggleVideoBlur = useCallback((element) => {
    setVideoBlurred((current) => (current.includes(element) ? current.filter((item) => item !== element) : [...current.slice(-59), element]));
  }, []);

  // A finished stroke, placed where it started in the recording, so voice recordings can replay it.
  const recordVideoStroke = useCallback(({ points, durationMs }) => {
    const session = videoSessionRef.current;
    if (!session || session.finishing || session.clock.paused || session.drawings.length >= 100) return;
    session.drawings.push({ offsetMs: Math.max(0, session.clock.elapsed() - durationMs), points });
  }, []);

  const discardVideoRecording = useCallback(() => {
    releaseVideo();
    modeRef.current = "picking";
    setMode("picking");
    emitStatus("selecting");
    showNotice("Video deleted");
  }, [emitStatus, modeRef, releaseVideo, showNotice]);

  const finishVideoRecording = useCallback(async () => {
    const session = videoSessionRef.current;
    if (!session || session.finishing) return;
    session.finishing = true;
    setVideoTool(null);
    blurPausedRef.current = false;
    const elapsedMs = Math.min(session.maxDurationMs, session.clock.elapsed());
    session.clock.pause();
    setVideoRecordingState((current) => current && { ...current, elapsedMs, paused: false, finishing: true });
    let blob = null;
    try {
      blob = await session.recorder.stop();
    } catch {
      blob = null;
    }
    stopStream(session.displayStream);
    if (videoSessionRef.current !== session) return;
    videoPreviewGenerationRef.current += 1;
    stopStream(videoPreviewStreamRef.current);
    videoPreviewStreamRef.current = null;
    const media = blob?.size ? await readRecordingMetadata(blob, { fallbackDurationMs: elapsedMs }) : null;
    if (videoSessionRef.current !== session) return;
    videoSessionRef.current = null;
    setVideoSetup(null);
    setVideoRecordingState(null);
    if (!blob?.size || !media) {
      modeRef.current = "picking";
      setMode("picking");
      emitStatus("selecting");
      showNotice("Nothing was recorded. Try again.");
      safeCall(callbacks.onError, {
        code: "video_capture_failed",
        message: "The video recorder produced no data.",
      });
      return;
    }
    const durationMs = Math.max(1, Math.min(session.maxDurationMs, media.durationMs || elapsedMs));
    const fallbackTarget = createInteractionPageTarget({
      route: sanitizeRoute(route || window.location.pathname || "/"),
    });
    const targetItems = session.targets.length
      ? session.targets
      : [{ key: "html", target: fallbackTarget, element: document.documentElement }];
    const primaryItem = [...targetItems].reverse().find((item) => item.element?.isConnected && item.key !== "html");
    const displayRect = rectFromElement(primaryItem?.element) || {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 1,
      height: 1,
    };
    const selection = {
      id: session.id,
      targets: targetItems.map((item) => item.target),
      elements: targetItems.map((item) => item.element).filter(Boolean),
      displayRect,
      video: {
        version: 1,
        mode: session.mode,
        startedAt: session.startedAt,
        durationMs,
        evidenceId: session.evidenceId,
        camera: session.camera,
        microphone: session.microphone,
        viewport: session.pointer.viewport,
        pointer: { samples: session.pointer.samples, scrolls: session.pointer.scrolls },
        events: session.events,
        pauses: session.clock.pauses,
        drawings: session.drawings,
        moments: session.moments,
      },
      evidence: {
        id: session.evidenceId,
        blob,
        metadata: {
          id: session.evidenceId,
          kind: "recording",
          source: "media-recorder",
          quality: "captured",
          mimeType: blob.type,
          byteSize: blob.size,
          durationMs,
          pixelSize: { width: media.width, height: media.height },
          hasAudio: session.hasAudio,
          hasVideo: blob.type.startsWith("video/"),
        },
      },
    };
    setVideoSelection(selection);
    setVideoReview({
      id: session.id,
      title: suggestVideoTitle(document.title, sanitizeRoute(route || window.location.pathname || "/")),
      startMs: 0,
      endMs: durationMs,
      element: primaryItem?.element || null,
    });
    setComment("");
    modeRef.current = "selected";
    setMode("selected");
    emitStatus("selected");
    for (const target of selection.targets) safeCall(callbacks.onTargetSelect, callbackTarget(target));
  }, [callbacks.onError, callbacks.onTargetSelect, emitStatus, modeRef, route, safeCall, showNotice]);
  finishVideoRecordingRef.current = finishVideoRecording;

  // One listener set serves both the 15-second interaction trace and video recordings, so video keeps
  // the same privacy-safe step timeline: no input values and no printable keystrokes.
  useEffect(() => {
    const videoMode = mode === "video-recording";
    if ((mode !== "recording" && !videoMode) || !shadowHost) return undefined;

    const activeRecording = () => (videoMode ? videoSessionRef.current : interactionRecordingRef.current);
    const elapsedFor = (recording) => (recording.clock ? recording.clock.elapsed() : Date.now() - recording.startedAtMs);
    const maxDurationFor = (recording) => recording.maxDurationMs || MAX_INTERACTION_DURATION_MS;
    const maxEventsFor = (recording) => recording.maxEvents || MAX_INTERACTION_EVENTS;
    const capturing = (recording) => Boolean(recording && !recording.finishing && !recording.clock?.paused);
    const publish = (recording, elapsedMs) => {
      if (!videoMode) {
        setInteractionRecording({ elapsedMs, eventCount: recording.events.length });
        return;
      }
      setVideoRecordingState((current) => (
        !current
        || (current.eventCount === recording.events.length && Math.floor(current.elapsedMs / 1000) === Math.floor(elapsedMs / 1000))
          ? current
          : { ...current, elapsedMs, eventCount: recording.events.length }
      ));
    };
    const isOverlayEvent = (event) => event.composedPath?.().includes(shadowHost);
    const registerTarget = (rawTarget) => {
      const recording = activeRecording();
      if (!recording || !rawTarget?.closest) return undefined;
      const element = findSelectableTarget(rawTarget, shadowHost, ignoredSelectors);
      if (!element) return undefined;
      const target = createTargetDescriptor(element, {
        route: sanitizeRoute(route || window.location.pathname || "/"),
        ignoredSelectors,
      });
      const key = interactionTargetKey(target);
      if (recording.targetKeys.has(key)) return recording.targetKeys.get(key);
      if (recording.targets.length >= MAX_INTERACTION_TARGETS) return undefined;
      const index = recording.targets.length;
      recording.targets.push({ key, target, element });
      recording.targetKeys.set(key, index);
      return index;
    };
    const appendEvent = (type, event, detail = {}) => {
      const recording = activeRecording();
      if (!capturing(recording) || recording.events.length >= maxEventsFor(recording) || isOverlayEvent(event)) return;
      const targetIndex = detail.targetIndex ?? registerTarget(event.target);
      const item = {
        type,
        offsetMs: Math.min(maxDurationFor(recording), Math.max(0, elapsedFor(recording))),
        ...(targetIndex == null ? {} : { targetIndex }),
        ...detail,
      };
      const previous = recording.events[recording.events.length - 1];
      if (
        type === "input"
        && previous?.type === "input"
        && previous.targetIndex === item.targetIndex
      ) {
        previous.offsetMs = item.offsetMs;
        previous.inputType = item.inputType;
        publish(recording, item.offsetMs);
        return;
      }
      recording.events.push(item);
      publish(recording, item.offsetMs);
      // A video keeps recording after the step limit; only the 15-second trace ends there.
      if (!videoMode && recording.events.length >= maxEventsFor(recording)) finishInteractionRecording();
    };
    const onClick = (event) => appendEvent("click", event, {
      button: Math.max(0, Number(event.button) || 0),
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
    });
    const onInput = (event) => {
      const element = event.target;
      const rawType = element?.tagName?.toLowerCase() === "select"
        ? "select"
        : element?.type || element?.inputMode || "text";
      appendEvent("input", event, { inputType: String(rawType).slice(0, 40) });
    };
    const onKeyDown = (event) => {
      if (!INTERACTION_COMMAND_KEYS.has(event.key) || event.key === "Escape") return;
      // Space and multi-line Enter are text inside editable fields; recording them would leak word and line counts.
      const origin = event.composedPath?.()[0] || event.target;
      if (isTypingTarget(origin)) {
        const multiline = origin?.closest?.("textarea, [contenteditable]:not([contenteditable='false'])");
        if (event.key === " " || (event.key === "Enter" && multiline)) return;
      }
      appendEvent("keydown", event, {
        key: event.key,
        modifiers: [
          event.altKey && "alt",
          event.ctrlKey && "control",
          event.metaKey && "meta",
          event.shiftKey && "shift",
        ].filter(Boolean),
      });
    };
    const onScroll = (event) => {
      const recording = activeRecording();
      if (!capturing(recording)) return;
      if (videoMode && (event.target === document || event.target === document.documentElement)) {
        appendScrollSample(recording.pointer, elapsedFor(recording), window.scrollX, window.scrollY);
      }
      const now = Date.now();
      if (now - recording.lastScrollAt < 180) return;
      recording.lastScrollAt = now;
      const element = event.target === document ? null : event.target;
      const targetIndex = element ? registerTarget(element) : undefined;
      appendEvent("scroll", event, {
        ...(targetIndex == null ? {} : { targetIndex }),
        scrollX: Math.round(element?.scrollLeft ?? window.scrollX),
        scrollY: Math.round(element?.scrollTop ?? window.scrollY),
      });
    };
    const onSubmit = (event) => appendEvent("submit", event);
    // One move can fire popstate, hashchange and navigatesuccess together: record it once per address.
    let lastHref = window.location.href;
    const onNavigation = () => {
      if (window.location.href === lastHref) return;
      lastHref = window.location.href;
      appendEvent("navigation", { target: document.documentElement, composedPath: () => [] }, {
        route: sanitizeRoute(window.location.pathname || "/"),
      });
    };
    // The pointer path is what a voice + cursor recording replays, and what an agent reads to follow a tab video.
    const onPointer = (event) => {
      const recording = activeRecording();
      if (!videoMode || !capturing(recording)) return;
      appendPointerSample(recording.pointer, elapsedFor(recording), event.clientX, event.clientY, {
        force: event.type === "pointerdown",
      });
    };
    const timer = setInterval(() => {
      const recording = activeRecording();
      if (!recording || recording.finishing) return;
      const elapsedMs = Math.min(maxDurationFor(recording), elapsedFor(recording));
      publish(recording, elapsedMs);
      if (elapsedMs < maxDurationFor(recording)) return;
      if (videoMode) finishVideoRecording();
      else if (recording.events.length) finishInteractionRecording();
      else cancelInteractionRecording();
    }, videoMode ? 250 : 100);

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("submit", onSubmit, true);
    if (videoMode) {
      document.addEventListener("pointermove", onPointer, { capture: true, passive: true });
      document.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
    }
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("hashchange", onNavigation);
    window.navigation?.addEventListener?.("navigatesuccess", onNavigation);
    return () => {
      clearInterval(timer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("pointermove", onPointer, { capture: true });
      document.removeEventListener("pointerdown", onPointer, { capture: true });
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("hashchange", onNavigation);
      window.navigation?.removeEventListener?.("navigatesuccess", onNavigation);
    };
  }, [cancelInteractionRecording, finishInteractionRecording, finishVideoRecording, ignoredSelectorsKey, mode, route, shadowHost]);

  useEffect(() => {
    if (!portalRoot) return undefined;
    const onKeyDown = (event) => {
      const action = shortcutAction(event);
      if (!action) return;
      // A running video belongs to the reviewer's walkthrough: host keys pass through, and only the
      // recorder controls can stop or discard it.
      if (mode === "video-recording") return;
      if (action === "toggle") {
        event.preventDefault();
        // A bar hidden on this page comes back with the same keys (board 09, 29c).
        if (hiddenPages.includes(activeRoute)) {
          const next = hiddenPages.filter((page) => page !== activeRoute);
          setHiddenPages(next);
          writeHiddenPages(next);
        }
        if (mode === "idle") startReview();
        else closeReview();
        return;
      }
      if (action === "shrink") {
        event.preventDefault();
        updateBarPrefs({ shrunk: !barPrefs.shrunk });
        if (!barPrefs.shrunk && mode !== "idle" && mode !== "video-recording") closeReview();
        return;
      }
      if (action === "shortcuts") {
        if (mode === "video-recording" || mode === "recording") return;
        event.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }
      if (action === "escape" && shortcutsOpen) {
        event.preventDefault();
        setShortcutsOpen(false);
        return;
      }
      // An open @mention list or menu handles its own Escape.
      if (action === "escape" && event.composedPath?.().some((node) => node?.dataset?.mentionOpen === "true" || node?.dataset?.menuOpen === "true")) return;
      // During a preview the tour card owns Escape.
      if (mode === "tour-preview") return;
      if (action === "escape" && mode !== "idle") {
        event.preventDefault();
        if (!submitting) {
          if (mode === "tour") exitTourMode();
          else if (allCommentsOpen && mode === "picking") {
            setAllCommentsOpen(false);
            portalRoot.querySelector(".tm-all-comments-trigger")?.focus();
          }
          else if (mode === "recording") cancelInteractionRecording();
          else if (mode === "video-setup") cancelVideoSetup();
          else if (mode === "markup" || mode === "screenshot-select") cancelScreenshotMarkup();
          else if (mode === "selected" && discardPending) setDiscardPending(false);
          else if (mode === "selected") requestDismiss();
          else closeReview();
        }
        return;
      }
      if (mode === "idle") return;
      if (mode === "recording" || mode === "video-setup" || mode === "tour") return;
      // Tool keys switch away from Comment only from the toolbar's own state; anywhere else they
      // belong to the open composer or capture and pass through.
      if (["comment", "sketch", "interaction", "video"].includes(action)) {
        if (mode !== "picking" || (action === "video" && !videoOptions.enabled)) return;
        event.preventDefault();
        if (action === "sketch") startScreenshotSelection();
        if (action === "interaction") startInteractionRecording();
        if (action === "video") startVideoSetup();
        return;
      }
      event.preventDefault();
      if (action === "pause") togglePause();
      if (action === "visibility") toggleMarkers();
      if (action === "copy") copyAnnotations();
      if (action === "clear") requestClearAll();
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [
    hiddenPages,
    activeRoute,
    barPrefs.shrunk,
    updateBarPrefs,
    shortcutsOpen,
    portalRoot,
    mode,
    submitting,
    startReview,
    closeReview,
    requestDismiss,
    discardPending,
    cancelInteractionRecording,
    cancelVideoSetup,
    cancelScreenshotMarkup,
    togglePause,
    toggleMarkers,
    copyAnnotations,
    requestClearAll,
    startScreenshotSelection,
    startInteractionRecording,
    startVideoSetup,
    videoOptions.enabled,
    allCommentsOpen,
    exitTourMode,
  ]);

  useEffect(() => {
    if (!paused || !portalRoot) return undefined;
    return pausePage(document, { nonce: styleNonce });
  }, [paused, portalRoot, styleNonce]);

  useEffect(() => {
    if ((mode !== "markup" && mode !== "screenshot-select") || !shadowHost) return undefined;
    const containPageScroll = (event) => {
      if (!event.composedPath?.().includes(shadowHost)) event.preventDefault();
    };
    document.addEventListener("wheel", containPageScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", containPageScroll, { capture: true, passive: false });
    return () => {
      document.removeEventListener("wheel", containPageScroll, true);
      document.removeEventListener("touchmove", containPageScroll, true);
    };
  }, [mode, shadowHost]);

  useEffect(() => {
    if (!portalRoot) return undefined;
    const onSuppressedKeyUp = (event) => {
      const suppressed = suppressedKeyRef.current;
      if (!suppressed || event.key !== suppressed.key) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      suppressedKeyRef.current = null;
    };
    document.addEventListener("keyup", onSuppressedKeyUp, true);
    return () => document.removeEventListener("keyup", onSuppressedKeyUp, true);
  }, [portalRoot]);

  useEffect(() => {
    if (!selections.length && !hoverElement) return undefined;
    const refresh = () => {
      const connected = selections.filter((selection) => selection.element.isConnected);
      if (connected.length !== selections.length) {
        setSelections(connected);
        if (modeRef.current === "selected" && (connected.length === 0 || (selections.length > 1 && connected.length < 2))) {
          modeRef.current = "picking";
          setMode("picking");
          emitStatus("selecting");
        }
      }
      setSelectionRects(Object.fromEntries(connected.map((selection) => [selection.id, rectFromElement(selection.element)])));
      if (hoverElement) setHoverRect(rectFromElement(hoverElement));
    };

    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, { capture: true, passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(refresh) : null;
    for (const selection of selections) observer?.observe(selection.element);
    if (hoverElement) observer?.observe(hoverElement);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
      observer?.disconnect();
    };
  }, [emitStatus, hoverElement, modeRef, selections]);

  useEffect(() => {
    if (!textSelection) return undefined;
    const refresh = () => {
      const rect = rectFromRange(textSelection.range);
      if (!rect) {
        setTextSelection(null);
        if (modeRef.current === "selected") {
          modeRef.current = "picking";
          setMode("picking");
          emitStatus("selecting");
        }
        return;
      }
      setTextSelection((current) => current ? { ...current, displayRect: rect } : current);
    };
    window.addEventListener("scroll", refresh, { capture: true, passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [emitStatus, modeRef, textSelection?.id]);

  useEffect(() => {
    if (!regionSelection) return undefined;
    const refresh = () => {
      setRegionSelection((current) => current ? {
        ...current,
        displayRect: {
          left: current.target.pageBounds.x - window.scrollX,
          top: current.target.pageBounds.y - window.scrollY,
          width: current.target.pageBounds.width,
          height: current.target.pageBounds.height,
        },
      } : current);
    };
    window.addEventListener("scroll", refresh, { capture: true, passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [Boolean(regionSelection)]);

  useEffect(() => {
    if (!screenshotSelection || mode === "markup") return undefined;
    const refresh = () => {
      setScreenshotSelection((current) => current ? {
        ...current,
        anchorRect: {
          left: current.target.pageBounds.x - window.scrollX,
          top: current.target.pageBounds.y - window.scrollY,
          width: current.target.pageBounds.width,
          height: current.target.pageBounds.height,
        },
      } : current);
    };
    window.addEventListener("scroll", refresh, { capture: true, passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [mode, screenshotSelection?.id]);

  useEffect(() => {
    if (!videoSelection) return undefined;
    const refresh = () => {
      setVideoSelection((current) => {
        if (!current) return current;
        const element = [...current.elements].reverse()
          .find((item) => item?.isConnected && item !== document.documentElement);
        const displayRect = rectFromElement(element);
        return displayRect ? { ...current, displayRect } : current;
      });
    };
    window.addEventListener("scroll", refresh, { capture: true, passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [videoSelection?.id]);

  useEffect(() => {
    if (!interactionSelection) return undefined;
    const refresh = () => {
      setInteractionSelection((current) => {
        if (!current) return current;
        const element = [...current.elements].reverse().find((item) => item?.isConnected);
        const target = current.targets[current.targets.length - 1];
        const displayRect = rectFromElement(element) || rectFromTarget(target) || current.displayRect;
        return { ...current, displayRect };
      });
    };
    window.addEventListener("scroll", refresh, { capture: true, passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [interactionSelection?.id]);

  useEffect(() => {
    if (mode === "idle" || !portalRoot) return;
    let cancelled = false;
    import("./fonts.js").then(module => { if (!cancelled) module.registerThreadmarkFonts(); }).catch(() => {});
    return () => { cancelled = true; };
  }, [mode === "idle", portalRoot]);

  // Keep the scheduler alive across host polling and comment additions. Only changed revisions match again.
  const restorationKey = JSON.stringify(annotations.map(item => [item.id, item.payload.updatedAt]));
  useEffect(() => {
    const scheduler = createRestorationScheduler({
      ignoredSelectors,
      initiallyActive: false,
      onPositions: results => markerPositions.update(results),
      assess: (annotation, context, deferSuggestions) => assessAnnotation(annotation, ignoredSelectors, buildId, context, deferSuggestions),
      suggest: (annotation, result, context) => suggestAnnotation(annotation, result, ignoredSelectors, context),
      position: positionRestoration,
      onChange: (results) => {
        markerPositions.update(results);
        const rects = Object.fromEntries(Object.entries(results).filter(([, result]) => result.rect)
          .map(([id, result]) => [id, result.rect]));
        // An unchanged page keeps the same state objects, so the overlay doesn't re-render for nothing.
        setAnnotationRestorations((current) => (sameRestorations(current, results) ? current : results));
        setAnnotationRects((current) => (sameRects(current, rects) ? current : rects));
        setObservedLocation(current => current === window.location.href ? current : window.location.href);
      },
    });
    restorationSchedulerRef.current = scheduler;
    scheduler.update(annotationsRef.current);
    return () => { scheduler.dispose(); restorationSchedulerRef.current = null; };
  }, [ignoredSelectorsKey, buildId]);

  useEffect(() => {
    restorationSchedulerRef.current?.update(annotationsRef.current);
  }, [restorationKey]);

  useEffect(() => {
    restorationSchedulerRef.current?.setActive(Boolean(portalRoot) && mode !== "idle");
  }, [mode, portalRoot, ignoredSelectorsKey, buildId]);

  const captureSnapshot = useCallback(async (selection) => {
    captureControllerRef.current?.abort();
    const controller = new AbortController();
    captureControllerRef.current = controller;
    const evidenceId = makeId("evidence");

    setRegionSelection((current) => {
      revokePreview(current);
      return current ? {
        ...current,
        snapshot: { status: "capturing", approved: false, id: evidenceId, previewUrl: null, metadata: null, blob: null },
      } : current;
    });

    try {
      const result = await captureRegionSnapshot({
        id: evidenceId,
        region: selection.displayRect,
        ignoredSelectors,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const previewUrl = URL.createObjectURL(result.blob);
      setRegionSelection((current) => current ? {
        ...current,
        snapshot: {
          status: "ready",
          // Masked snapshots are always attached; reviewers are not asked to approve each one.
          approved: true,
          id: evidenceId,
          previewUrl,
          metadata: result.metadata,
          blob: result.blob,
        },
      } : current);
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") return;
      const unavailable = {
        id: evidenceId,
        kind: "snapshot",
        source: "dom-renderer",
        quality: "unavailable",
        mimeType: null,
        byteSize: 0,
        pixelSize: { width: 0, height: 0 },
        redactionCount: 0,
        warnings: ["capture_failed"],
      };
      setRegionSelection((current) => current ? {
        ...current,
        snapshot: { status: "failed", approved: false, id: evidenceId, previewUrl: null, metadata: unavailable, blob: null },
      } : current);
      safeCall(callbacks.onError, {
        code: "snapshot_capture_failed",
        message: "Threadmark could not render this region. Text-only feedback is still available.",
      });
    }
  }, [callbacks.onError, ignoredSelectorsKey, safeCall]);

  const retrySnapshot = useCallback(() => {
    const current = regionRef.current;
    if (!current) return;
    const displayRect = {
      left: current.target.pageBounds.x - window.scrollX,
      top: current.target.pageBounds.y - window.scrollY,
      width: current.target.pageBounds.width,
      height: current.target.pageBounds.height,
    };
    const fullyVisible = displayRect.left >= 0
      && displayRect.top >= 0
      && displayRect.left + displayRect.width <= window.innerWidth
      && displayRect.top + displayRect.height <= window.innerHeight;
    if (!fullyVisible) {
      setNotice("Scroll until the whole saved region is visible, then retry.");
      return;
    }
    captureSnapshot({ ...current, displayRect });
  }, [captureSnapshot, regionRef]);

  const finishRegion = useCallback((rect) => {
    if (rect.width < MIN_REGION_SIZE || rect.height < MIN_REGION_SIZE) {
      setNotice(`Draw a region at least ${MIN_REGION_SIZE} × ${MIN_REGION_SIZE}px.`);
      return;
    }
    releaseRegion();
    setSelections([]);
    setSelectionRects({});
    setTextSelection(null);
    const target = createRegionTargetDescriptor(rect, {
      route: sanitizeRoute(route || window.location.pathname || "/"),
    });
    const selection = {
      id: makeId("region"),
      target,
      displayRect: rect,
      snapshot: { status: "capturing", approved: false, id: null, previewUrl: null, metadata: null, blob: null },
    };
    setRegionSelection(selection);
    setComment("");
    modeRef.current = "selected";
    setMode("selected");
    setNotice("");
    emitStatus("selected");
    safeCall(callbacks.onTargetSelect, callbackTarget(target));
    captureSnapshot(selection);
  }, [callbacks.onTargetSelect, captureSnapshot, emitStatus, releaseRegion, route, safeCall]);

  useEffect(() => {
    if (mode !== "picking" || !shadowHost) return undefined;
    let animationFrame = null;

    const isOverlayEvent = (event) => event.composedPath?.().includes(shadowHost);

    const pointTouchesText = (x, y, rawTarget) => {
      let node = null;
      if (typeof document.caretPositionFromPoint === "function") {
        node = document.caretPositionFromPoint(x, y)?.offsetNode;
      } else if (typeof document.caretRangeFromPoint === "function") {
        node = document.caretRangeFromPoint(x, y)?.startContainer;
      }
      if (node?.nodeType === 3 && /\S/.test(node.nodeValue || "")) return true;
      const textElement = rawTarget?.closest?.("p,h1,h2,h3,h4,h5,h6,span,strong,em,small,li,blockquote,label,code,pre");
      if (!textElement || !/\S/.test(textElement.textContent || "")) return false;
      return textElement.ownerDocument.defaultView.getComputedStyle(textElement).userSelect !== "none";
    };

    const showCandidate = (candidate) => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        setHoverElement(candidate);
        setHoverRect(rectFromElement(candidate));
      });
    };

    const selectElement = (candidate, additive = false) => {
      if (!candidate) return;
      if (repinningId) additive = false;
      const descriptor = createTargetDescriptor(candidate, {
        route: sanitizeRoute(route || window.location.pathname || "/"),
        ignoredSelectors,
      });
      releaseRegion();
      setTextSelection(null);

      if (additive) {
        const current = selectionsRef.current;
        const existing = current.findIndex((selection) => selection.element === candidate);
        let next;
        if (existing >= 0) {
          next = current.filter((_, index) => index !== existing);
        } else {
          if (current.length >= MAX_MULTI_TARGETS) {
            showNotice(`Multi-select supports up to ${MAX_MULTI_TARGETS} elements.`);
            return;
          }
          next = [...current, { id: makeId("target"), element: candidate, target: descriptor }];
          safeCall(callbacks.onTargetSelect, callbackTarget(descriptor));
        }
        setSelections(next);
        setSelectionRects(Object.fromEntries(next.map((selection) => [selection.id, rectFromElement(selection.element)])));
        setComment("");
        setNotice("");
        emitStatus("selecting");
        return;
      }

      const selection = { id: makeId("target"), element: candidate, target: descriptor };
      setSelections([selection]);
      setSelectionRects({ [selection.id]: rectFromElement(candidate) });
      setComment("");
      modeRef.current = "selected";
      setMode("selected");
      setHoverElement(null);
      setHoverRect(null);
      emitStatus("selected");
      safeCall(callbacks.onTargetSelect, callbackTarget(descriptor));
    };

    const selectText = () => {
      if (repinningId) return false;
      const nativeSelection = window.getSelection();
      if (!nativeSelection || nativeSelection.rangeCount === 0 || nativeSelection.isCollapsed) return false;
      const range = nativeSelection.getRangeAt(0).cloneRange();
      const descriptor = createTextTargetDescriptor(range, {
        route: sanitizeRoute(route || window.location.pathname || "/"),
        ignoredSelectors,
        shadowHost,
      });
      if (!descriptor) {
        showNotice("That text can’t be annotated because it is protected or unavailable.");
        return false;
      }
      releaseRegion();
      setSelections([]);
      setSelectionRects({});
      setTextSelection({
        id: makeId("text"),
        target: descriptor,
        range,
        displayRect: rectFromRange(range),
      });
      setComment("");
      modeRef.current = "selected";
      setMode("selected");
      setHoverElement(null);
      setHoverRect(null);
      emitStatus("selected");
      safeCall(callbacks.onTargetSelect, callbackTarget(descriptor));
      return true;
    };

    const selectMarquee = (rect) => {
      if (repinningId) { showNotice("Click one element to repin this comment."); return; }
      const elements = findMarqueeTargets(rect, {
        documentRef: document,
        shadowHost,
        ignoredSelectors,
        maxTargets: MAX_MULTI_TARGETS,
      });
      if (elements.length > MAX_MULTI_TARGETS) {
        setDrawRect(null);
        showNotice(`That area contains more than ${MAX_MULTI_TARGETS} targets. Draw a smaller selection.`);
        return;
      }
      if (!elements.length) {
        finishRegion(rect);
        return;
      }
      releaseRegion();
      setTextSelection(null);
      const next = elements.map((element) => ({
        id: makeId("target"),
        element,
        target: createTargetDescriptor(element, {
          route: sanitizeRoute(route || window.location.pathname || "/"),
          ignoredSelectors,
        }),
      }));
      setSelections(next);
      setSelectionRects(Object.fromEntries(next.map((selection) => [selection.id, rectFromElement(selection.element)])));
      setComment("");
      modeRef.current = "selected";
      setMode("selected");
      setHoverElement(null);
      setHoverRect(null);
      emitStatus("selected");
      for (const selection of next) safeCall(callbacks.onTargetSelect, callbackTarget(selection.target));
    };

    const onPointerDown = (event) => {
      if (event.button !== 0 || isOverlayEvent(event)) return;
      const candidate = findSelectableTarget(event.target, shadowHost, ignoredSelectors);
      const textIntent = pointTouchesText(event.clientX, event.clientY, event.target);
      const additive = (event.metaKey || event.ctrlKey) && event.shiftKey;
      gestureRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        candidate,
        textIntent: textIntent && !additive,
        additive,
        captureTarget: null,
      };
      if (!textIntent || additive) {
        try {
          event.target?.setPointerCapture?.(event.pointerId);
          gestureRef.current.captureTarget = event.target;
        } catch {
          // Some SVG and cross-realm targets do not expose pointer capture.
        }
      }
      suppressHostEvent(event, { preserveDefault: textIntent && !additive });
    };

    const onPointerMove = (event) => {
      if (isOverlayEvent(event)) return;
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) {
        showCandidate(findSelectableTarget(event.target, shadowHost, ignoredSelectors));
        return;
      }
      if (gesture.textIntent) {
        suppressHostEvent(event, { preserveDefault: true });
        return;
      }
      const current = { x: event.clientX, y: event.clientY };
      if (!isAnnotationDrag(gesture.start, current)) return;
      suppressHostEvent(event);
      suppressClickRef.current = true;
      setDrawRect(normalizeDrawRect(
        gesture.start,
        current,
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };

    const onPointerUp = (event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId || isOverlayEvent(event)) return;
      gestureRef.current = null;
      try { gesture.captureTarget?.releasePointerCapture?.(event.pointerId); } catch { /* Capture can already be released. */ }
      const current = { x: event.clientX, y: event.clientY };
      const dragged = isAnnotationDrag(gesture.start, current);

      if (gesture.textIntent && (dragged || !window.getSelection()?.isCollapsed)) {
        suppressHostEvent(event, { preserveDefault: true });
        suppressClickRef.current = true;
        requestAnimationFrame(() => {
          if (!selectText() && dragged) {
            const rect = normalizeDrawRect(gesture.start, current, {
              width: window.innerWidth,
              height: window.innerHeight,
            });
            selectMarquee(rect);
          }
        });
        return;
      }

      if (dragged) {
        suppressHostEvent(event);
        suppressClickRef.current = true;
        const rect = normalizeDrawRect(gesture.start, current, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
        setDrawRect(null);
        selectMarquee(rect);
        return;
      }

      suppressHostEvent(event, { preserveDefault: gesture.textIntent });
    };

    const onClick = (event) => {
      if (isOverlayEvent(event)) return;
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        suppressHostEvent(event);
        return;
      }
      const candidate = findSelectableTarget(event.target, shadowHost, ignoredSelectors);
      if (!candidate) return;
      suppressHostEvent(event);
      selectElement(candidate, (event.metaKey || event.ctrlKey) && event.shiftKey);
    };

    const onMouseActivation = (event) => {
      if (isOverlayEvent(event)) return;
      const candidate = findSelectableTarget(event.target, shadowHost, ignoredSelectors);
      if (!candidate) return;
      const textIntent = pointTouchesText(event.clientX, event.clientY, event.target)
        && !((event.metaKey || event.ctrlKey) && event.shiftKey);
      suppressHostEvent(event, { preserveDefault: textIntent && !suppressClickRef.current });
    };

    const onFocusIn = (event) => {
      if (isOverlayEvent(event)) return;
      showCandidate(findSelectableTarget(event.target, shadowHost, ignoredSelectors));
    };

    const onTargetKeyDown = (event) => {
      if ((event.key !== "Enter" && event.key !== " ") || event.repeat || isOverlayEvent(event)) return;
      const candidate = findSelectableTarget(event.target, shadowHost, ignoredSelectors);
      if (!candidate) return;
      suppressHostEvent(event);
      suppressedKeyRef.current = { key: event.key };
      selectElement(candidate, (event.metaKey || event.ctrlKey) && event.shiftKey);
    };

    const onPointerCancel = (event) => {
      if (gestureRef.current && !isOverlayEvent(event)) {
        suppressHostEvent(event, { preserveDefault: gestureRef.current.textIntent });
        try { gestureRef.current.captureTarget?.releasePointerCapture?.(event.pointerId); } catch { /* Capture can already be released. */ }
      }
      gestureRef.current = null;
      suppressClickRef.current = false;
      setDrawRect(null);
    };

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("mousedown", onMouseActivation, true);
    document.addEventListener("mouseup", onMouseActivation, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("keydown", onTargetKeyDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("mousedown", onMouseActivation, true);
      document.removeEventListener("mouseup", onMouseActivation, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("keydown", onTargetKeyDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [
    mode,
    repinningId,
    shadowHost,
    route,
    ignoredSelectorsKey,
    emitStatus,
    finishRegion,
    releaseRegion,
    safeCall,
    showNotice,
    callbacks.onTargetSelect,
    selectionsRef,
  ]);

  // Tour mode: clicking an element adds a step. Prefer the nearest element with a stable id, so
  // tagged inputs and wrappers can be tour targets too; the host never sees the click.
  useEffect(() => {
    if (mode !== "tour" || !shadowHost) return undefined;
    let animationFrame = null;
    let nonce = 0;
    const isOverlayEvent = (event) => event.composedPath?.().some((node) => node === shadowHost || node?.hasAttribute?.("data-threadmark-tours"));
    const candidateFor = (rawTarget) => {
      const tagged = rawTarget?.closest?.(`[${THREADMARK_TARGET_ATTRIBUTE}]`);
      if (tagged && !shadowHost.contains(tagged)) return tagged;
      return findSelectableTarget(rawTarget, shadowHost, ignoredSelectors);
    };
    const onPointerMove = (event) => {
      if (isOverlayEvent(event)) return;
      const candidate = candidateFor(event.target);
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        setHoverElement(candidate);
        setHoverRect(rectFromElement(candidate));
      });
    };
    const block = (event) => {
      if (!isOverlayEvent(event) && candidateFor(event.target)) suppressHostEvent(event);
    };
    const pick = (event) => {
      if (isOverlayEvent(event)) return;
      const candidate = candidateFor(event.target);
      if (!candidate) return;
      suppressHostEvent(event);
      const stableId = candidate.getAttribute(THREADMARK_TARGET_ATTRIBUTE);
      const descriptor = createTargetDescriptor(candidate, { route: sanitizeRoute(route || window.location.pathname || "/"), ignoredSelectors });
      const usable = isValidThreadmarkTargetId(stableId) ? stableId : null;
      nonce += 1;
      setTourPick({
        nonce: `${Date.now()}-${nonce}`,
        stableId: usable,
        ambiguous: usable ? resolveStableTarget(usable).status === "ambiguous" : false,
        name: String(descriptor?.accessibleName || descriptor?.visibleText || "").replace(/\s+/g, " ").trim().slice(0, 80),
        tag: candidate.tagName.toLowerCase(),
      });
    };
    const onKeyDown = (event) => {
      if ((event.key !== "Enter" && event.key !== " ") || event.repeat || isOverlayEvent(event)) return;
      pick(event);
    };
    document.addEventListener("pointermove", onPointerMove, true);
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup"]) document.addEventListener(type, block, true);
    document.addEventListener("click", pick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("pointermove", onPointerMove, true);
      for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup"]) document.removeEventListener(type, block, true);
      document.removeEventListener("click", pick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [mode, shadowHost, route, ignoredSelectorsKey]);

  // A comment started from Tour mode returns there once it's posted or dismissed.
  useEffect(() => {
    if (!tourCommentRef.current?.returnToTour) return;
    if (mode === "picking") {
      tourCommentRef.current = null;
      modeRef.current = "tour";
      setMode("tour");
    } else if (mode === "idle") {
      tourCommentRef.current = null;
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "tour" && tourDrafts && !tourDrafts.some((tour) => tour.id === tourActiveId) && tourDrafts.length) {
      setTourActiveId(tourDrafts[0].id);
    }
  }, [mode, tourDrafts, tourActiveId]);

  // "Try it": play the draft with the app's own <ThreadmarkTours> when it has one, or a temporary player.
  useEffect(() => {
    if (mode !== "tour-preview" || !tourPreview) return undefined;
    let cancelled = false;
    let attempts = 0;
    const backToTour = () => {
      if (cancelled) return;
      setTourPreview(null);
      modeRef.current = "tour";
      setMode("tour");
    };
    const attempt = () => {
      if (cancelled) return;
      const player = getMountedTourPlayer();
      if (!player?.preview) {
        if (!tourPreview.needsPlayer) setTourPreview((current) => current && { ...current, needsPlayer: true });
        if ((attempts += 1) < 40) window.setTimeout(attempt, 50);
        else {
          showNotice("The tour preview couldn’t start.");
          backToTour();
        }
        return;
      }
      const result = player.preview(tourPreview.tour, {
        onEnd: backToTour,
        onStep: (step) => { if (!cancelled) setTourPreview((current) => current && { ...current, step }); },
      });
      if (!result.ok) {
        showNotice("Fix the tour’s problems before trying it.");
        backToTour();
      }
    };
    // The download must not consume the short player-mount retry window.
    import("./tours/ThreadmarkTours.jsx").then(attempt).catch(() => {
      if (!cancelled) { showNotice("The tour preview couldn’t load."); backToTour(); }
    });
    return () => { cancelled = true; };
  }, [mode, tourPreview?.tour]);

  useEffect(() => {
    if (mode !== "picking" || !portalRoot) return undefined;
    const frame = requestAnimationFrame(() => {
      portalRoot.querySelector(".tm-drag-handle")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, portalRoot]);

  useEffect(() => {
    if (mode !== "idle" || !portalRoot || !restoreFocusRef.current) return undefined;
    const frame = requestAnimationFrame(() => {
      const previousFocus = returnFocusRef.current;
      const canRestorePrevious = previousFocus?.isConnected
        && previousFocus !== document.body
        && previousFocus !== document.documentElement
        && previousFocus !== shadowHost;
      const focusTarget = canRestorePrevious
        ? previousFocus
        : portalRoot.querySelector(".tm-launcher") || launcherRef.current;
      focusTarget?.focus?.();
      restoreFocusRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, portalRoot, shadowHost]);

  useEffect(() => {
    if (screenshotSelection?.snapshot?.status === "capturing") return;
    const targets = videoSelection
      ? videoSelection.targets
      : interactionSelection
      ? interactionSelection.targets
      : screenshotSelection
      ? [screenshotSelection.target]
      : textSelection
      ? [textSelection.target]
      : regionSelection
        ? [regionSelection.target]
        : selections.map((selection) => selection.target);
    const captureKind = videoSelection
      ? "video"
      : interactionSelection
      ? "interaction"
      : screenshotSelection
      ? "screenshot"
      : textSelection
      ? "text"
      : regionSelection ? "region" : targets.length > 1 ? "multi" : "element";
    safeCall(callbacks.onSelectionChange, {
      captureKind,
      targets: targets.map(callbackTarget),
    });
  }, [
    callbacks.onSelectionChange,
    interactionSelection?.id,
    videoSelection?.id,
    regionSelection?.id,
    safeCall,
    screenshotSelection?.id,
    screenshotSelection?.snapshot?.status,
    selections,
    textSelection?.id,
  ]);

  // A new comment takes the replay buffer when its composer opens: the lead-up to the review plus the
  // picking that followed. It stays a local draft the author can remove until the comment is posted.
  const replayCaptureKey = replayOptions.enabled && mode === "selected" && !editingAnnotationId && !repinningId
    ? textSelection?.id || interactionSelection?.id || videoSelection?.id || regionSelection?.id
      || screenshotSelection?.id || selections.map((item) => item.id).join(":")
    : "";
  useEffect(() => {
    const recorder = replayRecorderRef.current;
    if (!replayCaptureKey || !recorder) return undefined;
    let active = true;
    setReplayDraft({ key: replayCaptureKey, status: "capturing" });
    Promise.resolve()
      .then(() => recorder.capture())
      .then((capture) => {
        if (!active) return;
        if (!capture?.blob?.size || !capture.summary) {
          setReplayDraft({ key: replayCaptureKey, status: "none" });
          return;
        }
        setReplayDraft({
          key: replayCaptureKey,
          status: "ready",
          id: makeId("evidence"),
          blob: capture.blob,
          summary: capture.summary,
          startedAt: capture.startedAt,
          removed: false,
        });
      }, () => {
        if (active) setReplayDraft({ key: replayCaptureKey, status: "failed" });
      });
    return () => { active = false; };
  }, [replayCaptureKey]);

  const toggleReplayAttachment = useCallback(() => {
    setReplayDraft((current) => (current?.status === "ready" ? { ...current, removed: !current.removed } : current));
  }, []);

  // Capture once the composer opens, not on every additive click while a multi-selection is still being built.
  const commentCaptureKey = mode === "selected" && !editingAnnotationId && !repinningId && !regionSelection && !screenshotSelection
    ? textSelection?.id || interactionSelection?.id || selections.map((item) => item.id).join(":")
    : "";
  useEffect(() => {
    if (!commentCaptureKey || !portalRoot) { setCommentSnapshot(null); return; }
    const controller = new AbortController();
    let previewUrl;
    const id = makeId("evidence");
    const bounds = textSelection?.displayRect || interactionSelection?.displayRect
      || selections.map((item) => rectFromElement(item.element)).filter(Boolean).reduce((total, rect) => {
        if (!total) return rect;
        const left = Math.min(total.left, rect.left), top = Math.min(total.top, rect.top);
        return { left, top, width: Math.max(total.left + total.width, rect.left + rect.width) - left,
          height: Math.max(total.top + total.height, rect.top + rect.height) - top };
      }, null);
    const left = Math.max(0, (bounds?.left || 0) - 48);
    const top = Math.max(0, (bounds?.top || 0) - 48);
    const region = { left, top, width: Math.max(1, Math.min(window.innerWidth - left, (bounds?.width || 200) + 96)),
      height: Math.max(1, Math.min(window.innerHeight - top, (bounds?.height || 120) + 96)) };
    setCommentSnapshot({ snapshot: { id, status: "capturing", approved: false } });
    captureRegionSnapshot({ id, region, ignoredSelectors, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      previewUrl = URL.createObjectURL(result.blob);
      setCommentSnapshot({ snapshot: { id, status: "ready", approved: true, previewUrl, ...result,
        metadata: { ...result.metadata, capture: { capturedAt: new Date().toISOString(), route: activeRoute, buildId: buildId || null,
          bounds: { x: region.left, y: region.top, width: region.width, height: region.height },
          pin: { x: Math.max(0, Math.min(1, ((bounds?.left || 0) + (bounds?.width || 0) / 2 - region.left) / region.width)),
            y: Math.max(0, Math.min(1, ((bounds?.top || 0) + (bounds?.height || 0) / 2 - region.top) / region.height)) } } },
      } });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setCommentSnapshot({ snapshot: { id, status: "failed", approved: false, metadata: {
        id, kind: "snapshot", source: "dom-renderer", quality: "unavailable", mimeType: null,
        byteSize: 0, pixelSize: { width: 0, height: 0 }, redactionCount: 0, warnings: ["capture_failed"],
      } } });
      safeCall(callbacks.onError, { code: "snapshot_capture_failed", message: "Screenshot unavailable. You can still post your comment." });
    });
    return () => { controller.abort(); if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [commentCaptureKey, portalRoot, ignoredSelectorsKey, activeRoute, buildId]);

  // Moves the pin and records the previous location; the original target, build and evidence stay untouched.
  const persistRepin = async (annotation, target) => {
    const movedAt = new Date().toISOString();
    const pin = { target, route: activeRoute, buildId: buildId || null, movedAt, movedBy: normalizedReviewer };
    const previous = annotation.payload.pin || { target: annotation.payload.target, route: annotation.payload.route,
      buildId: annotation.payload.buildId, movedAt: annotation.payload.createdAt, movedBy: annotation.payload.author };
    const payload = createFeedbackPayload({ ...annotation.payload, now: annotation.payload.createdAt,
      updatedAt: movedAt, lastEditedBy: normalizedReviewer, pin,
      pinHistory: [...(annotation.payload.pinHistory || []), previous] });
    const evidence = annotation.runtime?.evidence || [];
    const result = await callbacks.onFeedbackCreate.current?.(payload, { evidence });
    if (!result?.feedback) return { payload, evidence };
    const accepted = recordToAnnotation({
      feedback: result.feedback,
      context: { evidence: result.context?.evidence ?? evidence },
    });
    // A host can return its authoritative record. Never claim a location was confirmed
    // if that record omitted, changed, or rejected the requested pin.
    if (!accepted?.payload.pin
      || accepted.payload.pin.route !== payload.pin.route
      || accepted.payload.pin.buildId !== payload.pin.buildId
      || JSON.stringify(accepted.payload.pin.target) !== JSON.stringify(payload.pin.target)) {
      throw new Error("The host did not save the requested pin location.");
    }
    return { payload: accepted.payload, evidence: accepted.runtime.evidence };
  };

  const confirmSuggestedPin = async (id) => {
    const annotation = annotationsRef.current.find((item) => item.id === id);
    const element = restorationSchedulerRef.current?.recheck(id)?.suggestion;
    if (!annotation || submitting) return;
    if (!element?.isConnected) { showNotice("That element is no longer on the page. Choose another."); return; }
    const generation = ++submitGenerationRef.current;
    setSubmitting(true);
    try {
      const accepted = await persistRepin(annotation, createTargetDescriptor(element, { route: activeRoute, ignoredSelectors }));
      if (generation !== submitGenerationRef.current) return;
      setAnnotations((items) => items.map((item) => mergeAccepted(item, annotation.id, accepted)));
      if (accepted.payload.id !== annotation.id) setEditingAnnotationId(accepted.payload.id);
      setSubmitting(false);
      showNotice("Location confirmed. Original screenshot preserved.");
    } catch {
      if (generation !== submitGenerationRef.current) return;
      setSubmitting(false);
      showNotice("Location wasn’t saved. Try again.");
    }
  };

  const beginRepin = (id) => {
    restorationSchedulerRef.current?.recheck(id);
    clearCapture();
    setEditingAnnotationId(null);
    setRepinningId(id);
    setComment("");
    setPendingDelete(null);
    modeRef.current = "picking";
    setMode("picking");
    showNotice("Choose a new element, then confirm Repin comment. Escape cancels.");
  };

  const projectAnnotations = useMemo(() => otherPageAnnotations.length
    && otherPageScope.current === JSON.stringify([String(projectKey || "").trim(), activeRoute])
    ? [...annotations, ...otherPageAnnotations] : annotations, [annotations, otherPageAnnotations, projectKey, activeRoute]);

  const updateWorkflow = async (action, value) => {
    const current = annotationsRef.current.find((item) => item.id === editingIdRef.current);
    if (!current || submitting) return;
    const workflow = current.payload.workflow || { status: "open", assignee: null, mentions: [], history: [] };
    const member = reviewers.find((item) => item.id === value);
    if (["assigned", "mentioned"].includes(action) && value && !member) return;
    const next = { ...workflow, history: [...(workflow.history || []), {
      action, at: new Date().toISOString(), actor: normalizedReviewer, buildId: buildId || null,
      assignee: action === "assigned" ? member || null : null,
    }] };
    if (action === "resolved") next.status = "resolved";
    if (action === "reopened") next.status = "open";
    if (action === "assigned") next.assignee = member || null;
    if (action === "mentioned" && member) next.mentions = [...(workflow.mentions || []).filter((item) => item.id !== member.id), member];
    let payload = createFeedbackPayload({ ...current.payload, now: current.payload.createdAt,
      updatedAt: new Date().toISOString(), lastEditedBy: normalizedReviewer, workflow: next });
    const generation = ++submitGenerationRef.current;
    setSubmitting(true);
    try {
      const evidence = current.runtime?.evidence || [];
      const accepted = acceptAuthoritative(payload, evidence, await callbacks.onFeedbackCreate.current?.(payload, { evidence }));
      if (generation !== submitGenerationRef.current) return;
      setAnnotations((items) => items.map((item) => mergeAccepted(item, current.id, accepted)));
      if (accepted.payload.id !== current.id) setEditingAnnotationId(accepted.payload.id);
      setSubmitting(false);
      showNotice(action === "resolved" ? "Resolved" : action === "reopened" ? "Reopened" : action === "assigned" ? `Assigned to ${member?.displayName || "nobody"}` : "Thread updated");
    } catch {
      if (generation !== submitGenerationRef.current) return;
      setSubmitting(false); showNotice("Thread wasn’t updated. Try again.");
    }
  };

  // Send a comment to an issue tracker or channel (board 10). The host creates the issue and returns
  // where it lives; Threadmark keeps that link on the comment so it points both ways.
  const sendToDestination = async (annotationId, destinationId, draft) => {
    const current = annotationsRef.current.find((item) => item.id === annotationId);
    if (!current || !callbacks.onSendTo.current) return null;
    const result = await callbacks.onSendTo.current(current.payload, { destinationId, ...draft });
    const [link] = normalizeLinks([{ destination: destinationId, status: "open", ...(result || {}) }]);
    if (!link) return null;
    const links = [...(current.payload.links || []).filter((item) => item.label !== link.label), link];
    let payload = createFeedbackPayload({ ...current.payload, now: current.payload.createdAt,
      updatedAt: new Date().toISOString(), lastEditedBy: normalizedReviewer, links });
    try {
      const evidence = current.runtime?.evidence || [];
      const accepted = acceptAuthoritative(payload, evidence, await callbacks.onFeedbackCreate.current?.(payload, { evidence }));
      setAnnotations((items) => items.map((item) => mergeAccepted(item, current.id, accepted)));
    } catch {
      // The issue exists even if the link didn't save; say so rather than pretend.
      showNotice(`${link.label} created, but the link back wasn’t saved.`);
      return link;
    }
    showNotice(`${link.label} created`, link.url ? { label: "Open", run: () => window.open(link.url, "_blank", "noopener,noreferrer") } : null);
    return link;
  };

  // AI review (board 12): a finding is posted only when someone chooses to, as their own comment marked
  // "From an AI review". Threadmark bundles no model; the host's onAiReview / onAskAi supply the words.
  const postAiComment = async ({ element, comment }) => {
    if (!element?.isConnected || !normalizedReviewer) throw new Error("That element isn’t on the page any more.");
    const target = createTargetDescriptor(element, { route: activeRoute, ignoredSelectors });
    let payload = createFeedbackPayload({
      projectKey, environment: environment || "local", buildId, route: activeRoute, target, comment,
      author: normalizedReviewer, lastEditedBy: normalizedReviewer, source: "ai",
      workflow: { status: "open", assignee: null, mentions: [], history: [] },
    });
    const accepted = acceptAuthoritative(payload, [], await callbacks.onFeedbackCreate.current?.(payload, { evidence: [] }));
    payload = accepted.payload;
    setAnnotations((current) => [
      ...current.filter((annotation) => annotation.id !== payload.id),
      { id: payload.id, payload, runtime: { kind: "element", elements: [element], evidence: accepted.evidence || [] }, poll: emptyPoll(payload.ask) },
    ]);
    return payload.id;
  };

  const changeReaction = useCallback(async (annotationId, messageId, emoji, active) => {
    const annotation = annotationsRef.current.find((item) => item.id === annotationId);
    if (!annotation || !normalizedReviewer || !callbacks.onReactionChange.current) return;
    const generation = submitGenerationRef.current;
    try {
      const result = await callbacks.onReactionChange.current(annotation.payload, { messageId, emoji, active });
      if (generation !== submitGenerationRef.current) return;
      if (!Array.isArray(result)) throw new Error("The reaction callback must return saved reactions.");
      const reactions = normalizeReactions(result);
      setAnnotations((items) => items.map((item) => item.id !== annotationId ? item : { ...item, payload: {
        ...item.payload,
        ...(messageId === annotationId ? { reactions } : { replies: (item.payload.replies || []).map((reply) => reply.id === messageId ? { ...reply, reactions } : reply) }),
      } }));
    } catch (error) {
      showNotice("Your reaction wasn’t saved. Try again.");
      safeCall(callbacks.onError, { code: "reaction_failed", message: error?.message || "The reaction could not be saved." });
      throw error;
    }
  }, [annotationsRef, normalizedReviewer, callbacks.onReactionChange, callbacks.onError, safeCall, showNotice]);

  // Votes go to the host, which returns the poll's new results.
  const votePoll = useCallback(async (annotationId, optionIds) => {
    const annotation = annotationsRef.current.find((item) => item.id === annotationId);
    if (annotation?.payload.ask?.kind !== "poll" || !callbacks.onPollVote.current) return;
    const ids = annotation.payload.ask.options.map((option) => option.id).filter((id) => optionIds.includes(id));
    try {
      const results = normalizePollResults(await callbacks.onPollVote.current(annotation.payload, ids), annotation.payload.ask);
      if (results) setAnnotations((items) => items.map((item) => (item.id === annotationId ? { ...item, poll: results } : item)));
    } catch (error) {
      showNotice("Your vote wasn’t saved. Try again.");
      safeCall(callbacks.onError, { code: "poll_vote_failed", message: error?.message || "The vote could not be saved." });
    }
  }, [annotationsRef, callbacks.onError, callbacks.onPollVote, safeCall, showNotice]);

  // Next steps are the host's: ticks show at once and go to the host, which supplies the updated list.
  const tickNextStep = useCallback(async (step, done) => {
    if (!callbacks.onNextStepDone.current) return;
    setNextStepTicks((current) => ({ ...current, [step.id]: done }));
    try {
      await callbacks.onNextStepDone.current(step, done);
    } catch (error) {
      setNextStepTicks((current) => {
        const next = { ...current };
        delete next[step.id];
        return next;
      });
      showNotice("The step wasn’t updated. Try again.");
      safeCall(callbacks.onError, { code: "next_step_failed", message: error?.message || "The step could not be updated." });
    }
  }, [callbacks.onError, callbacks.onNextStepDone, safeCall, showNotice]);

  const copyNextSteps = useCallback(async () => {
    try {
      await callbacks.onNextStepsCopy.current?.(shownNextSteps?.steps || []);
      showNotice("Copied the open steps as a prompt for your AI agent.");
    } catch (error) {
      showNotice("The steps weren’t copied. Try again.");
      safeCall(callbacks.onError, { code: "next_steps_copy_failed", message: error?.message || "The steps could not be copied." });
    }
  }, [callbacks.onError, callbacks.onNextStepsCopy, safeCall, shownNextSteps, showNotice]);

  /** A thread behind a step: opened here, or on its own page through the thread link. */
  const openNextStepSource = (source) => {
    const route = projectAnnotations.find((item) => item.id === source.feedbackId)?.payload.route || source.route;
    if (route && sanitizeRoute(route) !== activeRoute) {
      const destination = new URL(window.location.href);
      destination.pathname = route; destination.search = ""; destination.hash = "";
      destination.searchParams.set("threadmark", source.feedbackId);
      window.location.assign(destination.href);
      return;
    }
    if (!annotationsRef.current.some((item) => item.id === source.feedbackId)) {
      showNotice("That thread isn’t available on this page.");
      return;
    }
    const element = annotationRestorations[source.feedbackId]?.results?.find((result) => result.element)?.element;
    element?.scrollIntoView({ block: "center", behavior: "instant" });
    editAnnotation(source.feedbackId);
  };

  // Runs the ordinary submit once the review's title and trim are in state.
  useEffect(() => {
    const pending = postVideoPendingRef.current;
    if (!pending || comment !== pending || videoSelection?.video?.title !== pending) return;
    postVideoPendingRef.current = null;
    submitFeedback({ preventDefault() {} });
  });

  const submitFeedback = async (event) => {
    event.preventDefault();
    const editing = annotationsRef.current.find((annotation) => annotation.id === editingIdRef.current) || null;
    const repinning = annotationsRef.current.find((item) => item.id === repinningId);
    const currentText = textRef.current;
    const currentRegion = regionRef.current;
    const currentScreenshot = screenshotRef.current;
    const currentInteraction = interactionRef.current;
    const currentVideo = videoRef.current;
    const targets = editing
      ? editing.payload.targets || [editing.payload.target]
      : currentVideo
        ? currentVideo.targets
      : currentInteraction
        ? currentInteraction.targets
      : currentScreenshot
        ? [currentScreenshot.target]
        : currentText
        ? [currentText.target]
        : currentRegion
          ? [currentRegion.target]
          : selectionsRef.current.map((selection) => selection.target);
    if (
      submitting
      || !targets.length
      || (!editing && currentRegion?.snapshot?.status === "capturing")
      || (!editing && currentScreenshot && !currentScreenshot.snapshot?.approved)
      || (!editing && !repinning && commentSnapshot?.snapshot?.status === "capturing")
      || (!repinning && !comment.trim())
      || (!editing && !repinning && askKind === "poll" && pollOptions.filter((option) => option.trim()).length < 2)
    ) return;

    setSubmitting(true);
    const submissionGeneration = submitGenerationRef.current + 1;
    submitGenerationRef.current = submissionGeneration;
    setNotice("");
    emitStatus("submitting");

    try {
      if (repinning) {
        if (targets.length !== 1 || !selectionsRef.current[0]?.element?.isConnected) throw new Error("Select one available element.");
        const accepted = await persistRepin(repinning, targets[0]);
        const payload = accepted.payload;
        if (submissionGeneration !== submitGenerationRef.current) return;
        setAnnotations((items) => items.map((item) => mergeAccepted(item, repinning.id, accepted)));
        clearCapture();
        setEditingAnnotationId(payload.id);
        setComment("");
        setComposerMode("reply");
        setSubmitting(false);
        showNotice("Comment repinned. Original screenshot preserved.");
        emitStatus("submitted");
        return;
      }
      if (repinningId) throw new Error("The original comment is no longer available.");
      if (editing && composerMode === "edit" && editingReplyId) {
        const updatedAt = new Date().toISOString();
        let payload = createFeedbackPayload({
          ...editing.payload,
          now: editing.payload.createdAt,
          updatedAt,
          replies: (editing.payload.replies || []).map((reply) => reply.id === editingReplyId
            ? { ...reply, comment, updatedAt, lastEditedBy: normalizedReviewer }
            : reply),
          lastEditedBy: normalizedReviewer,
        });
        const context = { evidence: editing.runtime?.evidence || [] };
        const accepted = acceptAuthoritative(payload, context.evidence, await callbacks.onFeedbackCreate.current?.(payload, context));
        if (submissionGeneration !== submitGenerationRef.current) return;
        setAnnotations((current) => current.map((annotation) => mergeAccepted(annotation, editing.id, accepted)));
        setEditingReplyId(null);
        setComment(replyDraftRef.current?.comment || "");
        setReplyTarget(replyDraftRef.current?.target || null);
        replyDraftRef.current = null;
        setComposerMode("reply");
        setSubmitting(false);
        showNotice("Reply updated");
        emitStatus("selected");
        return;
      }
      if (editing && composerMode === "reply") {
        const createdAt = new Date().toISOString();
        const reply = {
          id: makeId("reply"),
          parentId: replyTarget?.id || editing.id,
          comment,
          createdAt,
          updatedAt: createdAt,
          author: normalizedReviewer,
          lastEditedBy: normalizedReviewer,
        };
        let payload = createFeedbackPayload({
          ...editing.payload,
          now: editing.payload.createdAt,
          updatedAt: createdAt,
          reactions: editing.payload.reactions,
          replies: [...(editing.payload.replies || []), reply],
          workflow: withInlineMentions(editing.payload.workflow, comment, reviewers, normalizedReviewer, buildId),
          lastEditedBy: normalizedReviewer,
        });
        const context = { evidence: editing.runtime?.evidence || [] };
        const accepted = acceptAuthoritative(payload, context.evidence, await callbacks.onFeedbackCreate.current?.(payload, context));
        if (submissionGeneration !== submitGenerationRef.current) return;
        setAnnotations((current) => current.map((annotation) => mergeAccepted(annotation, editing.id, accepted)));
        if (accepted.payload.id !== editing.id) setEditingAnnotationId(accepted.payload.id);
        setComment("");
        setReplyTarget(null);
        setSubmitting(false);
        emitStatus("submitted");
        showNotice("Reply added");
        return;
      }

      const captureKind = editing?.payload.captureKind
        || (currentVideo ? "video" : currentInteraction ? "interaction" : currentScreenshot ? "screenshot" : currentText ? "text" : currentRegion ? "region" : targets.length > 1 ? "multi" : "element");
      const activeSnapshotSelection = currentScreenshot || currentRegion || commentSnapshot;
      const approvedSnapshot = !editing && activeSnapshotSelection?.snapshot?.approved
        ? activeSnapshotSelection.snapshot
        : null;
      if (
        approvedSnapshot?.blob
        && (
          approvedSnapshot.metadata?.id !== approvedSnapshot.id
          || approvedSnapshot.metadata?.byteSize !== approvedSnapshot.blob.size
          || approvedSnapshot.metadata?.mimeType !== approvedSnapshot.blob.type
        )
      ) {
        throw new Error("Snapshot evidence metadata did not match its Blob.");
      }
      const snapshotMetadata = editing?.payload.evidence
        || (currentVideo ? [currentVideo.evidence.metadata] : null)
        || (approvedSnapshot?.metadata ? [approvedSnapshot.metadata] : activeSnapshotSelection?.snapshot?.status === "failed" ? [activeSnapshotSelection.snapshot.metadata] : []);
      const draftReplay = replayDraftRef.current;
      const replayAttachment = !editing && !currentVideo && !currentInteraction && draftReplay?.status === "ready" && !draftReplay.removed ? draftReplay : null;
      const device = editing
        ? editing.payload.device
        : deviceDetails === false ? undefined : readDeviceInfo(window, clientHintsRef.current);
      const appMetadata = editing ? editing.payload.metadata : await readMetadata();
      if (submissionGeneration !== submitGenerationRef.current) return;
      const evidenceMetadata = replayAttachment
        ? [...snapshotMetadata, {
          id: replayAttachment.id,
          kind: "replay",
          mimeType: replayAttachment.blob.type,
          byteSize: replayAttachment.blob.size,
          durationMs: replayAttachment.summary.durationMs,
          eventCount: replayAttachment.summary.eventCount,
        }]
        : snapshotMetadata;
      let payload = createFeedbackPayload({
        captureEnvironment: editing ? editing.payload.captureEnvironment : deviceDetails === false ? undefined : captureEnvironment(window),
        id: editing?.payload.id,
        now: editing?.payload.createdAt,
        updatedAt: new Date().toISOString(),
        projectKey,
        environment: environment || "local",
        buildId: editing ? editing.payload.buildId : buildId,
        route: editing ? editing.payload.route : sanitizeRoute(route || window.location.pathname || "/"),
        pin: editing?.payload.pin,
        pinHistory: editing?.payload.pinHistory,
        links: editing?.payload.links,
        source: editing?.payload.source,
        workflow: withInlineMentions(editing?.payload.workflow, comment, reviewers, normalizedReviewer, buildId),
        ask: editing
          ? editing.payload.ask
          : askKind === "poll"
            ? {
              kind: "poll",
              multiple: pollMultiple,
              options: pollOptions.map((label) => label.trim()).filter(Boolean).map((label, index) => ({ id: `option-${index + 1}`, label })),
            }
            : askKind === "question" ? { kind: "question" } : undefined,
        tourStep: editing ? editing.payload.tourStep : tourCommentRef.current?.tourStep,
        target: targets[0],
        targets,
        captureKind,
        evidence: evidenceMetadata,
        interaction: editing?.payload.interaction || currentInteraction?.interaction,
        video: editing?.payload.video || currentVideo?.video,
        replay: editing?.payload.replay
          || (replayAttachment ? { evidenceId: replayAttachment.id, startedAt: replayAttachment.startedAt, ...replayAttachment.summary } : undefined),
        comment,
        reactions: editing?.payload.reactions,
        replies: editing?.payload.replies,
        author: editing ? editing.payload.author : normalizedReviewer,
        lastEditedBy: normalizedReviewer,
        device,
        metadata: appMetadata,
      });
      let contextEvidence = editing?.runtime?.evidence
        || (currentVideo ? [{ id: currentVideo.evidence.id, blob: currentVideo.evidence.blob }] : null)
        || (approvedSnapshot?.blob ? [{ id: approvedSnapshot.id, blob: approvedSnapshot.blob }] : []);
      if (replayAttachment) contextEvidence = [...contextEvidence, { id: replayAttachment.id, blob: replayAttachment.blob }];
      for (const item of contextEvidence) {
        const matchingMetadata = evidenceMetadata.find((metadata) => metadata.id === item.id);
        const matches = item.blob
          ? matchingMetadata?.byteSize === item.blob.size && matchingMetadata?.mimeType === item.blob.type
          : Boolean(matchingMetadata) && isRemoteEvidenceUrl(item.url);
        if (!matches) throw new Error("Saved evidence metadata did not match its Blob.");
      }
      const context = { evidence: contextEvidence };
      // Hosts that upload the files while saving report it here, and the composer shows the share sent.
      const sizes = new Map(contextEvidence.filter((item) => item.blob?.size).map((item) => [item.id, item.blob.size]));
      const totalBytes = [...sizes.values()].reduce((sum, size) => sum + size, 0);
      const sentBytes = new Map();
      const onUploadProgress = (progress) => {
        if (submissionGeneration !== submitGenerationRef.current || !sizes.has(progress?.evidenceId)) return;
        const sent = Math.min(sizes.get(progress.evidenceId), Math.max(0, Number(progress.sentBytes) || 0));
        sentBytes.set(progress.evidenceId, Math.max(sentBytes.get(progress.evidenceId) || 0, sent));
        setUploadProgress([...sentBytes.values()].reduce((sum, value) => sum + value, 0) / totalBytes);
      };

      let acceptedPoll = null;
      ({ payload, evidence: contextEvidence, poll: acceptedPoll } = acceptAuthoritative(payload, contextEvidence, await callbacks.onFeedbackCreate.current?.(payload, context, { onUploadProgress })));
      if (submissionGeneration !== submitGenerationRef.current) return;
      const runtime = editing?.runtime || (captureKind === "text"
        ? { kind: "text", range: currentText.range.cloneRange() }
        : captureKind === "screenshot"
          ? {
            kind: "screenshot",
            anchorPagePoint: { ...currentScreenshot.anchorPagePoint },
            evidence: contextEvidence,
          }
        : captureKind === "region"
          ? {
            kind: "region",
            pageBounds: { ...currentRegion.target.pageBounds },
            evidence: contextEvidence,
          }
          : captureKind === "interaction"
            ? {
              kind: "interaction",
              elements: currentInteraction?.elements || editing?.runtime?.elements || [],
              interaction: editing?.payload.interaction || currentInteraction?.interaction,
            }
          : captureKind === "video"
            ? {
              kind: "video",
              elements: currentVideo?.elements || editing?.runtime?.elements || [],
              video: payload.video,
            }
            : { kind: captureKind, elements: selectionsRef.current.map((selection) => selection.element) });
      runtime.evidence = contextEvidence;
      setAnnotations((current) => editing
        ? current.map((annotation) => annotation.id === editing.id
          ? { ...annotation, id: payload.id, payload, runtime }
          : annotation)
        : [
          ...current.filter((annotation) => annotation.id !== payload.id),
          { id: payload.id, payload, runtime, poll: acceptedPoll || emptyPoll(payload.ask) },
        ]);
      emitStatus("submitted");
      if (editing) {
        // Inline edits keep the discussion open so the reviewer sees the saved text in place.
        setEditingAnnotationId(payload.id);
        setComment(replyDraftRef.current?.comment || "");
        setComposerMode("reply");
        setReplyTarget(replyDraftRef.current?.target || null);
        replyDraftRef.current = null;
        editDraftRef.current = null;
        setPendingDelete(null);
        setSubmitting(false);
        showNotice("Comment updated");
        emitStatus("selected");
        return;
      }
      // Board 01, 2d: "Comment added · Undo".
      {
        const addedId = payload.id;
        showNotice(captureKind === "video" ? "Video posted" : "Comment added", { label: "Undo", run: () => removeAnnotation(addedId, { undoable: false }) });
      }
      clearCapture();
      setComment("");
      setReplyTarget(null);
      setPendingDelete(null);
      setSubmitting(false);
      if (captureKind === "video") {
        // 7f: the posted video opens as its thread, so it plays straight away.
        setEditingAnnotationId(payload.id);
        setComposerMode("reply");
        modeRef.current = "selected";
        setMode("selected");
        emitStatus("selected");
        return;
      }
      setEditingAnnotationId(null);
      setComposerMode("new");
      modeRef.current = "picking";
      setMode("picking");
      emitStatus("selecting");
    } catch {
      if (submissionGeneration !== submitGenerationRef.current) return;
      setSubmitting(false);
      emitStatus("error");
      showNotice("Feedback wasn’t saved. Try again.");
      safeCall(callbacks.onError, {
        code: "feedback_submit_failed",
        message: "The feedback callback did not complete successfully.",
      });
    }
  };

  // Post from the review (7e): the title becomes the comment and the trim travels with the video.
  const postVideo = ({ title, startMs, endMs }) => {
    const current = videoRef.current;
    if (!current || submitting) return;
    const text = String(title || "").trim().slice(0, 120) || "Video walkthrough";
    setVideoSelection((selection) => selection && {
      ...selection,
      video: { ...selection.video, title: text, trim: { startMs, endMs } },
    });
    setComment(text);
    postVideoPendingRef.current = text;
  };

  if (!portalRoot) return null;

  const openListedAnnotation = (id) => {
    const record = projectAnnotations.find((item) => item.id === id);
    if (record && record.payload.route !== activeRoute) {
      const destination = new URL(window.location.href);
      destination.pathname = record.payload.route; destination.search = ""; destination.hash = "";
      destination.searchParams.set("threadmark", id);
      window.location.assign(destination.href); return;
    }
    const element = annotationRestorations[id]?.results?.find((result) => result.element)?.element;
    element?.scrollIntoView({ block: "center", behavior: "instant" });
    editAnnotation(id);
  };

  const tourStepComments = {};
  for (const annotation of projectAnnotations) {
    const link = annotation.payload.tourStep;
    if (!link) continue;
    (tourStepComments[`${link.tourId}:${link.stepId}`] ||= []).push({
      id: annotation.id,
      comment: annotation.payload.comment,
      author: annotation.payload.author?.displayName || "Someone",
      replies: annotation.payload.replies?.length || 0,
      resolved: annotation.payload.workflow?.status === "resolved",
    });
  }

  const overlay = createPortal(
    <>
    {/* Inside a tm-root so the widget gets the brand tokens. */}
    {onPageReviewRequested && mode === 'picking' && <div className="tm-root"><AgentReview route={activeRoute} buildId={buildId} ignoredSelectors={ignoredSelectors}
      onReview={onPageReviewRequested} onRecords={(records) => {
        const accepted = records.filter(record => record.feedback?.projectKey === projectKey && record.feedback?.route === activeRoute).map(record => recordToAnnotation(record)).filter(Boolean);
        setAnnotations(current => [...current.filter(item => !accepted.some(next => next.id === item.id)), ...accepted]);
      }} /></div>}
    {presence && <Presence transport={presence} route={activeRoute} buildId={buildId} projectKey={projectKey} ignoredSelectors={ignoredSelectors} />}
    <Overlay
      mode={mode}
      onStartTour={startTourMode}
      onExitTour={exitTourMode}
      tourDrafts={tourDrafts || []}
      tourActiveId={tourActiveId}
      onTourDraftsChange={changeTourDrafts}
      tourPick={tourPick}
      onTourPreview={previewTour}
      onStopTourPreview={stopTourPreview}
      tourPreviewInfo={tourPreview ? { title: tourPreview.tour?.title || tourPreview.tour?.name || "", step: tourPreview.step || 0, total: tourPreview.tour?.steps?.length || 0 } : null}
      onTourSave={callbacks.onTourSave.current ? (tour, file) => callbacks.onTourSave.current(tour, file) : undefined}
      onTourSendToAi={callbacks.onTourSendToAi.current ? (tour, file) => callbacks.onTourSendToAi.current(tour, file) : undefined}
      aiConnection={aiConnection && typeof aiConnection.name === "string" ? { name: aiConnection.name.slice(0, 60), connected: aiConnection.connected === true, detail: typeof aiConnection.detail === "string" ? aiConnection.detail.slice(0, 120) : null } : null}
      onConnectAi={onConnectAi}
      onCopyText={copyText}
      tourStepComments={tourStepComments}
      tourCodeRules={tourCodeRules}
      onCommentOnTourStep={commentOnTourStep}
      onOpenTourComment={(id) => {
        tourCommentRef.current = { returnToTour: true };
        openListedAnnotation(id);
      }}
      projectAnnotations={projectAnnotations}
      reviewers={reviewers}
      onWorkflowChange={updateWorkflow}
      currentBuildId={buildId}
      captureComparison={async () => {
        const element = annotationRestorations[editingIdRef.current]?.results?.find((result) => result.element)?.element;
        if (!element?.isConnected) throw new Error("Repin the missing target before comparing it.");
        // Capture the live element only when it is fully on screen, so a verification never rests on a blank crop.
        element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1 || rect.left < 0 || rect.top < 0
          || rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
          throw new Error("Scroll until the whole element is visible, then compare.");
        }
        const left = Math.max(0, rect.left - 32), top = Math.max(0, rect.top - 32);
        const right = Math.min(window.innerWidth, rect.right + 32), bottom = Math.min(window.innerHeight, rect.bottom + 32);
        return captureRegionSnapshot({ id: makeId("comparison"), ignoredSelectors,
          region: { left, top, width: right - left, height: bottom - top } });
      }}
      allCommentsOpen={allCommentsOpen}
      onToggleAllComments={() => { setAllCommentsOpen((open) => !open); }}
      onCloseAllComments={() => { setAllCommentsOpen(false); portalRoot.querySelector(".tm-all-comments-trigger")?.focus(); }}
      onOpenListedAnnotation={openListedAnnotation}
      repinning={Boolean(repinningId)}
      repinTargetCount={(() => {
        const payload = annotations.find((item) => item.id === repinningId)?.payload;
        return payload?.pin ? 1 : (payload?.targets || [payload?.target]).filter(Boolean).length;
      })()}
      onRepin={beginRepin}
      onConfirmSuggestedPin={confirmSuggestedPin}
      commentSnapshot={commentSnapshot}
      hoverRect={hoverRect}
      selections={selections}
      selectionRects={selectionRects}
      textSelection={textSelection}
      regionSelection={regionSelection}
      screenshotSelection={screenshotSelection}
      interactionSelection={interactionSelection}
      interactionRecording={interactionRecording}
      shadowHost={shadowHost}
      videoEnabled={videoOptions.enabled}
      videoMaxDurationMs={videoOptions.maxDurationMs}
      videoSetup={videoSetup}
      videoRecording={videoRecordingState}
      videoSelection={videoSelection}
      onStartVideo={startVideoSetup}
      onVideoSetupChange={updateVideoSetup}
      onBeginVideoRecording={beginVideoRecording}
      onCancelVideoSetup={cancelVideoSetup}
      onToggleVideoPause={toggleVideoPause}
      videoBlurred={videoBlurred}
      videoTool={videoTool}
      onVideoTool={chooseVideoTool}
      onToggleVideoBlur={toggleVideoBlur}
      onVideoStroke={recordVideoStroke}
      onDiscardVideo={discardVideoRecording}
      onStopVideo={finishVideoRecording}
      onToggleVideoSource={toggleVideoSource}
      onMarkVideoMoment={markVideoMoment}
      videoCountdown={videoCountdown}
      onCancelVideoCountdown={cancelVideoCountdown}
      videoReview={videoReview}
      onPostVideo={postVideo}
      onRetakeVideo={startVideoSetup}
      replayEnabled={replayOptions.enabled}
      replayDraft={replayDraft}
      onToggleReplay={toggleReplayAttachment}
      drawRect={drawRect}
      annotations={annotations}
      markerPositions={markerPositions}
      annotationRects={annotationRects}
      annotationRestorations={annotationRestorations}
      markersHidden={markersHidden}
      clearArmed={clearArmed}
      paused={paused}
      editingAnnotation={editingAnnotation}
      pageVersions={normalizedPageVersions}
      pageVersionRoute={activeRoute}
      carryingVersionId={carryingVersionId}
      reviewer={normalizedReviewer}
      toolbarPosition={toolbarPosition}
      toolbarDragging={toolbarDragging}
      barPosition={barPrefs.position}
      barShrunk={barPrefs.shrunk}
      barHidden={hiddenPages.includes(activeRoute)}
      onBarShrink={(shrunk) => updateBarPrefs({ shrunk })}
      onBarHide={() => {
        const next = [...new Set([...hiddenPages, activeRoute])];
        setHiddenPages(next);
        writeHiddenPages(next);
        closeReview();
        const keys = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘⇧F" : "Ctrl+Shift+F";
        // Board 09, 29c: say which page, and offer Undo.
        showNotice(`Hidden on ${activeRoute === "/" ? "Home" : activeRoute}. ${keys} brings it back.`, {
          label: "Undo",
          run: () => { setHiddenPages(next.filter((page) => page !== activeRoute)); writeHiddenPages(next.filter((page) => page !== activeRoute)); },
        });
      }}
      shortcutsOpen={shortcutsOpen}
      onShortcutsOpenChange={setShortcutsOpen}
      comment={comment}
      setComment={setComment}
      composerMode={composerMode}
      replyTarget={replyTarget}
      pendingDelete={pendingDelete}
      deleting={deleting}
      onStart={startReview}
      onExit={closeReview}
      onBack={backToSelection}
      onClearAll={requestClearAll}
      onComment={openComposer}
      onScreenshot={startScreenshotSelection}
      onStartInteraction={startInteractionRecording}
      onStopInteraction={finishInteractionRecording}
      onCancelInteraction={cancelInteractionRecording}
      onScreenshotAreaComplete={captureScreenshotArea}
      onScreenshotCancel={cancelScreenshotMarkup}
      onScreenshotConfirm={confirmScreenshotMarkup}
      onBackToDrawing={backToDrawing}
      onScreenshotStrokesChange={updateScreenshotStrokes}
      onSubmit={submitFeedback}
      onPause={togglePause}
      onVisibility={toggleMarkers}
      onCopy={copyAnnotations}
      onEditAnnotation={editAnnotation}
      onRecheckAnnotation={recheckAnnotation}
      onCopyAnnotationLink={copyAnnotationLink}
      onSelectPageVersion={selectPageVersion}
      nextSteps={shownNextSteps}
      notifications={Array.isArray(notifications) ? normalizedNotifications : null}
      onOpenNotification={(notification) => {
        safeCall(callbacks.onNotificationOpen, notification);
        if (notification.annotationId && projectAnnotations.some((item) => item.id === notification.annotationId)) {
          openListedAnnotation(notification.annotationId);
        } else if (notification.route && notification.route !== activeRoute) {
          // The host's onNotificationOpen navigates; without one, at least say where it is.
          if (!callbacks.onNotificationOpen.current) showNotice(`That’s on ${notification.route === "/" ? "Home" : notification.route}.`);
        } else {
          showNotice("That comment isn’t on this page any more.");
        }
      }}
      onNotificationsSeen={(ids) => { if (ids.length) safeCall(callbacks.onNotificationsRead, ids); }}
      surveys={Array.isArray(surveys) ? normalizedSurveys.filter((survey) => survey.pages.some((page) => surveyPageMatches(page, activeRoute))) : null}
      surveyResults={surveyResults && typeof surveyResults === "object" ? surveyResults : {}}
      onSurveyPublish={onSurveyPublish ? async (survey) => {
        await callbacks.onSurveyPublish.current?.(survey);
        showNotice(`Your question is live on ${survey.pages.join(", ")}`);
      } : null}
      onSurveyEnd={onSurveyEnd ? (survey) => safeCall(callbacks.onSurveyEnd, survey.id) : null}
      surveyRoute={activeRoute}
      faces={Array.isArray(faces) ? faces.filter((face) => face && typeof face.url === "string") : []}
      reviewerEmail={typeof reviewer?.email === "string" ? reviewer.email : null}
      notificationSettings={notificationSettings}
      projectName={typeof projectName === "string" ? projectName : null}
      onReviewerChange={onReviewerChange}
      onNotificationSettingsChange={onNotificationSettingsChange}
      onLeaveProject={onLeaveProject}
      onSignOut={onSignOut}
      inviteSuggestions={Array.isArray(inviteSuggestions) ? inviteSuggestions : undefined}
      shareUrl={typeof shareUrl === "string" && shareUrl ? shareUrl : null}
      linkAccess={["comment", "view", "off"].includes(linkAccess) ? linkAccess : null}
      members={Array.isArray(members) ? members.filter((member) => member && member.id != null && (member.displayName || member.email)) : []}
      onInvite={onInvite}
      onMemberChange={onMemberChange}
      onResendInvite={onResendInvite}
      onLinkAccessChange={onLinkAccessChange}
      nextStepsOpen={nextStepsOpen}
      onShowNextSteps={setNextStepsOpen}
      canTickNextSteps={Boolean(shownNextSteps?.canEdit && callbacks.onNextStepDone.current)}
      onNextStepDone={tickNextStep}
      onOpenNextStepSource={openNextStepSource}
      onCopyNextSteps={callbacks.onNextStepsCopy.current ? copyNextSteps : undefined}
      onCarryFeedbackForward={callbacks.onFeedbackCarryForward.current ? carryFeedbackForward : null}
      onBeginReply={beginReply}
      onCancelReply={cancelReply}
      onBeginEdit={beginEdit}
      editingReplyId={composerMode === "edit" ? editingReplyId : null}
      onRequestDelete={requestDelete}
      onCancelDelete={() => setPendingDelete(null)}
      discardPending={discardPending}
      onRequestDismiss={requestDismiss}
      onKeepEditing={() => setDiscardPending(false)}
      onConfirmDelete={confirmDelete}
      onToolbarPointerDown={onToolbarPointerDown}
      onToolbarPointerMove={onToolbarPointerMove}
      onToolbarPointerUp={onToolbarPointerUp}
      onRetrySnapshot={retrySnapshot}
      askKind={askKind}
      onAskKindChange={callbacks.onPollVote.current ? setAskKind : undefined}
      pollOptions={pollOptions}
      onPollOptionsChange={setPollOptions}
      pollMultiple={pollMultiple}
      onPollMultipleChange={setPollMultiple}
      pollsEnabled={Boolean(callbacks.onPollVote.current)}
      onVote={votePoll}
      onReactionChange={callbacks.onReactionChange.current ? changeReaction : undefined}
      destinations={Array.isArray(destinations) ? destinations.filter((item) => item && item.id && item.name) : []}
      onSendTo={callbacks.onSendTo.current ? sendToDestination : undefined}
      onConnectDestination={onConnectDestination}
      onAiReview={onAiReview}
      onAskAi={onAskAi}
      onAiDismiss={onAiDismiss}
      onPostAiComment={postAiComment}
      aiRoute={activeRoute}
      aiBuildId={buildId}
      aiIgnoredSelectors={ignoredSelectors}
      onAiNotice={showNotice}
      notice={notice}
      submitting={submitting}
      uploadProgress={uploadProgress}
      composingScreenshot={composingScreenshot}
      launcherRef={launcherRef}
    />
    </>,
    portalRoot,
  );
  // A temporary player for "Try it" when the app doesn't mount <ThreadmarkTours> itself.
  return tourPreview?.needsPlayer ? <>{overlay}<Suspense fallback={null}><ThreadmarkTours tours={[]} /></Suspense></> : overlay;
}
