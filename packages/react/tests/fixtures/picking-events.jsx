import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Threadmark } from "../../src/index.jsx";
import { createFeedbackStore } from "../../../../examples/basic-react/src/feedbackStore.js";

window.__threadmarkHostEvents = [];
window.__threadmarkFixtureState = "loaded";
window.__threadmarkStatuses = [];
window.__threadmarkErrors = [];
window.__threadmarkFeedback = [];
window.__threadmarkFeedbackContexts = [];
window.__threadmarkDeletes = [];
window.__threadmarkHydrated = false;
window.__threadmarkRejectNextSave = false;
window.__threadmarkVersionSelections = [];
window.__threadmarkCarryForwards = [];

const fixtureParams = new URLSearchParams(window.location.search);
// ?polls=1 stores poll votes in memory, the way a host's onPollVote would.
const pollsEnabled = fixtureParams.get("polls") === "1";
// ?tours=1 passes one tour to Tour mode and records what "Save to code" receives.
const toursEnabled = fixtureParams.get("tours") === "1";
// ?surveys=1 lets reviewers publish survey questions, kept in memory the way a host would.
const surveysEnabled = fixtureParams.get("surveys") === "1";
window.__threadmarkSurveys = [];
window.__threadmarkTourSaves = [];
const fixtureTours = [{
  id: "fixture-tour",
  title: "Fixture tour",
  showTo: { path: "/picking-events" },
  steps: [{ id: "custom", target: "custom-text-control", title: "The custom control" }],
}];
window.__threadmarkVotes = {};
function fixturePollVote(feedback, optionIds) {
  const votes = (window.__threadmarkVotes[feedback.id] ||= {});
  if (optionIds.length) votes.fixture_reviewer = optionIds;
  else delete votes.fixture_reviewer;
  const counts = {};
  for (const ids of Object.values(votes)) for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return {
    counts,
    total: Object.keys(votes).length,
    mine: votes.fixture_reviewer || [],
    voters: Object.entries(votes).map(([id, ids]) => ({ reviewer: { id, displayName: id === "fixture_reviewer" ? "Emily R." : "Sam Okafor" }, optionIds: ids })),
  };
}
// ?nextsteps=1 supplies a checklist the way a review service would; =readonly can't be ticked; =fail rejects ticks.
const nextStepsMode = fixtureParams.get("nextsteps");
window.__threadmarkNextStepTicks = [];
window.__threadmarkNextStepCopies = [];
const FIXTURE_NEXT_STEPS = [
  {
    id: "step-buy", title: "Fix the Buy button on mobile", notes: "- Tapping it does nothing\n- Seen on iPhone 15", tag: "bug", source: "ai", completed: false,
    sources: [{ feedbackId: "thread-elsewhere", quote: "Buy does nothing when I tap it", route: "/checkout", author: "Sam Okafor", status: "open" }],
  },
  {
    id: "step-hero", title: "<b>Shorten</b> the hero heading", notes: "", tag: "copy", source: "ai", completed: false,
    sources: [{ feedbackId: "thread-missing", quote: "The heading wraps", route: "/picking-events", author: "Emily R.", status: "resolved" }],
  },
  { id: "step-plan", title: "Pick the plan name", tag: "question", source: "person", completed: true, completedVia: "agent", completedBy: { displayName: "Emily R." }, sources: [] },
];
// `?metadata=1` supplies app context read when a comment is posted (`window.__threadmarkCart` changes it);
// `throw`, `slow`, and `window` supply a broken one. `?nodevice` turns device details off.
window.__threadmarkCart = 1;
const metadataMode = fixtureParams.get("metadata");
const metadata = metadataMode === "1"
  ? () => ({ appVersion: "2.4.1", flags: { newCheckout: true }, cartItems: window.__threadmarkCart, apiKey: "sk_live_abcdefghijklmnop" })
  : metadataMode === "throw" ? () => { throw new Error("store not ready"); }
    : metadataMode === "slow" ? () => new Promise(() => {})
      : metadataMode === "window" ? () => window
        : undefined;
const persistenceEnabled = fixtureParams.has("persist");
// `?replay=1&network=bodies` also keeps filtered request and response bodies.
const sessionReplay = fixtureParams.has("replay")
  ? { bufferMs: 30_000, ...(fixtureParams.get("network") === "bodies" ? { network: { bodies: true } } : {}) }
  : undefined;
// Tests skip the 3-2-1 unless they ask for it with `?countdown=1`.
const videoRecording = fixtureParams.has("novideo")
  ? false
  : {
    countdownSeconds: Number(fixtureParams.get("countdown") || 0),
    ...(fixtureParams.has("videomax") ? { maxDurationMs: Number(fixtureParams.get("videomax")) } : {}),
  };
const feedbackStore = createFeedbackStore({
  databaseName: "threadmark-browser-lifecycle",
  projectKey: "privacy-browser-fixture",
  route: "/picking-events",
});

function record(name) {
  return () => window.__threadmarkHostEvents.push(name);
}

const me = { id: "fixture_reviewer", displayName: "Emily R." };

function Fixture() {
  const [buildId, setBuildId] = useState("fixture-build-current");
  const [annotations, setAnnotations] = useState([]);
  const [targetVersion, setTargetVersion] = useState(0);
  const [showSecondary, setShowSecondary] = useState(true);
  const [duplicatePrimary, setDuplicatePrimary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [styleNonce, setStyleNonce] = useState("fixture-nonce-0");
  const [surveys, setSurveys] = useState([]);
  const [nextSteps, setNextSteps] = useState(() => (nextStepsMode ? {
    steps: FIXTURE_NEXT_STEPS,
    status: { state: "ready", generatedAt: new Date(Date.now() - 5 * 60_000).toISOString() },
    canEdit: nextStepsMode !== "readonly",
  } : null));

  useEffect(() => {
    if (!persistenceEnabled) {
      window.__threadmarkHydrated = true;
      return undefined;
    }
    let active = true;
    feedbackStore.list().then((records) => {
      if (!active) return;
      setAnnotations(records);
      window.__threadmarkHydrated = true;
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    window.__threadmarkRerenderPrimary = () => setTargetVersion((current) => current + 1);
    window.__threadmarkShowSecondary = setShowSecondary;
    window.__threadmarkSetBuild = setBuildId;
    window.__threadmarkSetRecords = setAnnotations;
    window.__threadmarkDuplicatePrimary = setDuplicatePrimary;
    window.__threadmarkRemount = () => setStyleNonce((current) => `${current}-next`);
    return () => {
      delete window.__threadmarkRerenderPrimary;
      delete window.__threadmarkShowSecondary;
      delete window.__threadmarkSetBuild;
      delete window.__threadmarkSetRecords;
      delete window.__threadmarkDuplicatePrimary;
      delete window.__threadmarkRemount;
    };
  }, []);

  return (
    <>
      <div
        key={`custom-${targetVersion}`}
        id="custom-target"
        data-threadmark-id="custom-text-control"
        onPointerDown={record("pointerdown")}
        onPointerUp={record("pointerup")}
        onMouseDown={record("mousedown")}
        onMouseUp={record("mouseup")}
        onClick={record("click")}
      >
        Select this custom text control without activating the host application.
      </div>
      {duplicatePrimary && (
        <div data-threadmark-id="custom-text-control">Duplicate saved target</div>
      )}
      {showSecondary && (
        <button
          id="secondary-target"
          type="button"
          data-threadmark-id="secondary-action"
          onPointerDown={record("secondary-pointerdown")}
          onPointerUp={record("secondary-pointerup")}
          onClick={record("secondary-click")}
        >
          Secondary host action
        </button>
      )}
      <section id="interaction-controls">
        <label htmlFor="interaction-search">Interaction search</label>
        <input
          id="interaction-search"
          data-threadmark-id="interaction-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <output id="interaction-output">{searchQuery ? "Results updated" : "Waiting for interaction"}</output>
      </section>
      <div id="animated-target" aria-label="Animated fixture target" />
      <div
        id="region-space"
        data-threadmark-ignore
        aria-label="Empty region capture fixture"
      />
      <Threadmark
        enabled
        environment="local"
        projectKey="privacy-browser-fixture"
        reviewer={me}
        styleNonce={styleNonce}
        reviewers={[{ id: "fixture_reviewer", displayName: "Emily R." }, { id: "sam", displayName: "Sam Okafor" }]}
        buildId={buildId}
        videoRecording={videoRecording}
        sessionReplay={sessionReplay}
        metadata={metadata}
        deviceDetails={!fixtureParams.has("nodevice")}
        pageVersions={[
          {
            id: "fixture-current",
            buildId: "fixture-build-current",
            url: "http://localhost",
            label: "Current preview",
            branch: "main",
            commitSha: "abcdef123456",
            createdAt: "2026-08-31T12:00:00.000Z",
            feedbackCount: annotations.length,
          },
          {
            id: "fixture-previous",
            buildId: "fixture-build-previous",
            url: "http://localhost",
            label: "Previous preview",
            branch: "feature/review",
            commitSha: "123456abcdef",
            createdAt: "2026-08-29T12:00:00.000Z",
            feedbackCount: 3,
          },
          {
            id: "fixture-expired",
            buildId: "fixture-build-expired",
            url: "http://localhost",
            label: "Expired preview",
            state: "unavailable",
            feedbackCount: 2,
          },
        ]}
        annotations={annotations}
        tours={toursEnabled ? fixtureTours : undefined}
        onTourSave={toursEnabled ? async (tour, file) => { window.__threadmarkTourSaves.push({ tour, file }); } : undefined}
        onStatusChange={(status) => window.__threadmarkStatuses.push(status)}
        onError={(error) => window.__threadmarkErrors.push(error)}
        onFeedbackCreate={async (feedback, context, saving) => {
          if (window.__threadmarkRejectNextSave) {
            window.__threadmarkRejectNextSave = false;
            throw new Error("Fixture save failure");
          }
          // `?uploads=1` reports half of each new file sent, then waits for `__threadmarkFinishUpload()`.
          if (fixtureParams.has("uploads") && saving) {
            for (const item of context.evidence.filter((entry) => entry.blob)) {
              saving.onUploadProgress({ evidenceId: item.id, sentBytes: Math.round(item.blob.size / 2), totalBytes: item.blob.size });
            }
            await new Promise((resolve) => { window.__threadmarkFinishUpload = resolve; });
          }
          // Simulates a host that answers with its own record instead of updating the controlled prop.
          if (window.__threadmarkAuthoritative) return window.__threadmarkAuthoritative(feedback, context);
          if (persistenceEnabled) await feedbackStore.upsert(feedback, context);
          window.__threadmarkFeedback.push(feedback);
          window.__threadmarkFeedbackContexts.push(context);
          setAnnotations((current) => [
            ...current.filter((item) => item.feedback.id !== feedback.id),
            { feedback, context },
          ]);
        }}
        onFeedbackDelete={async (feedback) => {
          if (persistenceEnabled) await feedbackStore.remove(feedback.id);
          window.__threadmarkDeletes.push(feedback.id);
          setAnnotations((current) => current.filter((item) => item.feedback.id !== feedback.id));
        }}
        onFeedbackClear={async () => {
          if (persistenceEnabled) await feedbackStore.clear();
          setAnnotations([]);
        }}
        onPageVersionSelect={(version, context) => {
          window.__threadmarkVersionSelections.push({ version, context });
        }}
        onFeedbackCarryForward={(feedback, version, context) => {
          window.__threadmarkCarryForwards.push({ feedback, version, context });
        }}
        onPollVote={pollsEnabled ? fixturePollVote : undefined}
        surveys={surveysEnabled ? surveys : undefined}
        surveyResults={surveysEnabled ? Object.fromEntries(surveys.map((survey) => [survey.id, { total: 3, counts: { 5: 2, 3: 1 }, average: 4.3, texts: ["Wanted to see the price per seat."] }])) : undefined}
        onSurveyPublish={surveysEnabled ? async (survey) => {
          window.__threadmarkSurveys.push(survey);
          setSurveys((current) => [...current, survey]);
        } : undefined}
        onSurveyEnd={surveysEnabled ? (id) => setSurveys((current) => current.map((survey) => (survey.id === id ? { ...survey, status: "ended" } : survey))) : undefined}
        nextSteps={nextSteps}
        onNextStepDone={nextStepsMode ? async (step, done) => {
          window.__threadmarkNextStepTicks.push([step.id, done]);
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (nextStepsMode === "fail") throw new Error("Fixture next-step failure");
          setNextSteps((current) => ({
            ...current,
            steps: current.steps.map((item) => (item.id === step.id
              ? { ...item, completed: done, completedVia: done ? "person" : null, completedBy: done ? { displayName: "Emily R." } : null }
              : item)),
          }));
        } : undefined}
        onNextStepsCopy={nextStepsMode ? (steps) => { window.__threadmarkNextStepCopies.push(steps.map((step) => step.id)); } : undefined}
      />
    </>
  );
}

createRoot(document.querySelector("#root")).render(<Fixture />);
window.__threadmarkFixtureState = "rendered";
