import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
import { createFeedbackPayload } from '../../src/core.js';
import { createTargetDescriptor } from '../../src/target.js';
import { createFeedbackStore } from '../../../../examples/basic-react/src/feedbackStore.js';
import { createLocalReactionHandler } from '../../../../examples/basic-react/src/reactionsDemo.js';
const reviewer = { id: 'alice', displayName: 'Alice' };
const store = createFeedbackStore({ databaseName: 'reactions-test', projectKey: 'reactions', route: '/' });
function App() {
  const [records, setRecords] = React.useState([]);
  React.useEffect(() => { (async () => {
    let records = await store.list();
    if (!records.length) {
      await store.upsert(createFeedbackPayload({ id: 'comment-1', projectKey: 'reactions', route: '/', target: createTargetDescriptor(document.getElementById('target')),
        comment: 'Review this button', author: reviewer,
        reactions: [{ emoji: '👍', reviewer: { id: 'bob', displayName: 'Bob' } }],
        replies: [{ id: 'reply-1', comment: 'Looks good', author: reviewer }],
      }), {});
      records = await store.list();
    }
    setRecords(records);
  })(); }, []);
  return <Threadmark route="/" projectKey="reactions" reviewer={reviewer} annotations={records} onReactionChange={async (...args) => {
    if (window.failReaction) throw new Error('Offline');
    return createLocalReactionHandler({ store, reviewer, onRecords: setRecords })(...args);
  }} />;
}
createRoot(document.getElementById('root')).render(<App />);
