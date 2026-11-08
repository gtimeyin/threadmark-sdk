// The card a visitor sees (Figma "Survey card": Question / Thanks / Closed). Shared by the
// production player and the builder's preview, so what you design is what people get.
import { useId } from "react";

const FACES = ["😞", "🙁", "😐", "🙂", "😄"];

function faceFor(index, points) {
  return FACES[Math.min(FACES.length - 1, Math.round((index / Math.max(1, points - 1)) * (FACES.length - 1)))];
}

function CloseGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6L18 18M18 6L6 18" /></svg>;
}

function DoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.5C16.69 20.5 20.5 16.69 20.5 12C20.5 7.31 16.69 3.5 12 3.5C7.31 3.5 3.5 7.31 3.5 12C3.5 16.69 7.31 20.5 12 20.5Z" />
      <path d="M8.5 12.5L11 15L15.5 10" />
    </svg>
  );
}

function StarGlyph({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={filled ? "is-filled" : undefined}>
      <path d="M12 3.8l2.5 5.1 5.6.8-4.05 3.95.96 5.6L12 16.6l-5.01 2.65.96-5.6L3.9 9.7l5.6-.8L12 3.8z" />
    </svg>
  );
}

/** The answer area for a scale question: numbers, stars, faces or a slider. */
export function ScaleInput({ scale, value, onChange, label }) {
  const points = scale.points;
  const values = Array.from({ length: points }, (_, index) => index + 1);
  if (scale.display === "slider") {
    const shown = value ?? Math.ceil(points / 2);
    return (
      <div className="tms-slider">
        <span className="tms-slider__value" style={{ left: `${((shown - 1) / Math.max(1, points - 1)) * 100}%` }} aria-hidden="true">{shown}</span>
        <input
          type="range"
          min={1}
          max={points}
          step={1}
          value={shown}
          aria-label={label}
          aria-valuetext={`${shown} of ${points}`}
          style={{ "--tms-fill": `${((shown - 1) / Math.max(1, points - 1)) * 100}%` }}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    );
  }
  return (
    <div className={`tms-points tms-points--${scale.display}`} role="radiogroup" aria-label={label}>
      {values.map((point) => (
        <button
          key={point}
          type="button"
          role="radio"
          aria-checked={value === point}
          aria-label={`${point} of ${points}`}
          className={value === point ? "is-selected" : undefined}
          onClick={() => onChange(point)}
        >
          {scale.display === "stars" ? <StarGlyph filled={value != null && point <= value} />
            : scale.display === "faces" ? <span aria-hidden="true">{faceFor(point - 1, points)}</span>
              : point}
        </button>
      ))}
    </div>
  );
}

/**
 * step: "question" | "followUp" | "thanks" | "closed".
 * value: the answer so far; followUpText: the optional written answer.
 */
export function SurveyCard({
  survey,
  step = "question",
  value = null,
  followUpText = "",
  onChange,
  onFollowUpChange,
  onNext,
  onSkip,
  onClose,
  sending = false,
  className = "",
}) {
  const id = useId();
  const { question } = survey;
  const totalSteps = survey.followUp ? 2 : 1;
  const stepNumber = step === "followUp" ? 2 : 1;
  // A slider always shows a value, so its starting point counts as an answer.
  const sliderStart = question.kind === "scale" && question.scale.display === "slider" ? Math.ceil(question.scale.points / 2) : null;
  const ready = question.kind === "text"
    ? Boolean(String(value || "").trim())
    : question.kind === "poll" ? (Array.isArray(value) ? value.length > 0 : value != null) : (value ?? sliderStart) != null;

  const top = (
    <div className="tms-card__top">
      <span>Quick question</span>
      {(step === "question" || step === "followUp") && totalSteps > 1 && <span>{stepNumber} of {totalSteps}</span>}
      <button type="button" className="tms-card__close" aria-label="Close question" onClick={onClose}><CloseGlyph /></button>
    </div>
  );

  if (step === "thanks" || step === "closed") {
    return (
      <section className={`tms-card tms-card--done ${className}`} role="status" aria-live="polite">
        {top}
        <div className="tms-card__done">
          <DoneGlyph />
          <div>
            <strong>{step === "thanks" ? "Thanks, that helps" : "This survey just closed"}</strong>
            <span>{step === "thanks" ? "We read every answer." : "We kept what you answered. Thanks for stopping by."}</span>
          </div>
        </div>
      </section>
    );
  }

  const togglePoll = (optionId) => {
    if (question.multiple) {
      const current = Array.isArray(value) ? value : [];
      onChange?.(current.includes(optionId) ? current.filter((item) => item !== optionId) : [...current, optionId]);
    } else {
      onChange?.(value === optionId ? null : optionId);
    }
  };

  return (
    <section className={`tms-card ${className}`} aria-labelledby={`${id}-q`}>
      {top}
      {step === "followUp" ? (
        <>
          <label id={`${id}-q`} className="tms-card__question" htmlFor={`${id}-follow`}>{survey.followUp.text}</label>
          <textarea id={`${id}-follow`} className="tms-card__text" rows={3} maxLength={600} placeholder="A few words is plenty"
            value={followUpText} onChange={(event) => onFollowUpChange?.(event.target.value)} />
        </>
      ) : (
        <>
          <p id={`${id}-q`} className="tms-card__question">{question.text}</p>
          {question.kind === "scale" && (
            <>
              <ScaleInput scale={question.scale} value={value} onChange={(next) => onChange?.(next)} label={question.text} />
              {(question.scale.low || question.scale.high) && (
                <div className="tms-card__ends" aria-hidden="true"><span>{question.scale.low}</span><span>{question.scale.high}</span></div>
              )}
            </>
          )}
          {question.kind === "poll" && (
            <div className="tms-options" role={question.multiple ? "group" : "radiogroup"} aria-labelledby={`${id}-q`}>
              {question.options.map((option) => {
                const chosen = Array.isArray(value) ? value.includes(option.id) : value === option.id;
                return (
                  <button key={option.id} type="button" role={question.multiple ? "checkbox" : "radio"} aria-checked={chosen}
                    className={chosen ? "is-selected" : undefined} onClick={() => togglePoll(option.id)}>
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
          {question.kind === "text" && (
            <textarea className="tms-card__text" rows={3} maxLength={600} aria-labelledby={`${id}-q`} placeholder="A few words is plenty"
              value={value || ""} onChange={(event) => onChange?.(event.target.value)} />
          )}
        </>
      )}
      <div className="tms-card__actions">
        <button type="button" className="tms-card__skip" onClick={onSkip}>Skip</button>
        <button
          type="button"
          className="tms-card__next"
          disabled={sending || (step === "question" && !ready)}
          onClick={onNext}
        >
          {sending ? "Sending…" : step === "followUp" || !survey.followUp ? "Send" : "Next"}
        </button>
      </div>
    </section>
  );
}
