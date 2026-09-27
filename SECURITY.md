# Security policy

Threadmark runs inside reviewed applications and can capture interface context, screenshots, and structured interaction traces. Privacy and origin controls are therefore part of the security boundary, not optional presentation features.

## Supported versions

Threadmark is currently in beta. Security fixes are applied to the latest published beta only.

| Version | Supported |
| --- | --- |
| Latest published `beta` release | Yes |
| Earlier betas | No |

Consumers should test and upgrade to the newest beta promptly. A stable long-term support policy will be defined before a stable release.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue, discussion, pull request, annotation, or screenshot.

Use [GitHub private vulnerability reporting](https://github.com/gtimeyin/threadmark-sdk/security/advisories/new) to send the maintainers:

- the affected version and browser;
- the environment and minimal configuration needed to reproduce it;
- clear reproduction steps or a minimal repository;
- the expected and observed security or privacy boundary;
- the potential impact;
- any suggested mitigation;
- whether the report contains sensitive evidence that needs special handling.

If the private report form is unavailable, open a minimal public issue asking the repository owner for a private contact channel. Do not include reproduction details, affected routes, screenshots, credentials, or exploit information in that issue.

We aim to acknowledge complete reports within five business days. After validation, maintainers will coordinate a fix, tests, release timing, and disclosure with the reporter. Please allow a reasonable remediation period before publishing details.

## High-priority areas

Reports are especially valuable when they involve:

- exposure of input values, printable keystrokes, authentication data, URL queries or fragments;
- pixels outside a selected crop or pixels that should have been masked;
- screenshot evidence crossing a callback before explicit attachment and annotation submission;
- ignored or sensitive elements entering target metadata or evidence;
- activation on a disallowed hostname or production environment;
- cross-project annotation restoration or deep-link access;
- unsafe HTML, selector, route, or feedback handling;
- dependency or build behavior that alters the published package's trust boundary.

## Responsibility boundaries

`threadmark-react` provides the in-page annotation interface, privacy-aware capture, structured feedback model, and integration callbacks. It does not provide authentication, reviewer authorization, database isolation, file storage, notification delivery, or Jira/Linear credentials.

Host applications must authenticate callback requests, authorize every read and write, isolate projects and workspaces, protect persisted evidence, validate deployment hostnames, and apply appropriate retention controls. A weakness solely in a consumer's backend or configuration may fall outside this repository, but reports that reveal an unsafe SDK default are in scope.

Vercel deployment discovery must run on the host server with a scoped, expiring `VERCEL_TOKEN` or `VERCEL_ACCESS_TOKEN`. Never pass that credential, a protection-bypass secret, or an unfiltered provider response through Threadmark props or browser code. The browser may request a canonical route, but the authenticated server membership must choose the Vercel team and project. `VERCEL_OIDC_TOKEN` is not a Vercel management API credential.

Never include real customer data, credentials, or unredacted sensitive screenshots in a test case. Use synthetic data and the smallest reproduction that demonstrates the issue.
