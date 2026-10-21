import type { ReactNode } from "react";

/**
 * Production-safe entry for Threadmark tours (experimental).
 * Steps point at elements tagged with threadmarkTarget(). Nothing is captured or sent anywhere:
 * progress stays in this browser unless you pass onProgressChange, and events go only to onTourEvent.
 */

export declare function threadmarkTarget(id: string): { "data-threadmark-id": string };

export declare const THREADMARK_TARGET_ATTRIBUTE: "data-threadmark-id";

/** "500ms", "2s", "5m", "1h", or "7d". */
export type ThreadmarkTourDuration = `${number}${"ms" | "s" | "m" | "h" | "d"}`;

export type ThreadmarkTourTraitCondition =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | { within: ThreadmarkTourDuration };

export interface ThreadmarkTourUser {
  id?: string | number;
  traits?: Record<string, unknown>;
}

export type ThreadmarkTourStepStyle = "spotlight" | "tooltip" | "modal";
export type ThreadmarkTourPlacement = "auto" | "top" | "bottom" | "left" | "right" | "sheet";

export interface ThreadmarkTourStep {
  /** Stable step id. Progress remembers step ids, so steps can be reordered safely. */
  id: string;
  /** Page this step is on. Steps without one continue on the previous step's page. */
  page?: string;
  /** A threadmarkTarget() id. Optional only for modal steps. */
  target?: string;
  title: string;
  body?: string;
  style?: ThreadmarkTourStepStyle;
  placement?: ThreadmarkTourPlacement;
  /** "button" shows Next; "click" moves on when the person uses the target. */
  next?: "button" | "click";
  /** How people reach this step's page: your `navigate` function, or a pointer to go there themselves. */
  arrive?: "navigate" | "point";
  waitFor?: { timeout?: ThreadmarkTourDuration };
  /** Overrides used on phone-sized screens, e.g. when a button lives in a menu there. */
  phone?: Partial<Pick<ThreadmarkTourStep, "target" | "title" | "body" | "style" | "placement" | "next">>;
}

export interface ThreadmarkTour {
  $schema?: string;
  id: string;
  title: string;
  showTo?: {
    /** Exact path, or ending in "*" for a prefix. */
    path?: string;
    device?: "any" | "desktop" | "phone";
    traits?: Record<string, ThreadmarkTourTraitCondition>;
    /** Escape hatch for rules the fields above can't express. Not available in JSON files. */
    when?: (user: ThreadmarkTourUser) => boolean;
  };
  start?: "pageLoad" | "manual" | { after: "pageLoad"; wait: ThreadmarkTourDuration } | { on: string };
  repeat?: "once" | "untilFinished" | "everyVisit";
  afterSkip?: "never" | ThreadmarkTourDuration;
  steps: ThreadmarkTourStep[];
}

export interface ThreadmarkTourValidationIssue {
  path: string;
  message: string;
}

export declare class TourValidationError extends TypeError {
  errors: ThreadmarkTourValidationIssue[];
}

/** Validates a hand-written tour and returns it unchanged. Throws TourValidationError on mistakes. */
export declare function defineTour<T extends ThreadmarkTour>(tour: T): T;

export declare function validateTour(input: unknown): {
  ok: boolean;
  errors: ThreadmarkTourValidationIssue[];
  /** Normalized tour with defaults applied, or null when invalid. Internal shape; may change. */
  tour: unknown | null;
};

export type ThreadmarkTourStatus = "inProgress" | "paused" | "finished" | "skipped";

export interface ThreadmarkTourProgress {
  tourId: string;
  userId?: string;
  status: ThreadmarkTourStatus;
  stepId?: string;
  /** Step ids this person has seen. */
  seen: string[];
  startedAt: number;
  updatedAt: number;
}

export interface ThreadmarkTourEvent {
  type: "started" | "resumed" | "stepShown" | "stepCompleted" | "targetMissing" | "paused" | "skipped" | "finished";
  tourId: string;
  stepId?: string;
  stepIndex?: number;
  /** For targetMissing: "missing" or "ambiguous". */
  reason?: "missing" | "ambiguous";
  target?: string;
  at: number;
}

export interface ThreadmarkTourNote {
  tourId: string;
  stepId: string;
  stepIndex: number;
  text: string;
  path: string;
}

export interface ThreadmarkTourTheme {
  accent?: string;
  accentText?: string;
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  radius?: string | number;
  font?: string;
}

export interface ThreadmarkToursError {
  code: "invalid_tour" | "duplicate_tour" | "duplicate_instance" | "unknown_tour" | "progress_save_failed";
  message: string;
  tourId?: string;
  errors?: ThreadmarkTourValidationIssue[];
  error?: unknown;
}

export interface ThreadmarkToursProps {
  tours: ThreadmarkTour[];
  user?: ThreadmarkTourUser;
  /** Your router's navigate, for tours that move between pages. */
  navigate?: (path: string) => void;
  /** Saved progress records when your app stores them. Requires onProgressChange. */
  progress?: ThreadmarkTourProgress[];
  /** Save progress yourself. Without it, progress stays in this browser (localStorage). */
  onProgressChange?: (record: ThreadmarkTourProgress) => void | Promise<void>;
  onTourEvent?: (event: ThreadmarkTourEvent) => void;
  /** Shows "Something unclear here?" on each step. Await your save; a rejection lets them retry. */
  onTourNote?: (note: ThreadmarkTourNote) => void | Promise<void>;
  onError?: (error: ThreadmarkToursError) => void;
  theme?: ThreadmarkTourTheme;
  /** Defaults: one new tour per visit, and a day between tours. */
  rules?: { perVisit?: number; gap?: ThreadmarkTourDuration };
  /** Current path, when your router knows it better than window.location. */
  path?: string;
  /** Nonce for the fallback <style> element in browsers without constructable stylesheets. */
  styleNonce?: string;
  children?: ReactNode;
}

export declare function ThreadmarkTours(props: ThreadmarkToursProps): JSX.Element;

export declare function useThreadmarkTours(): {
  /** Starts a tour from the beginning, e.g. from a Help menu. Returns false if there's no such tour. */
  start(tourId: string): boolean;
  /** Raises an app event for tours that start with { "on": "event.name" }. */
  emit(event: string): boolean;
  /** Forgets this person's progress for a tour. Hosts that store progress should clear their copy too. */
  reset(tourId: string): void;
};

export interface ThreadmarkTourThemeWarning {
  pair: [keyof ThreadmarkTourTheme, keyof ThreadmarkTourTheme];
  label: string;
  ratio: number;
  suggestion: Partial<ThreadmarkTourTheme> | null;
}

/** Text pairs below 4.5:1 contrast, with a nearby colour that passes. */
export declare function checkTourTheme(theme?: ThreadmarkTourTheme): ThreadmarkTourThemeWarning[];
