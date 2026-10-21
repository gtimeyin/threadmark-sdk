import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { checkTours, formatReport, scanSourceForTargets } from "../src/cli/checkTours.js";
import { main } from "../src/cli/main.js";

const welcome = {
  id: "welcome",
  title: "Welcome",
  steps: [
    { id: "new", target: "projects.new", title: "Start something new" },
    { id: "invite", target: "team.invite", title: "Bring your people in", phone: { target: "nav.menu" } },
    { id: "publish", target: "project.publish.42", title: "Share it" },
  ],
};

test("finds literal target ids in JSX, HTML, and spread objects, with line numbers", () => {
  const source = [
    'import { threadmarkTarget } from "threadmark-react";',
    '<button {...threadmarkTarget("projects.new")}>New</button>',
    "<a {...threadmarkTarget('nav.menu')}>Menu</a>",
    '<div data-threadmark-id="team.invite"></div>',
    '<span data-threadmark-id={"team.list"} />',
    'const attrs = { "data-threadmark-id": "settings.save" };',
    "threadmarkTarget(`plain.template`)",
    'threadmarkTarget("not a valid id")',
  ].join("\n");
  const scan = scanSourceForTargets(source, "src/App.jsx");
  assert.deepEqual(scan.ids.map(({ id, line }) => [id, line]).sort(), [
    ["nav.menu", 3],
    ["plain.template", 7],
    ["projects.new", 2],
    ["settings.save", 6],
    ["team.invite", 4],
    ["team.list", 5],
  ]);
  assert.equal(scan.dynamic, 0);
});

test("ids built at runtime become prefixes or are counted, and definitions are ignored", () => {
  const source = [
    "export function threadmarkTarget(id) {}",
    "<button {...threadmarkTarget(`project.publish.${project.id}`)} />",
    "<div data-threadmark-id={`row.${index}`} />",
    "<li {...threadmarkTarget(item.targetId)} />",
    "<li {...threadmarkTarget(`${prefix}.save`)} />",
  ].join("\n");
  const scan = scanSourceForTargets(source, "src/List.jsx");
  assert.deepEqual(scan.prefixes.map(({ prefix, line }) => [prefix, line]), [["project.publish.", 2], ["row.", 3]]);
  assert.equal(scan.dynamic, 2);
  assert.deepEqual(scan.ids, []);
});

test("reports found, repeated, runtime-built, and missing targets, including phone overrides", () => {
  const report = checkTours({
    tourFiles: [{ file: "tours/welcome.tour.json", data: welcome }],
    sources: [
      { file: "src/Header.jsx", text: '\n<button {...threadmarkTarget("projects.new")} />' },
      { file: "src/Card.jsx", text: "<button {...threadmarkTarget(`project.publish.${id}`)} />" },
      { file: "src/Nav.jsx", text: '<a data-threadmark-id="nav.menu" />\n<a data-threadmark-id="nav.menu" />' },
    ],
  });
  assert.equal(report.ok, false);
  assert.equal(report.missing, 1);
  assert.deepEqual(report.tours[0].targets.map(({ target, status, phone }) => [target, status, phone]), [
    ["projects.new", "found", false],
    ["team.invite", "missing", false],
    ["nav.menu", "repeated", true],
    ["project.publish.42", "dynamic", false],
  ]);
  assert.deepEqual(report.tours[0].targets[0].locations, [{ file: "src/Header.jsx", line: 2 }]);

  const text = formatReport(report);
  assert.match(text, /^welcome · 3 steps {2}tours\/welcome\.tour\.json$/m);
  assert.match(text, /✓ projects\.new\s+src\/Header\.jsx:2/);
  assert.match(text, /✕ team\.invite\s+not found in the code/);
  assert.match(text, /! nav\.menu \(phone\)\s+used in 2 places/);
  assert.match(text, /\? project\.publish\.42\s+built at runtime from "project\.publish\.…"/);
  assert.match(text, /1 step has lost its target\./);
});

test("invalid, unreadable, and duplicate tours fail the check with reasons", () => {
  const report = checkTours({
    tourFiles: [
      { file: "a.tour.json", data: welcome },
      { file: "b.tour.json", data: { ...welcome, steps: [{ id: "x", target: "projects.new", title: "Dupe" }] } },
      { file: "c.tour.json", data: { id: "broken", title: "Broken", steps: [{ id: "x", title: "No target" }] } },
      { file: "d.tour.json", loadError: "invalid JSON (Unexpected token)" },
    ],
    sources: [{ file: "src/App.jsx", text: 'threadmarkTarget("projects.new") threadmarkTarget("team.invite") threadmarkTarget("nav.menu") threadmarkTarget("project.publish.42")' }],
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.tours.map((tour) => tour.status), ["ok", "duplicate", "invalid", "unloadable"]);
  assert.equal(report.broken, 3);
  const text = formatReport(report);
  assert.match(text, /✕ the id "welcome" is already used by a\.tour\.json/);
  assert.match(text, /✕ c\.tour\.json \(broken\) is not a valid tour\n {2}steps\[0\]\.target: /);
  assert.match(text, /✕ d\.tour\.json\n {2}couldn't be read: invalid JSON/);
  assert.match(text, /3 tour files need fixing\./);
});

test("an all-good report passes and says how much it checked", () => {
  const report = checkTours({
    tourFiles: [{ file: "t.tour.json", data: { id: "t", title: "T", steps: [{ id: "a", target: "a.b", title: "A" }] } }],
    sources: [{ file: "x.js", text: 'threadmarkTarget("a.b"); threadmarkTarget(dynamicId);' }],
  });
  assert.equal(report.ok, true);
  assert.match(formatReport(report), /All tour steps point at targets in the code \(1 file checked\)\.\n1 target id is built at runtime and couldn't be checked\.\n$/);
  assert.match(formatReport(checkTours({ tourFiles: [], sources: [] })), /^No tour files found/);
});

async function project(files) {
  const root = await mkdtemp(join(tmpdir(), "threadmark-tours-cli-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

function capture() {
  let text = "";
  return { stream: { write: (chunk) => { text += chunk; } }, read: () => text };
}

test("the CLI walks a project, skips build and dependency folders, and exits 1 when a target is missing", async (t) => {
  const root = await project({
    "tours/welcome.tour.json": JSON.stringify(welcome),
    "tours/extra.tour.mjs": 'export default { id: "extra", title: "Extra", steps: [{ id: "a", target: "projects.new", title: "A" }] };',
    "src/App.jsx": '<button {...threadmarkTarget("projects.new")} />\n<a data-threadmark-id="nav.menu" />\n<b {...threadmarkTarget(`project.publish.${id}`)} />',
    "node_modules/lib/index.js": 'threadmarkTarget("team.invite")',
    "dist/app.js": 'threadmarkTarget("team.invite")',
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  const out = capture();
  assert.equal(await main(["tours", "check", "--root", root], { stdout: out.stream, stderr: out.stream }), 1);
  assert.match(out.read(), /extra · 1 step {2}tours\/extra\.tour\.mjs/);
  assert.match(out.read(), /✕ team\.invite\s+not found in the code/);
  assert.match(out.read(), /1 step has lost its target\./);

  await writeFile(join(root, "src/Team.jsx"), '<button {...threadmarkTarget("team.invite")} />');
  const json = capture();
  assert.equal(await main(["tours", "check", "--json"], { cwd: root, stdout: json.stream, stderr: json.stream }), 0);
  const report = JSON.parse(json.read());
  assert.equal(report.ok, true);
  assert.equal(report.sourcesScanned, 2);
});

test("the CLI explains usage and rejects unknown commands, options, and folders", async () => {
  const out = capture();
  assert.equal(await main(["--help"], { stdout: out.stream, stderr: out.stream }), 0);
  assert.match(out.read(), /Usage: threadmark tours check/);
  assert.equal(await main([], { stdout: out.stream, stderr: out.stream }), 2);
  assert.equal(await main(["tours", "lint"], { stdout: out.stream, stderr: out.stream }), 2);
  assert.equal(await main(["tours", "check", "--fix"], { stdout: out.stream, stderr: out.stream }), 2);
  assert.equal(await main(["tours", "check", "--root", "/definitely/not/here"], { stdout: out.stream, stderr: out.stream }), 2);
});
