// Finds tour files and source files in a project. Shared by `threadmark tours check` and the Vite plugin.

import { readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

export const SKIPPED_DIRECTORIES = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", ".turbo", ".vercel",
  ".output", "coverage", ".cache", "storybook-static", "test-results", "playwright-report",
]);
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".vue", ".svelte", ".astro", ".html", ".htm", ".mdx"]);
export const TOUR_FILE = /\.tour\.(json|js|mjs|ts|mts)$/;

async function walk(directory, found, { sources }) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) await walk(path, found, { sources });
    } else if (entry.isFile()) {
      if (TOUR_FILE.test(entry.name)) found.tours.push(path);
      else if (sources && SOURCE_EXTENSIONS.has(extname(entry.name)) && !entry.name.endsWith(".d.ts")) found.sources.push(path);
    }
  }
}

/** Absolute paths of tour files (and, when asked, source files) under `root`, sorted. */
export async function findProjectFiles(root, { sources = true } = {}) {
  const found = { tours: [], sources: [] };
  await walk(root, found, { sources });
  found.tours.sort();
  found.sources.sort();
  return found;
}

export const displayPath = (root, path) => relative(root, path).split(sep).join("/");
