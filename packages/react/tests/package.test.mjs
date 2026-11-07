import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
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
  assert.equal(packageJson.dependencies?.["@solar-icons/react"], "2.3.3");
  assert.equal(packageJson.dependencies?.["lucide-react"], undefined);
});

test("all declared export targets exist after the package build", async () => {
  assert.ok(packageJson.exports?.["."], "package must declare its root export");
  assert.equal(packageJson.exports?.["./tours"]?.import, "./dist/tours.js");
  assert.equal(packageJson.exports?.["./tours"]?.types, "./dist/tours.d.ts");

  for (const [subpath, conditions] of Object.entries(packageJson.exports)) {
    if (typeof conditions === "string") continue;
    for (const [condition, relativePath] of Object.entries(conditions)) {
      await assert.doesNotReject(
        access(resolvePackagePath(relativePath)),
        `${subpath} ${condition} export does not exist: ${relativePath}`,
      );
    }
  }

  await assert.doesNotReject(access(resolvePackagePath(packageJson.types)));
});

// Follows relative imports from a built file and returns every module reached plus its bare imports.
async function collectBuiltModuleGraph(entryUrl) {
  const files = new Map();
  const bareImports = new Set();
  const pending = [entryUrl];
  const specifierPatterns = [/\bfrom\s*["']([^"']+)["']/g, /\bimport\s*["']([^"']+)["']/g, /\bimport\(\s*["']([^"']+)["']\s*\)/g];
  while (pending.length) {
    const url = pending.shift();
    if (files.has(url.href)) continue;
    const code = await readFile(url, "utf8");
    files.set(url.href, code);
    for (const pattern of specifierPatterns) {
      for (const [, specifier] of code.matchAll(pattern)) {
        if (specifier.startsWith(".")) pending.push(new URL(specifier, url));
        else bareImports.add(specifier);
      }
    }
  }
  return { files, bareImports };
}

test("the tours entry exposes exactly the documented player API", async () => {
  const tours = await import("threadmark-react/tours");
  const sdk = await import("threadmark-react");

  assert.deepEqual(Object.keys(tours).sort(), [
    "THREADMARK_TARGET_ATTRIBUTE",
    "ThreadmarkTours",
    "TourValidationError",
    "checkTourTheme",
    "defineTour",
    "threadmarkTarget",
    "useThreadmarkTours",
    "validateTour",
  ]);
  assert.equal(tours.THREADMARK_TARGET_ATTRIBUTE, sdk.THREADMARK_TARGET_ATTRIBUTE);
  assert.deepEqual(tours.threadmarkTarget(" checkout.submit "), sdk.threadmarkTarget("checkout.submit"));
  assert.throws(() => tours.threadmarkTarget("not a valid id"), TypeError);

  const declarations = await readFile(resolvePackagePath("./dist/tours.d.ts"), "utf8");
  for (const name of ["ThreadmarkTours", "useThreadmarkTours", "defineTour", "validateTour", "checkTourTheme", "threadmarkTarget"]) {
    assert.match(declarations, new RegExp(`export declare (?:function|const|class) ${name}\\b`), name);
  }
});

test("the tour player renders nothing on the server and mounts only in the browser", async () => {
  const { ThreadmarkTours } = await import("threadmark-react/tours");
  const markup = renderToString(React.createElement(ThreadmarkTours, { tours: [] }, React.createElement("main", null, "App")));
  assert.equal(markup, "<main>App</main>");
});

test("the tours entry never reaches review, capture, or icon code", async () => {
  const { files, bareImports } = await collectBuiltModuleGraph(resolvePackagePath("./dist/tours.js"));
  const allowedPackages = new Set(["react", "react/jsx-runtime", "react-dom"]);

  for (const specifier of bareImports) {
    assert.ok(allowedPackages.has(specifier), `tours entry must not import ${specifier}`);
  }
  for (const [href, code] of files) {
    assert.ok(!href.endsWith("/dist/index.js"), "tours entry must not import the review entry");
    assert.doesNotMatch(code, /data-threadmark-root|getDisplayMedia|getUserMedia|domToBlob|innerHTML|dangerouslySetInnerHTML|fetch\(|XMLHttpRequest|sendBeacon/, `${href} contains review, capture, HTML-injection, or network code`);
  }
});

test("Node-only code (the CLI and the Vite plugin) never reaches the browser bundles", async () => {
  for (const entry of ["./dist/index.js", "./dist/tours.js"]) {
    const { files, bareImports } = await collectBuiltModuleGraph(resolvePackagePath(entry));
    assert.deepEqual([...bareImports].filter((specifier) => specifier.startsWith("node:")), [], `${entry} imports Node built-ins`);
    assert.ok(![...files.keys()].some((href) => /\/dist\/(cli|vite)\.js$/.test(href)), `${entry} reaches the CLI or Vite plugin`);
  }
  const vite = await import("threadmark-react/vite");
  assert.deepEqual(Object.keys(vite).sort(), ["TOUR_SAVE_HEADER", "TOUR_SAVE_PATH", "saveTourRequest", "threadmarkTours"]);
  assert.equal(vite.threadmarkTours().apply, "serve");
});

test("the package ships a threadmark bin that runs tours check against the built CLI", async (t) => {
  assert.equal(packageJson.bin?.threadmark, "./bin/threadmark.mjs");
  assert.ok(packageJson.files.includes("bin"));
  const binSource = await readFile(resolvePackagePath("./bin/threadmark.mjs"), "utf8");
  assert.match(binSource, /^#!\/usr\/bin\/env node\n/);
  assert.match(binSource, /from "\.\.\/dist\/cli\.js"/);

  const root = await mkdtemp(join(tmpdir(), "threadmark-bin-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { writeFile: write, mkdir } = await import("node:fs/promises");
  await mkdir(join(root, "src"));
  await write(join(root, "welcome.tour.json"), JSON.stringify({ id: "welcome", title: "Welcome", steps: [{ id: "a", target: "app.start", title: "Start" }] }));
  await write(join(root, "src/App.jsx"), '<button {...threadmarkTarget("app.start")} />');
  const binPath = fileURLToPath(resolvePackagePath("./bin/threadmark.mjs"));
  const passing = await execFileAsync(process.execPath, [binPath, "tours", "check", "--root", root]);
  assert.match(passing.stdout, /✓ app\.start\s+src\/App\.jsx:1/);

  await write(join(root, "src/App.jsx"), "<button>Start</button>");
  await assert.rejects(execFileAsync(process.execPath, [binPath, "tours", "check", "--root", root]), (error) => error.code === 1 && /✕ app\.start/.test(error.stdout));
});

test("an app using the tour player ships under 13 KB minified and gzipped", async () => {
  const { buildSync } = await import("esbuild");
  const result = buildSync({
    stdin: { contents: 'export { ThreadmarkTours, useThreadmarkTours, threadmarkTarget } from "./dist/tours.js";', resolveDir: packageDirectory, loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    external: ["react", "react-dom", "react/jsx-runtime"],
    logLevel: "silent",
  });
  const gzippedBytes = gzipSync(result.outputFiles[0].contents).length;
  // About 12 KB today; the margin absorbs gzip differences between Node versions.
  assert.ok(gzippedBytes < 13 * 1024, `the tour player is ${gzippedBytes} bytes minified and gzipped; the budget is 13 KB`);
});

test("stable target helpers live in leaf modules the tours entry can share", async () => {
  const [targetIdSource, resolverSource] = await Promise.all([
    readFile(resolvePackagePath("./src/targetId.js"), "utf8"),
    readFile(resolvePackagePath("./src/resolveStableTarget.js"), "utf8"),
  ]);
  assert.doesNotMatch(targetIdSource, /^\s*import\b/m);
  assert.deepEqual(
    [...resolverSource.matchAll(/^\s*import\b.*?from\s*["']([^"']+)["']/gm)].map(([, specifier]) => specifier),
    ["./targetId.js"],
  );
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
    "saveTourToDevServer",
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
  const graph = await collectBuiltModuleGraph(resolvePackagePath("./dist/index.js"));
  assert.ok(graph.bareImports.has("react"));
  assert.ok(graph.bareImports.has("react-dom"));
  assert.ok([...graph.bareImports].some(name => name.startsWith("@solar-icons/react/linear/")));
});

test("the review chrome uses Solar Linear components instead of authored icon paths", async () => {
  const source = await readThreadmarkSource();
  assert.match(source, /from "@solar-icons\/react\/linear\//);
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

test("video feedback keeps media access in one module and its UI on Solar Linear icons", async () => {
  const [source, videoUi, media, declarations] = await Promise.all([
    readThreadmarkSource(),
    readFile(resolvePackagePath("./src/VideoFeedback.jsx"), "utf8"),
    readFile(resolvePackagePath("./src/videoRecording.js"), "utf8"),
    readFile(resolvePackagePath("./src/index.d.ts"), "utf8"),
  ]);

  assert.doesNotMatch(`${source}\n${videoUi}`, /getDisplayMedia|getUserMedia|new MediaRecorder|RecorderClass\(/);
  assert.match(media, /getDisplayMedia\(preferred\)/);
  assert.match(media, /preferCurrentTab: true/);
  assert.match(source, /label="Record a video"/);
  assert.match(videoUi, /from "@solar-icons\/react\/linear\//);
  assert.doesNotMatch(videoUi, /<(?:svg|path|circle|rect|line|polygon)\b/);
  assert.match(declarations, /videoRecording\?: boolean \| ThreadmarkVideoRecordingOptions/);
  assert.match(declarations, /ThreadmarkVideoCapture/);
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
  const graph = await collectBuiltModuleGraph(resolvePackagePath("./dist/index.js"));
  const dynamicImports = [...graph.files.values()].flatMap(code => [...code.matchAll(/import\(["'](\.\/[^"']+)["']\)/g)]);
  assert.ok(dynamicImports.length > 0, "optional features should remain lazy chunks");
  // Traversing the graph above reads every static and dynamic chunk, so missing files fail the test.
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
