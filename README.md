# Threadmark

Threadmark is a React SDK for reviewing a working interface where it lives. Select elements or text, annotate screenshots, record short interaction traces, and keep feedback attached to the page.

The `threadmark-react` package is MIT licensed. It works without a Threadmark Cloud account. Authentication, persistence, evidence uploads, and collaboration are provided by your application or an explicitly connected service.

## Install

```sh
npm install -D threadmark-react@beta
```

```jsx
import { Threadmark } from 'threadmark-react';

export function App() {
  return <>
    <YourApplication />
    <Threadmark />
  </>;
}
```

Local review is enabled by default. Preview and staging activation require explicit configuration and a hostname allowlist; production activation is disabled in this beta. See the [SDK documentation](packages/react/README.md) for configuration, privacy controls, callbacks, and controlled annotation hydration.

## Repository layout

| Directory | Purpose |
| --- | --- |
| `packages/react/` | Published React SDK and its tests |
| `examples/basic-react/` | Consumer integration with local persistence |
| `integrations/vercel/` | Optional server-side deployment discovery example |
| `src/`, `public/` | Reference product prototype and `/about` explainer |
| `tests/`, `worker/`, `scripts/` | Reference app hosting and verification |

The production marketing website and public documentation are maintained separately in `threadmark-site`. Threadmark Cloud is a separate hosted product with independent releases. Neither is required to build or use this repository. The reference prototype uses demo data; it is not a hosted collaboration service.

Public source history begins with beta.8. Earlier package releases remain available on npm; private prototype history is not imported into this repository.

## Contribute

Use Node.js 22, matching CI:

```sh
npm ci
npx playwright install chromium
npm run verify
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) for development commands and SDK boundaries. Report bugs through [GitHub Issues](https://github.com/gtimeyin/threadmark-sdk/issues); report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Bundled third-party assets and dependencies retain their respective licenses; see the package's [third-party notices](packages/react/THIRD_PARTY_NOTICES.md).
