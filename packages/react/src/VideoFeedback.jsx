import { useEffect, useId, useRef, useState } from "react";
import { SoundwaveIcon as AudioLines } from "@solar-icons/react/linear/soundwave";
import { RecordCircleIcon as Circle } from "@solar-icons/react/linear/record-circle";
import { MicrophoneIcon as Mic } from "@solar-icons/react/linear/microphone";
import { VolumeCrossIcon as MicOff } from "@solar-icons/react/linear/volume-cross";
import { MonitorIcon as Monitor } from "@solar-icons/react/linear/monitor";
import { CursorIcon as MousePointer2 } from "@solar-icons/react/linear/cursor";
import { PauseIcon as Pause } from "@solar-icons/react/linear/pause";
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

const iconProps = {
  "aria-hidden": true,
  className: "tm-tool-icon",
  focusable: "false",
};

const MAX_RIPPLES = 6;
const RIPPLE_LIFETIME_MS = 650;

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
export function VideoSetupPanel({ setup, maxDurationMs, onChange, onStart, onCancel }) {
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

/** Floating recorder: timer, pause, restart, discard, and stop. Losing footage always needs a second step. */
export function VideoRecorderBar({ state, onPause, onRestart, onDiscard, onStop }) {
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

/** Playback with a timeline of code-searchable steps; each step seeks the recording. */
export function VideoPreview({ video, media, targets = [], describeEvent, onReplay, readOnly = false }) {
  const url = useMediaUrl(media);
  const mediaRef = useRef(null);
  const [currentMs, setCurrentMs] = useState(0);
  const events = video?.events || [];
  const activeIndex = activeEventIndex(events, currentMs);
  const hasVideo = mediaHasVideo(media);
  const title = video?.mode === "tab" ? "Tab recording" : video?.camera ? "Voice, camera + cursor" : "Voice + cursor";

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
        The step timeline omits typed values and printable keys. {video?.mode === "tab" ? "The video shows everything that was visible in the tab." : "Only your voice, camera, and cursor path were recorded."}
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
  const lastOffsetRef = useRef(0);
  const closeRef = useRef(null);
  const hasCamera = mediaHasVideo(media);
  const samples = video?.pointer?.samples || [];
  const scrolls = video?.pointer?.scrolls || [];
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
