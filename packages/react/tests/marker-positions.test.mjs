import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkerPositions } from '../src/markerPositions.js';

const rect = (top = 10) => ({ left: 5, top, width: 30, height: 20 });
test('unchanged geometry preserves snapshots and does not notify subscribers', () => {
  const store = createMarkerPositions();
  store.update({ a: { rect: rect() } });
  const initial = store.get('a'); let calls = 0;
  store.subscribe('a', () => calls++);
  store.update({ a: { rect: rect() } });
  assert.equal(store.get('a'), initial); assert.equal(calls, 0);
});
test('only moved pins notify and each subscriber sees the whole updated batch', () => {
  const store = createMarkerPositions();
  store.update({ a: { rect: rect() }, b: { rect: rect() }, fixed: { rect: rect() } });
  let moved = 0, fixed = 0;
  store.subscribe('a', () => { moved++; assert.equal(store.get('b').top, 20); });
  store.subscribe('fixed', () => fixed++);
  store.update({ a: { rect: rect(20) }, b: { rect: rect(20) }, fixed: { rect: rect() } });
  assert.equal(moved, 1); assert.equal(fixed, 0);
});
test('removal clears the snapshot and unsubscribe releases listeners', () => {
  const store = createMarkerPositions(); let calls = 0;
  const unsubscribe = store.subscribe('constructor', () => calls++);
  store.update({ constructor: { rect: rect() } }); store.update({});
  assert.equal(store.get('constructor'), null); assert.equal(calls, 2);
  unsubscribe(); store.update({ constructor: { rect: rect() } });
  assert.equal(calls, 2);
});
