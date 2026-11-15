import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
import { createFeedbackPayload } from '../../src/core.js';
import { createTargetDescriptor } from '../../src/target.js';
const reviewer = { id: 'alice', displayName: 'Alice' };
// A 1x1 PNG, so the real screenshot can load.
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const replay = new Blob([new Uint8Array(300)], { type: 'application/gzip' });
const shot = new Blob([png], { type: 'image/png' });
function App() {
  const target = createTargetDescriptor(document.getElementById('target'));
  const base = { projectKey: 'thumbs', route: '/', target, author: reviewer, captureKind: 'element' };
  const records = [
    { feedback: createFeedbackPayload({ ...base, id: 'no-shot', comment: 'Screenshot failed, playback attached',
      evidence: [{ id: 's1', kind: 'snapshot', quality: 'unavailable' }, { id: 'r1', kind: 'replay', mimeType: 'application/gzip', byteSize: replay.size, durationMs: 1000, eventCount: 3 }],
      replay: { evidenceId: 'r1', startedAt: '2026-11-09T10:00:00.000Z', durationMs: 1000, eventCount: 3 } }),
      context: { evidence: [{ id: 'r1', blob: replay }] } },
    { feedback: createFeedbackPayload({ ...base, id: 'with-shot', comment: 'Has a screenshot',
      evidence: [{ id: 's2', kind: 'snapshot', quality: 'captured', mimeType: 'image/png', byteSize: shot.size, pixelSize: { width: 1, height: 1 } }] }),
      context: { evidence: [{ id: 's2', blob: shot }] } },
  ];
  return <Threadmark route="/" projectKey="thumbs" reviewer={reviewer} annotations={records} />;
}
createRoot(document.getElementById('root')).render(<App />);
