import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let pickingHtml;
let pickingBundle;

test.beforeAll(async () => {
  pickingHtml = (await readFile(new URL("../fixtures/picking-events.html", import.meta.url), "utf8"))
    .replace('<script type="module" src="./picking-events.jsx"></script>', "");
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [react()],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("../fixtures/picking-events.jsx", import.meta.url)), formats: ["iife"], name: "ThreadmarkNetworkFixture" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  pickingBundle = output.find((item) => item.type === "chunk")?.code;
});


async function mountFixture(page, query) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://localhost/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/threadmark-fixture.js") return route.fulfill({ status: 200, contentType: "text/javascript", body: pickingBundle });
    if (url.pathname === "/graphql") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-request-id": "req_42", "set-cookie": "session=abc" },
        body: JSON.stringify({ data: { applyPromo: null }, errors: [{ message: "Promo SPRING isn't valid for ada@example.com", extensions: { code: "BAD_USER_INPUT" } }] }),
      });
    }
    if (url.pathname === "/api/login") return route.fulfill({ status: 200, contentType: "application/json", body: "{\"token\":\"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLWhlcmU\"}" });
    return route.fulfill({ status: 200, contentType: "text/html", body: pickingHtml.replace("</body>", '<script src="/threadmark-fixture.js"></script></body>') });
  });
  await page.goto(`http://localhost/picking-events${query}`, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => window.__threadmarkHydrated)).toBe(true);
  return pageErrors;
}

async function useTheSite(page) {
  await page.evaluate(async () => {
    const graphql = await fetch("/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer live-abcdefghijklmnopqrstuvwxyz" },
      body: JSON.stringify({
        query: "mutation ApplyPromo($code: String!) { applyPromo(code: $code) { ok } }",
        variables: { code: "SPRING", email: "ada@example.com", cardNumber: "4242424242424242" },
      }),
    });
    await graphql.json();
    await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "ada@example.com", password: "hunter2" }) });
  });
  await page.waitForTimeout(500);
}

async function postAndReadReplay(page) {
  await page.locator(".tm-launcher").click();
  await page.locator("#secondary-target").click();
  await expect(page.locator(".tm-replay-attachment")).toContainText("Playback attached");
  await page.evaluate(() => {
    const textarea = document.querySelector("[data-threadmark-root]").shadowRoot.querySelector("#tm-comment");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, "Promo code is refused");
    textarea.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  });
  await page.locator(".tm-submit").click();
  await expect(page.locator(".tm-popover")).toHaveCount(0);
  return page.evaluate(async () => {
    const feedback = window.__threadmarkFeedback.at(-1);
    const replayId = feedback.evidence.find((item) => item.kind === "replay").id;
    const blob = window.__threadmarkFeedbackContexts.at(-1).evidence.find((item) => item.id === replayId).blob;
    const text = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const events = JSON.parse(text).filter((event) => event.type === 5);
    return {
      summary: feedback.replay,
      network: events.filter((event) => event.data.tag === "threadmark.network").map((event) => event.data.payload),
      timing: events.filter((event) => event.data.tag === "threadmark.timing").map((event) => event.data.payload),
      raw: text,
    };
  });
}

test("GraphQL errors behind HTTP 200 count as failed requests, with operation and codes, and timing is kept", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?replay=1");
  await useTheSite(page);
  const { summary, network, timing, raw } = await postAndReadReplay(page);
  expect(summary.network.failed).toBe(1);
  expect(summary.network.entries).toEqual([expect.objectContaining({ method: "POST", url: "http://localhost/graphql", status: 200, outcome: "graphql_error", operation: "mutation ApplyPromo", errorCodes: ["BAD_USER_INPUT"] })]);
  const graphql = network.find((entry) => entry.url === "http://localhost/graphql");
  expect(graphql.graphql).toEqual({ type: "mutation", name: "ApplyPromo", errors: { count: 1, codes: ["BAD_USER_INPUT"] } });
  expect(graphql.request).toBeUndefined();
  expect(graphql.response).toBeUndefined();
  expect(timing.some((entry) => entry.url === "http://localhost/graphql" && entry.durationMs >= 0)).toBe(true);
  // Without the host keeping bodies, nothing from them reaches the stored replay.
  for (const secret of ["SPRING", "ada@example.com", "4242424242424242", "hunter2", "live-abcdefghijklmnop", "eyJhbGciOiJIUzI1NiJ9"]) expect(raw).not.toContain(secret);
  expect(pageErrors).toEqual([]);
});

test("with bodies kept, they are filtered: credentials, emails, and card numbers removed, sign-in requests left out", async ({ page }) => {
  const pageErrors = await mountFixture(page, "?replay=1&network=bodies");
  await useTheSite(page);
  const { network, raw } = await postAndReadReplay(page);
  const graphql = network.find((entry) => entry.url === "http://localhost/graphql");
  expect(graphql.request.headers).toEqual({ "content-type": "application/json" });
  expect(JSON.parse(graphql.request.body).variables).toEqual({ code: "SPRING", email: "[email]", cardNumber: "[redacted]" });
  expect(graphql.response.headers).toMatchObject({ "content-type": "application/json", "x-request-id": "req_42" });
  expect(Object.keys(graphql.response.headers)).not.toContain("set-cookie");
  expect(JSON.parse(graphql.response.body).errors[0].message).toBe("Promo SPRING isn't valid for [email]");
  expect(graphql.graphql.errors.messages).toEqual(["Promo SPRING isn't valid for [email]"]);
  const login = network.find((entry) => entry.url === "http://localhost/api/login");
  expect(login.bodies).toBe("credential endpoint");
  expect(login.request).toBeUndefined();
  for (const secret of ["ada@example.com", "4242424242424242", "hunter2", "live-abcdefghijklmnop", "eyJhbGciOiJIUzI1NiJ9", "session=abc"]) expect(raw).not.toContain(secret);
  expect(pageErrors).toEqual([]);
});
