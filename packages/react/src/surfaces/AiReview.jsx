// AI review (Feedback experience board 12). Ask AI to look at a page, or at one element, the way a
// careful reviewer would. It suggests; people decide: nothing it finds is posted until someone says so.
// Threadmark bundles no model. The host's `onAiReview` and `onAskAi` do the looking and return words.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AiIcon, ArrowLeftIcon, CheckIcon, CloseIcon, ErrorIcon } from "../icons.jsx";
import { collectPageReview } from "../pageReview.js";
import { restoreTargetDescriptor } from "../target.js";
import { Key, Switch } from "../ui/primitives.jsx";

export const AI_FOCUS = [
  { id: "accessibility", label: "Accessibility", hint: "Contrast, labels, focus, target sizes", on: true },
  { id: "copy", label: "Copy", hint: "Clarity, tone, the same thing called two names", on: true },
  { id: "layout", label: "Layout", hint: "Alignment, spacing, things that break at this width", on: true },
  { id: "design-system", label: "Matches your design system", hint: "Colours, type and spacing that aren’t your tokens", on: false },
];
const CATEGORY_LABELS = { accessibility: "Accessibility", copy: "Copy", layout: "Layout", "design-system": "Design system" };
export const DISMISS_REASONS = [
  { id: "not-a-problem", label: "Not a problem here" },
  { id: "already-known", label: "We already know" },
  { id: "wrong", label: "This is wrong" },
];
const clean = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Finds the element a finding is about: a target descriptor, a `data-threadmark-id`, or a selector. Never Threadmark's own UI. */
export function resolveFindingElement(finding, { ignoredSelectors = [], documentRef = document } = {}) {
  let element = null;
  try {
    if (finding?.target && typeof finding.target === "object") element = restoreTargetDescriptor(finding.target, { ignoredSelectors }).element || null;
    else if (typeof finding?.targetId === "string" && finding.targetId) element = documentRef.querySelector(`[data-threadmark-id="${CSS.escape(finding.targetId)}"]`);
    else if (typeof finding?.selector === "string" && finding.selector) element = documentRef.querySelector(finding.selector);
  } catch {
    element = null;
  }
  if (!element || element.closest?.("[data-threadmark-root], [data-threadmark-ignore], [data-private]")) return null;
  return element;
}

/** "Button · Start free": what kind of thing, and what it says. */
export function elementLabel(element) {
  if (!element) return "";
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  const kind = role ? role[0].toUpperCase() + role.slice(1)
    : tag === "button" ? "Button" : tag === "a" ? "Link" : /^h[1-6]$/.test(tag) ? "Heading" : tag === "img" ? "Image"
      : tag === "input" || tag === "textarea" || tag === "select" ? "Field" : tag === "p" ? "Text" : "Element";
  const text = tag === "img" ? element.getAttribute("alt") : element.getAttribute("aria-label") || element.textContent;
  const words = clean(text || "", 40);
  return words ? `${kind} · ${words}` : kind;
}

export function normalizeAiFindings(list, options) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20).map((item, index) => {
    const title = clean(item?.title, 120);
    if (!title) return null;
    const element = resolveFindingElement(item, options);
    return {
      id: clean(item.id, 80) || `finding-${index + 1}`,
      category: CATEGORY_LABELS[item.category] ? item.category : "accessibility",
      title,
      detail: clean(item.detail, 400),
      where: clean(item.where, 80) || elementLabel(element),
      element,
      status: "draft",
    };
  }).filter(Boolean);
}

/** The words a finding becomes when posted. */
export function findingComment(finding) {
  return [finding.title.replace(/[.!]?$/, "."), finding.detail].filter(Boolean).join(" ");
}

function timeAgo(at) {
  const seconds = Math.round((Date.now() - at) / 1000);
  return seconds < 45 ? "just now" : seconds < 3600 ? `${Math.round(seconds / 60)}m ago` : `${Math.round(seconds / 3600)}h ago`;
}

function Sheet({ className = "", labelledBy, onClose, onSubmit, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="tm-sheet-layer" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className={`tm-you tm-ai-sheet ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); onClose(); }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && onSubmit) { event.preventDefault(); onSubmit(); }
        }}>
        {children}
      </section>
    </div>
  );
}

/** 27b: what to look for. Four kinds, design system off unless connected. */
function ReviewSetup({ focus, onFocusChange, onStart, onShowLooksAt, onClose }) {
  return (
    <Sheet labelledBy="tm-ai-setup-title" onClose={onClose} onSubmit={() => focus.length && onStart()}>
      <header className="tm-you__header">
        <AiIcon aria-hidden="true" focusable="false" />
        <h2 id="tm-ai-setup-title">Review this page</h2>
        <button type="button" onClick={onClose} aria-label="Close"><Key>Esc</Key></button>
      </header>
      <div className="tm-you__body tm-ai-setup">
        {AI_FOCUS.map((item) => (
          <Switch key={item.id} label={item.label} description={item.hint} checked={focus.includes(item.id)}
            onChange={(on) => onFocusChange(on ? [...focus, item.id] : focus.filter((id) => id !== item.id))} />
        ))}
        <footer className="tm-you__footer">
          <span className="tm-ai-note">About 20 seconds · nothing is posted · <button type="button" onClick={onShowLooksAt}>What AI looks at</button></span>
          <button type="button" className="tm-send__go" disabled={!focus.length} onClick={onStart}>Review page <Key>↵</Key></button>
        </footer>
      </div>
    </Sheet>
  );
}

/** 29a: plainly what AI looks at and what it never sees. */
export function AiLooksAt({ onClose }) {
  return (
    <Sheet labelledBy="tm-ai-looks-title" onClose={onClose}>
      <header className="tm-you__header">
        <AiIcon aria-hidden="true" focusable="false" />
        <h2 id="tm-ai-looks-title">What AI looks at</h2>
        <button type="button" onClick={onClose} aria-label="Close"><Key>Esc</Key></button>
      </header>
      <div className="tm-you__body tm-ai-looks">
        <p className="tm-ai-eyebrow">It looks at</p>
        <ul>
          <li><CheckIcon aria-hidden="true" focusable="false" />The text, layout and a screenshot of what’s on screen</li>
          <li><CheckIcon aria-hidden="true" focusable="false" />Element names and your design tokens, if connected</li>
        </ul>
        <p className="tm-ai-eyebrow">It never sees</p>
        <ul className="is-never">
          <li><CloseIcon aria-hidden="true" focusable="false" />What people type into forms, passwords or payment fields</li>
          <li><CloseIcon aria-hidden="true" focusable="false" />Anything you’ve marked private, or other pages</li>
        </ul>
        <footer className="tm-you__footer">
          <span className="tm-ai-note">Your team’s AI provider decides how reviews are kept</span>
          <button type="button" className="tm-share__button" onClick={onClose}>Got it</button>
        </footer>
      </div>
    </Sheet>
  );
}

/** 27c: the band that reads down the page, and the bar's status with Stop. */
function ReviewBand({ route, progress, onStop }) {
  return (
    <>
      <div className="tm-ai-band" aria-hidden="true" />
      <div className="tm-ai-status" role="status">
        <AiIcon aria-hidden="true" focusable="false" />
        <strong>Reviewing {route}</strong>
        {progress.total > 0 && <span>· {Math.min(progress.checked, progress.total)} of {progress.total} elements</span>}
        <button type="button" onClick={onStop}>Stop</button>
        <Key>Esc</Key>
      </div>
    </>
  );
}

/** Draft AI pins on the page, numbered like the panel. */
function AiMarks({ findings, activeId, onSelect }) {
  const [rects, setRects] = useState({});
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = {};
      for (const finding of findings) {
        if (finding.status !== "draft" || !finding.element?.isConnected) continue;
        const rect = finding.element.getBoundingClientRect();
        // Top-right of the element, or near the start of a wide block so the pin stays by its words.
        if (rect.width || rect.height) next[finding.id] = { left: Math.min(rect.right, rect.left + 320), top: rect.top };
      }
      setRects(next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    addEventListener("scroll", schedule, true);
    addEventListener("resize", schedule);
    return () => { removeEventListener("scroll", schedule, true); removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [findings]);
  return findings.map((finding, index) => rects[finding.id] && (
    <button key={finding.id} type="button" className={`tm-ai-pin${activeId === finding.id ? " is-active" : ""}`}
      style={{ left: rects[finding.id].left - 10, top: rects[finding.id].top - 22 }}
      aria-label={`AI finding ${index + 1}: ${finding.title}`} onClick={() => onSelect(finding.id)}>
      {index + 1}
    </button>
  ));
}

function DismissMenu({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.querySelector("button")?.focus(); }, []);
  return (
    <div ref={ref} className="tm-menu tm-ai-dismiss" role="menu" aria-label="Why dismiss it?"
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <p className="tm-ai-eyebrow">Why dismiss it?</p>
      {DISMISS_REASONS.map((reason) => <button key={reason.id} type="button" role="menuitem" onClick={() => onPick(reason.id)}>{reason.label}</button>)}
    </div>
  );
}

/** 27d, 29b-d: what it found, as drafts to post or dismiss. */
function ReviewResults({ result, route, activeId, onActivate, onPost, onPostAll, onDismiss, onAgain, onClose }) {
  const [dismissing, setDismissing] = useState(null);
  const [busy, setBusy] = useState(null);
  const listRef = useRef(null);
  const drafts = result.findings.filter((finding) => finding.status === "draft");
  const visible = result.findings.filter((finding) => finding.status !== "dismissed");
  useEffect(() => {
    if (activeId) listRef.current?.querySelector(`[data-finding="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);
  const post = async (finding) => {
    setBusy(finding.id);
    try { await onPost(finding); } finally { setBusy(null); }
  };
  return (
    <aside className="tm-comments-panel tm-ai-panel" aria-label="AI review">
      <header className="tm-ai-panel__header">
        <button type="button" aria-label="Back" onClick={onClose}><ArrowLeftIcon size={16} aria-hidden="true" focusable="false" /></button>
        <AiIcon size={14} className="tm-ai-panel__icon" aria-hidden="true" focusable="false" />
        <h2>AI review</h2>
        <span>{route} · {result.stopped ? "stopped" : timeAgo(result.at)}</span>
        <button type="button" aria-label="Close AI review" onClick={onClose}><CloseIcon size={16} aria-hidden="true" focusable="false" /></button>
      </header>
      <div className="tm-ai-panel__body" ref={listRef}>
        {result.stopped && (
          <div className="tm-send__problem tm-ai-stopped" role="alert">
            <ErrorIcon size={14} aria-hidden="true" focusable="false" />
            <div><p>{result.stopped}</p><div className="tm-send__fixes"><button type="button" onClick={onAgain}>Review again</button></div></div>
          </div>
        )}
        {!result.stopped && !visible.length ? (
          <div className="tm-ai-empty">
            <AiIcon size={20} aria-hidden="true" focusable="false" />
            <strong>Nothing stood out</strong>
            <p>{result.checked ? `${result.checked} elements checked` : "The page was checked"} for {result.focusLabel}. Change the page and look again any time.</p>
            <button type="button" className="tm-share__button" onClick={onAgain}>Review again</button>
          </div>
        ) : (
          <>
            {result.stopped ? (visible.length > 0 && <p className="tm-ai-eyebrow tm-ai-pad">Found before it stopped</p>) : (
              <div className="tm-ai-summary">
                <p>{result.summary || `${visible.length} thing${visible.length === 1 ? "" : "s"} worth a look.`}</p>
                <small>{result.checked ? `${result.checked} elements checked · ` : ""}{result.focusLabel}</small>
              </div>
            )}
            <ol className="tm-ai-findings">
              {visible.map((finding) => {
                const number = result.findings.indexOf(finding) + 1;
                return (
                  <li key={finding.id} data-finding={finding.id} className={activeId === finding.id ? "is-active" : undefined}
                    onFocus={() => onActivate(finding.id)} onPointerEnter={() => onActivate(finding.id)}>
                    <span className="tm-ai-number" aria-hidden="true">{number}</span>
                    <div>
                      <p className="tm-ai-eyebrow">{CATEGORY_LABELS[finding.category]}</p>
                      <strong>{finding.title}</strong>
                      {finding.detail && <p>{finding.detail}</p>}
                      {finding.where && <code>{finding.where}</code>}
                      {finding.status === "posted" ? <p className="tm-ai-posted">Posted as a comment</p> : (
                        <div className="tm-ai-actions">
                          <button type="button" className="tm-share__button" disabled={busy === finding.id || !finding.element} onClick={() => post(finding)}
                            title={finding.element ? undefined : "The element isn’t on the page"}>{busy === finding.id ? "Posting…" : "Post as comment"}</button>
                          <button type="button" className="tm-ai-link" aria-haspopup="menu" aria-expanded={dismissing === finding.id}
                            onClick={() => setDismissing(dismissing === finding.id ? null : finding.id)}>Dismiss</button>
                          {dismissing === finding.id && (
                            <DismissMenu onClose={() => setDismissing(null)} onPick={(reason) => { setDismissing(null); onDismiss(finding, reason); }} />
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
      <footer className="tm-ai-panel__footer">
        <span>Posted findings show as yours</span>
        {drafts.length > 1 && <button type="button" className="tm-send__go" disabled={Boolean(busy)} onClick={async () => { setBusy("all"); try { await onPostAll(); } finally { setBusy(null); } }}>
          {busy === "all" ? "Posting…" : `Post all ${drafts.filter((finding) => finding.element).length}`}
        </button>}
      </footer>
    </aside>
  );
}

/**
 * The whole-page review: setup → reading the page → drafts. Rendered by the overlay while `open` or
 * while a review is running or showing.
 */
export function AiPageReview({ open, onOpenChange, route, buildId, ignoredSelectors = [], onAiReview, onAiDismiss, onPost, onNotice }) {
  const [phase, setPhase] = useState(null); // setup | looks | running | results
  const [focus, setFocus] = useState(() => AI_FOCUS.filter((item) => item.on).map((item) => item.id));
  const [progress, setProgress] = useState({ checked: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const controller = useRef(null);
  const partial = useRef([]);
  const startedAt = useRef(Date.now());

  useEffect(() => { if (open && !phase) setPhase("setup"); }, [open, phase]);
  useEffect(() => () => controller.current?.abort(), []);
  // A review belongs to its page.
  useEffect(() => { controller.current?.abort(); controller.current = null; setPhase(null); setResult(null); }, [route]);

  const close = () => { controller.current?.abort(); controller.current = null; setPhase(null); setResult(null); onOpenChange(false); };
  const focusLabel = focus.map((id) => CATEGORY_LABELS[id].toLowerCase()).join(", ");
  const options = { ignoredSelectors };

  const checkedRef = useRef(0);
  const finish = (next) => { setResult(next); setPhase("results"); };

  const start = async () => {
    const abort = new AbortController();
    controller.current = abort;
    partial.current = [];
    checkedRef.current = 0;
    setProgress({ checked: 0, total: 0 });
    setPhase("running");
    const at = Date.now();
    startedAt.current = at;
    try {
      const page = await collectPageReview({ route, buildId, ignoredSelectors, signal: abort.signal });
      const response = await onAiReview({
        route, focus: [...focus], page, signal: abort.signal,
        report: ({ checked, total, finding } = {}) => {
          if (controller.current !== abort) return;
          if (Number.isFinite(checked)) checkedRef.current = checked;
          if (Number.isFinite(checked) || Number.isFinite(total)) setProgress((current) => ({ checked: checked ?? current.checked, total: total ?? current.total }));
          if (finding) partial.current = [...partial.current, finding];
        },
      });
      if (controller.current !== abort) return; // stopped or closed meanwhile
      finish({
        at, focusLabel, checked: Number(response?.checked) || checkedRef.current, summary: clean(response?.summary, 200),
        findings: normalizeAiFindings(response?.findings, options), stopped: null,
      });
    } catch (error) {
      if (controller.current !== abort) return;
      finish({
        at, focusLabel, checked: checkedRef.current, summary: "",
        findings: normalizeAiFindings(error?.findings || partial.current, options),
        stopped: clean(error?.message, 200) || "AI couldn’t finish this review.",
      });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  };

  // Stop shows what was found so far straight away, whether or not the host honours the signal.
  const stop = () => {
    const abort = controller.current;
    if (!abort) return;
    controller.current = null;
    abort.abort();
    finish({
      at: startedAt.current, focusLabel, checked: checkedRef.current, summary: "",
      findings: normalizeAiFindings(partial.current, options), stopped: "You stopped the review. Nothing was posted.",
    });
  };
  useEffect(() => {
    if (phase !== "running") return undefined;
    const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); stop(); } };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [phase]);

  const setStatus = (id, status) => setResult((current) => ({ ...current, findings: current.findings.map((finding) => (finding.id === id ? { ...finding, status } : finding)) }));
  const post = async (finding) => {
    try {
      await onPost({ element: finding.element, comment: findingComment(finding) });
      setStatus(finding.id, "posted");
    } catch (error) {
      onNotice?.(error?.message ? `Couldn’t post: ${error.message}` : "Couldn’t post that finding. Try again.");
    }
  };

  if (phase === "setup") return <ReviewSetup focus={focus} onFocusChange={setFocus} onStart={start} onShowLooksAt={() => setPhase("looks")} onClose={close} />;
  if (phase === "looks") return <AiLooksAt onClose={() => setPhase("setup")} />;
  if (phase === "running") {
    return <ReviewBand route={route} progress={progress} onStop={stop} />;
  }
  if (phase === "results" && result) {
    return (
      <>
        <AiMarks findings={result.findings} activeId={activeId} onSelect={setActiveId} />
        <ReviewResults result={result} route={route} activeId={activeId} onActivate={setActiveId}
          onPost={post}
          onPostAll={async () => { for (const finding of result.findings) if (finding.status === "draft" && finding.element) await post(finding); }}
          onDismiss={(finding, reason) => { setStatus(finding.id, "dismissed"); onAiDismiss?.({ id: finding.id, category: finding.category, title: finding.title }, reason); }}
          onAgain={() => setPhase("setup")} onClose={close} />
      </>
    );
  }
  return null;
}

/** 28b-c: AI on one element. Up to three points, a suggested fix, and follow-ups about this element only. */
export function AskAiCard({ element, route, onAskAi, onPost, onCopy, onClose }) {
  const [turns, setTurns] = useState([]); // { question, points, fix }
  const [state, setState] = useState("loading");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const ref = useRef(null);
  const label = elementLabel(element);

  const ask = async (text = null) => {
    setState("loading");
    setError("");
    try {
      const answer = await onAskAi({ element, label, route, question: text, history: turns.map(({ question: q, points, fix }) => ({ question: q, points, fix })) });
      const points = (Array.isArray(answer?.points) ? answer.points : []).map((point) => clean(point, 300)).filter(Boolean).slice(0, 3);
      setTurns((current) => [...current, { question: text, points, fix: clean(answer?.fix, 400) }]);
      setQuestion("");
      setState("ready");
    } catch (askError) {
      setError(askError?.message || "AI couldn’t answer just now.");
      setState("ready");
    }
  };
  useEffect(() => { ask(); }, []);
  useLayoutEffect(() => {
    const place = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.min(360, innerWidth - 24);
      const left = rect.left - width - 16 > 12 ? rect.left - width - 16 : Math.min(innerWidth - width - 12, Math.max(12, rect.right + 16));
      setPosition({ left, top: Math.min(Math.max(12, rect.top), innerHeight - 200), width });
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    return () => { removeEventListener("resize", place); removeEventListener("scroll", place, true); };
  }, [element]);
  useEffect(() => { ref.current?.focus(); }, []);

  const latest = turns[turns.length - 1];
  const text = latest ? [...latest.points, latest.fix ? `Suggested fix: ${latest.fix}` : null].filter(Boolean).join("\n") : "";
  const prompt = latest ? `On ${route}, ${label}:\n${latest.points.map((point) => `- ${point}`).join("\n")}${latest.fix ? `\nSuggested fix: ${latest.fix}` : ""}` : "";

  return (
    <section ref={ref} className="tm-ai-card" role="dialog" aria-label={`AI on ${label}`} tabIndex={-1} style={position || { visibility: "hidden" }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <header>
        <AiIcon size={14} aria-hidden="true" focusable="false" />
        <h2>AI on {label}</h2>
        <button type="button" aria-label="Close" onClick={onClose}><CloseIcon size={14} aria-hidden="true" focusable="false" /></button>
      </header>
      <div className="tm-ai-card__body" aria-live="polite" aria-busy={state === "loading"}>
        {turns.map((turn, index) => (
          <div key={index} className="tm-ai-turn">
            {turn.question && <p className="tm-ai-question">{turn.question}</p>}
            {turn.points.length ? (
              <ol>{turn.points.map((point, pointIndex) => <li key={pointIndex}><span aria-hidden="true">{pointIndex + 1}</span>{point}</li>)}</ol>
            ) : <p className="tm-ai-quiet">Nothing stands out about this one.</p>}
            {turn.fix && <div className="tm-ai-fix"><p className="tm-ai-eyebrow">Suggested fix</p><p>{turn.fix}</p></div>}
          </div>
        ))}
        {state === "loading" && <p className="tm-ai-quiet tm-ai-thinking">Looking at {label}…</p>}
        {error && <p className="tm-ui-field__hint is-error" role="alert">{error}</p>}
      </div>
      {latest && latest.points.length > 0 && (
        <div className="tm-ai-card__actions">
          <button type="button" className="tm-send__go" onClick={() => onPost(text)}>Post as comment</button>
          <button type="button" className="tm-share__button" onClick={() => onCopy(prompt)}>Copy for AI</button>
        </div>
      )}
      <form className="tm-ai-follow" onSubmit={(event) => { event.preventDefault(); if (question.trim() && state !== "loading") ask(question.trim()); }}>
        <input value={question} maxLength={300} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a follow-up" aria-label="Ask a follow-up about this element" />
        <Key>↵</Key>
      </form>
    </section>
  );
}
