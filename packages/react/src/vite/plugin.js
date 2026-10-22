// threadmark-react/vite: lets Tour mode's "Save to code" write tour files while the Vite dev server runs.
// Development only (`apply: "serve"`); production builds never include the endpoint.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { displayPath, findProjectFiles } from "../cli/files.js";
import { isValidThreadmarkTargetId } from "../targetId.js";
import { validateTour } from "../tours/schema.js";

export const TOUR_SAVE_PATH = "/__threadmark/tours/save";
export const TOUR_SAVE_HEADER = "x-threadmark-tours";
const MAX_BODY_BYTES = 256 * 1024;

const reply = (status, body) => ({ status, body });

function sameOrigin(headers) {
  if (!headers.origin) return true;
  try {
    return new URL(headers.origin).host === headers.host;
  } catch {
    return false;
  }
}

/** The existing file for a tour id, if any, so saving updates it in place instead of adding a copy. */
async function existingTourFile(root, id) {
  const { tours } = await findProjectFiles(root, { sources: false });
  for (const path of tours.filter((candidate) => candidate.endsWith(".tour.json"))) {
    try {
      if (JSON.parse(await readFile(path, "utf8"))?.id === id) return path;
    } catch {
      // A broken file can't be the one being saved; `threadmark tours check` reports it.
    }
  }
  return null;
}

/**
 * Handles one save request. Pure apart from the file system, so it can be tested without a server.
 * The request must come from the dev server's own page (same origin, plus a custom header a cross-site
 * form can't send), carry a valid tour whose id matches its file name, and it can only write
 * `<id>.tour.json` files inside `root`: an existing file with that id, or a new one in `dir`.
 */
export async function saveTourRequest({ method, headers = {}, body, root, dir = "tours" }) {
  if (method !== "POST") return reply(405, { ok: false, error: "Use POST." });
  if (headers[TOUR_SAVE_HEADER] !== "1" || !sameOrigin(headers)) {
    return reply(403, { ok: false, error: "Tour files can only be saved from this dev server's own pages." });
  }
  if (Buffer.byteLength(body || "") > MAX_BODY_BYTES) return reply(413, { ok: false, error: "That tour is too large to save." });

  let request;
  try {
    request = JSON.parse(body);
  } catch {
    return reply(400, { ok: false, error: "The request wasn't valid JSON." });
  }
  const match = /(?:^|\/)([^/\\]+)\.tour\.json$/.exec(String(request?.fileName || ""));
  const id = match?.[1];
  if (!id || !isValidThreadmarkTargetId(id)) return reply(400, { ok: false, error: "The file name must be <tour id>.tour.json." });

  let tour;
  try {
    tour = JSON.parse(String(request.contents ?? ""));
  } catch {
    return reply(400, { ok: false, error: "The tour wasn't valid JSON." });
  }
  const validation = validateTour(tour);
  if (!validation.ok) return reply(422, { ok: false, error: "The tour isn't valid.", errors: validation.errors });
  if (tour.id !== id) return reply(400, { ok: false, error: `The file name says "${id}" but the tour's id is "${tour.id}".` });

  const projectRoot = resolve(root);
  const target = (await existingTourFile(projectRoot, id)) || join(projectRoot, dir, `${id}.tour.json`);
  const inside = relative(projectRoot, target);
  if (!inside || inside.startsWith("..") || inside.split(sep).includes("..") || resolve(projectRoot, inside) !== target) {
    return reply(400, { ok: false, error: "Tour files must be saved inside the project." });
  }

  const contents = String(request.contents).endsWith("\n") ? String(request.contents) : `${request.contents}\n`;
  await mkdir(dirname(target), { recursive: true });
  // Write a sibling file first, then swap it in, so a half-written tour never reaches the app.
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, target);
  return reply(200, { ok: true, path: displayPath(projectRoot, target) });
}

/** Reads the request body, or resolves `null` once it passes the size limit. */
function readBody(request) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    request.on("end", () => resolveBody(size > MAX_BODY_BYTES ? null : Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

/**
 * Vite plugin for Tour mode. Add it to vite.config, then pass `saveTourToDevServer` (from
 * "threadmark-react") as `<Threadmark onTourSave>`.
 *
 * @param options.dir Where new tours go, relative to the project root. Defaults to "tours".
 */
export function threadmarkTours({ dir = "tours" } = {}) {
  let root = process.cwd();
  return {
    name: "threadmark-tours",
    apply: "serve",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(TOUR_SAVE_PATH, async (request, response) => {
        let result;
        try {
          const body = await readBody(request);
          result = body === null
            ? reply(413, { ok: false, error: "That tour is too large to save." })
            : await saveTourRequest({ method: request.method, headers: request.headers, body, root, dir });
        } catch (error) {
          result = reply(500, { ok: false, error: `Couldn't write the tour file: ${error?.message || error}` });
        }
        if (result.status === 200) server.config.logger.info(`[threadmark] Saved ${result.body.path}`, { timestamp: true });
        response.statusCode = result.status;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(result.body));
      });
    },
  };
}
