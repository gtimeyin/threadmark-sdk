import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { build } from "vite";

// Session replay's page instrumentation in a real browser: WebSocket connections (through Playwright's
// WebSocket routing) and the page's own resources from resource timing, as the dashboard's Network tab reads them.
const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let bundle;

test.beforeAll(async () => {
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL("../../src/sessionReplay.js", import.meta.url)), formats: ["iife"], name: "ThreadmarkReplay" },
      rollupOptions: { external: ["rrweb"], output: { inlineDynamicImports: true, globals: { rrweb: "rrweb" } } },
    },
  });
  const output = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  bundle = output.find((item) => item.type === "chunk")?.code;
});

test("WebSocket connections and page resources are recorded without changing how the page works", async ({ page }) => {
  await page.routeWebSocket("ws://localhost/live?session=abc123", (socket) => {
    socket.onMessage((message) => {
      if (String(message).includes("subscribe")) socket.send(JSON.stringify({ type: "cart", total: 53.9, email: "ada@example.com" }));
      if (String(message).includes("bye")) socket.close({ code: 4001, reason: "server closed" });
    });
  });
  await page.route("http://localhost/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/replay.js") return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: bundle });
    if (path === "/app.css") return route.fulfill({ contentType: "text/css", body: "body { color: #1a1e1b; }" });
    if (path === "/missing.png") return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><html><head><script src=\"/replay.js\"></script></head><body><h1>Checkout</h1></body></html>" });
  });
  await page.goto("http://localhost/checkout");

  const result = await page.evaluate(async () => {
    const sockets = [];
    const timings = [];
    let keep = false;
    const restore = window.ThreadmarkReplay.instrumentPage({
      windowRef: window,
      onConsole() {},
      onNetwork() {},
      onTiming: (entry) => timings.push(entry),
      onSocket: (entry) => sockets.push(entry),
      network: () => ({ bodies: keep }),
    });
    const NativeName = WebSocket.name;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/app.css";
    document.head.append(link);
    const image = new Image();
    image.src = "/missing.png";
    await new Promise((resolve) => { image.onerror = resolve; image.onload = resolve; });

    const socket = new WebSocket("ws://localhost/live?session=abc123");
    const checks = { instance: socket instanceof WebSocket, open: WebSocket.OPEN === 1, name: NativeName };
    await new Promise((resolve) => socket.addEventListener("open", resolve));
    keep = true;
    const reply = new Promise((resolve) => socket.addEventListener("message", (event) => resolve(event.data)));
    socket.send(JSON.stringify({ type: "subscribe", token: "secret-value-123456" }));
    checks.received = await reply;
    const closed = new Promise((resolve) => socket.addEventListener("close", (event) => resolve(event.code)));
    socket.send("bye");
    checks.closeCode = await closed;
    await new Promise((resolve) => setTimeout(resolve, 300));
    restore();
    checks.restored = WebSocket.prototype.send.name === "send";
    return { sockets, timings, checks };
  });

  // The page's own socket behaves as before.
  expect(result.checks).toMatchObject({ instance: true, open: true, closeCode: 4001, restored: true });
  expect(JSON.parse(result.checks.received)).toEqual({ type: "cart", total: 53.9, email: "ada@example.com" });

  const events = result.sockets.map((entry) => entry.event);
  expect(events).toEqual(["connecting", "open", "message", "message", "message", "close"]);
  expect(result.sockets[0].url).toBe("ws://localhost/live?session=…");
  const [sent, received, bye] = result.sockets.filter((entry) => entry.event === "message");
  expect(sent.direction).toBe("sent");
  expect(JSON.parse(sent.data)).toEqual({ type: "subscribe", token: "[redacted]" });
  expect(received.direction).toBe("received");
  expect(JSON.parse(received.data)).toEqual({ type: "cart", total: 53.9, email: "[email]" });
  expect(bye).toMatchObject({ direction: "sent", size: 3 });
  expect(result.sockets.at(-1)).toMatchObject({ event: "close", code: 4001 });

  // Resource timing names the page's stylesheet and the missing image (with its status in Chromium).
  const css = result.timings.find((entry) => entry.url === "http://localhost/app.css");
  const png = result.timings.find((entry) => entry.url === "http://localhost/missing.png");
  expect(css).toMatchObject({ resource: "css" });
  expect(png).toMatchObject({ resource: "img", status: 404 });
  expect(css.durationMs).toBeGreaterThanOrEqual(0);
});
