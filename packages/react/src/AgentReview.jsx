import { useEffect, useRef, useState } from 'react';
import { AgentIcon as Bot } from "./icons.jsx";
import { CloseIcon as X } from "./icons.jsx";
import { collectPageReview } from './pageReview.js';
import { restoreTargetDescriptor } from './target.js';
import { captureRegionSnapshot } from './snapshot.js';

export function AgentReview({ route, buildId, ignoredSelectors, onReview, onRecords }) {
  const [open, setOpen] = useState(false), [running, setRunning] = useState(false), [status, setStatus] = useState('');
  const controller = useRef(null), request = useRef(null);
  const callbacks = useRef({ onReview, onRecords }); callbacks.current = { onReview, onRecords };
  const scopeKey = `${route}\n${buildId || ''}`;
  useEffect(() => {
    setStatus(''); setRunning(false); request.current = null;
    return () => { controller.current?.abort(); controller.current = null; };
  }, [scopeKey]);
  async function review() {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort; setRunning(true); setStatus('Inspecting page…');
    try {
      // Keep the exact payload and key for a safe retry after an uncertain network result.
      if (!request.current) {
        const input = await collectPageReview({ route, buildId, ignoredSelectors, signal: abort.signal });
        const evidence = [];
        for (const [index, finding] of input.findings.entries()) {
          if (abort.signal.aborted) return;
          setStatus(`Preparing comment ${index + 1} of ${input.findings.length}…`);
          const element = restoreTargetDescriptor(finding.target, { ignoredSelectors }).element;
          const rect = element?.getBoundingClientRect();
          if (!rect || rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight) continue;
          const id = crypto.randomUUID();
          try {
            const shot = await captureRegionSnapshot({ id, region: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
              ignoredSelectors: [...ignoredSelectors, '[data-private]'], signal: abort.signal });
            evidence.push({ id, rule: finding.rule, targetId: finding.target.locatorCandidates.stableId || finding.target.locatorCandidates.domPath, ...shot });
          } catch { /* A missing screenshot must not block actionable text feedback. */ }
        }
        if (abort.signal.aborted) return;
        request.current = { input, evidence, requestId: crypto.randomUUID() };
      }
      if (abort.signal.aborted) return;
      setStatus('Posting review comments…');
      const pending = request.current;
      const result = await callbacks.current.onReview(pending.input, { requestId: pending.requestId, evidence: pending.evidence, signal: abort.signal });
      if (abort.signal.aborted) return;
      callbacks.current.onRecords(result?.records || []);
      const count = result?.annotations?.length ?? result?.records?.length ?? 0;
      setStatus(`${count ? `Added ${count} comment${count === 1 ? '' : 's'}.` : result?.skipped ? 'No new issues to comment on.' : 'No issues found by these checks.'}${result?.skipped ? ` Skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}.` : ''}${pending.input.truncated ? ' Large page: review stopped at 3,000 elements.' : ''}${result?.evidenceFailures ? ' Some screenshots could not be attached.' : ''}`);
      request.current = null;
    } catch {
      if (!abort.signal.aborted) setStatus('Review could not finish. Retry to safely complete this run.');
    } finally {
      if (controller.current === abort) { controller.current = null; setRunning(false); }
    }
  }
  function cancel() {
    controller.current?.abort(); controller.current = null; setRunning(false);
    setStatus('Stopped locally. Comments already posted are kept; retry safely completes this run.');
  }
  return <div className="tm-agent">
    <button type="button" className="tm-agent-trigger" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="tm-agent-panel"><Bot size={17} /> Ask Threadmark</button>
    {open && <section className="tm-agent-panel" id="tm-agent-panel" aria-label="Threadmark Agent">
      <header><strong>Threadmark Agent</strong><button type="button" aria-label="Close agent panel" onClick={() => setOpen(false)}><X size={16} /></button></header>
      <p>Ask for a review of this page. I’ll post up to five comments on elements that need attention.</p>
      <div className="tm-agent-command">@threadmark review this page</div>
      <p className="tm-agent-scope">Built-in checks: control names, image descriptions, headings, text size and overflow. Screenshots attach when available.</p>
      <button type="button" className="tm-agent-run" disabled={running} onClick={review}>{running ? 'Reviewing…' : 'Review this page'}</button>
      {running && <button type="button" onClick={cancel}>Stop review</button>}
      {status && <p role="status">{status}</p>}
    </section>}
  </div>;
}
