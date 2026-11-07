// Script-tag build. React is bundled in, so any page can load it:
//
//   <script type="module" src="https://cdn.jsdelivr.net/npm/threadmark-react@beta/dist/embed/threadmark.js"
//     data-project-key="my-site"></script>
//
// With `data-project-key` it mounts itself from the script's data attributes. Without it, nothing
// mounts until you call `mount()` (imported from this file, or `window.Threadmark.mount`).
import { mount, unmount } from "./embed.js";

export { mount, unmount };
export { threadmarkTarget, THREADMARK_TARGET_ATTRIBUTE } from "./core.js";

function list(value) {
  if (value == null) return undefined;
  const items = value.split(",").map(item => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function flag(value) {
  if (value == null) return undefined;
  return value === "" || value === "true";
}

/** Reads mount options from a `<script>` element's data attributes. Exported for tests. */
export function optionsFromScript(script) {
  const data = script.dataset;
  if (!data.projectKey) return null;
  const options = {
    projectKey: data.projectKey,
    enabled: flag(data.enabled),
    environment: data.environment || undefined,
    allowedHosts: list(data.allowedHosts),
    ignoredSelectors: list(data.ignoredSelectors),
    buildId: data.buildId || undefined,
    route: data.route || undefined,
    styleNonce: script.nonce || data.styleNonce || undefined,
  };
  for (const key of Object.keys(options)) if (options[key] === undefined) delete options[key];
  return options;
}

function findOwnScript() {
  // The bundler may move this code into a shared chunk under chunks/, behind a thin threadmark.js entry,
  // so accept the entry's URL as well as this module's own.
  const own = new Set([import.meta.url, new URL("../threadmark.js", import.meta.url).href]);
  for (const script of document.querySelectorAll("script[src]")) {
    try {
      if (own.has(new URL(script.getAttribute("src"), document.baseURI).href)) return script;
    } catch {
      // Ignore scripts with unparseable sources.
    }
  }
  return null;
}

if (typeof window !== "undefined") {
  window.Threadmark = Object.freeze({ mount, unmount });
  const script = findOwnScript();
  const options = script && optionsFromScript(script);
  if (options) mount(options);
}
