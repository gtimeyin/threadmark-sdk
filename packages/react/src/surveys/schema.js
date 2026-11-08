// Surveys: one short question shown to people on a page (Feedback experience board 03, rows 10-11).
// Like comments and tours, surveys are host-owned data. The review overlay writes them with the
// builder and hands them to `onSurveyPublish`; the production-safe <ThreadmarkSurveys> player reads
// them, shows the card and hands each answer to `onAnswer`. This module is shared by both and must
// stay free of React and of the review overlay.

export const SURVEY_KINDS = ["poll", "scale", "text"];
export const SCALE_POINTS = [3, 5, 7, 10];
export const SCALE_DISPLAYS = ["numbers", "stars", "faces", "slider"];
export const SURVEY_POSITIONS = ["corner", "centre", "banner"];
export const SURVEY_AUDIENCES = ["team", "visitors", "everyone"];

const text = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const slug = (value) => text(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export class SurveyValidationError extends Error {
  constructor(problems) {
    super(problems.map((problem) => `${problem.field}: ${problem.message}`).join("; "));
    this.name = "SurveyValidationError";
    this.problems = problems;
  }
}

/** A blank survey with the design's defaults: a poll, whole page, bottom corner, visitors, once each. */
export function createSurveyDraft(route = "/") {
  return {
    id: `survey-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    question: { kind: "poll", text: "", options: [{ id: "a", label: "" }, { id: "b", label: "" }], multiple: false, scale: { points: 5, display: "numbers", low: "", high: "" } },
    followUp: { enabled: false, text: "What nearly stopped you?" },
    placement: { kind: "page", position: "corner", target: null },
    pages: [route],
    audience: "visitors",
    startsAt: null,
    stopAfterAnswers: 100,
    endsAt: null,
    frequency: "once",
    anonymous: true,
    delayMs: 3000,
    status: "draft",
  };
}

/**
 * Checks a survey and returns problems as `{ field, message }`, worded for the person writing it.
 * The builder shows them next to their field (board 03, 13a: "Problems are pointed out next to the
 * field, in words").
 */
export function surveyProblems(survey) {
  const problems = [];
  const question = survey?.question || {};
  if (!text(question.text, 300)) problems.push({ field: "question", message: "Write the question people will see." });
  if (question.kind === "poll") {
    const labels = (question.options || []).map((option) => text(option?.label, 120)).filter(Boolean);
    if (labels.length < 2) problems.push({ field: "options", message: "Add at least two answers." });
    if (new Set(labels.map((label) => label.toLowerCase())).size !== labels.length) problems.push({ field: "options", message: "Two answers say the same thing." });
  }
  if (question.kind === "scale" && !SCALE_POINTS.includes(Number(question.scale?.points))) {
    problems.push({ field: "points", message: "Choose 3, 5, 7 or 10 points." });
  }
  if (!(survey?.pages || []).some((page) => text(page, 512).startsWith("/"))) problems.push({ field: "pages", message: "Add a page, such as /pricing." });
  if (survey?.placement?.kind === "element" && !text(survey.placement.target, 300)) problems.push({ field: "where", message: "Pick the element the question belongs to." });
  return problems;
}

/** Cleans a survey for storage or display. Throws `SurveyValidationError` when it can't be shown. */
export function normalizeSurvey(input) {
  const problems = surveyProblems(input);
  const id = text(input?.id, 160);
  if (!id) problems.unshift({ field: "id", message: "A survey needs an id." });
  if (problems.length) throw new SurveyValidationError(problems);
  const question = input.question;
  const kind = oneOf(question.kind, SURVEY_KINDS, "poll");
  const seen = new Set();
  const options = kind === "poll"
    ? question.options.map((option, index) => {
      const label = text(option.label, 120);
      let optionId = text(option.id, 60) || slug(label) || `option-${index + 1}`;
      while (seen.has(optionId)) optionId = `${optionId}-${index + 1}`;
      seen.add(optionId);
      return { id: optionId, label };
    }).filter((option) => option.label).slice(0, 8)
    : [];
  const points = Number(question.scale?.points) || 5;
  return {
    id,
    question: {
      kind,
      text: text(question.text, 300),
      options,
      multiple: kind === "poll" && question.multiple === true,
      scale: kind === "scale" ? {
        points,
        display: oneOf(question.scale?.display, SCALE_DISPLAYS, "numbers"),
        low: text(question.scale?.low, 40),
        high: text(question.scale?.high, 40),
      } : null,
    },
    // A stored follow-up is just { text }; a draft also carries `enabled`.
    followUp: input.followUp && input.followUp.enabled !== false && text(input.followUp.text, 200) ? { text: text(input.followUp.text, 200) } : null,
    placement: {
      kind: oneOf(input.placement?.kind, ["page", "section", "element"], "page"),
      position: oneOf(input.placement?.position, SURVEY_POSITIONS, "corner"),
      target: text(input.placement?.target, 300) || null,
    },
    pages: [...new Set(input.pages.map((page) => text(page, 512)).filter((page) => page.startsWith("/")))],
    audience: oneOf(input.audience, SURVEY_AUDIENCES, "visitors"),
    startsAt: Number.isFinite(Date.parse(input.startsAt)) ? new Date(input.startsAt).toISOString() : null,
    endsAt: Number.isFinite(Date.parse(input.endsAt)) ? new Date(input.endsAt).toISOString() : null,
    stopAfterAnswers: Number.isInteger(input.stopAfterAnswers) && input.stopAfterAnswers > 0 ? input.stopAfterAnswers : null,
    frequency: oneOf(input.frequency, ["once", "every-visit"], "once"),
    anonymous: input.anonymous !== false,
    delayMs: Math.min(60000, Math.max(0, Number.isFinite(input.delayMs) ? input.delayMs : 3000)),
    status: oneOf(input.status, ["draft", "live", "ended"], "live"),
  };
}

/** Normalizes a list, dropping (and reporting) surveys that can't be shown. */
export function normalizeSurveys(list, onInvalid) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    try {
      out.push(normalizeSurvey(item));
    } catch (error) {
      onInvalid?.(item, error);
    }
  }
  return out;
}

/** Whether a page path matches a survey page. `/pricing` matches `/pricing` and `/pricing/`; `/docs/*` matches below. */
export function surveyPageMatches(page, path) {
  const clean = (value) => (value.length > 1 ? value.replace(/\/+$/, "") : value);
  if (page.endsWith("/*")) return clean(path).startsWith(clean(page.slice(0, -2)));
  return clean(page) === clean(path);
}

/** Is the survey running now? Ended, not started yet, past its end, or full means no. */
export function surveyIsLive(survey, { now = Date.now(), answers = 0 } = {}) {
  if (survey.status !== "live") return false;
  if (survey.startsAt && Date.parse(survey.startsAt) > now) return false;
  if (survey.endsAt && Date.parse(survey.endsAt) <= now) return false;
  if (survey.stopAfterAnswers && answers >= survey.stopAfterAnswers) return false;
  return true;
}

/**
 * Summarises answers for the team view (board 03, 11d): count, average and spread for scales, counts
 * for polls, and the written answers. Hosts can pass this back as `surveyResults`, or compute their own.
 */
export function summarizeSurveyAnswers(survey, answers = []) {
  const valid = answers.filter((answer) => answer && answer.surveyId === survey.id);
  const result = { total: valid.length, counts: {}, average: null, texts: [] };
  if (survey.question.kind === "scale") {
    const values = valid.map((answer) => Number(answer.value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= survey.question.scale.points);
    for (const value of values) result.counts[value] = (result.counts[value] || 0) + 1;
    result.average = values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  } else if (survey.question.kind === "poll") {
    for (const answer of valid) {
      for (const id of [].concat(answer.value || [])) if (survey.question.options.some((option) => option.id === id)) result.counts[id] = (result.counts[id] || 0) + 1;
    }
  }
  for (const answer of valid) {
    const written = text(survey.question.kind === "text" ? answer.value : answer.followUp, 600);
    if (written) result.texts.push(written);
  }
  return result;
}
