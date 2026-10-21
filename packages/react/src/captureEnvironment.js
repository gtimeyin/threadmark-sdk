const text = (value, max = 80) => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value, max) => Number.isFinite(value) && value >= 0 ? Math.min(value, max) : undefined;

export function normalizeCaptureEnvironment(value) {
  if (!value || typeof value !== "object") return undefined;
  const result = {};
  for (const key of ["browser", "os", "device"]) {
    const allowed = key === "browser" ? /^(Chrome|Edge|Firefox|Safari|Opera)( \d+(?:\.\d+)*)?$|^Unknown$/ : key === "os" ? /^(Windows|macOS|iOS|Android|Linux|Unknown)$/ : /^(mobile|tablet|desktop)$/;
    if (allowed.test(text(value[key]))) result[key] = text(value[key]);
  }
  if (value.viewport && typeof value.viewport === "object") {
    const viewport = {};
    for (const key of ["width", "height", "devicePixelRatio"]) {
      const val = number(value.viewport[key], key === "devicePixelRatio" ? 10 : 100000);
      if (val !== undefined) viewport[key] = val;
    }
    if (Object.keys(viewport).length) result.viewport = viewport;
  }
  if (value.connection && typeof value.connection === "object") {
    const connection = {};
    if (typeof value.connection.online === "boolean") connection.online = value.connection.online;
    if (["slow-2g", "2g", "3g", "4g"].includes(value.connection.effectiveType)) connection.effectiveType = value.connection.effectiveType;
    for (const key of ["downlinkMbps", "rttMs"]) {
      const val = number(value.connection[key], key === "rttMs" ? 60000 : 10000);
      if (val !== undefined) connection[key] = val;
    }
    if (Object.keys(connection).length) result.connection = connection;
  }
  return Object.keys(result).length ? result : undefined;
}

export function captureEnvironment(scope = globalThis) {
  const nav = scope.navigator;
  if (!nav) return undefined;
  const ua = nav.userAgent || "";
  const match = /(?:Edg|EdgiOS|EdgA)\/([\d.]+)/.exec(ua) || /(?:OPR)\/([\d.]+)/.exec(ua) || /(?:Firefox|FxiOS)\/([\d.]+)/.exec(ua) || /(?:Chrome|CriOS)\/([\d.]+)/.exec(ua) || /Version\/([\d.]+).*Safari/.exec(ua);
  const browser = /Edg/.test(match?.[0] || "") ? "Edge" : /OPR/.test(match?.[0] || "") ? "Opera" : /Firefox|FxiOS/.test(match?.[0] || "") ? "Firefox" : /Chrome|CriOS/.test(match?.[0] || "") ? "Chrome" : match ? "Safari" : "Unknown";
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const os = /iPhone|iPod/.test(ua) || ipad ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Macintosh|Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown";
  const connection = nav.connection;
  return normalizeCaptureEnvironment({
    browser: match ? `${browser} ${match[1]}` : browser, os,
    device: ipad || /Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobile|iPhone|iPod/.test(ua) ? "mobile" : "desktop",
    viewport: { width: scope.innerWidth, height: scope.innerHeight, devicePixelRatio: scope.devicePixelRatio },
    connection: { online: nav.onLine, effectiveType: connection?.effectiveType, downlinkMbps: connection?.downlink, rttMs: connection?.rtt },
  });
}
