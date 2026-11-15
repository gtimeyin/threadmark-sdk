import { createLocalReactionHandler } from "./reactionsDemo.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Threadmark, saveTourToDevServer, threadmarkTarget } from "threadmark-react";
import { ThreadmarkTours, useThreadmarkTours } from "threadmark-react/tours";
import { ThreadmarkSurveys, summarizeSurveyAnswers } from "threadmark-react/surveys";
import { createLocalPageReviewer } from "./localPageReviewer.js";
import { createFeedbackStore } from "./feedbackStore.js";

import welcomeTour from "./tours/welcome.tour.json";

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is optional in the example.
  }
}

function TourButton() {
  const tours = useThreadmarkTours();
  return <button type="button" className="tour-button" onClick={() => tours.start("parcel-welcome")}>Take the tour</button>;
}

const IGNORED_SELECTORS = [".analytics-internal", ".event-log"];
const MAX_LOG_ENTRIES = 6;
const PROJECT_KEY = "pk_threadmark_basic_react";
// What a transcription service might send back for a video. Built from the recorded steps and moments here;
// a real host would write it from the audio and frames.
function exampleVideoNotes(feedback) {
  const video = feedback.video;
  const targets = feedback.targets || [];
  const steps = (video.events || []).slice(0, 4).map((event) => {
    const name = targets[event.targetIndex]?.accessibleName || targets[event.targetIndex]?.visibleText || "the page";
    const verb = event.type === "click" ? "Clicks" : event.type === "input" ? "Types in" : event.type === "scroll" ? "Scrolls" : "Moves to";
    return { offsetMs: event.offsetMs, text: `${verb} ${name}.` };
  });
  const summary = steps.length ? steps : [{ offsetMs: 0, text: "Talks through the page without clicking anything." }];
  return {
    status: "ready",
    summary,
    transcript: summary.map((line) => ({ offsetMs: line.offsetMs, text: `(Example transcript) ${line.text}` })),
    chapters: (video.moments || []).map((moment, index) => ({ offsetMs: moment.offsetMs, text: `Moment ${index + 1}` })),
    ...(video.microphone ? {} : { silent: true }),
  };
}

const EXAMPLE_AI_TEXT = {
  "unnamed-control": { category: "accessibility", title: "This control has no name", detail: "Screen readers announce it as just “button”." },
  "missing-alt": { category: "accessibility", title: "Image has no description", detail: "Add alt text, or alt=\"\" if it's decoration." },
  "heading-jump": { category: "layout", title: "Heading skips a level", detail: "It jumps past a level, which makes the outline hard to follow." },
  "small-text": { category: "accessibility", title: "Text is very small", detail: "Under 12px is hard to read for many people." },
  "horizontal-overflow": { category: "layout", title: "Runs off the side", detail: "This sticks out past the edge at this width." },
};
const EXAMPLE_FACES = ["maya", "jo", "ade", "kemi", "sam", "ojie", "kai", "tobi"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), url: `/faces/${id}.jpg` }));

const REVIEWER = {
  id: "user_emily_r",
  displayName: "Emily R.",
};
const CURRENT_BUILD_ID = "basic-react-2026-08";
const PREVIOUS_BUILD_ID = "basic-react-2026-07";
const feedbackStore = createFeedbackStore({ projectKey: PROJECT_KEY, route: "/" });
const localPageReviewer = createLocalPageReviewer({ store: feedbackStore, projectKey: PROJECT_KEY });

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
  // Your face, name and notification settings: host-owned too. Faces are served from public/faces.
  const [me, setMe] = useState(() => readJson("example:me", REVIEWER));
  const [notificationSettings, setNotificationSettings] = useState(() => readJson("example:notification-settings", { myPages: false, digest: "daily" }));
  // People with access and the share link: host-owned. A real app would call its server here.
  const [members, setMembers] = useState(() => readJson("example:members", [
    { id: "example-sam", displayName: "Sam Okafor", email: "sam@studio.co", avatarUrl: "/faces/sam.jpg", role: "comment" },
    { id: "example-karin", displayName: "Karin", role: "view", guest: true, note: "link expires in 7 days" },
  ]));
  useEffect(() => writeJson("example:members", members), [members]);
  const [linkAccess, setLinkAccess] = useState("comment");
  // Stand-in for the host's next steps. A real app writes these from its open feedback (with AI or by hand).
  const [nextSteps, setNextSteps] = useState(() => [
    { id: "step-hero", title: "Shorten the pricing hero on phones", tag: "polish", source: "ai", completed: false },
    { id: "step-tax", title: "Show prices with and without tax for EU visitors", tag: "copy", source: "person", completed: false },
  ]);
  // Surveys and their answers are host-owned too; this example keeps them in localStorage.
  const [surveys, setSurveys] = useState(() => readJson("example:surveys", []));
  const [surveyAnswers, setSurveyAnswers] = useState(() => readJson("example:survey-answers", []));
  useEffect(() => writeJson("example:surveys", surveys), [surveys]);
  useEffect(() => writeJson("example:survey-answers", surveyAnswers), [surveyAnswers]);
  const surveyResults = useMemo(() => Object.fromEntries(surveys.map((survey) => [survey.id, summarizeSurveyAnswers(survey, surveyAnswers)])), [surveys, surveyAnswers]);
  const answerCounts = useMemo(() => Object.fromEntries(Object.entries(surveyResults).map(([id, result]) => [id, result.total])), [surveyResults]);
  // Notifications are host-owned. This stand-in shows the Inbox tab and the bar's New reply mood.
  const [notifications, setNotifications] = useState(() => [
    { id: "demo-mention", kind: "mention", actor: { id: "example-sam", displayName: "Sam Okafor" }, text: "@You can we keep the word launch in the headline?", route: "/", target: "Heading · Launch", createdAt: new Date(Date.now() - 4 * 60000).toISOString() },
    { id: "demo-reply", kind: "reply", actor: { id: "example-sam", displayName: "Sam Okafor" }, text: "Changed it on the preview, have a look.", route: "/", target: "Button · Start free", createdAt: new Date(Date.now() - 50 * 60000).toISOString(), read: true },
  ]);
  const handleReactionChange = useMemo(() => createLocalReactionHandler({ store: feedbackStore, reviewer: REVIEWER, onRecords: setAnnotations }), []);
  const [status, setStatus] = useState("booting");
  // Tour mode's "Save to code" writes the tour file through threadmark-react/vite; the new version also
  // replaces the bundled one for this session, so it plays right away.
  const [tours, setTours] = useState([welcomeTour]);
  const saveTour = useCallback(async (tour, file) => {
    const result = await saveTourToDevServer(tour, file);
    setTours((current) => [...current.filter((item) => item.id !== tour.id), tour]);
    return result;
  }, []);
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
    // Poll votes live beside the record, so keep them when a reply or edit saves the thread again.
    const poll = context?.poll || annotations.find((item) => item.feedback.id === feedback.id)?.context?.poll;
    // A stand-in for a host that transcribes videos: notes show as "processing", then fill in (board 02, 7f-7g).
    const newVideo = feedback.captureKind === "video" && feedback.video && !feedback.video.notes;
    const saved = newVideo ? { ...feedback, video: { ...feedback.video, notes: { status: "processing" } } } : feedback;
    const record = { feedback: saved, context: poll ? { ...context, poll } : context };
    await feedbackStore.upsert(saved, record.context);
    setAnnotations((current) => [
      ...current.filter((item) => item.feedback.id !== feedback.id),
      record,
    ]);
    if (newVideo) {
      setTimeout(async () => {
        const ready = { ...saved, video: { ...saved.video, notes: exampleVideoNotes(saved) } };
        await feedbackStore.upsert(ready, record.context);
        setAnnotations((current) => current.map((item) => (item.feedback.id === ready.id ? { ...item, feedback: ready } : item)));
      }, 4000);
    }
    setFeedbackEntries((current) => [
      logEntry(record),
      ...current.filter((item) => item.feedback.id !== feedback.id),
    ].slice(0, MAX_LOG_ENTRIES));
  }, [annotations]);

  // A host-owned vote: store this reviewer's choice and return the poll's results.
  const handlePollVote = useCallback(async (feedback, optionIds) => {
    const record = annotations.find((item) => item.feedback.id === feedback.id);
    const voters = (record?.context?.poll?.voters || []).filter((voter) => voter.reviewer.id !== REVIEWER.id);
    if (optionIds.length) voters.push({ reviewer: REVIEWER, optionIds: [...optionIds] });
    const counts = {};
    for (const voter of voters) for (const id of voter.optionIds) counts[id] = (counts[id] || 0) + 1;
    const poll = { counts, total: voters.length, mine: [...optionIds], voters };
    const context = { ...(record?.context || { evidence: [] }), poll };
    await feedbackStore.upsert(record?.feedback || feedback, context);
    setAnnotations((current) => current.map((item) => (item.feedback.id === feedback.id ? { ...item, context } : item)));
    return poll;
  }, [annotations]);

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
        onPageReviewRequested={async (input, context) => {
          const result = await localPageReviewer(input, context);
          if (!context.signal.aborted) {
            setAnnotations(result.records);
            setFeedbackEntries(result.records.map(logEntry).reverse().slice(0, MAX_LOG_ENTRIES));
          }
          return result;
        }}
        projectKey={PROJECT_KEY}
        reviewer={me}
        faces={EXAMPLE_FACES}
        projectName="Parcel"
        notificationSettings={notificationSettings}
        onReviewerChange={(change) => { const next = { ...me, ...change }; setMe(next); writeJson("example:me", next); }}
        onNotificationSettingsChange={(settings) => { setNotificationSettings(settings); writeJson("example:notification-settings", settings); }}
        // AI review stand-ins. A real app calls its model here; this example turns the built-in page checks into findings.
        onAiReview={async ({ page, report }) => {
          report({ checked: 0, total: page.findings.length });
          await new Promise((resolve) => setTimeout(resolve, 900));
          report({ checked: page.findings.length });
          return { checked: page.findings.length, findings: page.findings.map((finding, index) => ({ id: `example-${index}`, target: finding.target, ...EXAMPLE_AI_TEXT[finding.rule] })) };
        }}
        onAskAi={async ({ label, question }) => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return question
            ? { points: [`(Example answer) Your model would answer “${question}” about ${label} here.`] }
            : { points: [`(Example) Your model would look at ${label} here.`, "Connect one through onAskAi."], fix: "Pass onAskAi to <Threadmark> and call your AI provider." };
        }}
        // Sending to trackers lives in your dashboard; the overlay links there.
        dashboardUrl="https://app.example.com/parcel"
        shareUrl={`${window.location.origin}/r/parcel`}
        linkAccess={linkAccess}
        onLinkAccessChange={setLinkAccess}
        members={[{ ...me, role: "owner", you: true }, ...members]}
        inviteSuggestions={[
          { id: "jo", displayName: "Jo Bello", email: "jo@studio.co", note: "in your studio" },
          { id: "joanna", displayName: "Joanna Reid", email: "joanna@client.com", note: "worked on Pricing" },
        ]}
        onInvite={({ entries, role }) => setMembers((list) => [...entries.map((entry) => ({ id: `invite-${entry}`, displayName: entry.includes("@") ? undefined : entry, email: entry.includes("@") ? entry : undefined, role, pending: true })), ...list])}
        onMemberChange={(id, change) => setMembers((list) => change.remove ? list.filter((member) => member.id !== id) : list.map((member) => member.id === id ? { ...member, role: change.role } : member))}
        onResendInvite={() => {}}
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
        onReactionChange={handleReactionChange}
        onFeedbackDelete={handleFeedbackDelete}
        onFeedbackClear={handleFeedbackClear}
        onPageVersionSelect={(version) => setActiveBuildId(version.buildId || CURRENT_BUILD_ID)}
        onFeedbackCarryForward={handleCarryForward}
        onPollVote={handlePollVote}
        notifications={notifications}
        surveys={surveys}
        surveyResults={surveyResults}
        onSurveyPublish={(survey) => setSurveys((list) => [...list.filter((item) => item.id !== survey.id), survey])}
        onSurveyEnd={(id) => setSurveys((list) => list.map((item) => (item.id === id ? { ...item, status: "ended" } : item)))}
        onNotificationOpen={(item) => console.info("[example] opened notification", item.id)}
        nextSteps={nextSteps}
        onNextStepDone={(step, done) => setNextSteps((list) => list.map((item) => (item.id === step.id ? { ...item, completed: done, completedVia: done ? "person" : null, completedBy: done ? { displayName: me.displayName } : null } : item)))}
        onLeaveProject={async () => { window.alert("Your app removes you from the project here."); }}
        onSignOut={() => window.alert("Your app signs you out here.")}
        onAiDismiss={(finding, reason) => console.info("[example] dismissed AI finding", finding.id, reason)}
        onConnectAi={() => window.alert("Your app connects its coding AI here.")}
        onNotificationsRead={(ids) => setNotifications((list) => list.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)))}
        tours={tours}
        onTourSave={saveTour}
        // A stand-in for a connected coding AI. A real app hands the file to its AI here.
        aiConnection={{ name: "your AI (example)", connected: true, detail: "nothing is sent" }}
        onTourSendToAi={async () => { await new Promise((resolve) => setTimeout(resolve, 400)); }}
        sessionReplay
        onError={(error) => setStatus(`error:${error.code}`)}
      />
      <ThreadmarkTours tours={tours} theme={{ accent: "#0b4f3a" }} />
      <ThreadmarkSurveys
        surveys={surveys}
        answerCounts={answerCounts}
        onAnswer={(answer) => setSurveyAnswers((list) => (list.some((item) => item.key === answer.key) ? list : [...list, answer]))}
      />

      {new URLSearchParams(location.search).has('agent-demo') && <section aria-label="Agent review examples" style={{ margin: '32px auto', maxWidth: 1040, padding: 24, background: '#DCEBE5', borderRadius: 12 }}>
        <h2>Try a Threadmark Agent review</h2>
        <p>These sample elements have intentional issues. Open Review page, then Ask Threadmark to add comments.</p>
        <h4 data-threadmark-id="agent-demo-heading">A heading that skips a level</h4>
        <p data-threadmark-id="agent-demo-small-text" style={{ fontSize: 11 }}>This sample text is harder to read at a small size.</p>
        <span>An unnamed control: </span><button data-threadmark-id="agent-demo-button" style={{ width: 40, height: 32 }} />
      </section>}

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Parcel home">
          <span>P</span>
          Parcel
        </a>
        <nav aria-label="Primary navigation">
          <a href="#review-targets">Targets</a>
          <a href="#privacy-boundaries">Privacy</a>
          <a href="#callback-log">Callback</a>
          <TourButton />
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
