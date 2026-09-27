import { useCallback, useEffect, useMemo, useState } from "react";
import { Threadmark, threadmarkTarget } from "threadmark-react";
import { createFeedbackStore } from "./feedbackStore.js";

const IGNORED_SELECTORS = [".analytics-internal"];
const MAX_LOG_ENTRIES = 6;
const PROJECT_KEY = "pk_threadmark_basic_react";
const REVIEWER = {
  id: "user_emily_r",
  displayName: "Emily R.",
};
const CURRENT_BUILD_ID = "basic-react-2026-08";
const PREVIOUS_BUILD_ID = "basic-react-2026-07";
const feedbackStore = createFeedbackStore({ projectKey: PROJECT_KEY, route: "/" });

function logEntry({ feedback, context }) {
  return {
    feedback,
    receivedAt: new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(feedback.createdAt)),
    evidence: (context?.evidence || []).map(({ id, blob }) => ({ id, type: blob.type, size: blob.size })),
  };
}

function FeedbackLog({ entries, onClear }) {
  return (
    <aside className="event-log" aria-labelledby="event-log-title">
      <div className="event-log__header">
        <div>
          <span className="eyebrow">Consumer callback</span>
          <h2 id="event-log-title">Feedback payloads</h2>
        </div>
        <button type="button" onClick={onClear} disabled={!entries.length}>
          Clear
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="event-log__empty">
          <span>0</span>
          <p>Submit feedback in Threadmark and the callback payload will appear here.</p>
        </div>
      ) : (
        <ol className="event-log__entries">
          {entries.map((entry, index) => (
            <li key={`${entry.feedback.id}-${entry.receivedAt}-${index}`}>
              <div className="event-log__summary">
                <span className="capture-pill">
                  {entry.feedback.captureKind || "element"}
                  {entry.feedback.targets?.length > 1 ? ` · ${entry.feedback.targets.length}` : ""}
                </span>
                <strong>{entry.feedback.comment}</strong>
                <span>{entry.feedback.author?.displayName || "Anonymous reviewer"}</span>
                <strong>
                  {entry.feedback.target.locatorCandidates.stableId
                    || entry.feedback.target.accessibleName
                    || entry.feedback.target.tagName}
                </strong>
                <time>{entry.receivedAt}</time>
              </div>
              <details>
                <summary>Inspect JSON</summary>
                <pre>{JSON.stringify(entry.feedback, null, 2)}</pre>
              </details>
              {entry.evidence.length > 0 && (
                <p className="event-log__evidence">
                  Blob sidecar: {entry.evidence.map((item) => `${item.type} · ${Math.round(item.size / 1024)} KB`).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

export function App() {
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [status, setStatus] = useState("booting");
  const [selectedTarget, setSelectedTarget] = useState("None yet");
  const [selectionSummary, setSelectionSummary] = useState("No active selection");
  const [ctaActivations, setCtaActivations] = useState(0);
  const [ignoredActivations, setIgnoredActivations] = useState(0);
  const [activeBuildId, setActiveBuildId] = useState(CURRENT_BUILD_ID);

  useEffect(() => {
    let active = true;
    feedbackStore.list().then((records) => {
      if (!active) return;
      setAnnotations(records);
      setFeedbackEntries(records.map(logEntry).reverse().slice(0, MAX_LOG_ENTRIES));
    }).catch(() => {
      if (active) setStatus("error:persistence_load_failed");
    });
    return () => { active = false; };
  }, []);

  const handleFeedbackCreate = useCallback(async (feedback, context) => {
    await feedbackStore.upsert(feedback, context);
    const record = { feedback, context };
    setAnnotations((current) => [
      ...current.filter((item) => item.feedback.id !== feedback.id),
      record,
    ]);
    setFeedbackEntries((current) => [
      logEntry(record),
      ...current.filter((item) => item.feedback.id !== feedback.id),
    ].slice(0, MAX_LOG_ENTRIES));
  }, []);

  const handleFeedbackDelete = useCallback(async (feedback) => {
    await feedbackStore.remove(feedback.id);
    setAnnotations((current) => current.filter((item) => item.feedback.id !== feedback.id));
    setFeedbackEntries((current) => current.filter((item) => item.feedback.id !== feedback.id));
  }, []);

  const handleFeedbackClear = useCallback(async (feedback) => {
    const ids = new Set(feedback.map((item) => item.id));
    await feedbackStore.clear([...ids]);
    setAnnotations((current) => current.filter((item) => !ids.has(item.feedback.id)));
    setFeedbackEntries((current) => current.filter((item) => !ids.has(item.feedback.id)));
  }, []);

  const handleSelectionChange = useCallback(({ captureKind, targets }) => {
    setSelectionSummary(
      targets.length
        ? `${captureKind} · ${targets.length} target${targets.length === 1 ? "" : "s"}`
        : "No active selection",
    );
  }, []);

  const handleTargetSelect = useCallback((target) => {
    setSelectedTarget(
      target.locatorCandidates.stableId
        || target.accessibleName
        || target.tagName,
    );
  }, []);

  const pageVersions = useMemo(() => {
    const countFor = (versionBuildId) => annotations.filter(
      (record) => record.feedback.buildId === versionBuildId,
    ).length;
    return [
      {
        id: "dpl_basic_react_2026_08",
        buildId: CURRENT_BUILD_ID,
        url: window.location.origin,
        label: "Latest preview",
        branch: "codex/initial-threadmark",
        commitSha: "cd061a5",
        createdAt: "2026-08-31T14:40:00.000Z",
        environment: "preview",
        state: "ready",
        feedbackCount: countFor(CURRENT_BUILD_ID),
        current: activeBuildId === CURRENT_BUILD_ID,
      },
      {
        id: "dpl_basic_react_2026_07",
        buildId: PREVIOUS_BUILD_ID,
        url: window.location.origin,
        label: "Previous preview",
        branch: "codex/initial-threadmark",
        commitSha: "aaffce9",
        createdAt: "2026-08-28T09:15:00.000Z",
        environment: "preview",
        state: "ready",
        feedbackCount: countFor(PREVIOUS_BUILD_ID),
        current: activeBuildId === PREVIOUS_BUILD_ID,
      },
      {
        id: "dpl_basic_react_expired",
        buildId: "basic-react-2026-06",
        url: window.location.origin,
        label: "Expired preview",
        branch: "main",
        commitSha: "81d4c2a",
        createdAt: "2026-08-20T11:00:00.000Z",
        environment: "preview",
        state: "unavailable",
        feedbackCount: 3,
      },
    ];
  }, [activeBuildId, annotations]);

  const handleCarryForward = useCallback(async (feedback, version) => {
    const source = annotations.find((record) => record.feedback.id === feedback.id);
    const timestamp = new Date().toISOString();
    const copy = {
      ...feedback,
      id: crypto.randomUUID(),
      buildId: version.buildId || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastEditedBy: REVIEWER,
    };
    const context = source?.context || { evidence: [] };
    await feedbackStore.upsert(copy, context);
    const record = { feedback: copy, context };
    setAnnotations((current) => [...current, record]);
    setFeedbackEntries((current) => [logEntry(record), ...current].slice(0, MAX_LOG_ENTRIES));
  }, [annotations]);

  return (
    <>
      <Threadmark
        projectKey={PROJECT_KEY}
        reviewer={REVIEWER}
        reviewers={[REVIEWER, { id: "example-sam", displayName: "Sam Okafor" }]}
        enabled
        environment="local"
        buildId={activeBuildId}
        ignoredSelectors={IGNORED_SELECTORS}
        annotations={annotations}
        pageVersions={pageVersions}
        onStatusChange={setStatus}
        onTargetSelect={handleTargetSelect}
        onSelectionChange={handleSelectionChange}
        onFeedbackCreate={handleFeedbackCreate}
        onFeedbackDelete={handleFeedbackDelete}
        onFeedbackClear={handleFeedbackClear}
        onPageVersionSelect={(version) => setActiveBuildId(version.buildId || CURRENT_BUILD_ID)}
        onFeedbackCarryForward={handleCarryForward}
        onError={(error) => setStatus(`error:${error.code}`)}
      />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Parcel home">
          <span>P</span>
          Parcel
        </a>
        <nav aria-label="Primary navigation">
          <a href="#review-targets">Targets</a>
          <a href="#privacy-boundaries">Privacy</a>
          <a href="#callback-log">Callback</a>
        </nav>
        <div className="sdk-status" role="status">
          <span className={status === "ready" ? "is-ready" : ""} />
          SDK: {status}
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <span className="eyebrow">Standalone consumer fixture</span>
            <h1 id="hero-title" {...threadmarkTarget("release-hero-heading")}>
              Ship a calmer release process.
            </h1>
            <p>
              This page consumes <code>threadmark-react</code> exactly like a product app.
              Click an element, highlight exact copy, or drag across the page to create one annotation.
            </p>
            <div className="hero__actions">
              <a className="primary-link" href="#review-targets">Explore targets</a>
              <span>Shortcut: <kbd>⌘/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd></span>
            </div>
          </div>
          <div className="hero__telemetry" aria-label="Fixture runtime details">
            <span>Selected target</span>
            <strong>{selectedTarget}</strong>
            <div>
              <span>Selection</span><code>{selectionSummary}</code>
              <span>Host</span><code>localhost</code>
              <span>Build</span><code>{activeBuildId}</code>
              <span>Ignored selector</span><code>.analytics-internal</code>
            </div>
          </div>
        </section>

        <section className="target-section" id="review-targets" aria-labelledby="targets-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">One annotation surface</span>
              <h2 id="targets-title">Click, highlight, or drag</h2>
            </div>
            <p>Threadmark infers the right context from the gesture and always opens the same comment popover.</p>
          </div>

          <div className="target-grid">
            <article className="target-card target-card--heading">
              <span className="target-card__number">01</span>
              <span className="target-card__kind">Heading</span>
              <h3 {...threadmarkTarget("release-card-title")}>
                Turn every launch into a shared learning loop.
              </h3>
              <p className="selectable-copy">
                Select copy across <span>these nested words</span> to send the exact quote with your comment.
              </p>
              <small>Click the heading or highlight the sentence.</small>
              <code>release-card-title</code>
            </article>

            <article className="target-card target-card--chart">
              <span className="target-card__number">02</span>
              <span className="target-card__kind">Chart</span>
              <div
                className="visual-target"
                role="img"
                aria-label="Release confidence trend chart"
                {...threadmarkTarget("release-confidence-chart")}
              />
              <p>The chart is a non-text target and uses the same compact comment popover.</p>
              <small>Drag across this and the next target to group them.</small>
              <code>release-confidence-chart</code>
            </article>

            <article className="target-card target-card--action">
              <span className="target-card__number">03</span>
              <span className="target-card__kind">Button</span>
              <h3>Approve this release</h3>
              <p>Select the control without firing it, then explain the change in plain language.</p>
              <button
                type="button"
                className="approval-button"
                {...threadmarkTarget("approve-release-button")}
                onClick={() => setCtaActivations((count) => count + 1)}
              >
                Approve release · {ctaActivations}
              </button>
              <div className="motion-demo" aria-label="Animated release pulse">
                <span />
                Press P to freeze this motion
              </div>
              <code>approve-release-button</code>
            </article>
          </div>

          <div className="capture-guide" aria-label="Annotation gesture guide">
            <div><strong>Click</strong><span>Annotate one element without activating it.</span></div>
            <div><strong>Highlight</strong><span>Select exact text and keep the quote.</span></div>
            <div><strong>Group</strong><span>Drag across elements or ⌘/Ctrl + Shift-click.</span></div>
            <div><strong>Area</strong><span>Drag empty space and approve a redacted snapshot.</span></div>
          </div>
        </section>

        <section className="privacy-section" id="privacy-boundaries" aria-labelledby="privacy-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Selection boundaries</span>
              <h2 id="privacy-title">Sensitive and ignored by design</h2>
            </div>
            <p>Click and text selection skip these panels; area snapshots mask them before review.</p>
          </div>

          <div className="privacy-grid">
            <form className="boundary-card" onSubmit={(event) => event.preventDefault()}>
              <span>Built-in sensitive control</span>
              <label htmlFor="fixture-api-key">Preview API key</label>
              <input id="fixture-api-key" type="password" defaultValue="fixture-not-a-secret" />
              <small>Inputs, textareas, selects, and editable fields are excluded automatically.</small>
            </form>

            <div className="boundary-card" data-threadmark-sensitive>
              <span>Explicit sensitive region</span>
              <strong>Customer account snapshot</strong>
              <p>Workspace token: redacted-example-value</p>
              <small>Protected by <code>data-threadmark-sensitive</code>.</small>
            </div>

            <div className="boundary-card" data-threadmark-ignore>
              <span>Explicitly ignored UI</span>
              <strong>Developer overlay controls</strong>
              <button type="button" onClick={() => setIgnoredActivations((count) => count + 1)}>
                Run diagnostic · {ignoredActivations}
              </button>
              <small>Excluded with <code>data-threadmark-ignore</code>.</small>
            </div>

            <div className="boundary-card analytics-internal">
              <span>Consumer selector</span>
              <strong>Internal analytics marker</strong>
              <p>Experiment cohort: fixture-a</p>
              <small>Excluded through <code>ignoredSelectors</code>.</small>
            </div>
          </div>
        </section>

        <section id="callback-log" className="callback-section">
          <FeedbackLog entries={feedbackEntries} onClear={() => setFeedbackEntries([])} />
        </section>
      </main>

      <footer>
        <span>Threadmark basic React fixture</span>
        <span>Annotations and approved screenshots stay in this browser. Nothing is sent over the network.</span>
      </footer>
    </>
  );
}
