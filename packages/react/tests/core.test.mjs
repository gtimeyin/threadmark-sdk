import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ALLOWED_HOSTS,
  THREADMARK_TARGET_ATTRIBUTE,
  createFeedbackPayload,
  isLocalHostname,
  isThreadmarkEnabled,
  matchesAllowedHost,
  threadmarkTarget,
} from "../src/core.js";

test("recognizes local hostnames without accepting lookalike domains", () => {
  for (const hostname of [
    "localhost",
    "LOCALHOST.",
    "app.localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
  ]) {
    assert.equal(isLocalHostname(hostname), true, hostname);
  }

  for (const hostname of [
    "",
    "localhost.example.com",
    "localhost.evil.test",
    "127.0.0.2",
    "example.test",
  ]) {
    assert.equal(isLocalHostname(hostname), false, hostname);
  }
});

test("matches exact and wildcard allowlist entries with normalized hostnames", () => {
  const allowedHosts = ["Preview.Example.com.", "*.review.example.com"];

  assert.equal(matchesAllowedHost("preview.example.com", allowedHosts), true);
  assert.equal(matchesAllowedHost("PREVIEW.EXAMPLE.COM.", allowedHosts), true);
  assert.equal(matchesAllowedHost("branch.review.example.com", allowedHosts), true);
  assert.equal(matchesAllowedHost("nested.branch.review.example.com", allowedHosts), true);

  assert.equal(matchesAllowedHost("review.example.com", allowedHosts), false);
  assert.equal(matchesAllowedHost("preview.example.com.evil.test", allowedHosts), false);
  assert.equal(matchesAllowedHost("evilpreview.example.com", allowedHosts), false);
});

test("rejects malformed wildcard patterns", () => {
  for (const pattern of ["*example.com", "review.*.com", "*.*.example.com", "*"]) {
    assert.equal(matchesAllowedHost("branch.example.com", [pattern]), false, pattern);
  }

  assert.equal(matchesAllowedHost("localhost", DEFAULT_ALLOWED_HOSTS), true);
  assert.equal(matchesAllowedHost("branch.localhost", DEFAULT_ALLOWED_HOSTS), true);
});

test("fails closed for disabled, production, and disallowed environments", () => {
  const allowedPreview = {
    environment: "preview",
    hostname: "branch.example.com",
    allowedHosts: ["*.example.com"],
  };

  assert.equal(isThreadmarkEnabled({ ...allowedPreview, enabled: true }), true);
  assert.equal(isThreadmarkEnabled({ ...allowedPreview, enabled: false }), false);
  assert.equal(isThreadmarkEnabled({ ...allowedPreview, enabled: undefined }), false);
  assert.equal(
    isThreadmarkEnabled({
      ...allowedPreview,
      enabled: true,
      hostname: "branch.example.com.evil.test",
    }),
    false,
  );

  assert.equal(
    isThreadmarkEnabled({
      enabled: true,
      environment: "production",
      hostname: "branch.example.com",
      allowedHosts: ["*.example.com"],
    }),
    false,
  );
  assert.equal(
    isThreadmarkEnabled({
      enabled: true,
      environment: " production ",
      hostname: "branch.example.com",
      allowedHosts: ["*.example.com"],
    }),
    false,
  );
  assert.equal(
    isThreadmarkEnabled({
      enabled: true,
      environment: "customer-demo",
      hostname: "branch.example.com",
      allowedHosts: ["*.example.com"],
    }),
    false,
  );
});

test("enables local review by default but never infers non-local review", () => {
  assert.equal(isThreadmarkEnabled({ hostname: "localhost" }), true);
  assert.equal(isThreadmarkEnabled({ hostname: "app.localhost" }), true);
  assert.equal(isThreadmarkEnabled({ hostname: "example.test" }), false);

  assert.equal(
    isThreadmarkEnabled({
      enabled: true,
      environment: "preview",
      hostname: "example.test",
      allowedHosts: ["other.example.test"],
    }),
    false,
  );
});

test("creates trimmed stable-target attributes and rejects empty ids", () => {
  assert.deepEqual(threadmarkTarget("  hero-heading  "), {
    [THREADMARK_TARGET_ATTRIBUTE]: "hero-heading",
  });

  for (const id of ["", "   ", null, undefined]) {
    assert.throws(() => threadmarkTarget(id), /requires a non-empty stable id/);
  }
  for (const id of ["customer email@example.com", "contains/slash", "x".repeat(121)]) {
    assert.throws(() => threadmarkTarget(id), /accepts 1–120/);
  }
});

test("creates a deterministic, normalized unified feedback payload", () => {
  const target = {
    tagName: "h1",
    role: "heading",
    accessibleName: "Current headline",
  };
  const comment = "  A clearer headline  ";

  const payload = createFeedbackPayload({
    id: "feedback_123",
    now: "2026-08-12T12:00:00.000Z",
    projectKey: "  project_public_123  ",
    environment: " preview ",
    buildId: "   ",
    route: "/pricing?invite=must-not-be-copied#private-fragment",
    target,
    comment,
    author: {
      id: "  user_42  ",
      displayName: "  Emily R.  ",
      avatarUrl: "https://cdn.example.com/emily.png",
      email: "must-not-be-copied@example.com",
      token: "must-not-be-copied",
    },
    type: "content",
    fields: { proposal: "legacy input must not be copied" },
    token: "must-not-be-copied",
  });

  assert.deepEqual(payload, {
    id: "feedback_123",
    projectKey: "project_public_123",
    environment: "preview",
    buildId: null,
    route: "/pricing",
    target: { ...target, route: "/pricing" },
    comment: "A clearer headline",
    createdAt: "2026-08-12T12:00:00.000Z",
    updatedAt: "2026-08-12T12:00:00.000Z",
    author: {
      id: "user_42",
      displayName: "Emily R.",
      avatarUrl: "https://cdn.example.com/emily.png",
    },
    lastEditedBy: null,
  });
  assert.equal("token" in payload, false);
  assert.equal("type" in payload, false);
  assert.equal("fields" in payload, false);
});

test("preserves the original author and records a bounded last editor", () => {
  const payload = createFeedbackPayload({
    id: "feedback_edited",
    now: "2026-08-12T12:00:00.000Z",
    updatedAt: "2026-08-13T09:30:00.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/dashboard",
    target: { tagName: "button" },
    comment: "Use a clearer label.",
    author: { id: "author_1", displayName: "Emily R.", avatarUrl: "javascript:alert(1)" },
    lastEditedBy: { id: "editor_2", displayName: "Jordan Lee", unexpected: "omit" },
  });

  assert.deepEqual(payload.author, {
    id: "author_1",
    displayName: "Emily R.",
    avatarUrl: null,
  });
  assert.deepEqual(payload.lastEditedBy, {
    id: "editor_2",
    displayName: "Jordan Lee",
    avatarUrl: null,
  });
  assert.equal(payload.updatedAt, "2026-08-13T09:30:00.000Z");
});

test("normalizes threaded replies without trusting extra identity fields", () => {
  const payload = createFeedbackPayload({
    id: "feedback_thread",
    now: "2026-08-12T12:00:00.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/dashboard",
    target: { tagName: "button" },
    comment: "Clarify this action.",
    replies: [
      {
        id: "reply_1",
        parentId: "feedback_thread",
        comment: "  I can update the label.  ",
        createdAt: "2026-08-12T12:05:00.000Z",
        author: {
          id: "reviewer_2",
          displayName: "Jordan Lee",
          token: "must-not-be-copied",
        },
      },
      { id: "invalid_empty", comment: "   " },
      { id: "invalid_type", comment: {} },
    ],
  });

  assert.deepEqual(payload.replies, [{
    id: "reply_1",
    parentId: "feedback_thread",
    comment: "I can update the label.",
    createdAt: "2026-08-12T12:05:00.000Z",
    updatedAt: "2026-08-12T12:05:00.000Z",
    author: { id: "reviewer_2", displayName: "Jordan Lee", avatarUrl: null },
    lastEditedBy: null,
  }]);
  assert.equal("token" in payload.replies[0].author, false);
});

test("uses one bounded string comment for every kind of feedback", () => {
  const base = {
    id: "feedback_123",
    now: "2026-08-12T12:00:00.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/",
    target: { tagName: "div" },
  };

  assert.throws(
    () => createFeedbackPayload({ ...base, comment: {} }),
    /comment must be a string/,
  );

  const payload = createFeedbackPayload({
    ...base,
    comment: `  ${"x".repeat(6100)}  `,
  });
  assert.equal(payload.comment.length, 6000);
  assert.equal(payload.comment, "x".repeat(6000));
});

test("creates a multi-target payload while retaining the primary target", () => {
  const targets = [
    {
      tagName: "h2",
      role: "heading",
      accessibleName: "First card",
      visibleText: "First card",
      bounds: { x: 10, y: 20, width: 100, height: 40 },
      locatorCandidates: { stableId: "first-card", id: "ignored", domPath: "main > h2" },
      route: "/private?token=hidden",
      capturedAt: "2026-08-12T12:00:00.000Z",
    },
    {
      tagName: "h2",
      role: "heading",
      accessibleName: "Second card",
      visibleText: "Second card",
      bounds: { x: 130, y: 20, width: 100, height: 40 },
      locatorCandidates: { stableId: "second-card", id: null, domPath: "main > h2:nth-of-type(2)" },
      route: "/private",
      capturedAt: "2026-08-12T12:00:00.000Z",
    },
  ];

  const payload = createFeedbackPayload({
    id: "feedback_multi",
    now: "2026-08-12T12:00:00.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/private?token=hidden",
    target: targets[0],
    targets,
    captureKind: "multi",
    comment: "Align these cards.",
    evidence: [],
  });

  assert.equal(payload.captureKind, "multi");
  assert.equal(payload.targets.length, 2);
  assert.deepEqual(payload.target, payload.targets[0]);
  assert.equal(payload.target.route, "/private");
  assert.equal(payload.target.locatorCandidates.id, null);
  assert.deepEqual(payload.evidence, []);
});

test("creates a text payload and bounds selected text", () => {
  const payload = createFeedbackPayload({
    id: "feedback_text",
    now: "2026-08-13T12:00:00.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/article?draft=secret#selection",
    captureKind: "text",
    target: {
      kind: "text",
      tagName: "p",
      role: "",
      accessibleName: "Article introduction",
      visibleText: "Visible surrounding copy",
      selectedText: `  ${"q".repeat(1100)}  `,
      bounds: { x: 12, y: 24, width: 300, height: 48 },
      locatorCandidates: {
        stableId: "article-intro",
        id: "must-not-be-copied",
        domPath: "main > p:nth-of-type(1)",
      },
      route: "/article?draft=secret#selection",
      capturedAt: "2026-08-13T12:00:00.000Z",
    },
    comment: "Tighten this sentence.",
  });

  assert.equal(payload.captureKind, "text");
  assert.equal(payload.target.kind, "text");
  assert.equal(payload.target.selectedText, "q".repeat(1000));
  assert.equal(payload.target.route, "/article");
  assert.equal(payload.target.locatorCandidates.id, null);
  assert.deepEqual(payload.targets, [payload.target]);
});

test("whitelists serializable snapshot evidence metadata", () => {
  const region = {
    kind: "region",
    tagName: "region",
    role: "",
    accessibleName: "Drawn region",
    visibleText: "",
    bounds: { x: 12, y: 24, width: 320, height: 180 },
    locatorCandidates: { stableId: null, id: null, domPath: "" },
    route: "/dashboard",
    capturedAt: "2026-08-12T12:00:00.000Z",
  };
  const payload = createFeedbackPayload({
    id: "feedback_region",
    now: "2026-08-12T12:00:00.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/dashboard",
    target: region,
    targets: [region],
    captureKind: "region",
    comment: "Reduce the gap.",
    evidence: [{
      id: "evidence_1",
      kind: "snapshot",
      source: "dom-renderer",
      quality: "degraded",
      mimeType: "image/webp",
      byteSize: 1234,
      pixelSize: { width: 640, height: 360 },
      redactionCount: 2,
      warnings: ["embedded_content_masked"],
      blob: "must-not-be-copied",
    }],
  });

  assert.equal(payload.captureKind, "region");
  assert.equal(payload.target.kind, "region");
  assert.equal(payload.evidence[0].byteSize, 1234);
  assert.equal("blob" in payload.evidence[0], false);
});

test("creates a screenshot payload with serializable marked-up evidence metadata", () => {
  const screenshotTarget = {
    kind: "screenshot",
    tagName: "viewport",
    role: "",
    accessibleName: "Selected screenshot area",
    visibleText: "",
    bounds: { x: 0, y: 0, width: 1440, height: 900 },
    viewportBounds: { x: 0, y: 0, width: 1440, height: 900 },
    pageBounds: { x: 0, y: 720, width: 1440, height: 900 },
    normalizedBounds: { x: 0, y: 0, width: 1, height: 1 },
    viewport: {
      width: 1440,
      height: 900,
      scrollX: 0,
      scrollY: 720,
      devicePixelRatio: 2,
      visualScale: 1,
    },
    locatorCandidates: { stableId: null, id: null, domPath: "" },
    route: "/dashboard?token=must-not-leak#private",
    capturedAt: "2026-08-13T14:00:00.000Z",
  };
  const payload = createFeedbackPayload({
    id: "feedback_screenshot",
    now: "2026-08-13T14:01:00.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/dashboard?token=must-not-leak#private",
    target: screenshotTarget,
    targets: [screenshotTarget],
    captureKind: "screenshot",
    comment: "Move the highlighted action closer to the heading.",
    evidence: [{
      id: "evidence_markup_1",
      kind: "snapshot",
      source: "dom-renderer",
      quality: "degraded",
      mimeType: "image/webp",
      byteSize: 84521,
      pixelSize: { width: 1440, height: 900 },
      redactionCount: 3,
      warnings: ["cross_origin_asset_omitted"],
      blob: "must-not-be-serialized",
      strokes: "must-not-be-serialized",
    }],
  });

  assert.equal(payload.captureKind, "screenshot");
  assert.equal(payload.target.kind, "screenshot");
  assert.equal(payload.target.route, "/dashboard");
  assert.deepEqual(payload.targets, [payload.target]);
  assert.deepEqual(payload.evidence, [{
    id: "evidence_markup_1",
    kind: "snapshot",
    source: "dom-renderer",
    quality: "degraded",
    mimeType: "image/webp",
    byteSize: 84521,
    pixelSize: { width: 1440, height: 900 },
    redactionCount: 3,
    warnings: ["cross_origin_asset_omitted"],
  }]);
  assert.equal("blob" in payload.evidence[0], false);
  assert.equal("strokes" in payload.evidence[0], false);
});

test("creates a bounded interaction trace without copying typed values or printable keys", () => {
  const target = {
    tagName: "input",
    role: "textbox",
    accessibleName: "Search posts",
    visibleText: "",
    bounds: { x: 24, y: 80, width: 280, height: 40 },
    locatorCandidates: { stableId: "search-posts", id: null, domPath: "main > input" },
    route: "/dashboard?token=hidden",
    capturedAt: "2026-08-28T08:00:00.000Z",
  };
  const payload = createFeedbackPayload({
    id: "feedback_interaction",
    now: "2026-08-28T08:00:15.000Z",
    projectKey: "project_public_123",
    environment: "preview",
    route: "/dashboard?token=hidden",
    target,
    targets: [target],
    captureKind: "interaction",
    comment: "The search should update without jumping.",
    interaction: {
      version: 99,
      startedAt: "2026-08-28T08:00:00.000Z",
      durationMs: 9000,
      events: [
        { type: "click", offsetMs: 120, targetIndex: 0, button: 0, x: 42, y: 91, value: "secret" },
        { type: "input", offsetMs: 400, targetIndex: 0, inputType: "search", value: "launch plan" },
        { type: "keydown", offsetMs: 550, targetIndex: 0, key: "a", modifiers: [], value: "a" },
        { type: "keydown", offsetMs: 700, targetIndex: 0, key: "Enter", modifiers: ["meta", "unknown"] },
        { type: "navigation", offsetMs: 1200, route: "/results?query=secret" },
        { type: "unknown", offsetMs: 1500, raw: "omit" },
      ],
    },
  });

  assert.equal(payload.captureKind, "interaction");
  assert.equal(payload.interaction.version, 1);
  assert.equal(payload.interaction.durationMs, 9000);
  assert.deepEqual(payload.interaction.events, [
    { type: "click", offsetMs: 120, targetIndex: 0, button: 0, x: 42, y: 91 },
    { type: "input", offsetMs: 400, targetIndex: 0, inputType: "search" },
    { type: "keydown", offsetMs: 700, targetIndex: 0, key: "Enter", modifiers: ["meta"] },
    { type: "navigation", offsetMs: 1200, route: "/results" },
  ]);
  assert.equal(JSON.stringify(payload).includes("launch plan"), false);
  assert.equal(JSON.stringify(payload).includes("secret"), false);
});

test("repinning preserves original context, evidence and replies while normalizing location history", () => {
  const target = { tagName: 'button', role: 'button', accessibleName: 'Original', visibleText: 'Original',
    bounds: { x: 1, y: 2, width: 80, height: 24 }, route: '/pricing',
    locatorCandidates: { stableId: 'original', domPath: 'button', id: null } };
  const original = createFeedbackPayload({ id: 'comment-1', now: '2026-09-20T10:00:00Z',
    projectKey: 'project', environment: 'preview', buildId: 'build-1', route: '/pricing',
    target, targets: [target], comment: 'Move this button', replies: [{ id: 'reply-1', comment: 'Agreed', parentId: 'comment-1' }],
    evidence: [{ id: 'shot-1', quality: 'captured', mimeType: 'image/png', byteSize: 100,
      pixelSize: { width: 100, height: 100 }, capture: { route: '/pricing?token=private', buildId: 'build-1',
        bounds: { x: 0, y: 0, width: 100, height: 100 }, pin: { x: 0.5, y: 0.5 }, capturedAt: '2026-09-20T10:00:00Z' } }] });
  const moved = createFeedbackPayload({ ...original, now: original.createdAt,
    pin: { target: { ...target, accessibleName: 'New', locatorCandidates: { stableId: 'new', domPath: 'button' } },
      route: '/pricing?secret=hidden', buildId: 'build-2', movedAt: '2026-09-20T11:00:00Z',
      movedBy: { id: 'member-1', displayName: 'Reviewer', secret: 'not included' } },
    pinHistory: [{ target, route: original.route, buildId: original.buildId }] });
  assert.deepEqual(moved.target, original.target);
  assert.deepEqual(moved.evidence, original.evidence);
  assert.deepEqual(moved.replies, original.replies);
  assert.equal(moved.buildId, 'build-1');
  assert.equal(moved.pin.buildId, 'build-2');
  assert.equal(moved.pin.route, '/pricing');
  assert.equal(moved.evidence[0].capture.route, '/pricing');
  assert.equal(moved.pin.movedBy.secret, undefined);
  assert.equal(moved.pinHistory[0].target.locatorCandidates.stableId, 'original');
});

test("a malformed workflow history entry is dropped without discarding the discussion", () => {
  const payload = createFeedbackPayload({
    id: "feedback_history",
    now: "2026-09-01T12:00:00.000Z",
    projectKey: "project",
    route: "/",
    target: { tagName: "button", bounds: { x: 0, y: 0, width: 10, height: 10 }, locatorCandidates: { stableId: "save" } },
    comment: "Keep this thread",
    workflow: { status: "open", history: [null, { action: "resolved", at: "2026-09-01T12:00:00.000Z" }, ...Array(300).fill({ action: "reopened" })] },
  });
  assert.equal(payload.comment, "Keep this thread");
  assert.equal(payload.workflow.history.length, 200);
  assert.ok(payload.workflow.history.every((item) => item.action === "reopened"));
});
