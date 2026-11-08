import type { ReactElement } from "react";

export type ThreadmarkSurveyKind = "poll" | "scale" | "text";
export type ThreadmarkScaleDisplay = "numbers" | "stars" | "faces" | "slider";

export interface ThreadmarkSurveyQuestion {
  kind: ThreadmarkSurveyKind;
  text: string;
  /** Poll answers (2 to 8). */
  options?: readonly { id?: string; label: string }[];
  /** Poll only: let people pick more than one answer. */
  multiple?: boolean;
  /** Scale only. */
  scale?: { points: 3 | 5 | 7 | 10; display?: ThreadmarkScaleDisplay; low?: string; high?: string };
}

/** One short question shown to people on a page. Host-owned: store it wherever comments live. */
export interface ThreadmarkSurvey {
  id: string;
  question: ThreadmarkSurveyQuestion;
  /** An optional open follow-up, e.g. "What nearly stopped you?". Never required. */
  followUp?: { enabled?: boolean; text: string } | null;
  /** Whole page (corner, centre or banner), or beside an element (a data-threadmark-id or CSS selector). */
  placement?: { kind?: "page" | "section" | "element"; position?: "corner" | "centre" | "banner"; target?: string | null };
  /** Paths it shows on. "/docs/*" matches everything below /docs. */
  pages: readonly string[];
  audience?: "team" | "visitors" | "everyone";
  startsAt?: string | null;
  endsAt?: string | null;
  /** Stops after this many answers. Pass `answerCounts` to the player so it knows. */
  stopAfterAnswers?: number | null;
  frequency?: "once" | "every-visit";
  /** Don't show the team who answered. */
  anonymous?: boolean;
  /** Wait this long on the page before showing (default 3000ms). */
  delayMs?: number;
  status?: "draft" | "live" | "ended";
}

export interface ThreadmarkSurveyAnswer {
  /** Unique per answer; use it to ignore a retried duplicate. */
  key: string;
  surveyId: string;
  /** A number for scales, an option id (or ids) for polls, text for open questions. */
  value: number | string | readonly string[] | null;
  followUp: string | null;
  page: string;
  answeredAt: string;
}

export interface ThreadmarkSurveyResults {
  total: number;
  counts: Record<string, number>;
  average: number | null;
  texts: readonly string[];
}

export interface ThreadmarkSurveysProps {
  surveys: readonly ThreadmarkSurvey[];
  /** The current path. Defaults to window.location.pathname, followed as it changes. */
  route?: string;
  /** Who is looking: visitors see "visitors" and "everyone" surveys, your team sees "team" and "everyone". */
  viewer?: "visitor" | "team";
  /** Answers so far per survey, so "stop after N answers" works. */
  answerCounts?: Readonly<Record<string, number>>;
  /** Store the answer. Rejecting keeps it on the device and retries quietly. */
  onAnswer?: (answer: ThreadmarkSurveyAnswer) => void | Promise<void>;
  onShow?: (surveyId: string) => void;
  onDismiss?: (surveyId: string, reason: "skipped" | "closed") => void;
  onError?: (error: { code: "invalid_survey" | "answer_not_sent"; surveyId: string | null; message: string }) => void;
  styleNonce?: string;
  disabled?: boolean;
}

export declare function ThreadmarkSurveys(props: ThreadmarkSurveysProps): ReactElement | null;
export declare function SurveyCard(props: Record<string, unknown>): ReactElement;
export declare function pickSurvey(surveys: readonly ThreadmarkSurvey[], options: { path: string; viewer?: "visitor" | "team"; done?: readonly string[]; dismissed?: readonly string[]; answerCounts?: Readonly<Record<string, number>>; now?: number }): ThreadmarkSurvey | null;
export declare function surveysDone(): string[];

export declare class SurveyValidationError extends Error {
  problems: { field: string; message: string }[];
}
export declare function createSurveyDraft(route?: string): ThreadmarkSurvey;
export declare function surveyProblems(survey: ThreadmarkSurvey): { field: string; message: string }[];
export declare function normalizeSurvey(survey: ThreadmarkSurvey): ThreadmarkSurvey;
export declare function normalizeSurveys(surveys: readonly ThreadmarkSurvey[], onInvalid?: (item: unknown, error: SurveyValidationError) => void): ThreadmarkSurvey[];
export declare function surveyPageMatches(page: string, path: string): boolean;
export declare function surveyIsLive(survey: ThreadmarkSurvey, options?: { now?: number; answers?: number }): boolean;
export declare function summarizeSurveyAnswers(survey: ThreadmarkSurvey, answers: readonly ThreadmarkSurveyAnswer[]): ThreadmarkSurveyResults;
