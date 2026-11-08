// Production-safe entry for Threadmark surveys. Like the tours entry, keep its import graph free of
// the review overlay and capture code.
export { ThreadmarkSurveys, pickSurvey, surveysDone } from "./surveys/ThreadmarkSurveys.jsx";
export { SurveyCard } from "./surveys/SurveyCard.jsx";
export {
  SurveyValidationError,
  createSurveyDraft,
  normalizeSurvey,
  normalizeSurveys,
  summarizeSurveyAnswers,
  surveyIsLive,
  surveyPageMatches,
  surveyProblems,
} from "./surveys/schema.js";
