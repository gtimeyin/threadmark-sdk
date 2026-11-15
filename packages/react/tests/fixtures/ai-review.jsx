import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
const reviewer = { id: 'alice', displayName: 'Alice' };
window.posted = []; window.dismissed = []; window.asks = [];
function App() {
  return <Threadmark route="/" projectKey="ai" reviewer={reviewer} annotations={[]}
    onFeedbackCreate={async (feedback) => { window.posted.push(feedback); }}
    onAiReview={async ({ focus, report, signal }) => {
      window.focus = focus;
      report({ checked: 0, total: 3 });
      if (window.hangReview) {
        report({ checked: 1, finding: { id: 'early', category: 'accessibility', title: 'Button text is too faint', targetId: 'cta' } });
        await new Promise(() => {});
      }
      if (window.emptyReview) return { findings: [], checked: 3 };
      report({ checked: 3 });
      return {
        summary: '2 things worth a look. The biggest: the main button is hard to read.', checked: 3,
        findings: [
          { id: 'contrast', category: 'accessibility', title: 'Button text is too faint', detail: 'White on Forest at this size is 3.1:1.', targetId: 'cta' },
          { id: 'names', category: 'copy', title: 'Two names for one plan', detail: 'The headline says Team; the card says Business.', targetId: 'plan' },
          { id: 'ghost', category: 'layout', title: 'Not on this page', selector: '#missing' },
        ],
      };
    }}
    onAiDismiss={(finding, reason) => window.dismissed.push([finding.id, reason])}
    onAskAi={async ({ label, question }) => {
      window.asks.push({ label, question });
      return question ? { points: ['A tooltip hides it until someone hovers.'] } : { points: ['The legend runs past the chart.', 'Grey bars are hard to tell apart.'], fix: 'Put the legend under the chart.' };
    }} />;
}
createRoot(document.getElementById('root')).render(<App />);
