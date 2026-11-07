// Framework-agnostic entry: mounts the React overlay without the host app using React.
// `threadmark-react/embed` keeps React as a peer (for wrappers such as Vue or Svelte); the standalone
// script-tag build (`dist/embed/threadmark.js`) bundles React in.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Threadmark } from "./Threadmark.jsx";

let active = null;

function whenBodyReady(callback) {
  if (document.body) {
    callback();
    return () => {};
  }
  const onReady = () => callback();
  document.addEventListener("DOMContentLoaded", onReady, { once: true });
  return () => document.removeEventListener("DOMContentLoaded", onReady);
}

/**
 * Mounts Threadmark on the page. Takes the same options as the `<Threadmark>` component's props.
 * Only one instance runs per page: calling `mount()` again while one is mounted updates its options
 * and returns the same instance.
 */
export function mount(options) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Threadmark.mount() needs a browser page.");
  }
  if (!options || typeof options.projectKey !== "string" || !options.projectKey) {
    throw new TypeError("Threadmark.mount() needs a projectKey.");
  }

  if (active) {
    active.update(options);
    return active;
  }

  let props = { ...options };
  let container = null;
  let root = null;
  let unmounted = false;

  const render = () => {
    if (root) root.render(createElement(Threadmark, props));
  };

  const cancelWait = whenBodyReady(() => {
    if (unmounted) return;
    // React needs its root in the document so events from the overlay's portal reach it.
    // The overlay itself draws into its own shadow root; this container stays empty and hidden.
    container = document.createElement("div");
    container.setAttribute("data-threadmark-embed", "");
    container.hidden = true;
    document.body.append(container);
    root = createRoot(container);
    render();
  });

  const instance = {
    /** Replaces the given options; options you leave out keep their current values. */
    update(next) {
      if (unmounted) return;
      props = { ...props, ...next };
      render();
    },
    /** Removes the overlay and frees the page for another `mount()`. */
    unmount() {
      if (unmounted) return;
      unmounted = true;
      cancelWait();
      root?.unmount();
      container?.remove();
      root = null;
      container = null;
      if (active === instance) active = null;
    },
  };

  active = instance;
  return instance;
}

/** Removes the mounted overlay, if any. */
export function unmount() {
  active?.unmount();
}
