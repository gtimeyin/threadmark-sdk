import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TranscriptIcon as AudioLines } from "./icons.jsx";
import { RecordIcon as Circle } from "./icons.jsx";
import { HideIcon as EyeOff } from "./icons.jsx";
import { MicrophoneIcon as Mic } from "./icons.jsx";
import { HideIcon as MicOff } from "./icons.jsx";
import { DesktopIcon as Monitor } from "./icons.jsx";
import { SelectIcon as MousePointer2 } from "./icons.jsx";
import { PauseIcon as Pause } from "./icons.jsx";
import { SketchIcon as PenLine } from "./icons.jsx";
import { PlayIcon as Play } from "./icons.jsx";
import { StopIcon as Square } from "./icons.jsx";
import { VideoIcon as Video } from "./icons.jsx";
import { HideIcon as VideoOff } from "./icons.jsx";
import { CloseIcon as X } from "./icons.jsx";
import { CameraIcon, ClockIcon, CommentIcon, EditIcon, ErrorIcon, InfoIcon, MomentIcon, SummaryIcon } from "./icons.jsx";
import { Key } from "./ui/primitives.jsx";
import {
  activeEventIndex,
  formatClock,
  pointerPositionAt,
  scrollPositionAt,
} from "./videoRecording.js";
import { PRIVATE_FIELD_SELECTOR, SITE_PRIVATE_SELECTOR } from "./privacy.js";

const iconProps = {
  "aria-hidden": true,
  className: "tm-tool-icon",
  focusable: "false",
};

const MAX_RIPPLES = 6;
const RIPPLE_LIFETIME_MS = 650;
const BLUR_REFRESH_MS = 500;
const MAX_BLUR_BOXES = 120;
export const STROKE_LIFETIME_MS = 3000;
const MAX_STROKE_POINTS = 300;

// A recording is either a local Blob (just recorded) or a URL the host supplied for a stored copy.
function useMediaUrl(media) {
  const blob = media?.blob || null;
  const remoteUrl = blob ? null : media?.url || null;
  const [url, setUrl] = useState(remoteUrl);
  useEffect(() => {
    if (!blob || typeof URL === "undefined") {
      setUrl(remoteUrl);
      return undefined;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob, remoteUrl]);
  return url;
}

function mediaHasVideo(media) {
  return String(media?.blob?.type || media?.mimeType || "").startsWith("video/");
}

function LiveVideo({ stream, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    element.srcObject = stream || null;
    if (stream) element.play?.().catch(() => {});
    return () => {
      element.srcObject = null;
    };
  }, [stream]);
  return <video ref={ref} className={className} autoPlay muted playsInline aria-hidden="true" />;
}

function deviceLabel(devices, id, fallback) {
  return (devices.find((device) => device.deviceId === id) || devices[0])?.label || fallback;
}

/** One source row (Figma "Record a video", board 02): icon, name, device, and a switch. */
function SourceRow({ icon, label, on, disabled, devices, deviceId, fallbackDevice, problem, onToggle, onDevice }) {
  const switchId = useId();
  return (
    <div className={`tm-video-source${problem ? " has-problem" : ""}`}>
      <span className="tm-video-source__icon" aria-hidden="true">{icon}</span>
      <span className="tm-video-source__text">
        <label htmlFor={switchId}>{label}</label>
        {problem ? <small className="is-problem">{problem}</small>
          : devices.length > 1 ? (
            <span className="tm-video-source__select">
              <select aria-label={`${label} device`} value={deviceId} disabled={disabled || !on} onChange={(event) => onDevice(event.target.value)}>
                {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
              </select>
            </span>
          ) : <small>{deviceLabel(devices, deviceId, fallbackDevice)}</small>}
      </span>
      <button id={switchId} type="button" role="switch" aria-label={label} aria-checked={on} disabled={disabled}
        className={`tm-video-switch${on ? " is-on" : ""}`} onClick={onToggle}>
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

/** In-page setup card: what to record, microphone and camera, then Start recording (board 02, 13a and 16a-b). */
export function VideoSetupPanel({ setup, maxDurationMs, blurredCount = 0, onBlur, onChange, onStart, onCancel }) {
  const headingId = useId();
  const statusId = useId();
  const panelRef = useRef(null);
  const busy = setup.status === "requesting" || setup.status === "starting";
  const hasCameraPreview = setup.camera && setup.previewStream?.getVideoTracks?.().length > 0;
  const nothingToRecord = setup.mode === "voice" && !setup.camera && !setup.microphone;
  const limit = formatClock(maxDurationMs);
  const minutes = maxDurationMs >= 60000 && maxDurationMs % 60000 === 0 ? `${maxDurationMs / 60000} minute${maxDurationMs === 60000 ? "" : "s"}` : limit;
  const hint = setup.mode === "tab"
    ? "Your browser will ask to share this tab. Everything visible in it is recorded."
    : `Your ${setup.camera && setup.microphone ? "voice and camera" : setup.camera ? "camera" : "voice"} and cursor play back over the page.`;

  // Start gets focus once it can be used (it's disabled while the browser asks for the camera and mic).
  useEffect(() => {
    if (busy) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(panel.getRootNode().activeElement)) return;
    panel.querySelector(".tm-video-start:not(:disabled)")?.focus();
  }, [busy]);

  return (
    <section
      ref={panelRef}
      className="tm-video-setup"
      onKeyDown={(event) => {
        // Keep Tab inside the card.
        if (event.key !== "Tab") return;
        const focusable = [...event.currentTarget.querySelectorAll("button:not(:disabled), select:not(:disabled)")];
        if (!focusable.length) return;
        const active = event.currentTarget.getRootNode().activeElement;
        if (event.shiftKey && active === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && active === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      aria-describedby={statusId}
    >
      <header className="tm-video-setup__header">
        <span className="tm-video-setup__dot" aria-hidden="true" />
        <strong id={headingId}>Record a video</strong>
        <button type="button" className="tm-video-setup__esc" aria-label="Close video recorder" title="Back to Comment (Esc)" onClick={onCancel}>
          <kbd className="tm-ui-key">Esc</kbd>
        </button>
      </header>

      <div className="tm-video-setup__modes" role="radiogroup" aria-label="What to record">
        <button
          type="button"
          role="radio"
          aria-checked={setup.mode === "tab"}
          disabled={!setup.support.tab || busy}
          className={setup.mode === "tab" ? "is-active" : ""}
          onClick={() => onChange({ mode: "tab" })}
        >
          <Monitor {...iconProps} />
          <span>This tab</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={setup.mode === "voice"}
          disabled={!setup.support.voice || busy}
          className={setup.mode === "voice" ? "is-active" : ""}
          onClick={() => onChange({ mode: "voice" })}
        >
          <AudioLines {...iconProps} />
          <span>Voice + cursor</span>
        </button>
      </div>

      <div className="tm-video-setup__sources">
        <SourceRow
          icon={<Mic {...iconProps} />}
          label="Microphone"
          on={setup.microphone}
          disabled={busy}
          devices={setup.devices.microphones}
          deviceId={setup.microphoneDeviceId}
          fallbackDevice="Default microphone"
          onToggle={() => onChange({ microphone: !setup.microphone })}
          onDevice={(microphoneDeviceId) => onChange({ microphoneDeviceId })}
        />
        <SourceRow
          icon={hasCameraPreview ? <LiveVideo stream={setup.previewStream} className="tm-video-setup__camera" /> : <CameraIcon {...iconProps} />}
          label="Camera"
          on={setup.camera}
          disabled={busy}
          devices={setup.devices.cameras}
          deviceId={setup.cameraDeviceId}
          fallbackDevice="Default camera"
          onToggle={() => onChange({ camera: !setup.camera })}
          onDevice={(cameraDeviceId) => onChange({ cameraDeviceId })}
        />
      </div>

      <div id={statusId} className={`tm-video-setup__hint${setup.error ? " is-error" : ""}`} aria-live="polite">
        {setup.error ? <ErrorIcon {...iconProps} /> : <InfoIcon {...iconProps} />}
        <p>{setup.error || (setup.status === "requesting" ? "Waiting for camera and microphone access…" : hint)}</p>
        {onBlur && setup.mode === "tab" && !setup.error && (
          <button type="button" className="tm-video-setup__blur" disabled={busy} onClick={onBlur}>
            {blurredCount ? `${blurredCount} blurred` : "Blur parts of the page"}
          </button>
        )}
      </div>

      <footer className="tm-video-setup__actions">
        <span className="tm-video-setup__limit">Up to {minutes}</span>
        <button
          type="button"
          className="tm-video-start"
          disabled={busy || nothingToRecord}
          onClick={onStart}
        >
          {setup.status === "starting" ? "Starting…" : setup.mode === "voice" && !setup.microphone ? "Record without voice" : "Start recording"}
          <kbd className="tm-ui-key" aria-hidden="true">↵</kbd>
        </button>
      </footer>
    </section>
  );
}

const WARN_BEFORE_LIMIT_MS = 30_000;

function isTypingTarget(event) {
  const target = event.composedPath?.()[0] || event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

/**
 * Floating recorder (board 02, 7d and 8a-8b): state and clock, microphone and camera, mark a moment (M),
 * blur and draw, pause, and an Orange stop. Nothing is lost from here: Stop opens the review, where the
 * video can be retaken or deleted.
 */
export function VideoRecorderBar({ state, tool = null, onTool, onPause, onSource, onMoment, onStop }) {
  const [flash, setFlash] = useState(null);
  const remainingMs = Math.max(0, state.maxDurationMs - state.elapsedMs);
  const nearLimit = !state.finishing && state.maxDurationMs > WARN_BEFORE_LIMIT_MS && remainingMs <= WARN_BEFORE_LIMIT_MS;
  const announcement = state.finishing
    ? "Saving recording"
    : state.paused ? "Recording paused" : `Recording ${state.mode === "tab" ? "this tab" : "voice and cursor"}`;

  // A short "Moment at 0:08" so the reviewer knows M landed.
  useEffect(() => {
    if (state.lastMomentMs == null) return undefined;
    setFlash(state.lastMomentMs);
    const timer = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(timer);
  }, [state.moments, state.lastMomentMs]);

  // M marks a moment from anywhere on the page, except while typing.
  useEffect(() => {
    if (!onMoment) return undefined;
    const onKeyDown = (event) => {
      if (event.key?.toLowerCase() !== "m" || event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event)) return;
      event.preventDefault();
      onMoment();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onMoment]);

  // Esc leaves Draw the same way it leaves Blur.
  useEffect(() => {
    if (tool !== "draw" || !onTool) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onTool(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [tool, onTool]);

  const busy = Boolean(state.finishing);
  return (
    <section className={`tm-video-recorder${state.paused ? " is-paused" : ""}${nearLimit ? " is-near-limit" : ""}`} aria-label="Video recorder">
      <span className="tm-sr-only" aria-live="polite">{announcement}</span>
      {(nearLimit || flash != null) && (
        <p className="tm-video-recorder__note" role="status">
          {nearLimit
            ? <><ClockIcon {...iconProps} />{Math.ceil(remainingMs / 1000)} seconds left. The video stops at {formatClock(state.maxDurationMs)}.</>
            : <><MomentIcon {...iconProps} />Moment at {formatClock(flash)}</>}
        </p>
      )}
      <span className="tm-video-recorder__state">
        <span className="tm-recording-dot" aria-hidden="true" />
        <strong>{busy ? "Saving…" : state.paused ? "Paused" : "Recording"}</strong>
        <span className="tm-video-recorder__clock">{formatClock(state.elapsedMs)}</span>
      </span>
      <span className="tm-video-recorder__rule" aria-hidden="true" />
      {state.microphone && onSource && (
        <button type="button" className={`tm-video-icon-button${state.microphoneOn === false ? " is-off" : ""}`}
          aria-label="Microphone" aria-pressed={state.microphoneOn !== false} title={state.microphoneOn === false ? "Unmute" : "Mute"}
          disabled={busy} onClick={() => onSource("microphone")}>
          {state.microphoneOn === false ? <MicOff {...iconProps} /> : <Mic {...iconProps} />}
        </button>
      )}
      {state.camera && onSource && (
        <button type="button" className={`tm-video-icon-button${state.cameraOn === false ? " is-off" : ""}`}
          aria-label="Camera" aria-pressed={state.cameraOn !== false} title={state.cameraOn === false ? "Turn camera on" : "Turn camera off"}
          disabled={busy} onClick={() => onSource("camera")}>
          {state.cameraOn === false ? <VideoOff {...iconProps} /> : <CameraIcon {...iconProps} />}
        </button>
      )}
      {onMoment && (
        <button type="button" className="tm-video-icon-button tm-video-moment" aria-label="Mark a moment" aria-keyshortcuts="M"
          title="Mark a moment (M)" disabled={busy || state.paused} onClick={onMoment}>
          <MomentIcon {...iconProps} />
          {state.paused && <span>Moment <Key>M</Key></span>}
        </button>
      )}
      {onTool && state.mode === "tab" && (
        <button
          type="button"
          className={`tm-video-icon-button${tool === "blur" ? " is-active" : ""}`}
          aria-label="Blur parts of the page"
          aria-pressed={tool === "blur"}
          title="Blur (pauses while you choose)"
          disabled={busy}
          onClick={() => onTool(tool === "blur" ? null : "blur")}
        >
          <EyeOff {...iconProps} />
        </button>
      )}
      {onTool && (
        <button
          type="button"
          className={`tm-video-icon-button${tool === "draw" ? " is-active" : ""}`}
          aria-label="Draw on the page"
          aria-pressed={tool === "draw"}
          title="Draw (strokes fade after 3 seconds)"
          disabled={busy}
          onClick={() => onTool(tool === "draw" ? null : "draw")}
        >
          <PenLine {...iconProps} />
        </button>
      )}
      <button
        type="button"
        className={`tm-video-icon-button${state.paused ? " tm-video-resume" : ""}`}
        aria-label={state.paused ? "Resume recording" : "Pause recording"}
        title={state.paused ? "Resume" : "Pause"}
        disabled={busy}
        onClick={onPause}
      >
        {state.paused ? <Play {...iconProps} /> : <Pause {...iconProps} />}
      </button>
      <button type="button" className="tm-recording-stop" aria-label="Stop recording" title="Stop and review" disabled={busy} onClick={onStop}>
        <Square {...iconProps} />
      </button>
    </section>
  );
}

/** 7c: three seconds to get ready. The page is already shared; Esc cancels. */
export function VideoCountdown({ seconds, onCancel }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel]);
  return (
    <div className="tm-video-countdown" data-menu-open="true">
      <span className="tm-video-countdown__number" role="timer" aria-live="assertive" aria-label={`Recording starts in ${seconds}`}>{seconds}</span>
      <button type="button" className="tm-video-countdown__cancel" onClick={onCancel}>
        <strong>Starting</strong> <Key>Esc</Key> to cancel
      </button>
    </div>
  );
}

function placeLabel(element) {
  if (!element?.isConnected || element === document.documentElement || element === document.body) return "Whole page";
  const tag = element.tagName.toLowerCase();
  const kind = tag === "button" ? "Button" : tag === "a" ? "Link" : /^h[1-6]$/.test(tag) ? "Heading" : tag === "img" ? "Image"
    : ["input", "textarea", "select"].includes(tag) ? "Field" : null;
  const text = String(element.getAttribute("aria-label") || (tag === "img" ? element.getAttribute("alt") : element.textContent) || "")
    .replace(/\s+/g, " ").trim();
  const words = text.length > 32 ? `${text.slice(0, 31).replace(/\s+\S*$/, "")}…` : text;
  return [kind, words].filter(Boolean).join(" · ") || "Element";
}

const MIN_TRIM_MS = 1000;
const FOCUSABLE = "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * 7e, review before posting: play it back, trim the ends, check the suggested title and see where it posts.
 * Nothing is shared until Post. Retake and Delete each ask once, because the footage is lost.
 */
export function VideoReviewCard({ review, video, media, posting = false, onPost, onRetake, onDelete }) {
  const url = useMediaUrl(media);
  const hasVideo = mediaHasVideo(media);
  const durationMs = Math.max(1, video?.durationMs || review.endMs || 1);
  const moments = video?.moments || [];
  const [title, setTitle] = useState(review.title || "");
  const [renaming, setRenaming] = useState(false);
  const [start, setStart] = useState(review.startMs || 0);
  const [end, setEnd] = useState(review.endMs || durationMs);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(null);
  const mediaRef = useRef(null);
  const cardRef = useRef(null);
  const postRef = useRef(null);
  const keepRef = useRef(null);
  const titleId = useId();

  useEffect(() => { postRef.current?.focus(); }, []);
  useEffect(() => {
    if (pending) keepRef.current?.focus();
  }, [pending]);

  const keptMs = Math.max(0, end - start);
  const post = () => {
    if (posting || pending) return;
    mediaRef.current?.pause();
    onPost?.({ title, startMs: Math.round(start), endMs: Math.round(end) });
  };
  const toggle = () => {
    const element = mediaRef.current;
    if (!element) return;
    if (!element.paused) { element.pause(); return; }
    const at = element.currentTime * 1000;
    if (at < start || at >= end - 100) element.currentTime = start / 1000;
    element.play().catch(() => {});
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (renaming) { setRenaming(false); return; }
      setPending(pending ? null : "delete");
      return;
    }
    if (event.key === "Tab") {
      const items = [...cardRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const root = cardRef.current.getRootNode();
      const index = items.indexOf(root.activeElement);
      const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index === items.length - 1 ? 0 : index + 1);
      event.preventDefault();
      items[next].focus();
      return;
    }
    const target = event.nativeEvent?.composedPath?.()[0] || event.target;
    const inField = target instanceof HTMLInputElement && target.type === "text";
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey || (!inField && !(target instanceof HTMLButtonElement)))) {
      event.preventDefault();
      post();
    }
  };
  const pct = (ms) => `${(Math.min(durationMs, Math.max(0, ms)) / durationMs) * 100}%`;
  const place = placeLabel(review.element);

  return (
    <div className="tm-sheet-layer tm-video-review-layer" data-menu-open="true">
      <section ref={cardRef} className="tm-video-review" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <header className="tm-video-review__header">
          {renaming ? (
            <input
              className="tm-video-review__title-input"
              value={title}
              maxLength={120}
              aria-label="Video title"
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setRenaming(false)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setRenaming(false); } }}
            />
          ) : (
            <button type="button" className="tm-video-review__title" onClick={() => setRenaming(true)} aria-label={`Rename video: ${title || "Untitled"}`}>
              <strong id={titleId}>{title || "Untitled video"}</strong>
              <EditIcon {...iconProps} />
            </button>
          )}
          <span className="tm-video-review__length">{formatClock(keptMs)}</span>
          <button type="button" className="tm-video-review__close" aria-label="Delete video" onClick={() => setPending("delete")}>
            <X {...iconProps} />
          </button>
        </header>

        <div className={`tm-video-review__player${hasVideo ? "" : " is-audio"}`}>
          {url && (hasVideo
            ? <video ref={mediaRef} src={url} playsInline preload="metadata" onClick={toggle}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => { if (event.currentTarget.currentTime * 1000 >= end) event.currentTarget.pause(); }} />
            : <audio ref={mediaRef} src={url} preload="metadata"
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => { if (event.currentTarget.currentTime * 1000 >= end) event.currentTarget.pause(); }} />)}
          {!hasVideo && <AudioLines className="tm-video-review__wave" aria-hidden="true" focusable="false" />}
          <button type="button" className={`tm-video-play${playing ? " is-playing" : ""}`} aria-label={playing ? "Pause" : "Play"} onClick={toggle} disabled={!url}>
            {playing ? <Pause {...iconProps} /> : <Play {...iconProps} />}
          </button>
        </div>

        <div className="tm-video-trim">
          <div className="tm-video-trim__track" aria-hidden="true">
            <span className="tm-video-trim__kept" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
            {moments.map((moment) => <span key={moment.offsetMs} className="tm-video-trim__moment" style={{ left: pct(moment.offsetMs) }} />)}
          </div>
          <input type="range" className="tm-video-trim__handle" aria-label="Start of the video" aria-valuetext={formatClock(start)}
            min={0} max={durationMs} step={100} value={start}
            onChange={(event) => setStart(Math.min(Number(event.target.value), end - MIN_TRIM_MS))} />
          <input type="range" className="tm-video-trim__handle" aria-label="End of the video" aria-valuetext={formatClock(end)}
            min={0} max={durationMs} step={100} value={end}
            onChange={(event) => setEnd(Math.max(Number(event.target.value), start + MIN_TRIM_MS))} />
        </div>
        <p className="tm-video-trim__labels">
          <span>{formatClock(start)}</span>
          <span>{moments.length ? `${moments.length} moment${moments.length === 1 ? "" : "s"}` : "Drag the ends to trim"}</span>
          <span>{formatClock(end)}</span>
        </p>
        <p className="tm-video-review__place"><CommentIcon {...iconProps} />Posts on <strong>{place}</strong></p>

        {pending ? (
          <footer className="tm-video-review__footer is-confirming" role="alert">
            <span>
              <strong>{pending === "retake" ? "Record it again?" : "Delete this video?"}</strong>
              {pending === "retake" ? ` This ${formatClock(durationMs)} take will be thrown away.` : ` The ${formatClock(durationMs)} recording hasn’t been shared and will be lost.`}
            </span>
            <button ref={keepRef} type="button" className="tm-video-review__secondary" onClick={() => setPending(null)}>Keep it</button>
            <button type="button" className="tm-video-danger" onClick={() => (pending === "retake" ? onRetake?.() : onDelete?.())}>
              {pending === "retake" ? "Retake" : "Delete"}
            </button>
          </footer>
        ) : (
          <footer className="tm-video-review__footer">
            <button type="button" className="tm-video-review__secondary" disabled={posting} onClick={() => setPending("retake")}>Retake</button>
            <button type="button" className="tm-video-review__text" disabled={posting} onClick={() => setPending("delete")}>Delete</button>
            <button ref={postRef} type="button" className="tm-video-post" disabled={posting} onClick={post}>
              {posting ? "Posting…" : "Post video"} {!posting && <Key>↵</Key>}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}

/** The reviewer's camera, kept on the page so tab capture records it like a Loom bubble. */
export function CameraBubble({ stream }) {
  const [position, setPosition] = useState(null);
  const dragRef = useRef(null);
  const bubbleRef = useRef(null);

  const clamp = (left, top) => {
    const size = bubbleRef.current?.offsetWidth || 132;
    return {
      left: Math.max(8, Math.min(window.innerWidth - size - 8, left)),
      top: Math.max(8, Math.min(window.innerHeight - size - 8, top)),
    };
  };

  return (
    <div
      ref={bubbleRef}
      className="tm-camera-bubble"
      style={position ? { left: position.left, top: position.top, bottom: "auto" } : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const bounds = bubbleRef.current.getBoundingClientRect();
        dragRef.current = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        setPosition(clamp(event.clientX - dragRef.current.offsetX, event.clientY - dragRef.current.offsetY));
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <LiveVideo stream={stream} className="tm-camera-bubble__video" />
    </div>
  );
}

/**
 * Cursor halo and click ripples drawn above the page while recording, so pointer movement is
 * unmistakable in the captured tab. Updates bypass React rendering to stay cheap at 60fps.
 */
export function RecordingCursorLayer({ shadowHost }) {
  const haloRef = useRef(null);
  const [ripples, setRipples] = useState([]);

  useEffect(() => {
    let frame = 0;
    let point = null;
    const timers = new Set();
    const paint = () => {
      frame = 0;
      const halo = haloRef.current;
      if (!halo || !point) return;
      halo.style.transform = `translate(${point.x}px, ${point.y}px)`;
      halo.style.opacity = "1";
    };
    const onMove = (event) => {
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onDown = (event) => {
      if (event.button !== 0) return;
      if (shadowHost && event.composedPath?.().includes(shadowHost)) return;
      const ripple = { id: `${event.timeStamp}-${event.clientX}-${event.clientY}`, x: event.clientX, y: event.clientY };
      setRipples((current) => [...current.slice(-(MAX_RIPPLES - 1)), ripple]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        setRipples((current) => current.filter((item) => item.id !== ripple.id));
      }, RIPPLE_LIFETIME_MS);
      timers.add(timer);
    };
    const onLeave = () => {
      if (haloRef.current) haloRef.current.style.opacity = "0";
    };
    document.addEventListener("pointermove", onMove, { capture: true, passive: true });
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) clearTimeout(timer);
      document.removeEventListener("pointermove", onMove, { capture: true });
      document.removeEventListener("pointerdown", onDown, { capture: true });
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [shadowHost]);

  return (
    <div className="tm-cursor-layer" aria-hidden="true">
      <span ref={haloRef} className="tm-cursor-halo" />
      {ripples.map((ripple) => (
        <span key={ripple.id} className="tm-click-ripple" style={{ left: ripple.x, top: ripple.y }} />
      ))}
    </div>
  );
}

/** The page element under a point, skipping Threadmark's own layers. */
function pageElementAt(x, y, shadowHost) {
  const stack = document.elementsFromPoint?.(x, y) || [];
  return stack.find((element) => element !== shadowHost && !shadowHost?.contains(element)
    && element !== document.documentElement && element !== document.body) || null;
}

/**
 * Blurred boxes over private parts of the page while the tab is recorded: what the reviewer chose, and every
 * region the site marked private (its own or another session tool's markers, and card fields). The boxes sit in
 * Threadmark's layer above the page, so tab capture records them and nothing on the page changes. Positions
 * follow scrolling and layout on every frame; the list of elements refreshes twice a second.
 */
export function VideoBlurLayer({ chosen, shadowHost }) {
  const boxesRef = useRef([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    let elements = [];
    let refreshed = -Infinity;
    const collect = () => {
      let marked = [];
      try {
        marked = [...document.querySelectorAll(`${SITE_PRIVATE_SELECTOR},${PRIVATE_FIELD_SELECTOR}`)];
      } catch {
        marked = [];
      }
      const all = [...new Set([...(chosen || []), ...marked])]
        .filter((element) => element?.isConnected && element !== shadowHost && !shadowHost?.contains(element));
      // One box per outermost region: a blurred container already covers what's inside it.
      elements = all.filter((element) => !all.some((other) => other !== element && other.contains(element))).slice(0, MAX_BLUR_BOXES);
      setCount(elements.length);
    };
    const paint = (time) => {
      if (time - refreshed > BLUR_REFRESH_MS) {
        refreshed = time;
        collect();
      }
      elements.forEach((element, index) => {
        const box = boxesRef.current[index];
        if (!box) return;
        const rect = element.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
          && rect.top < window.innerHeight && rect.left < window.innerWidth;
        box.style.opacity = visible ? "1" : "0";
        if (!visible) return;
        box.style.transform = `translate(${Math.round(rect.left) - 4}px, ${Math.round(rect.top) - 4}px)`;
        box.style.width = `${Math.round(rect.width) + 8}px`;
        box.style.height = `${Math.round(rect.height) + 8}px`;
      });
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [chosen, shadowHost]);

  return (
    <div className="tm-blur-layer" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} ref={(node) => { boxesRef.current[index] = node; }} className="tm-blur-box" />
      ))}
    </div>
  );
}

/**
 * Choosing what to blur: the page is covered by a transparent layer, so clicks pick elements instead of using
 * the page. Clicking a blurred element shows it again. Escape or Done finishes.
 */
export function BlurPicker({ shadowHost, chosen, onToggle, onDone }) {
  const [hover, setHover] = useState(null);
  const doneRef = useRef(null);

  useEffect(() => {
    doneRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onDone();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onDone]);

  const outline = hover?.getBoundingClientRect();
  const blurred = hover && chosen?.includes(hover);
  return (
    <>
      <div
        className="tm-blur-picker"
        role="presentation"
        onPointerMove={(event) => setHover(pageElementAt(event.clientX, event.clientY, shadowHost))}
        onPointerLeave={() => setHover(null)}
        onClick={(event) => {
          const element = pageElementAt(event.clientX, event.clientY, shadowHost);
          if (element) onToggle(element);
        }}
      />
      {outline && (
        <span
          className={`tm-blur-picker__outline${blurred ? " is-blurred" : ""}`}
          aria-hidden="true"
          style={{ transform: `translate(${outline.left - 3}px, ${outline.top - 3}px)`, width: outline.width + 6, height: outline.height + 6 }}
        />
      )}
      <section className="tm-blur-card" aria-label="Blur parts of the page">
        <EyeOff {...iconProps} />
        <div>
          <strong>Click what to blur in the video</strong>
          <span>{chosen?.length ? `${chosen.length} blurred. Click one again to show it.` : "Parts the site marked private are blurred already."}</span>
        </div>
        <button ref={doneRef} type="button" className="tm-video-start" onClick={onDone}>Done</button>
      </section>
    </>
  );
}

const STROKE_COLOR = "#f15722";

/** Sizes a full-viewport canvas for the screen's pixel ratio and returns its 2D context in CSS pixels. */
function viewportContext(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(window.innerWidth * ratio);
  const height = Math.round(window.innerHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  return context;
}

/** Opacity of a stroke `age` ms after it ended: solid, then fading over the last quarter of its lifetime. */
function strokeOpacity(age) {
  if (age <= STROKE_LIFETIME_MS * 0.75) return 1;
  return Math.max(0, 1 - (age - STROKE_LIFETIME_MS * 0.75) / (STROKE_LIFETIME_MS * 0.25));
}

/** Draws `strokes` (`{ points: [[, x, y], …], opacity }`) in the brand's coral, round-capped. */
function paintStrokes(context, strokes) {
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 4;
  context.strokeStyle = STROKE_COLOR;
  for (const stroke of strokes) {
    if (stroke.points.length < 2 || stroke.opacity <= 0) continue;
    context.globalAlpha = stroke.opacity;
    context.beginPath();
    stroke.points.forEach(([, x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.stroke();
  }
  context.globalAlpha = 1;
}

/**
 * Drawing on the page while recording: strokes in coral that fade after three seconds, like a pointer you
 * can write with. They're painted on a canvas in Threadmark's layer, so tab capture records them. While
 * drawing, the page doesn't receive the pointer. Each finished stroke goes to
 * `onStroke({ points: [[ms since the stroke began, x, y], …], durationMs })`.
 */
export function VideoDrawLayer({ active, onStroke }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const drawingRef = useRef(null);
  const frameRef = useRef(0);

  const paint = useCallback(() => {
    frameRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const now = performance.now();
    strokesRef.current = strokesRef.current.filter((stroke) => stroke.endedAt == null || now - stroke.endedAt < STROKE_LIFETIME_MS);
    const context = viewportContext(canvas);
    if (context) {
      paintStrokes(context, strokesRef.current.map((stroke) => ({
        points: stroke.points,
        opacity: stroke.endedAt == null ? 1 : strokeOpacity(now - stroke.endedAt),
      })));
    }
    canvas.dataset.strokes = String(strokesRef.current.length);
    if (strokesRef.current.length) frameRef.current = requestAnimationFrame(paint);
  }, []);
  const schedule = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const finish = () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (!stroke) return;
    stroke.endedAt = performance.now();
    schedule();
    if (stroke.points.length > 1) onStroke?.({ points: stroke.points, durationMs: stroke.points[stroke.points.length - 1][0] });
  };

  return (
    <canvas
      ref={canvasRef}
      className={`tm-draw-layer${active ? " is-active" : ""}`}
      data-strokes="0"
      aria-hidden={active ? undefined : "true"}
      role={active ? "img" : undefined}
      aria-label={active ? "Drawing on the page" : undefined}
      onPointerDown={(event) => {
        if (!active || event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const stroke = { startedAt: performance.now(), endedAt: null, points: [[0, Math.round(event.clientX), Math.round(event.clientY)]] };
        drawingRef.current = stroke;
        strokesRef.current = [...strokesRef.current.slice(-30), stroke];
        schedule();
      }}
      onPointerMove={(event) => {
        const stroke = drawingRef.current;
        if (!stroke || stroke.points.length >= MAX_STROKE_POINTS) return;
        const [, lastX, lastY] = stroke.points[stroke.points.length - 1];
        if (Math.abs(event.clientX - lastX) + Math.abs(event.clientY - lastY) < 3) return;
        stroke.points.push([Math.round(performance.now() - stroke.startedAt), Math.round(event.clientX), Math.round(event.clientY)]);
        schedule();
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  );
}

/**
 * A posted video (board 02, 7f-7g): the recording with a Lime play button, then Summary, Transcript and
 * Chapters from the host's `video.notes` (or the reviewer's own moments), and the code-searchable steps.
 * Every timestamp seeks the recording.
 */
export function VideoPreview({ video, media, targets = [], describeEvent, onReplay, readOnly = false }) {
  const url = useMediaUrl(media);
  const mediaRef = useRef(null);
  const [currentMs, setCurrentMs] = useState(video?.trim?.startMs || 0);
  const [playing, setPlaying] = useState(false);
  const events = video?.events || [];
  const notes = video?.notes || null;
  const moments = video?.moments || [];
  const hasVideo = mediaHasVideo(media);
  const durationMs = Math.max(1, video?.durationMs || 1);
  const startMs = video?.trim?.startMs || 0;
  const endMs = video?.trim?.endMs || durationMs;
  const processing = notes?.status === "processing";

  const chapters = notes?.chapters?.length ? notes.chapters : moments.map((moment, index) => ({ offsetMs: moment.offsetMs, text: `Moment ${index + 1}` }));
  const tabs = [
    (processing || notes?.summary) && { id: "summary", label: "Summary", lines: notes?.summary || [] },
    (processing || notes?.transcript) && { id: "transcript", label: "Transcript", lines: notes?.transcript || [] },
    (processing || chapters.length) && { id: "chapters", label: "Chapters", lines: chapters },
    events.length && { id: "steps", label: "Steps" },
  ].filter(Boolean);
  const [tabId, setTabId] = useState(tabs[0]?.id || null);
  const tab = tabs.find((item) => item.id === tabId) || tabs[0] || null;
  const tabsId = useId();

  const seek = (offsetMs, play = false) => {
    const element = mediaRef.current;
    if (!element) return;
    element.currentTime = Math.max(0, offsetMs / 1000);
    setCurrentMs(offsetMs);
    if (play) element.play().catch(() => {});
  };
  const toggle = () => {
    const element = mediaRef.current;
    if (!element) return;
    if (!element.paused) { element.pause(); return; }
    const at = element.currentTime * 1000;
    if (at < startMs || at >= endMs - 100) element.currentTime = startMs / 1000;
    element.play().catch(() => {});
  };
  const onTime = (event) => {
    const at = event.currentTarget.currentTime * 1000;
    setCurrentMs(at);
    if (at >= endMs && !event.currentTarget.paused) event.currentTarget.pause();
  };
  const activeLine = (lines) => {
    let index = -1;
    lines.forEach((line, i) => { if (line.offsetMs <= currentMs + 50) index = i; });
    return index;
  };
  const activeIndex = activeEventIndex(events, currentMs);
  const started = playing || currentMs > startMs + 50;

  return (
    <section className="tm-video-preview" aria-label="Recorded video">
      {url ? (
        <div className={`tm-video-preview__player${hasVideo ? "" : " is-audio"}${video?.mode === "voice" && hasVideo ? " is-camera" : ""}`}>
          {hasVideo
            ? <video ref={mediaRef} className="tm-video-preview__media" src={url} playsInline preload="metadata" onClick={toggle}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={onTime} />
            : <audio ref={mediaRef} className="tm-video-preview__audio" src={url} preload="metadata"
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={onTime} />}
          {!hasVideo && <AudioLines className="tm-video-review__wave" aria-hidden="true" focusable="false" />}
          <button type="button" className={`tm-video-play${playing ? " is-playing" : ""}`} aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
            {playing ? <Pause {...iconProps} /> : <Play {...iconProps} />}
          </button>
          {started && <span className="tm-video-preview__time">{formatClock(currentMs)} / {formatClock(endMs)}</span>}
          <input type="range" className="tm-video-preview__seek" aria-label="Seek" aria-valuetext={formatClock(currentMs)}
            min={0} max={durationMs} step={100} value={Math.min(durationMs, currentMs)}
            style={{ "--tm-seek": `${(Math.min(durationMs, currentMs) / durationMs) * 100}%` }}
            onChange={(event) => seek(Number(event.target.value))} />
        </div>
      ) : <p className="tm-video-preview__missing">{readOnly ? "The recording isn’t available on this device." : "Preparing the recording…"}</p>}

      {video?.mode === "voice" && onReplay && url && (
        <button type="button" className="tm-video-preview__replay" onClick={onReplay}>
          <MousePointer2 {...iconProps} />
          Replay on page
        </button>
      )}

      {tab && (
        <>
          <div className="tm-video-tabs" role="tablist" aria-label="About this video">
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" id={`${tabsId}-${item.id}`} aria-selected={item.id === tab.id}
                aria-controls={`${tabsId}-panel`} className={item.id === tab.id ? "is-active" : ""} onClick={() => setTabId(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab.id}`} className="tm-video-tabpanel">
            {tab.id === "steps" ? (
              <ol className="tm-interaction-events tm-video-events">
                {events.map((event, index) => (
                  <li key={`${event.offsetMs}-${event.type}-${index}`} className={activeIndex === index ? "is-active" : ""}>
                    <button type="button" onClick={() => seek(event.offsetMs)} disabled={!url}>
                      <time>{formatClock(event.offsetMs)}</time>
                      <span className="tm-interaction-event__label">{describeEvent(event, targets)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : processing && !tab.lines.length ? (
              <div className="tm-video-notes is-processing" role="status">
                <p><SummaryIcon {...iconProps} />Writing the summary and transcript…</p>
                <span /><span /><span />
              </div>
            ) : (
              <ol className="tm-video-notes">
                {tab.id === "summary" && notes?.silent && <li className="tm-video-notes__lead">No speech in this video, so this summary comes from what was on screen.</li>}
                {tab.lines.map((line, index) => (
                  <li key={`${line.offsetMs}-${index}`} className={activeLine(tab.lines) === index && started ? "is-active" : ""}>
                    <button type="button" onClick={() => seek(line.offsetMs, true)} disabled={!url}>
                      <time>{formatClock(line.offsetMs)}</time>
                      <span>{line.text}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
      {events.length > 0 && <p className="tm-video-preview__note">
        Steps leave out typed values and keys. {video?.mode === "tab" ? "The video shows what was visible in the tab." : video?.mode === "screen" ? "The video shows what was on the shared screen." : "Only your voice, camera and cursor path were recorded."}
      </p>}
    </section>
  );
}

/**
 * Voice + cursor playback over the live page: the reviewer's camera (or initials) rides on a ghost
 * cursor that follows the recorded path, scrolling the page as it was scrolled. Nothing on the page
 * is clicked or changed.
 */
export function VoiceReplay({ video, media, author, onClose }) {
  const url = useMediaUrl(media);
  const mediaRef = useRef(null);
  const cursorRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [ripples, setRipples] = useState([]);
  const strokesCanvasRef = useRef(null);
  const lastOffsetRef = useRef(0);
  const closeRef = useRef(null);
  const hasCamera = mediaHasVideo(media);
  const samples = video?.pointer?.samples || [];
  const scrolls = video?.pointer?.scrolls || [];
  const drawings = video?.drawings || [];
  const clicks = (video?.events || []).filter((event) => event.type === "click" && Number.isFinite(event.x));
  const durationMs = video?.durationMs || 0;
  const initials = String(author?.displayName || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "•";

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !url) return undefined;
    media.play?.().then(() => setPlaying(true)).catch(() => setPlaying(false));
    let frame = 0;
    const tick = () => {
      const offsetMs = media.currentTime * 1000;
      const scroll = scrollPositionAt(scrolls, offsetMs);
      if (Math.abs(window.scrollX - scroll.x) > 1 || Math.abs(window.scrollY - scroll.y) > 1) {
        window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" });
      }
      const position = pointerPositionAt(samples, offsetMs);
      const cursor = cursorRef.current;
      if (cursor) {
        if (position) {
          // Samples are viewport coordinates at recording time; correct for any scroll the page refused.
          const x = position.x + scroll.x - window.scrollX;
          const y = position.y + scroll.y - window.scrollY;
          cursor.style.transform = `translate(${x}px, ${y}px)`;
          cursor.style.opacity = "1";
        } else {
          cursor.style.opacity = "0";
        }
      }
      const previous = lastOffsetRef.current;
      if (offsetMs > previous) {
        const fired = clicks.filter((event) => event.offsetMs > previous && event.offsetMs <= offsetMs);
        if (fired.length) {
          setRipples((current) => [
            ...current.slice(-(MAX_RIPPLES - fired.length)),
            ...fired.map((event) => ({
              id: `${event.offsetMs}-${event.x}-${event.y}`,
              x: event.x + scroll.x - window.scrollX,
              y: event.y + scroll.y - window.scrollY,
              offsetMs: event.offsetMs,
            })),
          ]);
        }
      }
      lastOffsetRef.current = offsetMs;
      setCurrentMs((current) => Math.abs(current - offsetMs) >= 200 ? offsetMs : current);
      // Drawings come back as they were drawn and fade like they did, placed for the page's current scroll.
      const canvas = strokesCanvasRef.current;
      if (canvas && drawings.length) {
        const visible = drawings.flatMap((stroke) => {
          const elapsed = offsetMs - stroke.offsetMs;
          const length = stroke.points[stroke.points.length - 1]?.[0] || 0;
          if (elapsed < 0 || elapsed > length + STROKE_LIFETIME_MS) return [];
          const at = scrollPositionAt(scrolls, stroke.offsetMs);
          return [{
            points: stroke.points.filter(([time]) => time <= elapsed).map(([time, x, y]) => [time, x + at.x - window.scrollX, y + at.y - window.scrollY]),
            opacity: elapsed > length ? strokeOpacity(elapsed - length) : 1,
          }];
        });
        const context = viewportContext(canvas);
        if (context) paintStrokes(context, visible);
        canvas.dataset.strokes = String(visible.filter((stroke) => stroke.points.length > 1).length);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [url]);

  useEffect(() => {
    if (!ripples.length) return undefined;
    const timer = setTimeout(() => {
      setRipples((current) => current.filter((ripple) => Math.abs(lastOffsetRef.current - ripple.offsetMs) < RIPPLE_LIFETIME_MS));
    }, RIPPLE_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [ripples]);

  const togglePlayback = () => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      if (media.ended) lastOffsetRef.current = 0;
      media.play?.().then(() => setPlaying(true)).catch(() => {});
    } else {
      media.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <div className="tm-replay-layer" aria-hidden="true">
        {drawings.length > 0 && <canvas ref={strokesCanvasRef} className="tm-draw-layer" data-strokes="0" />}
        {ripples.map((ripple) => (
          <span key={ripple.id} className="tm-click-ripple" style={{ left: ripple.x, top: ripple.y }} />
        ))}
        <div ref={cursorRef} className="tm-replay-cursor">
          <MousePointer2 className="tm-replay-cursor__arrow" aria-hidden="true" focusable="false" />
          <div className="tm-replay-cursor__bubble">
            {hasCamera
              ? (
                <video
                  ref={mediaRef}
                  src={url || undefined}
                  playsInline
                  onEnded={() => setPlaying(false)}
                />
              )
              : <span>{initials}</span>}
          </div>
        </div>
      </div>
      {!hasCamera && (
        <audio ref={mediaRef} src={url || undefined} onEnded={() => setPlaying(false)} />
      )}
      <section className="tm-replay-bar" aria-label="Cursor replay">
        <button type="button" className="tm-video-icon-button" aria-label={playing ? "Pause replay" : "Play replay"} onClick={togglePlayback}>
          {playing ? <Pause {...iconProps} /> : <Play {...iconProps} />}
        </button>
        <div className="tm-replay-bar__copy">
          <strong>Replaying {author?.displayName ? `${author.displayName}’s` : "the"} cursor</strong>
          <span>{formatClock(currentMs)} / {formatClock(durationMs)} · the page is not changed</span>
        </div>
        <button ref={closeRef} type="button" className="tm-cancel" onClick={onClose}>Done</button>
      </section>
    </>
  );
}
