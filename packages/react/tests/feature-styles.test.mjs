import assert from 'node:assert/strict';
import test from 'node:test';
import { installFeatureStyles } from '../src/featureStyles.js';

test('lazy styles retain existing constructed sheets and install once per shadow root', () => {
  const original = globalThis.CSSStyleSheet;
  globalThis.CSSStyleSheet = class { replaceSync(css) { this.css = css; } };
  try {
    const base = {}, root = { host: {}, adoptedStyleSheets: [base] };
    installFeatureStyles(root, '.optional {}'); installFeatureStyles(root, '.optional {}');
    assert.equal(root.adoptedStyleSheets.length, 2);
    assert.equal(root.adoptedStyleSheets[0], base);
    assert.equal(root.adoptedStyleSheets[1].css, '.optional {}');
  } finally { globalThis.CSSStyleSheet = original; }
});
test('lazy style fallback inherits the base nonce and keeps installation isolated per root', () => {
  function makeRoot() {
    return { host: {}, appended: [], ownerDocument: { createElement: () => ({}) },
      querySelector: () => ({ nonce: 'approved-style-nonce' }), append(style) { this.appended.push(style); } };
  }
  const first = makeRoot(), second = makeRoot();
  for (const root of [first, first, second]) installFeatureStyles(root, '.optional {}');
  assert.equal(first.appended.length, 1); assert.equal(second.appended.length, 1);
  assert.equal(first.appended[0].nonce, 'approved-style-nonce');
  assert.equal(first.appended[0].textContent, '.optional {}');
});
