import { createPortal } from "react-dom";
import { ReactIcon as SmileCircleIcon } from "./icons.jsx";
import { REACTIONS } from "./reactions.js";
import { VirtualCommentList } from "./VirtualCommentList.jsx";
import { Suspense, lazy, memo, useLayoutEffect, useSyncExternalStore, useMemo, useCallback, useEffect, useRef, useState } from "react";
import { ReplayIcon as MonitorPlay } from "./icons.jsx";
import { AgentIcon as Bot } from "./icons.jsx";
import { NextStepsIcon as ListChecks } from "./icons.jsx";
import { SpinnerIcon as LoaderCircle } from "./icons.jsx";
import { QuestionIcon as CircleHelp } from "./icons.jsx";
import { AddIcon as PlusIcon } from "./icons.jsx";
import { CopyIcon as CopyCheck } from "./icons.jsx";
import { ChevronDownIcon as ChevronDown } from "./icons.jsx";
import { CheckIcon as Check } from "./icons.jsx";
import { ArrowUpIcon as ArrowUp } from "./icons.jsx";
import { ResolveIcon as CircleCheck } from "./icons.jsx";
import { MoreIcon as Ellipsis } from "./icons.jsx";
import { LinkIcon as Link2 } from "./icons.jsx";
import { RepinIcon as MapPinPen } from "./icons.jsx";
import { CopyIcon as CopyPlus } from "./icons.jsx";
import { BeforeAndAfterIcon as GitCompare } from "./icons.jsx";
import { SelectIcon as MousePointerClick } from "./icons.jsx";
import { SelectIcon as Cursor } from "./icons.jsx";
import { PreviewIcon as Eye } from "./icons.jsx";
import { HideIcon as EyeOff } from "./icons.jsx";
import { DragIcon as GripVertical } from "./icons.jsx";
import { BranchIcon as GitBranch } from "./icons.jsx";
import { HistoryIcon as History } from "./icons.jsx";
import { ExternalIcon as ExternalLink } from "./icons.jsx";
import { CommentIcon as MessageSquare } from "./icons.jsx";
import { ThreadsIcon as MessagesSquare } from "./icons.jsx";
import { PauseIcon as Pause } from "./icons.jsx";
import { EditIcon as Pencil } from "./icons.jsx";
import { PlayIcon as Play } from "./icons.jsx";
import { RefreshIcon as RotateCcw } from "./icons.jsx";
import { SearchIcon as Search } from "./icons.jsx";
import { PrivateAreaIcon as ShieldCheck } from "./icons.jsx";
import { StopIcon as Square } from "./icons.jsx";
import { FilterIcon as Filter } from "./icons.jsx";
import { DeleteIcon as Trash2 } from "./icons.jsx";
import { WarningIcon as TriangleAlert } from "./icons.jsx";
import { VideoIcon as Video } from "./icons.jsx";
import { CloseIcon as X } from "./icons.jsx";
import { AiIcon, EditIcon, HideIcon, InboxIcon, ShareIcon, InfoIcon, NextStepsIcon, PollIcon, ResolveIcon, TourIcon } from "./icons.jsx";
import { ShortcutSheet } from "./surfaces/ShortcutSheet.jsx";
import { FaceSheet, LeaveSheet, YouMenu, YouSheet } from "./surfaces/YouSheet.jsx";
import { AiPageReview, AskAiCard } from "./surfaces/AiReview.jsx";
import { pageBrightness } from "./barPrefs.js";
import { SurveyList, SurveyResultsView } from "./surfaces/SurveyResults.jsx";
import { Avatar, EmptyState, Key } from "./ui/primitives.jsx";
import { notificationDay, notificationVerb } from "./notifications.js";
import { surveyResultsCsv, surveyResultsText } from "./surveys/schema.js";
import { ArrowLeftIcon, CaptureIcon, CropIcon, MentionIcon, RegionIcon, SketchIcon } from "./icons.jsx";
import { BarHint, BarStatus, IdleBar } from "./surfaces/Bar.jsx";
import { computePopoverPosition } from "./popover.js";
import {
  addMarkupStroke,
  mapMarkupPoint,
  normalizeDrawRect,
  simplifyMarkupPoints,
  undoMarkupStroke,
} from "./snapshot.js";
import { formatClock } from "./videoRecording.js";
import {
  EVENT_TYPE,
  INCREMENTAL_SOURCE,
  MOUSE_INTERACTION,
  REPLAY_CONSOLE_EVENT,
  REPLAY_NETWORK_EVENT,
  REPLAY_TIMING_EVENT,
  REPLAY_SOCKET_EVENT,
  decodeReplayEvents,
} from "./sessionReplay.js";

const videoModeLabel = (mode) => (mode === "tab" ? "Tab" : mode === "screen" ? "Screen" : "Voice + cursor");

function deferred(loader, name) {
  const Component = lazy(() => loader().then(module => ({ default: module[name] })));
  return function OptionalFeature(props) {
    return <Suspense fallback={null}><Component {...props} /></Suspense>;
  };
}
const loadVideo = () => import('./videoFeatures.jsx');
const BlurPicker = deferred(loadVideo, 'BlurPicker');
const CameraBubble = deferred(loadVideo, 'CameraBubble');
const RecordingCursorLayer = deferred(loadVideo, 'RecordingCursorLayer');
const VideoBlurLayer = deferred(loadVideo, 'VideoBlurLayer');
const VideoDrawLayer = deferred(loadVideo, 'VideoDrawLayer');
const VideoPreview = deferred(loadVideo, 'VideoPreview');
const VideoRecorderBar = deferred(loadVideo, 'VideoRecorderBar');
const VideoSetupPanel = deferred(loadVideo, 'VideoSetupPanel');
const VideoCountdown = deferred(loadVideo, 'VideoCountdown');
const VideoReviewCard = deferred(loadVideo, 'VideoReviewCard');
const VoiceReplay = deferred(loadVideo, 'VoiceReplay');
const TourPanel = deferred(() => import('./TourPanel.jsx'), 'TourPanel');
// Share and the survey builder open only on request, so they stay out of the first load.
const ShareSheet = deferred(() => import('./surfaces/ShareSheet.jsx'), 'ShareSheet');
const SurveyBuilder = deferred(() => import('./surfaces/SurveyBuilder.jsx'), 'SurveyBuilder');

// rrweb's player is large, so it loads only when someone opens a playback.
const ReplayPlayer = lazy(() => import("./ReplayPlayer.jsx"));
const replayKit = Object.freeze({
  EVENT_TYPE,
  INCREMENTAL_SOURCE,
  MOUSE_INTERACTION,
  REPLAY_CONSOLE_EVENT,
  REPLAY_NETWORK_EVENT,
  REPLAY_TIMING_EVENT,
  REPLAY_SOCKET_EVENT,
  decodeReplayEvents,
  formatClock,
});

function replayFacts(summary) {
  const facts = [formatClock(summary?.durationMs)];
  if (summary?.console?.errors) facts.push(`${summary.console.errors} error${summary.console.errors === 1 ? "" : "s"}`);
  if (summary?.network?.failed) facts.push(`${summary.network.failed} failed request${summary.network.failed === 1 ? "" : "s"}`);
  if (summary?.actions?.clicks) facts.push(`${summary.actions.clicks} click${summary.actions.clicks === 1 ? "" : "s"}`);
  return facts.join(" · ");
}

/** Draft playback on a new comment: local to the author, removable until posted. */
function ReplayAttachment({ draft, onToggle, onPreview }) {
  if (draft.status === "capturing") {
    return <p className="tm-replay-attachment tm-replay-attachment--pending" role="status">Preparing playback…</p>;
  }
  if (draft.status !== "ready") return null;
  return (
    <div className={`tm-replay-attachment${draft.removed ? " is-removed" : ""}`}>
      <MonitorPlay {...iconProps} />
      <div>
        <strong>{draft.removed ? "Playback removed" : "Playback attached"}</strong>
        <span>{draft.removed ? "This comment will be posted without it." : `${replayFacts(draft.summary)} · only you can see it until you post`}</span>
      </div>
      {!draft.removed && <button type="button" className="tm-replay-attachment__icon" aria-label="Preview playback" title="Preview" onClick={onPreview}>
        <Play size={15} aria-hidden="true" focusable="false" />
      </button>}
      {draft.removed
        ? <button type="button" onClick={onToggle}>Attach again</button>
        : <button type="button" className="tm-replay-attachment__icon" aria-label="Remove playback" title="Remove" onClick={onToggle}>
          <X size={15} aria-hidden="true" focusable="false" />
        </button>}
    </div>
  );
}

const MIN_SCREENSHOT_SIZE = 24;
const versionDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function trapDialogFocus(event, container) {
  if (event.key !== "Tab" || !container) return;
  const focusable = [...container.querySelectorAll(
    "button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
  )].filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const root = container.getRootNode?.();
  const active = root?.activeElement || container.ownerDocument.activeElement;
  const current = container.contains(event.target) ? event.target : active;
  if (event.shiftKey && (current === first || !container.contains(current))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

const shortBuild = (buildId) => buildId ? String(buildId).slice(0, 12) : "an earlier build";
const quote = (value) => `“${String(value || "").slice(0, 80)}”`;

function restorationTitle(restoration) {
  if (restoration?.status === "changed") return "This element changed";
  if (restoration?.ghost && restoration.rect) return "Element removed";
  return "Target needs repair";
}

function restorationMessage(restoration, annotation) {
  if (!restoration || restoration.status === "resolved") return "";
  if (restoration.status === "changed") {
    const targets = annotation?.payload?.pin ? [annotation.payload.pin.target] : annotation?.payload?.targets || [annotation?.payload?.target];
    const original = targetName(targets[targets.length - 1]);
    return `Commented on build ${shortBuild(annotation?.payload?.buildId)}. Original: ${original} · Now: ${quote(restoration.suggestionLabel)}. Confirm the new location or choose another element.`;
  }
  if (restoration.ghost && restoration.rect) {
    return `Shown where it was on build ${shortBuild(annotation?.payload?.buildId)}. The comment and evidence are preserved; repin it to an element on this page.`;
  }
  if (restoration.status === "partial") {
    return `${restoration.resolvedCount} of ${restoration.total} targets restored. The remaining targets need repair.`;
  }
  if (restoration.status === "ambiguous") {
    return "More than one live element matches this saved target, so Threadmark will not guess.";
  }
  return "The original target is no longer available on this page. The comment and evidence are still preserved.";
}

function Outline({ rect, hover = false, badge, region = false, text = false, grouped = false }) {
  if (!rect) return null;
  return (
    <div
      className={`tm-outline ${hover ? "tm-outline--hover" : ""} ${region ? "tm-outline--region" : ""} ${text ? "tm-outline--text" : ""} ${grouped ? "tm-outline--grouped" : ""}`}
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      aria-hidden="true"
    >
      {badge != null && <span className="tm-badge">{badge}</span>}
    </div>
  );
}

/** Long quotes end on a whole word with an ellipsis, never mid-word. */
export function quoteExcerpt(text, max = 80) {
  const words = String(text || "").replace(/\s+/g, " ").trim();
  if (words.length <= max) return words;
  const cut = words.slice(0, max);
  const atWord = cut.replace(/\s+\S*$/, "");
  return `${(atWord.length >= max * 0.6 ? atWord : cut).replace(/[\s.,;:!?–—-]+$/, "")}…`;
}

function targetName(target) {
  if (target?.kind === "region") return "Drawn region";
  if (target?.kind === "screenshot") return "Screenshot area";
  if (target?.kind === "text") return `“${quoteExcerpt(target.selectedText || target.visibleText || "Selected text")}”`;
  return target?.accessibleName || target?.visibleText || target?.tagName || "Element";
}

function createScreenshotTargetDescriptor(rect, { route = "/", windowRef = window } = {}) {
  const width = Math.max(1, windowRef.innerWidth);
  const height = Math.max(1, windowRef.innerHeight);
  const bounds = {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
  return {
    kind: "screenshot",
    tagName: "html",
    role: "img",
    accessibleName: "Selected screenshot area",
    visibleText: "",
    bounds,
    viewportBounds: bounds,
    pageBounds: {
      ...bounds,
      x: Math.round(rect.left + windowRef.scrollX),
      y: Math.round(rect.top + windowRef.scrollY),
    },
    normalizedBounds: {
      x: rect.left / width,
      y: rect.top / height,
      width: rect.width / width,
      height: rect.height / height,
    },
    viewport: {
      width,
      height,
      scrollX: Math.round(windowRef.scrollX),
      scrollY: Math.round(windowRef.scrollY),
      devicePixelRatio: Number(windowRef.devicePixelRatio) || 1,
      visualScale: Number(windowRef.visualViewport?.scale) || 1,
    },
    locatorCandidates: { stableId: null, id: null, domPath: "" },
    route,
    capturedAt: new Date().toISOString(),
  };
}

function createInteractionPageTarget({ route = "/", windowRef = window } = {}) {
  const width = Math.max(1, windowRef.innerWidth);
  const height = Math.max(1, windowRef.innerHeight);
  return {
    tagName: "html",
    role: "document",
    accessibleName: "Page interaction",
    visibleText: "",
    bounds: { x: 0, y: 0, width, height },
    viewportBounds: { x: 0, y: 0, width, height },
    pageBounds: {
      x: Math.round(windowRef.scrollX),
      y: Math.round(windowRef.scrollY),
      width,
      height,
    },
    normalizedBounds: { x: 0, y: 0, width: 1, height: 1 },
    viewport: {
      width,
      height,
      scrollX: Math.round(windowRef.scrollX),
      scrollY: Math.round(windowRef.scrollY),
      devicePixelRatio: Number(windowRef.devicePixelRatio) || 1,
      visualScale: Number(windowRef.visualViewport?.scale) || 1,
    },
    locatorCandidates: { stableId: null, id: null, domPath: "html" },
    route,
    capturedAt: new Date().toISOString(),
  };
}

function interactionTargetKey(target) {
  return target?.locatorCandidates?.stableId
    || target?.locatorCandidates?.domPath
    || [target?.tagName, target?.role, target?.accessibleName].join(":");
}

function interactionEventLabel(event, targets = []) {
  const target = targets[event.targetIndex];
  const name = target?.accessibleName || target?.visibleText || target?.tagName || "page";
  if (event.type === "click") return `Clicked ${name}`;
  // Form fields are never registered as targets, so their values cannot leak into the trace.
  if (event.type === "input") return target ? `Changed ${name}` : "Changed a form field";
  if (event.type === "keydown") return `Pressed ${event.key === " " ? "Space" : event.key} on ${name}`;
  if (event.type === "scroll") return event.targetIndex == null ? "Scrolled the page" : `Scrolled ${name}`;
  if (event.type === "submit") return `Submitted ${name}`;
  if (event.type === "navigation") return `Navigated to ${event.route}`;
  return event.type;
}

function formatInteractionDuration(durationMs) {
  return `${(Math.max(0, durationMs || 0) / 1000).toFixed(1)}s`;
}

function InteractionPreview({ interaction, targets = [] }) {
  const events = interaction?.events || [];
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || !events.length) return undefined;
    if (activeIndex >= events.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const nextIndex = activeIndex + 1;
    const currentOffset = activeIndex >= 0 ? events[activeIndex].offsetMs : 0;
    const delay = Math.max(120, Math.min(700, events[nextIndex].offsetMs - currentOffset));
    const timer = setTimeout(() => setActiveIndex(nextIndex), delay);
    return () => clearTimeout(timer);
  }, [activeIndex, events, playing]);

  const restart = () => {
    setActiveIndex(-1);
    setPlaying(true);
  };

  return (
    <section className="tm-interaction-preview" aria-label="Recorded interaction">
      <div className="tm-interaction-preview__header">
        <div>
          <strong>{events.length} recorded step{events.length === 1 ? "" : "s"}</strong>
          <span>{formatInteractionDuration(interaction?.durationMs)} interaction trace</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (activeIndex >= events.length - 1) restart();
            else setPlaying((current) => !current);
          }}
          disabled={!events.length}
          aria-label={playing ? "Pause interaction trace" : activeIndex >= events.length - 1 ? "Replay interaction trace" : "Play interaction trace"}
        >
          {activeIndex >= events.length - 1 && !playing
            ? <RotateCcw {...iconProps} />
            : playing ? <Pause {...iconProps} /> : <Play {...iconProps} />}
          {activeIndex >= events.length - 1 && !playing ? "Replay" : playing ? "Pause" : "Play"}
        </button>
      </div>
      <ol className="tm-interaction-events">
        {events.map((event, index) => (
          <li key={`${event.offsetMs}-${event.type}-${index}`} className={activeIndex === index ? "is-active" : ""}>
            <span className="tm-interaction-event__index">{index + 1}</span>
            <span className="tm-interaction-event__label">{interactionEventLabel(event, targets)}</span>
            <time>{formatInteractionDuration(event.offsetMs)}</time>
          </li>
        ))}
      </ol>
      <p className="tm-interaction-privacy"><ShieldCheck {...iconProps} />Typed content and printable keystrokes were not recorded.</p>
    </section>
  );
}

// Before/after comparison opens as its own view above the page, separate from the comment discussion.
function DeploymentComparison({ original, capture, buildId, originalBuildId, targetLabel, onVerify, disabled, onClose, returnFocusRef }) {
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const urlRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = returnFocusRef.current?.querySelector('[aria-label="More thread actions"]');
    const background = [];
    // Isolate both the SDK's other surfaces and the host page across the Shadow DOM boundary.
    for (let node = dialog; node && node !== document.body;) {
      const parent = node.parentNode;
      for (const sibling of parent?.children || []) {
        if (sibling === node || sibling.matches(".tm-compare-backdrop, style, script, link")) continue;
        background.push([sibling, sibling.inert]);
        sibling.inert = true;
      }
      node = parent?.host || parent;
    }
    closeRef.current?.focus();
    return () => {
      for (const [element, wasInert] of background) element.inert = wasInert;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocusRef]);
  useEffect(() => () => { generation.current++; if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const compare = async () => {
    const request = ++generation.current;
    setLoading(true); setError(""); setCurrent(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    try {
      const result = await capture();
      if (request !== generation.current) return;
      urlRef.current = URL.createObjectURL(result.blob); setCurrent(urlRef.current);
    } catch (failure) { if (request === generation.current) setError(failure.message || "Current screenshot unavailable"); }
    if (request === generation.current) setLoading(false);
  };
  // Choosing Compare is the request to capture, so it starts immediately.
  useEffect(() => { compare(); closeRef.current?.focus(); }, []);
  const verify = (result) => { onVerify(result); onClose(); };
  return <>
    <div className="tm-compare-backdrop" aria-hidden="true" onClick={onClose} />
    <section ref={dialogRef} className="tm-compare" role="dialog" aria-modal="true" aria-label="Deployment comparison" data-menu-open="true"
      onKeyDown={(event) => {
        trapDialogFocus(event, event.currentTarget);
        if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      }}>
      <header className="tm-compare__header">
        <div>
          <strong>Compare with current page</strong>
          {targetLabel && <span>{targetLabel}</span>}
        </div>
        <button type="button" disabled={loading || disabled} onClick={compare}><RotateCcw size={14} />Recapture</button>
        <button type="button" ref={closeRef} aria-label="Close comparison" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="tm-compare__images">
        <figure>
          <figcaption>Original · {originalBuildId || "Unknown build"}</figcaption>
          {original?.snapshot?.previewUrl ? <img src={original.snapshot.previewUrl} alt="Original deployment" /> : <p className="tm-compare__empty">Original screenshot unavailable</p>}
        </figure>
        <figure>
          <figcaption>Current · {buildId || "Unknown build"}</figcaption>
          {current
            ? <img src={current} alt="Current deployment" />
            : <p className="tm-compare__empty" role={error ? "alert" : undefined}>{error || (loading ? "Capturing current page…" : "Current screenshot unavailable")}</p>}
        </figure>
      </div>
      <footer className="tm-compare__footer">
        <p>This comparison stays local. Verifying records the build and reviewer; it does not resolve the comment.</p>
        <button type="button" className="tm-cancel" disabled={disabled || !current} onClick={() => verify("verification_failed")}>Still needs work</button>
        <button type="button" className="tm-submit" disabled={disabled || !current} onClick={() => verify("verified")}>Mark fix verified</button>
      </footer>
    </section>
  </>;
}

/**
 * A saved screenshot we can show as an image: captured (not "unavailable"), with an image type. Videos and
 * session replays are evidence too, but they aren't pictures; showing one as an <img> draws a broken image.
 */
function isImageEvidence(annotation, item) {
  if (!item || !(item.blob || item.url)) return false;
  const metadata = annotation?.payload?.evidence?.find((entry) => entry.id === item.id);
  if (!metadata || metadata.kind === "recording" || metadata.kind === "replay" || metadata.quality === "unavailable") return false;
  const type = item.blob?.type || metadata.mimeType || "";
  return !type || type.startsWith("image/");
}

function CommentThumbnail({ annotation }) {
  const evidence = annotation.runtime?.evidence
    ?.find((item) => isImageEvidence(annotation, item));
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!evidence?.blob) { setUrl(evidence?.url || null); return; }
    const next = URL.createObjectURL(evidence.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [evidence?.blob, evidence?.url]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? <img className="tm-comment-thumbnail" src={url} alt="Saved screenshot" onError={() => setFailed(true)} /> : null;
}

const NEXT_STEP_TAG_LABELS = { bug: "Bug", polish: "Polish", copy: "Copy", idea: "Idea", question: "Question" };

function nextStepsStatusLine(status) {
  if (status.state === "generating") return "Updating from the latest feedback…";
  if (status.state === "pending") return "New feedback came in. The list updates shortly.";
  if (status.state === "failed") return `Couldn't update the list${status.error ? `: ${status.error}` : "."}`;
  if (status.state === "off" || !status.generatedAt) return null;
  const ago = formatMessageTime(status.generatedAt);
  return ago === "Now" ? "Updated just now" : /^\d+[mh]$/.test(ago) ? `Updated ${ago} ago` : `Updated ${ago}`;
}

function nextStepProvenance(step) {
  if (step.completed) {
    if (step.completedVia === "resolved") return "Done: every thread behind it was resolved";
    return `Done${step.completedBy ? ` by ${step.completedBy.displayName}` : ""}${step.completedVia === "agent" ? " through an AI agent" : ""}`;
  }
  return step.source === "person" ? "Added by your team" : "Suggested from reviewers' feedback";
}

function NextStepRow({ step, open, onToggle, canTick, onDone, onOpenSource }) {
  return (
    <li className={`tm-next-step${step.completed ? " is-done" : ""}${open ? " is-open" : ""}`}>
      <div className="tm-next-step__row">
        <input type="checkbox" className="tm-next-step__check" checked={step.completed} disabled={!canTick}
          onChange={(event) => onDone(step, event.target.checked)}
          aria-label={`${step.completed ? "Mark not done" : "Mark done"}: ${step.title}`} />
        <button type="button" className="tm-next-step__summary" aria-expanded={open} onClick={onToggle}>
          <span className="tm-next-step__title">{step.title}</span>
          {(step.tag || step.sources.length > 0 || step.completedVia === "agent") && <span className="tm-next-step__meta">
            {step.tag && <span className={`tm-step-tag tm-step-tag--${step.tag}`}>{NEXT_STEP_TAG_LABELS[step.tag]}</span>}
            {step.sources.length > 0 && <span className="tm-next-step__count"><MessageSquare size={12} aria-hidden="true" />{step.sources.length}</span>}
            {step.completedVia === "agent" && <span className="tm-next-step__count"><Bot size={12} aria-hidden="true" />Agent</span>}
          </span>}
        </button>
      </div>
      {open && <div className="tm-next-step__details">
        {step.notes && <p className="tm-next-step__notes">{step.notes}</p>}
        {step.sources.length > 0 && <ul className="tm-next-step__sources" aria-label="Feedback behind this step">
          {step.sources.map((source) => <li key={source.feedbackId}>
            <button type="button" onClick={() => onOpenSource(source)}>
              <span className="tm-next-step__source-who">
                <strong>{source.author || "Reviewer"}</strong>
                {source.route && <span>{source.route}</span>}
                {source.status === "resolved" && <span className="tm-next-step__resolved">Resolved</span>}
              </span>
              {source.quote && <q>{source.quote}</q>}
            </button>
          </li>)}
        </ul>}
        <p className="tm-next-step__provenance">{nextStepProvenance(step)}</p>
      </div>}
    </li>
  );
}

/** The host's next steps: a checklist to tick off, each step opening to the feedback behind it. */
function NextStepsTab({ nextSteps, canTick, onDone, onOpenSource }) {
  const [openId, setOpenId] = useState(null);
  const [showDone, setShowDone] = useState(true);
  const open = nextSteps.steps.filter((step) => !step.completed);
  const done = nextSteps.steps.filter((step) => step.completed);
  const total = nextSteps.steps.length;
  const working = nextSteps.status.state === "generating" || nextSteps.status.state === "pending";
  const statusLine = nextStepsStatusLine(nextSteps.status);
  const row = (step) => <NextStepRow key={step.id} step={step} open={openId === step.id} canTick={canTick}
    onToggle={() => setOpenId((current) => current === step.id ? null : step.id)} onDone={onDone} onOpenSource={onOpenSource} />;
  return (
    <div className="tm-next-steps" role="tabpanel" aria-label="Next steps">
      {(total > 0 || statusLine) && <div className="tm-next-steps__summary">
        {total > 0 && <>
          <p className="tm-next-steps__progress"><strong>{done.length} of {total}</strong> done</p>
          <div className="tm-next-steps__bar" role="progressbar" aria-label="Steps done" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.length}>
            <span style={{ width: `${Math.round((done.length / total) * 100)}%` }} />
          </div>
        </>}
        {statusLine && <p className={`tm-next-steps__status${nextSteps.status.state === "failed" ? " is-warn" : ""}`} role="status">
          {working && <LoaderCircle size={12} className="tm-next-steps__spin" aria-hidden="true" />}{statusLine}
        </p>}
      </div>}
      {total === 0 ? <div className="tm-comments-empty"><ListChecks size={26} />
        <strong>{working ? "Writing next steps…" : "Waiting on feedback"}</strong>
        <p>{working ? "They appear here in a moment." : "Comments turn into clear next steps as they come in."}</p>
      </div> : <>
        <ol className="tm-next-steps__list">{open.map(row)}</ol>
        {open.length === 0 && <p className="tm-next-steps__all-done">Everything here is done.</p>}
        {done.length > 0 && <div className="tm-next-steps__done">
          <button type="button" className="tm-next-steps__done-toggle" aria-expanded={showDone} onClick={() => setShowDone((current) => !current)}>
            <ChevronDown size={14} aria-hidden="true" />Done ({done.length})
          </button>
          {showDone && <ol className="tm-next-steps__list">{done.map(row)}</ol>}
        </div>}
      </>}
    </div>
  );
}

// Inbox: replies, mentions and other things that need you, newest first (Figma "Inbox item").
function deepActiveElement() {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Puts focus back on whatever opened a sheet or card once it closes. */
function useReturnFocus(open) {
  const opener = useRef(null);
  useEffect(() => {
    if (open) { opener.current = deepActiveElement(); return; }
    const element = opener.current;
    opener.current = null;
    if (element?.isConnected) element.focus?.({ preventScroll: true });
  }, [Boolean(open)]);
}

/** "/" reads as a stray character on its own; call it Home. */
export function routeLabel(route) {
  return route === "/" ? "Home" : route;
}

/**
 * The Inbox (board 05, 17b and 19a): only what involves you, across every page. Unread or All, grouped
 * into Today and Earlier, each row saying who did what, the words, and where.
 */
function InboxList({ notifications, members = [], onOpen, onMarkAllRead, onOpenSettings }) {
  const unread = notifications.filter((item) => !item.read).length;
  const [view, setView] = useState(unread ? "unread" : "all");
  if (!notifications.length) {
    return (
      <div className="tm-inbox-empty">
        <span className="tm-inbox-empty__icon"><Check size={18} aria-hidden="true" focusable="false" /></span>
        <strong>Nothing needs you</strong>
        <p>Mentions, replies to your comments and things assigned to you will show up here.</p>
        {onOpenSettings && <button type="button" onClick={onOpenSettings}>Notification settings</button>}
      </div>
    );
  }
  const shown = view === "unread" ? notifications.filter((item) => !item.read) : notifications;
  const groups = ["Today", "Earlier"].map((day) => [day, shown.filter((item) => notificationDay(item) === day)]).filter(([, items]) => items.length);
  // Faces come from the project's members when the host didn't send one with the notification.
  const face = (actor) => actor.avatarUrl || members.find((member) => member.id && member.id === actor.id)?.avatarUrl || null;
  return (
    <>
      <div className="tm-inbox-head">
        <div className="tm-inbox-views" role="radiogroup" aria-label="Show">
          <button type="button" role="radio" aria-checked={view === "unread"} className={view === "unread" ? "is-active" : ""} onClick={() => setView("unread")}>
            Unread{unread > 0 && <span className="tm-inbox-views__count">{unread}</span>}
          </button>
          <button type="button" role="radio" aria-checked={view === "all"} className={view === "all" ? "is-active" : ""} onClick={() => setView("all")}>All</button>
        </div>
        {unread > 0 && onMarkAllRead && <button type="button" className="tm-inbox-markall" onClick={onMarkAllRead}>Mark all read</button>}
      </div>
      {!shown.length ? (
        <div className="tm-inbox-empty tm-inbox-empty--caught-up">
          <span className="tm-inbox-empty__icon"><Check size={18} aria-hidden="true" focusable="false" /></span>
          <strong>You’re all caught up</strong>
          <button type="button" onClick={() => setView("all")}>Show all</button>
        </div>
      ) : (
        <div className="tm-inbox" aria-label="Inbox">
          {groups.map(([day, items]) => (
            <section key={day} className="tm-inbox-group" aria-label={day}>
              <h3>{day}</h3>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`tm-inbox-item${item.read ? "" : " is-unread"}`} onClick={() => onOpen?.(item)}>
                      <Avatar name={item.actor.displayName} src={face(item.actor)} size={20} />
                      <span className="tm-inbox-item__body">
                        <span className="tm-inbox-item__meta">
                          <span className="tm-inbox-item__line"><strong>{item.actor.displayName.split(/\s+/)[0]}</strong> {notificationVerb(item)}</span>
                          {item.createdAt && <time dateTime={item.createdAt}>{formatShortAge(item.createdAt)}</time>}
                          {!item.read && <span className="tm-inbox-item__dot"><span className="tm-sr-only">Unread</span></span>}
                        </span>
                        <span className="tm-inbox-item__text">{item.text}</span>
                        {(item.route || item.target) && (
                          <span className="tm-inbox-item__route">{[item.route && routeLabel(item.route), item.target].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** "2m", "1h", "2d", then the date: the Inbox's quiet timestamps (17b). */
function formatShortAge(iso, now = Date.now()) {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AllCommentsPanel({ annotations, restorations, reviewer, route, hidden, onClose, onOpen, tab, onTabChange, pageVersions, onSelectPageVersion,
  nextSteps, canTickNextSteps, onNextStepDone, onOpenNextStepSource, onCopyNextSteps, notifications = null, onOpenNotification, onNotificationsSeen,
  surveys = null, surveyResults = {}, openSurveyId = null, onOpenSurvey, onSurveyEnd, onOpenYou = null, onOpenShare = null, members = [], youMenu = null, onNotice = null }) {
  const [halfSheet, setHalfSheet] = useState(false);
  const [youMenuOpen, setYouMenuOpen] = useState(false);
  const youButtonRef = useRef(null);
  const searchToggleRef = useRef(null);
  // Items are marked read when opened (board 05, 17c), or all at once with Mark all read; never just by looking.
  const unreadNotifications = notifications ? notifications.filter((item) => !item.read) : [];
  const [controls, setControls] = useState("collapsed");
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState("");
  const [build, setBuild] = useState("");
  const searchRef = useRef(null);
  const filterButtonRef = useRef(null);
  const filterMenuRef = useRef(null);
  useEffect(() => {
    if (!hidden && controls === "search") searchRef.current?.focus();
  }, [controls, hidden]);
  useEffect(() => {
    if (hidden || tab !== "comments") setFilterOpen(false);
  }, [hidden, tab]);
  useEffect(() => {
    if (!filterOpen || hidden || tab !== "comments") return undefined;
    filterMenuRef.current?.querySelector("button:not(:disabled)")?.focus();
    const dismissOutside = (event) => {
      const path = event.composedPath();
      if (!path.includes(filterMenuRef.current) && !path.includes(filterButtonRef.current)) setFilterOpen(false);
    };
    const documentRef = filterButtonRef.current?.ownerDocument;
    const rootRef = filterButtonRef.current?.getRootNode();
    documentRef?.addEventListener("pointerdown", dismissOutside, true);
    documentRef?.addEventListener("focusin", dismissOutside, true);
    // Focus moves within a Shadow DOM are retargeted away at the document boundary.
    if (rootRef !== documentRef) rootRef?.addEventListener("focusin", dismissOutside, true);
    return () => {
      documentRef?.removeEventListener("pointerdown", dismissOutside, true);
      documentRef?.removeEventListener("focusin", dismissOutside, true);
      if (rootRef !== documentRef) rootRef?.removeEventListener("focusin", dismissOutside, true);
    };
  }, [filterOpen, hidden, tab]);
  const searchCache = useRef(new WeakMap());
  const model = useMemo(() => {
    const authors = new Map(), numbers = new Map(), searchText = new Map(), pages = new Set([route]), builds = new Set();
    annotations.forEach((item, index) => {
      const feedback = item.payload;
      if (feedback.author?.id) authors.set(feedback.author.id, feedback.author);
      if (!numbers.has(item.id)) numbers.set(item.id, index + 1);
      if (!searchCache.current.has(feedback)) searchCache.current.set(feedback, [feedback.comment, feedback.author?.displayName,
        targetName(feedback.pin?.target || feedback.target), ...(feedback.replies || []).map(reply => reply.comment)]
        .filter(Boolean).join(" ").toLowerCase());
      searchText.set(item.id, searchCache.current.get(feedback));
      pages.add(feedback.route); if (feedback.buildId) builds.add(feedback.buildId);
    });
    return { authors: [...authors.values()], numbers, searchText, pages: [...pages], builds: [...builds] };
  }, [annotations, route]);
  const authors = model.authors;
  const needsRepair = (item) => restorations[item.id] && restorations[item.id].status !== "resolved";
  const search = query.trim().toLowerCase();
  const activeFilterCount = [
    reviewerId,
    filter === "repair" ? filter : "",
    status === "all" ? "" : status,
    page,
    build,
  ].filter(Boolean).length;
  const repairFilter = filter === "repair" ? restorations : null;
  const visible = useMemo(() => annotations.filter((item) => {
    const feedback = item.payload;
    return (!reviewerId || feedback.author?.id === reviewerId)
      && (filter !== "repair" || needsRepair(item))
      && (status === "all" || (feedback.workflow?.status || "open") === status)
      && (!page || feedback.route === page)
      && (!build || feedback.buildId === build)
      && (!search || model.searchText.get(item.id).includes(search));
  }), [annotations, model, reviewerId, filter, status, page, build, search, repairFilter]);
  return (
    <>
    {/* Tablets in portrait: the panel is a drawer over a dimmed page; tapping the page closes it (board 11, 36b). */}
    {!hidden && <div className="tm-panel-scrim" aria-hidden="true" onClick={onClose} />}
    <aside id="tm-all-comments" className={`tm-comments-panel${halfSheet ? " is-half" : ""}`} aria-label="Feedback" hidden={hidden}
      data-menu-open={filterOpen ? "true" : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && filterOpen) {
          event.preventDefault();
          event.stopPropagation();
          setFilterOpen(false);
          filterButtonRef.current?.focus();
        } else if (event.key === "Escape" && controls === "search" && event.target.closest?.(".tm-comments-search")) {
          // Esc closes the search first, not the whole panel; a typed query is kept until cleared.
          event.preventDefault();
          event.stopPropagation();
          setControls("collapsed");
          searchToggleRef.current?.focus();
        }
      }}>
      {/* Phones: a tall sheet you can drop to half height to see the page while you read (35d). */}
      <button type="button" className="tm-sheet-handle" aria-label={halfSheet ? "Make the panel taller" : "Make the panel shorter"}
        aria-pressed={halfSheet} onClick={() => setHalfSheet((value) => !value)} />
      <header className="tm-comments-header">
        <h2 className="tm-sr-only">Feedback</h2>
        {/* Icon-only once there's more than one view, so three tabs and the header buttons fit a 360px panel. */}
        <div className={`tm-panel-tabs${notifications || nextSteps ? " is-icon-only" : ""}`} role="tablist" aria-label="Feedback views">
          <button type="button" role="tab" aria-selected={tab === "comments"} title="Activity" onClick={() => onTabChange("comments")}>
            <MessagesSquare aria-hidden="true" focusable="false" className="tm-panel-tabs__icon" />
            <span className="tm-panel-tabs__label">Activity</span> <span className="tm-sr-only">{annotations.length}</span>
          </button>
          {notifications && <button type="button" role="tab" aria-selected={tab === "inbox"} title="Inbox" onClick={() => onTabChange("inbox")}>
            <InboxIcon aria-hidden="true" focusable="false" className="tm-panel-tabs__icon" /><span className="tm-panel-tabs__label">Inbox</span>
            {unreadNotifications.length > 0 && <span className="tm-panel-tabs__badge">{unreadNotifications.length}<span className="tm-sr-only"> unread</span></span>}
          </button>}
          {nextSteps && <button type="button" role="tab" aria-selected={tab === "next-steps"} title="Next steps" onClick={() => onTabChange("next-steps")}>
            <NextStepsIcon aria-hidden="true" focusable="false" className="tm-panel-tabs__icon" /><span className="tm-panel-tabs__label">Next steps</span> <span className="tm-sr-only">{nextSteps.steps.filter((step) => !step.completed).length}</span>
          </button>}
        </div>
        <div className="tm-comments-actions">
          {tab === "comments" && <><button ref={searchToggleRef} type="button" className={controls === "search" || query ? "is-active" : undefined}
            aria-label={controls === "search" ? "Hide search comments" : "Show search comments"}
            aria-controls="tm-comments-search-controls" aria-expanded={controls === "search"}
            onClick={() => setControls((current) => current === "search" ? "collapsed" : "search")}>
            <Search size={17} />
          </button>
          <div className="tm-comments-filter-anchor">
          <button ref={filterButtonRef} type="button" className={filterOpen || activeFilterCount ? "is-active" : undefined}
            aria-label={filterOpen ? "Hide comment filters" : `Show comment filters${activeFilterCount ? ` (${activeFilterCount} active)` : ""}`}
            aria-haspopup="dialog" aria-controls="tm-comments-filter-controls" aria-expanded={filterOpen}
            onClick={() => { setAdvancedFilters(false); setFilterOpen((current) => !current); }}>
            <Filter size={17} />
            {activeFilterCount > 0 && <span className="tm-comments-filter-count" aria-hidden="true">{activeFilterCount}</span>}
          </button>
          {filterOpen && <div ref={filterMenuRef} id="tm-comments-filter-controls" className="tm-comments-filter-menu" role="dialog" aria-label="Comment filters">
            <div className="tm-comments-filter-options">
              <button type="button" aria-pressed={status !== "open"} onClick={() => setStatus((current) => current === "open" ? "all" : "open")}>
                <Check size={16} aria-hidden="true" /><span>Show resolved comments</span>
              </button>
              <button type="button" aria-pressed={Boolean(reviewer?.id && reviewerId === reviewer.id)} disabled={!reviewer?.id}
                onClick={() => setReviewerId((current) => current === reviewer.id ? "" : reviewer.id)}>
                <Check size={16} aria-hidden="true" /><span>Only your threads</span>
              </button>
              <button type="button" aria-pressed={page === route} onClick={() => setPage((current) => current === route ? "" : route)}>
                <Check size={16} aria-hidden="true" /><span>Only current page</span>
              </button>
              <button type="button" aria-pressed={filter === "repair"} onClick={() => setFilter((current) => current === "repair" ? "all" : "repair")}>
                <Check size={16} aria-hidden="true" /><span>Needs target repair</span>
              </button>
            </div>
            <div className="tm-comments-filter-more">
              <button type="button" aria-expanded={advancedFilters} aria-controls="tm-comments-advanced-filters" onClick={() => setAdvancedFilters((current) => !current)}>
                <ChevronDown size={16} aria-hidden="true" /><span>More filters</span>
              </button>
              {advancedFilters && <div id="tm-comments-advanced-filters" className="tm-comments-filters">
                <label>Reviewer<select aria-label="Filter comments by reviewer" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
                  <option value="">All reviewers</option>
                  {authors.map((author) => <option value={author.id} key={author.id}>{author.displayName}</option>)}
                  {reviewer?.id && !authors.some((author) => author.id === reviewer.id) && <option value={reviewer.id}>{reviewer.displayName || "You"}</option>}
                </select></label>
                <label>Target<select aria-label="Filter comments by target" value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">All targets</option><option value="repair">Needs repair</option>
                </select></label>
                <label>Status<select aria-label="Filter comments by status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">All statuses</option><option value="open">Open</option><option value="resolved">Resolved</option>
                </select></label>
                <label>Page<select aria-label="Filter comments by page" value={page} onChange={(event) => setPage(event.target.value)}>
                  <option value="">All pages</option>{model.pages.map((value) => <option key={value}>{value}</option>)}
                </select></label>
                <label>Deployment<select aria-label="Filter comments by deployment" value={build} onChange={(event) => setBuild(event.target.value)}>
                  <option value="">All deployments</option>{model.builds.map((value) => <option key={value}>{value}</option>)}
                </select></label>
              </div>}
            </div>
            {activeFilterCount > 0 && <button className="tm-comments-filter-reset" type="button" onClick={() => { setReviewerId(""); setFilter("all"); setStatus("all"); setPage(""); setBuild(""); }}>
              <RotateCcw size={16} aria-hidden="true" /><span>Reset filters</span>
            </button>}
          </div>}
          </div></>}
          {tab === "next-steps" && onCopyNextSteps && <button type="button" aria-label="Copy the open steps for an AI agent" title="Copy the open steps as a prompt for an AI agent"
            disabled={!nextSteps?.steps.some((step) => !step.completed)} onClick={onCopyNextSteps}>
            <Bot size={17} />
          </button>}
          {onOpenShare && <button type="button" className="tm-comments-share" aria-label="Share" title="Share" onClick={onOpenShare}>
            <ShareIcon size={16} aria-hidden="true" focusable="false" />
          </button>}
          {youMenu && <span className="tm-comments-you-wrap">
            <button ref={youButtonRef} type="button" className="tm-comments-you" aria-label="You" title="You" aria-haspopup="menu" aria-expanded={youMenuOpen}
              onClick={() => setYouMenuOpen((open) => !open)}>
              <Avatar name={reviewer?.displayName} src={reviewer?.avatarUrl} size={20} />
            </button>
            {youMenuOpen && <YouMenu reviewer={reviewer} email={youMenu.email} onFace={youMenu.onFace} onSettings={youMenu.onSettings}
              onShortcuts={youMenu.onShortcuts} onHide={youMenu.onHide} onSignOut={youMenu.onSignOut}
              onClose={() => { setYouMenuOpen(false); requestAnimationFrame(() => youButtonRef.current?.focus()); }} />}
          </span>}
          <button type="button" aria-label="Close feedback panel" onClick={onClose}><X size={18} /></button>
        </div>
      </header>
      {tab === "inbox" && notifications ? <InboxList notifications={notifications} members={members} onOpenSettings={onOpenYou}
        onOpen={(item) => { if (!item.read) onNotificationsSeen?.([item.id]); onOpenNotification?.(item); }}
        onMarkAllRead={onNotificationsSeen ? () => onNotificationsSeen(unreadNotifications.map((item) => item.id)) : null} />
        : tab === "next-steps" && nextSteps ? <NextStepsTab nextSteps={nextSteps} canTick={canTickNextSteps} onDone={onNextStepDone} onOpenSource={onOpenNextStepSource} />
        : openSurveyId && surveys?.some((survey) => survey.id === openSurveyId) ? (() => {
          const survey = surveys.find((item) => item.id === openSurveyId);
          return <SurveyResultsView survey={survey} results={surveyResults[survey.id]} onBack={() => onOpenSurvey(null)}
            onEnd={onSurveyEnd ? (item) => onSurveyEnd(item) : null}
            onExport={(item) => {
              // Export: a CSV of the spread and every written answer, saved by the browser.
              const blob = new Blob([surveyResultsCsv(item, surveyResults[item.id])], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${String(item.question.text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "survey"}-answers.csv`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            onShare={async (item) => {
              try {
                await navigator.clipboard.writeText(surveyResultsText(item, surveyResults[item.id]));
                onNotice?.("Results copied");
              } catch {
                onNotice?.("Couldn’t copy the results");
              }
            }} />;
        })() : <>
      {surveys && surveys.length > 0 && !query && <SurveyList surveys={surveys} results={surveyResults} onOpen={onOpenSurvey} />}
      {controls === "search" && <div id="tm-comments-search-controls" className="tm-comments-search" data-menu-open="true">
        <input ref={searchRef} aria-label="Search comments" placeholder="Search comments and replies…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>}
      <p className="tm-comments-count"><span>Comments</span><span role="status">{visible.length} of {annotations.length} threads</span></p>
      <VirtualCommentList items={visible} hidden={hidden} resetKey={JSON.stringify([search, reviewerId, filter, status, page, build])} renderRow={(annotation) => {
          const feedback = annotation.payload;
          const number = model.numbers.get(annotation.id);
          return <>
            <button className="tm-comment-card" type="button" aria-label={`Open comment ${number}: ${feedback.comment}`} onClick={() => onOpen(annotation.id)}>
              <span className="tm-comment-author"><span className="tm-comment-avatar">{(() => {
                const face = feedback.author?.id && feedback.author.id === reviewer?.id ? reviewer?.avatarUrl : feedback.author?.avatarUrl;
                return face ? <img src={face} alt="" /> : reviewerInitials(feedback.author);
              })()}</span>
                <strong>{feedback.author?.displayName || "Unknown reviewer"}{reviewer?.id && feedback.author?.id === reviewer.id ? " · You" : ""}</strong>
                <time dateTime={feedback.createdAt}>{formatMessageTime(feedback.createdAt)}</time>
              </span>
              <span className="tm-comment-copy">{feedback.comment}</span>
              {feedback.ask?.kind === "poll" && feedback.ask.options?.length > 0 && (
                <PollSummary ask={feedback.ask} results={annotation.poll} closed={feedback.workflow?.status === "resolved"} />
              )}
              <CommentThumbnail annotation={annotation} />
              <span className="tm-comment-target">#{number} · {targetName(feedback.pin?.target || feedback.target)}</span>
              <span className="tm-comment-meta">
                <span>{feedback.workflow?.status === "resolved" ? "Resolved" : "Open"}</span>
                <span>{routeLabel(feedback.route)}</span>
                {feedback.workflow?.assignee && <span>Assigned to {feedback.workflow.assignee.displayName}</span>}
                {feedback.links?.length > 0 && <CommentLinks links={feedback.links} plain />}
                {["ai", "ai_review"].includes(feedback.source) && <span className="tm-from-ai">From an AI review</span>}
                <span>{(feedback.replies || []).length} replies</span>
                {needsRepair(annotation) && <span className="tm-comment-repair"><TriangleAlert size={12} /> Target needs repair</span>}
                {feedback.evidence?.some((item) => item.quality === "unavailable") && <span>Screenshot unavailable</span>}
              </span>
            </button>
          </>;
        }} />
      {!visible.length && <div className="tm-comments-empty"><MessageSquare size={26} />
        <strong>{annotations.length ? "No matching comments" : "No comments yet"}</strong>
        <p>{annotations.length ? "Try another search or clear your filters." : "Close this panel and select an element to leave your first comment."}</p>
        {annotations.length > 0 && <button type="button" onClick={() => { setQuery(""); setReviewerId(""); setFilter("all"); setStatus("all"); setPage(""); setBuild(""); }}>Clear filters</button>}
      </div>}
      </>}
    </aside>
    </>
  );
}

function SnapshotPreview({ selection, readOnly = false, onRetry }) {
  const snapshot = selection?.snapshot;
  if (!snapshot) return null;

  return (
    <div className="tm-snapshot" role="group" aria-label="Snapshot evidence">
      {snapshot.status === "capturing" && (
        <div className="tm-snapshot__state"><span className="tm-spinner" />Capturing this region…</div>
      )}
      {snapshot.status === "ready" && snapshot.previewUrl && (
        <>
          <div style={{ position: "relative" }}>
            {readOnly
              ? <a className="tm-snapshot__open" href={snapshot.previewUrl} target="_blank" rel="noopener noreferrer" title="Open full screenshot">
                <img src={snapshot.previewUrl} alt="Saved screenshot. Opens the full image" />
              </a>
              : <img src={snapshot.previewUrl} alt="Preview of the selected page region" />}
            {snapshot.metadata.capture?.pin && <span aria-label="Original pin location" style={{ position: "absolute",
              left: `${snapshot.metadata.capture.pin.x * 100}%`, top: `${snapshot.metadata.capture.pin.y * 100}%`,
              width: 14, height: 14, borderRadius: "50%", background: "#f15722", border: "2px solid white", transform: "translate(-50%, -50%)" }} />}
          </div>
        </>
      )}
      {snapshot.status === "failed" && (readOnly
        /* A posted comment: say what happened, quietly. There is nothing to do about it now. */
        ? <p className="tm-snapshot__note">No screenshot. It couldn’t be taken when this was posted.</p>
        : (
          <div className="tm-snapshot__state tm-snapshot__state--error">
            <span>The screenshot couldn’t be taken. You can still post your comment.</span>
            {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
          </div>
        ))}
    </div>
  );
}

const iconProps = {
  "aria-hidden": true,
  className: "tm-tool-icon",
  focusable: "false",
};

function CloseIcon() {
  return <X {...iconProps} className="tm-close-icon" />;
}

function PauseIcon({ paused }) {
  return paused ? <Play {...iconProps} /> : <Pause {...iconProps} />;
}

function EyeIcon({ hidden }) {
  return hidden ? <EyeOff {...iconProps} /> : <Eye {...iconProps} />;
}

function CopyIcon() {
  return <CopyCheck {...iconProps} />;
}

function LinkIcon() {
  return <Link2 {...iconProps} />;
}

function HistoryIcon() {
  return <History {...iconProps} />;
}

function ChevronDownIcon() {
  return <ChevronDown {...iconProps} className="tm-disclosure-icon" />;
}

function WarningIcon() {
  return <TriangleAlert {...iconProps} />;
}

function PencilIcon() {
  return <Pencil {...iconProps} />;
}

function InteractionIcon() {
  return <MousePointerClick {...iconProps} />;
}

function VideoIcon() {
  return <Video {...iconProps} />;
}

function StopIcon() {
  return <Square {...iconProps} />;
}

function ClearIcon() {
  return <Trash2 {...iconProps} />;
}

function GripIcon() {
  return <GripVertical {...iconProps} />;
}

// A toolbar dropdown: focus moves into it on open, arrow keys move between items, and Escape or
// Tab closes it and returns focus to the button that opened it.
function ToolbarMenu({ id, label, below, triggerRef, onClose, children }) {
  const menuRef = useRef(null);
  const items = () => [...(menuRef.current?.querySelectorAll('[role^="menuitem"]:not(:disabled)') || [])];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const enabled = items();
      (enabled.find((item) => item.dataset.autofocus === "true") || enabled[0])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const close = (event) => {
      const path = event.composedPath();
      if (path.includes(menuRef.current) || path.includes(triggerRef.current)) return;
      onClose(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [onClose, triggerRef]);

  const onKeyDown = (event) => {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
      onClose(event.key === "Escape");
      return;
    }
    const enabled = items();
    const index = enabled.indexOf(menuRef.current?.getRootNode().activeElement);
    const next = {
      ArrowDown: enabled[(index + 1) % enabled.length],
      ArrowUp: enabled[(index - 1 + enabled.length) % enabled.length],
      Home: enabled[0],
      End: enabled[enabled.length - 1],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  return (
    <div ref={menuRef} id={id} className={`tm-toolbar-menu${below ? " tm-toolbar-menu--below" : ""}`} role="menu" aria-label={label}
      data-menu-open="true" onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

function ToolbarMenuItem({ icon, label, description, shortcut, keyshortcuts, checked, danger, badge, ...props }) {
  return (
    <button type="button" role={typeof checked === "boolean" ? "menuitemcheckbox" : "menuitem"} aria-checked={checked}
      aria-keyshortcuts={keyshortcuts} className={danger ? "is-danger" : undefined} {...props}>
      <span className={`tm-toolbar-menu__icon${description ? " tm-toolbar-menu__icon--tile" : ""}`}>{icon}</span>
      <span className="tm-toolbar-menu__text">
        <span className="tm-toolbar-menu__label">{label}</span>
        {description && <span className="tm-toolbar-menu__description">{description}</span>}
      </span>
      {typeof checked === "boolean" && <Check size={15} className={`tm-toolbar-menu__check${checked ? "" : " is-off"}`} aria-hidden="true" />}
      {badge}
      {shortcut && <kbd aria-hidden="true">{shortcut}</kbd>}
    </button>
  );
}

function ToolButton({ active, disabled = false, icon, label, onClick }) {
  return (
    <button
      type="button"
      className={active ? "is-active" : ""}
      aria-label={label}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function formatVersionDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return versionDateFormatter.format(date);
}

function versionMeta(version) {
  if (version.branch && version.commitSha) return `${version.branch} · ${version.commitSha.slice(0, 7)}`;
  return version.branch || version.commitSha?.slice(0, 7) || version.environment || "Deployment";
}

function VersionState({ version }) {
  if (version.current) return <span className="tm-version-state tm-version-state--current">Current</span>;
  if (version.state === "ready") return null;
  return <span className={`tm-version-state tm-version-state--${version.state}`}>{version.state}</span>;
}

// Board 02, 6c: three colours, nothing more.
const MARKUP_COLORS = [
  { value: "#f15722", label: "Orange" },
  { value: "#e0f354", label: "Lime" },
  { value: "#ffffff", label: "White" },
];

const MARKUP_PEN_WIDTH = 4;

/**
 * The Capture bar (board 02, 6a-6c): Box (B), Pen (P), Whole view (W), three colours and Esc, at the bottom of
 * the page in both stages. Pen works once there is a box. ↵ (or Comment) attaches the sketch to a comment.
 */
function CaptureBar({ tool, color, onColor, onBox, onPen, onWhole, onCancel, onDone, penReady = false, busy = false }) {
  const latest = useRef({});
  latest.current = { tool, onBox, onPen, onWhole, onDone, penReady, busy };
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const current = latest.current;
      const key = event.key.toLowerCase();
      if (key === "b" && current.onBox && current.tool !== "box") current.onBox();
      else if (key === "p" && current.penReady && current.onPen) current.onPen();
      else if (key === "w" && current.onWhole && !current.busy) current.onWhole();
      else if (event.key === "Enter" && current.onDone && !current.busy && !(event.target instanceof HTMLButtonElement)) current.onDone();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  return (
    <div className="tm-modebar tm-capture-bar" role="toolbar" aria-label="Capture" onPointerDown={(event) => event.stopPropagation()}>
      <span className="tm-capture-bar__label"><CropIcon size={14} aria-hidden="true" focusable="false" />Capture</span>
      <span className="tm-capture-bar__rule" aria-hidden="true" />
      <button type="button" className={tool === "box" ? "is-active" : undefined} aria-pressed={tool === "box"} aria-keyshortcuts="B" onClick={onBox} disabled={busy}>
        <RegionIcon size={14} aria-hidden="true" focusable="false" />Box<Key>B</Key>
      </button>
      <button type="button" className={tool === "pen" ? "is-active" : undefined} aria-pressed={tool === "pen"} aria-keyshortcuts="P"
        onClick={onPen} disabled={!penReady || busy} title={penReady ? "Sketch inside the box" : "Box an area first"}>
        <SketchIcon size={14} aria-hidden="true" focusable="false" />Pen<Key>P</Key>
      </button>
      <button type="button" aria-keyshortcuts="W" onClick={onWhole} disabled={busy}>
        <CaptureIcon size={14} aria-hidden="true" focusable="false" />Whole view<Key>W</Key>
      </button>
      <span className="tm-capture-bar__colors" role="radiogroup" aria-label="Pen colour">
        {MARKUP_COLORS.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={color === option.value} aria-label={`${option.label} pen`}
            title={`${option.label} pen`} className={color === option.value ? "is-selected" : undefined} disabled={busy}
            onClick={() => onColor(option.value)}>
            <span style={{ background: option.value }} />
          </button>
        ))}
      </span>
      <button type="button" className="tm-capture-bar__esc" aria-label="Cancel capture" aria-keyshortcuts="Escape" title="Cancel (Esc)" onClick={onCancel}>
        <Key>Esc</Key>
      </button>
      {onDone && (
        <button type="button" className="tm-capture-bar__done" onClick={onDone} disabled={busy}>
          {busy ? "Preparing…" : "Comment"}{!busy && <Key>↵</Key>}
        </button>
      )}
    </div>
  );
}

function ScreenshotAreaSelector({ onComplete, onCancel, color, onColor }) {
  const [start, setStart] = useState(null);
  const [rect, setRect] = useState(null);
  const [error, setError] = useState("");

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

  const [pointer, setPointer] = useState(null);

  const begin = (event) => {
    if (
      event.button !== 0
      || event.target.closest?.("button, .tm-capture-bar")
    ) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
    const point = { x: event.clientX, y: event.clientY };
    setStart({ point, pointerId: event.pointerId });
    setRect({ left: point.x, top: point.y, width: 0, height: 0 });
    setError("");
  };

  const move = (event) => {
    if (!start) setPointer({ x: event.clientX, y: event.clientY });
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setRect(normalizeDrawRect(start.point, { x: event.clientX, y: event.clientY }, viewport()));
  };

  const finish = (event) => {
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const next = normalizeDrawRect(start.point, { x: event.clientX, y: event.clientY }, viewport());
    setStart(null);
    if (next.width < MIN_SCREENSHOT_SIZE || next.height < MIN_SCREENSHOT_SIZE) {
      setRect(null);
      setError(`Select an area at least ${MIN_SCREENSHOT_SIZE} × ${MIN_SCREENSHOT_SIZE}px.`);
      return;
    }
    setRect(next);
    onComplete(next);
  };

  const cancelGesture = () => {
    setRect(null);
    setStart(null);
  };

  return (
    <div
      className="tm-capture-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tm-capture-title"
      tabIndex={-1}
      onKeyDown={(event) => trapDialogFocus(event, event.currentTarget)}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={cancelGesture}
    >
      <h2 id="tm-capture-title" className="tm-sr-only">Box an area to capture</h2>
      {/* 6a: a quiet hint follows the crosshair until the drag starts. */}
      {!rect && pointer && <span className="tm-capture-hint" style={{ left: pointer.x + 16, top: pointer.y + 16 }} aria-hidden="true">Drag to box an area</span>}
      <CaptureBar tool="box" color={color} onColor={onColor} onBox={() => {}} onCancel={onCancel}
        onWhole={() => onComplete({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight })} />
      {rect && (
        <div
          className="tm-capture-selection"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          aria-hidden="true"
        >
          <span>{Math.round(rect.width)} × {Math.round(rect.height)}</span>
        </div>
      )}
      {error && <div className="tm-capture-error" role="status">{error}</div>}
    </div>
  );
}

function MarkupEditor({ screenshot, onStrokesChange, onCancel, onConfirm, composing, color, onColor, onRebox, onWhole, onAdjust }) {
  const svgRef = useRef(null);
  // 6b: corner handles resize the box and its size label moves it, until you start sketching.
  const [adjusting, setAdjusting] = useState(null);
  const brushWidth = MARKUP_PEN_WIDTH;
  const [draftStroke, setDraftStroke] = useState(null);
  const snapshot = screenshot?.snapshot;
  const strokes = screenshot?.strokes || [];
  const bitmapSize = snapshot?.metadata?.pixelSize || { width: 0, height: 0 };
  const ready = snapshot?.status === "ready" && snapshot.previewUrl;
  const anchorRect = screenshot?.anchorRect || { left: 0, top: 0, width: 0, height: 0 };
  const canAdjust = Boolean(onAdjust) && !composing && !(screenshot?.strokes || []).length;
  const beginAdjust = (kind) => (event) => {
    if (!canAdjust || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    const base = { ...anchorRect };
    let latest = base;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (kind === "move") {
        latest = { ...base, left: clamp(base.left + dx, 0, width - base.width), top: clamp(base.top + dy, 0, height - base.height) };
      } else {
        let left = base.left;
        let top = base.top;
        let right = base.left + base.width;
        let bottom = base.top + base.height;
        if (kind.includes("w")) left = clamp(left + dx, 0, right - MIN_SCREENSHOT_SIZE);
        if (kind.includes("e")) right = clamp(right + dx, left + MIN_SCREENSHOT_SIZE, width);
        if (kind.includes("n")) top = clamp(top + dy, 0, bottom - MIN_SCREENSHOT_SIZE);
        if (kind.includes("s")) bottom = clamp(bottom + dy, top + MIN_SCREENSHOT_SIZE, height);
        latest = { left, top, width: right - left, height: bottom - top };
      }
      setAdjusting(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      setAdjusting(null);
      if (["left", "top", "width", "height"].some((key) => Math.round(latest[key]) !== Math.round(base[key]))) onAdjust(latest);
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
  };
  const shownRect = adjusting || anchorRect;

  // ⌘Z takes back the last stroke.
  const strokesRef = useRef(null);
  strokesRef.current = screenshot?.strokes || [];
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== "z" || !(event.metaKey || event.ctrlKey) || event.shiftKey || !strokesRef.current.length) return;
      event.preventDefault();
      event.stopPropagation();
      onStrokesChange(undoMarkupStroke(strokesRef.current));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onStrokesChange]);

  const pointFromEvent = (event) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return mapMarkupPoint(
      { x: event.clientX, y: event.clientY },
      { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      bitmapSize,
    );
  };

  const startStroke = (event) => {
    if (composing || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Older engines may not expose pointer capture. */ }
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = bounds.width > 0 ? bitmapSize.width / bounds.width : 1;
    const point = pointFromEvent(event);
    setDraftStroke({ color, width: Math.max(2, brushWidth * scale), points: [point] });
  };

  const continueStroke = (event) => {
    if (!draftStroke || composing) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = bounds.width > 0 ? bitmapSize.width / bounds.width : 1;
    const point = pointFromEvent(event);
    setDraftStroke((current) => current ? {
      ...current,
      points: simplifyMarkupPoints([...current.points, point], Math.max(1, 1.5 * scale)),
    } : current);
  };

  const finishStroke = (event) => {
    if (!draftStroke) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const finished = {
      ...draftStroke,
      points: simplifyMarkupPoints([...draftStroke.points, point], 1),
    };
    onStrokesChange(addMarkupStroke(strokes, finished));
    setDraftStroke(null);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Pointer capture may already be gone. */ }
  };

  const visibleStrokes = draftStroke ? [...strokes, draftStroke] : strokes;

  return (
    <section
      className="tm-markup-overlay"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tm-markup-title"
      tabIndex={-1}
    >
      <div
        className={`tm-markup-canvas${adjusting ? " is-adjusting" : ""}`}
        style={{
          left: shownRect.left,
          top: shownRect.top,
          width: shownRect.width,
          height: shownRect.height,
        }}
      >
        {!ready && snapshot?.status !== "failed" && (
          <div className="tm-markup-loading"><span className="tm-spinner" />Preparing selected crop…</div>
        )}
        {snapshot?.status === "failed" && (
          <div className="tm-markup-loading tm-markup-loading--error">
            Screenshot unavailable. Cancel and select the area again.
          </div>
        )}
        {ready && (
          <>
            <img src={snapshot.previewUrl} alt="Selected screenshot crop ready for markup" draggable="false" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${bitmapSize.width} ${bitmapSize.height}`}
              aria-label="Screenshot drawing canvas"
              onPointerDown={startStroke}
              onPointerMove={continueStroke}
              onPointerUp={finishStroke}
              onPointerCancel={() => setDraftStroke(null)}
            >
              {visibleStrokes.map((stroke, index) => (
                <polyline
                  key={`${index}-${stroke.points.length}`}
                  points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </>
        )}
        <span className={`tm-markup-canvas__dimensions${canAdjust ? " is-movable" : ""}`} aria-hidden="true"
          title={canAdjust ? "Drag to move the box" : undefined} onPointerDown={beginAdjust("move")}>
          {Math.round(shownRect.width)} × {Math.round(shownRect.height)}
        </span>
        {canAdjust && ["nw", "ne", "sw", "se"].map((corner) => (
          <span key={corner} className={`tm-markup-handle tm-markup-handle--${corner}`} aria-hidden="true" onPointerDown={beginAdjust(corner)} />
        ))}
      </div>

      <CaptureBar tool="pen" color={color} onColor={onColor} penReady={Boolean(ready)} busy={composing}
        onBox={onRebox} onPen={() => {}} onWhole={onWhole} onCancel={onCancel} onDone={ready ? onConfirm : undefined} />
      <p className="tm-sr-only" id="tm-markup-title">Sketch on the boxed area. Only this area and your sketch are attached.</p>
    </section>
  );
}

const Marker = memo(function Marker({ annotation, number, rect, restoration, onEdit, markerPositions, active = false }) {
  const buttonRef = useRef(null), outlineRef = useRef(null);
  useLayoutEffect(() => {
    const update = () => {
      const next = markerPositions?.get(annotation.id);
      const button = buttonRef.current, outline = outlineRef.current;
      if (button) {
        button.style.display = next ? "" : "none";
        if (next) {
          button.style.left = `${next.pinX ?? next.left + next.width}px`;
          button.style.top = `${next.pinY ?? next.top + Math.min(18, next.height / 2)}px`;
        }
      }
      if (outline) {
        outline.style.display = next && next.width > 1 && next.height > 1 ? "" : "none";
        if (next) Object.assign(outline.style, { left: `${next.left}px`, top: `${next.top}px`, width: `${next.width}px`, height: `${next.height}px` });
      }
    };
    update();
    return markerPositions?.subscribe(annotation.id, update);
  }, [markerPositions, annotation.id, Boolean(rect), restoration?.ghost, restoration?.status]);
  rect = markerPositions?.get(annotation.id) || rect;
  if (!rect) return null;
  const grouped = ["multi", "region", "interaction"].includes(annotation.payload.captureKind);
  const needsRepair = restoration && restoration.status !== "resolved";
  const suggested = restoration?.status === "changed";
  const ghost = Boolean(restoration?.ghost);
  const resolved = annotation.payload.workflow?.status === "resolved" && !needsRepair;
  const detail = suggested ? ": element changed, confirm its new location"
    : ghost ? ": element removed, shown at its last known position" : "";
  return (
    <>
      {(suggested || ghost) && rect.width > 1 && rect.height > 1 && (
        <div
          ref={outlineRef}
          className={`tm-outline ${suggested ? "tm-outline--suggested" : "tm-outline--ghost"}`}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        ref={buttonRef}
        className={`tm-marker ${grouped ? "tm-marker--grouped" : ""} ${needsRepair ? "tm-marker--warning" : ""} ${suggested ? "tm-marker--suggested" : ""} ${ghost ? "tm-marker--ghost" : ""} ${resolved ? "tm-marker--resolved" : ""} ${active ? "tm-marker--active" : ""}`}
        style={{ left: rect.left + rect.width, top: rect.top + Math.min(18, rect.height / 2) }}
        aria-label={`Edit annotation ${number}${resolved ? ", resolved" : ""}${needsRepair ? `, target needs repair${detail}` : ""}`}
        title={suggested ? "Element changed · confirm location" : ghost ? "Element removed · last known position" : "Open annotation"}
        onClick={() => onEdit(annotation.id)}
      >
        {resolved ? <ResolveIcon aria-hidden="true" focusable="false" className="tm-marker__check" /> : number}
      </button>
    </>
  );
});

function reviewerInitials(reviewer) {
  const name = reviewer?.displayName?.trim();
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatMessageTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  if (elapsedMinutes < 1440) return `${Math.round(elapsedMinutes / 60)}h`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

// Finds an in-progress "@name" immediately before the caret. One inner space is allowed so full names like "Sam Okafor" match.
function activeMentionQuery(text, caret) {
  const match = /(?:^|\s)@([^\s@]*(?: [^\s@]*)?)$/.exec(text.slice(0, caret));
  return match ? { start: caret - match[1].length - 1, query: match[1] } : null;
}

// A comment textarea that suggests reviewers after "@" and inserts "@Display Name" inline.
function MentionTextarea({ reviewers = [], value, onValueChange, onKeyDown, ...props }) {
  const ref = useRef(null);
  const [mention, setMention] = useState(null);
  const matches = mention
    ? reviewers.filter((member) => member.displayName?.toLowerCase().startsWith(mention.query.toLowerCase())).slice(0, 6)
    : [];
  const open = matches.length > 0;
  // The list floats over everything: it is portalled to the overlay root and pinned to the text box,
  // so the popover's scroll area and the composer's layout never clip or push it.
  const [place, setPlace] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setPlace(null); return undefined; }
    const element = ref.current;
    const update = () => {
      const box = element?.getBoundingClientRect();
      if (!box) return;
      const height = Math.min(200, matches.length * 34 + 10);
      const below = window.innerHeight - box.bottom >= height + 12 || box.top < height + 12;
      setPlace({
        left: Math.max(8, Math.min(box.left, window.innerWidth - 228)),
        top: below ? box.bottom + 6 : box.top - height - 6,
        width: Math.max(180, Math.min(box.width, 260)),
        below,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, matches.length]);
  const refresh = (element) => {
    const next = activeMentionQuery(element.value, element.selectionStart ?? element.value.length);
    setMention((current) => next ? { ...next, index: current?.start === next.start ? current.index : 0 } : null);
  };
  const insert = (member) => {
    const element = ref.current;
    const caret = element?.selectionStart ?? value.length;
    const insertion = `@${member.displayName} `;
    const next = value.slice(0, mention.start) + insertion + value.slice(caret);
    onValueChange(next);
    setMention(null);
    requestAnimationFrame(() => {
      const position = mention.start + insertion.length;
      element?.focus();
      element?.setSelectionRange(position, position);
    });
  };
  return <>
    <textarea
      {...props}
      ref={ref}
      value={value}
      data-mention-open={open ? "true" : undefined}
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={open ? "tm-mention-list" : undefined}
      onChange={(event) => { onValueChange(event.target.value); refresh(event.target); }}
      onSelect={(event) => refresh(event.currentTarget)}
      onBlur={() => setMention(null)}
      onKeyDown={(event) => {
        if (open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          setMention((current) => ({ ...current, index: (current.index + step + matches.length) % matches.length }));
          return;
        }
        if (open && (event.key === "Enter" || event.key === "Tab") && !event.nativeEvent.isComposing) {
          event.preventDefault();
          insert(matches[Math.min(mention.index, matches.length - 1)]);
          return;
        }
        if (open && event.key === "Escape") { event.preventDefault(); setMention(null); return; }
        onKeyDown?.(event);
      }}
    />
    {open && place && ref.current?.closest(".tm-root") && createPortal(<ul id="tm-mention-list" className={`tm-mention-list${place.below ? "" : " is-above"}`} role="listbox" aria-label="Mention a reviewer"
      style={{ left: place.left, top: place.top, width: place.width }}>
      {matches.map((member, index) => (
        <li key={member.id} role="option" aria-selected={index === mention.index}
          onMouseDown={(event) => { event.preventDefault(); insert(member); }}>
          <ReviewerAvatar reviewer={member} className="tm-mention-list__avatar" />{member.displayName}
        </li>
      ))}
    </ul>, ref.current.closest(".tm-root"))}
  </>;
}

function ReviewerAvatar({ reviewer, className = "tm-thread-message__avatar" }) {
  return (
    <div className={className} aria-hidden="true">
      {reviewer?.avatarUrl ? <img src={reviewer.avatarUrl} alt="" /> : reviewerInitials(reviewer)}
    </div>
  );
}

function MessageReactions({ message, reviewer, onChange }) {
  const [pending, setPending] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const reactions = message.reactions || [];
  const toggle = async (emoji, active) => {
    setPending(true);
    try { await onChange(message.id, emoji, active); setChoosing(false); }
    catch { /* The parent announces the save failure; keep the chooser available for retry. */ }
    finally { setPending(false); }
  };
  return <div className="tm-reactions" role="group" aria-label="Message reactions" aria-busy={pending}>
    {REACTIONS.filter(([emoji]) => choosing || reactions.some((item) => item.emoji === emoji)).map(([emoji, label]) => {
      const members = reactions.filter((item) => item.emoji === emoji).map((item) => item.reviewer);
      const mine = members.some((member) => member.id === reviewer?.id);
      return <button key={emoji} type="button" aria-pressed={mine}
        aria-label={`${label}: ${members.length}${mine ? ", including you" : ""}`}
        title={members.map((member) => member.displayName).join(", ") || label}
        disabled={pending || !reviewer || !onChange} onClick={() => toggle(emoji, !mine)}>
        <span aria-hidden="true">{emoji}</span>{members.length > 0 && <span>{members.length}</span>}
      </button>;
    })}
    {onChange && reviewer && <button type="button" aria-expanded={choosing} disabled={pending}
      className="tm-reaction-trigger" title={choosing ? "Close reaction choices" : "Add reaction"}
      aria-label={choosing ? "Close reaction choices" : "Add reaction"} onClick={() => setChoosing((value) => !value)}>
      <span className="tm-reaction-add" aria-hidden="true"><SmileCircleIcon {...iconProps} /><PlusIcon {...iconProps} /></span>
    </button>}
  </div>;
}

/** Where a comment was sent, linked both ways (board 10, 23c-d). */
function CommentLinks({ links, plain = false }) {
  if (!links?.length) return null;
  return (
    <span className="tm-comment-links">
      {links.map((link) => {
        const text = link.status === "closed" ? `closed in ${link.label}` : link.label;
        return (
          <span key={link.label} className={`tm-comment-link${link.status === "closed" ? " is-closed" : ""}`}>
            {!plain && link.url ? <a href={link.url} target="_blank" rel="noreferrer">{text}</a> : <span>{text}</span>}
            {link.status === "open" && <span className="tm-comment-link__status"> · Open</span>}
          </span>
        );
      })}
    </span>
  );
}

function ThreadMessage({
  message,
  annotation = false,
  currentReviewer,
  onReactionChange,
  onReply,
  onDelete,
  onEdit,
  editor = null,
  links = null,
  fromAi = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const author = message.author;
  const authorName = author?.displayName || "Unknown reviewer";
  const isCurrentReviewer = Boolean(author?.id && author.id === currentReviewer?.id);
  const choose = (action) => { setMenuOpen(false); action(); };
  return (
    <article
      className={`tm-thread-message ${annotation ? "tm-thread-message--root" : "tm-thread-message--reply"}${editor ? " is-editing" : ""}${menuOpen ? " has-menu" : ""}`}
      data-menu-open={menuOpen ? "true" : undefined}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}
      onKeyDown={(event) => { if (event.key === "Escape" && menuOpen) { event.stopPropagation(); setMenuOpen(false); } }}
    >
      {/* Your current face shows on everything you've written, old comments too (board 08, 27c). */}
      <ReviewerAvatar reviewer={isCurrentReviewer && currentReviewer?.avatarUrl ? { ...author, avatarUrl: currentReviewer.avatarUrl } : author} />
      <div className="tm-thread-message__body">
        {editor || <>
          <div className="tm-thread-message__meta">
            <strong>{authorName}</strong>
            {isCurrentReviewer && <span className="tm-thread-message__you">You</span>}
            <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
            <button type="button" className="tm-thread-message__menu-toggle" aria-haspopup="menu" aria-expanded={menuOpen}
              aria-label={`Actions for ${annotation ? "comment" : "reply"} by ${authorName}`} onClick={() => setMenuOpen((open) => !open)}>
              <Ellipsis {...iconProps} />
            </button>
          </div>
          <p>{message.comment}</p>
          {fromAi && <span className="tm-from-ai"><AiIcon size={12} aria-hidden="true" focusable="false" />From an AI review</span>}
          <CommentLinks links={links} />
          <MessageReactions message={message} reviewer={currentReviewer} onChange={onReactionChange} />
          {/* Kept mounted while closed so the actions remain addressable; `hidden` removes them from view and the accessibility tree. */}
          <div className="tm-thread-message__actions" role="menu" hidden={!menuOpen}>
            <button type="button" role="menuitem" onClick={() => choose(() => onReply(message.id, authorName))}>Reply</button>
            {onEdit && <button type="button" role="menuitem" onClick={() => choose(onEdit)}>Edit</button>}
            <button
              type="button"
              role="menuitem"
              className="tm-thread-message__delete"
              aria-label={annotation ? "Delete annotation" : `Delete reply by ${authorName}`}
              onClick={() => choose(() => onDelete(annotation
                ? { kind: "annotation", id: message.id }
                : { kind: "reply", id: message.id }))}
            >
              Delete
            </button>
          </div>
        </>}
      </div>
    </article>
  );
}

/** The @ button: put an @ at the cursor (with a space before it if needed) so the mention list opens. */
function startMention(field) {
  if (!field) return;
  field.focus();
  const start = field.selectionStart ?? field.value.length;
  const before = field.value.slice(0, start);
  field.setRangeText(`${before && !/\s$/.test(before) ? " " : ""}@`, start, field.selectionEnd ?? start, "end");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

const MAX_POLL_CHOICES = 8;

/** A poll attached to a comment: 2 to 8 answers, and whether people can pick several. */
function PollEditor({ options, onChange, multiple, onMultipleChange, onRemove, disabled }) {
  const update = (index, value) => onChange(options.map((option, at) => (at === index ? value : option)));
  return (
    <fieldset className="tm-poll-editor" disabled={disabled}>
      <legend className="tm-sr-only">Poll</legend>
      <div className="tm-poll-editor__header">
        <PollIcon size={14} aria-hidden="true" focusable="false" />
        <span>Poll</span>
        {onRemove && (
          <button type="button" className="tm-poll-editor__remove" aria-label="Remove poll" title="Remove poll" onClick={onRemove}>
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      {options.map((option, index) => (
        <div className="tm-poll-editor__row" key={index}>
          <input
            aria-label={`Answer ${index + 1}`}
            placeholder={`Answer ${index + 1}`}
            maxLength={200}
            value={option}
            onChange={(event) => update(index, event.target.value)}
          />
          {options.length > 2 && (
            <button type="button" aria-label={`Remove answer ${index + 1}`} onClick={() => onChange(options.filter((_, at) => at !== index))}>
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      <div className="tm-poll-editor__footer">
        {options.length < MAX_POLL_CHOICES && (
          <button type="button" className="tm-poll-editor__add" onClick={() => onChange([...options, ""])}>
            <PlusIcon size={13} /> Add answer
          </button>
        )}
        <label className="tm-poll-editor__multiple">
          <input type="checkbox" checked={multiple} onChange={(event) => onMultipleChange(event.target.checked)} />
          Pick any
        </label>
      </div>
    </fieldset>
  );
}

/** A posted poll in its thread. Before you vote: answers with a round mark (pick one) or a square mark
 * (pick any), and no shares, so early votes don’t sway yours. After you vote, or once the poll closes:
 * results, with a tick on your vote and the Lime bar on the leader. Change vote goes back to the answers. */
function PollCard({ ask, results, closed, onVote }) {
  const total = results?.total || 0;
  const mine = results?.mine || [];
  const [changing, setChanging] = useState(false);
  const voted = mine.length > 0;
  const showResults = closed || (voted && !changing);
  const counts = ask.options.map((item) => results?.counts?.[item.id] || 0);
  const top = Math.max(0, ...counts);
  const votes = `${total} ${total === 1 ? "vote" : "votes"}`;
  const pick = (id) => {
    if (closed || !onVote) return;
    if (ask.multiple) {
      // Pick any: each answer toggles; the answers stay up until Done.
      onVote(mine.includes(id) ? mine.filter((item) => item !== id) : [...mine, id]);
      setChanging(true);
    } else {
      // Pick one: choosing shows the results; choosing your own answer again takes the vote back.
      onVote(mine.includes(id) ? [] : [id]);
      setChanging(false);
    }
  };
  const link = (label, run) => <button type="button" className="tm-poll__link" onClick={run}>{label}</button>;
  return (
    <section className={`tm-poll${showResults ? " tm-poll--results" : ""}${ask.multiple ? " tm-poll--multiple" : ""}${closed ? " is-closed" : ""}`} aria-label="Poll">
      <div className="tm-poll__header">
        <PollIcon size={14} aria-hidden="true" focusable="false" />
        <strong>{closed ? "Poll · closed" : "Poll"}</strong>
        <span>{ask.multiple ? "Pick any" : "Pick one"}</span>
      </div>
      {showResults ? (
        <ul className="tm-poll__results" aria-label="Results">
          {ask.options.map((option, index) => {
            const count = counts[index];
            const share = total ? Math.round((count / total) * 100) : 0;
            const chosen = mine.includes(option.id);
            const names = (results?.voters || []).filter((voter) => voter.optionIds.includes(option.id)).map((voter) => voter.reviewer.displayName);
            return (
              <li key={option.id} className={`tm-poll-result${chosen ? " is-chosen" : ""}${total && count === top ? " is-leading" : ""}`}
                title={names.length ? names.join(", ") : undefined}>
                <span className="tm-poll-result__label">{option.label}{chosen && <CircleCheck size={14} aria-label="Your vote" />}</span>
                <span className="tm-poll-result__share">{share}%<span className="tm-sr-only">, {count} {count === 1 ? "vote" : "votes"}</span></span>
                <span className="tm-poll-result__bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div role={ask.multiple ? "group" : "radiogroup"} aria-label="Answers" className="tm-poll__options">
          {ask.options.map((option) => (
            <button key={option.id} type="button" role={ask.multiple ? "checkbox" : "radio"} aria-checked={mine.includes(option.id)}
              className={`tm-poll-option${mine.includes(option.id) ? " is-chosen" : ""}`} disabled={closed || !onVote} onClick={() => pick(option.id)}>
              <span className="tm-poll-option__mark" aria-hidden="true" />
              <span className="tm-poll-option__label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
      <p className="tm-poll__footer">
        {closed ? `Closed · ${votes}`
          : !onVote ? <>{votes} · Votes can’t be saved here.</>
          : showResults ? <>{votes} · {link("Change vote", () => setChanging(true))}</>
          : voted ? <>{votes} · {link("Done", () => setChanging(false))}</>
          : <>{votes} · Results show after you vote</>}
      </p>
    </section>
  );
}

/** A poll in the Activity list: the same answers and shares as the thread, read-only, in a sunken well.
 * It sits inside the card's button, so it is plain text; voting happens in the thread. */
function PollSummary({ ask, results, closed }) {
  const total = results?.total || 0;
  const mine = results?.mine || [];
  const top = Math.max(0, ...ask.options.map((item) => results?.counts?.[item.id] || 0));
  // Same rule as the thread: no shares until you have voted (or the poll has closed).
  const reveal = closed || mine.length > 0;
  return (
    <span className={`tm-comment-poll${closed ? " is-closed" : ""}`}>
      <span className="tm-comment-poll__header">
        <PollIcon size={13} aria-hidden="true" focusable="false" />
        <strong>{closed ? "Poll · closed" : "Poll"}</strong>
        <span>{total} {total === 1 ? "vote" : "votes"}{mine.length ? " · You voted" : closed ? "" : " · Vote in the thread"}</span>
      </span>
      {ask.options.map((option) => {
        const count = results?.counts?.[option.id] || 0;
        const share = total ? Math.round((count / total) * 100) : 0;
        const chosen = mine.includes(option.id);
        return (
          <span key={option.id} className={`tm-comment-poll__option${chosen ? " is-chosen" : ""}${reveal && total && count === top ? " is-leading" : ""}`}>
            <span className="tm-comment-poll__label">{option.label}{chosen && <CircleCheck size={12} aria-label="Your vote" />}</span>
            <span className="tm-comment-poll__share">{reveal && total ? `${share}%` : ""}</span>
            {reveal && <span className="tm-comment-poll__bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>}
          </span>
        );
      })}
    </span>
  );
}

function Overlay({
  mode,
  onStartTour,
  onExitTour,
  tourDrafts,
  tourActiveId,
  onTourDraftsChange,
  tourPick,
  onTourPreview,
  onStopTourPreview,
  tourPreviewInfo = null,
  onTourSave,
  onCopyText,
  tourStepComments,
  tourCodeRules,
  onCommentOnTourStep,
  onOpenTourComment,
  projectAnnotations,
  reviewers,
  onWorkflowChange,
  currentBuildId,
  captureComparison,
  allCommentsOpen,
  onToggleAllComments,
  onCloseAllComments,
  onOpenListedAnnotation,
  repinning,
  repinTargetCount = 1,
  onRepin,
  onConfirmSuggestedPin,
  commentSnapshot,
  hoverRect,
  selections,
  selectionRects,
  textSelection,
  regionSelection,
  screenshotSelection,
  interactionSelection,
  interactionRecording,
  shadowHost,
  videoEnabled = false,
  videoMaxDurationMs,
  videoSetup,
  videoRecording,
  videoSelection,
  onStartVideo,
  onVideoSetupChange,
  onBeginVideoRecording,
  onCancelVideoSetup,
  onToggleVideoPause,
  onToggleVideoSource,
  onMarkVideoMoment,
  videoCountdown = null,
  onCancelVideoCountdown,
  videoReview = null,
  onPostVideo,
  onRetakeVideo,
  videoBlurred = [],
  videoTool = null,
  onVideoTool,
  onToggleVideoBlur,
  onVideoStroke,
  onDiscardVideo,
  onStopVideo,
  replayEnabled = false,
  replayDraft,
  onToggleReplay,
  drawRect,
  annotations,
  markerPositions,
  annotationRects,
  annotationRestorations,
  markersHidden,
  paused,
  editingAnnotation,
  pageVersions,
  pageVersionRoute,
  carryingVersionId,
  reviewer,
  toolbarPosition,
  toolbarDragging = false,
  barPosition = "bottom-center",
  barShrunk = false,
  barHidden = false,
  onBarShrink,
  onBarHide,
  shortcutsOpen = false,
  onShortcutsOpenChange,
  comment,
  setComment,
  composerMode,
  replyTarget,
  pendingDelete,
  deleting,
  onStart,
  onExit,
  onBack,
  onClearAll,
  clearArmed,
  onComment,
  onScreenshot,
  onStartInteraction,
  onStopInteraction,
  onCancelInteraction,
  onScreenshotAreaComplete,
  onScreenshotCancel,
  onScreenshotConfirm,
  onScreenshotStrokesChange,
  onSubmit,
  onPause,
  onVisibility,
  onCopy,
  onEditAnnotation,
  onRecheckAnnotation,
  onCopyAnnotationLink,
  onSelectPageVersion,
  nextSteps = null,
  dashboardUrl = null,
  notifications = null,
  onOpenNotification,
  onNotificationsSeen,
  surveys = null,
  surveyResults = {},
  onSurveyPublish = null,
  onSurveyEnd = null,
  surveyRoute = "/",
  faces = [],
  reviewerEmail = null,
  onSignOut,
  onBackToDrawing,
  inviteSuggestions = [],
  notificationSettings,
  projectName = null,
  onReviewerChange,
  onNotificationSettingsChange,
  onLeaveProject,
  shareUrl = null,
  linkAccess = null,
  members = [],
  onInvite,
  onMemberChange,
  onResendInvite,
  onLinkAccessChange,
  onAiReview,
  onStartHostedReview,
  onAskAi,
  onAiDismiss,
  onPostAiComment,
  aiRoute = "/",
  aiBuildId,
  aiIgnoredSelectors = [],
  onAiNotice,
  onTourSendToAi,
  aiConnection = null,
  onConnectAi,
  nextStepsOpen = false,
  onShowNextSteps = () => {},
  canTickNextSteps = false,
  onNextStepDone,
  onOpenNextStepSource,
  onCopyNextSteps,
  onCarryFeedbackForward,
  onBeginReply,
  onCancelReply,
  onBeginEdit,
  editingReplyId = null,
  onRequestDelete,
  onCancelDelete,
  discardPending,
  onRequestDismiss,
  onKeepEditing,
  onConfirmDelete,
  onToolbarPointerDown,
  onToolbarPointerMove,
  onToolbarPointerUp,
  onRetrySnapshot,
  askKind = "comment",
  onAskKindChange,
  pollOptions = ["", ""],
  onPollOptionsChange,
  pollMultiple = false,
  onPollMultipleChange,
  pollsEnabled = false,
  onVote,
  onReactionChange,
  notice,
  submitting,
  uploadProgress = null,
  composingScreenshot,
  launcherRef,
}) {
  const uploadPercent = Number.isFinite(uploadProgress) ? Math.round(Math.min(1, Math.max(0, uploadProgress)) * 100) : null;
  const targets = editingAnnotation
    ? editingAnnotation.payload.pin ? [editingAnnotation.payload.pin.target] : editingAnnotation.payload.targets || [editingAnnotation.payload.target]
    : videoSelection
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
  const primaryTarget = targets[0] || null;
  const captureKind = editingAnnotation?.payload.captureKind
    || (videoSelection ? "video" : interactionSelection ? "interaction" : screenshotSelection ? "screenshot" : textSelection ? "text" : regionSelection ? "region" : targets.length > 1 ? "multi" : "element");
  const selectedCount = targets.length;
  const lastSelection = selections[selections.length - 1];
  const subscribeEditingRect = useCallback(listener => markerPositions?.subscribe(editingAnnotation?.id, listener) || (() => {}), [markerPositions, editingAnnotation?.id]);
  const readEditingRect = useCallback(() => markerPositions?.get(editingAnnotation?.id) || null, [markerPositions, editingAnnotation?.id]);
  const editingRect = useSyncExternalStore(subscribeEditingRect, readEditingRect, () => null);
  const anchorRect = editingAnnotation
    ? editingRect || annotationRects[editingAnnotation.id] || {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 1,
      height: 1,
    }
    : videoSelection?.displayRect
      || interactionSelection?.displayRect
      || screenshotSelection?.anchorRect
      || textSelection?.displayRect
      || regionSelection?.displayRect
      || (lastSelection ? selectionRects[lastSelection.id] : null);
  const popoverRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [editingEvidencePreview, setEditingEvidencePreview] = useState(null);
  const [workflowMoreOpen, setWorkflowMoreOpen] = useState(false);
  // The thread last opened from its pin on the page: it stays a popover by the pin instead of docking into the panel.
  const [pinThreadId, setPinThreadId] = useState(null);
  const openPinThread = useCallback((id) => { setPinThreadId(id); onEditAnnotation(id); }, [onEditAnnotation]);
  // The + menu in the composer: Comment, Question or Poll (2c).
  // The sketch colour stays the same from boxing to drawing (board 02, 6a-6c).
  const [captureColor, setCaptureColor] = useState(MARKUP_COLORS[0].value);
  const [threadPanel, setThreadPanel] = useState(null);
  const [replayingVideo, setReplayingVideo] = useState(false);
  const [replayViewer, setReplayViewer] = useState(null);
  const savedReplay = editingAnnotation?.payload.replay || null;
  const savedReplayEvidence = savedReplay
    ? editingAnnotation.runtime?.evidence?.find((item) => item.id === savedReplay.evidenceId)
    : null;
  const activeVideo = editingAnnotation?.payload.video || videoSelection?.video || null;
  // 7g: a timestamp lights up what the reviewer was working on at that moment, if it is still on the page.
  const [videoMoment, setVideoMoment] = useState(null);
  useEffect(() => {
    if (!videoMoment) return undefined;
    const timer = setTimeout(() => setVideoMoment(null), 2400);
    return () => clearTimeout(timer);
  }, [videoMoment]);
  const highlightVideoMoment = (offsetMs) => {
    const events = activeVideo?.events || [];
    const event = [...events].reverse().find((item) => item.offsetMs <= offsetMs + 250 && Number.isInteger(item.targetIndex));
    if (!event) { setVideoMoment(null); return; }
    const element = (editingAnnotation && annotationRestorations[editingAnnotation.id]?.results?.[event.targetIndex]?.element)
      || (editingAnnotation ? editingAnnotation.runtime?.elements?.[event.targetIndex] : videoSelection?.elements?.[event.targetIndex]);
    if (!element?.isConnected || element === document.documentElement || element === document.body) { setVideoMoment(null); return; }
    element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    const box = element.getBoundingClientRect();
    setVideoMoment({ key: `${offsetMs}`, rect: { top: box.top, left: box.left, width: box.width, height: box.height } });
  };
  const composingNew = !editingAnnotation && !repinning;
  // 6d: a sketch arrives in the composer as a small chip, and Esc goes back to drawing.
  const sketchCompose = Boolean(composingNew && screenshotSelection?.original && onBackToDrawing);
  // A thread opened from its pin floats next to the pin, even with the panel open; one opened from the panel or Inbox docks there.
  const threadDocked = Boolean(editingAnnotation && allCommentsOpen && !repinning && pinThreadId !== editingAnnotation.id);
  useEffect(() => {
    if (pinThreadId && editingAnnotation?.id !== pinThreadId) setPinThreadId(null);
  }, [editingAnnotation?.id, pinThreadId]);
  const reviewingVideo = Boolean(videoReview && videoSelection && videoReview.id === videoSelection.id && !editingAnnotation);
  const activeVideoEvidence = editingAnnotation
    ? editingAnnotation.runtime?.evidence?.find((item) => item.id === activeVideo?.evidenceId)
    : videoSelection?.evidence;
  const activeVideoMedia = activeVideoEvidence?.blob || activeVideoEvidence?.url
    ? {
      blob: activeVideoEvidence.blob || null,
      url: activeVideoEvidence.blob ? null : activeVideoEvidence.url,
      mimeType: activeVideoEvidence.blob?.type
        || editingAnnotation?.payload.evidence?.find((item) => item.id === activeVideo?.evidenceId)?.mimeType
        || "",
    }
    : null;
  const comparisonOpen = Boolean(editingAnnotation && threadPanel === "compare");
  const previousComparisonOpenRef = useRef(false);
  const [carryForwardOpen, setCarryForwardOpen] = useState(false);
  const editingRestoration = editingAnnotation ? annotationRestorations[editingAnnotation.id] : null;
  const brokenAnnotations = annotations.filter((annotation) => {
    const restoration = annotationRestorations[annotation.id];
    return restoration && restoration.status !== "resolved";
  });
  const carryForwardVersions = pageVersions.filter((version) => !version.current && version.state === "ready");
  const [toolbarMenu, setToolbarMenu] = useState(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const panelTab = inboxOpen && notifications ? "inbox" : nextStepsOpen && nextSteps ? "next-steps" : "comments";
  const panelView = allCommentsOpen ? panelTab : null;
  const unreadInboxCount = notifications ? notifications.filter((item) => !item.read).length : 0;
  const openPanelView = (view) => {
    if (panelView === view) { onToggleAllComments(); return; }
    setInboxOpen(view === "inbox");
    onShowNextSteps?.(false);
    if (!allCommentsOpen) onToggleAllComments();
  };
  const [surveyBuilderOpen, setSurveyBuilderOpen] = useState(false);
  // Board 08: "menu" (27a), "face" (27b), "settings" (28a) or "leave" (28b).
  const [youOpen, setYouOpen] = useState(false);
  const canEditYou = Boolean(onReviewerChange || onNotificationSettingsChange || onLeaveProject);
  const hasYouMenu = Boolean(canEditYou || onSignOut);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [askAiElement, setAskAiElement] = useState(null);
  // Phones: the composer and thread are bottom sheets, so keep what they're about in view above them (35b-c).
  const sheetSubject = lastSelection?.element || editingAnnotation?.runtime?.elements?.[0] || null;
  useEffect(() => {
    if (!sheetSubject?.isConnected || typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 599px)").matches) return;
    const rect = sheetSubject.getBoundingClientRect();
    const room = window.innerHeight * 0.3;
    if (rect.top >= 8 && rect.bottom <= room) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: rect.top - Math.min(64, room / 3), behavior: reduce ? "auto" : "smooth" });
  }, [sheetSubject]);
  const askAiTarget = onAskAi && onPostAiComment && !editingAnnotation && selections.length === 1 && !textSelection && !regionSelection
    && !screenshotSelection && !interactionSelection && !videoSelection ? selections[0]?.element : null;
  useEffect(() => {
    if (!askAiTarget) return undefined;
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAskAiElement(askAiTarget);
      }
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [askAiTarget]);
  useReturnFocus(youOpen);
  useReturnFocus(shareOpen);
  useReturnFocus(askAiElement);
  const canShare = Boolean(shareUrl || onInvite);
  // A dark host page gets a faint paper edge around the bar and panel (board 09, 32a/b).
  const [darkPage, setDarkPage] = useState(false);
  useEffect(() => {
    // Re-checked when review opens or closes, the page changes, or the tab comes back.
    const check = () => { try { setDarkPage(pageBrightness() < 0.35); } catch { setDarkPage(false); } };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [mode, aiRoute]);
  const [openSurveyId, setOpenSurveyId] = useState(null);
  const toolbarMenuRef = useRef(null);
  toolbarMenuRef.current = toolbarMenu;
  const toolsTriggerRef = useRef(null);
  const moreTriggerRef = useRef(null);
  const closeToolbarMenu = useCallback((restoreFocus) => {
    const trigger = toolbarMenuRef.current === "tools" ? toolsTriggerRef.current : moreTriggerRef.current;
    setToolbarMenu(null);
    if (restoreFocus) trigger?.focus();
  }, []);
  const runToolbarItem = (run) => () => { setToolbarMenu(null); run(); };
  // A dragged toolbar near the top of the window opens its menus downward.
  const toolbarMenusBelow = Boolean(toolbarPosition && typeof window !== "undefined" && toolbarPosition.top < window.innerHeight / 2);

  useEffect(() => { if (mode !== "picking") setToolbarMenu(null); }, [mode]);
  // Pressing X arms Clear; the More menu opens so the confirmation is visible.
  useEffect(() => { if (clearArmed && mode === "picking") setToolbarMenu("more"); }, [clearArmed, mode]);

  useEffect(() => {
    setCarryForwardOpen(false);
  }, [editingAnnotation?.id]);

  useEffect(() => {
    const evidenceItem = editingAnnotation?.runtime?.evidence
      ?.find((item) => isImageEvidence(editingAnnotation, item));
    const metadata = editingAnnotation?.payload?.evidence?.find((item) => item.id === evidenceItem?.id);
    if (!(evidenceItem?.blob || evidenceItem?.url) || !metadata || typeof URL === "undefined") {
      const unavailable = editingAnnotation?.payload?.evidence?.find((item) => item.quality === "unavailable" && item.kind !== "recording" && item.kind !== "replay");
      setEditingEvidencePreview(unavailable ? { snapshot: { status: "failed", metadata: unavailable } } : null);
      return undefined;
    }

    const previewUrl = evidenceItem.blob ? URL.createObjectURL(evidenceItem.blob) : evidenceItem.url;
    setEditingEvidencePreview({
      snapshot: {
        status: "ready",
        approved: true,
        id: evidenceItem.id,
        previewUrl,
        metadata,
        blob: evidenceItem.blob || null,
      },
    });
    return () => {
      if (evidenceItem.blob) URL.revokeObjectURL(previewUrl);
    };
  }, [editingAnnotation?.id, editingAnnotation?.payload.updatedAt]);

  useEffect(() => {
    if (mode !== "selected" || !anchorRect || !popoverRef.current) {
      setPopoverPosition(null);
      return undefined;
    }
    let frame = null;
    const reposition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = popoverRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const next = computePopoverPosition({
          anchor: anchorRect,
          popover: { width: bounds.width, height: bounds.height },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        });
        setPopoverPosition((current) => (
          current?.left === next.left && current?.top === next.top && current?.side === next.side
            ? current
            : next
        ));
      });
    };
    reposition();
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(reposition)
      : null;
    observer?.observe(popoverRef.current);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchorRect?.left, anchorRect?.top, anchorRect?.width, anchorRect?.height, mode]);

  useEffect(() => {
    const returningFromComparison = previousComparisonOpenRef.current;
    previousComparisonOpenRef.current = comparisonOpen;
    if (mode !== "selected" || !popoverPosition || comparisonOpen) return undefined;
    const timer = setTimeout(() => {
      const popover = popoverRef.current;
      // The popover moves as it grows (poll answers, a second line); don't pull focus back to the
      // comment field from wherever the reviewer is typing inside it.
      const active = popover?.getRootNode?.().activeElement;
      if (!returningFromComparison && active && active !== popover && popover?.contains(active)) return;
      popover?.querySelector(returningFromComparison
        ? '[aria-label="More thread actions"]' : "#tm-comment")?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [mode, popoverPosition?.left, popoverPosition?.top, composerMode, comparisonOpen]);

  useEffect(() => {
    if (!pendingDelete) return undefined;
    const frame = requestAnimationFrame(() => {
      // The safe choice gets focus, so a stray ↵ never deletes.
      popoverRef.current?.querySelector(".tm-delete-confirm .tm-cancel")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingDelete?.id, pendingDelete?.kind]);

  useEffect(() => { setWorkflowMoreOpen(false); setThreadPanel(null); }, [editingAnnotation?.id]);
  useEffect(() => { setReplayingVideo(false); setReplayViewer(null); }, [editingAnnotation?.id, videoSelection?.id, mode]);
  // The thread options menu closes when the reviewer presses anywhere else in the popover.
  useEffect(() => {
    const popover = popoverRef.current;
    if (!workflowMoreOpen || !popover) return undefined;
    const close = (event) => {
      if (!event.composedPath().some((node) => node?.id === "tm-thread-menu" || node?.getAttribute?.("aria-controls") === "tm-thread-menu")) setWorkflowMoreOpen(false);
    };
    popover.addEventListener("pointerdown", close);
    return () => popover.removeEventListener("pointerdown", close);
  }, [workflowMoreOpen]);

  // A readable kind for the context line: "Button", "Link", "Heading"; generic containers say "Element".
  function contextKind(target) {
    const kind = String(target.role || target.tagName || "").toLowerCase();
    if (!kind || ["div", "span", "section", "generic", "group", "presentation", "none"].includes(kind)) return "Element";
    const names = { a: "Link", img: "Image", h1: "Heading", h2: "Heading", h3: "Heading", h4: "Heading", p: "Text", li: "List item", ul: "List", input: "Field", textarea: "Field" };
    return names[kind] || kind[0].toUpperCase() + kind.slice(1);
  }
  // The mono context line at the top of the composer and thread, e.g. "Button · Start free".
  const composerContext = !primaryTarget ? ""
    : captureKind === "video" ? `${videoModeLabel(activeVideo?.mode)} recording · ${formatClock(activeVideo?.durationMs)}`
    : captureKind === "interaction" ? `Interaction · ${interactionSelection?.interaction.events.length || 0} steps`
    : captureKind === "screenshot" ? `Sketch · ${primaryTarget.bounds?.width} × ${primaryTarget.bounds?.height}`
    : captureKind === "region" ? `Area · ${primaryTarget.bounds?.width} × ${primaryTarget.bounds?.height}`
    : captureKind === "multi" ? `${targets.length} elements`
    : captureKind === "text" ? `Text · ${targetName(primaryTarget)}`
    : [contextKind(primaryTarget), targetName(primaryTarget)].filter(Boolean).join(" · ");

  return (
    <div className={`tm-root${darkPage ? " tm-root--dark-page" : ""}`}>
      {mode === "idle" && !barHidden && (
        <IdleBar
          position={barPosition}
          shrunk={barShrunk}
          onShrink={onBarShrink}
          annotations={annotations}
          route={typeof window === "undefined" ? "/" : window.location.pathname}
          launcherRef={launcherRef}
          notifications={notifications}
          onOpen={(hasComments, toInbox) => {
            onStart();
            setInboxOpen(Boolean(toInbox));
            if ((hasComments || toInbox) && !allCommentsOpen) onToggleAllComments();
          }}
          onOpenTools={() => { onStart(); setToolbarMenu("tools"); }}
          onOpenMore={() => { onStart(); setToolbarMenu("more"); }}
          drag={{ onPointerDown: onToolbarPointerDown, onPointerMove: onToolbarPointerMove, onPointerUp: onToolbarPointerUp }}
          style={toolbarPosition ? { left: toolbarPosition.left, top: toolbarPosition.top, right: "auto", bottom: "auto", margin: 0 } : undefined}
        />
      )}

      {!["idle", "video-recording", "tour", "tour-preview"].includes(mode) && !markersHidden && !replayingVideo && annotations.map((annotation, index) => (
        <Marker
          key={annotation.id}
          annotation={annotation}
          number={index + 1}
          rect={annotationRects[annotation.id]}
          restoration={annotationRestorations[annotation.id]}
          onEdit={openPinThread}
          markerPositions={markerPositions}
          active={editingAnnotation?.id === annotation.id}
        />
      ))}

      {mode !== "idle" && selections.map((selection, index) => (
        <Outline
          key={selection.id}
          rect={selectionRects[selection.id]}
          badge={index + 1}
          grouped={selections.length > 1}
        />
      ))}
      {mode !== "idle" && textSelection && (
        <Outline rect={textSelection.displayRect} badge={1} text />
      )}
      {mode !== "idle" && regionSelection && (
        <Outline rect={regionSelection.displayRect} badge={1} region grouped />
      )}
      {mode !== "idle" && mode !== "markup" && screenshotSelection && (
        <Outline rect={screenshotSelection.anchorRect} badge={1} region grouped />
      )}
      {mode !== "idle" && interactionSelection && (
        <Outline rect={interactionSelection.displayRect} badge={1} grouped />
      )}
      {mode === "selected" && videoSelection && !replayingVideo && videoSelection.displayRect.width > 1 && (
        <Outline rect={videoSelection.displayRect} badge={1} grouped />
      )}

      {/* Tab recordings blur what the site marked private and what the reviewer chose, from setup on. */}
      {((mode === "video-setup" && videoSetup?.mode === "tab") || (mode === "video-recording" && videoRecording?.mode === "tab")) && (
        <VideoBlurLayer chosen={videoBlurred} shadowHost={shadowHost} />
      )}
      {(mode === "video-setup" || mode === "video-recording") && videoTool === "blur" && (
        <BlurPicker shadowHost={shadowHost} chosen={videoBlurred} onToggle={onToggleVideoBlur} onDone={() => onVideoTool?.(null)} />
      )}

      {mode === "video-setup" && videoCountdown != null && (
        <VideoCountdown seconds={videoCountdown} onCancel={onCancelVideoCountdown} />
      )}

      {mode === "video-setup" && videoSetup && videoTool !== "blur" && videoSetup.status !== "countdown" && (
        <VideoSetupPanel
          setup={videoSetup}
          maxDurationMs={videoMaxDurationMs}
          blurredCount={videoBlurred.length}
          onBlur={onVideoTool ? () => onVideoTool("blur") : undefined}
          onChange={onVideoSetupChange}
          onStart={onBeginVideoRecording}
          onCancel={onCancelVideoSetup}
        />
      )}

      {mode === "video-recording" && videoRecording && (
        <>
          {/* 7d / 8a: an Orange frame means live; a quiet dashed one means paused. */}
          <div className={`tm-video-frame${videoRecording.paused ? " is-paused" : ""}`} aria-hidden="true" />
          <VideoDrawLayer active={videoTool === "draw"} onStroke={onVideoStroke} />
          <RecordingCursorLayer shadowHost={shadowHost} />
          {videoSetup?.camera && videoRecording.cameraOn !== false && videoSetup.previewStream?.getVideoTracks?.().length > 0 && (
            <CameraBubble stream={videoSetup.previewStream} />
          )}
          <VideoRecorderBar
            state={videoRecording}
            tool={videoTool}
            onTool={onVideoTool}
            onPause={onToggleVideoPause}
            onSource={onToggleVideoSource}
            onMoment={onMarkVideoMoment}
            onStop={onStopVideo}
          />
        </>
      )}

      {mode === "selected" && replayingVideo && activeVideo && activeVideoMedia && (
        <VoiceReplay
          video={activeVideo}
          media={activeVideoMedia}
          author={editingAnnotation?.payload.author || reviewer}
          onClose={() => setReplayingVideo(false)}
        />
      )}

      {mode === "recording" && interactionRecording && (
        <section className="tm-interaction-recorder" aria-label="Interaction recorder">
          <span className="tm-recording-dot" aria-hidden="true" />
          <div className="tm-interaction-recorder__copy">
            <strong aria-live="polite">Recording interaction · {formatInteractionDuration(interactionRecording.elapsedMs)}</strong>
            <span>Use the page normally, then stop when the sequence is complete.</span>
          </div>
          <span className="tm-interaction-recorder__count">
            {interactionRecording.eventCount} step{interactionRecording.eventCount === 1 ? "" : "s"}
          </span>
          <button type="button" className="tm-cancel" onClick={onCancelInteraction}>Cancel</button>
          <button type="button" className="tm-recording-stop" onClick={onStopInteraction}>
            <StopIcon />
            Stop
          </button>
        </section>
      )}

      {mode === "screenshot-select" && (
        <ScreenshotAreaSelector
          onComplete={onScreenshotAreaComplete}
          onCancel={onScreenshotCancel}
          color={captureColor}
          onColor={setCaptureColor}
        />
      )}

      {mode === "markup" && screenshotSelection && (
        <MarkupEditor
          screenshot={screenshotSelection}
          onStrokesChange={onScreenshotStrokesChange}
          onCancel={onScreenshotCancel}
          onConfirm={onScreenshotConfirm}
          composing={composingScreenshot}
          color={captureColor}
          onColor={setCaptureColor}
          onRebox={onScreenshot}
          onWhole={() => { onScreenshot?.(); onScreenshotAreaComplete({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }); }}
          onAdjust={(rect) => { onScreenshot?.(); onScreenshotAreaComplete(rect); }}
        />
      )}

      {mode === "picking" && (
        <>
          {!drawRect && <Outline rect={hoverRect} hover />}
          {drawRect && (
            <div
              className="tm-draft-region"
              style={{ top: drawRect.top, left: drawRect.left, width: drawRect.width, height: drawRect.height }}
              aria-hidden="true"
            >
              <span>{Math.round(drawRect.width)} × {Math.round(drawRect.height)}</span>
            </div>
          )}

          <div
            className={`tm-modebar tm-bar--at-${barPosition}${toolbarMenu ? " has-open-menu" : ""}`}
            role="toolbar"
            aria-label="Threadmark annotation tools"
            style={toolbarPosition ? {
              left: toolbarPosition.left,
              top: toolbarPosition.top,
              right: "auto",
              bottom: "auto",
              margin: 0,
            } : undefined}
          >
            <button
              type="button"
              className="tm-drag-handle"
              aria-label="Move annotation toolbar"
              title="Drag toolbar"
              onPointerDown={onToolbarPointerDown}
              onPointerMove={onToolbarPointerMove}
              onPointerUp={onToolbarPointerUp}
              onPointerCancel={onToolbarPointerUp}
            >
              <GripIcon />
            </button>
            {/* No standing hint: the Bar speaks up only when something is happening. */}
            {(selectedCount >= 2 || drawRect || repinning) && <>
              <BarHint>
                {selectedCount >= 2
                  ? `${selectedCount} elements selected`
                  : drawRect ? "Release to comment on this area" : "Click the new spot for this comment"}
              </BarHint>
              <div className="tm-toolbar-divider" />
            </>}
            <div className="tm-tool-group tm-toolbar-tools">
              <button ref={toolsTriggerRef} type="button" className={`tm-tool-switch is-active${toolbarMenu === "tools" ? " is-open" : ""}`}
                aria-label="Feedback tools: Comment" title="Feedback tools" aria-haspopup="menu" aria-expanded={toolbarMenu === "tools"}
                aria-controls={toolbarMenu === "tools" ? "tm-tool-menu" : undefined}
                data-menu-open={toolbarMenu === "tools" ? "true" : undefined}
                onKeyDown={(event) => { if (event.key === "Escape" && toolbarMenu) closeToolbarMenu(true); }}
                onClick={() => setToolbarMenu((open) => (open === "tools" ? null : "tools"))}>
                <Cursor {...iconProps} />
                <ChevronDown size={13} className="tm-tool-switch__chevron" aria-hidden="true" />
              </button>
              <button ref={moreTriggerRef} type="button" className={`tm-toolbar-more${toolbarMenu === "more" ? " is-open" : ""}`}
                aria-label={brokenAnnotations.length
                  ? `More actions, ${brokenAnnotations.length} lost comment${brokenAnnotations.length === 1 ? "" : "s"}`
                  : "More actions"}
                title="More actions" aria-haspopup="menu" aria-expanded={toolbarMenu === "more"}
                aria-controls={toolbarMenu === "more" ? "tm-more-menu" : undefined}
                data-menu-open={toolbarMenu === "more" ? "true" : undefined}
                onKeyDown={(event) => { if (event.key === "Escape" && toolbarMenu) closeToolbarMenu(true); }}
                onClick={() => setToolbarMenu((open) => (open === "more" ? null : "more"))}>
                <Ellipsis {...iconProps} />
                {brokenAnnotations.length > 0
                  ? <span className="tm-toolbar-more__flag tm-toolbar-more__flag--repair" aria-hidden="true" />
                  : (paused || markersHidden) && <span className="tm-toolbar-more__flag" aria-hidden="true" />}
              </button>
            </div>
            {toolbarMenu === "tools" && (
              <ToolbarMenu id="tm-tool-menu" label="Feedback tools" below={toolbarMenusBelow} triggerRef={toolsTriggerRef} onClose={closeToolbarMenu}>
                <ToolbarMenuItem role="menuitemradio" aria-checked="true" data-autofocus="true"
                  icon={<Cursor size={17} />} label="Comment" description="Click, select text, or drag an area"
                  shortcut="C" keyshortcuts="C" onClick={() => closeToolbarMenu(true)} />
                <ToolbarMenuItem role="menuitemradio" aria-checked="false"
                  icon={<PencilIcon />} label="Sketch on a screenshot" description="Crop an area and draw on it"
                  shortcut="S" keyshortcuts="S" onClick={runToolbarItem(onScreenshot)} />
                <ToolbarMenuItem role="menuitemradio" aria-checked="false"
                  icon={<InteractionIcon />} label="Record an interaction" description="Up to 15 seconds of clicks and steps"
                  shortcut="R" keyshortcuts="R" onClick={runToolbarItem(onStartInteraction)} />
                {videoEnabled && (
                  <ToolbarMenuItem role="menuitemradio" aria-checked="false"
                    icon={<VideoIcon />} label="Record a video" description="Your tab, voice, and camera"
                    shortcut="V" keyshortcuts="V" onClick={runToolbarItem(onStartVideo)} />
                )}
                {onSurveyPublish && (
                  <ToolbarMenuItem role="menuitemradio" aria-checked="false"
                    icon={<PollIcon {...iconProps} />} label="Ask a question" description="A short poll, scale or question for people on this page"
                    onClick={runToolbarItem(() => setSurveyBuilderOpen(true))} />
                )}
                {onStartHostedReview && (
                  <ToolbarMenuItem role="menuitemradio" aria-checked="false"
                    icon={<AiIcon {...iconProps} />} label="Review this page" description="AI suggests comments for you to review"
                    onClick={runToolbarItem(onStartHostedReview)} />
                )}
                {onAiReview && (
                  <ToolbarMenuItem role="menuitemradio" aria-checked="false"
                    icon={<AiIcon {...iconProps} />} label="Ask AI to review this page" description="It suggests; you decide what gets posted"
                    onClick={runToolbarItem(() => setAiReviewOpen(true))} />
                )}
                <div className="tm-toolbar-menu__separator" role="separator" />
                <ToolbarMenuItem role="menuitemradio" aria-checked="false"
                  icon={<TourIcon {...iconProps} />} label="Build a tour" description="Click elements to add tour steps"
                  onClick={runToolbarItem(onStartTour)} />
              </ToolbarMenu>
            )}
            {toolbarMenu === "more" && (
              <ToolbarMenu id="tm-more-menu" label="More actions" below={toolbarMenusBelow} triggerRef={moreTriggerRef} onClose={closeToolbarMenu}>
                <ToolbarMenuItem icon={<PauseIcon paused={paused} />} label="Pause animations" checked={paused}
                  shortcut="P" keyshortcuts="P" onClick={runToolbarItem(onPause)} />
                <ToolbarMenuItem icon={<EyeIcon hidden={markersHidden} />} label="Hide comment pins" checked={markersHidden}
                  disabled={!annotations.length} shortcut="H" keyshortcuts="H" onClick={runToolbarItem(onVisibility)} />
                {onBarShrink && <ToolbarMenuItem icon={<span className="tm-menu-dot" aria-hidden="true" />} label="Shrink to a dot"
                  shortcut="⌘." keyshortcuts="Meta+." onClick={runToolbarItem(() => { onBarShrink(true); onExit(); })} />}
                {onBarHide && <ToolbarMenuItem icon={<HideIcon {...iconProps} />} label="Hide on this page"
                  onClick={runToolbarItem(onBarHide)} />}
                {canShare && <ToolbarMenuItem icon={<ShareIcon {...iconProps} />} label="Share"
                  onClick={runToolbarItem(() => setShareOpen(true))} />}
                {dashboardUrl && <ToolbarMenuItem icon={<ExternalLink {...iconProps} />} label="Open the dashboard"
                  onClick={runToolbarItem(() => window.open(dashboardUrl, "_blank", "noopener,noreferrer"))} />}
                {canEditYou && <ToolbarMenuItem icon={<EditIcon {...iconProps} />} label="Your settings"
                  onClick={runToolbarItem(() => setYouOpen("settings"))} />}
                {onShortcutsOpenChange && <ToolbarMenuItem icon={<InfoIcon {...iconProps} />} label="Keyboard shortcuts"
                  shortcut="?" keyshortcuts="Shift+?" onClick={runToolbarItem(() => onShortcutsOpenChange(true))} />}
                <div className="tm-toolbar-menu__separator" role="separator" />
                <ToolbarMenuItem icon={<CopyIcon />} label="Copy as Markdown" disabled={!annotations.length}
                  shortcut="⇧C" keyshortcuts="Shift+C" onClick={runToolbarItem(onCopy)} />
                {brokenAnnotations.length > 0 && (
                  <ToolbarMenuItem icon={<WarningIcon />} label="Repair lost comments"
                    aria-label={`Repair lost comments: ${brokenAnnotations.length} target${brokenAnnotations.length === 1 ? "" : "s"} need repair`}
                    badge={<span className="tm-toolbar-menu__badge" aria-hidden="true">{brokenAnnotations.length}</span>}
                    onClick={runToolbarItem(() => onEditAnnotation(brokenAnnotations[0].id))} />
                )}
                <div className="tm-toolbar-menu__separator" role="separator" />
                <ToolbarMenuItem danger icon={<ClearIcon />}
                  label={clearArmed ? "Click again to clear all" : "Clear all comments"}
                  aria-label={clearArmed ? "Confirm clear annotations (X)" : undefined}
                  data-autofocus={clearArmed ? "true" : undefined}
                  disabled={!annotations.length && !selectedCount} shortcut="X" keyshortcuts="X"
                  onClick={clearArmed ? runToolbarItem(onClearAll) : onClearAll} />
              </ToolbarMenu>
            )}
            {selectedCount >= 2 && (
              <button type="button" className="tm-button--primary" onClick={onComment}>
                Comment {selectedCount}
              </button>
            )}
            <div className="tm-toolbar-divider" />
            {/* Comments and Inbox each open the side panel on their own view; clicking the one showing closes it. Next steps stays a panel tab. */}
            <div className="tm-tool-group">
              <button type="button" className={`tm-all-comments-trigger${panelView === "comments" ? " is-active" : ""}`} aria-label="Comments" title="Comments"
                aria-expanded={panelView === "comments"} aria-controls="tm-all-comments" onClick={() => openPanelView("comments")}>
                <MessagesSquare {...iconProps} />
                {projectAnnotations.length > 0 && <span className="tm-count-badge" aria-hidden="true">{projectAnnotations.length > 99 ? "99+" : projectAnnotations.length}</span>}
              </button>
              {notifications && <button type="button" className={`tm-all-comments-trigger tm-inbox-trigger${panelView === "inbox" ? " is-active" : ""}`}
                aria-label={unreadInboxCount ? `Inbox, ${unreadInboxCount} unread` : "Inbox"} title="Inbox"
                aria-expanded={panelView === "inbox"} aria-controls="tm-all-comments" onClick={() => openPanelView("inbox")}>
                <InboxIcon {...iconProps} />
                {unreadInboxCount > 0 && <span className="tm-count-badge" aria-hidden="true">{unreadInboxCount > 99 ? "99+" : unreadInboxCount}</span>}
              </button>}
            </div>
            <div className="tm-toolbar-divider" />
            <ToolButton icon={<CloseIcon />} label="Close annotations (Esc)" onClick={onExit} />
          </div>
        </>
      )}

      {toolbarDragging && (
        <div className="tm-bar-spots" aria-hidden="true">
          {["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"].map((spot) => <span key={spot} className={`tm-bar-spot tm-bar--at-${spot}`} />)}
        </div>
      )}

      {shortcutsOpen && <ShortcutSheet videoEnabled={videoEnabled} aiEnabled={Boolean(onAskAi && onPostAiComment)} onClose={() => onShortcutsOpenChange?.(false)} />}

      {youOpen === "face" && onReviewerChange && (
        <FaceSheet reviewer={reviewer} faces={faces} onReviewerChange={onReviewerChange} onClose={() => setYouOpen(false)}
          onDone={() => { setYouOpen(false); onAiNotice?.("Your face is set"); }} />
      )}
      {youOpen === "settings" && canEditYou && (
        <YouSheet reviewer={reviewer ? { ...reviewer, email: reviewerEmail } : null} notificationSettings={notificationSettings}
          projectName={projectName} onReviewerChange={onReviewerChange} onNotificationSettingsChange={onNotificationSettingsChange}
          onLeave={onLeaveProject ? () => setYouOpen("leave") : null} onClose={() => setYouOpen(false)} />
      )}
      {youOpen === "leave" && onLeaveProject && (
        <LeaveSheet projectName={projectName} onLeaveProject={onLeaveProject} onClose={() => setYouOpen("settings")}
          onDone={() => { setYouOpen(false); onAiNotice?.(`You left ${projectName || "the project"}`); }} />
      )}

      {shareOpen && canShare && (
        <ShareSheet projectName={projectName} shareUrl={shareUrl} linkAccess={linkAccess} members={members} inviteSuggestions={inviteSuggestions}
          onInvite={onInvite} onMemberChange={onMemberChange} onResendInvite={onResendInvite}
          onLinkAccessChange={onLinkAccessChange} onClose={() => setShareOpen(false)} />
      )}

      {onAiReview && onPostAiComment && (
        <AiPageReview open={aiReviewOpen} onOpenChange={setAiReviewOpen} route={aiRoute} buildId={aiBuildId}
          ignoredSelectors={aiIgnoredSelectors} onAiReview={onAiReview} onAiDismiss={onAiDismiss}
          onPost={onPostAiComment} onNotice={onAiNotice} barPosition={barPosition} />
      )}
      {askAiElement && onAskAi && (
        <AskAiCard element={askAiElement} route={aiRoute} onAskAi={onAskAi}
          onCopy={async (text) => { if (await onCopyText(text)) onAiNotice?.("Copied for your AI"); }}
          onPost={async (text) => {
            try {
              await onPostAiComment({ element: askAiElement, comment: text });
              setAskAiElement(null);
              onRequestDismiss?.();
              onAiNotice?.("Posted from AI");
            } catch (error) { onAiNotice?.(error?.message ? `Couldn’t post: ${error.message}` : "Couldn’t post. Try again."); }
          }}
          onClose={() => setAskAiElement(null)} />
      )}
      {mode === "tour" && (
        <>
          <Outline rect={hoverRect} hover />
          <div className="tm-gesture-hint" aria-hidden="true">Click an element to add a tour step · Esc to go back</div>
          <TourPanel
            drafts={tourDrafts}
            activeId={tourActiveId}
            onChange={onTourDraftsChange}
            pick={tourPick}
            route={window.location.pathname}
            onPreview={onTourPreview}
            onSave={onTourSave}
            onSendToAi={onTourSendToAi}
            aiConnection={aiConnection}
            onConnectAi={onConnectAi}
            onCopy={onCopyText}
            onClose={onExitTour}
            stepComments={tourStepComments}
            codeRuleTourIds={tourCodeRules}
            onCommentOnStep={onCommentOnTourStep}
            onOpenComment={onOpenTourComment}
          />
        </>
      )}

      {mode === "tour-preview" && (
        /* 20d: the bar stays small, says where the preview is, and stops at any step. Nothing is saved. */
        <BarStatus icon={TourIcon} title={tourPreviewInfo?.title || "Your tour"} position={barPosition} onStop={onStopTourPreview}
          hint="Trying your tour. Nothing is saved."
          detail={tourPreviewInfo?.total ? `Previewing step ${Math.min(tourPreviewInfo.step + 1, tourPreviewInfo.total)} of ${tourPreviewInfo.total}` : "Previewing"} />
      )}

      {surveyBuilderOpen && mode === "picking" && onSurveyPublish && (
        <SurveyBuilder route={surveyRoute} onPublish={onSurveyPublish} onClose={() => setSurveyBuilderOpen(false)} />
      )}
      {allCommentsOpen && ["picking", "selected"].includes(mode) && (
        <AllCommentsPanel annotations={projectAnnotations} restorations={annotationRestorations} reviewer={reviewer}
          route={pageVersionRoute} hidden={mode !== "picking"} onClose={onCloseAllComments} onOpen={onOpenListedAnnotation}
          tab={panelTab}
          onTabChange={(tab) => { setInboxOpen(tab === "inbox"); onShowNextSteps(tab === "next-steps"); }}
          pageVersions={pageVersions} onSelectPageVersion={onSelectPageVersion}
          nextSteps={nextSteps} canTickNextSteps={canTickNextSteps} onNextStepDone={onNextStepDone}
          onOpenNextStepSource={onOpenNextStepSource} onCopyNextSteps={onCopyNextSteps}
          notifications={notifications} onOpenNotification={onOpenNotification} onNotificationsSeen={onNotificationsSeen}
          surveys={surveys} surveyResults={surveyResults} openSurveyId={openSurveyId} onOpenSurvey={setOpenSurveyId} onSurveyEnd={onSurveyEnd}
          onOpenYou={canEditYou ? () => setYouOpen("settings") : null} onOpenShare={canShare ? () => setShareOpen(true) : null} members={members}
          onNotice={onAiNotice}
          youMenu={hasYouMenu ? {
            email: reviewerEmail,
            onFace: onReviewerChange ? () => setYouOpen("face") : null,
            onSettings: canEditYou ? () => setYouOpen("settings") : null,
            onShortcuts: onShortcutsOpenChange ? () => onShortcutsOpenChange(true) : null,
            onHide: onBarHide || null,
            onSignOut: onSignOut || null,
          } : null} />
      )}

      {replayViewer && (
        <Suspense fallback={null}>
          <ReplayPlayer replay={replayViewer.replay} media={replayViewer.media} kit={replayKit} onClose={() => setReplayViewer(null)} />
        </Suspense>
      )}

      {videoMoment && mode === "selected" && (
        <div key={videoMoment.key} className="tm-video-moment-mark" aria-hidden="true"
          style={{ top: videoMoment.rect.top - 4, left: videoMoment.rect.left - 4, width: videoMoment.rect.width + 8, height: videoMoment.rect.height + 8 }} />
      )}

      {mode === "selected" && composingNew && primaryTarget && !reviewingVideo && !replayingVideo && (
        /* 2c: the bar stays put and says what is happening. */
        <div className={`tm-modebar tm-modebar--writing tm-bar--at-${barPosition}`} aria-hidden="true"
          style={toolbarPosition ? { left: toolbarPosition.left, top: toolbarPosition.top, right: "auto", bottom: "auto", margin: 0 } : undefined}>
          <BarHint>{askKind === "poll" ? "Writing a comment with a poll" : "Writing a comment"}</BarHint>
        </div>
      )}

      {mode === "selected" && reviewingVideo && (
        <VideoReviewCard
          key={videoReview.id}
          review={videoReview}
          video={videoSelection.video}
          media={videoSelection.evidence}
          posting={submitting}
          onPost={onPostVideo}
          onRetake={onRetakeVideo}
          onDelete={onDiscardVideo}
        />
      )}

      {mode === "selected" && primaryTarget && !replayingVideo && !replayViewer && !reviewingVideo && (
        <>
          <div
            className="tm-dismiss-layer"
            aria-hidden="true"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!submitting) onRequestDismiss();
            }}
          />
          <aside
            ref={popoverRef}
            className={`tm-popover${editingAnnotation ? " tm-popover--thread" : ""}${composingNew ? " tm-popover--compose" : ""}${threadDocked ? " tm-popover--docked" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tm-popover-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (sketchCompose && event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onBackToDrawing(); return; }
              trapDialogFocus(event, event.currentTarget);
            }}
            data-menu-open={sketchCompose ? "true" : undefined}
            data-placement={popoverPosition?.side || "below"}
            style={threadDocked ? undefined : {
              left: popoverPosition?.left ?? 12,
              top: popoverPosition?.top ?? 12,
              visibility: popoverPosition ? "visible" : "hidden",
            }}
          >
          {threadDocked && (
            /* 18c: a thread opened from the panel opens in the panel, with a way back to the list. */
            <div className="tm-thread-back">
              <button type="button" onClick={onRequestDismiss} disabled={submitting}>
                <ArrowLeftIcon size={14} aria-hidden="true" focusable="false" />{inboxOpen && notifications ? "Inbox" : "All comments"}
              </button>
              <span>{[editingAnnotation.payload.route && editingAnnotation.payload.route !== pageVersionRoute ? routeLabel(editingAnnotation.payload.route) : null, targetName(primaryTarget)].filter(Boolean).join(" · ")}</span>
            </div>
          )}
          {editingAnnotation ? (
          <div className="tm-popover__header tm-popover__header--thread">
            <h2 id="tm-popover-title">{(() => {
              const noun = editingAnnotation.payload.ask?.kind === "poll" ? "poll" : editingAnnotation.payload.ask?.kind === "question" ? "question" : "comment";
              const status = editingAnnotation.payload.workflow?.status === "resolved"
                ? `${noun === "poll" ? "Closed" : "Resolved"} ${noun}`
                : noun === "comment" ? "Thread" : `${noun[0].toUpperCase()}${noun.slice(1)}`;
              const number = annotations.findIndex((item) => item.id === editingAnnotation.id) + 1;
              return <><span className="tm-sr-only">{status}: </span>{[number > 0 ? `#${number}` : null, threadDocked ? null : composerContext].filter(Boolean).join(" · ")}</>;
            })()}</h2>
            <div className="tm-thread-header-actions">
              <button type="button" aria-label="More thread actions" title="More thread actions"
                aria-haspopup="menu" aria-expanded={workflowMoreOpen} aria-controls="tm-thread-menu" className={workflowMoreOpen ? "is-active" : undefined}
                data-menu-open={workflowMoreOpen ? "true" : undefined}
                onKeyDown={(event) => { if (event.key === "Escape" && workflowMoreOpen) setWorkflowMoreOpen(false); }}
                onClick={() => setWorkflowMoreOpen((open) => !open)}>
                <Ellipsis {...iconProps} />
              </button>
              <button type="button" disabled={submitting}
                className={editingAnnotation.payload.workflow?.status === "resolved" ? "is-active" : undefined}
                aria-label={editingAnnotation.payload.workflow?.status === "resolved" ? "Reopen comment" : "Resolve comment"}
                title={editingAnnotation.payload.workflow?.status === "resolved" ? "Reopen comment" : "Resolve comment"}
                onClick={() => onWorkflowChange(editingAnnotation.payload.workflow?.status === "resolved" ? "reopened" : "resolved")}>
                <CircleCheck {...iconProps} />
              </button>
              <button type="button" aria-label="Cancel comment" title="Close" onClick={onRequestDismiss} disabled={submitting}><CloseIcon /></button>
            </div>
          </div>
          ) : null}
          {editingAnnotation && workflowMoreOpen && (
            <div id="tm-thread-menu" className="tm-menu tm-thread-menu" role="menu" aria-label="Thread options" data-menu-open="true"
              onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setWorkflowMoreOpen(false); } }}>
              {[
                { key: "repin", label: "Repin comment", icon: <MapPinPen size={15} />, run: () => onRepin(editingAnnotation.id) },
                { key: "link", label: "Copy link", icon: <Link2 size={15} />, run: () => onCopyAnnotationLink(editingAnnotation.id) },
                onCarryFeedbackForward && carryForwardVersions.length > 0
                  && { key: "carry", label: "Carry forward", icon: <CopyPlus size={15} />, run: () => setCarryForwardOpen(true) },
                { key: "compare", label: "Compare with current page", icon: <GitCompare size={15} />, run: () => setThreadPanel("compare") },
                !!editingAnnotation.payload.workflow?.history?.length
                  && { key: "history", label: "Activity history", icon: <History size={15} />, run: () => setThreadPanel("history") },
              ].filter(Boolean).map((item) => (
                <button type="button" role="menuitem" key={item.key} disabled={submitting}
                  onClick={() => { setWorkflowMoreOpen(false); item.run(); }}>
                  {item.icon}{item.label}
                </button>
              ))}
            </div>
          )}
          {editingAnnotation ? null : (
          <div className="tm-popover__header tm-composer__header">
            {sketchCompose ? (
              <div className="tm-composer__sketch">
                <img src={screenshotSelection.snapshot.previewUrl} alt="" />
                <span>
                  <strong id="tm-popover-title"><span className="tm-sr-only">Commenting on: </span>Region{screenshotSelection.placeLabel ? ` · ${screenshotSelection.placeLabel}` : ""}</strong>
                  <small>{screenshotSelection.strokes?.length ? "Screenshot with your sketch" : "Screenshot"}</small>
                </span>
                <button type="button" aria-label="Back to drawing" title="Back to drawing (Esc)" onClick={onBackToDrawing} disabled={submitting}>
                  <CloseIcon />
                </button>
              </div>
            ) : (
              /* 2c: what you picked, in one quiet line. */
              <p className="tm-composer__target">
                <MessageSquare size={14} aria-hidden="true" focusable="false" />
                <span id="tm-popover-title"><span className="tm-sr-only">Commenting on: </span>{composerContext}</span>
              </p>
            )}
            {/* 28a: point at one thing and ask AI about it instead of writing a comment yourself. */}
            {onAskAi && onPostAiComment && captureKind === "element" && lastSelection?.element && (
              <button type="button" className="tm-ask-ai" onClick={() => setAskAiElement(lastSelection.element)}
                aria-keyshortcuts="Meta+K" title="Ask AI about this (⌘K)">
                <AiIcon size={14} aria-hidden="true" focusable="false" /><span>Ask AI</span>
              </button>
            )}
            {repinning && <button type="button" aria-label="Cancel comment" onClick={onRequestDismiss} disabled={submitting}><CloseIcon /></button>}
          </div>
          )}

          <form className="tm-form" onSubmit={onSubmit}>
            {/* Thread options stay mounted while collapsed so an in-progress comparison is not lost. */}
            {editingAnnotation && threadPanel === "history" && (
              <section className="tm-thread-panel" aria-label="Activity history">
                <div className="tm-thread-panel__header">
                  <strong>Activity history</strong>
                  <button type="button" aria-label="Close activity history" onClick={() => setThreadPanel(null)}><X size={14} /></button>
                </div>
                {(editingAnnotation.payload.workflow?.history || []).map((item, index) => <p key={index}>{item.actor?.displayName || "Reviewer"} · {item.action.replaceAll("_", " ")} · {item.buildId || "Unknown build"} · {formatMessageTime(item.at)}{item.assignee ? ` · ${item.assignee.displayName}` : ""}</p>)}
              </section>
            )}
            {editingAnnotation && editingRestoration?.status !== "resolved" && (
              <div className="tm-repair-state" role="alert">
                <WarningIcon />
                <div>
                  <strong>{restorationTitle(editingRestoration)}</strong>
                  <span>{restorationMessage(editingRestoration, editingAnnotation)}</span>
                </div>
                {editingRestoration?.status === "changed" ? (
                  <div className="tm-repair-actions">
                    <button type="button" onClick={() => onConfirmSuggestedPin(editingAnnotation.id)} disabled={submitting}>
                      Confirm location
                    </button>
                    <button type="button" onClick={() => onRepin(editingAnnotation.id)} disabled={submitting}>
                      Choose another
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => onRepin(editingAnnotation.id)} disabled={submitting}>
                    Repin comment
                  </button>
                )}
              </div>
            )}
            {editingAnnotation && (
              <section className="tm-thread" aria-label="Annotation discussion">
                <ThreadMessage
                  message={{
                    id: editingAnnotation.payload.id,
                    comment: editingAnnotation.payload.comment,
                    reactions: editingAnnotation.payload.reactions,
                    createdAt: editingAnnotation.payload.createdAt,
                    author: editingAnnotation.payload.author,
                  }}
                  annotation
                  links={editingAnnotation.payload.links}
                  fromAi={["ai", "ai_review"].includes(editingAnnotation.payload.source)}
                  onReactionChange={onReactionChange ? (messageId, emoji, active) => onReactionChange(editingAnnotation.id, messageId, emoji, active) : undefined}
                  currentReviewer={reviewer}
                  onReply={onBeginReply}
                  onDelete={onRequestDelete}
                  onEdit={repinning ? undefined : onBeginEdit}
                  editor={composerMode === "edit" && !repinning && !editingReplyId ? (
                    <div className="tm-inline-edit" data-menu-open="true">
                      <label className="tm-sr-only" htmlFor="tm-comment">Edit comment</label>
                      <MentionTextarea
                        reviewers={reviewers}
                        id="tm-comment"
                        value={comment}
                        onValueChange={setComment}
                        maxLength={6000}
                        // Board 07, 23b: ⌘↵ saves, Esc puts it back as it was; the caret starts at the end.
                        onFocus={(event) => { const end = event.target.value.length; event.target.setSelectionRange(end, end); }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!submitting) onCancelReply(); }
                          else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
                        }}
                      />
                      <div className="tm-inline-edit__actions">
                        <button type="button" className="tm-cancel" onClick={onCancelReply} disabled={submitting}>Cancel</button>
                        <button type="submit" className="tm-submit" disabled={submitting || !comment.trim()}>
                          {submitting ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                />
                {editingAnnotation.payload.ask?.kind === "question" && (
                  <p className="tm-ask-tag"><CircleHelp size={13} aria-hidden="true" /> Question · answer it with a reply</p>
                )}
                {editingAnnotation.payload.ask?.kind === "poll" && (
                  <PollCard
                    ask={editingAnnotation.payload.ask}
                    results={editingAnnotation.poll}
                    closed={editingAnnotation.payload.workflow?.status === "resolved"}
                    onVote={pollsEnabled && onVote ? (ids) => onVote(editingAnnotation.id, ids) : null}
                  />
                )}
                {(editingAnnotation.payload.replies || []).map((reply) => (
                  <ThreadMessage
                    key={reply.id}
                    message={reply}
                    onReactionChange={onReactionChange ? (messageId, emoji, active) => onReactionChange(editingAnnotation.id, messageId, emoji, active) : undefined}
                    currentReviewer={reviewer}
                    onReply={onBeginReply}
                    onDelete={onRequestDelete}
                    onEdit={!repinning && reply.author?.id && reply.author.id === reviewer?.id ? () => onBeginEdit(reply.id) : undefined}
                    editor={composerMode === "edit" && !repinning && editingReplyId === reply.id ? (
                    <div className="tm-inline-edit" data-menu-open="true">
                      <label className="tm-sr-only" htmlFor="tm-comment">Edit comment</label>
                      <MentionTextarea
                        reviewers={reviewers}
                        id="tm-comment"
                        value={comment}
                        onValueChange={setComment}
                        maxLength={6000}
                        // Board 07, 23b: ⌘↵ saves, Esc puts it back as it was; the caret starts at the end.
                        onFocus={(event) => { const end = event.target.value.length; event.target.setSelectionRange(end, end); }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!submitting) onCancelReply(); }
                          else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
                        }}
                      />
                      <div className="tm-inline-edit__actions">
                        <button type="button" className="tm-cancel" onClick={onCancelReply} disabled={submitting}>Cancel</button>
                        <button type="submit" className="tm-submit" disabled={submitting || !comment.trim()}>
                          {submitting ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                    ) : null}
                  />
                ))}
              </section>
            )}
            {editingAnnotation?.payload.pin && (
              <details className="tm-composer-mode"><summary>Pin location history</summary>
                <p>Original screenshot and discussion preserved.</p>
                {[...(editingAnnotation.payload.pinHistory || []), editingAnnotation.payload.pin].map((pin, index) => (
                  <p key={index}>{pin.movedBy?.displayName || "Reviewer"} · {pin.buildId || "Unknown build"} · {pin.movedAt} · {pin.target.accessibleName || pin.target.tagName}</p>
                ))}
              </details>
            )}
            {repinning && <p role="status">{repinTargetCount > 1
              ? `This comment covers ${repinTargetCount} elements. Repinning moves it to the one element you chose; the original ${repinTargetCount} targets, screenshot and discussion stay in its history.`
              : "Confirm this new pin location. The original screenshot and discussion will be preserved."}</p>}
            {!editingAnnotation && !repinning && <div className={`tm-field tm-field--${composerMode}`} key={composerMode}>
              <label className="tm-sr-only" htmlFor="tm-comment">
                {composerMode === "reply" ? "Write a reply" : askKind === "poll" ? "What should people vote on?" : "What should change?"}
              </label>
              <MentionTextarea
                reviewers={reviewers}
                id="tm-comment"
                value={comment}
                onValueChange={setComment}
                placeholder={composerMode === "reply"
                  ? "Write a reply…"
                  : askKind === "poll" ? "What should people vote on?" : "Describe the change…"}
                maxLength={6000}
                aria-describedby={comment.length >= 5500 ? "tm-comment-limit" : undefined}
                aria-keyshortcuts="Enter"
                onKeyDown={(event) => {
                  // 2c: ↵ posts; Shift+↵ starts a new line.
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
                }}
              />
              {comment.length >= 5500 && (
                <small id="tm-comment-limit" className="tm-field__limit" aria-live="polite">
                  {6000 - comment.length} characters remaining
                </small>
              )}
              {composerMode === "new" && askKind === "poll" && onPollOptionsChange && (
                <PollEditor
                  options={pollOptions}
                  onChange={onPollOptionsChange}
                  multiple={pollMultiple}
                  onMultipleChange={onPollMultipleChange}
                  onRemove={onAskKindChange ? () => { onAskKindChange("comment"); popoverRef.current?.querySelector("#tm-comment")?.focus(); } : undefined}
                  disabled={submitting}
                />
              )}
            </div>

            }
            {/* Ordinary comments attach their masked screenshot automatically, so only saved, region and Pencil evidence is shown. */}
            {(editingEvidencePreview || regionSelection || (screenshotSelection && !sketchCompose)) && (
              <SnapshotPreview
                selection={editingEvidencePreview || screenshotSelection || regionSelection}
                readOnly={Boolean(editingEvidencePreview)}
                onRetry={editingAnnotation ? undefined : screenshotSelection ? onScreenshot : onRetrySnapshot}
              />
            )}

            {savedReplay && (
              <button
                type="button"
                className="tm-replay-open"
                disabled={!(savedReplayEvidence?.blob || savedReplayEvidence?.url)}
                onClick={() => setReplayViewer({
                  replay: savedReplay,
                  media: { blob: savedReplayEvidence?.blob || null, url: savedReplayEvidence?.blob ? null : savedReplayEvidence?.url },
                })}
              >
                <MonitorPlay {...iconProps} />
                <span>
                  <strong>View playback</strong>
                  <small>{savedReplayEvidence ? replayFacts(savedReplay) : "The recording isn’t available on this device."}</small>
                </span>
              </button>
            )}

            {/* A video or interaction trace already shows what happened, so no second, different playback. */}
            {!editingAnnotation && replayEnabled && replayDraft && !videoSelection && !interactionSelection && (
              <ReplayAttachment
                draft={replayDraft}
                onToggle={onToggleReplay}
                onPreview={() => setReplayViewer({
                  replay: { durationMs: replayDraft.summary?.durationMs, ...replayDraft.summary },
                  media: { blob: replayDraft.blob, url: null },
                })}
              />
            )}

            {activeVideo && (
              <VideoPreview
                video={activeVideo}
                media={activeVideoMedia}
                targets={editingAnnotation?.payload.targets || videoSelection?.targets || []}
                describeEvent={interactionEventLabel}
                readOnly={Boolean(editingAnnotation)}
                onReplay={() => setReplayingVideo(true)}
                onMoment={highlightVideoMoment}
              />
            )}

            {(editingAnnotation?.payload.interaction || interactionSelection?.interaction) && (
              <InteractionPreview
                interaction={editingAnnotation?.payload.interaction || interactionSelection.interaction}
                targets={editingAnnotation?.payload.targets || interactionSelection.targets}
              />
            )}

            {editingAnnotation && onCarryFeedbackForward && carryForwardVersions.length > 0 && carryForwardOpen && (
              <section className="tm-carry-forward" aria-label="Carry comment to another page version">
                <div className="tm-carry-forward__header">
                  <div>
                    <strong>Carry comment forward</strong>
                    <span>Create a host-managed copy on another deployment.</span>
                  </div>
                  <button type="button" aria-label="Close carry forward" onClick={() => setCarryForwardOpen(false)}><CloseIcon /></button>
                </div>
                <div className="tm-carry-forward__list">
                  {carryForwardVersions.map((version) => (
                    <button
                      type="button"
                      key={version.id}
                      onClick={() => onCarryFeedbackForward(version)}
                      disabled={Boolean(carryingVersionId)}
                    >
                      <span><strong>{version.label}</strong><small>{versionMeta(version)}</small></span>
                      <span>{carryingVersionId === version.id ? "Copying…" : "Copy"}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {editingAnnotation && !repinning && composerMode !== "edit" && (
              <div className="tm-reply">
                {replyTarget && (
                  <div className="tm-composer-mode">
                    <span>Replying to {replyTarget.name || "thread"}</span>
                    <button type="button" onClick={onCancelReply} disabled={submitting || deleting}>Cancel reply</button>
                  </div>
                )}
                <div className="tm-reply__row">
                  <ReviewerAvatar reviewer={reviewer} />
                  <div className="tm-reply__box">
                    <label className="tm-sr-only" htmlFor="tm-comment">Write a reply</label>
                    <MentionTextarea
                      reviewers={reviewers}
                      id="tm-comment"
                      rows={1}
                      value={comment}
                      onValueChange={setComment}
                      onKeyDown={(event) => {
                        // Enter sends, Shift+Enter adds a line, matching common comment tools.
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          if (comment.trim() && !submitting) event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder="Reply"
                      maxLength={6000}
                    />
                    {reviewers?.length > 0 && (
                      <button type="button" className="tm-reply__tool" aria-label="Mention someone" title="Mention someone (@)" disabled={submitting}
                        onClick={(event) => startMention(event.currentTarget.form?.querySelector("#tm-comment"))}>
                        <MentionIcon size={16} aria-hidden="true" focusable="false" />
                      </button>
                    )}
                    <button type="submit" className="tm-submit tm-reply__send" disabled={submitting || !comment.trim()}>
                      <ArrowUp {...iconProps} /><span className="tm-sr-only">{submitting ? "Saving…" : "Reply"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="tm-form__footer">
              {pendingDelete ? (
                <div className="tm-delete-confirm" role="alert" key="delete-confirm" data-menu-open="true"
                  onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!deleting) onCancelDelete(); } }}>
                  <ClearIcon />
                  <div className="tm-delete-confirm__impact">
                    {(() => {
                      // Board 07, 23e: say who loses what, in plain words.
                      const replies = editingAnnotation?.payload.replies || [];
                      const names = [...new Set(replies.map((reply) => reply.author?.displayName).filter(Boolean))];
                      const who = names.length > 2 ? `${names.slice(0, 2).join(", ")} and others` : names.join(" and ");
                      return pendingDelete.kind === "annotation"
                        ? <>
                          <strong>{replies.length ? "Delete this thread?" : "Delete this comment?"}</strong>
                          <span>{replies.length
                            ? `It has ${replies.length} repl${replies.length === 1 ? "y" : "ies"}${who ? `, from ${who}` : ""}. Deleting it removes the whole thread for everyone.`
                            : "Nobody has replied yet. This can’t be undone."}</span>
                        </>
                        : <><strong>Delete this reply?</strong><span>Only this reply goes. The rest of the thread stays.</span></>;
                    })()}
                  </div>
                  <button type="button" className="tm-cancel" onClick={onCancelDelete} disabled={deleting}>Keep it</button>
                  <button type="button" className="tm-delete-final" onClick={onConfirmDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : pendingDelete.kind === "annotation" ? (editingAnnotation?.payload.replies?.length ? "Delete thread" : "Delete comment") : "Delete reply"}
                  </button>
                </div>
              ) : discardPending ? (
                <div className="tm-delete-confirm" role="alert" key="discard-confirm">
                  <ClearIcon />
                  <div className="tm-delete-confirm__impact">
                    <strong>{videoSelection && !editingAnnotation ? "Discard this video?" : composerMode === "edit" ? "Discard your edits?" : composerMode === "reply" ? "Discard this reply?" : "Discard this comment?"}</strong>
                    <span>{videoSelection && !editingAnnotation
                      ? `The ${formatClock(videoSelection.video.durationMs)} recording${comment.trim() ? " and your comment haven’t" : " hasn’t"} been posted and will be lost.`
                      : composerMode === "edit" ? "Your saved comment stays as it was." : "What you typed hasn’t been posted and will be lost."}</span>
                  </div>
                  <button type="button" className="tm-cancel" onClick={onKeepEditing}>Keep editing</button>
                  <button type="button" className="tm-delete-final" onClick={onBack}>Discard</button>
                </div>
              ) : composingNew ? (
                /* 2c: Esc to cancel, then @, + and a Lime send. */
                <div className="tm-form__actions tm-composer__actions" key="compose-actions">
                  {submitting && uploadPercent !== null && (
                    <div className="tm-upload" role="progressbar" aria-label="Uploading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPercent}>
                      <span style={{ transform: `scaleX(${uploadPercent / 100})` }} />
                    </div>
                  )}
                  {sketchCompose ? (
                    <button type="button" className="tm-cancel tm-composer__esc tm-composer__esc--back" onClick={onBackToDrawing} disabled={submitting} aria-label="Back to drawing">
                      <Key>Esc</Key><span aria-hidden="true">back to drawing</span>
                    </button>
                  ) : (
                    <button type="button" className="tm-cancel tm-composer__esc" onClick={onRequestDismiss} disabled={submitting} aria-label="Cancel comment" title="Cancel">
                      <Key>Esc</Key>
                    </button>
                  )}
                  <span className="tm-composer__tools">
                    {reviewers?.length > 0 && (
                      <button type="button" className="tm-composer__tool" aria-label="Mention someone" title="Mention someone (@)" disabled={submitting}
                        onClick={(event) => startMention(event.currentTarget.form?.querySelector("#tm-comment"))}>
                        <MentionIcon size={16} aria-hidden="true" focusable="false" />
                      </button>
                    )}
                    {composerMode === "new" && onAskKindChange && pollsEnabled && (
                      /* A poll is something you attach to a comment, like a screenshot. */
                      <button type="button" className={`tm-composer__tool${askKind === "poll" ? " is-active" : ""}`} aria-label="Add a poll"
                        aria-pressed={askKind === "poll"} title={askKind === "poll" ? "Remove poll" : "Add a poll"} disabled={submitting}
                        onClick={() => {
                          onAskKindChange(askKind === "poll" ? "comment" : "poll");
                          if (askKind !== "poll") requestAnimationFrame(() => popoverRef.current?.querySelector(comment.trim() ? '[aria-label="Answer 1"]' : "#tm-comment")?.focus());
                        }}>
                        <PollIcon {...iconProps} />
                      </button>
                    )}
                    <button
                      className="tm-submit tm-composer__send"
                      type="submit"
                      title="Post (↵)"
                      disabled={
                        submitting
                        || regionSelection?.snapshot?.status === "capturing"
                        || (screenshotSelection && !screenshotSelection.snapshot?.approved)
                        || commentSnapshot?.snapshot?.status === "capturing"
                        || !comment.trim()
                        || (askKind === "poll" && pollOptions.filter((option) => option.trim()).length < 2)
                      }
                    >
                      {submitting ? <LoaderCircle {...iconProps} className="tm-tool-icon tm-spin" /> : <ArrowUp {...iconProps} />}
                      <span className="tm-sr-only">
                        {submitting
                          ? uploadPercent !== null && uploadPercent < 100 ? `Uploading ${uploadPercent}%` : "Saving…"
                          : regionSelection?.snapshot?.status === "capturing" || commentSnapshot?.snapshot?.status === "capturing"
                            ? "Preparing…"
                            : "Post"}
                      </span>
                    </button>
                  </span>
                </div>
              ) : (!editingAnnotation || repinning) ? (
                /* Saved threads post replies and edits from their own inline controls. */
                <div className="tm-form__actions" key={`actions-${composerMode}`}>
                  {submitting && uploadPercent !== null && (
                    <div className="tm-upload" role="progressbar" aria-label="Uploading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPercent}>
                      <span style={{ transform: `scaleX(${uploadPercent / 100})` }} />
                    </div>
                  )}
                  <button type="button" className="tm-cancel" onClick={onRequestDismiss} disabled={submitting}>Cancel</button>
                  <button
                    className="tm-submit"
                    type="submit"
                    disabled={
                      submitting
                      || (!editingAnnotation && regionSelection?.snapshot?.status === "capturing")
                      || (!editingAnnotation && screenshotSelection && !screenshotSelection.snapshot?.approved)
                      || (!editingAnnotation && commentSnapshot?.snapshot?.status === "capturing")
                      || (!repinning && !comment.trim())
                      || (!editingAnnotation && !repinning && askKind === "poll" && pollOptions.filter((option) => option.trim()).length < 2)
                    }
                  >
                    {submitting
                      ? uploadPercent !== null && uploadPercent < 100 ? `Uploading ${uploadPercent}%` : "Saving…"
                      : repinning ? "Repin comment"
                      : editingAnnotation && composerMode === "reply"
                        ? "Reply"
                        : editingAnnotation
                          ? "Save"
                          : regionSelection?.snapshot?.status === "capturing" || commentSnapshot?.snapshot?.status === "capturing"
                            ? "Preparing…"
                            : "Post"}
                  </button>
                </div>
              ) : null}
            </div>
          </form>
        </aside>
        {comparisonOpen && (
          <DeploymentComparison key={`${editingAnnotation.id}:${currentBuildId}:${editingAnnotation.payload.pin?.movedAt || ""}`}
            original={editingEvidencePreview} capture={captureComparison} buildId={currentBuildId}
            originalBuildId={editingAnnotation.payload.buildId} targetLabel={targetName(primaryTarget)}
            onVerify={onWorkflowChange} disabled={submitting} returnFocusRef={popoverRef}
            onClose={() => setThreadPanel(null)} />
        )}
        </>
      )}

      {notice && (
        <div className="tm-toast" role="status">
          <Check size={14} aria-hidden="true" />
          <span>{typeof notice === "string" ? notice : notice.message}</span>
          {notice.action && <button type="button" className="tm-toast__action" onClick={notice.action.run}>{notice.action.label}</button>}
        </div>
      )}
    </div>
  );
}


export {
  Overlay,
  createInteractionPageTarget,
  createScreenshotTargetDescriptor,
  interactionTargetKey,
};
