import assert from "node:assert/strict";
import test from "node:test";

import {
  applySanitizer,
  cleanBody,
  createBodyBudget,
  graphqlErrors,
  graphqlOperation,
  isCredentialEndpoint,
  pickHeaders,
  resolveNetworkOptions,
  resourceKind,
  resourceTiming,
  timingPhases,
} from "../src/networkCapture.js";
import { REPLAY_NETWORK_EVENT, REPLAY_SOCKET_EVENT, REPLAY_TIMING_EVENT, EVENT_TYPE, INCREMENTAL_SOURCE, MOUSE_INTERACTION, REPLAY_CONSOLE_EVENT, instrumentPage, summarizeReplay } from "../src/sessionReplay.js";
import { buildReplayTimeline, graphqlLabel, isFailedRequest, requestTypeGroup } from "../src/replayTimeline.js";
import { scrubCardNumbers } from "../src/scrub.js";

test("GraphQL operations are read from POST bodies, batches, persisted queries, and GET parameters", () => {
  assert.deepEqual(graphqlOperation("POST", "/graphql", JSON.stringify({ query: "query GetCart($id: ID!) { cart(id: $id) { total } }", variables: { id: 1 } })), { type: "query", name: "GetCart" });
  assert.deepEqual(graphqlOperation("POST", "/graphql", JSON.stringify({ query: "mutation { pay }", operationName: "Pay" })), { type: "mutation", name: "Pay" });
  assert.deepEqual(graphqlOperation("POST", "/graphql", JSON.stringify({ query: "{ me { id } }" })), { type: "query", name: null });
  assert.deepEqual(graphqlOperation("POST", "/graphql", JSON.stringify([{ query: "query A { a }" }, { query: "query B { b }" }])), { type: "query", name: "A", batch: 2 });
  assert.deepEqual(graphqlOperation("POST", "/graphql", JSON.stringify({ operationName: "Cached", extensions: { persistedQuery: { sha256Hash: "abc" } } })), { type: "query", name: "Cached" });
  assert.deepEqual(graphqlOperation("GET", "https://app.test/graphql?query=query%20Me%20%7B%20me%20%7D", undefined), { type: "query", name: "Me" });
  assert.equal(graphqlOperation("POST", "/api/pay", JSON.stringify({ amount: 5 })), null, "plain JSON isn't GraphQL");
  assert.equal(graphqlOperation("POST", "/graphql", JSON.stringify({ query: "query x", operationName: "not valid!" })).name, "x", "an invalid operation name falls back to the query's");
});

test("GraphQL errors are found in 200 responses, with codes and scrubbed messages", () => {
  const errors = graphqlErrors(JSON.stringify({
    data: null,
    errors: [
      { message: "User ada@example.com is not allowed", extensions: { code: "FORBIDDEN" } },
      { message: "Card 4242 4242 4242 4242 declined", extensions: { code: "PAYMENT_DECLINED" } },
      { message: "again", extensions: { code: "FORBIDDEN" } },
      { message: "odd code", extensions: { code: "not a <code>" } },
    ],
  }));
  assert.equal(errors.count, 4);
  assert.deepEqual(errors.codes, ["FORBIDDEN", "PAYMENT_DECLINED"]);
  assert.deepEqual(errors.messages, ["User [email] is not allowed", "Card [card] declined", "again"]);
  assert.equal(graphqlErrors(JSON.stringify({ data: { ok: true } })), null);
  assert.equal(graphqlErrors("not json"), null);
});

test("bodies keep their shape but lose credentials, emails, and card numbers", () => {
  assert.equal(
    cleanBody(JSON.stringify({ email: "ada@example.com", password: "hunter2", card: { number: "4242424242424242", cvc: "123" }, items: [{ sku: "A1", qty: 2 }], note: "Bearer abcdefghijklmnop" }), "application/json"),
    JSON.stringify({ email: "[email]", password: "[redacted]", card: { number: "[card]", cvc: "[redacted]" }, items: [{ sku: "A1", qty: 2 }], note: "Bearer [redacted]" }),
  );
  assert.equal(cleanBody("email=ada%40example.com&password=hunter2&plan=team", "application/x-www-form-urlencoded"), "email=%5Bemail%5D&password=%5Bredacted%5D&plan=team");
  assert.equal(cleanBody("Order 1729000000000 for ada@example.com", "text/plain"), "Order 1729000000000 for [email]", "long numbers that aren't card numbers stay");
  assert.match(cleanBody("x".repeat(20_000), "text/plain"), /… \[4000 more characters not kept\]$/);
  assert.equal(cleanBody("<binary>", "image/png"), "[image/png: 8 characters, not kept]");
  assert.equal(cleanBody(null), null);
  assert.equal(scrubCardNumbers("4111-1111-1111-1111 and 1234567890123"), "[card] and 1234567890123");
});

test("only allowlisted headers are kept, and never from sign-in or token endpoints", () => {
  assert.deepEqual(pickHeaders({ "Content-Type": "application/json", Authorization: "Bearer x", Cookie: "a=b" }, "request"), { "content-type": "application/json" });
  assert.deepEqual(pickHeaders("content-type: application/json\r\nset-cookie: s=1\r\nx-request-id: req_42\r\n", "response"), { "content-type": "application/json", "x-request-id": "req_42" });
  for (const url of ["/api/login", "/auth/callback", "/oauth2/token", "/api/v1/users/password", "/session", "/api/sign-in"]) {
    assert.equal(isCredentialEndpoint(url, "https://app.test/"), true, url);
  }
  for (const url of ["/api/checkout/pay", "/graphql", "/api/authors", "/api/assessment"]) {
    assert.equal(isCredentialEndpoint(url, "https://app.test/"), false, url);
  }
});

test("a host's sanitizer runs last and fails closed", () => {
  const entry = { method: "POST", url: "https://app.test/api/x", status: 200, request: { headers: {}, body: "{\"a\":1}" }, response: { headers: { "content-type": "application/json" }, body: "{\"b\":2}" } };
  assert.equal(applySanitizer(null, entry), entry);
  assert.deepEqual(applySanitizer((value) => ({ ...value, response: { ...value.response, body: null } }), entry).response, { headers: { "content-type": "application/json" }, body: null });
  assert.equal(applySanitizer(() => null, entry), null);
  assert.equal(applySanitizer(() => { throw new Error("oops"); }, entry), null);
  assert.equal(applySanitizer(() => "nope", entry), null);
  assert.deepEqual(resolveNetworkOptions({ bodies: "yes" }), { bodies: false, sanitize: null }, "bodies only with exactly true");
});

test("the body budget stops a chatty page from filling memory", () => {
  let now = 0;
  const budget = createBodyBudget({ limit: 100, windowMs: 1000, now: () => now });
  assert.equal(budget.take(60), true);
  assert.equal(budget.take(60), false);
  now = 1500;
  assert.equal(budget.take(60), true, "the allowance comes back");
});

test("timing phases come from resource timing, or only the total when the server hides them", () => {
  const timing = timingPhases({ initiatorType: "fetch", startTime: 100, fetchStart: 100, domainLookupStart: 110, domainLookupEnd: 130, connectStart: 130, secureConnectionStart: 150, connectEnd: 190, requestStart: 191, responseStart: 400, responseEnd: 460, duration: 360, transferSize: 900, nextHopProtocol: "h2" }, 1_000_000);
  assert.deepEqual(timing, { startedAt: 1_000_100, durationMs: 360, phases: { queuedMs: 10, dnsMs: 20, connectMs: 20, tlsMs: 40, waitMs: 209, downloadMs: 60 }, transferBytes: 900, protocol: "h2" });
  assert.equal(timingPhases({ initiatorType: "fetch", startTime: 5, duration: 80 }, 0).phases, null);
  assert.equal(timingPhases({ initiatorType: "img", startTime: 5, duration: 80 }, 0), null);
});

function fakePage(fetchImpl) {
  return {
    console: { error() {}, warn() {}, log() {}, info() {}, debug() {} },
    addEventListener() {},
    removeEventListener() {},
    performance: { now: () => 0 },
    location: { href: "https://app.test/checkout" },
    fetch: fetchImpl,
  };
}

const jsonResponse = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

test("fetch: a GraphQL error with HTTP 200 is a failure; bodies stay out unless the host keeps them", async () => {
  const page = fakePage(async () => jsonResponse(200, { data: null, errors: [{ message: "Not allowed for ada@example.com", extensions: { code: "FORBIDDEN" } }] }, { "x-request-id": "req_1" }));
  const network = [];
  let keep = false;
  const restore = instrumentPage({ windowRef: page, onConsole() {}, onNetwork: (entry) => network.push(entry), network: () => ({ bodies: keep }) });
  const body = JSON.stringify({ query: "mutation ApplyPromo($code: String!) { applyPromo(code: $code) { ok } }", variables: { code: "SPRING", email: "ada@example.com" } });
  const response = await page.fetch("https://app.test/graphql", { method: "POST", body, headers: { "content-type": "application/json", authorization: "Bearer abcdefghijklmnopq" } });
  assert.equal((await response.json()).errors[0].extensions.code, "FORBIDDEN", "the page still reads its own response");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(network[0].outcome, "graphql_error");
  assert.deepEqual(network[0].graphql, { type: "mutation", name: "ApplyPromo", errors: { count: 1, codes: ["FORBIDDEN"] } });
  assert.equal(network[0].request, undefined, "no bodies by default");
  assert.equal(network[0].response, undefined);

  keep = true;
  await page.fetch("https://app.test/graphql", { method: "POST", body, headers: { "content-type": "application/json", authorization: "Bearer abcdefghijklmnopq" } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const kept = network[1];
  assert.deepEqual(kept.request.headers, { "content-type": "application/json" }, "no authorization header");
  assert.equal(JSON.parse(kept.request.body).variables.email, "[email]");
  assert.match(kept.response.body, /Not allowed for \[email\]/);
  assert.equal(kept.response.headers["x-request-id"], "req_1");
  assert.deepEqual(kept.graphql.errors.messages, ["Not allowed for [email]"]);

  await page.fetch("https://app.test/api/login", { method: "POST", body: "{\"email\":\"a@b.co\",\"password\":\"x\"}" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(network[2].bodies, "credential endpoint");
  assert.equal(network[2].request, undefined);
  restore();
});

test("the timeline shows a request's GraphQL operation, kept bodies, and the browser's timing for it", () => {
  const kit = { EVENT_TYPE, INCREMENTAL_SOURCE, MOUSE_INTERACTION, REPLAY_CONSOLE_EVENT, REPLAY_NETWORK_EVENT, REPLAY_TIMING_EVENT };
  const events = [
    { type: EVENT_TYPE.Meta, timestamp: 1000, data: { href: "https://app.test/", width: 1, height: 1 } },
    { type: EVENT_TYPE.Custom, timestamp: 1500, data: { tag: REPLAY_NETWORK_EVENT, payload: { method: "POST", url: "https://app.test/graphql", status: 200, durationMs: 300, startedAt: 1100, outcome: "graphql_error", graphql: { type: "mutation", name: "ApplyPromo", errors: { count: 1, codes: ["FORBIDDEN"] } }, request: { headers: {}, body: "{}" } } } },
    { type: EVENT_TYPE.Custom, timestamp: 1600, data: { tag: REPLAY_TIMING_EVENT, payload: { url: "https://app.test/graphql", startedAt: 1102, durationMs: 310, phases: { waitMs: 250, downloadMs: 20 }, transferBytes: 512, protocol: "h2" } } },
    { type: EVENT_TYPE.Custom, timestamp: 1700, data: { tag: REPLAY_TIMING_EVENT, payload: { url: "https://app.test/other", startedAt: 1102, durationMs: 5 } } },
  ];
  const [request] = buildReplayTimeline(events, kit).network;
  assert.equal(request.offsetMs, 100, "placed where it started");
  assert.equal(graphqlLabel(request), "mutation ApplyPromo");
  assert.deepEqual(request.timing, { phases: { waitMs: 250, downloadMs: 20 }, durationMs: 310, transferBytes: 512, protocol: "h2" });
  assert.equal(request.request.body, "{}");
  const summary = summarizeReplay(events);
  assert.equal(summary.network.failed, 1, "a GraphQL error counts as a failed request");
  assert.deepEqual(summary.network.entries[0], { offsetMs: 100, method: "POST", url: "https://app.test/graphql", status: 200, durationMs: 300, outcome: "graphql_error", operation: "mutation ApplyPromo", errorCodes: ["FORBIDDEN"] });
});

test("page resources are typed by extension, then initiator, and only fetch-like entries are matched to requests", () => {
  assert.equal(resourceKind("script", "https://app.test/assets/app.js"), "js");
  assert.equal(resourceKind("css", "https://fonts.test/geist.woff2"), "font", "a font loaded by a stylesheet is a font");
  assert.equal(resourceKind("link", "https://app.test/theme"), "css");
  assert.equal(resourceKind("img", "https://cdn.test/a"), "img");
  assert.equal(resourceKind("video", "https://cdn.test/clip"), "media");
  assert.equal(resourceKind("iframe", "https://embed.test/"), "doc");
  assert.equal(resourceKind("other", "https://app.test/thing"), "other");
  assert.equal(resourceTiming({ initiatorType: "fetch", startTime: 1, duration: 2 }, 0), null, "fetch is recorded by the patched API");
  assert.deepEqual(resourceTiming({ initiatorType: "img", name: "https://cdn.test/a.png", startTime: 5, duration: 80, responseStatus: 404 }, 1000),
    { resource: "img", startedAt: 1005, durationMs: 80, phases: null, transferBytes: null, protocol: null, status: 404 });
});

test("WebSockets: connections, messages both ways, and close codes, with text only when bodies are kept", () => {
  const sockets = [];
  class FakeSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = url;
      this.protocols = protocols;
      this.readyState = 0;
      this.protocol = "";
      sockets.push(this);
    }
    send(data) { this.lastSent = data; }
    static OPEN = 1;
  }
  const page = { ...fakePage(async () => jsonResponse(200, {})), WebSocket: FakeSocket };
  const events = [];
  let keep = false;
  const restore = instrumentPage({ windowRef: page, onConsole() {}, onNetwork() {}, onSocket: (entry) => events.push(entry), network: () => ({ bodies: keep }) });
  const socket = new page.WebSocket("wss://live.app.test/orders?session=abc", ["v1"]);
  assert.ok(socket instanceof FakeSocket, "the page gets a real socket");
  assert.ok(socket instanceof page.WebSocket, "instanceof the patched constructor still works");
  assert.equal(page.WebSocket.OPEN, 1, "static constants are inherited");
  assert.deepEqual(socket.protocols, ["v1"]);
  socket.send("too early");
  socket.readyState = 1;
  socket.dispatchEvent(new Event("open"));
  socket.send(JSON.stringify({ subscribe: "cart", token: "secret-value-123456" }));
  assert.equal(socket.lastSent, JSON.stringify({ subscribe: "cart", token: "secret-value-123456" }), "the page's own send still runs");
  keep = true;
  socket.send(JSON.stringify({ subscribe: "cart", token: "secret-value-123456", email: "ada@example.com" }));
  const received = new Event("message");
  received.data = new ArrayBuffer(12);
  socket.dispatchEvent(received);
  const closed = new Event("close");
  closed.code = 1006;
  closed.wasClean = false;
  socket.dispatchEvent(closed);
  restore();
  assert.equal(page.WebSocket, FakeSocket, "restore puts the constructor back");
  assert.equal(FakeSocket.prototype.send.name, "send");

  assert.deepEqual(events.map((entry) => entry.event), ["connecting", "open", "message", "message", "message", "close"], "a send before open isn't a message");
  assert.equal(events[0].url, "wss://live.app.test/orders?session=…", "query values are dropped");
  assert.equal(events[2].direction, "sent");
  assert.equal(events[2].data, undefined, "no text unless bodies are kept");
  assert.equal(JSON.parse(events[3].data).token, "[redacted]");
  assert.equal(JSON.parse(events[3].data).email, "[email]");
  assert.deepEqual({ direction: events[4].direction, size: events[4].size }, { direction: "received", size: 12 });
  assert.match(events[4].data, /^\[binary: 12 bytes/, "binary frames are only measured");
  assert.deepEqual(events[5], { socket: "ws1", event: "close", code: 1006, clean: false });

  const kit = { EVENT_TYPE, INCREMENTAL_SOURCE, MOUSE_INTERACTION, REPLAY_CONSOLE_EVENT, REPLAY_NETWORK_EVENT, REPLAY_TIMING_EVENT, REPLAY_SOCKET_EVENT };
  const timeline = buildReplayTimeline([
    { type: EVENT_TYPE.Meta, timestamp: 1000, data: { href: "https://app.test/", width: 1, height: 1 } },
    ...events.map((payload, index) => ({ type: EVENT_TYPE.Custom, timestamp: 1100 + index * 100, data: { tag: REPLAY_SOCKET_EVENT, payload } })),
    { type: EVENT_TYPE.Custom, timestamp: 1200, data: { tag: REPLAY_TIMING_EVENT, payload: { url: "https://cdn.test/a.png", resource: "img", startedAt: 1150, durationMs: 40, status: 404 } } },
  ], kit);
  const [row, image] = timeline.network;
  assert.equal(row.type, "websocket");
  assert.equal(requestTypeGroup(row), "websocket");
  assert.deepEqual({ status: row.status, outcome: row.outcome, closeCode: row.closeCode, sent: row.sent, received: row.received, durationMs: row.durationMs }, { status: 101, outcome: "socket_closed", closeCode: 1006, sent: 2, received: 1, durationMs: 500 });
  assert.equal(row.messages.length, 3);
  assert.ok(isFailedRequest(row), "an unexpected close is flagged");
  assert.deepEqual({ type: image.type, status: image.status, outcome: image.outcome, offsetMs: image.offsetMs }, { type: "img", status: 404, outcome: "client_error", offsetMs: 150 });
  assert.equal(requestTypeGroup({ method: "GET" }), "fetch", "requests from before types count as Fetch/XHR");
  assert.equal(isFailedRequest({ outcome: "open" }), false, "a socket still open isn't a failure");
});
