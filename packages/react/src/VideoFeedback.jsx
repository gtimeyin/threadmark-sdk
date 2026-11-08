import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SoundwaveIcon as AudioLines } from "@solar-icons/react/linear/soundwave";
import { RecordCircleIcon as Circle } from "@solar-icons/react/linear/record-circle";
import { EyeClosedIcon as EyeOff } from "@solar-icons/react/linear/eye-closed";
import { MicrophoneIcon as Mic } from "@solar-icons/react/linear/microphone";
import { VolumeCrossIcon as MicOff } from "@solar-icons/react/linear/volume-cross";
import { MonitorIcon as Monitor } from "@solar-icons/react/linear/monitor";
import { CursorIcon as MousePointer2 } from "@solar-icons/react/linear/cursor";
import { PauseIcon as Pause } from "@solar-icons/react/linear/pause";
import { PenIcon as PenLine } from "@solar-icons/react/linear/pen";
import { PlayIcon as Play } from "@solar-icons/react/linear/play";
import { RestartIcon as RotateCcw } from "@solar-icons/react/linear/restart";
import { StopIcon as Square } from "@solar-icons/react/linear/stop";
import { TrashBinTrashIcon as Trash2 } from "@solar-icons/react/linear/trash-bin-trash";
import { VideocameraIcon as Video } from "@solar-icons/react/linear/videocamera";
import { VideocameraOffIcon as VideoOff } from "@solar-icons/react/linear/videocamera-off";
import { CloseIcon as X } from "@solar-icons/react/linear/close";
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

function DeviceSelect({ label, devices, value, disabled, onChange }) {
  if (devices.length < 2) return null;
  return (
    <label className="tm-video-setup__device">
      <span className="tm-sr-only">{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
        ))}
      </select>
    </label>
  );
}

/** In-page setup card: capture mode, camera and microphone, then Start recording. */
export function VideoSetupPanel({ setup, maxDurationMs, blurredCount = 0, onBlur, onChange, onStart, onCancel }) {
  const headingId = useId();
  const statusId = useId();
  const panelRef = useRef(null);
  const busy = setup.status === "requesting" || setup.status === "starting";
  const hasCameraPreview = setup.camera && setup.previewStream?.getVideoTracks?.().length > 0;
  const nothingToRecord = setup.mode === "voice" && !setup.camera && !setup.microphone;
  const limit = formatClock(maxDurationMs);
  const hint = setup.mode === "tab"
    ? `Your browser will ask to share this tab. Everything visible in it is recorded, up to ${limit}.`
    : `Records your ${setup.camera ? "voice and camera" : "voice"} with the cursor path, replayed over the page. Up to ${limit}.`;

  useEffect(() => {
    panelRef.current?.querySelector(".tm-video-start")?.focus();
  }, []);

  return (
    <section
      ref={panelRef}
      className="tm-video-setup"
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      aria-describedby={statusId}
    >
      <header className="tm-video-setup__header">
        <strong id={headingId}>Record video feedback</strong>
        <button type="button" className="tm-video-icon-button" aria-label="Close video recorder" onClick={onCancel}>
          <X {...iconProps} />
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

      <div className="tm-video-setup__preview">
        {hasCameraPreview
          ? <LiveVideo stream={setup.previewStream} className="tm-video-setup__camera" />
          : (
            <span className="tm-video-setup__camera tm-video-setup__camera--off" aria-hidden="true">
              <VideoOff {...iconProps} />
            </span>
          )}
        <div className="tm-video-setup__sources">
          <div className="tm-video-setup__source">
            <button
              type="button"
              className={`tm-video-toggle${setup.camera ? " is-on" : ""}`}
              aria-pressed={setup.camera}
              disabled={busy}
              onClick={() => onChange({ camera: !setup.camera })}
            >
              {setup.camera ? <Video {...iconProps} /> : <VideoOff {...iconProps} />}
              {setup.camera ? "Camera on" : "Camera off"}
            </button>
            <DeviceSelect
              label="Camera"
              devices={setup.devices.cameras}
              value={setup.cameraDeviceId}
              disabled={busy || !setup.camera}
              onChange={(cameraDeviceId) => onChange({ cameraDeviceId })}
            />
          </div>
          <div className="tm-video-setup__source">
            <button
              type="button"
              className={`tm-video-toggle${setup.microphone ? " is-on" : ""}`}
              aria-pressed={setup.microphone}
              disabled={busy}
              onClick={() => onChange({ microphone: !setup.microphone })}
            >
              {setup.microphone ? <Mic {...iconProps} /> : <MicOff {...iconProps} />}
              {setup.microphone ? "Microphone on" : "Microphone off"}
            </button>
            <DeviceSelect
              label="Microphone"
              devices={setup.devices.microphones}
              value={setup.microphoneDeviceId}
              disabled={busy || !setup.microphone}
              onChange={(microphoneDeviceId) => onChange({ microphoneDeviceId })}
            />
          </div>
        </div>
      </div>

      <p id={statusId} className={`tm-video-setup__hint${setup.error ? " is-error" : ""}`} aria-live="polite">
        {setup.error || (setup.status === "requesting" ? "Waiting for camera and microphone access…" : hint)}
      </p>

      <footer className="tm-video-setup__actions">
        <button type="button" className="tm-cancel" aria-keyshortcuts="Escape" onClick={onCancel}>Back to Comment</button>
        {onBlur && setup.mode === "tab" && (
          <button type="button" className="tm-cancel tm-video-setup__blur" disabled={busy} onClick={onBlur}>
            <EyeOff {...iconProps} />
            {blurredCount ? `${blurredCount} blurred` : "Blur parts of the page"}
          </button>
        )}
        <button
          type="button"
          className="tm-video-start"
          disabled={busy || nothingToRecord}
          onClick={onStart}
        >
          <Circle {...iconProps} />
          {setup.status === "starting" ? "Starting…" : "Start recording"}
        </button>
      </footer>
    </section>
  );
}

/**
 * Floating recorder: timer, blur and draw tools, pause, restart, discard, and stop. Losing footage always needs
 * a second step. Blurring is offered for tab recordings, the only ones that record the page itself.
 */
export function VideoRecorderBar({ state, tool = null, onTool, onPause, onRestart, onDiscard, onStop }) {
  const [pendingAction, setPendingAction] = useState(null);
  const confirmRef = useRef(null);
  const announcement = state.finishing
    ? "Saving recording"
    : state.paused ? "Recording paused" : `Recording ${state.mode === "tab" ? "this tab" : "voice and cursor"}`;

  useEffect(() => {
    if (pendingAction) confirmRef.current?.focus();
  }, [pendingAction]);

  if (pendingAction) {
    const restarting = pendingAction === "restart";
    return (
      <section className="tm-video-recorder is-confirming" aria-label="Video recorder" role="alert">
        <div className="tm-video-recorder__copy">
          <strong>{restarting ? "Restart from the beginning?" : "Discard this recording?"}</strong>
          <span>{formatClock(state.elapsedMs)} of video{state.eventCount ? ` and ${state.eventCount} step${state.eventCount === 1 ? "" : "s"}` : ""} will be lost.</span>
        </div>
        <button type="button" className="tm-cancel" onClick={() => setPendingAction(null)}>Keep recording</button>
        <button
          ref={confirmRef}
          type="button"
          className="tm-video-danger"
          onClick={() => {
            setPendingAction(null);
            if (restarting) onRestart();
            else onDiscard();
          }}
        >
          {restarting ? <RotateCcw {...iconProps} /> : <Trash2 {...iconProps} />}
          {restarting ? "Restart" : "Discard"}
        </button>
      </section>
    );
  }

  return (
    <section className={`tm-video-recorder${state.paused ? " is-paused" : ""}`} aria-label="Video recorder">
      <span className="tm-sr-only" aria-live="polite">{announcement}</span>
      <span className="tm-recording-dot" aria-hidden="true" />
      <div className="tm-video-recorder__copy">
        <strong>
          <span className="tm-video-recorder__clock">{formatClock(state.elapsedMs)}</span>
          <span className="tm-video-recorder__limit"> / {formatClock(state.maxDurationMs)}</span>
        </strong>
        <span>{state.paused ? "Paused" : state.mode === "tab" ? "Recording this tab" : "Recording voice + cursor"}</span>
      </div>
      <span className="tm-video-recorder__count">
        {state.eventCount} step{state.eventCount === 1 ? "" : "s"}
      </span>
      {onTool && state.mode === "tab" && (
        <button
          type="button"
          className={`tm-video-icon-button${tool === "blur" ? " is-active" : ""}`}
          aria-label="Blur parts of the page"
          aria-pressed={tool === "blur"}
          title="Blur (pauses while you choose)"
          disabled={state.finishing}
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
          disabled={state.finishing}
          onClick={() => onTool(tool === "draw" ? null : "draw")}
        >
          <PenLine {...iconProps} />
        </button>
      )}
      <button
        type="button"
        className="tm-video-icon-button"
        aria-label={state.paused ? "Resume recording" : "Pause recording"}
        title={state.paused ? "Resume" : "Pause"}
        disabled={state.finishing}
        onClick={onPause}
      >
        {state.paused ? <Play {...iconProps} /> : <Pause {...iconProps} />}
      </button>
      <button
        type="button"
        className="tm-video-icon-button"
        aria-label="Restart recording"
        title="Restart"
        disabled={state.finishing}
        onClick={() => setPendingAction("restart")}
      >
        <RotateCcw {...iconProps} />
      </button>
      <button
        type="button"
        className="tm-video-icon-button"
        aria-label="Discard recording"
        title="Discard"
        disabled={state.finishing}
        onClick={() => setPendingAction("discard")}
      >
        <Trash2 {...iconProps} />
      </button>
      <button type="button" className="tm-recording-stop" disabled={state.finishing} onClick={onStop}>
        <Square {...iconProps} />
        {state.finishing ? "Saving…" : "Stop"}
      </button>
    </section>
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

const STROKE_COLOR = "#e5483c";

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

/** Playback with a timeline of code-searchable steps; each step seeks the recording. */
export function VideoPreview({ video, media, targets = [], describeEvent, onReplay, readOnly = false }) {
  const url = useMediaUrl(media);
  const mediaRef = useRef(null);
  const [currentMs, setCurrentMs] = useState(0);
  const events = video?.events || [];
  const activeIndex = activeEventIndex(events, currentMs);
  const hasVideo = mediaHasVideo(media);
  const title = video?.mode === "tab" ? "Tab recording" : video?.mode === "screen" ? "Screen recording" : video?.camera ? "Voice, camera + cursor" : "Voice + cursor";

  const seek = (offsetMs) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = Math.max(0, offsetMs / 1000);
    setCurrentMs(offsetMs);
  };

  return (
    <section className="tm-video-preview" aria-label="Recorded video">
      <div className="tm-video-preview__header">
        <div>
          <strong>{title}</strong>
          <span>{formatClock(video?.durationMs)} · {events.length} step{events.length === 1 ? "" : "s"}</span>
        </div>
        {video?.mode === "voice" && onReplay && url && (
          <button type="button" onClick={onReplay}>
            <MousePointer2 {...iconProps} />
            Replay on page
          </button>
        )}
      </div>
      {url
        ? hasVideo
          ? (
            <video
              ref={mediaRef}
              className={`tm-video-preview__media${video?.mode === "voice" ? " is-camera" : ""}`}
              src={url}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
            />
          )
          : (
            <audio
              ref={mediaRef}
              className="tm-video-preview__audio"
              src={url}
              controls
              preload="metadata"
              onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
            />
          )
        : <p className="tm-video-preview__missing">{readOnly ? "The recording isn’t available on this device." : "Preparing the recording…"}</p>}
      {events.length > 0 && (
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
      )}
      <p className="tm-video-preview__note">
        The step timeline omits typed values and printable keys. {video?.mode === "tab" ? "The video shows everything that was visible in the tab." : video?.mode === "screen" ? "The video shows everything that was on the shared screen." : "Only your voice, camera, and cursor path were recorded."}
      </p>
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
