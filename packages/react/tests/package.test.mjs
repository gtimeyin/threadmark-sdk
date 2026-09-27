import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import React from "react";
import { renderToString } from "react-dom/server";

const execFileAsync = promisify(execFile);
const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));

function resolvePackagePath(relativePath) {
  return new URL(`../${relativePath.replace(/^\.\//, "")}`, import.meta.url);
}

async function readThreadmarkSource() {
  const sources = await Promise.all([
    readFile(resolvePackagePath("./src/Threadmark.jsx"), "utf8"),
    readFile(resolvePackagePath("./src/ThreadmarkOverlay.jsx"), "utf8"),
  ]);
  return sources.join("\n");
}

test("declares a side-effect-free React package with external peer dependencies", () => {
  assert.equal(packageJson.name, "threadmark-react");
  assert.equal(packageJson.private, undefined);
  assert.match(packageJson.version, /^0\.1\.0-beta\.\d+$/);
  assert.equal(packageJson.license, "MIT");
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.sideEffects, false);
  assert.equal(packageJson.publishConfig?.access, "public");
  assert.equal(packageJson.publishConfig?.tag, "beta");
  assert.equal(packageJson.publishConfig?.provenance, true);
  assert.equal(packageJson.repository?.directory, "packages/react");
  assert.equal(packageJson.exports?.["."]?.import, "./dist/index.js");
  assert.equal(packageJson.exports?.["."]?.types, "./dist/index.d.ts");
  assert.equal(packageJson.types, "./dist/index.d.ts");
  assert.ok(packageJson.files?.includes("dist"));

  assert.match(packageJson.peerDependencies?.react || "", /18/);
  assert.match(packageJson.peerDependencies?.react || "", /19/);
  assert.match(packageJson.peerDependencies?.["react-dom"] || "", /18/);
  assert.match(packageJson.peerDependencies?.["react-dom"] || "", /19/);
  assert.equal(packageJson.dependencies?.react, undefined);
  assert.equal(packageJson.dependencies?.["react-dom"], undefined);
  assert.match(packageJson.dependencies?.["lucide-react"] || "", /^\^1\./);
});

test("all declared root export targets exist after the package build", async () => {
  const rootExport = packageJson.exports?.["."];
  assert.ok(rootExport, "package must declare its root export");

  for (const [condition, relativePath] of Object.entries(rootExport)) {
    await assert.doesNotReject(
      access(resolvePackagePath(relativePath)),
      `${condition} export does not exist: ${relativePath}`,
    );
  }

  await assert.doesNotReject(access(resolvePackagePath(packageJson.types)));
});

test("the built package exposes exactly the documented runtime API", async () => {
  const sdk = await import("threadmark-react");
  const expectedExports = [
    "DEFAULT_ALLOWED_HOSTS",
    "THREADMARK_TARGET_ATTRIBUTE",
    "Threadmark",
    "createFeedbackPayload",
    "isLocalHostname",
    "isThreadmarkEnabled",
    "matchesAllowedHost",
    "threadmarkTarget",
  ];

  assert.deepEqual(Object.keys(sdk).sort(), expectedExports.sort());
  for (const exportName of expectedExports) {
    assert.notEqual(sdk[exportName], undefined, exportName);
  }
});

test("the browser bundle preserves its client boundary and external React imports", async () => {
  const bundle = await readFile(resolvePackagePath("./dist/index.js"), "utf8");
  assert.match(bundle, /^"use client";/);
  assert.match(bundle, /from "react"/);
  assert.match(bundle, /from "react-dom"/);
  assert.match(bundle, /from "lucide-react\/dist\/esm\/icons\//);
});

test("the review chrome uses Lucide components instead of authored icon paths", async () => {
  const source = await readThreadmarkSource();
  assert.match(source, /from "lucide-react\/dist\/esm\/icons\//);
  assert.doesNotMatch(source, /<(?:path|circle|rect|line|polygon)\b/);
});

test("screenshot markup stays in context instead of opening a modal editor", async () => {
  const [source, styles] = await Promise.all([
    readThreadmarkSource(),
    readFile(resolvePackagePath("./src/overlayStyles.js"), "utf8"),
  ]);

  assert.match(source, /className="tm-markup-overlay"/);
  assert.match(source, /aria-modal="false"/);
  assert.doesNotMatch(source, /tm-markup-(?:shell|editor)/);
  assert.match(styles, /\.tm-markup-canvas\s*\{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.tm-markup-canvas\s*\{[^}]*0 0 0 9999px/s);
  assert.doesNotMatch(styles, /\.tm-markup-(?:shell|editor)\b/);
});

test("action buttons preserve the Figma component token contract", async () => {
  const styles = await readFile(resolvePackagePath("./src/overlayStyles.js"), "utf8");

  assert.match(styles, /--tm-action-primary:\s*#5cc49a/);
  assert.match(styles, /--tm-action-primary-hover:\s*#74d0aa/);
  assert.match(styles, /--tm-size-action:\s*36px/);
  assert.match(styles, /--tm-radius-9:\s*9px/);
  assert.match(styles, /\.tm-submit\s*\{[^}]*background:\s*var\(--tm-action-primary\)/s);
  assert.match(styles, /font-size:\s*13px;[^}]*font-weight:\s*600;[^}]*line-height:\s*18px/s);
});

test("motion explains state changes and fully respects reduced-motion preferences", async () => {
  const [source, styles] = await Promise.all([
    readThreadmarkSource(),
    readFile(resolvePackagePath("./src/overlayStyles.js"), "utf8"),
  ]);

  assert.match(styles, /--tm-motion-fast:\s*120ms/);
  assert.match(styles, /--tm-motion-standard:\s*180ms/);
  assert.match(styles, /--tm-motion-surface:\s*240ms/);
  assert.match(styles, /@keyframes tm-popover-in-below/);
  assert.match(styles, /@keyframes tm-danger-in/);
  assert.match(styles, /@keyframes tm-message-in/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none !important/);
  assert.match(source, /key=\{composerMode\}/);
  assert.match(source, /className="tm-delete-confirm" role="alert" key="delete-confirm"/);
});

test("interaction capture stays in-page and exposes a privacy-safe replay trace", async () => {
  const [source, styles, declarations] = await Promise.all([
    readThreadmarkSource(),
    readFile(resolvePackagePath("./src/overlayStyles.js"), "utf8"),
    readFile(resolvePackagePath("./src/index.d.ts"), "utf8"),
  ]);

  assert.match(source, /label="Record an interaction"/);
  assert.match(source, /className="tm-interaction-recorder"/);
  assert.match(source, /Typed content and printable keystrokes were not recorded/);
  assert.match(source, /<InteractionPreview/);
  assert.doesNotMatch(source, /getDisplayMedia|MediaRecorder/);
  assert.match(styles, /\.tm-interaction-recorder\s*\{/);
  assert.match(styles, /\.tm-interaction-preview\s*\{/);
  assert.match(declarations, /"interaction"/);
  assert.match(declarations, /ThreadmarkInteractionCapture/);
});

test("page version history is host-driven and exposes explicit navigation and carry-forward callbacks", async () => {
  const [source, styles, declarations] = await Promise.all([
    readThreadmarkSource(),
    readFile(resolvePackagePath("./src/overlayStyles.js"), "utf8"),
    readFile(resolvePackagePath("./src/index.d.ts"), "utf8"),
  ]);

  assert.match(source, /aria-label="Feedback panel"/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /Versions <span>/);
  assert.match(source, /className="tm-version-list"/);
  assert.match(source, /Carry comment forward/);
  assert.match(styles, /\.tm-version-list\s*\{/);
  assert.match(styles, /\.tm-carry-forward\s*\{/);
  assert.match(declarations, /interface ThreadmarkPageVersion/);
  assert.match(declarations, /onPageVersionSelect/);
  assert.match(declarations, /onFeedbackCarryForward/);
});

test("using a marked-up screenshot is the attachment approval", async () => {
  const source = await readThreadmarkSource();

  // Snapshots are always attached after automatic masking; there is no per-comment approval checkbox.
  assert.doesNotMatch(source, /tm-snapshot__approval/);
  assert.match(
    source,
    /composeMarkupSnapshot\([\s\S]*?status:\s*"ready",\s*approved:\s*true,/,
  );
  assert.doesNotMatch(source, /Review this masked preview and approve before attaching/);
});

test("ready snapshot evidence shows the image without technical metadata", async () => {
  const [source, styles] = await Promise.all([
    readThreadmarkSource(),
    readFile(resolvePackagePath("./src/overlayStyles.js"), "utf8"),
  ]);

  assert.match(source, /className="tm-snapshot" role="group" aria-label="Snapshot evidence"/);
  assert.doesNotMatch(source, /tm-snapshot__header/);
  assert.doesNotMatch(styles, /\.tm-snapshot__header\b/);
  // Size, byte and redaction details stay in the payload; reviewers only see the image.
  assert.doesNotMatch(source, /tm-snapshot__meta/);
});

test("the browser bundle ships every relative dynamic-import chunk", async () => {
  const bundle = await readFile(resolvePackagePath("./dist/index.js"), "utf8");
  const chunkPaths = [...bundle.matchAll(/import\(["'](\.\/[^"']+)["']\)/g)]
    .map(([, path]) => path);

  assert.ok(chunkPaths.length > 0, "snapshot renderer should remain a lazy chunk");
  for (const chunkPath of chunkPaths) {
    await assert.doesNotReject(access(resolvePackagePath(`./dist/${chunkPath.slice(2)}`)));
  }
});

test("the built declarations match the source declarations", async () => {
  const [source, built] = await Promise.all([
    readFile(resolvePackagePath("./src/index.d.ts"), "utf8"),
    readFile(resolvePackagePath("./dist/index.d.ts"), "utf8"),
  ]);
  assert.equal(built, source);
});

test("the package imports and renders safely during SSR", async () => {
  const { Threadmark } = await import("threadmark-react");

  assert.doesNotThrow(() => {
    const html = renderToString(
      React.createElement(Threadmark, {
        projectKey: "project_public_test",
        enabled: true,
        environment: "preview",
        allowedHosts: ["example.test"],
      }),
    );
    assert.equal(html, "");
  });
});

test("npm pack includes the runtime artifact and excludes implementation sources", async () => {
  const npmCache = await mkdtemp(join(tmpdir(), "threadmark-npm-cache-"));

  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: packageDirectory,
        env: { ...process.env, npm_config_cache: npmCache },
      },
    );
    const [manifest] = JSON.parse(stdout);
    const packedFiles = manifest.files.map(({ path }) => path);

    for (const requiredPath of [
      "LICENSE",
      "README.md",
      "THIRD_PARTY_NOTICES.md",
      "dist/index.js",
      "dist/index.d.ts",
      "package.json",
    ]) {
      assert.ok(packedFiles.includes(requiredPath), `${requiredPath} must be packed`);
    }

    for (const path of packedFiles) {
      assert.equal(path.startsWith("src/"), false, `${path} must not be packed`);
      assert.equal(path.startsWith("tests/"), false, `${path} must not be packed`);
      assert.equal(path.startsWith("scripts/"), false, `${path} must not be packed`);
      assert.equal(path === "vite.config.mjs", false, `${path} must not be packed`);
    }
  } finally {
    await rm(npmCache, { recursive: true, force: true });
  }
});
