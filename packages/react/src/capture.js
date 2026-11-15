// Shared with the platform recorder, dashboard, and MCP server. Importing this entry starts no capture.
export { createFeedbackPayload, sanitizeRoute } from "./core.js";
export { normalizeCaptureEnvironment } from "./captureEnvironment.js";
export { loadClientHints, readDeviceInfo } from "./deviceInfo.js";
export { createCanvasPainter } from "./canvasReplay.js";
export { REQUEST_TYPE_GROUPS, buildReplayTimeline, graphqlLabel, isFailedRequest, requestTypeGroup } from "./replayTimeline.js";
export {
  EVENT_TYPE,
  INCREMENTAL_SOURCE,
  MOUSE_INTERACTION,
  REPLAY_CONSOLE_EVENT,
  REPLAY_NETWORK_EVENT,
  REPLAY_SOCKET_EVENT,
  REPLAY_TIMING_EVENT,
  decodeReplayEvents,
  networkOutcome,
  sanitizeReplayUrl,
  scrubConsoleText,
  startSessionReplay,
  summarizeReplay,
} from "./sessionReplay.js";
export {
  DEFAULT_VIDEO_MAX_DURATION_MS,
  MAX_VIDEO_DURATION_MS,
  TAB_VIDEO_BITS_PER_SECOND,
  createRecorderSession,
  createRecordingClock,
  detectVideoSupport,
  formatClock,
  openMicrophoneStream,
  openScreenStream,
  openTabStream,
  readRecordingMetadata,
  stopStream,
  videoOffsetAt,
} from "./videoRecording.js";
