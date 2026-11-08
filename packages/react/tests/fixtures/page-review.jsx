import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark, collectPageReview } from '../../src/index.jsx';
import { createFeedbackStore } from '../../../../examples/basic-react/src/feedbackStore.js';
import { createLocalPageReviewer } from '../../../../examples/basic-react/src/localPageReviewer.js';
const store = createFeedbackStore({ databaseName: 'agent-review-test', projectKey: 'agent-test', route: '/' });
const review = createLocalPageReviewer({ store, projectKey: 'agent-test' });
window.scanPage = () => collectPageReview({ route: '/', buildId: 'one', ignoredSelectors: ['.private-test'] });
function App() {
  const [records, setRecords] = React.useState([]);
  React.useEffect(() => { store.list().then(setRecords); }, []);
  return <Threadmark projectKey="agent-test" reviewer={{ id: 'alice', displayName: 'Alice' }} route="/" buildId="one" ignoredSelectors={['.private-test']} annotations={records}
    onPageReviewRequested={async (input, context) => { window.lastInput = input; window.lastEvidence = context.evidence.length; if (window.pauseReview) await new Promise(resolve => { window.resumeReview = resolve; }); const result = await review(input, context); if (!context.signal.aborted) setRecords(result.records); return result; }}
    onFeedbackCreate={async (feedback, context) => { await store.upsert(feedback, context); setRecords(await store.list()); }} />;
}
createRoot(document.getElementById('root')).render(<App />);
