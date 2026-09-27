const VERCEL_DEPLOYMENTS_ENDPOINT = "https://api.vercel.com/v6/deployments";
const SAFE_PROTOCOLS = new Set(["https:"]);
const BUILDING_STATES = new Set(["BUILDING", "INITIALIZING", "QUEUED"]);
const FAILED_STATES = new Set(["CANCELED", "ERROR"]);

function cleanText(value, maxLength = 240) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanIdentifier(value) {
  const identifier = cleanText(value, 240);
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(identifier) ? identifier : "";
}

function clampLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.floor(number))) : 20;
}

function normalizeDeploymentUrl(value) {
  const raw = cleanText(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!SAFE_PROTOCOLS.has(url.protocol) || !url.hostname) return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function mapDeploymentState(value) {
  const state = cleanText(value, 40).toUpperCase();
  if (state === "READY") return "ready";
  if (BUILDING_STATES.has(state)) return "building";
  if (FAILED_STATES.has(state)) return "failed";
  return "unavailable";
}

function normalizeFeedbackCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function countForDeployment(feedbackCounts, deploymentId, commitSha) {
  if (feedbackCounts instanceof Map) {
    return normalizeFeedbackCount(feedbackCounts.get(deploymentId) ?? feedbackCounts.get(commitSha));
  }
  if (feedbackCounts && typeof feedbackCounts === "object") {
    return normalizeFeedbackCount(feedbackCounts[deploymentId] ?? feedbackCounts[commitSha]);
  }
  return 0;
}

function deploymentLabel(deployment, commitSha) {
  const commitMessage = cleanText(
    typeof deployment?.meta?.githubCommitMessage === "string"
      ? deployment.meta.githubCommitMessage.split(/\r?\n/, 1)[0]
      : "",
    120,
  );
  if (commitMessage) return commitMessage;
  const projectName = cleanText(deployment?.name, 80);
  if (projectName && commitSha) return `${projectName} · ${commitSha.slice(0, 7)}`;
  return projectName || (commitSha ? `Commit ${commitSha.slice(0, 7)}` : "Vercel deployment");
}

export class VercelPageVersionsError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "VercelPageVersionsError";
    this.code = code;
    this.status = status;
  }
}

export function sanitizePageRoute(value) {
  try {
    return new URL(cleanText(value, 2048) || "/", "https://threadmark.invalid").pathname || "/";
  } catch {
    return "/";
  }
}

export function createVercelDeploymentsUrl({ projectId, teamId, limit = 20 }) {
  const safeProjectId = cleanIdentifier(projectId);
  const safeTeamId = cleanIdentifier(teamId);
  if (!safeProjectId) {
    throw new VercelPageVersionsError(
      "missing_vercel_project",
      "A valid Vercel project ID is required.",
      503,
    );
  }
  const url = new URL(VERCEL_DEPLOYMENTS_ENDPOINT);
  url.searchParams.set("projectId", safeProjectId);
  url.searchParams.set("limit", String(clampLimit(limit)));
  if (safeTeamId) url.searchParams.set("teamId", safeTeamId);
  return url;
}

export function mapVercelDeployment(
  deployment,
  { currentDeploymentId = "", feedbackCounts } = {},
) {
  const id = cleanIdentifier(deployment?.uid || deployment?.id);
  const url = normalizeDeploymentUrl(deployment?.url);
  if (!id || !url) return null;

  const commitSha = cleanIdentifier(
    deployment?.meta?.githubCommitSha
      || deployment?.meta?.gitlabCommitSha
      || deployment?.meta?.bitbucketCommitSha,
  );
  const branch = cleanText(
    deployment?.meta?.githubCommitRef
      || deployment?.meta?.gitlabCommitRef
      || deployment?.meta?.bitbucketCommitRef,
    240,
  );
  const created = Number(deployment?.createdAt ?? deployment?.created);
  const createdAt = Number.isFinite(created) && created > 0
    ? new Date(created).toISOString()
    : undefined;

  return {
    id,
    buildId: id,
    url,
    label: deploymentLabel(deployment, commitSha),
    ...(branch ? { branch } : {}),
    ...(commitSha ? { commitSha } : {}),
    ...(createdAt ? { createdAt } : {}),
    environment: deployment?.target === "production" ? "production" : "preview",
    state: mapDeploymentState(deployment?.readyState || deployment?.state),
    feedbackCount: countForDeployment(feedbackCounts, id, commitSha),
    current: id === cleanIdentifier(currentDeploymentId),
  };
}

export function mergeKnownPageVersions(
  liveVersions,
  knownDeployments,
  { currentDeploymentId = "", feedbackCounts, limit = 20 } = {},
) {
  const live = Array.isArray(liveVersions) ? liveVersions : [];
  const known = Array.isArray(knownDeployments) ? knownDeployments : [];
  const seen = new Set(live.map((version) => version.id));
  const missing = known.flatMap((record) => {
    const id = cleanIdentifier(record?.id || record?.buildId);
    const url = normalizeDeploymentUrl(record?.url);
    if (!id || !url || seen.has(id)) return [];
    seen.add(id);
    const commitSha = cleanIdentifier(record?.commitSha);
    const createdAtValue = Date.parse(cleanText(record?.createdAt, 64));
    const isCurrent = id === cleanIdentifier(currentDeploymentId);
    return [{
      id,
      buildId: id,
      url,
      label: cleanText(record?.label, 120) || (commitSha ? `Commit ${commitSha.slice(0, 7)}` : "Previous deployment"),
      ...(cleanText(record?.branch, 240) ? { branch: cleanText(record.branch, 240) } : {}),
      ...(commitSha ? { commitSha } : {}),
      ...(Number.isFinite(createdAtValue) ? { createdAt: new Date(createdAtValue).toISOString() } : {}),
      environment: record?.environment === "production" ? "production" : "preview",
      state: isCurrent ? "ready" : "unavailable",
      feedbackCount: countForDeployment(feedbackCounts, id, commitSha),
      current: isCurrent,
    }];
  });

  return [...live, ...missing]
    .sort((left, right) => {
      if (left.current !== right.current) return left.current ? -1 : 1;
      return (Date.parse(right.createdAt || "") || 0) - (Date.parse(left.createdAt || "") || 0);
    })
    .slice(0, clampLimit(limit));
}

export async function listVercelPageVersions({
  token,
  projectId,
  teamId,
  currentDeploymentId,
  feedbackCounts,
  knownDeployments,
  limit = 20,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  const accessToken = cleanText(token, 2048);
  if (!accessToken) {
    throw new VercelPageVersionsError(
      "missing_vercel_token",
      "A server-only Vercel access token is required.",
      503,
    );
  }
  if (typeof fetchImpl !== "function") {
    throw new VercelPageVersionsError("missing_fetch", "A Fetch API implementation is required.");
  }

  const url = createVercelDeploymentsUrl({ projectId, teamId, limit });
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
  } catch {
    throw new VercelPageVersionsError(
      "vercel_unavailable",
      "Vercel deployment history is temporarily unavailable.",
      502,
    );
  }

  if (!response?.ok) {
    const status = response?.status === 429 ? 429 : 502;
    throw new VercelPageVersionsError(
      response?.status === 429 ? "vercel_rate_limited" : "vercel_api_failed",
      response?.status === 429
        ? "Vercel deployment history is rate limited."
        : "Vercel deployment history could not be loaded.",
      status,
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new VercelPageVersionsError(
      "invalid_vercel_response",
      "Vercel returned an invalid deployment response.",
      502,
    );
  }

  if (!Array.isArray(body?.deployments)) {
    throw new VercelPageVersionsError(
      "invalid_vercel_response",
      "Vercel returned an invalid deployment response.",
      502,
    );
  }

  const liveVersions = body.deployments
    .map((deployment) => mapVercelDeployment(deployment, {
      currentDeploymentId,
      feedbackCounts,
    }))
    .filter(Boolean);
  return mergeKnownPageVersions(liveVersions, knownDeployments, {
    currentDeploymentId,
    feedbackCounts,
    limit,
  });
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      ...headers,
    },
  });
}

export function createVercelPageVersionsHandler({
  authorize,
  getFeedbackCounts = async () => new Map(),
  getKnownDeployments = async () => [],
  limit = 20,
  fetchImpl,
} = {}) {
  if (typeof authorize !== "function") {
    throw new TypeError("createVercelPageVersionsHandler requires an authorize(request, env) function.");
  }

  return async function handleVercelPageVersions(request, env = {}) {
    if (request.method !== "GET") {
      return jsonResponse({ error: { code: "method_not_allowed", message: "Use GET." } }, 405, {
        allow: "GET",
      });
    }

    let membership;
    try {
      membership = await authorize(request, env);
    } catch {
      return jsonResponse({ error: { code: "authorization_failed", message: "Authorization failed." } }, 500);
    }
    if (!membership) {
      return jsonResponse({ error: { code: "unauthorized", message: "Authentication is required." } }, 401);
    }

    const requestUrl = new URL(request.url);
    const route = sanitizePageRoute(requestUrl.searchParams.get("route"));
    const projectId = membership.vercelProjectId || env.VERCEL_PROJECT_ID;
    const teamId = membership.vercelTeamId || env.VERCEL_TEAM_ID || env.VERCEL_ORG_ID;
    const token = env.VERCEL_TOKEN || env.VERCEL_ACCESS_TOKEN;
    const currentDeploymentId = membership.currentDeploymentId || env.VERCEL_DEPLOYMENT_ID;

    try {
      const [feedbackCounts, knownDeployments] = await Promise.all([
        getFeedbackCounts({ membership, projectId, route, env }),
        getKnownDeployments({ membership, projectId, route, env }),
      ]);
      const pageVersions = await listVercelPageVersions({
        token,
        projectId,
        teamId,
        currentDeploymentId,
        feedbackCounts,
        knownDeployments,
        limit,
        fetchImpl,
      });
      return jsonResponse({ route, pageVersions });
    } catch (error) {
      const safeError = error instanceof VercelPageVersionsError
        ? error
        : new VercelPageVersionsError(
          "page_versions_failed",
          "Page version history could not be loaded.",
          500,
        );
      return jsonResponse({ error: { code: safeError.code, message: safeError.message } }, safeError.status);
    }
  };
}
