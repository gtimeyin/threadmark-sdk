import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/index.jsx';

// A stand-in for the hosted reviewer: it records what it was sent and suggests comments on elements it finds in
// the outline by name, the way the API's model points at outline ids.
window.requests = [];
window.saved = [];
window.dismissed = [];
const byName = (request, pattern) => request.elements.find(item => pattern.test(`${item.name || ''} ${item.text || ''}`))?.id;

function App() {
  const [records, setRecords] = React.useState([]);
  return <Threadmark projectKey="ai-test" reviewer={{ id: 'mo', displayName: 'Mo Member' }} route="/pricing" buildId="b1"
    ignoredSelectors={['.private-test', '.label-wrapper .masked-label']} annotations={records}
    onPageReview={async (request) => {
      window.requests.push(request);
      if (window.failReview) throw new Error('At most 10 page reviews an hour. Try again later.');
      return {
        reviewId: '11111111-1111-4111-8111-111111111111', status: 'done',
        findings: [
          { id: 'f1', element: byName(request, /Get started/), category: 'copy', severity: 'high', comment: '"Get started" doesn\'t say what happens next.', state: 'suggested' },
          { id: 'f2', element: byName(request, /\$29/), category: 'accessibility', severity: 'medium', comment: 'The price is light grey on white.', state: 'suggested' },
          { id: 'f3', element: byName(request, /Pricing/), category: 'polish', severity: 'low', comment: 'The heading crowds the plans.', state: 'suggested' },
        ],
      };
    }}
    onPageReviewDismiss={async (finding, review) => { window.dismissed.push([finding.id, review.reviewId]); }}
    onFeedbackCreate={async (feedback, context) => {
      window.saved.push({ feedback, evidence: context.evidence.map(item => ({ id: item.id, size: item.blob?.size || 0 })) });
      const record = { feedback: { ...feedback, author: { id: 'mo', displayName: 'Mo Member' } }, context: { evidence: context.evidence } };
      setRecords(current => [...current.filter(item => item.feedback.id !== feedback.id), record]);
      return record;
    }} />;
}
createRoot(document.getElementById('root')).render(<App />);
