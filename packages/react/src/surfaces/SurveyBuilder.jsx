// "Ask a question": the survey builder (Feedback experience board 03, row 10; Figma "Survey builder").
// Three steps — Question, Where, Who and when — with sensible defaults so most people just press
// Publish. Problems are named next to their field, and Next stays available (board 03, 13a).
import { useEffect, useMemo, useRef, useState } from "react";
import { AddIcon, CloseIcon, DragIcon, PollIcon, ScoreIcon, OpenAnswerIcon, CommentIcon, BrowserIcon, HomeIcon } from "../icons.jsx";
import { Button, Input, Key, Segmented, Switch } from "../ui/primitives.jsx";
import { ScaleInput, SurveyCard } from "../surveys/SurveyCard.jsx";
import { createSurveyDraft, normalizeSurvey, surveyProblems, SCALE_POINTS } from "../surveys/schema.js";

const STEPS = ["Question", "Where", "Who and when"];
const STEP_FIELDS = [["question", "options", "points"], ["where", "pages"], []];
const STOP_CHOICES = [
  { value: 50, label: "After 50 answers" },
  { value: 100, label: "After 100 answers" },
  { value: 250, label: "After 250 answers" },
  { value: 0, label: "When I end it" },
];

let optionSeed = 0;
const newOption = () => ({ id: `o${Date.now().toString(36)}${(optionSeed += 1)}`, label: "" });

function previewSurvey(draft) {
  try {
    return normalizeSurvey({ ...draft, status: "live" });
  } catch {
    const kind = draft.question.kind;
    return {
      ...draft,
      question: {
        ...draft.question,
        text: draft.question.text || "Your question",
        options: kind === "poll" ? draft.question.options.map((option, index) => ({ id: option.id, label: option.label || `Answer ${index + 1}` })) : [],
        scale: kind === "scale" ? draft.question.scale : null,
      },
      followUp: draft.followUp.enabled ? { text: draft.followUp.text } : null,
    };
  }
}

export function SurveyBuilder({ route = "/", onPublish, onClose }) {
  const [draft, setDraft] = useState(() => createSurveyDraft(route));
  const [step, setStep] = useState(0);
  const [shownProblems, setShownProblems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [newPage, setNewPage] = useState("");
  const firstFieldRef = useRef(null);

  useEffect(() => { firstFieldRef.current?.focus(); }, [step]);

  const update = (change) => setDraft((current) => change(structuredClone(current)));
  const problems = useMemo(() => surveyProblems(draft), [draft]);
  const problemFor = (field) => shownProblems.includes(field) ? problems.find((problem) => problem.field === field)?.message : undefined;
  const preview = useMemo(() => previewSurvey(draft), [draft]);
  const pagesLabel = draft.pages.join(", ") || route;

  const goNext = () => {
    const fields = STEP_FIELDS[step];
    const stepProblems = problems.filter((problem) => fields.includes(problem.field));
    if (stepProblems.length) {
      setShownProblems((current) => [...new Set([...current, ...stepProblems.map((problem) => problem.field)])]);
      return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const publish = async () => {
    if (problems.length) {
      setShownProblems(problems.map((problem) => problem.field));
      const first = STEP_FIELDS.findIndex((fields) => problems.some((problem) => fields.includes(problem.field)));
      if (first >= 0) setStep(first);
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const survey = normalizeSurvey({ ...draft, status: "live" });
      await onPublish?.(survey);
      onClose?.(survey);
    } catch (publishError) {
      setError(publishError?.message ? `Couldn’t publish: ${publishError.message}` : "Couldn’t publish. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.(null);
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (step < STEPS.length - 1) goNext();
      else publish();
    }
  };

  const question = draft.question;

  return (
    <>
      {step === 1 && draft.placement.kind === "page" && (
        <div className={`tm-survey-ghost tm-survey-ghost--${draft.placement.position}`} aria-hidden="true">
          <div className="tm-survey-ghost__card">
            <span>Quick question</span>
            <strong>{preview.question.text}</strong>
          </div>
        </div>
      )}
      <section className="tm-survey-builder" role="dialog" aria-modal="true" aria-labelledby="tm-survey-title" onKeyDown={onKeyDown}>
        <header className="tm-survey-builder__header">
          <PollIcon aria-hidden="true" focusable="false" className="tm-survey-builder__mark" />
          <h2 id="tm-survey-title">Ask a question</h2>
          <button type="button" className="tm-survey-builder__esc" onClick={() => onClose?.(null)} aria-label="Close question builder"><Key>Esc</Key></button>
        </header>

        <ol className="tm-survey-steps" aria-label="Steps">
          {STEPS.map((label, index) => (
            <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : undefined} aria-current={index === step ? "step" : undefined}>
              <span className="tm-survey-steps__dot">{index + 1}</span>{label}
            </li>
          ))}
        </ol>

        <div className="tm-survey-builder__body">
          {step === 0 && (
            <>
              <Segmented
                label="Question type"
                value={question.kind}
                onChange={(kind) => update((current) => { current.question.kind = kind; return current; })}
                options={[{ value: "poll", label: "Poll", icon: PollIcon }, { value: "scale", label: "Scale", icon: ScoreIcon }, { value: "text", label: "Text", icon: OpenAnswerIcon }]}
              />
              <Input
                ref={firstFieldRef}
                label="Question"
                placeholder={question.kind === "scale" ? "How easy was it to find pricing?" : question.kind === "text" ? "What nearly stopped you?" : "Which line should lead the homepage?"}
                value={question.text}
                error={problemFor("question")}
                maxLength={300}
                onChange={(event) => { const value = event.target.value; update((current) => { current.question.text = value; return current; }); }}
              />
              {question.kind === "poll" && (
                <fieldset className="tm-survey-options">
                  <legend className="tm-sr-only">Answers</legend>
                  {question.options.map((option, index) => (
                    <div className="tm-survey-option" key={option.id}>
                      <DragIcon aria-hidden="true" focusable="false" />
                      <input
                        aria-label={`Answer ${index + 1}`}
                        placeholder={`Answer ${index + 1}`}
                        value={option.label}
                        maxLength={120}
                        onChange={(event) => { const value = event.target.value; update((current) => { current.question.options[index].label = value; return current; }); }}
                      />
                      <button type="button" aria-label={`Remove answer ${index + 1}`} disabled={question.options.length <= 2}
                        onClick={() => update((current) => { current.question.options.splice(index, 1); return current; })}>
                        <CloseIcon aria-hidden="true" focusable="false" />
                      </button>
                    </div>
                  ))}
                  {question.options.length < 8 && (
                    <button type="button" className="tm-survey-option tm-survey-option--add" onClick={() => update((current) => { current.question.options.push(newOption()); return current; })}>
                      <AddIcon aria-hidden="true" focusable="false" />Add an option
                    </button>
                  )}
                  {problemFor("options") && <p className="tm-ui-field__hint is-error">{problemFor("options")}</p>}
                  <Switch label="Allow more than one answer" checked={question.multiple} onChange={(checked) => update((current) => { current.question.multiple = checked; return current; })} />
                </fieldset>
              )}
              {question.kind === "scale" && (
                <div className="tm-survey-scale">
                  <div className="tm-survey-row">
                    <span className="tm-ui-field__label">Points</span>
                    <Segmented label="Points" value={question.scale.points}
                      onChange={(points) => update((current) => { current.question.scale.points = points; return current; })}
                      options={SCALE_POINTS.map((points) => ({ value: points, label: String(points) }))} />
                  </div>
                  <div className="tm-survey-row">
                    <span className="tm-ui-field__label">Shows as</span>
                    <Segmented label="Shows as" value={question.scale.display}
                      onChange={(display) => update((current) => { current.question.scale.display = display; return current; })}
                      options={[{ value: "numbers", label: "Numbers" }, { value: "stars", label: "Stars" }, { value: "faces", label: "Faces" }, { value: "slider", label: "Slider" }]} />
                  </div>
                  <div className="tm-survey-pair">
                    <Input size="sm" label="Low end" placeholder="Hard" value={question.scale.low} maxLength={40}
                      onChange={(event) => { const value = event.target.value; update((current) => { current.question.scale.low = value; return current; }); }} />
                    <Input size="sm" label="High end" placeholder="Easy" value={question.scale.high} maxLength={40}
                      onChange={(event) => { const value = event.target.value; update((current) => { current.question.scale.high = value; return current; }); }} />
                  </div>
                  <div className="tm-survey-preview" aria-label="Preview">
                    <span className="tm-ui-field__label">Preview</span>
                    <div className="tms-card tm-survey-preview__scale"><ScaleInput scale={question.scale} value={null} onChange={() => {}} label="Preview" /></div>
                  </div>
                </div>
              )}
              <Switch
                label="Ask a follow-up"
                description="An open question after the answer. People can leave it empty."
                checked={draft.followUp.enabled}
                onChange={(checked) => update((current) => { current.followUp.enabled = checked; return current; })}
              />
              {draft.followUp.enabled && (
                <Input size="sm" aria-label="Follow-up question" value={draft.followUp.text} maxLength={200}
                  onChange={(event) => { const value = event.target.value; update((current) => { current.followUp.text = value; return current; }); }} />
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Segmented
                label="Where it shows"
                value={draft.placement.kind}
                onChange={(kind) => update((current) => { current.placement.kind = kind; return current; })}
                options={[{ value: "element", label: "Element", icon: CommentIcon }, { value: "section", label: "Section", icon: BrowserIcon }, { value: "page", label: "Whole page", icon: HomeIcon }]}
              />
              {draft.placement.kind === "page" ? (
                <div className="tm-survey-row">
                  <span className="tm-ui-field__label">Position</span>
                  <Segmented label="Position" value={draft.placement.position}
                    onChange={(position) => update((current) => { current.placement.position = position; return current; })}
                    options={[{ value: "corner", label: "Corner" }, { value: "centre", label: "Centre" }, { value: "banner", label: "Banner" }]} />
                </div>
              ) : (
                <Input
                  ref={firstFieldRef}
                  label={draft.placement.kind === "element" ? "Element" : "Section"}
                  hint="Its data-threadmark-id, or a CSS selector such as #pricing."
                  placeholder="pricing-table"
                  value={draft.placement.target || ""}
                  error={problemFor("where")}
                  onChange={(event) => { const value = event.target.value; update((current) => { current.placement.target = value; return current; }); }}
                />
              )}
              <div className="tm-survey-pages">
                <span className="tm-ui-field__label">Pages</span>
                <ul>
                  {draft.pages.map((page, index) => (
                    <li key={page}>
                      <code>{page}</code>
                      <button type="button" aria-label={`Remove ${page}`} onClick={() => update((current) => { current.pages.splice(index, 1); return current; })}>
                        <CloseIcon aria-hidden="true" focusable="false" />
                      </button>
                    </li>
                  ))}
                </ul>
                <form className="tm-survey-pages__add" onSubmit={(event) => {
                  event.preventDefault();
                  const page = newPage.trim();
                  if (!page) return;
                  update((current) => { current.pages = [...new Set([...current.pages, page.startsWith("/") ? page : `/${page}`])]; return current; });
                  setNewPage("");
                }}>
                  <input aria-label="Add a page" placeholder="/pricing" value={newPage} onChange={(event) => setNewPage(event.target.value)} />
                  <button type="submit"><AddIcon aria-hidden="true" focusable="false" />Add</button>
                </form>
                {problemFor("pages") && <p className="tm-ui-field__hint is-error">{problemFor("pages")}</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="tm-survey-row">
                <span className="tm-ui-field__label">Who sees it</span>
                <Segmented label="Who sees it" value={draft.audience}
                  onChange={(audience) => update((current) => { current.audience = audience; return current; })}
                  options={[{ value: "team", label: "My team" }, { value: "visitors", label: "Visitors" }, { value: "everyone", label: "Everyone" }]} />
              </div>
              <dl className="tm-survey-settings">
                <div>
                  <dt><label htmlFor="tm-survey-starts">Starts</label></dt>
                  <dd><select id="tm-survey-starts" value={draft.startsAt ? "later" : "now"}
                    onChange={(event) => { const later = event.target.value === "later"; update((current) => { current.startsAt = later ? new Date(Date.now() + 86400000).toISOString() : null; return current; }); }}>
                    <option value="now">Now</option><option value="later">Tomorrow</option>
                  </select></dd>
                </div>
                <div>
                  <dt><label htmlFor="tm-survey-stops">Stops</label></dt>
                  <dd><select id="tm-survey-stops" value={draft.stopAfterAnswers || 0}
                    onChange={(event) => { const value = Number(event.target.value); update((current) => { current.stopAfterAnswers = value || null; return current; }); }}>
                    {STOP_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select></dd>
                </div>
                <div>
                  <dt><label htmlFor="tm-survey-frequency">Show to each person</label></dt>
                  <dd><select id="tm-survey-frequency" value={draft.frequency}
                    onChange={(event) => { const value = event.target.value; update((current) => { current.frequency = value; return current; }); }}>
                    <option value="once">Once</option><option value="every-visit">Every visit</option>
                  </select></dd>
                </div>
              </dl>
              <Switch label="Hide who answered" checked={draft.anonymous} onChange={(checked) => update((current) => { current.anonymous = checked; return current; })} />
              <div className="tm-survey-preview">
                <span className="tm-ui-field__label">What people will see</span>
                <SurveyCard survey={preview} step="question" onChange={() => {}} onNext={() => {}} onSkip={() => {}} onClose={() => {}} className="tm-survey-preview__card" />
              </div>
            </>
          )}
          {error && <p className="tm-ui-field__hint is-error" role="alert">{error}</p>}
        </div>

        <footer className="tm-survey-builder__footer">
          {step > 0 ? <Button variant="secondary" size="sm" onClick={() => setStep((current) => current - 1)}>Back</Button> : <span />}
          <span className="tm-survey-builder__live">{step === STEPS.length - 1 ? `Live on ${pagesLabel}` : ""}</span>
          {step < STEPS.length - 1
            ? <Button variant="primary" size="sm" kbd="↵" onClick={goNext}>Next</Button>
            : <Button variant="primary" size="sm" kbd="↵" onClick={publish} disabled={publishing}>{publishing ? "Publishing…" : "Publish"}</Button>}
        </footer>
      </section>
    </>
  );
}
