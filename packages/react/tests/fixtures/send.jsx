import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
import { createFeedbackPayload } from '../../src/core.js';
import { createTargetDescriptor } from '../../src/target.js';
import { createFeedbackStore } from '../../../../examples/basic-react/src/feedbackStore.js';
const reviewer = { id: 'alice', displayName: 'Alice' };
const store = createFeedbackStore({ databaseName: 'send-test', projectKey: 'send', route: '/' });
const destinations = [
  { id: 'github', kind: 'github', name: 'GitHub', connected: true, targetLabel: 'Repository', note: 'Label: feedback',
    targets: [{ id: 'studio/site', label: 'studio/site' }, { id: 'studio/archive', label: 'studio/archive' }] },
  { id: 'slack', kind: 'slack', name: 'Slack', connected: false },
];
window.sent = [];
function App() {
  const [records, setRecords] = React.useState([]);
  React.useEffect(() => { (async () => {
    let list = await store.list();
    if (!list.length) {
      await store.upsert(createFeedbackPayload({ id: 'comment-1', projectKey: 'send', route: '/', target: createTargetDescriptor(document.getElementById('target')),
        comment: 'The pricing toggle should default to yearly.', author: reviewer }), {});
      list = await store.list();
    }
    setRecords(list);
  })(); }, []);
  return <Threadmark route="/" projectKey="send" reviewer={reviewer} annotations={records} destinations={destinations}
    onFeedbackCreate={async (feedback, context) => { await store.upsert(feedback, context); }}
    onConnectDestination={(id) => { window.connected = id; }}
    onSendTo={async (feedback, draft) => {
      window.sent.push({ id: feedback.id, ...draft });
      if (draft.targetId === 'studio/archive') throw Object.assign(new Error('Threadmark isn’t installed on studio/archive.'), { fix: { label: 'Install on GitHub', url: 'https://github.com/apps' } });
      return { label: 'GitHub #482', url: 'https://github.com/studio/site/issues/482' };
    }} />;
}
createRoot(document.getElementById('root')).render(<App />);
