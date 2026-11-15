import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReactions } from '../src/reactions.js';
test('reactions reject malformed identities, unsupported emoji and duplicate votes', () => {
  const a = { emoji: '👍', reviewer: { id: 'a', displayName: 'Alice', secret: 'drop' } };
  assert.deepEqual(normalizeReactions([null, {}, a, a, { ...a, emoji: 'bad' }, { ...a, reviewer: null }]), [
    { emoji: '👍', reviewer: { id: 'a', displayName: 'Alice' } },
  ]);
});
