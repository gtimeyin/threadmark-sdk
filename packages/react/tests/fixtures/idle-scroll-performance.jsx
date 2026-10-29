import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
import { createFeedbackPayload } from '../../src/core.js';
import { createTargetDescriptor } from '../../src/target.js';

let root;
window.resetPerformanceCounters = () => {
  window.__performanceCounters = { assess: 0, rootRenders: 0, overlayRenders: 0, markerRenders: 0,
    mutationCallbacks: 0, geometryReads: 0, pinWrites: 0, positionSlices: [] };
};
window.setupIdleScroll = (count) => {
  root?.unmount();
  document.body.innerHTML = '<main id="targets"></main><aside id="unrelated"></aside><div id="root"></div>';
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  const targets = document.getElementById('targets');
  const records = [];
  for (let i = 0; i < count; i++) {
    const element = document.createElement('button'); element.id = `target-${i}`;
    element.textContent = `Portfolio account ${i}`;
    element.style.cssText = i === 0 ? 'position:fixed;left:300px;top:80px;width:180px;height:30px'
      : 'display:block;width:200px;height:30px;margin-bottom:10px';
    targets.append(element);
    const target = createTargetDescriptor(element, { route: '/' });
    target.locatorCandidates.domPath = `#target-${i}`;
    records.push({ feedback: createFeedbackPayload({ id: `comment-${i}`, target, comment: `Comment ${i}`,
      route: '/', projectKey: 'performance', now: '2026-10-29T00:00:00.000Z' }) });
  }
  window.resetPerformanceCounters();
  root = createRoot(document.getElementById('root'));
  root.render(<Threadmark projectKey="performance" annotations={records} />);
};
window.burstMutations = () => {
  for (let i = 0; i < 100; i++) document.getElementById('unrelated').append(document.createElement('span'));
};
window.runScrollFrames = async (frames = 30, move = true) => {
  window.resetPerformanceCounters();
  const pins = new MutationObserver(changes => {
    window.__performanceCounters.pinWrites += changes.filter(change => change.target.matches('.tm-marker, .tm-outline')).length;
  });
  const shadow = document.querySelector('[data-threadmark-root]')?.shadowRoot;
  if (shadow) pins.observe(shadow, { subtree: true, attributes: true, attributeFilter: ['style'] });
  const spans = [];
  for (let i = 0; i < frames; i++) {
    const start = performance.now();
    if (move) window.scrollTo(0, (i % 2 ? 120 : 240));
    // A burst in one frame must coalesce to one positioning pass.
    for (let j = 0; j < 5; j++) window.dispatchEvent(new Event('scroll'));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    spans.push(performance.now() - start);
  }
  pins.disconnect();
  return { ...window.__performanceCounters, frameP95: spans.sort((a, b) => a - b)[Math.floor(spans.length * .95)] };
};
const realRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (...args) {
  if (window.__performanceCounters) window.__performanceCounters.geometryReads++;
  return realRect.apply(this, args);
};
