import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnnotationHydrator } from '../src/annotationHydration.js';
function record(id = 'one') { return { feedback: { id, target: {}, updatedAt: 'v1', comment: 'Original' } }; }
function fixture() {
  const calls = [];
  const cache = createAnnotationHydrator((record, payload) => {
    calls.push({ id: record.feedback.id, reusedPayload: Boolean(payload) });
    return { id: record.feedback.id, payload: payload || structuredClone(record.feedback), context: record.context };
  });
  return { cache, calls };
}
test('fresh host arrays retain normalized objects and sequence identity', () => {
  const { cache, calls } = fixture(), records = [record(), record('two')];
  const initial = cache.hydrate(records, 'project/page');
  const again = cache.hydrate(structuredClone(records), 'project/page');
  assert.equal(again, initial); assert.equal(calls.length, 2);
  records[1].feedback.updatedAt = 'v2'; records[1].feedback.comment = 'Edited';
  const edited = cache.hydrate(records, 'project/page');
  assert.equal(edited[0], initial[0]); assert.notEqual(edited[1], initial[1]); assert.equal(calls.length, 3);
});
test('poll and evidence URL updates refresh context without renormalizing feedback', () => {
  const { cache, calls } = fixture(), item = record();
  item.context = { poll: { counts: { yes: 1 } }, evidence: [{ id: 'shot', url: 'https://site.test/old' }] };
  const initial = cache.hydrate([item], 'scope')[0];
  item.context.poll.counts.yes = 2; item.context.evidence[0].url = 'https://site.test/new';
  const updated = cache.hydrate([item], 'scope')[0];
  assert.equal(updated.payload, initial.payload); assert.equal(calls[1].reusedPayload, true);
  assert.equal(updated.context.poll.counts.yes, 2); assert.equal(updated.context.evidence[0].url, 'https://site.test/new');
});
test('in-place edits with stale timestamps and replaced Blobs are never hidden by the cache', () => {
  const { cache, calls } = fixture(), item = record();
  item.context = { evidence: [{ id: 'shot', blob: new Blob(['old']) }] };
  const initial = cache.hydrate([item], 'scope')[0];
  item.feedback.comment = 'Edited without advancing updatedAt';
  const updated = cache.hydrate([item], 'scope')[0];
  assert.notEqual(updated.payload, initial.payload);
  item.context.evidence[0].blob = new Blob(['new']);
  cache.hydrate([item], 'scope');
  assert.equal(calls.length, 3); assert.equal(calls[2].reusedPayload, true);
});
test('removed records, scope changes and explicit cleanup evict prior results', () => {
  const { cache, calls } = fixture(), item = record();
  const original = cache.hydrate([item], 'a')[0]; cache.hydrate([], 'a');
  assert.notEqual(cache.hydrate([item], 'a')[0], original);
  cache.hydrate([item], 'b'); cache.clear(); cache.hydrate([item], 'b');
  assert.equal(calls.length, 4);
});
test('non-cacheable host metadata still normalizes without throwing', () => {
  const { cache, calls } = fixture(), item = record(); item.feedback.extra = item.feedback;
  cache.hydrate([item], 'scope'); cache.hydrate([item], 'scope');
  assert.equal(calls.length, 2);
});
test('ordering changes preserve objects and invalid replacements evict old annotations', () => {
  const cache = createAnnotationHydrator(record => record.feedback.invalid ? null : { id: record.feedback.id, payload: { ...record.feedback } });
  const a = record('a'), b = record('b');
  const initial = cache.hydrate([a, b], 'scope');
  const reordered = cache.hydrate([b, a], 'scope');
  assert.equal(reordered[0], initial[1]); assert.equal(reordered[1], initial[0]);
  a.feedback.invalid = true;
  assert.deepEqual(cache.hydrate([a], 'scope'), []);
  delete a.feedback.invalid;
  assert.notEqual(cache.hydrate([a], 'scope')[0], initial[0]);
});
