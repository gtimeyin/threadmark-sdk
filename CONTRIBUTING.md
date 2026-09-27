# Contributing to Threadmark

Thanks for helping improve Threadmark. The project is in open-source beta, so focused bug fixes, accessibility improvements, tests, documentation corrections, and small review-workflow enhancements are especially useful.

## Before you start

- Use [GitHub Issues](https://github.com/gtimeyin/threadmark-sdk/issues) for bugs and feature proposals.
- Keep Jira, Linear, authentication, permissions, notifications, and persistent backends outside `threadmark-react`. Those belong to host applications or future connector services.
- Report security or privacy vulnerabilities through the private process in [SECURITY.md](./SECURITY.md), not a public issue.

For a substantial feature or public API change, open an issue first so the intended SDK boundary and migration path can be agreed before implementation.

## Development setup

Threadmark uses Node.js 22 in CI.

```bash
git clone https://github.com/gtimeyin/threadmark-sdk.git
cd threadmark-sdk
npm ci
npx playwright install chromium
npm run verify
```

Useful commands:

```bash
npm run dev                # Run the product prototype and /about page
npm run build:sdk          # Build threadmark-react
npm run test:sdk           # Run package, unit, and browser tests
npm run build:example      # Build the consumer integration example
npm run test:sites         # Verify the static hosting worker
```

## Repository structure

- `packages/react` — the published `threadmark-react` package.
- `examples/basic-react` — a consumer-owned persistence example.
- `src` — the product prototype and public explainer.
- `tests` — repository-level hosting tests.
- `integrations/vercel` — optional server-side deployment discovery example.

The marketing website and Cloud service are maintained in separate repositories. Internal product planning is maintained with Cloud; it is not needed to contribute to the SDK.

## Making a change

1. Create a focused branch from the current default branch.
2. Keep the change scoped to one concern.
3. Add or update tests for observable behavior.
4. Update TypeScript declarations and package documentation when the public contract changes.
5. Run `npm run verify` before opening a pull request.
6. Use a concise, imperative commit message such as `Fix screenshot crop alignment`.

Pull requests should explain the problem, the chosen behavior, privacy or compatibility implications, and how the change was verified. Include screenshots or a short recording for visible interface changes.

## SDK requirements

Changes to `threadmark-react` must preserve these guarantees:

- React and React DOM remain peer dependencies.
- Importing and server-rendering the package is safe.
- Production activation fails closed unless explicitly supported.
- Input values, printable keystrokes, URL query strings, fragments, and configured sensitive regions do not enter captured feedback.
- Automatically masked comment snapshots cross the callback boundary only when the reviewer submits the annotation. Pencil markup additionally requires **Use screenshot** before submission.
- Missing or ambiguous targets remain visible as repair states rather than attaching to a guessed element.
- The package remains backend-, authentication-, and issue-tracker-agnostic.

Add browser coverage when changing selection, keyboard behavior, anchoring, screenshot capture, interaction recording, threads, deletion, or restoration.

## Releases

Only maintainers publish `threadmark-react`. Release pull requests must update [CHANGELOG.md](./CHANGELOG.md), bump the package version, pass `npm run verify`, and validate the npm tarball before publication under the intended distribution tag.

See [SDK beta releases](.github/RELEASING.md) for tokenless GitHub Actions publishing, provenance requirements, and release safety checks. The SDK package version remains independent of the reference app and hosted Cloud releases.

By contributing, you agree that your contribution is licensed under the project's [MIT license](./LICENSE).
