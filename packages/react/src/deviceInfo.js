// What the reviewer's browser says about itself when a comment is posted: browser, operating system, device,
// screen, language, time zone, display preferences, and the browser's own network estimate. It reads only
// what any page can read. Nothing is fetched or measured, and nothing is sent anywhere by this module.

const CLIENT_HINTS = ["architecture", "bitness", "fullVersionList", "model", "platformVersion"];
const hintRequests = new WeakMap();

/**
 * Chromium's high-entropy client hints (full browser version, real OS version, CPU architecture, phone
 * model). The user-agent string freezes those, so they are asked for once per window when Threadmark
 * mounts. Resolves to null in browsers without client hints.
 */
export function loadClientHints(windowRef = globalThis.window) {
  const userAgentData = windowRef?.navigator?.userAgentData;
  if (!windowRef || typeof userAgentData?.getHighEntropyValues !== "function") return Promise.resolve(null);
  if (!hintRequests.has(windowRef)) {
    hintRequests.set(windowRef, Promise.resolve()
      .then(() => userAgentData.getHighEntropyValues(CLIENT_HINTS))
      .then((values) => (values && typeof values === "object" ? values : null), () => null));
  }
  return hintRequests.get(windowRef);
}

const BRANDS = [
  [/^Microsoft Edge$/i, "Edge"],
  [/^Opera( GX)?$/i, "Opera"],
  [/^Brave$/i, "Brave"],
  [/^Samsung Internet$/i, "Samsung Internet"],
  [/^Vivaldi$/i, "Vivaldi"],
  [/^Arc$/i, "Arc"],
  [/^Google Chrome$/i, "Chrome"],
];

/** The browser from client-hint brands: the most specific real brand, else Chromium. */
function browserFromBrands(brands) {
  const real = (Array.isArray(brands) ? brands : [])
    .filter((item) => item && typeof item.brand === "string" && !/not.?a.?brand|^chromium$/i.test(item.brand.replace(/[^A-Za-z ]/g, "")));
  for (const [pattern, name] of BRANDS) {
    const match = real.find((item) => pattern.test(item.brand));
    if (match) return { name, version: String(match.version || "") };
  }
  const chromium = (Array.isArray(brands) ? brands : []).find((item) => /^chromium$/i.test(item?.brand || ""));
  if (real[0]) return { name: real[0].brand, version: String(real[0].version || "") };
  return chromium ? { name: "Chromium", version: String(chromium.version || "") } : null;
}

const UA_BROWSERS = [
  [/\bEdg(?:e|A|iOS)?\/([\d.]+)/, "Edge"],
  [/\bOPR\/([\d.]+)/, "Opera"],
  [/\bSamsungBrowser\/([\d.]+)/, "Samsung Internet"],
  [/\bVivaldi\/([\d.]+)/, "Vivaldi"],
  [/\bFxiOS\/([\d.]+)/, "Firefox"],
  [/\bFirefox\/([\d.]+)/, "Firefox"],
  [/\bCriOS\/([\d.]+)/, "Chrome"],
  [/\bChrome\/([\d.]+)/, "Chrome"],
  [/\bVersion\/([\d.]+).*\bSafari\//, "Safari"],
];

function browserFromUserAgent(userAgent) {
  for (const [pattern, name] of UA_BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) return { name, version: match[1] };
  }
  return { name: "Unknown", version: "" };
}

/** Windows 10 and 11 share "Windows NT 10.0"; only the client hint's platform version tells them apart. */
function windowsVersion(platformVersion) {
  const major = Number(String(platformVersion || "").split(".")[0]);
  if (!Number.isFinite(major)) return "";
  if (major >= 13) return "11";
  if (major >= 1) return "10";
  const minor = Number(String(platformVersion).split(".")[1]);
  return minor >= 3 ? "8.1" : minor === 2 ? "8" : "7";
}

function osFromUserAgent(userAgent, touchPoints) {
  let match = /\b(?:iPhone|iPod).*?\bOS (\d+(?:_\d+)*)/.exec(userAgent);
  if (match) return { name: "iOS", version: match[1].replace(/_/g, ".") };
  match = /\biPad.*?\bOS (\d+(?:_\d+)*)/.exec(userAgent);
  if (match) return { name: "iPadOS", version: match[1].replace(/_/g, ".") };
  match = /\bAndroid (\d+(?:\.\d+)*)/.exec(userAgent);
  if (match) return { name: "Android", version: match[1] };
  if (/\bCrOS\b/.test(userAgent)) return { name: "ChromeOS", version: "" };
  match = /\bWindows NT (\d+\.\d+)/.exec(userAgent);
  if (match) {
    const version = { "10.0": "10 or 11", "6.3": "8.1", "6.2": "8", "6.1": "7" }[match[1]] || match[1];
    return { name: "Windows", version };
  }
  match = /\bMac OS X (\d+(?:[_.]\d+)*)/.exec(userAgent);
  if (match) {
    // iPads ask for desktop sites as a Mac; only touch support gives them away.
    if (touchPoints > 1) return { name: "iPadOS", version: "" };
    const version = match[1].replace(/_/g, ".");
    // Browsers freeze macOS at 10.15.7, so that number says nothing about the real version.
    return { name: "macOS", version: version === "10.15.7" ? "" : version };
  }
  if (/\bLinux\b/.test(userAgent)) return { name: "Linux", version: "" };
  return { name: "Unknown", version: "" };
}

function osFromHints(platform, hints, fallback) {
  const version = String(hints?.platformVersion || "");
  if (/^Windows$/i.test(platform)) return { name: "Windows", version: windowsVersion(version) || fallback.version };
  if (/^macOS$/i.test(platform)) return { name: "macOS", version: version || fallback.version };
  if (/^Android$/i.test(platform)) return { name: "Android", version: version || fallback.version };
  if (/^Chrome ?OS$/i.test(platform)) return { name: "ChromeOS", version: version || fallback.version };
  if (/^Linux$/i.test(platform)) return { name: "Linux", version: fallback.version };
  return fallback;
}

function deviceType(userAgent, mobileHint, os) {
  if (os.name === "iPadOS" || /\biPad\b/.test(userAgent)) return "tablet";
  if (os.name === "Android" && !/\bMobile\b/.test(userAgent) && mobileHint !== true) return "tablet";
  if (mobileHint === true || /\b(?:iPhone|iPod|Mobile)\b/.test(userAgent)) return "mobile";
  return "desktop";
}

function mediaMatches(windowRef, query) {
  try {
    return Boolean(windowRef.matchMedia?.(query)?.matches);
  } catch {
    return false;
  }
}

const round = (value, places = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** places;
  return Math.round(number * factor) / factor;
};

/**
 * The browser's network estimate when the comment was posted (Chromium only; Chromium caps the speed at
 * 10 Mbps and rounds both numbers). It is a snapshot, not a speed test.
 */
function networkEstimate(navigatorRef) {
  const connection = navigatorRef?.connection;
  if (!connection || typeof connection !== "object") return null;
  const effectiveType = ["slow-2g", "2g", "3g", "4g"].includes(connection.effectiveType) ? connection.effectiveType : null;
  if (!effectiveType && !Number.isFinite(Number(connection.downlink))) return null;
  return {
    effectiveType,
    downlinkMbps: Number.isFinite(Number(connection.downlink)) ? round(connection.downlink, 2) : null,
    rttMs: Number.isFinite(Number(connection.rtt)) ? round(connection.rtt) : null,
    saveData: Boolean(connection.saveData),
  };
}

/**
 * The reviewer's browser, OS, device, screen, and settings, synchronously. Pass the result of
 * `loadClientHints` when it has resolved, for exact versions in Chromium browsers.
 */
export function readDeviceInfo(windowRef = globalThis.window, hints = null) {
  if (!windowRef?.navigator) return null;
  const navigatorRef = windowRef.navigator;
  const userAgent = String(navigatorRef.userAgent || "");
  const touchPoints = Number(navigatorRef.maxTouchPoints) || 0;
  const userAgentData = navigatorRef.userAgentData;
  const fallbackOs = osFromUserAgent(userAgent, touchPoints);
  const os = userAgentData?.platform ? osFromHints(userAgentData.platform, hints, fallbackOs) : fallbackOs;
  const browser = browserFromBrands(hints?.fullVersionList)
    || browserFromBrands(userAgentData?.brands)
    || browserFromUserAgent(userAgent);
  const architecture = hints?.architecture
    ? `${hints.architecture}${hints.bitness === "64" && hints.architecture === "x86" ? "-64" : ""}`
    : "";
  let timeZone = "";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    timeZone = "";
  }
  const network = networkEstimate(navigatorRef);
  return {
    browser,
    os: { ...os, ...(architecture ? { architecture } : {}) },
    type: deviceType(userAgent, userAgentData?.mobile, os),
    ...(hints?.model ? { model: String(hints.model) } : {}),
    touch: touchPoints > 0,
    screen: { width: round(windowRef.screen?.width), height: round(windowRef.screen?.height) },
    viewport: { width: round(windowRef.innerWidth), height: round(windowRef.innerHeight) },
    devicePixelRatio: round(windowRef.devicePixelRatio || 1, 2),
    language: String(navigatorRef.language || ""),
    timeZone,
    colorScheme: mediaMatches(windowRef, "(prefers-color-scheme: dark)") ? "dark" : "light",
    reducedMotion: mediaMatches(windowRef, "(prefers-reduced-motion: reduce)"),
    forcedColors: mediaMatches(windowRef, "(forced-colors: active)"),
    ...(network ? { network } : {}),
  };
}
