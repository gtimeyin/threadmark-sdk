import type { ReactPortal } from "react";

export type ThreadmarkCaptureKind = "text" | "element" | "multi" | "region" | "screenshot" | "interaction";
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

export interface ThreadmarkFeedbackContext {
  evidence: Array<{ id: string; blob: Blob }>;
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

export interface ThreadmarkReply {
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

export interface ThreadmarkFeedback {
  id: string;
  projectKey: string;
  environment: string;
  buildId: string | null;
  route: string;
  captureKind?: ThreadmarkCaptureKind;
  target: ThreadmarkTargetDescriptor;
  targets?: ThreadmarkTargetDescriptor[];
  evidence?: ThreadmarkSnapshotMetadata[];
  interaction?: ThreadmarkInteractionCapture;
  comment: string;
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
    | (string & {});
  message: string;
}

export interface ThreadmarkProps {
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
   * When the returned record omits `context`, the local evidence is kept.
   */
  onFeedbackCreate?: (
    feedback: ThreadmarkFeedback,
    context: ThreadmarkFeedbackContext,
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
  onError?: (error: ThreadmarkError) => void;
}

export declare function Threadmark(props: ThreadmarkProps): ReactPortal | null;
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
  buildId?: string | null;
  route: string;
  target: ThreadmarkTargetDescriptor;
  targets?: ThreadmarkTargetDescriptor[];
  captureKind?: ThreadmarkCaptureKind;
  evidence?: ThreadmarkSnapshotMetadata[];
  interaction?: ThreadmarkInteractionCapture;
  comment: string;
  replies?: readonly ThreadmarkReply[];
  author?: ThreadmarkReviewer | null;
  lastEditedBy?: ThreadmarkReviewer | null;
  pin?: ThreadmarkPinLocation;
  pinHistory?: ThreadmarkPinLocation[];
  workflow?: ThreadmarkWorkflow;
}): ThreadmarkFeedback;

export declare const THREADMARK_TARGET_ATTRIBUTE: "data-threadmark-id";
export declare const DEFAULT_ALLOWED_HOSTS: readonly string[];
