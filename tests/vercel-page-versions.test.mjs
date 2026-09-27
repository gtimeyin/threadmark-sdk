import assert from "node:assert/strict";
import test from "node:test";
import {
  VercelPageVersionsError,
  createVercelDeploymentsUrl,
  createVercelPageVersionsHandler,
  listVercelPageVersions,
  mapVercelDeployment,
  mergeKnownPageVersions,
  sanitizePageRoute,
} from "../integrations/vercel/pageVersions.js";

const deployment = {
  uid: "dpl_current123",
  name: "threadmark",
  url: "threadmark-abc-team.vercel.app",
  created: 1788172800000,
  readyState: "READY",
  target: null,
  meta: {
    githubCommitMessage: "Add deployment history\n\nLong body",
    githubCommitRef: "feature/page-versions",
    githubCommitSha: "abcdef1234567890",
    ignoredProviderField: "do-not-forward",
  },
  secretProviderField: "do-not-forward",
};

test("builds a bounded, team-scoped Vercel deployments URL", () => {
  const url = createVercelDeploymentsUrl({
    projectId: "prj_project123",
    teamId: "team_team123",
    limit: 500,
  });
  assert.equal(url.origin + url.pathname, "https://api.vercel.com/v6/deployments");
  assert.equal(url.searchParams.get("projectId"), "prj_project123");
  assert.equal(url.searchParams.get("teamId"), "team_team123");
  assert.equal(url.searchParams.get("limit"), "100");
});

test("maps only the deployment fields Threadmark renders", () => {
  const version = mapVercelDeployment(deployment, {
    currentDeploymentId: deployment.uid,
    feedbackCounts: new Map([[deployment.uid, 4]]),
  });
  assert.deepEqual(version, {
    id: "dpl_current123",
    buildId: "dpl_current123",
    url: "https://threadmark-abc-team.vercel.app/",
    label: "Add deployment history",
    branch: "feature/page-versions",
    commitSha: "abcdef1234567890",
    createdAt: "2026-08-31T10:40:00.000Z",
    environment: "preview",
    state: "ready",
    feedbackCount: 4,
    current: true,
  });
  assert.equal("meta" in version, false);
  assert.equal("secretProviderField" in version, false);
});

test("retains host-known deployments that Vercel no longer lists as unavailable", () => {
  const live = [mapVercelDeployment(deployment)];
  const versions = mergeKnownPageVersions(live, [
    {
      id: "dpl_expired123",
      url: "https://expired-example.vercel.app/private?ignored=yes",
      label: "Earlier review",
      branch: "feature/earlier",
      commitSha: "9999999999999999",
      createdAt: "2026-08-01T12:00:00.000Z",
    },
  ], {
    feedbackCounts: { dpl_expired123: 6 },
  });

  assert.equal(versions.length, 2);
  assert.deepEqual(versions[1], {
    id: "dpl_expired123",
    buildId: "dpl_expired123",
    url: "https://expired-example.vercel.app/",
    label: "Earlier review",
    branch: "feature/earlier",
    commitSha: "9999999999999999",
    createdAt: "2026-08-01T12:00:00.000Z",
    environment: "preview",
    state: "unavailable",
    feedbackCount: 6,
    current: false,
  });
});

test("lists deployments with bearer authentication and redacts upstream failures", async () => {
  let received;
  const versions = await listVercelPageVersions({
    token: "server-secret-token",
    projectId: "prj_project123",
    teamId: "team_team123",
    currentDeploymentId: deployment.uid,
    feedbackCounts: { [deployment.uid]: 2 },
    fetchImpl: async (url, init) => {
      received = { url: url.toString(), init };
      return Response.json({ deployments: [deployment] });
    },
  });

  assert.equal(received.init.headers.authorization, "Bearer server-secret-token");
  assert.match(received.url, /projectId=prj_project123/);
  assert.equal(versions[0].feedbackCount, 2);
  assert.equal(JSON.stringify(versions).includes("server-secret-token"), false);

  await assert.rejects(
    listVercelPageVersions({
      token: "server-secret-token",
      projectId: "prj_project123",
      fetchImpl: async () => Response.json({ error: { message: "provider secret detail" } }, { status: 403 }),
    }),
    (error) => (
      error instanceof VercelPageVersionsError
      && error.code === "vercel_api_failed"
      && !error.message.includes("provider secret detail")
    ),
  );
});

test("the request handler requires membership and ignores client-selected project IDs", async () => {
  let requestedUrl = "";
  const handler = createVercelPageVersionsHandler({
    authorize: async (request) => (
      request.headers.get("authorization") === "Session member"
        ? { memberId: "member_1", vercelProjectId: "prj_authorized", vercelTeamId: "team_authorized" }
        : null
    ),
    getFeedbackCounts: async ({ projectId, route }) => ({
      [deployment.uid]: projectId === "prj_authorized" && route === "/customers/:customerId" ? 7 : 0,
    }),
    fetchImpl: async (url) => {
      requestedUrl = url.toString();
      return Response.json({ deployments: [deployment] });
    },
  });

  const unauthorized = await handler(new Request("https://max.example/api/threadmark/page-versions"), {});
  assert.equal(unauthorized.status, 401);

  const response = await handler(new Request(
    "https://max.example/api/threadmark/page-versions?route=%2Fcustomers%2F%3AcustomerId%3Ftoken%3Dignored&projectId=prj_attacker",
    { headers: { authorization: "Session member" } },
  ), {
    VERCEL_TOKEN: "server-secret-token",
    VERCEL_PROJECT_ID: "prj_wrong_default",
    VERCEL_DEPLOYMENT_ID: deployment.uid,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(body.route, "/customers/:customerId");
  assert.equal(body.pageVersions[0].feedbackCount, 7);
  assert.match(requestedUrl, /projectId=prj_authorized/);
  assert.doesNotMatch(requestedUrl, /prj_attacker/);
  assert.equal(JSON.stringify(body).includes("server-secret-token"), false);
});

test("the handler fails closed without a management API token", async () => {
  const handler = createVercelPageVersionsHandler({
    authorize: async () => ({ vercelProjectId: "prj_authorized" }),
  });
  const response = await handler(new Request("https://max.example/api/threadmark/page-versions"), {
    VERCEL_OIDC_TOKEN: "not-a-management-token",
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "missing_vercel_token",
      message: "A server-only Vercel access token is required.",
    },
  });
});

test("canonical routes discard query strings, fragments, and invalid input", () => {
  assert.equal(sanitizePageRoute("/settings/profile?token=secret#section"), "/settings/profile");
  assert.equal(sanitizePageRoute("https://example.test/orders/42?private=yes"), "/orders/42");
  assert.equal(sanitizePageRoute("not a route"), "/not%20a%20route");
});
