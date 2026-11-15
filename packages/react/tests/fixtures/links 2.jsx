import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
import { createFeedbackPayload } from '../../src/core.js';
import { createTargetDescriptor } from '../../src/target.js';
// Sending to trackers lives in the dashboard; the overlay only shows the links it's given.
const reviewer = { id: 'alice', displayName: 'Alice' };
function App() {
  const [records, setRecords] = React.useState([]);
  React.useEffect(() => {
    const feedback = createFeedbackPayload({ id: 'comment-1', projectKey: 'links', route: '/', target: createTargetDescriptor(document.getElementById('target')),
      comment: 'The pricing toggle should default to yearly.', author: reviewer,
      links: [{ label: 'GitHub #482', url: 'https://github.com/studio/site/issues/482', destination: 'github', status: 'open' }] });
    setRecords([{ feedback, context: {} }]);
  }, []);
  return <Threadmark route="/" projectKey="links" reviewer={reviewer} annotations={records}
    dashboardUrl={window.dashboardUrl} onFeedbackCreate={async () => {}} />;
}
createRoot(document.getElementById('root')).render(<App />);
