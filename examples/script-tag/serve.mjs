// A plain static server, so the page loads Threadmark the way any site would.
// Serves index.html, plus the locally built script-tag bundle at /threadmark.js and /chunks/*.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const page = fileURLToPath(new URL("./index.html", import.meta.url));
const embed = fileURLToPath(new URL("../../packages/react/dist/embed/", import.meta.url));
const port = Number(process.env.PORT) || 4180;
const types = { ".js": "text/javascript", ".map": "application/json", ".html": "text/html" };

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://localhost").pathname));
  const file = path === "/" || path === "/index.html" ? page : embed + path.replace(/^\/+/, "");
  if (!file.startsWith(embed) && file !== page) return response.writeHead(403).end();
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end(path === "/threadmark.js" ? "Build the SDK first: npm run build:sdk" : "Not found");
  }
}).listen(port, () => console.log(`Script tag example: http://localhost:${port}/`));
