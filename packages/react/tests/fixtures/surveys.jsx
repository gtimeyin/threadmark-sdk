import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import { ThreadmarkSurveys } from "../../src/surveys.js";

const params = new URLSearchParams(window.location.search);
window.__surveyAnswers = [];
window.__surveyEvents = [];
let failures = Number(params.get("fail") || 0);

const pricing = {
  id: "find-pricing",
  question: { kind: "scale", text: "How easy was it to find pricing?", scale: { points: 5, display: "numbers", low: "Hard", high: "Easy" } },
  followUp: { text: "What nearly stopped you?" },
  pages: ["/pricing"],
  delayMs: Number(params.get("delay") || 200),
  status: "live",
  stopAfterAnswers: params.has("full") ? 1 : null,
};
const poll = {
  id: "headline",
  question: { kind: "poll", text: "Which line should lead?", options: [{ label: "Say it where you see it." }, { label: "Build it together." }] },
  pages: ["/home"],
  delayMs: 0,
  status: "live",
  placement: { kind: "page", position: "banner" },
};
const team = { ...poll, id: "team-only", pages: ["/team"], audience: "team" };

function App() {
  const [counts, setCounts] = useState({});
  return (
    <main>
      <h1>Surveys fixture</h1>
      <button type="button">Buy now</button>
      <ThreadmarkSurveys
        surveys={[pricing, poll, team, { id: "broken" }]}
        answerCounts={counts}
        onAnswer={async (answer) => {
          if (failures > 0) {
            failures -= 1;
            throw new Error("offline");
          }
          window.__surveyAnswers.push(answer);
          setCounts((current) => ({ ...current, [answer.surveyId]: (current[answer.surveyId] || 0) + 1 }));
        }}
        onShow={(id) => window.__surveyEvents.push(`show:${id}`)}
        onDismiss={(id, reason) => window.__surveyEvents.push(`${reason}:${id}`)}
        onError={(error) => window.__surveyEvents.push(`error:${error.code}:${error.surveyId}`)}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
window.__surveysMounted = true;
