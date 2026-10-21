import { useEffect, useRef, useState } from "react";
import { AltArrowDownIcon as ChevronDown } from "@solar-icons/react/linear/alt-arrow-down";
import { AltArrowUpIcon as ChevronUp } from "@solar-icons/react/linear/alt-arrow-up";
import { ClipboardCopyIcon as ClipboardCopy } from "@solar-icons/react/linear/clipboard-copy";
import { CloseIcon as X } from "@solar-icons/react/linear/close";
import { DisketteIcon as Diskette } from "@solar-icons/react/linear/diskette";
import { PlayIcon as Play } from "@solar-icons/react/linear/play";
import { TrashBinTrashIcon as Trash } from "@solar-icons/react/linear/trash-bin-trash";

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

/** Numbered marks on the page for the steps of the tour being edited. */
function useStepMarks(tour, route) {
  const [marks, setMarks] = useState([]);
  useEffect(() => {
    if (!tour) {
      setMarks([]);
      return undefined;
    }
    let frame = 0;
    const pages = stepPagesOf(tour);
    const update = () => {
      frame = 0;
      setMarks(tour.steps.flatMap((step, index) => {
        if (pages[index] && !pathMatches(pages[index], route)) return [];
        const found = resolveStableTarget(step.target);
        if (found.status !== "resolved") return [];
        const rect = found.element.getBoundingClientRect();
        if (!rect.width && !rect.height) return [];
        return [{ id: step.id, number: index + 1, left: rect.left, top: rect.top, width: rect.width, height: rect.height }];
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
  }, [tour, route]);
  return marks;
}

/**
 * Tour mode's panel: pick a tour, add steps by clicking the page, edit them, set who sees the tour,
 * try it, and save it back to code. Drafts live in the overlay until saved; nothing is sent anywhere.
 */
export function TourPanel({ drafts, activeId, onChange, pick, route, onPreview, onSave, onCopy, onClose }) {
  const [tab, setTab] = useState("steps");
  const [openStepId, setOpenStepId] = useState(null);
  const [untagged, setUntagged] = useState(null);
  const [status, setStatus] = useState("");
  const handledPick = useRef(pick?.nonce ?? null);
  const panelRef = useRef(null);

  const tour = drafts.find((item) => item.id === activeId) || null;
  const problems = tour ? tourProblems(tour) : [];
  const marks = useStepMarks(tour, route);

  const commit = (nextTour, nextActive = nextTour.id) => {
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
    panelRef.current?.querySelector(`[data-step-id="${CSS.escape(openStepId)}"] input`)?.focus();
  }, [openStepId]);

  async function save() {
    setStatus("Saving…");
    try {
      await onSave(tour, { fileName: tourFileName(tour), contents: serializeTour(tour) });
      setStatus(`Saved ${tourFileName(tour)}.`);
    } catch {
      setStatus("Saving didn’t work. Your draft is still here; try again or copy the file.");
    }
  }

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
        <div className="tm-comments-header">
          <div className="tm-comments-heading">
            <h2>Tour</h2>
            <p>{tour ? "Click anything on the page to add a step." : "Click anything on the page to start a tour, or pick one below."}</p>
          </div>
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
            <div className="tm-panel-tabs" role="tablist" aria-label="Tour sections">
              <button type="button" role="tab" aria-selected={tab === "steps"} onClick={() => setTab("steps")}>Steps <span>{tour.steps.length}</span></button>
              <button type="button" role="tab" aria-selected={tab === "who"} onClick={() => setTab("who")}>Who and when</button>
            </div>

            {tab === "steps" ? (
              <ol className="tm-tour-steps">
                {!tour.steps.length && <li className="tm-tour-empty">No steps yet. Click an element on the page to add the first one.</li>}
                {tour.steps.map((step, index) => {
                  const open = openStepId === step.id;
                  const page = stepPagesOf(tour)[index];
                  const elsewhere = page && !pathMatches(page, route);
                  return (
                    <li key={step.id} className={`tm-tour-step${open ? " is-open" : ""}`} data-step-id={step.id}>
                      <div className="tm-tour-step-head">
                        <span className="tm-tour-number" aria-hidden="true">{index + 1}</span>
                        <button type="button" className="tm-tour-step-summary" aria-expanded={open} onClick={() => setOpenStepId(open ? null : step.id)}>
                          <strong>{step.title || "Untitled step"}</strong>
                          <code>{step.target}{elsewhere ? ` · ${page}` : ""}</code>
                        </button>
                        <div className="tm-tour-step-actions">
                          <button type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => commit(moveStep(tour, step.id, -1))}><ChevronUp {...iconProps} /></button>
                          <button type="button" aria-label={`Move step ${index + 1} down`} disabled={index === tour.steps.length - 1} onClick={() => commit(moveStep(tour, step.id, 1))}><ChevronDown {...iconProps} /></button>
                          <button type="button" aria-label={`Delete step ${index + 1}`} onClick={() => { commit(removeStep(tour, step.id)); if (open) setOpenStepId(null); }}><Trash {...iconProps} /></button>
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
                          <label><span>Style</span>
                            <select value={step.style || "spotlight"} onChange={(event) => commit(updateStep(tour, step.id, { style: event.target.value }))}>
                              <option value="spotlight">Spotlight</option>
                              <option value="tooltip">Tooltip</option>
                              <option value="modal">Modal</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="tm-tour-fields tm-tour-settings">
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
              {status && <p className="tm-tour-status" role="status">{status}</p>}
              <div className="tm-tour-row">
                <button type="button" className="tm-tour-secondary" disabled={problems.length > 0} onClick={() => onPreview(tour)}><Play {...iconProps} />Try it</button>
                <button type="button" className="tm-tour-secondary" onClick={copy}><ClipboardCopy {...iconProps} />Copy file</button>
                {onSave && <button type="button" className="tm-tour-primary" disabled={problems.length > 0} onClick={save}><Diskette {...iconProps} />Save to code</button>}
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
    </>
  );
}
