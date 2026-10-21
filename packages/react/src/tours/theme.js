// Tour theming. Every value becomes a CSS custom property on the player's host element, so a
// team can also set them from its own stylesheet (they inherit into the player's shadow root).

export const THEME_PROPERTIES = {
  accent: "--tm-tour-accent",
  accentText: "--tm-tour-accent-text",
  surface: "--tm-tour-surface",
  text: "--tm-tour-text",
  muted: "--tm-tour-muted",
  border: "--tm-tour-border",
  radius: "--tm-tour-radius",
  font: "--tm-tour-font",
};

export const DEFAULT_THEME = Object.freeze({
  accent: "#1a1e1b",
  accentText: "#ffffff",
  surface: "#ffffff",
  text: "#1a1e1b",
  muted: "#5f625b",
  border: "#deddd7",
});

export function themeToCssVariables(theme = {}) {
  const variables = {};
  for (const [key, property] of Object.entries(THEME_PROPERTIES)) {
    const value = theme[key];
    if (typeof value === "string" && value.trim() && !/[;{}<>]/.test(value)) variables[property] = value.trim();
    else if (key === "radius" && Number.isFinite(value)) variables[property] = `${value}px`;
  }
  return variables;
}

function parseHex(value) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || "").trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance([red, green, blue]) {
  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function contrastRatio(foreground, background) {
  const a = parseHex(foreground);
  const b = parseHex(background);
  if (!a || !b) return null;
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

function toHex(rgb) {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

/** Darkens (or lightens) `color` in small steps until it reaches 4.5:1 against `against`. */
function nearestPassing(color, against) {
  const rgb = parseHex(color);
  const towards = luminance(parseHex(against)) > 0.5 ? 0 : 255;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = toHex(rgb.map((value) => value + (towards - value) * (step / 20)));
    if (contrastRatio(candidate, against) >= 4.5) return candidate;
  }
  return null;
}

/**
 * Checks the text pairs a tour card draws, using the defaults for anything unset.
 * Returns one entry per pair below 4.5:1, with a nearby colour that passes. Non-hex values can't be checked and are skipped.
 */
export function checkTourTheme(theme = {}) {
  const resolved = { ...DEFAULT_THEME, ...theme };
  const pairs = [
    ["accentText", "accent", "button text on the accent colour"],
    ["text", "surface", "card text"],
    ["muted", "surface", "secondary card text"],
  ];
  return pairs.flatMap(([foreground, background, label]) => {
    const ratio = contrastRatio(resolved[foreground], resolved[background]);
    if (ratio === null || ratio >= 4.5) return [];
    const adjust = foreground === "accentText" ? "accent" : foreground;
    const fixed = adjust === "accent" ? nearestPassing(resolved.accent, resolved.accentText) : nearestPassing(resolved[foreground], resolved[background]);
    return [{ pair: [foreground, background], label, ratio, suggestion: fixed ? { [adjust]: fixed } : null }];
  });
}
