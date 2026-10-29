import React from 'react';
import { createRoot } from 'react-dom/client';
import { Threadmark } from '../../src/Threadmark.jsx';
import { createFeedbackPayload } from '../../src/core.js';
import { createRestorationContext, createTargetDescriptor, restoreTargetDescriptor, suggestChangedTarget,
  restoreTextTargetDescriptor } from '../../src/target.js';
import { createRestorationScheduler } from '../../src/restorationScheduler.js';
import * as baseline from 'beta11-target';

let scheduler, targets, annotations, root;
const serialize = result => ({ status: result.status, element: result.element?.id || null,
  candidates: result.candidates.map(element => element.id), suggestion: result.suggestion?.id || null });
const stats = { calls: {}, slices: [], snapshots: [], results: {}, longTasks: [] };
const observer = new PerformanceObserver(list => stats.longTasks.push(...list.getEntries().map(entry => entry.duration)));
try { observer.observe({ type: 'longtask' }); } catch { /* Optional browser instrumentation. */ }

function setup() {
  scheduler?.dispose(); root?.unmount(); root = null;
  document.body.innerHTML = '<main id="fixture"></main><aside id="unrelated"></aside><div id="root"></div>';
  const fixture = document.getElementById('fixture');
  for (let i = 0; i < 200; i++) {
    const article = document.createElement('article');
    article.innerHTML = `<div id="card-${i}"><div id="title-${i}">Portfolio ${i}<span id="span-${i}">Revenue ${i}</span></div><div id="detail-${i}">Account ${i}<span id="metric-${i}">Growth ${i}</span></div><div id="note-${i}">Forecast ${i}</div></div><button id="button-${i}">Open ${i}</button>`;
    fixture.append(article);
  }
  targets = [];
  for (let i = 0; i < 20; i++) {
    const target = createTargetDescriptor(document.getElementById(`title-${i}`), { route: '/' });
    if (i >= 10) target.locatorCandidates.domPath = '#obsolete';
    targets.push(target);
  }
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 2; j++) document.getElementById(`metric-${i * 2 + j}`).textContent = `Duplicate ${i}`;
    const target = createTargetDescriptor(document.getElementById(`metric-${i * 2}`), { route: '/' });
    target.locatorCandidates.domPath = '#obsolete'; targets.push(target);
  }
  for (let i = 0; i < 35; i++) {
    const target = createTargetDescriptor(document.getElementById(`${i % 2 ? 'span' : 'card'}-${i + 30}`), { route: '/' });
    target.accessibleName += ' previous';
    target.visibleText = i % 3 ? `${target.visibleText} previous` : '';
    if (i % 2) target.locatorCandidates.domPath = '#obsolete';
    targets.push(target);
  }
  annotations = targets.map((target, index) => ({ id: `comment-${index}`, payload: {
    target, updatedAt: '2026-10-29T00:00:00.000Z' } }));
  stats.calls = {}; stats.slices = []; stats.snapshots = []; stats.results = {}; stats.longTasks = [];
  window.__assessCounts = {}; window.__restoreCount = 0;
  return { elements: fixture.querySelectorAll('*').length, comments: targets.length };
}
function start() {
  scheduler = createRestorationScheduler({
    assess(annotation, context, deferSuggestions) {
      stats.calls[annotation.id] = (stats.calls[annotation.id] || 0) + 1;
      const result = restoreTargetDescriptor(annotation.payload.target, { context, deferSuggestions });
      return { ...result, status: result.suggestion ? 'changed' : result.status, results: [result] };
    },
    suggest(annotation, result, context) {
      const suggestion = suggestChangedTarget(annotation.payload.target, document, [], context);
      return { ...result, suggestion, status: suggestion ? 'changed' : result.status };
    },
    position: (_, result) => result,
    onChange(results) {
      stats.results = Object.fromEntries(Object.entries(results).map(([id, result]) => [id, serialize(result)]));
      stats.snapshots.push(Object.values(results).map(result => result.status));
    },
    onSlice(slice) { stats.slices.push(slice); },
  });
  scheduler.update(annotations);
}
function expected() {
  const start = performance.now();
  const results = targets.map(target => {
    const result = baseline.restoreTargetDescriptor(target);
    return { ...serialize(result), status: result.suggestion ? 'changed' : result.status };
  });
  stats.baselineMs = performance.now() - start;
  return results;
}
function mount() {
  root = createRoot(document.getElementById('root'));
  const records = annotations.map(item => ({ feedback: createFeedbackPayload({ id: item.id,
    target: item.payload.target, comment: item.id, route: '/', projectKey: 'performance', now: item.payload.updatedAt }) }));
  const render = () => root.render(<Threadmark projectKey="performance" annotations={records.map(record => ({ ...record }))} />);
  render(); return { render };
}
window.restorationFixture = { setup, start, expected, stats,
  update: () => scheduler.update(annotations.map(item => ({ ...item }))),
  change: id => { annotations = annotations.map(item => item.id === id ? { ...item, payload: { ...item.payload, updatedAt: '2026-10-29T00:00:01.000Z' } } : item); scheduler.update(annotations); },
  remove: id => { annotations = annotations.filter(item => item.id !== id); scheduler.update(annotations); },
  add: () => { annotations.push({ ...annotations[0], id: 'added' }); scheduler.update(annotations); },
  recheck: id => scheduler.recheck(id),
  dispose: () => scheduler.dispose(),
  cacheCheck() {
    const real = window.getComputedStyle, reads = new Map();
    window.getComputedStyle = element => { reads.set(element, (reads.get(element) || 0) + 1); return real(element); };
    try {
      const context = createRestorationContext();
      for (const target of targets) restoreTargetDescriptor(target, { context, deferSuggestions: true });
      return Math.max(...reads.values());
    } finally { window.getComputedStyle = real; }
  },
  parityCases() {
    const box = document.createElement('section'); box.id = 'edge-cases';
    box.innerHTML = `<div id="nested">Alpha <span>Beta <b>Gamma</b></span><i hidden>secret</i><span aria-hidden="true">secret</span><input value="private"><span data-threadmark-ignore>secret</span> Omega</div><button id="named" aria-label="Named button">Other</button><div id="long">${'word '.repeat(100)}<span>Tail</span></div><p id="quote">A repeated quote and a repeated quote.</p>`;
    document.body.append(box);
    const result = [];
    const first = document.createElement('div'), second = document.createElement('div');
    first.id = 'first-tie'; first.setAttribute('aria-label', 'Different'); first.textContent = 'Longer phrase with needle';
    second.id = 'second-tie'; second.setAttribute('aria-label', 'Expected name'); second.textContent = 'Other';
    box.append(first, second);
    const tie = { kind: 'text', tagName: 'div', accessibleName: 'Expected name', visibleText: 'needle', locatorCandidates: {} };
    result.push([serialize(restoreTargetDescriptor(tie)), serialize(baseline.restoreTargetDescriptor(tie))]);
    for (const id of ['nested', 'named', 'long', 'quote']) {
      const element = document.getElementById(id), target = baseline.createTargetDescriptor(element);
      result.push([createTargetDescriptor(element), target].map(value => [value.visibleText, value.accessibleName]));
      for (const changes of [{}, { visibleText: '', accessibleName: 'wrong' }, { role: 'button' }, { visibleText: 'old text', accessibleName: 'Selected text' }]) {
        const variant = { ...target, ...changes, locatorCandidates: { domPath: '#obsolete' } };
        result.push([serialize(restoreTargetDescriptor(variant)), serialize(baseline.restoreTargetDescriptor(variant))]);
      }
    }
    const textTarget = { ...baseline.createTargetDescriptor(document.getElementById('quote')), kind: 'text', selectedText: 'repeated quote', visibleText: 'repeated quote' };
    result.push([serialize(restoreTextTargetDescriptor(textTarget)), serialize(baseline.restoreTextTargetDescriptor(textTarget))]);
    return result;
  },
  mount() { window.renderAgain = mount().render; },
};
