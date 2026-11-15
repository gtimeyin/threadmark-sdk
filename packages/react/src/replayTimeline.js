// Console, network, and action rows read from a stored rrweb replay, each with its clock time (`at`) and its
// offset from the replay's first page (`offsetMs`). Shared by the SDK's playback dialog and the hosted
// dashboard's investigation view, so both describe a recording the same way. Typed text is never shown:
// input events only say which field changed.
//
// rrweb's event numbers and Threadmark's custom event tags come in through `kit` (from sessionReplay.js), so
// this module stays out of the SDK's entry chunk when the playback dialog loads it lazily.

// rrweb serialized node types.
const ELEMENT_NODE = 2;
const TEXT_NODE = 3;
const MUTATION_SOURCE = 0;

/** id → serialized element, read from snapshots and added nodes, so names never depend on playback state. */
export function indexSerializedNodes(events, EVENT_TYPE) {
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

/** `button “Pay $49”`, or `<div>` when an element has no name. */
export function describeSerializedNode(node) {
  if (!node || node.type !== ELEMENT_NODE) return "the page";
  const tag = String(node.tagName || "element").toLowerCase();
  const attributes = node.attributes || {};
  const label = attributes["aria-label"] || attributes.title || attributes.alt || attributes.placeholder || serializedText(node);
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

/** The clock time of the replay's first page, which rrweb plays from. */
export function replayStart(events, EVENT_TYPE) {
  return events.find((event) => event.type === EVENT_TYPE.Meta)?.timestamp || events[0]?.timestamp || 0;
}

const CLEAN_CLOSE = [1000, 1001, 1005];

/** A WebSocket connection's row from its events: opened, messages both ways, and how it closed. */
function socketRow(sockets, network, payload, at, start) {
  const id = String(payload.socket || "");
  let socket = sockets.get(id);
  if (!socket && payload.event !== "connecting") return;
  if (payload.event === "connecting" || !socket) {
    socket = { at, offsetMs: Math.max(0, at - start), type: "websocket", method: "WS", url: String(payload.url || ""), status: 0, durationMs: 0, outcome: "incomplete", messages: [], sent: 0, received: 0, skipped: 0 };
    sockets.set(id, socket);
    network.push(socket);
    return;
  }
  socket.durationMs = Math.max(0, at - socket.at);
  if (payload.event === "open") {
    socket.status = 101;
    socket.outcome = "open";
    if (payload.protocol) socket.protocol = String(payload.protocol);
  } else if (payload.event === "message") {
    const direction = payload.direction === "sent" ? "sent" : "received";
    socket[direction] += 1;
    socket.skipped += Number(payload.skipped) || 0;
    socket.messages.push({ at, offsetMs: Math.max(0, at - start), direction, size: Math.max(0, Number(payload.size) || 0), ...(typeof payload.data === "string" ? { data: payload.data } : {}) });
  } else if (payload.event === "error") {
    socket.error = true;
  } else if (payload.event === "close") {
    socket.closeCode = Number(payload.code) || 0;
    socket.outcome = socket.status !== 101 ? "transport_failure"
      : CLEAN_CLOSE.includes(socket.closeCode) && !socket.error ? "closed" : "socket_closed";
  }
}

/**
 * `{ start, console, network, actions }` for a replay. Network rows are placed when the request started.
 * Requests carry a `type`: fetch, xhr, websocket, or a page resource (js, css, img, font, media, doc, other).
 * Scrolls are thinned to one row every 1.5 seconds and repeated input on one field folds into one row.
 */
export function buildReplayTimeline(events, kit) {
  const { EVENT_TYPE, INCREMENTAL_SOURCE, MOUSE_INTERACTION, REPLAY_CONSOLE_EVENT, REPLAY_NETWORK_EVENT, REPLAY_TIMING_EVENT, REPLAY_SOCKET_EVENT } = kit;
  const timings = [];
  const sockets = new Map();
  const list = Array.isArray(events) ? events : [];
  const index = indexSerializedNodes(list, EVENT_TYPE);
  const describe = (id) => describeSerializedNode(index.get(id));
  const start = replayStart(list, EVENT_TYPE);
  const timeline = { start, console: [], network: [], actions: [] };
  const row = (at) => ({ at, offsetMs: Math.max(0, at - start) });
  let lastScroll = -Infinity;
  let firstMeta = true;
  for (const event of list) {
    const at = Number(event.timestamp) || start;
    if (event.type === EVENT_TYPE.Meta) {
      if (!firstMeta) timeline.actions.push({ ...row(at), kind: "navigation", label: `Navigated to ${pathOf(event.data?.href)}` });
      firstMeta = false;
    } else if (event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_CONSOLE_EVENT) {
      const entry = event.data.payload || {};
      timeline.console.push({
        ...row(at),
        level: ["error", "warn", "info", "log", "debug"].includes(entry.level) ? entry.level : "log",
        message: String(entry.message || ""),
        detail: String(entry.stack || entry.source || ""),
      });
    } else if (event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_NETWORK_EVENT) {
      const entry = event.data.payload || {};
      const durationMs = Math.max(0, Number(entry.durationMs) || 0);
      const startedAt = Number.isFinite(entry.startedAt) ? entry.startedAt : at - durationMs;
      timeline.network.push({
        ...row(startedAt),
        type: ["xhr", ...RESOURCE_TYPES].includes(entry.type) ? entry.type : "fetch",
        method: String(entry.method || "GET"),
        url: String(entry.url || ""),
        status: Number(entry.status) || 0,
        durationMs,
        outcome: String(entry.outcome || "incomplete"),
        ...(entry.graphql && typeof entry.graphql === "object" ? { graphql: entry.graphql } : {}),
        ...(entry.request && typeof entry.request === "object" ? { request: entry.request } : {}),
        ...(entry.response && typeof entry.response === "object" ? { response: entry.response } : {}),
        ...(typeof entry.bodies === "string" ? { bodiesNotKept: entry.bodies } : {}),
        timing: null,
      });
    } else if (REPLAY_TIMING_EVENT && event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_TIMING_EVENT) {
      const entry = event.data.payload || {};
      if (entry.url && Number.isFinite(entry.startedAt)) timings.push(entry);
    } else if (REPLAY_SOCKET_EVENT && event.type === EVENT_TYPE.Custom && event.data?.tag === REPLAY_SOCKET_EVENT) {
      socketRow(sockets, timeline.network, event.data.payload || {}, at, start);
    } else if (event.type === EVENT_TYPE.IncrementalSnapshot) {
      const data = event.data || {};
      if (data.source === INCREMENTAL_SOURCE.MouseInteraction
        && [MOUSE_INTERACTION.Click, MOUSE_INTERACTION.DblClick, MOUSE_INTERACTION.TouchEnd].includes(data.type)) {
        timeline.actions.push({ ...row(at), kind: "click", label: `${data.type === MOUSE_INTERACTION.DblClick ? "Double-clicked" : data.type === MOUSE_INTERACTION.TouchEnd ? "Tapped" : "Clicked"} ${describe(data.id)}` });
      } else if (data.source === INCREMENTAL_SOURCE.Input) {
        const previous = timeline.actions[timeline.actions.length - 1];
        if (previous?.input === data.id && at - previous.at < 3000) Object.assign(previous, row(at));
        else timeline.actions.push({ ...row(at), kind: "input", input: data.id, label: `Typed in ${describe(data.id)} (value hidden)` });
      } else if (data.source === INCREMENTAL_SOURCE.Scroll && at - lastScroll > 1500) {
        lastScroll = at;
        timeline.actions.push({ ...row(at), kind: "scroll", label: "Scrolled" });
      } else if (data.source === INCREMENTAL_SOURCE.ViewportResize) {
        timeline.actions.push({ ...row(at), kind: "resize", label: `Resized the window to ${data.width}×${data.height}` });
      }
    }
  }
  // Sockets still open when the recording ended last until then.
  const end = Number(list[list.length - 1]?.timestamp) || start;
  for (const socket of sockets.values()) {
    if (socket.outcome === "open" || socket.outcome === "incomplete") socket.durationMs = Math.max(socket.durationMs, end - socket.at);
  }
  // Each request takes the browser's timing for the same address that started closest to it (within 1.5 s).
  // The page's own resources (scripts, stylesheets, images, fonts) become rows of their own.
  for (const timing of timings) {
    if (typeof timing.resource === "string") {
      const status = Number(timing.status) || 0;
      timeline.network.push({
        ...row(timing.startedAt),
        type: RESOURCE_TYPES.includes(timing.resource) ? timing.resource : "other",
        method: "GET",
        url: String(timing.url),
        status,
        durationMs: Math.max(0, Number(timing.durationMs) || 0),
        outcome: status >= 500 ? "server_error" : status >= 400 ? "client_error" : "successful",
        timing: {
          phases: timing.phases && typeof timing.phases === "object" ? timing.phases : null,
          durationMs: Number(timing.durationMs) || null,
          transferBytes: Number(timing.transferBytes) || null,
          protocol: typeof timing.protocol === "string" ? timing.protocol : null,
        },
      });
      continue;
    }
    let best = null;
    for (const request of timeline.network) {
      if (request.timing || request.url !== timing.url) continue;
      const gap = Math.abs(request.at - timing.startedAt);
      if (gap <= 1500 && (!best || gap < best.gap)) best = { request, gap };
    }
    if (best) {
      best.request.timing = {
        phases: timing.phases && typeof timing.phases === "object" ? timing.phases : null,
        durationMs: Number(timing.durationMs) || null,
        transferBytes: Number(timing.transferBytes) || null,
        protocol: typeof timing.protocol === "string" ? timing.protocol : null,
      };
    }
  }
  timeline.network.sort((a, b) => a.at - b.at);
  return timeline;
}

const RESOURCE_TYPES = ["js", "css", "img", "font", "media", "doc", "other"];

/** The Network tab's type filters, in order: each request type belongs to one. */
export const REQUEST_TYPE_GROUPS = Object.freeze([
  ["fetch", "Fetch/XHR", ["fetch", "xhr"]],
  ["js", "JS", ["js"]],
  ["css", "CSS", ["css"]],
  ["img", "Img", ["img"]],
  ["font", "Font", ["font"]],
  ["media", "Media", ["media"]],
  ["doc", "Doc", ["doc"]],
  ["websocket", "WS", ["websocket"]],
  ["other", "Other", ["other"]],
]);

/** The type filter a request belongs to. Requests from before types were recorded are Fetch/XHR. */
export function requestTypeGroup(row) {
  const type = row?.type || "fetch";
  return REQUEST_TYPE_GROUPS.find(([, , types]) => types.includes(type))?.[0] || "other";
}

/** "query GetCart" for a GraphQL request with a named operation, else null. */
export function graphqlLabel(row) {
  return row?.graphql?.name ? `${row.graphql.type || "query"} ${row.graphql.name}` : null;
}

/** True for a request worth flagging: an error status, GraphQL errors, a failure to send, or no response. */
export function isFailedRequest(row) {
  return !["successful", "open", "closed"].includes(row.outcome);
}
