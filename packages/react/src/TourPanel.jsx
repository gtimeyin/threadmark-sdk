import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon as ChevronDown } from "./icons.jsx";
import { ChevronUpIcon as ChevronUp } from "./icons.jsx";
import { CommentIcon as Chat } from "./icons.jsx";
import { CopyIcon as ClipboardCopy } from "./icons.jsx";
import { CloseIcon as X } from "./icons.jsx";
import { PlayIcon as Play } from "./icons.jsx";
import { DeleteIcon as Trash } from "./icons.jsx";
import { AddIcon, InfoIcon, CodeIcon, DragIcon, EditIcon, ModalIcon, SpotlightIcon, TargetingIcon, TooltipIcon, TourIcon } from "./icons.jsx";

import { resolveStableTarget } from "./resolveStableTarget.js";
import {
  addStep,
  createTour,
  moveStep,
  removeStep,
  serializeTour,
  stableIdSnippet,
  stepPagesOf,
  suggestTargetId,
  tourFileName,
  tourProblems,
  updateStep,
  updateTourSettings,
} from "./tours/authoring.js";
import { pathMatches } from "./tours/eligibility.js";

const iconProps = { "aria-hidden": true, className: "tm-tool-icon", focusable: "false" };
const START_OPTIONS = [
  ["pageLoad", "When the page loads"],
  ["wait", "A moment after it loads"],
  ["event", "After an app event"],
  ["manual", "Only when started from code"],
];

function startKind(start) {
  if (!start || start === "pageLoad") return "pageLoad";
  if (start === "manual") return "manual";
  if (start.on !== undefined) return "event";
  return "wait";
}

function startFor(kind, previous) {
  if (kind === "wait") return { after: "pageLoad", wait: previous?.wait || "2s" };
  if (kind === "event") return { on: previous?.on || "app.ready" };
  return kind;
}

const STYLE_ICONS = { tooltip: TooltipIcon, spotlight: SpotlightIcon, modal: ModalIcon };
const STYLE_OPTIONS = [["tooltip", "Tooltip"], ["spotlight", "Spotlight"], ["modal", "Modal"]];

/** "New sign-ups, on their first visit to /pricing. Once. If they skip, ask again after 7 days." (20c) */
export function describeWhoAndWhen(tour) {
  const showTo = tour?.showTo || {};
  const who = { desktop: "People on laptops and desktops", phone: "People on phones" }[showTo.device] || "Everyone";
  const page = showTo.path || "any page";
  const kind = startKind(tour?.start);
  const when = kind === "manual" ? "only when your code starts it"
    : kind === "event" ? `after the “${tour.start.on}” event`
      : kind === "wait" ? `a moment after ${page} loads` : `when ${page} loads`;
  const repeat = { untilFinished: "Until they finish it.", everyVisit: "Every visit." }[tour?.repeat] || "Once.";
  const skip = { "7d": "If they skip, ask again after 7 days.", "30d": "If they skip, ask again after a month." }[tour?.afterSkip] || "If they skip, it stays gone.";
  return `${who}, ${when}. ${repeat} ${skip}`;
}

/** Numbered marks on the page for the steps of the tour being edited. */
function useStepMarks(tour, route) {
  const [marks, setMarks] = useState([]);
  // Only what the marks show: editing a title or text doesn't re-subscribe the page observers.
  const pages = tour ? stepPagesOf(tour) : [];
  const marksKey = tour ? JSON.stringify(tour.steps.map((step, index) => [step.id, step.target, pages[index]])) : "";
  useEffect(() => {
    if (!marksKey) {
      setMarks([]);
      return undefined;
    }
    let frame = 0;
    const steps = JSON.parse(marksKey);
    const update = () => {
      frame = 0;
      setMarks(steps.flatMap(([id, target, page], index) => {
        if (page && !pathMatches(page, route)) return [];
        const found = resolveStableTarget(target);
        if (found.status !== "resolved") return [];
        const rect = found.element.getBoundingClientRect();
        if (!rect.width && !rect.height) return [];
        return [{ id, number: index + 1, left: rect.left, top: rect.top, width: rect.width, height: rect.height }];
      }));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-threadmark-id", "hidden", "class", "style"] });
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [marksKey, route]);
  return marks;
}

/**
 * Tour mode's panel: pick a tour, add steps by clicking the page, edit them, set who sees the tour,
 * try it, and save it back to code. Drafts live in the overlay until saved; nothing is sent anywhere.
 */
/**
 * 20e Save to code: the file, what's in it, and where it can go. "Send to <your AI>" appears only when
 * the host connects one (`onTourSendToAi` + `aiConnection`); Threadmark never edits code itself.
 */
function TourSaveSheet({ tour, onSave, onSendToAi, aiConnection, onConnectAi, onCopy, onClose, onStatus }) {
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const file = { fileName: tourFileName(tour), contents: serializeTour(tour) };
  const canSendToAi = Boolean(onSendToAi && aiConnection?.connected);
  const run = async (kind) => {
    setBusy(kind);
    setProblem("");
    try {
      if (kind === "copy") {
        const ok = await onCopy(file.contents);
        if (!ok) throw new Error("Your browser blocked the clipboard.");
        onStatus(`Copied. Paste it into ${file.fileName}.`);
      } else if (kind === "save") {
        const result = await onSave(tour, file);
        onStatus(`Saved ${typeof result?.path === "string" ? result.path : file.fileName}.`);
      } else {
        await onSendToAi(tour, file);
        onStatus(`Sent to ${aiConnection.name}. It asks before it changes anything.`);
      }
      onClose();
    } catch (error) {
      const reason = typeof error?.message === "string" && error.message ? ` ${error.message}` : "";
      setProblem(`${kind === "copy" ? "Couldn’t copy." : kind === "save" ? "Saving didn’t work." : `Couldn’t reach ${aiConnection.name}.`}${reason} Your draft is still here.`);
      setBusy(null);
    }
  };
  const primary = canSendToAi ? "ai" : onSave ? "save" : "copy";
  return (
    <div className="tm-sheet-layer" data-menu-open="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="tm-you tm-tour-save" role="dialog" aria-modal="true" aria-labelledby="tm-tour-save-title" tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); onClose(); }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); run(primary); }
        }}>
        <header className="tm-you__header">
          <CodeIcon aria-hidden="true" focusable="false" />
          <h2 id="tm-tour-save-title">Save {tour.title || "tour"}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><kbd className="tm-ui-key">Esc</kbd></button>
        </header>
        <div className="tm-you__body">
          <p className="tm-tour-save__file"><ClipboardCopy {...iconProps} /><code>{file.fileName}</code></p>
          <pre className="tm-tour-save__code" aria-label={`Contents of ${file.fileName}`}>{file.contents}</pre>
          <p className="tm-tour-save__tip"><InfoIcon {...iconProps} /><span>Add <code>npx threadmark tours check</code> to CI to catch missing targets.</span></p>
          {aiConnection && (
            <p className={`tm-tour-save__ai${aiConnection.connected ? " is-connected" : ""}`}>
              <span className="tm-tour-save__dot" aria-hidden="true" />
              <span>{(() => {
                const name = aiConnection.name.charAt(0).toUpperCase() + aiConnection.name.slice(1);
                return `${name} ${aiConnection.connected ? "is connected" : "isn’t connected"}${aiConnection.detail ? ` · ${aiConnection.detail}` : ""}`;
              })()}</span>
              {!aiConnection.connected && onConnectAi && <button type="button" onClick={() => { onClose(); onConnectAi(); }}>Connect</button>}
            </p>
          )}
          {problem && <p className="tm-tour-problems tm-tour-code-rule" role="alert">{problem}</p>}
          <footer className="tm-you__footer">
            <button type="button" className="tm-tour-secondary" disabled={Boolean(busy)} onClick={() => run("copy")}><ClipboardCopy {...iconProps} />Copy file</button>
            <span className="tm-tour-row">
              {onSave && <button type="button" className={primary === "save" ? "tm-tour-primary" : "tm-tour-secondary"} disabled={Boolean(busy)} onClick={() => run("save")}>{busy === "save" ? "Saving…" : "Save to project"}</button>}
              {canSendToAi && <button type="button" className="tm-tour-primary" disabled={Boolean(busy)} onClick={() => run("ai")}>{busy === "ai" ? "Sending…" : `Send to ${aiConnection.name.charAt(0).toUpperCase() + aiConnection.name.slice(1)}`}</button>}
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}

export function TourPanel({ drafts, activeId, onChange, pick, route, onPreview, onSave, onSendToAi, aiConnection, onConnectAi, onCopy, onClose, stepComments = {}, onCommentOnStep, onOpenComment, codeRuleTourIds = [] }) {
  const [tab, setTab] = useState("steps"); // "steps" | "who": editing who and when
  const [openStepId, setOpenStepId] = useState(null);
  const [untagged, setUntagged] = useState(null);
  const [status, setStatus] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [undo, setUndo] = useState(null);
  // After a change re-renders the list, put focus where the person is working instead of dropping it.
  const focusLater = (selector) => requestAnimationFrame(() => {
    const target = panelRef.current?.querySelector(selector);
    (target || panelRef.current?.querySelector("h2"))?.focus?.({ preventScroll: true });
  });
  const handledPick = useRef(pick?.nonce ?? null);
  const panelRef = useRef(null);

  const tour = drafts.find((item) => item.id === activeId) || null;
  const problems = tour ? tourProblems(tour) : [];
  const hasCodeRule = Boolean(tour && codeRuleTourIds.includes(tour.id));
  const marks = useStepMarks(tour, route);

  const commit = (nextTour, nextActive = nextTour.id) => {
    setUndo(null);
    onChange(drafts.some((item) => item.id === activeId) ? drafts.map((item) => (item.id === activeId ? nextTour : item)) : [...drafts, nextTour], nextActive);
    setStatus("");
  };

  const newTour = () => {
    const created = createTour({ title: "New tour", path: route, takenIds: drafts.map((item) => item.id) });
    onChange([...drafts, created], created.id);
    setTab("steps");
    setOpenStepId(null);
    setStatus("");
  };

  // A click on the page arrives here as a pick: tagged elements become steps; others get a stable id to add.
  useEffect(() => {
    if (!pick || pick.nonce === handledPick.current) return;
    handledPick.current = pick.nonce;
    if (!pick.stableId) {
      const suggestion = suggestTargetId({ name: pick.name, tag: pick.tag });
      setUntagged({ name: pick.name || pick.tag, suggestion, snippet: stableIdSnippet(suggestion), copied: false });
      return;
    }
    setUntagged(null);
    if (pick.ambiguous) {
      setStatus(`More than one element on this page uses “${pick.stableId}”, so a tour can’t point at it. Give each one its own id.`);
      return;
    }
    // Clicking something that's already a step opens that step instead of adding a duplicate.
    const existing = tour?.steps.findIndex((item, index) => item.target === pick.stableId && (!stepPagesOf(tour)[index] || pathMatches(stepPagesOf(tour)[index], route)));
    if (tour && existing >= 0) {
      setTab("steps");
      setOpenStepId(tour.steps[existing].id);
      setStatus(`That’s already step ${existing + 1}.`);
      return;
    }
    const base = tour || createTour({ title: "New tour", path: route, takenIds: drafts.map((item) => item.id) });
    const next = addStep(base, { target: pick.stableId, title: pick.name ? pick.name.slice(0, 60) : undefined, page: route });
    const added = next.steps[next.steps.length - 1];
    if (tour) commit(next);
    else onChange([...drafts, next], next.id);
    setTab("steps");
    setOpenStepId(added.id);
    setStatus(`Added step ${next.steps.length}. Give it a title people will understand.`);
  }, [pick?.nonce]);

  useEffect(() => {
    if (!openStepId) return;
    panelRef.current?.querySelector(`[data-step-id="${CSS.escape(openStepId)}"] input`)?.focus({ preventScroll: true });
    // Bring the step's element into view so its numbered mark is on screen.
    const step = tour?.steps.find((item) => item.id === openStepId);
    const found = step ? resolveStableTarget(step.target) : null;
    if (found?.status === "resolved") {
      const rect = found.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        found.element.scrollIntoView({ block: "center", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }
  }, [openStepId]);

  // Opening Tour mode puts focus in the panel.
  useEffect(() => { panelRef.current?.querySelector("h2")?.focus({ preventScroll: true }); }, []);

  async function copy() {
    const ok = await onCopy(serializeTour(tour));
    setStatus(ok ? `Copied. Paste it into ${tourFileName(tour)}.` : "Couldn’t copy. Your browser blocked the clipboard.");
  }

  async function copySnippet() {
    if (await onCopy(untagged.snippet)) setUntagged({ ...untagged, copied: true });
  }

  return (
    <>
      {marks.map((mark) => (
        <span key={mark.id} className="tm-tour-mark" aria-hidden="true" style={{ left: mark.left - 4, top: mark.top - 4, width: mark.width + 8, height: mark.height + 8 }}>
          <span>{mark.number}</span>
        </span>
      ))}
      <aside ref={panelRef} id="tm-tour-panel" className="tm-comments-panel tm-tour-panel" aria-label="Tour">
        <div className="tm-comments-header tm-tour-header">
          <TourIcon {...iconProps} />
          <h2 tabIndex={-1}>{tour?.title || "Tour"}</h2>
          {tour && <button type="button" className="tm-tour-rename" aria-label="Rename tour" title="Rename tour" onClick={() => setTab("who")}><EditIcon {...iconProps} /></button>}
          <div className="tm-comments-actions">
            <button type="button" aria-label="Back to review" title="Back to review (Esc)" onClick={onClose}><X {...iconProps} /></button>
          </div>
        </div>

        <div className="tm-tour-picker">
          <label>
            <span>Editing</span>
            <select value={activeId || ""} onChange={(event) => { onChange(drafts, event.target.value || null); setOpenStepId(null); setStatus(""); }}>
              {!tour && <option value="">No tour yet</option>}
              {drafts.map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
            </select>
          </label>
          <button type="button" className="tm-tour-secondary" onClick={newTour}>New tour</button>
        </div>

        {!tour && <p className="tm-tour-add"><AddIcon {...iconProps} />Click anything on the page to start a tour, or pick one above.</p>}

        {untagged && (
          <div className="tm-tour-untagged" role="status">
            <strong>“{untagged.name}” needs a stable id first</strong>
            <p>Tours only point at elements with a stable id, so they keep working when the page changes. Add this to the element in your code:</p>
            <code>{untagged.snippet}</code>
            <div className="tm-tour-row">
              <button type="button" className="tm-tour-secondary" onClick={() => setUntagged(null)}>Dismiss</button>
              <button type="button" className="tm-tour-secondary" onClick={copySnippet}>{untagged.copied ? "Copied" : "Copy snippet"}</button>
            </div>
          </div>
        )}

        {tour && (
          <>
            {tab === "steps" ? (<div className="tm-tour-scroll">
              <p className="tm-tour-section"><span>Steps</span><span>{tour.steps.length} step{tour.steps.length === 1 ? "" : "s"}{new Set(stepPagesOf(tour).filter(Boolean)).size > 1 ? ` · ${new Set(stepPagesOf(tour).filter(Boolean)).size} pages` : ""}</span></p>
              <ol className="tm-tour-steps">
                {!tour.steps.length && <li className="tm-tour-empty">No steps yet. Click an element on the page to add the first one.</li>}
                {tour.steps.map((step, index) => {
                  const open = openStepId === step.id;
                  const page = stepPagesOf(tour)[index];
                  const elsewhere = page && !pathMatches(page, route);
                  const comments = stepComments[`${tour.id}:${step.id}`] || [];
                  const openComments = comments.filter((item) => !item.resolved).length;
                  return (
                    <li key={step.id} className={`tm-tour-step${open ? " is-open" : ""}`} data-step-id={step.id}>
                      <div className="tm-tour-step-head">
                        <DragIcon {...iconProps} className="tm-tool-icon tm-tour-grip" />
                        <span className="tm-tour-number" aria-hidden="true">{index + 1}</span>
                        <button type="button" className="tm-tour-step-summary" aria-expanded={open} onClick={() => setOpenStepId(open ? null : step.id)}>
                          <strong>{step.title || "Untitled step"}</strong>
                          <code>{[page, `#${step.target}`].filter(Boolean).join(" · ")}</code>
                        </button>
                        {(() => { const StyleIcon = STYLE_ICONS[step.style || "spotlight"] || SpotlightIcon; return <StyleIcon {...iconProps} className="tm-tool-icon tm-tour-style-icon" />; })()}
                        <div className="tm-tour-step-actions">
                          {comments.length > 0 && (
                            <button type="button" className="tm-tour-comment-count" aria-label={`${comments.length} comment${comments.length === 1 ? "" : "s"} on step ${index + 1}`}
                              onClick={() => setOpenStepId(step.id)}>
                              <Chat {...iconProps} /><span>{openComments || comments.length}</span>
                            </button>
                          )}
                          <button type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0}
                            onClick={() => { commit(moveStep(tour, step.id, -1)); focusLater(`[data-step-id="${CSS.escape(step.id)}"] [aria-label^="Move step"][aria-label$="up"]:not(:disabled), [data-step-id="${CSS.escape(step.id)}"] .tm-tour-step-summary`); }}><ChevronUp {...iconProps} /></button>
                          <button type="button" aria-label={`Move step ${index + 1} down`} disabled={index === tour.steps.length - 1}
                            onClick={() => { commit(moveStep(tour, step.id, 1)); focusLater(`[data-step-id="${CSS.escape(step.id)}"] [aria-label^="Move step"][aria-label$="down"]:not(:disabled), [data-step-id="${CSS.escape(step.id)}"] .tm-tour-step-summary`); }}><ChevronDown {...iconProps} /></button>
                          <button type="button" aria-label={`Delete step ${index + 1}`} onClick={() => {
                            const removed = step;
                            const before = tour;
                            commit(removeStep(tour, step.id));
                            if (open) setOpenStepId(null);
                            // Deleting is instant, so offer it back (board 07's "Undo" pattern).
                            setUndo({ label: `Deleted step ${index + 1}${removed.title ? `, “${removed.title}”` : ""}.`, tour: before });
                            const nextStep = tour.steps[index + 1] || tour.steps[index - 1];
                            focusLater(nextStep ? `[data-step-id="${CSS.escape(nextStep.id)}"] .tm-tour-step-summary` : ".tm-tour-undo button");
                          }}><Trash {...iconProps} /></button>
                        </div>
                      </div>
                      {open && (
                        <div className="tm-tour-fields">
                          <label><span>Title</span>
                            <input value={step.title} maxLength={120} onChange={(event) => commit(updateStep(tour, step.id, { title: event.target.value }))} />
                          </label>
                          <label><span>What should they know?</span>
                            <textarea rows={3} value={step.body || ""} maxLength={600} onChange={(event) => commit(updateStep(tour, step.id, { body: event.target.value }))} />
                          </label>
                          <label><span>Moves on when</span>
                            <select value={step.next || "button"} onChange={(event) => commit(updateStep(tour, step.id, { next: event.target.value }))}>
                              <option value="button">They press Next</option>
                              <option value="click">They use the element</option>
                            </select>
                          </label>
                          <div className="tm-tour-styles" role="radiogroup" aria-label="Style">
                            {STYLE_OPTIONS.map(([value, label]) => {
                              const Icon = STYLE_ICONS[value];
                              const selected = (step.style || "spotlight") === value;
                              return (
                                <button key={value} type="button" role="radio" aria-checked={selected} className={selected ? "is-selected" : undefined}
                                  onClick={() => commit(updateStep(tour, step.id, { style: value }))}>
                                  <Icon {...iconProps} /><span>{label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="tm-tour-comments">
                            <span className="tm-tour-comments-label">Talk it over</span>
                            {comments.length > 0 && (
                              <ul>
                                {comments.map((item) => (
                                  <li key={item.id}>
                                    <button type="button" onClick={() => onOpenComment?.(item.id)}>
                                      <strong>{item.author}</strong>
                                      <span>{item.comment}</span>
                                      <small>{[item.replies ? `${item.replies} repl${item.replies === 1 ? "y" : "ies"}` : null, item.resolved ? "Resolved" : null].filter(Boolean).join(" · ")}</small>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <button type="button" className="tm-tour-secondary" disabled={elsewhere || !onCommentOnStep}
                              onClick={() => onCommentOnStep({ tourId: tour.id, stepId: step.id, target: step.target })}>
                              <Chat {...iconProps} />Comment on this step
                            </button>
                            {elsewhere && <span className="tm-tour-note">Go to {page} to comment on this step.</span>}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="tm-tour-add"><AddIcon {...iconProps} />Click anything on the page to add a step</p>
              <div className="tm-tour-who">
                <p className="tm-tour-section"><span><TargetingIcon {...iconProps} />Who and when</span>
                  <button type="button" aria-label="Edit who and when" onClick={() => { setTab("who"); focusLater(".tm-tour-settings input"); }}>Edit</button></p>
                <p className="tm-tour-who__text">{describeWhoAndWhen(tour)}</p>
              </div>
            </div>) : (
              <div className="tm-tour-fields tm-tour-settings">
                <p className="tm-tour-section"><span><TargetingIcon {...iconProps} />Who and when</span>
                  <button type="button" onClick={() => { setTab("steps"); focusLater('[aria-label="Edit who and when"]'); }}>Done</button></p>
                <label><span>Tour name</span>
                  <input value={tour.title} maxLength={120} onChange={(event) => commit({ ...tour, title: event.target.value }, tour.id)} />
                </label>
                <label><span>Tour id (also the file name)</span>
                  <input value={tour.id} maxLength={120} spellCheck={false} onChange={(event) => {
                    const id = event.target.value.trim();
                    if (id && !drafts.some((item) => item !== tour && item.id === id)) commit({ ...tour, id }, id);
                  }} />
                </label>
                <label><span>Starts on page</span>
                  <input value={tour.showTo?.path || ""} placeholder="Any page" onChange={(event) => commit(updateTourSettings(tour, { showTo: { ...tour.showTo, path: event.target.value } }))} />
                </label>
                <label><span>Screens</span>
                  <select value={tour.showTo?.device || "any"} onChange={(event) => commit(updateTourSettings(tour, { showTo: { ...tour.showTo, device: event.target.value } }))}>
                    <option value="any">All screens</option>
                    <option value="desktop">Laptops and desktops</option>
                    <option value="phone">Phones</option>
                  </select>
                </label>
                <label><span>Starts</span>
                  <select value={startKind(tour.start)} onChange={(event) => commit(updateTourSettings(tour, { start: startFor(event.target.value, tour.start) }))}>
                    {START_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {startKind(tour.start) === "event" && (
                  <label><span>App event name</span>
                    <input value={tour.start.on} onChange={(event) => commit(updateTourSettings(tour, { start: { on: event.target.value } }))} />
                  </label>
                )}
                <label><span>Shows</span>
                  <select value={tour.repeat || "once"} onChange={(event) => commit(updateTourSettings(tour, { repeat: event.target.value }))}>
                    <option value="once">Once</option>
                    <option value="untilFinished">Until they finish it</option>
                    <option value="everyVisit">Every visit</option>
                  </select>
                </label>
                <label><span>If they skip it</span>
                  <select value={tour.afterSkip || "never"} onChange={(event) => commit(updateTourSettings(tour, { afterSkip: event.target.value }))}>
                    <option value="never">It stays gone</option>
                    <option value="7d">It can come back after a week</option>
                    <option value="30d">It can come back after a month</option>
                  </select>
                </label>
                <p className="tm-tour-note">Rules about who someone is, like their role or when they signed up, go in the file as <code>showTo.traits</code>.</p>
              </div>
            )}

            <div className="tm-tour-footer">
              {problems.length > 0 && (
                <ul className="tm-tour-problems">
                  {problems.slice(0, 3).map((problem) => <li key={problem.path}>{problem.message}{problem.path !== "steps" ? ` (${problem.path})` : ""}</li>)}
                </ul>
              )}
              {hasCodeRule && (
                <p className="tm-tour-problems tm-tour-code-rule">This tour has a <code>showTo.when</code> rule written in code, which a tour file can’t hold. Edit it in its file; saving from here would drop the rule.</p>
              )}
              {undo && (
                <p className="tm-tour-status tm-tour-undo" role="status">{undo.label}
                  <button type="button" onClick={() => { commit(undo.tour); setUndo(null); }}>Undo</button></p>
              )}
              {status && <p className="tm-tour-status" role="status">{status}</p>}
              <div className="tm-tour-row">
                <button type="button" className="tm-tour-secondary" disabled={problems.length > 0} onClick={() => onPreview(tour)}><Play {...iconProps} />Try it</button>
                <button type="button" className="tm-tour-secondary" disabled={hasCodeRule} onClick={copy}><ClipboardCopy {...iconProps} />Copy file</button>
                {(onSave || onSendToAi) && <button type="button" className="tm-tour-primary" disabled={problems.length > 0 || hasCodeRule} onClick={() => setSaveOpen(true)}><CodeIcon {...iconProps} />Save to code</button>}
              </div>
              <p className="tm-tour-file"><code>{tourFileName(tour)}</code></p>
            </div>
          </>
        )}
        {!tour && drafts.length === 0 && (
          <div className="tm-comments-empty">
            <p>Tours walk people through your product one step at a time. Each step points at an element on the page.</p>
            <button type="button" onClick={newTour}>Start a tour</button>
          </div>
        )}
      </aside>
      {saveOpen && tour && (
        <TourSaveSheet tour={tour} onSave={onSave} onSendToAi={onSendToAi} aiConnection={aiConnection} onConnectAi={onConnectAi}
          onCopy={onCopy} onClose={() => setSaveOpen(false)} onStatus={setStatus} />
      )}
    </>
  );
}
