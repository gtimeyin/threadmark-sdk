import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import { PauseIcon as Pause } from "./icons.jsx";
import { PlayIcon as Play } from "./icons.jsx";
import { CloseIcon as X } from "./icons.jsx";
import { buildReplayTimeline, graphqlLabel, isFailedRequest } from "./replayTimeline.js";

import replayerStyles from 'rrweb/dist/style.css?inline';
import { videoStyles } from './videoStyles.js';
import { installFeatureStyles } from './featureStyles.js';

// This chunk loads lazily. Helpers arrive through the `kit` prop so playback details stay out of
// the initial review graph. Replay chrome and rrweb styles install only when this viewer mounts.

const iconProps = { "aria-hidden": true, className: "tm-tool-icon", focusable: "false" };
const SPEEDS = [1, 2, 4];

/**
 * Plays an rrweb replay in a large dialog above the page, with its console, network, and action
 * timelines. Every row seeks the replay. Nothing on the live page is touched.
 */
function ReplayPlayer({ replay, media, kit, onClose, embedded = false }) {
  const { EVENT_TYPE, decodeReplayEvents, formatClock } = kit;
  const stageRef = useRef(null);
  const replayerRef = useRef(null);
  const closeRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [events, setEvents] = useState([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState(replay?.console?.errors ? "console" : replay?.network?.failed ? "network" : "actions");
  const [timeline, setTimeline] = useState({ console: [], network: [], actions: [] });
  const duration = useMemo(() => {
    if (!events.length) return replay?.durationMs || 0;
    const start = events.find((event) => event.type === EVENT_TYPE.Meta)?.timestamp || events[0].timestamp;
    return Math.max(0, events[events.length - 1].timestamp - start);
  }, [events, replay?.durationMs]);

  useEffect(() => {
    if (embedded) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, embedded]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus("loading");
    setEvents([]);
    setCurrent(0);
    setPlaying(false);
    setSpeed(1);
    setTimeline({ console: [], network: [], actions: [] });
    (async () => {
      let blob = media?.blob;
      if (!blob && media?.url) {
        const response = await fetch(media.url, { signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        blob = await response.blob();
      }
      const decoded = await decodeReplayEvents(blob);
      if (!decoded.length) throw new Error("empty");
      if (active) setEvents(decoded);
    })().catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; controller.abort(); };
  }, [media?.blob, media?.url]);

  useEffect(() => {
    if (!events.length || !stageRef.current) return undefined;
    let replayer = null;
    let frame = 0;
    let observer = null;
    let cancelled = false;
    import("rrweb").then(({ Replayer }) => {
      if (cancelled) return;
      replayer = new Replayer(events, {
        root: stageRef.current,
        skipInactive: true,
        showWarning: false,
        triggerFocus: false,
        mouseTail: { duration: 700, lineCap: "round", lineWidth: 3, strokeStyle: "rgba(229, 72, 60, 0.55)" },
        UNSAFE_replayCanvas: false,
      });
      replayerRef.current = replayer;
      replayer.on("finish", () => setPlaying(false));
      const fit = () => {
        const wrapper = stageRef.current?.querySelector(".replayer-wrapper");
        const iframe = wrapper?.querySelector("iframe");
        if (!wrapper || !iframe) return;
        const width = Number(iframe.width) || iframe.offsetWidth || 1;
        const height = Number(iframe.height) || iframe.offsetHeight || 1;
        const bounds = stageRef.current.getBoundingClientRect();
        const scale = Math.min(bounds.width / width, bounds.height / height, 1);
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.left = `${Math.max(0, (bounds.width - width * scale) / 2)}px`;
        wrapper.style.top = `${Math.max(0, (bounds.height - height * scale) / 2)}px`;
      };
      replayer.on("resize", fit);
      replayer.pause(0);
      fit();
      observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
      observer?.observe(stageRef.current);
      setTimeline(buildReplayTimeline(events, kit));
      setStatus("ready");
      const tick = () => {
        setCurrent((value) => {
          const next = Math.round(replayer.getCurrentTime());
          return Math.abs(next - value) >= 100 ? next : value;
        });
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      replayer?.pause();
      replayer?.destroy?.();
      replayerRef.current = null;
    };
  }, [events]);

  const seek = (offsetMs) => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    if (playing) replayer.play(offsetMs);
    else replayer.pause(offsetMs);
    setCurrent(offsetMs);
  };

  const togglePlayback = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    if (playing) {
      replayer.pause();
      setPlaying(false);
    } else {
      replayer.play(current >= duration - 50 ? 0 : current);
      setPlaying(true);
    }
  };

  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    replayerRef.current?.setConfig({ speed: next });
  };

  const rows = timeline[tab];
  const activeIndex = rows.reduce((found, row, index) => (row.offsetMs <= current ? index : found), -1);
  const tabs = [
    ["console", "Console", timeline.console.length],
    ["network", "Network", timeline.network.length],
    ["actions", "Actions", timeline.actions.length],
  ];

  return (
    <div className={`tm-replay-dialog${embedded ? " tm-replay-dialog--embedded" : ""}`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : "true"} aria-label="Session playback">
      {!embedded && <div className="tm-replay-dialog__scrim" onClick={onClose} />}
      <section className="tm-replay-dialog__panel">
        <header className="tm-replay-dialog__header">
          <div>
            <strong>Playback</strong>
            <span>{formatClock(duration)} before the comment · inputs hidden · nothing on this page is changed</span>
          </div>
          {!embedded && <button ref={closeRef} type="button" className="tm-video-icon-button" aria-label="Close playback" onClick={onClose}>
            <X {...iconProps} />
          </button>}
        </header>
        <div className="tm-replay-dialog__body">
          <div className="tm-replay-dialog__viewer">
            <div ref={stageRef} className="tm-replay-dialog__stage">
              {status === "loading" && <p className="tm-replay-dialog__status">Loading playback…</p>}
              {status === "error" && <p className="tm-replay-dialog__status">This playback couldn’t be opened.</p>}
            </div>
            <div className="tm-replay-dialog__controls">
              <button type="button" className="tm-video-icon-button" disabled={status !== "ready"} onClick={togglePlayback}
                aria-label={playing ? "Pause playback" : "Play playback"}>
                {playing ? <Pause {...iconProps} /> : <Play {...iconProps} />}
              </button>
              <span className="tm-replay-dialog__time">{formatClock(current)} / {formatClock(duration)}</span>
              <input
                type="range"
                min="0"
                max={Math.max(1, duration)}
                step="1"
                value={Math.min(current, duration)}
                disabled={status !== "ready"}
                aria-label="Playback position"
                onChange={(event) => seek(Number(event.target.value))}
              />
              <button type="button" className="tm-replay-dialog__speed" disabled={status !== "ready"} onClick={changeSpeed}
                aria-label={`Playback speed ${speed}×`}>
                {speed}×
              </button>
            </div>
          </div>
          <aside className="tm-replay-dialog__side">
            <div className="tm-replay-dialog__tabs" role="tablist" aria-label="Playback details">
              {tabs.map(([key, label, total]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""}
                  onClick={() => setTab(key)}>
                  {label}
                  <span>{total}</span>
                </button>
              ))}
            </div>
            <ol className="tm-replay-dialog__rows" role="tabpanel">
              {rows.length === 0 && <li className="tm-replay-dialog__empty">{status === "ready" ? `No ${tab} entries in this playback.` : "…"}</li>}
              {rows.map((row, index) => (
                <li key={`${tab}-${row.offsetMs}-${index}`} className={index === activeIndex ? "is-active" : ""}>
                  <button type="button" onClick={() => seek(row.offsetMs)}>
                    <time>{formatClock(row.offsetMs)}</time>
                    {tab === "console" && (
                      <span className={`tm-replay-row tm-replay-row--${row.level}`}>
                        <strong>{row.level}</strong> {row.message}
                        {row.detail && <small>{row.detail.split("\n")[0]}</small>}
                      </span>
                    )}
                    {tab === "network" && (
                      <span className={`tm-replay-row tm-replay-row--${isFailedRequest(row) ? "error" : "ok"}`}>
                        <strong>{row.method} {row.status || "—"}</strong> {graphqlLabel(row) ? `${graphqlLabel(row)} · ${row.url}` : row.url}
                        <small>{row.durationMs} ms · {row.outcome.replace("_", " ")}</small>
                      </span>
                    )}
                    {tab === "actions" && <span className="tm-replay-row">{row.label}</span>}
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default function StyledReplayPlayer(props) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const root = ref.current?.getRootNode();
    installFeatureStyles(root, videoStyles);
    installFeatureStyles(root, replayerStyles);
  }, []);
  return <span ref={ref} style={{ display: 'contents' }}><ReplayPlayer {...props} /></span>;
}
