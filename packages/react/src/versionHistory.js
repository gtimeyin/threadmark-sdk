import { sanitizeRoute } from "./core.js";

const VERSION_STATES = new Set(["ready", "building", "failed", "unavailable"]);
const SAFE_VERSION_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_PAGE_VERSIONS = 50;

function cleanText(value, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function buildPageVersionUrl(versionUrl, route, currentUrl = "https://threadmark.invalid/") {
  try {
    const url = new URL(cleanText(versionUrl, 2048));
    if (!SAFE_VERSION_PROTOCOLS.has(url.protocol)) return null;
    url.pathname = sanitizeRoute(route || new URL(currentUrl).pathname || "/");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizePageVersions(
  pageVersions,
  { currentBuildId = "", route = "/", currentUrl = "https://threadmark.invalid/" } = {},
) {
  if (!Array.isArray(pageVersions)) return [];

  return pageVersions
    .slice(0, MAX_PAGE_VERSIONS)
    .map((version, index) => {
      const id = cleanText(version?.id || version?.buildId || `version-${index}`, 240);
      const buildId = cleanText(version?.buildId, 240);
      const url = buildPageVersionUrl(version?.url, route, currentUrl);
      if (!id || !url) return null;
      const requestedState = cleanText(version?.state, 24).toLowerCase();
      const state = VERSION_STATES.has(requestedState) ? requestedState : "ready";
      const current = version?.current === true || Boolean(buildId && buildId === currentBuildId);
      return {
        id,
        buildId: buildId || undefined,
        url,
        label: cleanText(version?.label, 120) || (current ? "Current deployment" : `Deployment ${index + 1}`),
        branch: cleanText(version?.branch, 240) || undefined,
        commitSha: cleanText(version?.commitSha, 64) || undefined,
        createdAt: cleanText(version?.createdAt, 64) || undefined,
        environment: cleanText(version?.environment, 40) || undefined,
        state,
        feedbackCount: normalizeCount(version?.feedbackCount),
        current,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.current !== right.current) return left.current ? -1 : 1;
      const leftTime = Date.parse(left.createdAt || "") || 0;
      const rightTime = Date.parse(right.createdAt || "") || 0;
      return rightTime - leftTime;
    });
}
