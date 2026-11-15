import { useEffect, useRef, useState } from 'react';
import { CloseIcon as X } from './icons.jsx';
import { preparePageReview } from './pageOutline.js';
import { restoreTargetDescriptor } from './target.js';

const CATEGORY_LABELS = { copy: 'Copy', polish: 'Polish', accessibility: 'Accessibility', bug: 'Bug', idea: 'Idea', question: 'Question' };

/** Where a suggestion's element is now: the one the review saw, or its stable target found again. */
function locate(entry, ignoredSelectors) {
  if (!entry) return null;
  if (entry.element?.isConnected) return entry.element;
  return restoreTargetDescriptor(entry.target, { ignoredSelectors }).element || null;
}

/** Hosted suggestions stay private until a reviewer explicitly keeps one. */
export function HostedPageReview({ onClose, route, buildId, ignoredSelectors, existing, onAiReview, onAccept, onDismiss }) {
  const [running, setRunning] = useState(false), [status, setStatus] = useState(''), [focus, setFocus] = useState('');
  const [review, setReview] = useState(null), [busy, setBusy] = useState(null), [editing, setEditing] = useState(null), [highlight, setHighlight] = useState(null);
  const controller = useRef(null), targets = useRef(new Map());
  const callbacks = useRef({ onAiReview, onAccept, onDismiss });
  callbacks.current = { onAiReview, onAccept, onDismiss };
  const scopeKey = `${route}\n${buildId || ''}`;
  useEffect(() => {
    setStatus(''); setRunning(false); setReview(null); setEditing(null); setHighlight(null); targets.current = new Map();
    return () => { controller.current?.abort(); controller.current = null; };
  }, [scopeKey]);
  async function runAi(abort) {
    setStatus('Looking at the page…');
    const prepared = await preparePageReview({ route, buildId, focus, ignoredSelectors, existing, signal: abort.signal });
    if (abort.signal.aborted) return;
    setStatus('Thinking it over…');
    const result = await callbacks.current.onAiReview(prepared.request, { signal: abort.signal });
    if (abort.signal.aborted) return;
    targets.current = prepared.targets;
    setReview(result || null);
    if (result?.status === 'processing') { setStatus('Still working on it. Try again in a minute.'); return; }
    if (result?.status === 'failed') { setStatus(result.error || 'The review couldn’t finish. Try again.'); return; }
    const open = (result?.findings || []).filter(finding => finding.state === 'suggested').length;
    setStatus(open ? '' : 'Nothing stood out on this screen.');
  }

  async function run() {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort; setRunning(true); setStatus('Inspecting page…'); setEditing(null);
    try {
      await runAi(abort);
    } catch (error) {
      if (!abort.signal.aborted) setStatus(error?.message || 'The review couldn’t finish. Try again.');
    } finally {
      if (controller.current === abort) { controller.current = null; setRunning(false); }
    }
  }
  function cancel() {
    controller.current?.abort(); controller.current = null; setRunning(false);
    setStatus('Stopped.');
  }

  const update = (findingId, change) => setReview(current => current && {
    ...current, findings: current.findings.map(finding => finding.id === findingId ? { ...finding, ...change } : finding),
  });
  async function keep(finding, comment = finding.comment) {
    const entry = targets.current.get(finding.element);
    const element = locate(entry, ignoredSelectors);
    if (!entry || !element) { setStatus('That element isn’t on the page anymore, so this suggestion can’t be pinned.'); return; }
    setBusy(finding.id); setStatus('');
    try {
      await callbacks.current.onAccept({ finding: { ...finding, comment }, review, element, target: entry.target });
      update(finding.id, { state: 'accepted', comment });
      setEditing(null);
    } catch (error) {
      setStatus(error?.message || 'That suggestion wasn’t saved. Try again.');
    } finally { setBusy(null); }
  }
  async function dismiss(finding) {
    setBusy(finding.id); setStatus('');
    try {
      await callbacks.current.onDismiss?.(finding, review);
      update(finding.id, { state: 'dismissed' });
    } catch (error) {
      setStatus(error?.message || 'That suggestion wasn’t dismissed. Try again.');
    } finally { setBusy(null); }
  }
  async function keepAll() {
    for (const finding of (review?.findings || []).filter(item => item.state === 'suggested')) await keep(finding);
  }
  function show(finding) {
    const element = locate(targets.current.get(finding.element), ignoredSelectors);
    if (!element) { setHighlight(null); return; }
    element.scrollIntoView?.({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      setHighlight({ id: finding.id, left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 });
    });
  }

  const suggestions = (review?.findings || []).filter(finding => finding.state === 'suggested');
  const kept = (review?.findings || []).filter(finding => finding.state === 'accepted').length;
  return <div className="tm-agent tm-hosted-review">
    {highlight && <div className="tm-agent-highlight" aria-hidden="true" style={{ left: highlight.left, top: highlight.top, width: highlight.width, height: highlight.height }} />}
    <section className="tm-agent-panel" id="tm-agent-panel" aria-label="Page review">
      <header><strong>Review this page</strong><button type="button" aria-label="Close page review" onClick={onClose}><X size={16} /></button></header>
        <p>Threadmark AI looks at what’s on screen and suggests a few comments. Only you see them until you keep one.</p>
        <label className="tm-agent-focus" htmlFor="tm-agent-focus">What should it look at? <span>Optional</span></label>
        <textarea id="tm-agent-focus" rows={2} maxLength={280} value={focus} placeholder="The pricing table, the sign-up form…"
          disabled={running} onChange={event => setFocus(event.target.value)} />
        <p className="tm-agent-scope">Sends a screenshot of this screen, with private areas and form fields masked, and its visible text.</p>
      <div className="tm-agent-actions">
        <button type="button" className="tm-agent-run" disabled={running || Boolean(busy)} onClick={run}>{running ? 'Reviewing…' : review ? 'Review again' : 'Review this page'}</button>
        {running && <button type="button" onClick={cancel}>Stop review</button>}
      </div>
      {status && <p role="status">{status}</p>}
      {review && (suggestions.length > 0 || kept > 0) && <div className="tm-agent-results">
        <div className="tm-agent-results__head">
          <span>{suggestions.length ? `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}` : 'All done'}{kept ? ` · ${kept} kept` : ''}</span>
          {suggestions.length > 1 && <button type="button" disabled={Boolean(busy) || running} onClick={keepAll}>Keep all</button>}
        </div>
        <ul aria-label="Suggestions">
          {suggestions.map(finding => <li key={finding.id} className={`tm-agent-finding${highlight?.id === finding.id ? ' is-shown' : ''}`}
            onMouseEnter={() => show(finding)} onMouseLeave={() => setHighlight(null)}>
            <div className="tm-agent-finding__meta">
              <span className={`tm-agent-chip tm-agent-chip--${finding.severity}`}>{CATEGORY_LABELS[finding.category] || finding.category}</span>
              <span className="tm-agent-finding__severity">{finding.severity === 'high' ? 'High' : finding.severity === 'medium' ? 'Medium' : 'Low'}</span>
            </div>
            {editing?.id === finding.id
              ? <textarea aria-label="Edit suggestion" rows={3} maxLength={400} value={editing.comment} onChange={event => setEditing({ id: finding.id, comment: event.target.value })} />
              : <p>{finding.comment}</p>}
            <div className="tm-agent-finding__actions">
              {editing?.id === finding.id ? <>
                <button type="button" className="tm-agent-keep" disabled={busy === finding.id || !editing.comment.trim()} onClick={() => keep(finding, editing.comment.trim())}>Keep</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </> : <>
                <button type="button" className="tm-agent-keep" disabled={Boolean(busy) || running} aria-label={`Keep: ${finding.comment}`} onClick={() => keep(finding)}>{busy === finding.id ? 'Keeping…' : 'Keep'}</button>
                <button type="button" disabled={Boolean(busy) || running} onClick={() => setEditing({ id: finding.id, comment: finding.comment })}>Edit</button>
                <button type="button" disabled={Boolean(busy) || running} aria-label={`Dismiss: ${finding.comment}`} onClick={() => dismiss(finding)}>Dismiss</button>
                <button type="button" onClick={() => show(finding)} onFocus={() => show(finding)}>Show</button>
              </>}
            </div>
          </li>)}
        </ul>
      </div>}
    </section>
  </div>;
}
