import { createFeedbackPayload } from 'threadmark-react';
const comments = {
  'unnamed-control': 'This control has no accessible name. Add a visible label or an aria-label that describes its action so screen reader users can identify it.',
  'missing-alt': 'This image has no text alternative. Add descriptive alt text if it conveys information, or alt="" if it is decorative.',
  'heading-jump': 'The heading hierarchy skips a level here. Use the next heading level to make the page structure easier to navigate with a screen reader.',
  'small-text': 'This text is rendered below 12px. Consider increasing its size so it is easier to read, especially on small screens.',
  'horizontal-overflow': 'This element extends beyond the viewport. Check its width and wrapping on this screen size so users can read or use it without horizontal scrolling.',
};
/** Local example only: identity and storage here simulate a connected review service. */
export function createLocalPageReviewer({ store, projectKey }) {
  return async (input, { requestId, evidence = [], signal } = {}) => {
    const records = await store.list(), created = [];
    let skipped = 0;
    for (const [index, finding] of input.findings.entries()) {
      if (signal?.aborted) throw new DOMException('Review cancelled', 'AbortError');
      const targetId = finding.target.locatorCandidates.stableId || finding.target.locatorCandidates.domPath;
      const comment = comments[finding.rule];
      if (!comment) continue;
      if (records.some(({ feedback }) => feedback.route === input.route && feedback.buildId === input.buildId
        && (feedback.target.locatorCandidates.stableId || feedback.target.locatorCandidates.domPath) === targetId && feedback.comment === comment)) { skipped++; continue; }
      const shot = evidence.find(item => item.rule === finding.rule && item.targetId === targetId);
      const context = { evidence: shot ? [{ id: shot.id, blob: shot.blob }] : [] };
      const feedback = createFeedbackPayload({ id: `agent-${requestId}-${index}`, projectKey, environment: 'local', route: input.route,
        buildId: input.buildId, target: finding.target, captureKind: 'element', comment,
        author: { id: 'threadmark-agent', displayName: 'Threadmark Agent' }, evidence: shot ? [shot.metadata] : [] });
      await store.upsert(feedback, context);
      const record = { feedback, context }; records.push(record); created.push(record);
    }
    return { records, annotations: created, skipped, engine: 'built-in-checks' };
  };
}
