// How a reviewer likes the bar (Feedback experience board 09): where it sits (one of six places),
// whether it is shrunk to a dot, and the pages it is hidden on for this visit.
export const BAR_POSITIONS = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
const KEY = "threadmark:bar";
const HIDDEN_KEY = "threadmark:bar:hidden";

export function readBarPrefs() {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return {
      position: BAR_POSITIONS.includes(value.position) ? value.position : "bottom-center",
      shrunk: value.shrunk === true,
    };
  } catch {
    return { position: "bottom-center", shrunk: false };
  }
}

export function writeBarPrefs(prefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ position: prefs.position, shrunk: prefs.shrunk }));
  } catch {
    // Without storage the bar simply goes back to the bottom centre next time.
  }
}

export function readHiddenPages() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(HIDDEN_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function writeHiddenPages(pages) {
  try {
    window.sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(pages.slice(-50)));
  } catch {
    // Hidden only until reload without session storage.
  }
}

/** The nearest of the six places to a point, e.g. where a dragged bar was dropped. */
export function nearestBarPosition(x, y, width, height) {
  const column = x < width / 3 ? "left" : x > (width * 2) / 3 ? "right" : "center";
  return `${y < height / 2 ? "top" : "bottom"}-${column}`;
}

/** A rough brightness of the page behind the overlay, 0 (black) to 1 (white). Exported for tests. */
export function pageBrightness(documentRef = document) {
  const read = (element) => {
    if (!element) return null;
    const match = /rgba?\(([^)]+)\)/.exec(getComputedStyle(element).backgroundColor || "");
    if (!match) return null;
    const [r, g, b, a = 1] = match[1].split(",").map((part) => Number.parseFloat(part));
    if (!(a > 0.5)) return null;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  return read(documentRef.body) ?? read(documentRef.documentElement) ?? 1;
}
