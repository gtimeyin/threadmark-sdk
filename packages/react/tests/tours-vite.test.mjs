import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { createServer } from "vite";

import { saveTourToDevServer } from "../src/devServerSave.js";
import { serializeTour } from "../src/tours/authoring.js";
import { TOUR_SAVE_PATH, saveTourRequest, threadmarkTours } from "../src/vite/plugin.js";

const tour = { id: "welcome", title: "Welcome", steps: [{ id: "one", target: "projects.new", title: "Start here" }] };
const headers = { "x-threadmark-tours": "1", host: "localhost:5173", origin: "http://localhost:5173" };
const body = (fileName = "tours/welcome.tour.json", data = tour) => JSON.stringify({ fileName, contents: serializeTour(data) });

async function project(files = {}) {
  const root = await mkdtemp(join(tmpdir(), "threadmark-vite-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

test("saves a new tour into the tours folder and reports where", async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await saveTourRequest({ method: "POST", headers, body: body(), root });
  assert.deepEqual(result, { status: 200, body: { ok: true, path: "tours/welcome.tour.json" } });
  const written = await readFile(join(root, "tours/welcome.tour.json"), "utf8");
  assert.deepEqual(JSON.parse(written).steps, tour.steps);
  assert.ok(written.endsWith("\n"));
  assert.deepEqual((await readdir(join(root, "tours"))).sort(), ["welcome.tour.json"], "no temporary files are left behind");
});

test("updates an existing file for the same tour id wherever it lives, instead of adding a copy", async (t) => {
  const root = await project({
    "src/onboarding/welcome.tour.json": JSON.stringify({ ...tour, title: "Old title" }),
    "src/other.tour.json": JSON.stringify({ ...tour, id: "other" }),
    "node_modules/pkg/welcome.tour.json": JSON.stringify(tour),
  });
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await saveTourRequest({ method: "POST", headers, body: body("tours/welcome.tour.json", { ...tour, title: "New title" }), root, dir: "tours" });
  assert.equal(result.body.path, "src/onboarding/welcome.tour.json");
  assert.equal(JSON.parse(await readFile(join(root, "src/onboarding/welcome.tour.json"), "utf8")).title, "New title");
  await assert.rejects(readFile(join(root, "tours/welcome.tour.json")));
});

test("only same-origin requests with the Threadmark header can save", async () => {
  const root = "/nonexistent-should-not-be-touched";
  assert.equal((await saveTourRequest({ method: "GET", headers, body: "", root })).status, 405);
  assert.equal((await saveTourRequest({ method: "POST", headers: { ...headers, "x-threadmark-tours": undefined }, body: body(), root })).status, 403);
  assert.equal((await saveTourRequest({ method: "POST", headers: { ...headers, origin: "https://evil.example" }, body: body(), root })).status, 403);
  assert.equal((await saveTourRequest({ method: "POST", headers: { ...headers, origin: "not a url" }, body: body(), root })).status, 403);
});

test("rejects bad requests, invalid tours, mismatched names, and anything outside the project", async (t) => {
  const root = await project();
  t.after(() => rm(root, { recursive: true, force: true }));
  const save = (overrides) => saveTourRequest({ method: "POST", headers, root, ...overrides });
  assert.equal((await save({ body: "{not json" })).status, 400);
  assert.equal((await save({ body: JSON.stringify({ fileName: "welcome.json", contents: "{}" }) })).status, 400);
  assert.equal((await save({ body: JSON.stringify({ fileName: "bad id.tour.json", contents: "{}" }) })).status, 400);
  assert.equal((await save({ body: JSON.stringify({ fileName: "welcome.tour.json", contents: "{oops" }) })).status, 400);
  const invalid = await save({ body: body("welcome.tour.json", { ...tour, steps: [] }) });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.errors[0].path, "steps");
  const mismatch = await save({ body: body("other.tour.json") });
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.body.error, /"other".*"welcome"/);
  assert.equal((await save({ body: "x".repeat(300 * 1024) })).status, 413);

  // Path segments in the file name are ignored: only <id>.tour.json is ever written, inside the project.
  const sneaky = await save({ body: body("../../../etc/welcome.tour.json") });
  assert.equal(sneaky.body.path, "tours/welcome.tour.json");
  // A new tour can't be pointed outside the project through `dir`.
  const outside = await save({ body: body("fresh.tour.json", { ...tour, id: "fresh" }), dir: "../escaped" });
  assert.equal(outside.status, 400);
  await assert.rejects(readFile(join(root, "..", "escaped", "fresh.tour.json")));
});

test("the Vite plugin serves the endpoint in dev, and saveTourToDevServer talks to it", async (t) => {
  const root = await project({ "index.html": "<!doctype html><title>t</title>" });
  const plugin = threadmarkTours();
  assert.equal(plugin.apply, "serve");
  const server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [plugin], server: { port: 0, strictPort: false } });
  await server.listen();
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  const base = `http://localhost:${server.httpServer.address().port}`;

  const result = await saveTourToDevServer(tour, { fileName: "tours/welcome.tour.json", contents: serializeTour(tour) }, { endpoint: `${base}${TOUR_SAVE_PATH}` });
  assert.deepEqual(result, { ok: true, path: "tours/welcome.tour.json" });
  assert.equal(JSON.parse(await readFile(join(root, "tours/welcome.tour.json"), "utf8")).id, "welcome");

  await assert.rejects(
    saveTourToDevServer({ ...tour, steps: [] }, { fileName: "welcome.tour.json", contents: serializeTour({ ...tour, steps: [] }) }, { endpoint: `${base}${TOUR_SAVE_PATH}` }),
    /isn't valid/,
  );
  await assert.rejects(
    saveTourToDevServer(tour, { fileName: "welcome.tour.json", contents: serializeTour(tour) }, { endpoint: `${base}/__nothing_here` }),
    /no tour endpoint|failed/,
  );
  const crossSite = await fetch(`${base}${TOUR_SAVE_PATH}`, { method: "POST", headers: { origin: "https://evil.example", "x-threadmark-tours": "1" }, body: body() });
  assert.equal(crossSite.status, 403);
});

test("a tour written in code is never shadowed by a new JSON copy", async (t) => {
  const root = await project({ "tours/welcome.tour.ts": 'export default defineTour({ id: "welcome", title: "Welcome", steps: [] });' });
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await saveTourRequest({ method: "POST", headers, body: body(), root });
  assert.equal(result.status, 409);
  assert.match(result.body.error, /tours\/welcome\.tour\.ts/);
  await assert.rejects(readFile(join(root, "tours/welcome.tour.json")));
});

test("the endpoint runs after Vite's host check, so DNS-rebinding requests never reach it", async (t) => {
  const { request } = await import("node:http");
  const root = await project({ "index.html": "<!doctype html><title>t</title>" });
  const server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [threadmarkTours()], server: { port: 0, strictPort: false } });
  await server.listen();
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  const port = server.httpServer.address().port;
  const status = await new Promise((resolveStatus, reject) => {
    const outgoing = request({ host: "127.0.0.1", port, path: TOUR_SAVE_PATH, method: "POST", headers: {
      host: "evil.example", origin: "http://evil.example", "x-threadmark-tours": "1", "content-type": "application/json",
    } }, (incoming) => {
      incoming.resume();
      resolveStatus(incoming.statusCode);
    });
    outgoing.on("error", reject);
    outgoing.end(body());
  });
  assert.equal(status, 403);
  await assert.rejects(readFile(join(root, "tours/welcome.tour.json")));
});
