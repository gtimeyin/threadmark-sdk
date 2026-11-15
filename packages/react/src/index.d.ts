import type { ReactElement, ReactPortal } from "react";

export type ThreadmarkCaptureKind = "text" | "element" | "multi" | "region" | "screenshot" | "interaction" | "video";
export type ThreadmarkStatus = "disabled" | "ready" | "selecting" | "selected" | "submitting" | "submitted" | "error";
export type ThreadmarkPageVersionState = "ready" | "building" | "failed" | "unavailable";

export interface ThreadmarkPageVersion {
  /** Stable deployment identifier, such as VERCEL_DEPLOYMENT_ID. */
  id: string;
  /** Immutable deployment or build identifier associated with feedback. */
  buildId?: string;
  /** Base URL for the immutable deployment. Threadmark adds the current page route. */
  url: string;
  label?: string;
  branch?: string;
  commitSha?: string;
  createdAt?: string;
  environment?: string;
  state?: ThreadmarkPageVersionState;
  feedbackCount?: number;
  current?: boolean;
}

export interface ThreadmarkPageVersionContext {
  route: string;
  url: string;
}

export interface ThreadmarkTargetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ThreadmarkTargetDescriptor {
  kind?: "text" | "region" | "screenshot";
  tagName: string;
  role: string;
  accessibleName: string;
  visibleText: string;
  selectedText?: string;
  bounds: ThreadmarkTargetBounds;
  locatorCandidates: {
    stableId: string | null;
    id: string | null;
    domPath: string;
  };
  viewportBounds?: ThreadmarkTargetBounds;
  pageBounds?: ThreadmarkTargetBounds;
  normalizedBounds?: ThreadmarkTargetBounds;
  viewport?: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
    visualScale: number;
  };
  route: string;
  capturedAt: string;
}

export interface ThreadmarkSnapshotMetadata {
  id: string;
  kind: "snapshot";
  source: "dom-renderer";
  quality: "captured" | "degraded" | "unavailable";
  mimeType: string | null;
  byteSize: number;
  pixelSize: { width: number; height: number };
  capture?: {
    capturedAt: string;
    route: string;
    buildId: string | null;
    bounds?: ThreadmarkTargetBounds;
    /** Pin position normalized to the screenshot, from 0 to 1. */
    pin: { x: number; y: number };
  };
  redactionCount: number;
  warnings: string[];
}

/** A recorded video or voice clip. The Blob itself travels in `ThreadmarkFeedbackContext.evidence`. */
export interface ThreadmarkRecordingMetadata {
  id: string;
  kind: "recording";
  source: "media-recorder";
  quality: "captured" | "unavailable";
  mimeType: "video/webm" | "video/mp4" | "audio/webm" | "audio/mp4" | "audio/ogg" | null;
  byteSize: number;
  durationMs: number;
  pixelSize: { width: number; height: number };
  hasAudio: boolean;
  hasVideo: boolean;
}

/** An rrweb session replay (gzip or plain JSON events). The Blob travels in `ThreadmarkFeedbackContext.evidence`. */
export interface ThreadmarkReplayMetadata {
  id: string;
  kind: "replay";
  source: "rrweb";
  quality: "captured" | "unavailable";
  mimeType: "application/gzip" | "application/json" | null;
  byteSize: number;
  durationMs: number;
  eventCount: number;
}

export type ThreadmarkEvidenceMetadata = ThreadmarkSnapshotMetadata | ThreadmarkRecordingMetadata | ThreadmarkReplayMetadata;

/** What led to a comment, summarized so agents can act without opening the recording. */
export interface ThreadmarkReplaySummary {
  version: 1;
  /** Id of the `replay` evidence item whose Blob holds the rrweb events. */
  evidenceId: string;
  startedAt: string;
  durationMs: number;
  eventCount: number;
  viewport: { width: number; height: number };
  console: {
    errors: number;
    warnings: number;
    entries: Array<{ offsetMs: number; level: "error" | "warn"; message: string }>;
  };
  network: {
    requests: number;
    failed: number;
    /**
     * Failed requests only, including GraphQL responses that carried errors with HTTP 200. URLs keep origin,
     * path, and query names; never values, bodies, or headers.
     */
    entries: Array<{
      offsetMs: number;
      method: string;
      url: string;
      status: number;
      durationMs: number;
      outcome: "successful" | "client_error" | "server_error" | "graphql_error" | "transport_failure" | "incomplete";
      /** For GraphQL: `"query GetCart"`. */
      operation?: string;
      /** For GraphQL errors: their `extensions.code` values. */
      errorCodes?: string[];
    }>;
  };
  actions: { clicks: number; inputs: number; navigations: number };
}

export interface ThreadmarkReplayCapture {
  blob: Blob;
  summary: Omit<ThreadmarkReplaySummary, "version" | "evidenceId" | "startedAt">;
  startedAt: string;
}

export interface ThreadmarkSessionReplayOptions {
  /** How much history to keep before review starts, in milliseconds. Default 30 000 (5 000–120 000). */
  bufferMs?: number;
  /**
   * Replaces the built-in recorder, for example with a browser extension that records in the page's
   * own context. `hold` runs when review starts and `release` when it ends.
   */
  provider?:
    | (() => Promise<ThreadmarkReplayCapture | null>)
    | {
      capture: () => Promise<ThreadmarkReplayCapture | null>;
      hold?: () => void;
      release?: () => void;
      /** Receives changed `network` options while recording. */
      configure?: (options: { network: { bodies: boolean } }) => void;
    };
  /**
   * What is kept from requests besides method, path, status, timing, and GraphQL operation names and error
   * codes (always kept). `bodies: true` also keeps request and response bodies and a few safe headers,
   * filtered: JSON, form, and text only; credential-named fields redacted; emails, card numbers, JWTs, and
   * key-shaped strings scrubbed; nothing from sign-in, token, or password endpoints; at most 16,000
   * characters each. `sanitize` sees each request last and returns it (edited) or null to drop its bodies; if
   * it throws, they are dropped.
   */
  network?: {
    bodies?: boolean;
    sanitize?: (entry: ThreadmarkNetworkEntry) => ThreadmarkNetworkEntry | null;
  };
  /** Opt in to bounded canvas image sampling. Pixels inside blocked or masked regions are excluded. */
  canvas?: boolean | { fps?: number; quality?: number };
}

/** A request as `sessionReplay.network.sanitize` sees it. Header names are lowercase. */
export interface ThreadmarkNetworkEntry {
  method: string;
  /** Origin, path, and query names; query values are already removed. */
  url: string;
  status: number;
  request: { headers: Record<string, string>; body: string | null };
  response: { headers: Record<string, string>; body: string | null };
}

/**
 * Evidence travels as a local Blob when it was just captured. Hosts that already stored it may pass
 * `{ id, url }` instead (an https URL such as a signed storage URL); Threadmark displays the URL and
 * hands it back unchanged on later saves.
 */
export type ThreadmarkEvidenceSource = { id: string; blob: Blob } | { id: string; url: string };

export interface ThreadmarkFeedbackContext {
  evidence: ThreadmarkEvidenceSource[];
  /** Current results when the feedback is a poll (supplied by the host). */
  poll?: ThreadmarkPollResults;
}

/** Passed to `onFeedbackCreate` with a new comment. */
export interface ThreadmarkSaving {
  /** Report how much of one evidence file has been uploaded; call it as often as the upload allows. */
  onUploadProgress: (progress: { evidenceId: string; sentBytes: number; totalBytes: number }) => void;
}

/**
 * A poll attached to a comment; option ids stay stable. `{ kind: "question" }` comes only from comments
 * saved before beta.15 and still shows a "Question" label; new comments never carry it.
 */
export type ThreadmarkAsk =
  | { kind: "question" }
  | { kind: "poll"; options: { id: string; label: string }[]; multiple: boolean };

export interface ThreadmarkPollResults {
  /** Votes per option id. */
  counts: Record<string, number>;
  /** How many people voted. */
  total: number;
  /** The current reviewer's chosen option ids. */
  mine: string[];
  voters?: { reviewer: ThreadmarkReviewer; optionIds: string[] }[];
}

/** Where a next step came from: one thread, with the words that led to it. */
export interface ThreadmarkNextStepSource {
  feedbackId: string;
  quote?: string;
  /** The thread's page path; a source on another page opens there through its thread link. */
  route?: string | null;
  author?: string | null;
  status?: "open" | "resolved";
}

/** One item of the host's next steps checklist. */
export interface ThreadmarkNextStep {
  id: string;
  title: string;
  notes?: string;
  tag?: "bug" | "polish" | "copy" | "idea" | "question" | null;
  /** Written by the host's AI from feedback, or added by a person. */
  source?: "ai" | "person";
  completed: boolean;
  completedVia?: "person" | "agent" | "resolved" | null;
  completedBy?: { displayName: string } | null;
  completedAt?: string | null;
  sources?: ThreadmarkNextStepSource[];
}

export interface ThreadmarkNextSteps {
  steps: readonly ThreadmarkNextStep[];
  /** Whether the list is current: shown above it. */
  status?: {
    state?: "ready" | "pending" | "generating" | "failed" | "off";
    generatedAt?: string | null;
    error?: string | null;
    openThreads?: number | null;
  };
  /** `false` shows the checklist read-only. Defaults to true. */
  canEdit?: boolean;
}

export type ThreadmarkInteractionEvent =
  | { type: "click"; offsetMs: number; targetIndex?: number; button: number; x?: number; y?: number }
  | { type: "input"; offsetMs: number; targetIndex?: number; inputType: string }
  | { type: "keydown"; offsetMs: number; targetIndex?: number; key?: string; modifiers?: Array<"alt" | "control" | "meta" | "shift"> }
  | { type: "scroll"; offsetMs: number; targetIndex?: number; scrollX: number; scrollY: number }
  | { type: "submit"; offsetMs: number; targetIndex?: number }
  | { type: "navigation"; offsetMs: number; route: string };

export interface ThreadmarkInteractionCapture {
  version: 1;
  startedAt: string;
  durationMs: number;
  /** Privacy-safe interaction events. Input values and printable keystrokes are never included. */
  events: ThreadmarkInteractionEvent[];
}

/**
 * Loom-style video feedback. `tab` records the current tab with voice and an optional camera bubble;
 * `voice` records voice (and camera) and replays the pointer path over the live page.
 */
export interface ThreadmarkVideoCapture {
  version: 1;
  /** `screen` is a recording of any screen or window, sent through a recording request. */
  mode: "tab" | "voice" | "screen";
  startedAt: string;
  durationMs: number;
  /** Id of the `recording` evidence item whose Blob holds the media. */
  evidenceId: string;
  camera: boolean;
  microphone: boolean;
  viewport: { width: number; height: number };
  pointer: {
    /** `[offsetMs, clientX, clientY]` in CSS pixels, sampled at most every 50ms. */
    samples: Array<[number, number, number]>;
    /** `[offsetMs, scrollX, scrollY]` window scroll positions. */
    scrolls: Array<[number, number, number]>;
  };
  /** The same privacy-safe step timeline as interaction captures, timed against the recording. */
  events: ThreadmarkInteractionEvent[];
  /**
   * Where the reviewer paused (in recording time) and for how long, so clock-time activity such as console
   * and network entries can be placed on the video. Absent when the recording was never paused.
   */
  pauses?: Array<{ offsetMs: number; durationMs: number }>;
  /**
   * Strokes the reviewer drew on the page while recording (they fade after 3 seconds): where each began in the
   * recording, then `[ms into the stroke, clientX, clientY]` points. Voice recordings replay them over the page.
   */
  drawings?: Array<{ offsetMs: number; points: Array<[number, number, number]> }>;
  /** The title from the review step (also the comment's text). */
  title?: string;
  /** Moments the reviewer marked with M while recording. They show as ticks on the trim bar and as chapters. */
  moments?: Array<{ offsetMs: number }>;
  /**
   * The part the reviewer kept in the review step. The file itself is not cut: playback starts and stops here,
   * and a host that re-encodes can trim to it. Absent when the whole recording was kept.
   */
  trim?: { startMs: number; endMs: number };
  /** Written by the host after posting, e.g. by a transcription service. See {@link ThreadmarkVideoNotes}. */
  notes?: ThreadmarkVideoNotes;
}

/** A line of a video's summary, transcript or chapters; clicking it seeks the recording. */
export interface ThreadmarkVideoNoteLine {
  offsetMs: number;
  text: string;
}

/**
 * What the host wrote about a posted video (board 02, 7f-7g). Threadmark doesn't transcribe: send the record
 * back through `annotations` with `feedback.video.notes` set. `processing` shows "Writing the summary and
 * transcript…" until the lines arrive. `silent` says the summary came from the screen, not speech.
 */
export interface ThreadmarkVideoNotes {
  status?: "processing" | "ready" | "failed";
  summary?: ThreadmarkVideoNoteLine[];
  transcript?: ThreadmarkVideoNoteLine[];
  chapters?: ThreadmarkVideoNoteLine[];
  silent?: boolean;
}

/**
 * The reviewer's browser, operating system, device, screen, and settings when the comment was posted. Exact
 * versions and CPU architecture come from client hints in Chromium browsers. `network` is the browser's
 * own estimate (Chromium only, capped at 10 Mbps); nothing is measured.
 */
export interface ThreadmarkDeviceInfo {
  browser: { name: string; version: string };
  os: { name: string; version: string; architecture?: string };
  type: "desktop" | "mobile" | "tablet";
  model?: string;
  touch: boolean;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  language: string;
  timeZone: string;
  colorScheme: "light" | "dark";
  reducedMotion: boolean;
  forcedColors: boolean;
  network?: {
    effectiveType: "slow-2g" | "2g" | "3g" | "4g" | null;
    downlinkMbps: number | null;
    rttMs: number | null;
    saveData: boolean;
  };
}

/** JSON values allowed in `metadata`. */
export type ThreadmarkMetadataValue =
  | string
  | number
  | boolean
  | null
  | ThreadmarkMetadataValue[]
  | { [key: string]: ThreadmarkMetadataValue };

/** App context attached to a new comment: feature flags, app version, workspace, sanitized state. */
export type ThreadmarkMetadata = { [key: string]: ThreadmarkMetadataValue };

export interface ThreadmarkVideoRecordingOptions {
  /** Longest recording in milliseconds. Defaults to 5 minutes; clamped to 5 seconds–10 minutes. */
  maxDurationMs?: number;
  /** Seconds counted down after the tab is shared and before recording starts. Defaults to 3; 0–5. */
  countdownSeconds?: number;
}

export interface ThreadmarkReaction {
  emoji: "👍" | "❤️" | "🎉" | "👀" | "✅";
  reviewer: ThreadmarkReviewer;
}
export interface ThreadmarkReactionChange { messageId: string; emoji: ThreadmarkReaction["emoji"]; active: boolean; }

export interface ThreadmarkReply {
  reactions?: ThreadmarkReaction[];
  id: string;
  /** The feedback id for a root reply, or another reply id when responding in context. */
  parentId: string | null;
  comment: string;
  createdAt: string;
  updatedAt: string;
  author: ThreadmarkReviewer | null;
  lastEditedBy: ThreadmarkReviewer | null;
}

export interface ThreadmarkReviewer {
  /** Stable identifier from the host application's authenticated user record. */
  id: string;
  displayName: string;
  /** Public or same-origin avatar URL. Never include signed URLs or credentials. */
  avatarUrl?: string;
  /** Shown read-only in Your settings. */
  email?: string;
}

export interface ThreadmarkAnnotationRecord {
  feedback: ThreadmarkFeedback;
  context?: ThreadmarkFeedbackContext;
}

export interface ThreadmarkSelectionTarget extends Omit<
  ThreadmarkTargetDescriptor,
  "accessibleName" | "visibleText" | "locatorCandidates"
> {
  accessibleName: "";
  visibleText: "";
  selectedText?: "";
  locatorCandidates: {
    stableId: string | null;
    id: null;
    domPath: "";
  };
}

export interface ThreadmarkPinLocation {
  target: ThreadmarkTargetDescriptor;
  route: string;
  buildId: string | null;
  movedAt: string;
  movedBy: ThreadmarkReviewer | null;
}

export interface ThreadmarkWorkflow {
  status: "open" | "resolved";
  assignee?: ThreadmarkReviewer | null;
  mentions?: ThreadmarkReviewer[];
  history?: Array<{ action: "resolved" | "reopened" | "assigned" | "mentioned" | "verified" | "verification_failed";
    at: string; actor: ThreadmarkReviewer | null; buildId: string | null; assignee?: ThreadmarkReviewer | null }>;
}

/** Coarse, browser-reported capture context; never used for authorization. */
export interface ThreadmarkCaptureEnvironment {
  browser?: string;
  os?: string;
  device?: "mobile" | "tablet" | "desktop";
  viewport?: { width?: number; height?: number; devicePixelRatio?: number };
  connection?: { online?: boolean; effectiveType?: "slow-2g" | "2g" | "3g" | "4g"; downlinkMbps?: number; rttMs?: number };
}

export interface ThreadmarkFeedback {
  id: string;
  projectKey: string;
  environment: string;
  captureEnvironment?: ThreadmarkCaptureEnvironment;
  buildId: string | null;
  route: string;
  captureKind?: ThreadmarkCaptureKind;
  target: ThreadmarkTargetDescriptor;
  targets?: ThreadmarkTargetDescriptor[];
  evidence?: ThreadmarkEvidenceMetadata[];
  interaction?: ThreadmarkInteractionCapture;
  video?: ThreadmarkVideoCapture;
  replay?: ThreadmarkReplaySummary;
  ask?: ThreadmarkAsk;
  /** Set when the comment was left on a product-tour step in Tour mode. */
  tourStep?: { tourId: string; stepId: string };
  /** The reviewer's browser and device when the comment was posted, unless `deviceDetails` is false. */
  device?: ThreadmarkDeviceInfo;
  /** What the host's `metadata` returned when the comment was posted, cleaned and at most 10 KB. */
  metadata?: ThreadmarkMetadata;
  /** "ai" when it was posted from an AI review or Ask AI. The author is still the person who posted it. */
  source?: "ai" | "agent" | "ai_review";
  aiReview?: { reviewId: string; findingId: string };
  /** Where this comment was sent with Send to…, such as a GitHub issue. */
  links?: ThreadmarkCommentLink[];
  comment: string;
  reactions?: ThreadmarkReaction[];
  replies?: ThreadmarkReply[];
  createdAt: string;
  updatedAt: string;
  author: ThreadmarkReviewer | null;
  lastEditedBy: ThreadmarkReviewer | null;
  /** Current pin; original target and evidence remain unchanged. `null` when a supplied pin was invalid. */
  pin?: ThreadmarkPinLocation | null;
  pinHistory?: ThreadmarkPinLocation[];
  workflow?: ThreadmarkWorkflow;
}

export interface ThreadmarkError {
  code:
    | "missing_project_key"
    | "duplicate_instance"
    | "invalid_ignored_selector"
    | "snapshot_capture_failed"
    | "feedback_submit_failed"
    | "feedback_delete_failed"
    | "video_capture_failed"
    | "replay_unavailable"
    | "poll_vote_failed"
    | "next_step_failed"
    | "next_steps_copy_failed"
    | "metadata_failed"
    | (string & {});
  message: string;
}

export interface ThreadmarkPresenceMember {
  connectionId: string; member: ThreadmarkReviewer; route: string; buildId: string;
  updatedAt: number; cursor: { x: number; y: number; targetId?: string; offsetX?: number; offsetY?: number } | null;
}
export interface ThreadmarkPresenceTransport {
  connect(scope: { projectKey: string; route: string; buildId?: string }, onMembers: (members: ThreadmarkPresenceMember[]) => void,
    onError?: (error: unknown) => void): { publish(cursor: ThreadmarkPresenceMember['cursor']): void; close(): void };
}
export interface ThreadmarkPageReview {
  version: 1; route: string; buildId: string; truncated: boolean;
  findings: { rule: 'unnamed-control' | 'missing-alt' | 'heading-jump' | 'small-text' | 'horizontal-overflow'; target: ThreadmarkTargetDescriptor }[];
}
export interface ThreadmarkPageReviewContext {
  requestId: string; signal: AbortSignal;
  evidence: { id: string; rule: string; targetId: string; blob: Blob; metadata: ThreadmarkSnapshotMetadata }[];
}
export interface ThreadmarkPageReviewResult {
  records: ThreadmarkAnnotationRecord[]; annotations?: unknown[]; skipped?: number; evidenceFailures?: number; engine?: string;
}
export declare function collectPageReview(options?: { documentRef?: Document; route?: string; buildId?: string; ignoredSelectors?: string[]; signal?: AbortSignal }): Promise<ThreadmarkPageReview>;
/** Something in the Inbox for the current reviewer. Host-owned, like comments. */
export interface ThreadmarkNotification {
  id: string;
  kind?: "comment" | "video" | "reply" | "mention" | "resolved" | "reopened" | "reaction" | "assigned" | "question" | "poll" | "other";
  /** Without an avatarUrl, the Inbox uses the face of the member with the same id from `members`. */
  actor: { id?: string; displayName: string; avatarUrl?: string | null };
  /** The line shown in the Inbox, e.g. the reply text. */
  text: string;
  /** Opens this thread when it is on the current project. */
  annotationId?: string | null;
  route?: string | null;
  /** What on the page it is about, shown after the route, e.g. "Field · Company". */
  target?: string | null;
  createdAt?: string;
  read?: boolean;
}

/** What `onPageReview` receives: the screen as an outline and a masked screenshot. Nothing typed is included. */
export interface ThreadmarkPageReviewRequest {
  route: string;
  buildId: string | null;
  /** What the reviewer asked the review to look at, if anything. */
  focus: string | null;
  viewport: { width: number; height: number };
  /** Up to 150 visible elements; private areas, ignored selectors and form fields are left out. */
  elements: { id: string; tag: string; role?: string; name?: string; text?: string; box: { x: number; y: number; w: number; h: number }; fontSize?: number }[];
  /** What the built-in checks found, by outline id. */
  hints: { element: string; rule: ThreadmarkPageReview['findings'][number]['rule'] }[];
  /** Comments already on this page, so a review doesn't repeat them. */
  existing: { comment: string; element?: string }[];
  /** The viewport, masked like comment screenshots, as base64 without a data: prefix. */
  screenshot: { type: string; base64: string };
}
export interface ThreadmarkPageReviewFinding {
  id: string;
  /** The outline id the suggestion is about. */
  element: string;
  category: 'copy' | 'polish' | 'accessibility' | 'bug' | 'idea' | 'question';
  severity: 'high' | 'medium' | 'low';
  comment: string;
  reason?: string;
  state: 'suggested' | 'accepted' | 'dismissed';
}
export interface ThreadmarkAiPageReview {
  reviewId: string;
  status: 'processing' | 'done' | 'failed';
  error?: string | null;
  findings: ThreadmarkPageReviewFinding[];
}
export interface ThreadmarkProps {
  /**
   * @deprecated Retired in beta.16 and ignored (a console warning says so): it posted AI comments with no person
   * choosing them. Use `onAiReview`, where people keep or dismiss each suggestion.
   */
  onPageReviewRequested?: (input: ThreadmarkPageReview, context: ThreadmarkPageReviewContext) => Promise<ThreadmarkPageReviewResult>;
  /**
   * AI page review. Adds **Review this page** to the tools menu; the host sends the request to its reviewer (the
   * Supabase store's `reviewPage`) and returns the review. Suggestions stay in the reviewer's panel until they
   * keep one, which is posted through `onFeedbackCreate` with `source: "ai_review"` and `aiReview`. 
   */
  onPageReview?: (request: ThreadmarkPageReviewRequest, context: { signal: AbortSignal }) => Promise<ThreadmarkAiPageReview>;
  /** Records that the reviewer dismissed a suggestion (the Supabase store's `dismissPageReviewFinding`). */
  onPageReviewDismiss?: (finding: ThreadmarkPageReviewFinding, review: ThreadmarkAiPageReview) => void | Promise<unknown>;
  /** Optional, explicitly authorized presence transport; no network connection by default. */
  presence?: ThreadmarkPresenceTransport;
  /** Public project identifier; never use a secret token here. */
  projectKey: string;
  /** Authenticated reviewer supplied by the host application. Threadmark does not authenticate users. */
  reviewer?: ThreadmarkReviewer;
  /** Authorized review members used for assignment and mention choices. */
  reviewers?: readonly ThreadmarkReviewer[];
  /** Local hosts enable by default. Non-local review requires true plus an allowlisted hostname. */
  enabled?: boolean;
  /** Production is disabled in this first SDK even when enabled is true. */
  environment?: "local" | "development" | "preview" | "staging" | "production";
  buildId?: string;
  route?: string;
  allowedHosts?: readonly string[];
  ignoredSelectors?: readonly string[];
  styleNonce?: string;
  /** Authoritative records loaded by the host application or review service. */
  annotations?: readonly ThreadmarkAnnotationRecord[];
  /** Host-supplied deployment history. Fetch this on the server; never expose a Vercel token here. */
  pageVersions?: readonly ThreadmarkPageVersion[];
  /**
   * The host's next steps checklist (for example distilled from open feedback by its review service). When
   * supplied, the Feedback panel gets a **Next steps** tab; `null` or leaving it out hides the tab. Steps are
   * shown as plain text, never as HTML.
   */
  nextSteps?: ThreadmarkNextSteps | readonly ThreadmarkNextStep[] | null;
  /**
   * Your dashboard, as an http(s) URL or a same-site path. Adds **Open the dashboard** to the More menu.
   * Sending comments to trackers lives there, not in the overlay.
   */
  dashboardUrl?: string;
  /** Replies, mentions and other things for this reviewer. Passing an array shows Inbox on the Bar (with the unread count) and as a panel tab. Threadmark only shows these: your backend creates them and marks them read via `onNotificationsRead`. */
  notifications?: readonly ThreadmarkNotification[];
  /** Survey questions for this project. Ones on the current page show at the top of Activity. */
  surveys?: readonly import("./surveys.js").ThreadmarkSurvey[];
  /** Answers per survey id, e.g. from `summarizeSurveyAnswers`. `summary` is an optional one-line read. */
  surveyResults?: Readonly<Record<string, import("./surveys.js").ThreadmarkSurveyResults & { summary?: string }>>;
  /**
   * Loom-style video feedback with voice, an optional camera bubble, and a pointer track.
   * Enabled by default; `false` hides the recorder. The browser asks before any camera, microphone,
   * or tab capture starts.
   */
  videoRecording?: boolean | ThreadmarkVideoRecordingOptions;
  /**
   * Always-on session replay. Off by default. When on, Threadmark keeps an in-memory rrweb recording of
   * the page (inputs masked; sensitive, ignored, and Threadmark regions blocked) with console and network
   * activity, and offers the lead-up to each new comment as a removable attachment.
   */
  sessionReplay?: boolean | ThreadmarkSessionReplayOptions;
  /**
   * Records the reviewer's browser, OS, device, screen, language, time zone, display settings, and the
   * browser's network estimate on each new comment as `feedback.device`. On by default; `false` leaves it out,
   * along with `feedback.captureEnvironment`.
   */
  deviceDetails?: boolean;
  /**
   * App context for each new comment, such as feature flags, the app version, or the selected workspace.
   * A function is called when the comment is posted (it may return a promise; it gets 2 seconds), so the
   * values are current. The result must be a plain object that JSON can hold, at most 10 KB once cleaned.
   * Keys that name credentials (`password`, `apiKey`, `accessToken`, …) and credential-shaped strings are
   * replaced. If it throws or returns something unusable, the comment is posted without it and `onError`
   * reports `metadata_failed`.
   */
  metadata?: ThreadmarkMetadata | (() => ThreadmarkMetadata | null | undefined | Promise<ThreadmarkMetadata | null | undefined>);
  onReady?: () => void;
  onStatusChange?: (status: ThreadmarkStatus) => void;
  onOpenChange?: (open: boolean) => void;
  onTargetSelect?: (target: ThreadmarkSelectionTarget) => void;
  onSelectionChange?: (selection: {
    captureKind: ThreadmarkCaptureKind;
    targets: ThreadmarkSelectionTarget[];
  }) => void;
  /**
   * Upserts a thread: called for new comments and for edits, reply additions/removals, workflow changes and repins.
   * Return the host's authoritative record to replace the local one; its `feedback.id` may differ from the local ID.
   * When the returned record omits `context`, the local evidence is kept. For a new comment, a host that uploads
   * the evidence while saving can report it through `saving.onUploadProgress`, and the composer shows the share sent.
   */
  onFeedbackCreate?: (
    feedback: ThreadmarkFeedback,
    context: ThreadmarkFeedbackContext,
    saving?: ThreadmarkSaving,
  ) => void | ThreadmarkAnnotationRecord | Promise<void | ThreadmarkAnnotationRecord>;
  onFeedbackDelete?: (feedback: ThreadmarkFeedback) => void | Promise<void>;
  onFeedbackClear?: (feedback: readonly ThreadmarkFeedback[]) => void | Promise<void>;
  /** When supplied, the host handles navigation. Otherwise Threadmark opens the version URL in-page. */
  onPageVersionSelect?: (
    version: ThreadmarkPageVersion,
    context: ThreadmarkPageVersionContext,
  ) => void | Promise<void>;
  /** Explicitly copy an existing comment into another deployment. Threadmark never copies automatically. */
  onFeedbackCarryForward?: (
    feedback: ThreadmarkFeedback,
    version: ThreadmarkPageVersion,
    context: ThreadmarkPageVersionContext,
  ) => void | Promise<void>;
  /** Host authenticates the actor and returns authoritative reactions for the selected message. */
  onReactionChange?: (feedback: ThreadmarkFeedback, change: ThreadmarkReactionChange) => ThreadmarkReaction[] | Promise<ThreadmarkReaction[]>;
  /**
   * Stores the reviewer's vote on a poll (an empty list takes it back) and returns the poll's new results.
   * Providing it adds "Add a poll" to the new-comment composer; without it, posts are plain comments.
   */
  onPollVote?: (feedback: ThreadmarkFeedback, optionIds: string[]) => ThreadmarkPollResults | Promise<ThreadmarkPollResults>;
  /**
   * Stores a next step as done or not done. The tick shows at once; a rejection puts it back. Supply the
   * updated `nextSteps` afterwards. Without it, the checklist is read-only.
   */
  onNextStepDone?: (step: ThreadmarkNextStep, done: boolean) => void | Promise<void>;
  /**
   * Adds **Copy for agent** to the Next steps tab. Called from the click, with every step, so the host can
   * write its own prompt to the clipboard.
   */
  onNextStepsCopy?: (steps: readonly ThreadmarkNextStep[]) => void | Promise<void>;
  /** A notification was opened from the Inbox. Threadmark also opens its thread when it is on this project. */
  onNotificationOpen?: (notification: ThreadmarkNotification) => void;
  /** These notifications were shown in the Inbox; mark them read in your store. */
  onNotificationsRead?: (ids: readonly string[]) => void;
  /** Store a question published from Tools → Ask a question. Passing this shows the menu item. */
  onSurveyPublish?: (survey: import("./surveys.js").ThreadmarkSurvey) => void | Promise<void>;
  /** End a live survey from its results. */
  onSurveyEnd?: (surveyId: string) => void;
  /** Faces people can pick in Your settings. Your initial is always offered too. Threadmark ships no images. */
  faces?: readonly ThreadmarkFace[];
  /** The reviewer's notification choices, shown in Your settings. */
  notificationSettings?: ThreadmarkNotificationSettings;
  /** Shown in Your settings and Share, such as "Leave Parcel". */
  projectName?: string;
  /** Save a new name or face. Passing this shows the face picker and name field in Your settings. */
  onReviewerChange?: (change: { displayName: string; avatarUrl: string | null }) => void | Promise<void>;
  /** Save notification choices. Mentions and replies are always on. */
  onNotificationSettingsChange?: (settings: ThreadmarkNotificationSettings) => void | Promise<void>;
  /** Adds Leave project, with a confirm step. */
  onLeaveProject?: () => void | Promise<void>;
  /** Adds Sign out to the You menu under your face in the panel (board 08, 27a). Signing out is the host's own flow. */
  onSignOut?: () => void;
  /** The review link shown in Share with Copy link. */
  shareUrl?: string;
  /** What anyone with the link can do. */
  linkAccess?: ThreadmarkLinkAccess;
  /** People with access, shown in Share. */
  members?: readonly ThreadmarkMember[];
  /** Invite people by name or email. Passing this (or `shareUrl`) adds Share to the panel and the More menu. */
  /** `message` is the optional note typed under the invite (board 04, 15b). */
  onInvite?: (invite: { entries: string[]; role: ThreadmarkMemberRole; message?: string }) => void | Promise<void>;
  /**
   * People to suggest while typing a name or email in Share, usually your workspace (15b). `note` is the
   * small line after the email, such as "in Ojie's studio". A typed email nobody knows is offered as "new".
   */
  inviteSuggestions?: Array<{ id: string; displayName?: string; email?: string; avatarUrl?: string | null; note?: string }>;
  /** Change someone's access, or remove it. Passing this makes each person's access editable. */
  /** `role: "owner"` is offered only to an owner (Make owner, 15f). Remove access asks once first. */
  onMemberChange?: (memberId: string, change: { role: ThreadmarkMemberRole | "owner" } | { remove: true }) => void | Promise<void>;
  /** Send a pending invite again. */
  onResendInvite?: (memberId: string) => void | Promise<void>;
  /** Change what anyone with the link can do. */
  onLinkAccessChange?: (access: ThreadmarkLinkAccess) => void | Promise<void>;
  /**
   * Tours to edit in Tour mode (the same files you pass to <ThreadmarkTours>). Tour mode keeps
   * edits as drafts in the overlay; nothing is written anywhere until onTourSave or Copy file.
   */
  tours?: ThreadmarkTourFile[];
  /**
   * Adds "Save to code" to Tour mode. Receives the tour plus a suggested file name and its JSON
   * contents; write it to your repository (for example through a dev-server endpoint). Await the write;
   * a rejection keeps the draft and tells the reviewer it didn't save.
   */
  onTourSave?: (tour: ThreadmarkTourFile, file: { fileName: string; contents: string }) => void | { path?: string } | Promise<void | { path?: string }>;
  /** The coding AI the host has connected, shown in Save to code. Threadmark never edits code itself. */
  aiConnection?: { name: string; connected: boolean; detail?: string };
  /** Adds "Send to <AI>" to Save to code when `aiConnection.connected` is true. */
  onTourSendToAi?: (tour: ThreadmarkTourFile, file: { fileName: string; contents: string }) => void | Promise<void>;
  /** Adds Connect next to an AI that isn't connected; open your own connection flow. */
  onConnectAi?: () => void;
  /**
   * Adds "Ask AI to review this page" to the tools menu. Threadmark bundles no model: call yours, using
   * `page` (the built-in checks) and your own capture, and return findings. Call `report` to move the
   * progress count and to hand over findings as they come, so Stop can keep them. Nothing is posted until
   * a person chooses Post as comment or Post all.
   */
  onAiReview?: (request: {
    route: string;
    focus: readonly ("accessibility" | "copy" | "layout" | "design-system")[];
    page: ThreadmarkPageReview;
    signal: AbortSignal;
    report: (progress: { checked?: number; total?: number; finding?: ThreadmarkAiFinding }) => void;
  }) => Promise<{ findings: ThreadmarkAiFinding[]; summary?: string; checked?: number }>;
  /** Adds "Ask AI" (⌘K) to the composer for one element. Return up to three points and an optional fix. */
  onAskAi?: (request: { element: Element; label: string; route: string; question: string | null; history: readonly { question: string | null; points: string[]; fix?: string }[] }) =>
    Promise<{ points: string[]; fix?: string }>;
  /** A finding was dismissed, with why, so your AI can stop raising it. */
  onAiDismiss?: (finding: { id: string; category: string; title: string }, reason: "not-a-problem" | "already-known" | "wrong") => void;
  onError?: (error: ThreadmarkError) => void;
}

/** A tour as written in a .tour.json file. See threadmark-react/tours for the full type. */
export type ThreadmarkTourFile = {
  $schema?: string;
  id: string;
  title: string;
  steps: Array<{ id: string; target?: string; title: string; [field: string]: unknown }>;
  [field: string]: unknown;
};

export declare function Threadmark(props: ThreadmarkProps): ReactPortal | ReactElement | null;

/**
 * Tour mode's "Save to code" through the threadmark-react/vite plugin: pass it as `onTourSave`.
 * It sends a request only when Save to code is pressed, and only to this dev server.
 * Resolves with the project-relative path it wrote; rejects with the plugin's reason when it refuses.
 */
export declare function saveTourToDevServer(
  tour: ThreadmarkTourFile,
  file: { fileName: string; contents: string },
  options?: { endpoint?: string },
): Promise<{ ok: true; path: string }>;
export declare function threadmarkTarget(id: string): { "data-threadmark-id": string };
export declare function isLocalHostname(hostname: string): boolean;
export declare function matchesAllowedHost(hostname: string, allowedHosts?: readonly string[]): boolean;
export declare function isThreadmarkEnabled(options?: {
  enabled?: boolean;
  environment?: string;
  hostname?: string;
  allowedHosts?: readonly string[];
}): boolean;
export declare function createFeedbackPayload(options: {
  id?: string;
  now?: string;
  updatedAt?: string;
  projectKey: string;
  environment: string;
  captureEnvironment?: ThreadmarkCaptureEnvironment;
  buildId?: string | null;
  route: string;
  target: ThreadmarkTargetDescriptor;
  targets?: ThreadmarkTargetDescriptor[];
  captureKind?: ThreadmarkCaptureKind;
  evidence?: ThreadmarkEvidenceMetadata[];
  interaction?: ThreadmarkInteractionCapture;
  video?: ThreadmarkVideoCapture;
  replay?: ThreadmarkReplaySummary;
  comment: string;
  reactions?: readonly ThreadmarkReaction[];
  replies?: readonly ThreadmarkReply[];
  author?: ThreadmarkReviewer | null;
  lastEditedBy?: ThreadmarkReviewer | null;
  pin?: ThreadmarkPinLocation;
  pinHistory?: ThreadmarkPinLocation[];
  workflow?: ThreadmarkWorkflow;
  device?: ThreadmarkDeviceInfo;
  metadata?: ThreadmarkMetadata;
  source?: ThreadmarkFeedback["source"];
  aiReview?: ThreadmarkFeedback["aiReview"];
}): ThreadmarkFeedback;

export declare const THREADMARK_TARGET_ATTRIBUTE: "data-threadmark-id";
export declare const DEFAULT_ALLOWED_HOSTS: readonly string[];

export interface ThreadmarkFace {
  id?: string;
  name?: string;
  url: string;
}

export interface ThreadmarkNotificationSettings {
  mentionsAndReplies?: true;
  myPages?: boolean;
  digest?: "off" | "daily" | "weekly";
}

export type ThreadmarkMemberRole = "edit" | "comment" | "view";
export type ThreadmarkLinkAccess = "comment" | "view" | "off";

export interface ThreadmarkMember {
  id: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string | null;
  role: ThreadmarkMemberRole | "owner";
  /** This is the person looking at the sheet. */
  you?: boolean;
  /** Invited, not joined yet. Shows Resend. */
  pending?: boolean;
  guest?: boolean;
  /** A short line under the name, such as "link expires in 7 days". */
  note?: string;
}

/** A link to where this comment also lives, such as a tracker issue. Your backend adds these; the overlay shows them. */
export interface ThreadmarkCommentLink {
  destination: string | null;
  /** Shown on the comment, such as "GitHub #482". */
  label: string;
  url: string | null;
  /** "closed" shows "closed in GitHub #482". */
  status: "open" | "closed" | null;
}

export interface ThreadmarkAiFinding {
  id?: string;
  category?: "accessibility" | "copy" | "layout" | "design-system";
  title: string;
  detail?: string;
  /** Which element: a target from `page.findings`, a `data-threadmark-id`, or a CSS selector. */
  target?: ThreadmarkTargetDescriptor;
  targetId?: string;
  selector?: string;
  /** Shown under the finding, such as "Button · Start free". Worked out from the element when left out. */
  where?: string;
}
