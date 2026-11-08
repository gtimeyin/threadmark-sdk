// Survey questions in the side panel (board 03: 10e "the question appears at the top of the panel as
// live", 11d "the score and spread at a glance, the written answers below, and a one-line AI read").
import { ArrowLeftIcon, NextStepsIcon } from "../icons.jsx";

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The "Questions" list at the top of Activity. */
export function SurveyList({ surveys, results = {}, onOpen }) {
  if (!surveys.length) return null;
  return (
    <section className="tm-survey-list" aria-label="Questions">
      <p className="tm-comments-count"><span>Questions</span><span>{surveys.length}</span></p>
      <ul>
        {surveys.map((survey) => {
          const total = results[survey.id]?.total || 0;
          return (
            <li key={survey.id}>
              <button type="button" className="tm-survey-list__item" onClick={() => onOpen(survey.id)}>
                <span className={`tm-survey-status tm-survey-status--${survey.status}`}>{survey.status === "live" ? "Live" : survey.status === "ended" ? "Ended" : "Draft"}</span>
                <span className="tm-survey-list__question">{survey.question.text}</span>
                <span className="tm-survey-list__meta">{total ? plural(total, "answer") : "No answers yet"} · {survey.pages.join(", ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const leader = rows.reduce((best, row) => (row.count > best ? row.count : best), 0);
  return (
    <ul className="tm-survey-bars">
      {rows.map((row) => (
        <li key={row.key} className={row.count && row.count === leader ? "is-leading" : undefined}>
          <span className="tm-survey-bars__label">{row.label}</span>
          <span className="tm-survey-bars__track" aria-hidden="true"><span style={{ width: `${(row.count / max) * 100}%` }} /></span>
          <span className="tm-survey-bars__share">{row.share}%<span className="tm-sr-only"> ({plural(row.count, "answer")})</span></span>
        </li>
      ))}
    </ul>
  );
}

/** One question's answers for the team. */
export function SurveyResultsView({ survey, results, onBack, onEnd, onExport }) {
  const total = results?.total || 0;
  const share = (count) => (total ? Math.round((count / total) * 100) : 0);
  const { question } = survey;
  const rows = question.kind === "scale"
    ? Array.from({ length: question.scale.points }, (_, index) => question.scale.points - index).map((point) => ({ key: point, label: String(point), count: results?.counts?.[point] || 0, share: share(results?.counts?.[point] || 0) }))
    : question.kind === "poll"
      ? question.options.map((option) => ({ key: option.id, label: option.label, count: results?.counts?.[option.id] || 0, share: share(results?.counts?.[option.id] || 0) }))
      : [];
  const texts = results?.texts || [];
  return (
    <div className="tm-survey-results" role="tabpanel" aria-label={`Answers: ${question.text}`}>
      <div className="tm-survey-results__nav">
        <button type="button" onClick={onBack}><ArrowLeftIcon aria-hidden="true" focusable="false" />All activity</button>
        <span className={`tm-survey-status tm-survey-status--${survey.status}`}>{survey.status === "live" ? "Live" : survey.status === "ended" ? "Ended" : "Draft"}</span>
      </div>
      <h3 className="tm-survey-results__question">{question.text}</h3>
      <p className="tm-survey-results__score">
        {question.kind === "scale" && results?.average != null && <><strong>{results.average}</strong> of {question.scale.points} · </>}
        {plural(total, "answer")}
      </p>
      {rows.length > 0 && <Bars rows={rows} />}
      {results?.summary && (
        <p className="tm-survey-results__summary"><NextStepsIcon aria-hidden="true" focusable="false" />{results.summary}</p>
      )}
      {texts.length > 0 && (
        <section className="tm-survey-results__texts" aria-label="Written answers">
          <p className="tm-survey-results__texts-label">{survey.followUp?.text || question.text} · {texts.length}</p>
          {texts.slice(0, 50).map((value, index) => <blockquote key={index}>“{value}”</blockquote>)}
        </section>
      )}
      {!total && <p className="tm-survey-results__empty">No answers yet. They appear here as people respond.</p>}
      <footer className="tm-survey-results__footer">
        {onExport && <button type="button" onClick={() => onExport(survey)}>Copy answers</button>}
        {onEnd && survey.status === "live" && <button type="button" className="tm-survey-results__end" onClick={() => onEnd(survey)}>End survey</button>}
      </footer>
    </div>
  );
}
