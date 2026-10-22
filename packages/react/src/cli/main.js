import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { checkTours, formatReport } from "./checkTours.js";
import { displayPath as display, findProjectFiles } from "./files.js";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

const USAGE = `Usage: threadmark tours check [--root <dir>] [--json]

Checks every *.tour.json (or *.tour.js / *.tour.ts exporting defineTour()) under the root:
each tour must be valid, and every step's target must appear in the code as
threadmarkTarget("id") or data-threadmark-id="id". Exits 1 when something needs fixing.

  --root <dir>  Folder to check. Defaults to the current folder.
  --json        Print the report as JSON.
`;

async function loadTour(path) {
  if (path.endsWith(".json")) return JSON.parse(await readFile(path, "utf8"));
  const module = await import(pathToFileURL(path).href);
  return module.default ?? Object.values(module).find((value) => value && typeof value === "object" && Array.isArray(value.steps));
}

/** Runs the CLI. Returns the exit code: 0 all good, 1 something needs fixing, 2 usage error. */
export async function main(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = [...argv];
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    stdout.write(USAGE);
    return args.length ? 0 : 2;
  }
  if (args[0] !== "tours" || args[1] !== "check") {
    stderr.write(`Unknown command: ${args.slice(0, 2).join(" ")}\n\n${USAGE}`);
    return 2;
  }
  let root = cwd;
  let json = false;
  for (let index = 2; index < args.length; index += 1) {
    if (args[index] === "--json") json = true;
    else if (args[index] === "--root" && args[index + 1]) root = resolve(cwd, args[(index += 1)]);
    else {
      stderr.write(`Unknown option: ${args[index]}\n\n${USAGE}`);
      return 2;
    }
  }
  if (!(await stat(root).catch(() => null))?.isDirectory()) {
    stderr.write(`Not a folder: ${root}\n`);
    return 2;
  }

  const found = await findProjectFiles(root);

  const tourFiles = await Promise.all(found.tours.map(async (path) => {
    const file = display(root, path);
    try {
      const data = await loadTour(path);
      return data ? { file, data } : { file, loadError: "no tour exported" };
    } catch (error) {
      const message = String(error?.message || error).split("\n")[0];
      return { file, loadError: path.endsWith(".json") ? `invalid JSON (${message})` : message };
    }
  }));
  const sources = [];
  for (const path of found.sources) {
    const size = (await stat(path).catch(() => null))?.size ?? Infinity;
    if (size > MAX_SOURCE_BYTES) continue;
    sources.push({ file: display(root, path), text: await readFile(path, "utf8").catch(() => "") });
  }

  const report = checkTours({ tourFiles, sources });
  stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report));
  return report.ok ? 0 : 1;
}
