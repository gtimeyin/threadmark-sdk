import type {
  ThreadmarkCaptureEnvironment,
  ThreadmarkDeviceInfo,
  ThreadmarkReplayCapture,
  ThreadmarkSessionReplayOptions,
  ThreadmarkVideoCapture,
} from "./index.js";

export { createFeedbackPayload } from "./index.js";

export interface ReplayEvent {
  type: number;
  timestamp: number;
  data?: unknown;
}

export declare const EVENT_TYPE: Readonly<{ FullSnapshot: 2; IncrementalSnapshot: 3; Meta: 4; Custom: 5 }>;
export declare const INCREMENTAL_SOURCE: Readonly<{ MouseInteraction: 2; Scroll: 3; ViewportResize: 4; Input: 5 }>;
export declare const MOUSE_INTERACTION: Readonly<{ Click: 2; DblClick: 4; TouchEnd: 9 }>;
export declare const REPLAY_CONSOLE_EVENT: "threadmark.console";
export declare const REPLAY_NETWORK_EVENT: "threadmark.network";
export declare const REPLAY_SOCKET_EVENT: "threadmark.websocket";
export declare const REPLAY_TIMING_EVENT: "threadmark.timing";

export declare function sanitizeRoute(value: unknown): string;
export declare function normalizeCaptureEnvironment(value: unknown): ThreadmarkCaptureEnvironment | undefined;
export declare function loadClientHints(windowRef?: Window): Promise<Record<string, unknown> | null>;
export declare function readDeviceInfo(windowRef?: Window, hints?: Record<string, unknown> | null): ThreadmarkDeviceInfo | null;
export declare function decodeReplayEvents(blob?: Blob | null): Promise<ReplayEvent[]>;
export declare function summarizeReplay(events: readonly ReplayEvent[]): ThreadmarkReplayCapture["summary"];
export declare function sanitizeReplayUrl(raw: unknown, base?: string): string;
export declare function scrubConsoleText(text: unknown, base?: string): string;
export declare function networkOutcome(status?: number, failedToSend?: boolean, graphqlFailed?: boolean): "transport_failure" | "incomplete" | "server_error" | "client_error" | "successful";

export declare function startSessionReplay(options?: {
  windowRef?: Window;
  bufferMs?: number;
  blockSelectors?: string[];
  maskTextSelectors?: string[];
  network?: ThreadmarkSessionReplayOptions["network"];
  canvas?: ThreadmarkSessionReplayOptions["canvas"];
  onError?: (error: Error) => void;
  loadRecorder?: () => Promise<(options: {
    emit(event: ReplayEvent, isCheckout?: boolean): void;
  }) => (() => void) | undefined>;
}): Promise<{
  hold(): void;
  release(): void;
  configure(options?: { network?: ThreadmarkSessionReplayOptions["network"] }): void;
  capture(): Promise<ThreadmarkReplayCapture | null>;
  stop(): void;
}>;

export interface ReplayNetworkRow {
  at: number;
  offsetMs: number;
  type: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  outcome: string;
  graphql?: { name?: string; type?: string; [key: string]: unknown };
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  bodiesNotKept?: string;
  timing: {
    phases: Record<string, number> | null;
    durationMs: number | null;
    transferBytes: number | null;
    protocol: string | null;
  } | null;
}

export declare const REQUEST_TYPE_GROUPS: readonly (readonly [key: string, label: string, types: readonly string[]])[];
export declare function requestTypeGroup(row?: Pick<ReplayNetworkRow, "type"> | null): string;
export declare function graphqlLabel(row?: Pick<ReplayNetworkRow, "graphql"> | null): string | null;
export declare function isFailedRequest(row: Pick<ReplayNetworkRow, "outcome">): boolean;
export declare function buildReplayTimeline(events: readonly ReplayEvent[], kit: {
  EVENT_TYPE: typeof EVENT_TYPE;
  INCREMENTAL_SOURCE: typeof INCREMENTAL_SOURCE;
  MOUSE_INTERACTION: typeof MOUSE_INTERACTION;
  REPLAY_CONSOLE_EVENT: string;
  REPLAY_NETWORK_EVENT: string;
  REPLAY_SOCKET_EVENT?: string;
  REPLAY_TIMING_EVENT?: string;
}): {
  start: number;
  console: { at: number; offsetMs: number; level: string; message: string; detail: string }[];
  network: ReplayNetworkRow[];
  actions: { at: number; offsetMs: number; kind: string; label: string; input?: number }[];
};
export declare function createCanvasPainter(events: readonly ReplayEvent[], options?: {
  cacheSize?: number;
  clock?: () => number;
  decode?: (frame: { base64: string; type: string }) => Promise<ImageBitmap>;
}): {
  readonly size: number;
  paint(replayer: {
    getMetaData?(): { startTime: number };
    getCurrentTime(): number;
    getMirror?(): { getNode(id: number): unknown };
  }): void;
  reset(): void;
  destroy(): void;
};

export declare const DEFAULT_VIDEO_MAX_DURATION_MS: number;
export declare const MAX_VIDEO_DURATION_MS: number;
export declare const TAB_VIDEO_BITS_PER_SECOND: number;
export declare function detectVideoSupport(windowRef?: Window): { tab: boolean; voice: boolean };
export declare function formatClock(ms: number): string;
export declare function openMicrophoneStream(mediaDevices?: MediaDevices): Promise<MediaStream>;
export declare function openScreenStream(mediaDevices?: MediaDevices): Promise<MediaStream>;
export declare function openTabStream(mediaDevices?: MediaDevices): Promise<MediaStream>;
export declare function stopStream(stream?: MediaStream | null): void;
export declare function videoOffsetAt(timestamp: number, video?: Pick<ThreadmarkVideoCapture, "startedAt" | "pauses" | "durationMs"> | null): number | null;
export declare function readRecordingMetadata(blob?: Blob | null, options?: {
  fallbackDurationMs?: number;
  documentRef?: Document;
}): Promise<{ durationMs: number; width: number; height: number }>;
export declare function createRecordingClock(now?: () => number): {
  elapsed(): number;
  pause(): void;
  resume(): void;
  reset(): void;
  readonly paused: boolean;
  readonly pauses: { offsetMs: number; durationMs: number }[];
};
export declare function createRecorderSession(options: {
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  videoBitsPerSecond?: number;
  RecorderClass?: typeof MediaRecorder;
  onUnexpectedStop?: () => void;
}): {
  readonly mimeType: string;
  pause(): void;
  resume(): void;
  restart(): void;
  discard(): void;
  stop(): Promise<Blob | null>;
};
