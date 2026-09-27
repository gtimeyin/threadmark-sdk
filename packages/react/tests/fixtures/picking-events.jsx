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

const persistenceEnabled = new URLSearchParams(window.location.search).has("persist");
const feedbackStore = createFeedbackStore({
  databaseName: "threadmark-browser-lifecycle",
  projectKey: "privacy-browser-fixture",
  route: "/picking-events",
});

function record(name) {
  return () => window.__threadmarkHostEvents.push(name);
}

function Fixture() {
  const [buildId, setBuildId] = useState("fixture-build-current");
  const [annotations, setAnnotations] = useState([]);
  const [targetVersion, setTargetVersion] = useState(0);
  const [showSecondary, setShowSecondary] = useState(true);
  const [duplicatePrimary, setDuplicatePrimary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [styleNonce, setStyleNonce] = useState("fixture-nonce-0");

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
        reviewer={{ id: "fixture_reviewer", displayName: "Emily R." }}
        styleNonce={styleNonce}
        reviewers={[{ id: "fixture_reviewer", displayName: "Emily R." }, { id: "sam", displayName: "Sam Okafor" }]}
        buildId={buildId}
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
        onStatusChange={(status) => window.__threadmarkStatuses.push(status)}
        onError={(error) => window.__threadmarkErrors.push(error)}
        onFeedbackCreate={async (feedback, context) => {
          if (window.__threadmarkRejectNextSave) {
            window.__threadmarkRejectNextSave = false;
            throw new Error("Fixture save failure");
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
      />
    </>
  );
}

createRoot(document.querySelector("#root")).render(<Fixture />);
window.__threadmarkFixtureState = "rendered";
