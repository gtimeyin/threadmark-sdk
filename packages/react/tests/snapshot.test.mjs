import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDrawRect, snapshotDocumentBudget, snapshotScale } from "../src/snapshot.js";

test("normalizes reverse-direction region drags and clamps to the viewport", () => {
  assert.deepEqual(
    normalizeDrawRect(
      { x: 500, y: 400 },
      { x: -20, y: 900 },
      { width: 800, height: 600 },
    ),
    { left: 0, top: 400, width: 500, height: 200 },
  );
});

test("caps snapshot scale by DPR, 2x, and a four-megapixel pixel budget", () => {
  assert.equal(snapshotScale({ width: 100, height: 100 }, 1), 1);
  assert.equal(snapshotScale({ width: 100, height: 100 }, 3), 2);
  assert.ok(snapshotScale({ width: 4000, height: 3000 }, 2) < 1);
});

function fakeElement(children = [], shadowChildren = []) {
  return {
    children,
    shadowRoot: shadowChildren.length ? { children: shadowChildren } : null,
    scrollWidth: 0,
    scrollHeight: 0,
  };
}

test("fails closed when a snapshot document exceeds DOM or page budgets", () => {
  const shadowLeaf = fakeElement();
  const root = fakeElement([fakeElement(), fakeElement()], [shadowLeaf]);
  root.scrollWidth = 1200;
  root.scrollHeight = 900;
  const documentRef = { documentElement: root, body: root };
  const windowRef = { innerWidth: 800, innerHeight: 600 };

  assert.deepEqual(snapshotDocumentBudget(documentRef, windowRef, { maxNodes: 4 }), {
    allowed: true,
    reason: null,
    nodeCount: 4,
    pageWidth: 1200,
    pageHeight: 900,
  });
  assert.equal(
    snapshotDocumentBudget(documentRef, windowRef, { maxNodes: 3 }).reason,
    "document_too_complex",
  );
  assert.equal(
    snapshotDocumentBudget(documentRef, windowRef, { maxPageArea: 1_000_000 }).reason,
    "document_too_large",
  );
  assert.equal(snapshotDocumentBudget(null, windowRef).reason, "missing_document");
});
