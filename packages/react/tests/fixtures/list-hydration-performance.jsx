import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
import { createFeedbackPayload } from '../../src/core.js';
import { createTargetDescriptor } from '../../src/target.js';
let root, records;
window.resetListCounters = () => { window.__listCounters = { payloads: 0, contextRefreshes: 0 }; };
const render = () => root.render(<Threadmark projectKey="performance" reviewer={{ id: 'alice', displayName: 'Alice' }} annotations={records} />);
window.setupListBenchmark = count => {
  root?.unmount(); document.body.innerHTML = '<button id="target">Review target</button><div id="root"></div>';
  const target = createTargetDescriptor(document.getElementById('target'));
  records = Array.from({ length: count }, (_, i) => ({ feedback: createFeedbackPayload({
    id: `comment-${i}`, projectKey: 'performance', route: '/', target, comment: `Comment ${i} ${i % 3 ? 'brief' : 'A longer comment that wraps over several lines. '.repeat(4)}`,
    author: { id: i % 2 ? 'bob' : 'alice', displayName: i % 2 ? 'Bob' : 'Alice' },
    now: '2026-10-29T00:00:00.000Z',
  }) }));
  window.resetListCounters(); root = createRoot(document.getElementById('root')); render();
};
window.pollListRecords = async (change = false) => {
  window.resetListCounters();
  const start = performance.now();
  records = JSON.parse(JSON.stringify(records));
  if (change) { records[records.length - 1].feedback.comment = 'Changed newest comment'; records[records.length - 1].feedback.updatedAt = '2026-10-29T00:00:01.000Z'; }
  render();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return { ...window.__listCounters, elapsedMs: performance.now() - start };
};
const imageBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='), character => character.charCodeAt(0));
window.attachListEvidence = () => {
  const active = new Set(); window.activeListEvidenceUrls = active;
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); active.add(url); return url; };
  URL.revokeObjectURL = url => { active.delete(url); revoke(url); };
  records = records.map((record, index) => {
    const blob = new Blob([imageBytes], { type: 'image/png' }), id = `shot-${index}`;
    const feedback = createFeedbackPayload({ ...record.feedback, now: record.feedback.createdAt,
      evidence: [{ id, kind: 'snapshot', source: 'dom-renderer', quality: 'captured', mimeType: blob.type,
        byteSize: blob.size, pixelSize: { width: 1, height: 1 }, redactionCount: 0, warnings: [] }] });
    return { feedback, context: { evidence: [{ id, blob }] } };
  }); render();
};
window.replaceListEvidence = () => {
  records = records.map(record => ({ ...record, context: { evidence: record.context.evidence.map(item => ({ ...item, blob: new Blob([imageBytes], { type: 'image/png' }) })) } }));
  render();
};
