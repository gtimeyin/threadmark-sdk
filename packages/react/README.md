# `threadmark-react`

An isolated, in-page review overlay for collecting structured feedback on live product UI. Threadmark lets a reviewer click an element, highlight native text, drag across eligible elements for grouped feedback, drag across empty space for region evidence, or select and mark up a privacy-filtered screenshot area before returning a normalized payload to the host application.

> **Beta candidate:** This package provides local capture plus controlled hydration and lifecycle callbacks. Storage, evidence upload, authentication, and service communication remain consumer-owned.

## Install

```bash
npm install -D threadmark-react@beta
```

Until the first registry release is complete, contributors can install the packed tarball or use the local workspace dependency shown below.

React and React DOM 18.2 or 19 are peer dependencies.

For local development in this repository, use a file dev dependency:

```json
{
  "devDependencies": {
    "threadmark-react": "file:../../packages/react"
  }
}
```

## Quick start

Mount one `Threadmark` instance near the root of the application:

```jsx
import { Threadmark, threadmarkTarget } from "threadmark-react";

export function App() {
  return (
    <>
      <main>
        <h1 {...threadmarkTarget("marketing-hero-title")}>
          Move work forward, faster.
        </h1>
      </main>

      <Threadmark
        projectKey="pk_public_project_identifier"
        reviewer={{ id: "user_42", displayName: "Emily R." }}
        environment="local"
        buildId="marketing-site-2026-08-12"
        onFeedbackCreate={(feedback, context) => {
          console.log("Threadmark feedback", feedback);
          console.log("In-memory evidence blobs", context.evidence);
        }}
      />
    </>
  );
}
```

On a local hostname, Threadmark renders a **Review page** launcher. Reviewers can also toggle Review mode with <kbd>Command/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>. Once active, one compact toolbar can be dragged by its grip to a convenient position.

## Gesture-first annotations

- Click an eligible element to open its anchored comment popover without activating the host control. Keyboard reviewers can focus an element and press Enter or Space.
- Highlight page text with the browser's native text selection to annotate the exact quote.
- Drag a marquee across eligible elements to collect them into one ordered group of up to 20 targets. If the marquee contains no eligible element, the same drag creates a viewport-clamped region and a privacy-filtered local snapshot preview.
- Hold <kbd>Command/Ctrl</kbd> + <kbd>Shift</kbd> while clicking to add or remove individual elements from an ordered group. Once at least two elements are selected, choose **Comment** in the toolbar.
- Choose the **Pencil** action and drag around the exact area. Releasing the drag opens that crop directly in the in-page markup tools—there is no separate capture confirmation. Automatic snapshot masking remains part of the capture pipeline, while crop adjustment and reviewer-facing Privacy controls are deferred. Choosing **Use screenshot** finishes the markup and approves that exact crop for attachment; the universal comment popover does not add a second approval checkbox.
- Choose **Record interaction**, use the page normally, then stop the recording. Threadmark captures a bounded, structured trace of clicks, safe input-change markers, command keys, scrolls, submissions, and same-document navigation. The trace can be played inside the standard comment popover and restored after reload; input values and printable keystrokes are never recorded.

Threadmark derives `captureKind` from the gesture or Pencil action instead of asking the reviewer to classify feedback. Every annotation starts with one required, top-level `comment` string. Reopened annotations present that comment as the start of a discussion and may include author-attributed `replies[]`.

## Toolbar and markers

The draggable toolbar keeps the active actions compact:

- **Pencil** starts screenshot-area selection; releasing a valid rectangle opens the in-page markup tools immediately;
- **Record interaction** starts a maximum 15-second structured interaction trace while leaving the host page usable;
- <kbd>P</kbd> pauses or resumes page animations and media;
- <kbd>H</kbd> hides or shows saved annotation markers;
- <kbd>C</kbd> copies the current annotations as structured Markdown;
- <kbd>X</kbd> arms a destructive clear; repeat the action within 3.5 seconds to remove the current draft and saved annotations; and
- <kbd>Escape</kbd> cancels the current popover or exits Review mode.

Letter shortcuts are disabled while typing in an input or editable field; <kbd>Escape</kbd> remains available. Added annotations stay as numbered markers. Click a marker to open its discussion, edit the original comment, reply to any previous message, or start the visible delete flow. Threadmark keeps records in memory by default; consumers can persist callback results and pass them back through `annotations` after reload. Reopened records resolve stable IDs first, validate saved DOM paths, and use conservative fingerprints only when there is one unambiguous match.

## Stable target IDs

Threadmark builds a locator from a stable Threadmark ID and a DOM path. Add stable IDs to high-value review targets so feedback remains understandable after ordinary layout changes:

```jsx
import { threadmarkTarget } from "threadmark-react";

<button {...threadmarkTarget("checkout-submit-button")}>
  Place order
</button>
```

The helper returns the corresponding data attribute:

```html
<button data-threadmark-id="checkout-submit-button">Place order</button>
```

Use durable, non-sensitive product vocabulary. IDs accept 1–120 letters, numbers, dots, underscores, colons, or hyphens. They should be unique on the rendered page and must not contain user IDs, account data, tokens, or copy that changes frequently. Threadmark intentionally does not capture arbitrary native DOM IDs.

## Universal comments

Threadmark asks one question for every annotation: **What should change?** The answer is submitted as the top-level `comment` value, whether the reviewer clicked an element, highlighted text, selected a group, dragged a region, marked up a selected screenshot area, or recorded an interaction trace. This keeps the capture step lightweight while still allowing a reviewer to describe the requested change directly.

Reopening an annotation displays the original comment and its replies as one compact, author-attributed thread. The composer below the thread adds a reply; **Reply** on a specific message targets that message. **Edit** on the original comment turns it into an inline editor with its own **Cancel** and **Save**, and saving keeps the discussion open. A reply records its own stable ID, parent message ID, comment, author, and timestamps. Reply changes are delivered through the same `onFeedbackCreate` upsert boundary, so existing storage adapters only need to persist the returned feedback record.

Deleting a reply removes only that reply. Deleting an annotation removes its original comment, every reply, and approved evidence. Both actions replace the normal popover action toolbar with an impact summary, **Cancel**, and a final destructive button; there is no hidden right-click deletion path.

Each selected element includes its tag, role, accessible name, normalized visible text, viewport bounds, route, capture time, and locator candidates. A native text highlight produces `captureKind: "text"` and records the exact normalized quote as `target.selectedText`. Grouped feedback includes an ordered `targets[]` collection and `target` identifies its primary member. Region feedback adds viewport, page, and normalized geometry. Pencil feedback produces `captureKind: "screenshot"`, describes the reviewer-selected crop, and references only approved raster evidence. Interaction feedback produces `captureKind: "interaction"`, ordered target references, and a versioned `interaction.events[]` trace.

## Reviewer identity

Threadmark does not authenticate users. Pass the authenticated user from your application through `reviewer`:

```jsx
<Threadmark
  projectKey="pk_public_project_identifier"
  reviewer={{
    id: session.user.id,
    displayName: session.user.name,
    avatarUrl: session.user.image,
  }}
/>
```

New feedback stores the reviewer as the immutable `author`; saved discussion messages display an avatar, full name, timestamp, and **You** indicator for the active reviewer. Edits preserve the original author and store the active reviewer in `lastEditedBy` with a new `updatedAt`. Replies store their own author and timestamps. The payload only accepts `id`, `displayName`, and an optional public or same-origin `avatarUrl`. Keep authorization server-side, resolve the stable ID against your own user directory, and never put access tokens, signed asset URLs, or sensitive profile data in this object.

## Receive feedback

`onFeedbackCreate` receives a local, normalized payload plus an evidence sidecar after the reviewer submits the anchored popover. Threadmark awaits a returned promise, shows success only after it resolves, and keeps the popover open if it fails:

```jsx
<Threadmark
  projectKey="pk_public_project_identifier"
  environment="preview"
  enabled
  allowedHosts={["preview.example.com"]}
  onFeedbackCreate={async (feedback, { evidence }) => {
    await saveFeedback(feedback, evidence);
  }}
/>
```

### Persist and restore annotations

Threadmark deliberately does not choose a database. Store the callback record in your application or hosted review service, then hydrate the authoritative records back into the overlay. Approved screenshot `Blob`s remain in `context.evidence`, so use Blob-capable storage rather than serializing them into JSON:

```jsx
const [annotations, setAnnotations] = useState([]);

<Threadmark
  projectKey="pk_public_project_identifier"
  annotations={annotations}
  onFeedbackCreate={async (feedback, context) => {
    await reviewStore.upsert(feedback, context);
    setAnnotations(await reviewStore.list());
  }}
  onFeedbackDelete={async (feedback) => {
    await reviewStore.remove(feedback.id);
    setAnnotations(await reviewStore.list());
  }}
  onFeedbackClear={async () => {
    await reviewStore.clear();
    setAnnotations([]);
  }}
/>
```

Each `annotations` entry has the shape `{ feedback, context }`. Hydration normalizes payloads and replies, verifies evidence metadata against each Blob, restores exact text ranges when the quote still has one match, and repairs every member of a multi-target annotation independently. Region and screenshot records retain their saved page geometry. Records are scoped to the active `projectKey` and canonical route. Create, edit, reply, reply-delete, annotation-delete, and clear mutations may return promises; a rejected mutation leaves the existing discussion visible.

Comments stay visible when a page is updated or opened on another deployment. If the exact target no longer matches but one likely element does (same tag and role with similar text, or the same DOM position), its marker appears there in a dashed **element changed** style; nothing is attached until a reviewer chooses **Confirm location**, which is saved as a repin with the previous location in `pinHistory`, or **Choose another**. If nothing matches, a faded ghost marker and outline show the element's last known page position (`target.pageBounds`, recorded for new comments) with its original build, and the thread offers **Repin comment**. Region and Pencil comments from another build use the same ghost treatment. If a target matches more than one live element, Threadmark refuses to guess. The toolbar exposes the affected annotation, the popover shows **Target needs repair**, and the original comment and approved evidence remain available. Partial groups report how many members restored without silently shrinking `targets[]`. **Recheck** reruns resolution after the host page changes.

Editing a saved annotation also offers **Copy link**. Deep links use the `threadmark` URL query parameter, for example `?threadmark=feedback-id`; after the consumer hydrates that route's records, Threadmark enters Review mode and opens the exact annotation automatically. Treat annotation IDs as non-secret identifiers and keep authorization in the hosted review service.

Example payload:

```json
{
  "id": "8f63f494-5a49-4d91-ae53-430294ef4113",
  "projectKey": "pk_public_project_identifier",
  "environment": "preview",
  "buildId": "marketing-site-2026-08-12",
  "route": "/pricing",
  "captureKind": "element",
  "target": {
    "tagName": "h1",
    "role": "heading",
    "accessibleName": "Move work forward, faster.",
    "visibleText": "Move work forward, faster.",
    "bounds": { "x": 64, "y": 210, "width": 520, "height": 130 },
    "locatorCandidates": {
      "stableId": "marketing-hero-title",
      "id": null,
      "domPath": "[data-threadmark-id=\"marketing-hero-title\"]"
    },
    "route": "/pricing",
    "capturedAt": "2026-08-12T10:24:00.000Z"
  },
  "targets": [{ "tagName": "h1", "role": "heading", "route": "/pricing" }],
  "evidence": [],
  "comment": "Make the headline explain how the product turns feedback into shipped improvements.",
  "createdAt": "2026-08-12T10:25:00.000Z",
  "updatedAt": "2026-08-12T10:25:00.000Z",
  "author": {
    "id": "user_42",
    "displayName": "Emily R.",
    "avatarUrl": null
  },
  "lastEditedBy": {
    "id": "user_42",
    "displayName": "Emily R.",
    "avatarUrl": null
  }
}
```

The repeated target entry above is abbreviated for readability; runtime `targets[0]` is the same normalized descriptor as `target`.

Native text feedback uses the same contract with its text-specific capture metadata:

```json
{
  "captureKind": "text",
  "target": {
    "kind": "text",
    "selectedText": "Move work forward, faster."
  },
  "comment": "Replace this phrase with a clearer product outcome."
}
```

Screenshot markup also uses the universal comment contract. The JSON contains serializable evidence metadata, while the actual marked-up image remains in the callback sidecar:

```json
{
  "captureKind": "screenshot",
  "evidence": [
    {
      "id": "evidence_viewport_1",
      "kind": "snapshot",
      "source": "dom-renderer",
      "quality": "captured",
      "mimeType": "image/webp",
      "byteSize": 48216,
      "pixelSize": { "width": 1440, "height": 900 },
      "redactionCount": 3,
      "warnings": []
    }
  ],
  "comment": "Keep this card aligned with the marked guide."
}
```

Snapshot Blob data is never placed in JSON. For a submitted region or screenshot annotation, `feedback.evidence` contains whitelisted metadata while `onFeedbackCreate(feedback, context)` receives the matching `{ id, blob }` in `context.evidence`. The editor's marks are baked into that approved Blob. For Pencil markup, choosing **Use screenshot** is the attachment approval; cancelling the editor exposes no screenshot Blob to the callback. Existing one-argument callbacks continue to work. Consumer callbacks are isolated: an exception thrown by a callback does not crash the overlay.

Interaction traces are JSON-only and use the same `onFeedbackCreate` persistence boundary:

```json
{
  "captureKind": "interaction",
  "interaction": {
    "version": 1,
    "startedAt": "2026-08-28T08:00:00.000Z",
    "durationMs": 3200,
    "events": [
      { "type": "click", "offsetMs": 120, "targetIndex": 0, "button": 0, "x": 428, "y": 212 },
      { "type": "input", "offsetMs": 640, "targetIndex": 1, "inputType": "search" },
      { "type": "keydown", "offsetMs": 1180, "targetIndex": 1, "key": "Enter", "modifiers": [] },
      { "type": "navigation", "offsetMs": 3200, "route": "/results" }
    ]
  },
  "comment": "Keep focus in search while results update."
}
```

The recorder is intentionally not a screen or video recorder. It never requests display-capture permission, stores input values, or stores printable keystrokes. Consumers should still treat target names and routes as review-session data and enforce authorization in their persistence layer.

## Sensitive and ignored elements

Threadmark does not allow these controls to become selection targets:

- `input`, `textarea`, `select`, and `option`;
- `[contenteditable="true"]`; and
- any element inside `[data-threadmark-sensitive]`.

Mark an entire sensitive region when its visible copy or descendants should not be captured:

```jsx
<section data-threadmark-sensitive>
  <AccountDetails />
</section>
```

Exclude product UI that should never receive feedback with `data-threadmark-ignore`:

```jsx
<div data-threadmark-ignore>
  <InternalDeveloperToolbar />
</div>
```

Consumers can add selectors for other excluded regions:

```jsx
const ignoredSelectors = [".analytics-internal", "[data-test-fixture]"];

<Threadmark
  projectKey="pk_public_project_identifier"
  ignoredSelectors={ignoredSelectors}
/>
```

Keep the selector array stable between renders. Invalid selectors fail closed and emit `invalid_ignored_selector`.

The same built-in boundaries apply to region and selected screenshot-area captures. Inputs, editable fields, sensitive/ignored regions, iframes, video, embedded objects, and canvases are removed from the DOM-rendered image and their intersecting rectangles are painted with an opaque mask before the markup editor receives a raster. Those redactions are baked into the preview and cannot be removed with markup. These rules do not discover arbitrary unmarked PII, so reviewers must inspect the exact marked-up preview before choosing **Use screenshot**. Capture, redaction, markup, and attachment approval happen locally in browser memory; Threadmark never uploads or persists the image on its own.

Snapshot rendering also fails closed on unusually complex documents: more than 20,000 light/shadow DOM elements, a page dimension above 50,000px, or a page area above 100 million CSS pixels. Feedback remains available without image evidence when this safety budget is exceeded.

Snapshots wait briefly for the host page's fonts and embed available web-font faces so captured text keeps the page's typography. Font assets still follow the same-origin fetch boundary; fonts supplied only from an inaccessible cross-origin stylesheet may fall back in the image. Host applications that need exact evidence should serve those fonts from the same origin or include them as data URLs.

## Page version history

Threadmark can show other deployments for the route currently under review. The React package does not call Vercel directly: fetch deployment records in a trusted server route, combine them with per-build feedback counts, and pass the safe result through `pageVersions`. Use immutable deployment URLs rather than mutable branch aliases.

This repository includes a tested, framework-neutral [Vercel host adapter](https://github.com/gtimeyin/threadmark-sdk/tree/main/integrations/vercel) that performs the provider request, membership boundary, response reduction, count merge, and unavailable-history merge outside the SDK.

```jsx
<Threadmark
  projectKey="pk_public_project_identifier"
  buildId={currentDeploymentId}
  pageVersions={deployments.map((deployment) => ({
    id: deployment.id,
    buildId: deployment.id,
    url: deployment.immutableUrl,
    label: deployment.label,
    branch: deployment.branch,
    commitSha: deployment.commitSha,
    createdAt: deployment.createdAt,
    state: deployment.state,
    feedbackCount: deployment.feedbackCount,
  }))}
  onPageVersionSelect={(version, { url }) => router.push(url)}
  onFeedbackCarryForward={(feedback, version) =>
    reviewStore.copyToBuild(feedback.id, version.buildId)
  }
/>
```

Threadmark validates HTTP(S) URLs, discards their query and fragment, and applies the active canonical route before navigation. If `onPageVersionSelect` is omitted, the SDK uses `window.location.assign`. Carry-forward is never automatic: the control appears only when the host supplies `onFeedbackCarryForward`, and the host remains responsible for copying the record, enforcing permissions, and preserving evidence.

Protected previews may require a signed-in Vercel session or a server-issued access flow. Retention can also make older deployment URLs unavailable. Mark those records `unavailable` so reviewers can see the history without receiving a broken navigation action. This release intentionally does not iframe deployments or claim a visual diff; backend data, flags, and external services can change even when the frontend build is immutable.

## Environment safeguards

Threadmark is designed for local, preview, and staging environments:

- Local hosts (`localhost`, `*.localhost`, `127.0.0.1`, and `::1`) enable by default unless `enabled={false}`.
- A non-local preview or staging host requires `enabled`, a non-production `environment`, and a matching `allowedHosts` entry.
- `environment="production"` is always disabled in this alpha, even when `enabled` is true.
- Unknown or misspelled environment labels fail closed instead of activating the SDK.
- `projectKey` is a public identifier. Never pass a secret token to browser code.

Wildcard host entries only match subdomains:

```jsx
<Threadmark
  projectKey="pk_public_project_identifier"
  enabled
  environment="preview"
  allowedHosts={["*.preview.example.com"]}
/>
```

`*.preview.example.com` matches `branch.preview.example.com`, but not `preview.example.com`; list the parent host separately if both are required.

## Next.js App Router

Render Threadmark from a Client Component. The package is SSR-safe and creates its Shadow DOM overlay after the browser mounts:

```tsx
"use client";

import {
  Threadmark,
  type ThreadmarkPageVersion,
  type ThreadmarkReviewer,
} from "threadmark-react";

export function ReviewLayer({
  reviewer,
  deploymentId,
  pageVersions,
}: {
  reviewer: ThreadmarkReviewer;
  /** Pass process.env.VERCEL_DEPLOYMENT_ID from a Server Component. */
  deploymentId: string;
  pageVersions: ThreadmarkPageVersion[];
}) {
  return (
    <Threadmark
      projectKey={process.env.NEXT_PUBLIC_THREADMARK_PROJECT_KEY ?? ""}
      reviewer={reviewer}
      enabled={process.env.NEXT_PUBLIC_THREADMARK_ENABLED === "true"}
      environment={process.env.NEXT_PUBLIC_THREADMARK_ENVIRONMENT ?? "preview"}
      buildId={deploymentId}
      pageVersions={pageVersions}
      allowedHosts={["*.vercel.app"]}
      onFeedbackCreate={(feedback) => console.log(feedback)}
    />
  );
}
```

## API

### `<Threadmark />`

| Prop | Type | Purpose |
| --- | --- | --- |
| `projectKey` | `string` | Required public project identifier. |
| `reviewer` | `{ id, displayName, avatarUrl? }` | Authenticated reviewer supplied by the host; stored as annotation attribution. |
| `enabled` | `boolean` | Explicitly enables or disables capture, subject to environment and host safeguards. |
| `environment` | `string` | Environment label. Production is disabled in this alpha. |
| `buildId` | `string` | Optional application build identifier included in feedback. |
| `route` | `string` | Optional canonical route; defaults to `window.location.pathname`. |
| `allowedHosts` | `readonly string[]` | Exact or `*.` wildcard host allowlist. |
| `ignoredSelectors` | `readonly string[]` | Additional consumer regions excluded from selection. |
| `styleNonce` | `string` | CSP nonce applied to the Shadow DOM style element. |
| `annotations` | `readonly { feedback, context? }[]` | Authoritative records loaded by the consumer or review service. |
| `pageVersions` | `readonly ThreadmarkPageVersion[]` | Host-supplied immutable deployment records, availability state, and feedback counts for the active route. |
| `onReady` | `() => void` | Called once when the overlay is mounted. |
| `onStatusChange` | `(status) => void` | Reports `disabled`, `ready`, `selecting`, `selected`, `submitting`, `submitted`, or `error`. |
| `onOpenChange` | `(open) => void` | Reports entry to and exit from Review mode. |
| `onTargetSelect` | `(target) => void` | Receives redacted target metadata when a target is added. |
| `onSelectionChange` | `({ captureKind, targets }) => void` | Reports the current redacted selection summary. |
| `onFeedbackCreate` | `(feedback, context) => void \| Promise<void>` | Upserts created annotations, original-comment edits, and reply changes with approved JSON metadata plus in-memory evidence Blobs; async failures keep the draft open. |
| `onFeedbackDelete` | `(feedback) => void \| Promise<void>` | Removes one persisted annotation; rejection keeps it visible. |
| `onFeedbackClear` | `(feedback[]) => void \| Promise<void>` | Removes every persisted annotation; rejection keeps them visible. |
| `onPageVersionSelect` | `(version, { route, url }) => void \| Promise<void>` | Lets the host navigate to the same route on another ready deployment; without it, Threadmark navigates in-page. |
| `onFeedbackCarryForward` | `(feedback, version, { route, url }) => void \| Promise<void>` | Explicit host-owned copy into another deployment; providing it enables the carry-forward control. |
| `onError` | `(error) => void` | Reports configuration, duplicate-instance, snapshot-capture, submission, or deletion errors. |

### Utility exports

- `threadmarkTarget(id)` creates a stable target attribute.
- `createFeedbackPayload(options)` creates a normalized payload with the universal top-level `comment` and optional bounded `replies[]`.
- `isLocalHostname(hostname)` identifies supported local hostnames.
- `matchesAllowedHost(hostname, allowedHosts)` checks exact and wildcard patterns.
- `isThreadmarkEnabled(options)` applies the environment activation rules.
- `THREADMARK_TARGET_ATTRIBUTE` is the `data-threadmark-id` attribute name.
- `DEFAULT_ALLOWED_HOSTS` contains the default local host patterns.

Type declarations ship with the package.

If path segments contain customer or record identifiers, pass a templated canonical `route` such as `/customers/:customerId`; removing query strings and fragments alone does not anonymize path parameters.

## Isolation and behavior

- UI is rendered in a fixed Shadow DOM root, so package styles do not alter host layout or controls.
- Only one Threadmark instance may be mounted on a page.
- The compact comment popover is anchored to the current text highlight, element, group, or region and stays within the viewport; screenshot markup returns to the same universal comment flow. Popovers and the screenshot editor contain keyboard focus until they are closed.
- Element outlines follow resize and scroll changes with `ResizeObserver` and viewport listeners; a saved region follows its page coordinates.
- Saved element, text, and grouped annotations re-resolve after DOM mutations and route changes. Missing and ambiguous anchors remain visible through a repair state instead of attaching to a guessed element.
- Selecting an element prevents that click from triggering the host action.
- Keyboard reviewers can Tab to a target and press Enter or Space while Review mode is active.
- Added annotations remain as editable markers. Reopening restores the author-attributed discussion, approved screenshot evidence, and interaction traces supplied in the hydrated record; edits and replies preserve the capture data and reuse the feedback ID so consumers can upsert the result.
- Review controls provide visible keyboard focus and respect reduced-motion preferences.
- Launcher, toolbar, marker, popover, reply, composer, deletion, markup, and toast state changes use short motion tokens to preserve spatial context. Under `prefers-reduced-motion: reduce`, Threadmark removes transitions and animations while keeping every state immediately available.

## Current limitations

- Feedback is not persisted by the package; consumers must store callback records and hydrate them through `annotations`.
- Region and selected screenshot-area evidence are approximate DOM-rendered rasters, not operating-system screenshots. Cross-origin media, frames, WebGL/canvas content, unusual transforms, and unsupported CSS may be omitted or differ from the visible compositor output.
- Region capture currently supports one region per draft; resizing and manual masks are not implemented yet.
- Region dragging is pointer-first in this alpha; keyboard region initialization and edge adjustment remain a beta accessibility gate.
- Grouped feedback stores one ordered target group but does not yet create a snapshot per member.
- Interaction capture replays its structured event trace; it does not record video frames or automatically re-execute actions against the host application.
- Collaboration, authentication, and agent dispatch are not included yet.
- Same-origin iframes, cross-origin frames, and closed shadow roots are not selection targets.
- Production activation is intentionally unavailable.

## Repository development

Build and verify the package:

```bash
cd packages/react
npm run test
npm run pack:check
```

The test command includes a headless Chromium privacy suite. On a fresh development machine, install its browser runtime once with `npx playwright install chromium`.

Run the standalone consumer fixture:

```bash
cd examples/basic-react
npm install
npm run dev
```

The fixture consumes `threadmark-react` through `file:../../packages/react` and logs every submitted feedback payload in the page.

## License

Threadmark is available under the [MIT License](./LICENSE). Third-party software notices are listed in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

### Comment screenshots and repinning

Element, text, group, and completed interaction comments automatically prepare a masked local screenshot. It is always attached through `onFeedbackCreate(feedback, context)` when the reviewer chooses **Post**; the composer does not show a preview or an approval checkbox. Region drags keep their preview and are attached automatically as well. Automatic masking covers inputs, editable fields, sensitive and ignored regions, iframes, video, embedded objects, and canvases, but does not detect arbitrary unmarked PII, so mark sensitive areas with `data-threadmark-sensitive`. Capture failures preserve the comment with unavailable evidence metadata. No evidence is sent before posting. Replies reuse the original screenshot.

Persist both the serializable feedback and the Blob sidecar in `context.evidence`. Hydrate both through `annotations` to keep the preview available after reload or target removal. The basic React example uses IndexedDB; the optional Threadmark Cloud adapter also supports private shared screenshot storage. The host must explicitly connect an authenticated Cloud client; the SDK itself makes no Cloud requests. Production hosting and identity configuration remain the consumer’s responsibility.

**Repin comment** is available on existing discussions and is the primary repair action for missing targets. Select one live element, then confirm. Cancellation or a rejected persistence callback leaves the original location unchanged. The same feedback ID, original `target`/`targets`, build, author, replies, and evidence remain intact. `feedback.pin` identifies the current location; `pinHistory` contains previous locations and reviewer/build/time context. Subsequent edits and reloads retain these fields. Consumers should treat this as an update to the existing record, validate membership and reviewer identity server-side, and persist the full normalized record. Repinning does not take or replace a screenshot.

Coordinate-only region and Pencil pins require repair when a different known build is active; their original evidence remains available. Ordinary element pins continue using conservative stable-ID/path/fingerprint restoration. Missing or ambiguous matches never silently attach to another element.

### Feedback panel

Choose the **Feedback panel** icon in the annotation toolbar. Its **Comments** tab lets reviewers browse supplied records for the current project, including other pages and builds. Cards show status, author, original screenshot, assignee, replies, and target-repair state. Search includes comment and reply text. The filter icon opens a floating dropdown without shifting the list: toggle resolved comments, your threads, the current page, or targets needing repair; **More filters** includes status, reviewer, page, and original build selectors. Search and applied filters remain active when the dropdown is closed. Selecting a different page navigates to its same-origin path with a thread link. Only current-page pins render on the page. The panel does not fetch other records itself: supply authorized project records through `annotations`, or use Cloud’s project-wide comments view. Escape closes the filter dropdown first, then the panel, before exiting review mode. When the host supplies `pageVersions`, a **Versions** tab lists those deployments in the same panel.


### Review workflow and deployment verification

Existing discussions open as a **Comment** popover with **⋯** thread options (Repin, Copy link, Carry forward, deployment comparison, activity history), a **✓** Resolve/Reopen toggle, and close. Browse discussions through the toolbar's **Feedback** panel. Each message has its own **⋯** menu with Reply, Edit (original comment), and Delete; replies are posted from the rounded field at the bottom (Enter sends, Shift+Enter adds a line). Reviewers are mentioned inline: typing `@` suggests members from `reviewers` and inserts `@Display Name`, and saving records newly mentioned members in `workflow.mentions`. Clicking a saved screenshot opens the full image. Existing `workflow.assignee` values are preserved but there is no assignment control. Workflow changes use `onFeedbackCreate`; persist the complete record. SDK-only callbacks do not send notifications; Cloud generates in-app notifications from its authenticated assignment/mention endpoints.

**Compare with current page** captures a temporary masked view beside the original screenshot. Mark a fix verified or still needing work for the current build; verification does not automatically resolve the comment. Repair a missing target before capturing a comparison. Repinning preserves the original capture and records the new location separately.

`onFeedbackCreate` may return a canonical `{ feedback, context }` record from your persistence adapter, allowing server-owned IDs and authoritative identities to replace local draft IDs. The optional Cloud adapter is in `threadmark-cloud/cloud/src/threadmark-adapter.mjs`; construction does not connect or upload. See the Cloud collaboration guide for setup and deployment limits.


### Choose your hosting

Use **Your backend** to persist SDK callbacks in your own infrastructure, or explicitly connect **Threadmark Cloud** for managed collaboration and MCP access. Core capture and repinning work with either choice; the SDK never connects automatically. The separate Cloud repository now contains an optional `threadmark-cloud-client` package, a `/setup` guide, and a review-scoped approval popup. That client package is available as a local tarball and has not been published to npm. Cloud’s initial MCP endpoint accepts short-lived bearer headers; automatic MCP OAuth discovery is not available.
