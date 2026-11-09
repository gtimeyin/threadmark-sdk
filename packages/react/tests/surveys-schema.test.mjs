import assert from "node:assert/strict";
import test from "node:test";
import {
  SurveyValidationError,
  createSurveyDraft,
  normalizeSurvey,
  normalizeSurveys,
  summarizeSurveyAnswers,
  surveyIsLive,
  surveyPageMatches,
  surveyProblems,
  surveyResultsCsv,
  surveyResultsText,
} from "../src/surveys/schema.js";

const scale = (overrides = {}) => ({
  ...createSurveyDraft("/pricing"),
  id: "find-pricing",
  question: { kind: "scale", text: "How easy was it to find pricing?", scale: { points: 5, display: "slider", low: "Hard", high: "Easy" } },
  followUp: { enabled: true, text: "What nearly stopped you?" },
  status: "live",
  ...overrides,
});

test("a new draft starts as a poll on the whole page, in the corner, for visitors, once each", () => {
  const draft = createSurveyDraft("/pricing");
  assert.equal(draft.question.kind, "poll");
  assert.deepEqual(draft.placement, { kind: "page", position: "corner", target: null });
  assert.deepEqual(draft.pages, ["/pricing"]);
  assert.equal(draft.audience, "visitors");
  assert.equal(draft.frequency, "once");
  assert.equal(draft.stopAfterAnswers, 100);
});

test("problems are worded for the person writing the survey and name their field", () => {
  const draft = createSurveyDraft("/");
  const fields = surveyProblems(draft).map((problem) => problem.field);
  assert.deepEqual(fields, ["question", "options"]);
  draft.question.text = "Which line should lead?";
  draft.question.options = [{ label: "Say it" }, { label: "say it" }];
  assert.match(surveyProblems(draft)[0].message, /same thing/);
  assert.throws(() => normalizeSurvey({ ...draft, id: "x" }), SurveyValidationError);
});

test("normalizing keeps the scale settings and the follow-up, and drops fields that don't apply", () => {
  const survey = normalizeSurvey(scale());
  assert.deepEqual(survey.question.scale, { points: 5, display: "slider", low: "Hard", high: "Easy" });
  assert.deepEqual(survey.question.options, []);
  assert.deepEqual(survey.followUp, { text: "What nearly stopped you?" });
  const poll = normalizeSurvey({ ...scale(), question: { kind: "poll", text: "Which?", options: [{ label: "Say it where you see it." }, { label: "Build it together." }] } });
  assert.deepEqual(poll.question.options.map((option) => option.id), ["say-it-where-you-see-it", "build-it-together"]);
  assert.equal(poll.question.scale, null);
});

test("invalid surveys are skipped and reported, never shown", () => {
  const reported = [];
  const list = normalizeSurveys([scale(), { id: "bad" }, null], (item) => reported.push(item?.id ?? null));
  assert.deepEqual(list.map((survey) => survey.id), ["find-pricing"]);
  assert.deepEqual(reported, ["bad", null]);
});

test("pages match exactly, ignore a trailing slash, and /* matches below", () => {
  assert.ok(surveyPageMatches("/pricing", "/pricing/"));
  assert.ok(!surveyPageMatches("/pricing", "/pricing/team"));
  assert.ok(surveyPageMatches("/docs/*", "/docs/install"));
});

test("a survey is live only between its start and end and until it is full", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  const survey = normalizeSurvey(scale({ startsAt: "2026-11-08T10:00:00Z", endsAt: "2026-11-09T10:00:00Z", stopAfterAnswers: 2 }));
  assert.ok(surveyIsLive(survey, { now, answers: 1 }));
  assert.ok(!surveyIsLive(survey, { now, answers: 2 }));
  assert.ok(!surveyIsLive(survey, { now: Date.parse("2026-11-08T09:00:00Z") }));
  assert.ok(!surveyIsLive({ ...survey, status: "ended" }, { now }));
});

test("answers summarise into a score, a spread and the written answers", () => {
  const survey = normalizeSurvey(scale());
  const summary = summarizeSurveyAnswers(survey, [
    { surveyId: "find-pricing", value: 5, followUp: "Wanted to see the price per seat." },
    { surveyId: "find-pricing", value: 4 },
    { surveyId: "find-pricing", value: 2, followUp: "Couldn't tell Team from Pro." },
    { surveyId: "find-pricing", value: 9 },
    { surveyId: "other", value: 1 },
  ]);
  assert.equal(summary.total, 4);
  assert.deepEqual(summary.counts, { 2: 1, 4: 1, 5: 1 });
  assert.equal(summary.average, 3.7);
  assert.deepEqual(summary.texts, ["Wanted to see the price per seat.", "Couldn't tell Team from Pro."]);
});

test("normalizing twice gives the same survey, so stored surveys keep their follow-up", () => {
  const once = normalizeSurvey(scale());
  assert.deepEqual(normalizeSurvey(once), once);
  const draft = { ...scale(), followUp: { enabled: false, text: "Anything else?" } };
  assert.equal(normalizeSurvey(draft).followUp, null);
});

test("survey results export as CSV and share as a short read (board 03, 11d)", () => {
  const survey = normalizeSurvey({ ...createSurveyDraft("/pricing"), id: "s1", status: "live",
    question: { kind: "scale", text: 'How "easy" was pricing?', scale: { points: 5, display: "numbers", low: "Hard", high: "Easy" } } });
  const results = { total: 3, counts: { 5: 2, 2: 1 }, average: 4, texts: ["Price per seat, please", "Fine"], summary: "Mostly clear." };
  const csv = surveyResultsCsv(survey, results);
  assert.match(csv, /^"Question","How ""easy"" was pricing\?"/);
  assert.match(csv, /"Average","4 of 5"/);
  assert.match(csv, /"5","2","67%"/);
  assert.match(csv, /"Price per seat, please"/);
  const text = surveyResultsText(survey, results);
  assert.equal(text.split("\n")[1], "4 of 5 · 3 answers");
  assert.match(text, /5: 67% \(2\)/);
  assert.match(text, /Mostly clear\./);
  assert.match(text, /“Fine”/);
});
