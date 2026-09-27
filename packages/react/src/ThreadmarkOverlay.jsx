import { useEffect, useRef, useState } from "react";
import CopyCheck from "lucide-react/dist/esm/icons/copy-check.mjs";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up.mjs";
import CircleCheck from "lucide-react/dist/esm/icons/circle-check.mjs";
import Ellipsis from "lucide-react/dist/esm/icons/ellipsis.mjs";
import Link2 from "lucide-react/dist/esm/icons/link-2.mjs";
import MapPinPen from "lucide-react/dist/esm/icons/map-pin-pen.mjs";
import CopyPlus from "lucide-react/dist/esm/icons/copy-plus.mjs";
import GitCompare from "lucide-react/dist/esm/icons/git-compare.mjs";
import MousePointerClick from "lucide-react/dist/esm/icons/mouse-pointer-click.mjs";
import Eye from "lucide-react/dist/esm/icons/eye.mjs";
import EyeOff from "lucide-react/dist/esm/icons/eye-off.mjs";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical.mjs";
import GitBranch from "lucide-react/dist/esm/icons/git-branch.mjs";
import History from "lucide-react/dist/esm/icons/history.mjs";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";
import MessageSquare from "lucide-react/dist/esm/icons/message-square.mjs";
import MessagesSquare from "lucide-react/dist/esm/icons/messages-square.mjs";
import Pause from "lucide-react/dist/esm/icons/pause.mjs";
import Pencil from "lucide-react/dist/esm/icons/pencil.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.mjs";
import Square from "lucide-react/dist/esm/icons/square.mjs";
import Filter from "lucide-react/dist/esm/icons/filter.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import TriangleAlert from "lucide-react/dist/esm/icons/triangle-alert.mjs";
import Undo2 from "lucide-react/dist/esm/icons/undo-2.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { computePopoverPosition } from "./popover.js";
import {
  addMarkupStroke,
  clearMarkupStrokes,
  mapMarkupPoint,
  normalizeDrawRect,
  simplifyMarkupPoints,
  undoMarkupStroke,
} from "./snapshot.js";

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

function targetName(target) {
  if (target?.kind === "region") return "Drawn region";
  if (target?.kind === "screenshot") return "Screenshot area";
  if (target?.kind === "text") return `“${target.selectedText || target.visibleText || "Selected text"}”`;
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
  if (event.type === "input") return `Changed ${name}`;
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

function CommentThumbnail({ annotation }) {
  const evidence = annotation.runtime?.evidence?.find((item) => item.blob);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!evidence?.blob) { setUrl(null); return; }
    const next = URL.createObjectURL(evidence.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [evidence?.blob]);
  return url ? <img className="tm-comment-thumbnail" src={url} alt="Saved screenshot" /> : null;
}

function AllCommentsPanel({ annotations, restorations, reviewer, route, hidden, onClose, onOpen, tab, onTabChange, pageVersions, onSelectPageVersion }) {
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
  const authors = [...new Map(annotations.filter((item) => item.payload.author?.id)
    .map((item) => [item.payload.author.id, item.payload.author])).values()];
  const needsRepair = (item) => restorations[item.id] && restorations[item.id].status !== "resolved";
  const search = query.trim().toLowerCase();
  const activeFilterCount = [
    reviewerId,
    filter === "repair" ? filter : "",
    status === "all" ? "" : status,
    page,
    build,
  ].filter(Boolean).length;
  const visible = annotations.filter((item) => {
    const feedback = item.payload;
    return (!reviewerId || feedback.author?.id === reviewerId)
      && (filter !== "repair" || needsRepair(item))
      && (status === "all" || (feedback.workflow?.status || "open") === status)
      && (!page || feedback.route === page)
      && (!build || feedback.buildId === build)
      && (!search || [feedback.comment, feedback.author?.displayName,
        targetName(feedback.pin?.target || feedback.target), ...(feedback.replies || []).map((reply) => reply.comment)]
        .filter(Boolean).join(" ").toLowerCase().includes(search));
  });
  return (
    <aside id="tm-all-comments" className="tm-comments-panel" aria-label="Feedback" hidden={hidden}
      data-menu-open={filterOpen ? "true" : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && filterOpen) {
          event.preventDefault();
          event.stopPropagation();
          setFilterOpen(false);
          filterButtonRef.current?.focus();
        }
      }}>
      <header className="tm-comments-header">
        <div className="tm-comments-heading"><h2>Feedback</h2><p>Current page: {route}</p></div>
        <div className="tm-comments-actions">
          {tab === "comments" && <><button type="button" className={controls === "search" || query ? "is-active" : undefined}
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
                  <option value="">All pages</option>{[...new Set([route, ...annotations.map((item) => item.payload.route)])].map((value) => <option key={value}>{value}</option>)}
                </select></label>
                <label>Deployment<select aria-label="Filter comments by deployment" value={build} onChange={(event) => setBuild(event.target.value)}>
                  <option value="">All deployments</option>{[...new Set(annotations.map((item) => item.payload.buildId).filter(Boolean))].map((value) => <option key={value}>{value}</option>)}
                </select></label>
              </div>}
            </div>
            {activeFilterCount > 0 && <button className="tm-comments-filter-reset" type="button" onClick={() => { setReviewerId(""); setFilter("all"); setStatus("all"); setPage(""); setBuild(""); }}>
              <RotateCcw size={16} aria-hidden="true" /><span>Reset filters</span>
            </button>}
          </div>}
          </div></>}
          <button type="button" aria-label="Close feedback panel" onClick={onClose}><X size={18} /></button>
        </div>
      </header>
      {pageVersions.length > 0 && <div className="tm-panel-tabs" role="tablist" aria-label="Feedback views">
        <button type="button" role="tab" aria-selected={tab === "comments"} onClick={() => onTabChange("comments")}>
          Comments <span>{annotations.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "versions"} onClick={() => onTabChange("versions")}>
          Versions <span>{pageVersions.length}</span>
        </button>
      </div>}
      {tab === "versions" ? <PageVersionList versions={pageVersions} onSelect={onSelectPageVersion} /> : <>
      {controls === "search" && <div id="tm-comments-search-controls" className="tm-comments-search">
        <input ref={searchRef} aria-label="Search comments" placeholder="Search comments and replies…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>}
      <p className="tm-comments-count" role="status">{visible.length} of {annotations.length} threads</p>
      <ol className="tm-comments-list">
        {visible.map((annotation) => {
          const feedback = annotation.payload;
          const number = annotations.indexOf(annotation) + 1;
          return <li key={annotation.id}>
            <button className="tm-comment-card" type="button" aria-label={`Open comment ${number}: ${feedback.comment}`} onClick={() => onOpen(annotation.id)}>
              <span className="tm-comment-author"><span className="tm-comment-avatar">{reviewerInitials(feedback.author)}</span>
                <strong>{feedback.author?.displayName || "Unknown reviewer"}{reviewer?.id && feedback.author?.id === reviewer.id ? " · You" : ""}</strong>
                <time dateTime={feedback.createdAt}>{formatMessageTime(feedback.createdAt)}</time>
              </span>
              <span className="tm-comment-copy">{feedback.comment}</span>
              <CommentThumbnail annotation={annotation} />
              <span className="tm-comment-target">#{number} · {targetName(feedback.pin?.target || feedback.target)}</span>
              <span className="tm-comment-meta">
                <span>{feedback.workflow?.status === "resolved" ? "Resolved" : "Open"}</span>
                <span>{feedback.route}</span>
                {feedback.workflow?.assignee && <span>Assigned to {feedback.workflow.assignee.displayName}</span>}
                <span>{(feedback.replies || []).length} replies</span>
                {needsRepair(annotation) && <span className="tm-comment-repair"><TriangleAlert size={12} /> Target needs repair</span>}
                {feedback.evidence?.some((item) => item.quality === "unavailable") && <span>Screenshot unavailable</span>}
              </span>
            </button>
          </li>;
        })}
      </ol>
      {!visible.length && <div className="tm-comments-empty"><MessageSquare size={26} />
        <strong>{annotations.length ? "No matching comments" : "No comments yet"}</strong>
        <p>{annotations.length ? "Try another search or clear your filters." : "Close this panel and select an element to leave your first comment."}</p>
        {annotations.length > 0 && <button type="button" onClick={() => { setQuery(""); setReviewerId(""); setFilter("all"); setStatus("all"); setPage(""); setBuild(""); }}>Clear filters</button>}
      </div>}
      </>}
    </aside>
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
              width: 14, height: 14, borderRadius: "50%", background: "#e5483c", border: "2px solid white", transform: "translate(-50%, -50%)" }} />}
          </div>
        </>
      )}
      {snapshot.status === "failed" && (
        <div className="tm-snapshot__state tm-snapshot__state--error">
          <span>Snapshot unavailable. You can post this comment without a screenshot.</span>
          {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
        </div>
      )}
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

function StopIcon() {
  return <Square {...iconProps} />;
}

function UndoIcon() {
  return <Undo2 {...iconProps} />;
}

function ClearIcon() {
  return <Trash2 {...iconProps} />;
}

function GripIcon() {
  return <GripVertical {...iconProps} />;
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

function PageVersionList({ versions, onSelect }) {
  return (
    <div className="tm-version-tab" role="tabpanel" aria-label="Page versions">
      <div className="tm-version-list">
        {versions.map((version) => {
          const canOpen = !version.current && version.state === "ready";
          return (
            <article className="tm-version-row" key={version.id}>
              <div className="tm-version-row__body">
                <div className="tm-version-row__title">
                  <strong>{version.label}</strong>
                  <VersionState version={version} />
                </div>
                <span className="tm-version-row__meta"><GitBranch {...iconProps} />{versionMeta(version)}</span>
                <time dateTime={version.createdAt || undefined}>{formatVersionDate(version.createdAt)}</time>
              </div>
              <div className="tm-version-row__actions">
                <span className="tm-version-feedback" title="Feedback on this deployment">
                  <MessageSquare {...iconProps} />
                  {version.feedbackCount}
                </span>
                {canOpen && (
                  <button type="button" className="tm-version-open" onClick={() => onSelect(version)}>
                    Open <ExternalLink {...iconProps} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="tm-version-panel__note">Routes open on immutable deployment URLs. Data and feature flags may still differ.</p>
    </div>
  );
}

const MARKUP_COLORS = [
  { value: "#e5483c", label: "Coral" },
  { value: "#f2c94c", label: "Yellow" },
  { value: "#5cc49a", label: "Green" },
  { value: "#4c8dff", label: "Blue" },
  { value: "#ffffff", label: "White" },
];

const MARKUP_SIZES = [
  { value: 3, label: "Fine" },
  { value: 5, label: "Medium" },
  { value: 9, label: "Bold" },
];

function ScreenshotAreaSelector({ onComplete, onCancel }) {
  const [start, setStart] = useState(null);
  const [rect, setRect] = useState(null);
  const [error, setError] = useState("");

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector("[data-threadmark-root]")?.shadowRoot
        ?.querySelector(".tm-capture-cancel")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const begin = (event) => {
    if (
      event.button !== 0
      || event.target.closest?.("button, .tm-capture-instruction")
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
      <div className="tm-capture-instruction" onPointerDown={(event) => event.stopPropagation()}>
        <div className="tm-capture-instruction__copy">
          <strong id="tm-capture-title">Select screenshot area</strong>
          <span>Drag around the exact area you want to mark up.</span>
        </div>
        <div className="tm-capture-instruction__actions">
          <button type="button" className="tm-capture-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
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

function MarkupEditor({ screenshot, onStrokesChange, onCancel, onConfirm, composing }) {
  const svgRef = useRef(null);
  const [color, setColor] = useState(MARKUP_COLORS[0].value);
  const [brushWidth, setBrushWidth] = useState(MARKUP_SIZES[1].value);
  const [draftStroke, setDraftStroke] = useState(null);
  const snapshot = screenshot?.snapshot;
  const strokes = screenshot?.strokes || [];
  const bitmapSize = snapshot?.metadata?.pixelSize || { width: 0, height: 0 };
  const ready = snapshot?.status === "ready" && snapshot.previewUrl;
  const anchorRect = screenshot?.anchorRect || { left: 0, top: 0, width: 0, height: 0 };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector("[data-threadmark-root]")?.shadowRoot
        ?.querySelector(".tm-markup-overlay button:not(:disabled)")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

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
        className="tm-markup-canvas"
        style={{
          left: anchorRect.left,
          top: anchorRect.top,
          width: anchorRect.width,
          height: anchorRect.height,
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
        <span className="tm-markup-canvas__dimensions" aria-hidden="true">
          {Math.round(anchorRect.width)} × {Math.round(anchorRect.height)}
        </span>
      </div>

      <div className="tm-markup-dock">
        <div className="tm-markup-dock__context">
          <strong id="tm-markup-title">Mark up</strong>
          <span>{Math.round(anchorRect.width)} × {Math.round(anchorRect.height)} crop</span>
        </div>
        <div className="tm-markup-divider" />
        <div className="tm-markup-tools" role="toolbar" aria-label="Screenshot drawing tools">
          <span className="tm-markup-tools__label">Color</span>
          <div className="tm-color-tools">
            {MARKUP_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={color === option.value ? "is-selected" : ""}
                aria-label={`${option.label} pen`}
                aria-pressed={color === option.value}
                title={`${option.label} pen`}
                onClick={() => setColor(option.value)}
                disabled={!ready || composing}
              >
                <span style={{ background: option.value }} />
              </button>
            ))}
          </div>
          <div className="tm-markup-divider" />
          <span className="tm-markup-tools__label">Pen</span>
          <div className="tm-size-tools" aria-label="Pen thickness">
            {MARKUP_SIZES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={brushWidth === option.value ? "is-selected" : ""}
                aria-label={`${option.label} pen thickness`}
                aria-pressed={brushWidth === option.value}
                title={`${option.label} pen thickness`}
                onClick={() => setBrushWidth(option.value)}
                disabled={!ready || composing}
              >
                <span style={{ width: option.value + 4, height: option.value + 4 }} />
              </button>
            ))}
          </div>
          <div className="tm-markup-tools__spacer" />
          <button
            type="button"
            className="tm-markup-action"
            disabled={!strokes.length || composing}
            onClick={() => onStrokesChange(undoMarkupStroke(strokes))}
          >
            <UndoIcon />
            Undo
          </button>
          <button
            type="button"
            className="tm-markup-action"
            disabled={!strokes.length || composing}
            onClick={() => onStrokesChange(clearMarkupStrokes(strokes))}
          >
            <ClearIcon />
            Clear
          </button>
        </div>
        <div className="tm-markup-divider" />
        <div className="tm-markup-dock__actions">
          <button type="button" className="tm-markup-cancel" onClick={onCancel} disabled={composing}>Cancel</button>
          <button type="button" className="tm-markup-confirm" onClick={onConfirm} disabled={!ready || composing}>
            {composing ? "Preparing…" : "Use screenshot"}
          </button>
        </div>
      </div>

      <p className="tm-markup-note">Only this selected crop and its burned-in markup will be attached.</p>
    </section>
  );
}

function Marker({ annotation, number, rect, restoration, onEdit }) {
  if (!rect) return null;
  const grouped = ["multi", "region", "interaction"].includes(annotation.payload.captureKind);
  const needsRepair = restoration && restoration.status !== "resolved";
  const suggested = restoration?.status === "changed";
  const ghost = Boolean(restoration?.ghost);
  const detail = suggested ? ": element changed, confirm its new location"
    : ghost ? ": element removed, shown at its last known position" : "";
  return (
    <>
      {(suggested || ghost) && rect.width > 1 && rect.height > 1 && (
        <div
          className={`tm-outline ${suggested ? "tm-outline--suggested" : "tm-outline--ghost"}`}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        className={`tm-marker ${grouped ? "tm-marker--grouped" : ""} ${needsRepair ? "tm-marker--warning" : ""} ${suggested ? "tm-marker--suggested" : ""} ${ghost ? "tm-marker--ghost" : ""}`}
        style={{ left: rect.left + rect.width, top: rect.top + Math.min(18, rect.height / 2) }}
        aria-label={`Edit annotation ${number}${needsRepair ? `, target needs repair${detail}` : ""}`}
        title={suggested ? "Element changed · confirm location" : ghost ? "Element removed · last known position" : "Open annotation"}
        onClick={() => onEdit(annotation.id)}
      >
        {number}
      </button>
    </>
  );
}

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
    {open && <ul id="tm-mention-list" className="tm-mention-list" role="listbox" aria-label="Mention a reviewer">
      {matches.map((member, index) => (
        <li key={member.id} role="option" aria-selected={index === mention.index}
          onMouseDown={(event) => { event.preventDefault(); insert(member); }}>
          <ReviewerAvatar reviewer={member} className="tm-mention-list__avatar" />{member.displayName}
        </li>
      ))}
    </ul>}
  </>;
}

function ReviewerAvatar({ reviewer, className = "tm-thread-message__avatar" }) {
  return (
    <div className={className} aria-hidden="true">
      {reviewer?.avatarUrl ? <img src={reviewer.avatarUrl} alt="" /> : reviewerInitials(reviewer)}
    </div>
  );
}

function ThreadMessage({
  message,
  annotation = false,
  currentReviewer,
  onReply,
  onDelete,
  onEdit,
  editor = null,
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
      <ReviewerAvatar reviewer={author} />
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

function Overlay({
  mode,
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
  drawRect,
  annotations,
  annotationRects,
  annotationRestorations,
  markersHidden,
  paused,
  editingAnnotation,
  pageVersions,
  pageVersionRoute,
  versionHistoryOpen,
  carryingVersionId,
  reviewer,
  toolbarPosition,
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
  onShowVersions,
  onSelectPageVersion,
  onCarryFeedbackForward,
  onBeginReply,
  onCancelReply,
  onBeginEdit,
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
  notice,
  submitting,
  composingScreenshot,
  launcherRef,
}) {
  const targets = editingAnnotation
    ? editingAnnotation.payload.pin ? [editingAnnotation.payload.pin.target] : editingAnnotation.payload.targets || [editingAnnotation.payload.target]
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
    || (interactionSelection ? "interaction" : screenshotSelection ? "screenshot" : textSelection ? "text" : regionSelection ? "region" : targets.length > 1 ? "multi" : "element");
  const selectedCount = targets.length;
  const lastSelection = selections[selections.length - 1];
  const anchorRect = editingAnnotation
    ? annotationRects[editingAnnotation.id] || {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 1,
      height: 1,
    }
    : interactionSelection?.displayRect
      || screenshotSelection?.anchorRect
      || textSelection?.displayRect
      || regionSelection?.displayRect
      || (lastSelection ? selectionRects[lastSelection.id] : null);
  const popoverRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [editingEvidencePreview, setEditingEvidencePreview] = useState(null);
  const [workflowMoreOpen, setWorkflowMoreOpen] = useState(false);
  const [threadPanel, setThreadPanel] = useState(null);
  const comparisonOpen = Boolean(editingAnnotation && threadPanel === "compare");
  const previousComparisonOpenRef = useRef(false);
  const [carryForwardOpen, setCarryForwardOpen] = useState(false);
  const editingRestoration = editingAnnotation ? annotationRestorations[editingAnnotation.id] : null;
  const brokenAnnotations = annotations.filter((annotation) => {
    const restoration = annotationRestorations[annotation.id];
    return restoration && restoration.status !== "resolved";
  });
  const carryForwardVersions = pageVersions.filter((version) => !version.current && version.state === "ready");

  useEffect(() => {
    setCarryForwardOpen(false);
  }, [editingAnnotation?.id]);

  useEffect(() => {
    const evidenceItem = editingAnnotation?.runtime?.evidence?.find((item) => item?.blob);
    const metadata = editingAnnotation?.payload?.evidence?.find((item) => item.id === evidenceItem?.id);
    if (!evidenceItem?.blob || !metadata || typeof URL === "undefined") {
      const unavailable = editingAnnotation?.payload?.evidence?.find((item) => item.quality === "unavailable");
      setEditingEvidencePreview(unavailable ? { snapshot: { status: "failed", metadata: unavailable } } : null);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(evidenceItem.blob);
    setEditingEvidencePreview({
      snapshot: {
        status: "ready",
        approved: true,
        id: evidenceItem.id,
        previewUrl,
        metadata,
        blob: evidenceItem.blob,
      },
    });
    return () => URL.revokeObjectURL(previewUrl);
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
      popoverRef.current?.querySelector(returningFromComparison
        ? '[aria-label="More thread actions"]' : "#tm-comment")?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [mode, popoverPosition?.left, popoverPosition?.top, composerMode, comparisonOpen]);

  useEffect(() => {
    if (!pendingDelete) return undefined;
    const frame = requestAnimationFrame(() => {
      popoverRef.current?.querySelector(".tm-delete-final")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingDelete?.id, pendingDelete?.kind]);

  useEffect(() => { setWorkflowMoreOpen(false); setThreadPanel(null); }, [editingAnnotation?.id]);
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

  return (
    <div className="tm-root">
      {mode === "idle" && (
        <button ref={launcherRef} type="button" className="tm-launcher" onClick={onStart}
          aria-label={annotations.length ? `Review page, ${annotations.length} comment${annotations.length === 1 ? "" : "s"}` : undefined}>
          Review page
          {annotations.length > 0 && <span className="tm-launcher__count" aria-hidden="true">{annotations.length > 99 ? "99+" : annotations.length}</span>}
        </button>
      )}

      {mode !== "idle" && !markersHidden && annotations.map((annotation, index) => (
        <Marker
          key={annotation.id}
          annotation={annotation}
          number={index + 1}
          rect={annotationRects[annotation.id]}
          restoration={annotationRestorations[annotation.id]}
          onEdit={onEditAnnotation}
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
        />
      )}

      {mode === "markup" && screenshotSelection && (
        <MarkupEditor
          screenshot={screenshotSelection}
          onStrokesChange={onScreenshotStrokesChange}
          onCancel={onScreenshotCancel}
          onConfirm={onScreenshotConfirm}
          composing={composingScreenshot}
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
          <div className="tm-gesture-hint" aria-hidden="true">
            {selectedCount >= 2
              ? `${selectedCount} elements selected`
              : drawRect
                ? "Release to annotate this selection"
                : repinning ? "Click a new element · Escape to cancel repinning" : "Click · select text · drag an area"}
          </div>
          <div
            className="tm-modebar"
            role="toolbar"
            aria-label="Threadmark annotation tools"
            style={toolbarPosition ? {
              left: toolbarPosition.left,
              top: toolbarPosition.top,
              right: "auto",
              bottom: "auto",
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
            <div className="tm-toolbar-divider" />
            <div className="tm-tool-group tm-toolbar-tools">
              <ToolButton
                icon={<PencilIcon />}
                label="Select screenshot area to mark up"
                onClick={onScreenshot}
              />
              <ToolButton
                icon={<InteractionIcon />}
                label="Record an interaction"
                onClick={onStartInteraction}
              />
              <ToolButton
                active={paused}
                icon={<PauseIcon paused={paused} />}
                label={paused ? "Resume page (P)" : "Pause animations (P)"}
                onClick={onPause}
              />
              <ToolButton
                active={markersHidden}
                disabled={!annotations.length}
                icon={<EyeIcon hidden={markersHidden} />}
                label={markersHidden ? "Show markers (H)" : "Hide markers (H)"}
                onClick={onVisibility}
              />
              <ToolButton
                disabled={!annotations.length}
                icon={<CopyIcon />}
                label="Copy annotations (C)"
                onClick={onCopy}
              />
              {brokenAnnotations.length > 0 && (
                <ToolButton
                  active
                  icon={<WarningIcon />}
                  label={`${brokenAnnotations.length} annotation target${brokenAnnotations.length === 1 ? "" : "s"} need repair`}
                  onClick={() => onEditAnnotation(brokenAnnotations[0].id)}
                />
              )}
              <ToolButton
                active={clearArmed}
                disabled={!annotations.length && !selectedCount}
                icon={<ClearIcon />}
                label={clearArmed ? "Confirm clear annotations (X)" : "Clear annotations (X)"}
                onClick={onClearAll}
              />
            </div>
            {selectedCount >= 2 && (
              <button type="button" className="tm-button--primary" onClick={onComment}>
                Comment {selectedCount}
              </button>
            )}
            <div className="tm-toolbar-divider" />
            <div className="tm-tool-group">
              <button type="button" className={`tm-all-comments-trigger${allCommentsOpen ? " is-active" : ""}`} aria-label="Feedback panel" title="Feedback panel"
                aria-expanded={allCommentsOpen} aria-controls="tm-all-comments" onClick={onToggleAllComments}>
                <MessagesSquare {...iconProps} />
                {projectAnnotations.length > 0 && <span className="tm-count-badge" aria-hidden="true">{projectAnnotations.length > 99 ? "99+" : projectAnnotations.length}</span>}
              </button>
            </div>
            <div className="tm-toolbar-divider" />
            <ToolButton icon={<CloseIcon />} label="Close annotations (Esc)" onClick={onExit} />
          </div>
        </>
      )}

      {allCommentsOpen && ["picking", "selected"].includes(mode) && (
        <AllCommentsPanel annotations={projectAnnotations} restorations={annotationRestorations} reviewer={reviewer}
          route={pageVersionRoute} hidden={mode !== "picking"} onClose={onCloseAllComments} onOpen={onOpenListedAnnotation}
          tab={versionHistoryOpen && pageVersions.length ? "versions" : "comments"}
          onTabChange={(tab) => onShowVersions(tab === "versions")}
          pageVersions={pageVersions} onSelectPageVersion={onSelectPageVersion} />
      )}

      {mode === "selected" && primaryTarget && (
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
            className="tm-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tm-popover-title"
            tabIndex={-1}
            onKeyDown={(event) => trapDialogFocus(event, event.currentTarget)}
            data-placement={popoverPosition?.side || "below"}
            style={{
              left: popoverPosition?.left ?? 12,
              top: popoverPosition?.top ?? 12,
              visibility: popoverPosition ? "visible" : "hidden",
            }}
          >
          {editingAnnotation ? (
          <div className="tm-popover__header tm-popover__header--thread">
            <h2 id="tm-popover-title">{editingAnnotation.payload.workflow?.status === "resolved" ? "Resolved comment" : "Comment"}</h2>
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
          <div className="tm-popover__header">
            <details className="tm-context-disclosure">
              <summary>
                <ChevronDownIcon />
                <span id="tm-popover-title">
                  {editingAnnotation ? "Annotation context" : "Selected context"}
                </span>
              </summary>
              <div className="tm-context-disclosure__content">
                <strong>
                  {editingAnnotation
                    ? `Annotation ${annotations.findIndex((item) => item.id === editingAnnotation.id) + 1}`
                    : captureKind === "interaction"
                      ? `${interactionSelection?.interaction.events.length || 0} interaction steps`
                    : captureKind === "screenshot"
                      ? `${primaryTarget.bounds.width} × ${primaryTarget.bounds.height}px marked-up area`
                      : captureKind === "multi" ? `${targets.length} selected elements` : targetName(primaryTarget)}
                </strong>
                <span className="tm-context-tag">
                  {editingAnnotation
                    ? targetName(primaryTarget)
                    : captureKind === "region"
                    ? `${primaryTarget.bounds.width} × ${primaryTarget.bounds.height}px region`
                    : captureKind === "screenshot"
                      ? "marked-up area"
                    : captureKind === "interaction"
                      ? `${formatInteractionDuration(interactionSelection?.interaction.durationMs)} interaction trace`
                    : captureKind === "multi"
                      ? "One comment for this group"
                      : captureKind === "text"
                        ? "Selected text"
                        : primaryTarget.role || primaryTarget.tagName}
                </span>
              </div>
            </details>
            <button type="button" aria-label="Cancel comment" onClick={onRequestDismiss} disabled={submitting}><CloseIcon /></button>
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
                    createdAt: editingAnnotation.payload.createdAt,
                    author: editingAnnotation.payload.author,
                  }}
                  annotation
                  currentReviewer={reviewer}
                  onReply={onBeginReply}
                  onDelete={onRequestDelete}
                  onEdit={repinning ? undefined : onBeginEdit}
                  editor={composerMode === "edit" && !repinning ? (
                    <div className="tm-inline-edit">
                      <label className="tm-sr-only" htmlFor="tm-comment">Edit comment</label>
                      <MentionTextarea
                        reviewers={reviewers}
                        id="tm-comment"
                        value={comment}
                        onValueChange={setComment}
                        maxLength={6000}
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
                {(editingAnnotation.payload.replies || []).map((reply) => (
                  <ThreadMessage
                    key={reply.id}
                    message={reply}
                    currentReviewer={reviewer}
                    onReply={onBeginReply}
                    onDelete={onRequestDelete}
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
                {composerMode === "reply" ? "Write a reply" : "What should change?"}
              </label>
              <MentionTextarea
                reviewers={reviewers}
                id="tm-comment"
                value={comment}
                onValueChange={setComment}
                placeholder={composerMode === "reply" ? "Write a reply…" : "Describe the change…"}
                maxLength={6000}
                aria-describedby={comment.length >= 5500 ? "tm-comment-limit" : undefined}
              />
              {comment.length >= 5500 && (
                <small id="tm-comment-limit" className="tm-field__limit" aria-live="polite">
                  {6000 - comment.length} characters remaining
                </small>
              )}
            </div>

            }
            {/* Ordinary comments attach their masked screenshot automatically, so only saved, region and Pencil evidence is shown. */}
            {(editingEvidencePreview || regionSelection || screenshotSelection) && (
              <SnapshotPreview
                selection={editingEvidencePreview || screenshotSelection || regionSelection}
                readOnly={Boolean(editingEvidencePreview)}
                onRetry={editingAnnotation ? undefined : screenshotSelection ? onScreenshot : onRetrySnapshot}
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
                    <button type="submit" className="tm-submit tm-reply__send" disabled={submitting || !comment.trim()}>
                      <ArrowUp {...iconProps} /><span className="tm-sr-only">{submitting ? "Saving…" : "Reply"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="tm-form__footer">
              {pendingDelete ? (
                <div className="tm-delete-confirm" role="alert" key="delete-confirm">
                  <ClearIcon />
                  <div className="tm-delete-confirm__impact">
                    <strong>{pendingDelete.kind === "annotation" ? "Delete this annotation?" : "Delete this reply?"}</strong>
                    <span>
                      {pendingDelete.kind === "annotation"
                        ? `${1 + (editingAnnotation?.payload.replies?.length || 0)} comment${(editingAnnotation?.payload.replies?.length || 0) === 0 ? "" : "s"}${editingAnnotation?.payload.evidence?.length ? " and its screenshot" : ""} will be removed.`
                        : `Only this reply will be removed. The annotation and ${Math.max(0, editingAnnotation?.payload.replies?.length || 0)} other comment${(editingAnnotation?.payload.replies?.length || 0) === 1 ? "" : "s"} stay.`}
                    </span>
                  </div>
                  <button type="button" className="tm-cancel" onClick={onCancelDelete} disabled={deleting}>Cancel</button>
                  <button type="button" className="tm-delete-final" onClick={onConfirmDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : pendingDelete.kind === "annotation" ? "Delete annotation" : "Delete reply"}
                  </button>
                </div>
              ) : discardPending ? (
                <div className="tm-delete-confirm" role="alert" key="discard-confirm">
                  <ClearIcon />
                  <div className="tm-delete-confirm__impact">
                    <strong>{composerMode === "edit" ? "Discard your edits?" : composerMode === "reply" ? "Discard this reply?" : "Discard this comment?"}</strong>
                    <span>What you typed hasn’t been posted and will be lost.</span>
                  </div>
                  <button type="button" className="tm-cancel" onClick={onKeepEditing}>Keep editing</button>
                  <button type="button" className="tm-delete-final" onClick={onBack}>Discard</button>
                </div>
              ) : (!editingAnnotation || repinning) ? (
                /* Saved threads post replies and edits from their own inline controls. */
                <div className="tm-form__actions" key={`actions-${composerMode}`}>
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
                    }
                  >
                    {submitting
                      ? "Saving…"
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

      {notice && <div className="tm-toast" role="status">{notice}</div>}
    </div>
  );
}


export {
  Overlay,
  createInteractionPageTarget,
  createScreenshotTargetDescriptor,
  interactionTargetKey,
};
