// `threadmark tours check`: does every tour step still point at a target that exists in the code?
// Pure functions over file contents; main.js does the file system work.

import { isValidThreadmarkTargetId } from "../targetId.js";
import { validateTour } from "../tours/schema.js";

const LITERAL_PATTERNS = [
  /(?<!function\s)\bthreadmarkTarget\(\s*(["'`])([^"'`$\\\n]+)\1\s*\)/g,
  /\bdata-threadmark-id\s*=\s*\{?\s*(["'`])([^"'`$\\\n]+)\1/g,
  /["']data-threadmark-id["']\s*:\s*(["'`])([^"'`$\\\n]+)\1/g,
];
const TEMPLATE_PATTERNS = [
  /(?<!function\s)\bthreadmarkTarget\(\s*`([^`$\\\n]*)\$\{/g,
  /\bdata-threadmark-id\s*=\s*\{\s*`([^`$\\\n]*)\$\{/g,
];
const VARIABLE_CALL = /(?<!function\s)\bthreadmarkTarget\(\s*(?![\s"'`)])/g;

function lineAt(text, index) {
  let line = 1;
  for (let position = text.indexOf("\n"); position !== -1 && position < index; position = text.indexOf("\n", position + 1)) line += 1;
  return line;
}

/**
 * Finds stable target ids written literally in one source file, plus ids built at runtime.
 * Templates such as threadmarkTarget(`project.${id}`) give a prefix ("project.") that ids can be matched against;
 * anything else dynamic is only counted.
 */
export function scanSourceForTargets(text, file) {
  const ids = [];
  const prefixes = [];
  let dynamic = 0;
  for (const pattern of LITERAL_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (isValidThreadmarkTargetId(match[2])) ids.push({ id: match[2], file, line: lineAt(text, match.index) });
    }
  }
  for (const pattern of TEMPLATE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) prefixes.push({ prefix: match[1], file, line: lineAt(text, match.index) });
      else dynamic += 1;
    }
  }
  dynamic += [...text.matchAll(VARIABLE_CALL)].length;
  return { ids, prefixes, dynamic };
}

function stepTargets(tour) {
  return tour.steps.flatMap((step) => [
    step.target ? { stepId: step.id, target: step.target, phone: false } : null,
    step.phone?.target ? { stepId: step.id, target: step.phone.target, phone: true } : null,
  ]).filter(Boolean);
}

/**
 * @param tourFiles [{ file, data?, loadError? }] where data is the parsed tour
 * @param sources   [{ file, text }]
 * @returns a report: one entry per tour file, plus totals. `ok` is false when a tour is invalid or a target is missing.
 */
export function checkTours({ tourFiles, sources }) {
  const found = new Map();
  const prefixes = [];
  let dynamic = 0;
  for (const { file, text } of sources) {
    const scan = scanSourceForTargets(text, file);
    for (const hit of scan.ids) found.set(hit.id, [...(found.get(hit.id) || []), hit]);
    prefixes.push(...scan.prefixes);
    dynamic += scan.dynamic;
  }

  const seenTourIds = new Map();
  const tours = tourFiles.map(({ file, data, loadError }) => {
    if (loadError) return { file, id: null, title: null, status: "unloadable", error: loadError, errors: [], targets: [] };
    const result = validateTour(data);
    if (!result.ok) return { file, id: data?.id ?? null, title: data?.title ?? null, status: "invalid", errors: result.errors, targets: [] };
    const tour = result.tour;
    const duplicateOf = seenTourIds.get(tour.id);
    seenTourIds.set(tour.id, seenTourIds.get(tour.id) || file);
    const targets = stepTargets(tour).map(({ stepId, target, phone }) => {
      const hits = found.get(target) || [];
      if (hits.length) return { stepId, target, phone, status: hits.length > 1 ? "repeated" : "found", locations: hits.map(({ file: where, line }) => ({ file: where, line })) };
      const prefix = prefixes.find((candidate) => target.startsWith(candidate.prefix));
      if (prefix) return { stepId, target, phone, status: "dynamic", locations: [{ file: prefix.file, line: prefix.line }], prefix: prefix.prefix };
      return { stepId, target, phone, status: "missing", locations: [] };
    });
    return {
      file,
      id: tour.id,
      title: tour.title,
      steps: tour.steps.length,
      status: duplicateOf ? "duplicate" : targets.some((target) => target.status === "missing") ? "missing" : "ok",
      duplicateOf,
      errors: [],
      targets,
    };
  });

  const missing = tours.reduce((sum, tour) => sum + tour.targets.filter((target) => target.status === "missing").length, 0);
  const broken = tours.filter((tour) => ["invalid", "unloadable", "duplicate"].includes(tour.status)).length;
  return { ok: missing === 0 && broken === 0, tours, missing, broken, dynamicIds: dynamic, sourcesScanned: sources.length };
}

const MARKS = { found: "✓", repeated: "!", dynamic: "?", missing: "✕" };

/** Plain-text report for people and CI logs. */
export function formatReport(report) {
  if (!report.tours.length) {
    return "No tour files found. Tours are *.tour.json files (or *.tour.js / *.tour.ts that export defineTour()).\n";
  }
  const lines = [];
  for (const tour of report.tours) {
    if (tour.status === "unloadable") {
      lines.push(`✕ ${tour.file}`, `  couldn't be read: ${tour.error}`, "");
      continue;
    }
    if (tour.status === "invalid") {
      lines.push(`✕ ${tour.file}${tour.id ? ` (${tour.id})` : ""} is not a valid tour`);
      for (const error of tour.errors) lines.push(`  ${error.path}: ${error.message}`);
      lines.push("");
      continue;
    }
    lines.push(`${tour.id} · ${tour.steps} ${tour.steps === 1 ? "step" : "steps"}  ${tour.file}`);
    if (tour.status === "duplicate") lines.push(`  ✕ the id "${tour.id}" is already used by ${tour.duplicateOf}`);
    const width = Math.max(...tour.targets.map((target) => target.target.length + (target.phone ? 8 : 0)), 0);
    for (const target of tour.targets) {
      const label = `${target.target}${target.phone ? " (phone)" : ""}`.padEnd(width + 2);
      const where = target.locations.map(({ file, line }) => `${file}:${line}`);
      const detail = {
        found: where[0],
        repeated: `used in ${where.length} places (${where.join(", ")}); fine if only one is on the page at a time`,
        dynamic: `built at runtime from "${target.prefix}…" (${where[0]}); can't check statically`,
        missing: "not found in the code",
      }[target.status];
      lines.push(`  ${MARKS[target.status]} ${label}${detail}`);
    }
    lines.push("");
  }
  const problems = [];
  if (report.missing) problems.push(`${report.missing} ${report.missing === 1 ? "step has lost its target" : "steps have lost their targets"}`);
  if (report.broken) problems.push(`${report.broken} ${report.broken === 1 ? "tour file needs fixing" : "tour files need fixing"}`);
  lines.push(problems.length
    ? `${problems.join(" and ")}. Repin moved steps in Threadmark's Tour mode, or update the target ids.`
    : `All tour steps point at targets in the code (${report.sourcesScanned} ${report.sourcesScanned === 1 ? "file" : "files"} checked).`);
  if (report.dynamicIds) lines.push(`${report.dynamicIds} target ${report.dynamicIds === 1 ? "id is" : "ids are"} built at runtime and couldn't be checked.`);
  return `${lines.join("\n")}\n`;
}
