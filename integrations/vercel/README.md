# Threadmark Vercel host adapter

This server-only reference adapter lists immutable Vercel deployments and converts them into the safe `pageVersions` records consumed by `threadmark-react`.

It belongs in MAX or another authenticated host service—not in browser code. The adapter never accepts a Vercel project ID from the request. `authorize()` must resolve the signed-in member, workspace, review project, and provider project on the server.

## Required server configuration

- `VERCEL_TOKEN` or `VERCEL_ACCESS_TOKEN`: a scoped, expiring Vercel access token.
- `VERCEL_PROJECT_ID`: optional when `authorize()` returns `vercelProjectId`.
- `VERCEL_TEAM_ID` or `VERCEL_ORG_ID`: optional for personal projects; required for the corresponding team scope.
- `VERCEL_DEPLOYMENT_ID`: the current immutable deployment identifier.

`VERCEL_OIDC_TOKEN` does not authenticate Vercel management API requests and is intentionally ignored.

## Fetch handler

```js
import { createVercelPageVersionsHandler } from "./integrations/vercel/pageVersions.js";

export const handlePageVersions = createVercelPageVersionsHandler({
  authorize: async (request, env) => {
    const member = await requireReviewMember(request, env);
    const project = await loadReviewProject(member.workspaceId);
    return {
      memberId: member.id,
      vercelProjectId: project.vercelProjectId,
      vercelTeamId: project.vercelTeamId,
      currentDeploymentId: env.VERCEL_DEPLOYMENT_ID,
    };
  },
  getFeedbackCounts: ({ projectId, route }) =>
    feedbackStore.countByBuild({ projectId, route }),
  getKnownDeployments: ({ projectId }) =>
    reviewStore.listRecordedDeployments({ projectId }),
});
```

Mount the handler at an authenticated same-origin route such as `/api/threadmark/page-versions`. The client supplies only the canonical route:

```js
const response = await fetch(
  `/api/threadmark/page-versions?route=${encodeURIComponent(window.location.pathname)}`,
  { credentials: "include" },
);
const { pageVersions } = await response.json();
```

Pass the result to `<Threadmark pageVersions={pageVersions} />`. The handler sends `Cache-Control: private, no-store`, strips the provider response down to UI-safe fields, redacts upstream errors, and fails closed when authentication or server credentials are missing.

`getKnownDeployments` is how expired or deleted history remains visible. Records no longer returned by Vercel are merged as `unavailable`, retain their stored feedback count, and do not receive an Open action.
