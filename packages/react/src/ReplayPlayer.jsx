import { useEffect, useMemo, useRef, useState } from "react";
import { PauseIcon as Pause } from "@solar-icons/react/linear/pause";
import { PlayIcon as Play } from "@solar-icons/react/linear/play";
import { CloseIcon as X } from "@solar-icons/react/linear/close";

// This chunk loads lazily. Helpers arrive through the `kit` prop instead of imports, so the SDK's entry
// stays one self-contained file and no shared chunk is split out of it.

const iconProps = { "aria-hidden": true, className: "tm-tool-icon", focusable: "false" };
const SPEEDS = [1, 2, 4];

// rrweb serialized node types.
const ELEMENT_NODE = 2;
const TEXT_NODE = 3;
const MUTATION_SOURCE = 0;

/** id → serialized element, read from snapshots and added nodes, so names never depend on playback state. */
function indexSerializedNodes(events, EVENT_TYPE) {
  const nodes = new Map();
  const walk = (node, parentId) => {
    if (!node || typeof node !== "object") return;
    nodes.set(node.id, { ...node, parentId });
    for (const child of node.childNodes || []) walk(child, node.id);
  };
  for (const event of events) {
    if (event.type === EVENT_TYPE.FullSnapshot) walk(event.data?.node, null);
    else if (event.type === EVENT_TYPE.IncrementalSnapshot && event.data?.source === MUTATION_SOURCE) {
      for (const add of event.data.adds || []) walk(add.node, add.parentId);
    }
  }
  return nodes;
}

function serializedText(node, limit = 80) {
  if (!node) return "";
  if (node.type === TEXT_NODE) return node.textContent || "";
  let text = "";
  for (const child of node.childNodes || []) {
    text += ` ${serializedText(child, limit)}`;
    if (text.length > limit) break;
  }
  return text;
}

function describeNode(node) {
  if (!node || node.type !== ELEMENT_NODE) return "the page";
  const tag = String(node.tagName || "element").toLowerCase();
  const attributes = node.attributes || {};
  const label = attributes["aria-label"] || attributes.title || attributes.alt || serializedText(node);
  const name = String(label).replace(/\s+/g, " ").trim().slice(0, 60);
  return name ? `${tag} “${name}”` : `<${tag}>`;
}

function pathOf(href) {
  try {
    const url = new URL(href);
    return url.pathname + (url.search ? "?…" : "");
  } catch {
    return "a new page";
  }
}

/** Timeline rows for the Console, Network, and Actions tabs, in recording time. */
function buildTimeline(events, getNode, kit) {
  const { EVENT_TYPE, INCREMENTAL_SOURCE, MOUSE_INTERACTION, REPLAY_CONSOLE_EVENT, REPLAY_NETWORK_EVENT } = kit;
  const start = events.find((event) => event.type === EVENT_TYPE.Meta)?.timestamp || events[0]?.timestamp || 0;
  const rows = { console: [], network: [], actions: [] };
  let lastScroll = -Infinity;
  let firstMeta = true;
  for (const event of events) {
    const offsetMs = Math.max(0, event.timestamp - start);
    if (event.type === EVENT_TYPE.Meta) {
      if (!firstMeta) rows.actions.push({ offsetMs, label: `Navigated to ${pathOf(event.data?.href)}` });
      firstMeta = false;
    } else if (event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_CONSOLE_EVENT) {
      const entry = event.data.payload || {};
      rows.console.push({ offsetMs, level: entry.level || "log", message: entry.message || "", detail: entry.stack || entry.source || "" });
    } else if (event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_NETWORK_EVENT) {
      const entry = event.data.payload || {};
      rows.network.push({
        offsetMs: Math.max(0, offsetMs - (entry.durationMs || 0)),
        method: entry.method || "GET",
        url: entry.url || "",
        status: entry.status || 0,
        durationMs: entry.durationMs || 0,
        outcome: entry.outcome || "incomplete",
      });
    } else if (event.type === EVENT_TYPE.IncrementalSnapshot) {
      const data = event.data || {};
      if (data.source === INCREMENTAL_SOURCE.MouseInteraction
        && [MOUSE_INTERACTION.Click, MOUSE_INTERACTION.DblClick, MOUSE_INTERACTION.TouchEnd].includes(data.type)) {
        rows.actions.push({ offsetMs, label: `Clicked ${describeNode(getNode(data.id))}` });
      } else if (data.source === INCREMENTAL_SOURCE.Input) {
        const previous = rows.actions[rows.actions.length - 1];
        if (previous?.input === data.id && offsetMs - previous.offsetMs < 3000) previous.offsetMs = offsetMs;
        else rows.actions.push({ offsetMs, input: data.id, label: `Typed in ${describeNode(getNode(data.id))} (value hidden)` });
      } else if (data.source === INCREMENTAL_SOURCE.Scroll && offsetMs - lastScroll > 1500) {
        lastScroll = offsetMs;
        rows.actions.push({ offsetMs, label: "Scrolled" });
      } else if (data.source === INCREMENTAL_SOURCE.ViewportResize) {
        rows.actions.push({ offsetMs, label: `Resized the window to ${data.width}×${data.height}` });
      }
    }
  }
  return rows;
}

/**
 * Plays an rrweb replay in a large dialog above the page, with its console, network, and action
 * timelines. Every row seeks the replay. Nothing on the live page is touched.
 */
export default function ReplayPlayer({ replay, media, kit, onClose, embedded = false }) {
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
      const index = indexSerializedNodes(events, EVENT_TYPE);
      setTimeline(buildTimeline(events, (id) => index.get(id), kit));
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
                      <span className={`tm-replay-row tm-replay-row--${row.outcome === "successful" ? "ok" : "error"}`}>
                        <strong>{row.method} {row.status || "—"}</strong> {row.url}
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
