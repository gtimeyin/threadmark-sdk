# Changelog

All notable changes to Threadmark are documented here. The project follows [Semantic Versioning](https://semver.org/) and is currently distributed through the npm `beta` tag.

## [Unreleased]

## [0.1.0-beta.10] — 2026-10-18

### Fixed

- Sanitize replay URL metadata and snapshot/mutation URLs before buffering; scrub console credentials and error stacks.
- Prevent recursive full snapshots at the replay event limit and restore browser instrumentation after recorder startup failures.

### Added

- Video feedback: **Record video feedback** records the current tab with voice and a draggable camera bubble, or voice (and camera) with a pointer track when tab capture is unavailable or declined. A cursor halo and click ripples show the pointer in the video, and voice recordings can be replayed over the live page with a ghost cursor that carries the reviewer's camera or initials. The recording is delivered as a `recording` evidence Blob with `feedback.video` metadata, a pointer track, and the same privacy-safe step timeline as interaction traces. Configure or disable it with the `videoRecording` prop.
- Markdown export lists each video's timed steps with stable target IDs.
- Session replay: with `sessionReplay`, Threadmark keeps a masked rrweb recording of the last 30 seconds and attaches it to new comments, with console errors and failed requests. Reviewers can preview or remove it before posting, and saved threads open it in a player with Console, Network, and Actions tabs. It is delivered as `replay` evidence with a `feedback.replay` summary. Every form value is masked, sensitive and ignored regions are blocked, request URLs keep only query names, and bodies and headers are never captured. Console messages and error stacks are scrubbed of credentials, keys, emails, long hex or base64 runs, and URL query values before they are kept. `provider` lets a host supply its own recorder.
- Questions and polls: with `onPollVote`, the composer offers Comment, Question, and Poll. Polls have 2–8 answers with stable ids (optionally several per person); reviewers vote in the thread and see who chose what, and resolving a poll closes it. Votes stay host-owned: `onPollVote` stores the vote and returns the results, which the host supplies back as `context.poll`.
- Hosts can supply stored evidence as `{ id, url }` (for example a signed storage URL) instead of a Blob. Threadmark displays it and passes it back unchanged when the thread is saved again.

### Changed

- Tab video records at about 1.2 Mbps, camera-only video at 0.8 Mbps, and audio at 96 kbps, so a 5-minute recording stays under common 50 MB upload caps.
- The overlay loads its styles through a constructed stylesheet and its fonts as binary data, so it works under strict Content Security Policies without `'unsafe-inline'`. `styleNonce` now applies only to the fallback `<style>` element in browsers without constructable stylesheets.
- `rrweb` 2.1.6 is a new, exact-pinned dependency. It loads on demand, only when `sessionReplay` records or a saved replay is opened.

### Fixed

- Interaction recordings that contain no element steps now re-anchor to the page instead of always reporting **Target needs repair**.
- Interaction steps that change a form field are labelled "Changed a form field" instead of "Changed page".

## [0.1.0-beta.9] — 2026-09-28

### Fixed

- Screenshot evidence now waits briefly for page fonts and embeds available web-font faces, preserving host-page typography without crossing the same-origin asset boundary. Existing saved images are unchanged.

## [0.1.0-beta.8] — 2026-09-28

### Added

- Comments whose element changed on a new deployment show a dashed suggested location with the original and current label; **Confirm location** saves it as a repin with history and **Choose another** starts a manual repin.
- Comments whose element was removed stay on the page as a faded ghost marker and outline at the last known position, labelled with their original build. Element targets now record `pageBounds` for this. Region and Pencil comments from another build use the same treatment instead of disappearing.
- Scrolling only repositions markers; target matching reruns when the page changes.

### Changed

- Maintain the SDK's public source in `gtimeyin/threadmark-sdk`, with matching npm repository metadata and tokenless GitHub Actions publishing. Public Git history starts with this release; earlier npm releases are retained without importing private prototype history.
- Move the review overlay onto the Threadmark brand: forest and proof coral on paper for the Feedback panel and page marks, mint and coral-on-dark for the dark toolbar, composer and threads; buttons use a 10px radius instead of pills. Geist, Geist Mono and Bricolage Grotesque (latin subsets) are bundled and registered under `Threadmark`-prefixed names, so the overlay makes no font requests and never overrides the host app's fonts.
- Give the Comments/Versions side panel a translucent glass surface, with higher-contrast text and solid accessibility/browser fallbacks.
- Remove the unused footer gap below the Reply field in saved comment popovers.
- Open comment filters in a floating dropdown with checkmarked quick filters, detailed filters, outside-click dismissal, and keyboard focus restoration, without shifting the list.
- Unified comment browsing and deployment history in the Feedback panel's Comments and Versions tabs, with compact search and filter controls.
- Simplified saved discussions with per-message actions, inline editing, inline mentions, a rounded reply composer, and a separate deployment comparison dialog.
- Automatically attach masked snapshots when comments are submitted; ordinary comment composers omit the snapshot preview and attachment checkbox, while region and Pencil captures retain their in-context previews.

### Fixed

- Closing or cancelling a new comment now uses the same discard confirmation as Escape and outside clicks; closing a saved thread protects unsent replies and edits too.
- Reply and edit drafts survive message-mode changes. Cancelling reply targeting keeps typed text, and cancelling or saving an inline edit restores the previous reply draft.
- Deployment comparison traps keyboard focus, makes the background inert while open, and restores focus to thread options when closed.
- Narrow toolbars scroll only secondary tools, keeping Feedback, Close, and the grouped-selection Comment action visible at 320px.
- Interaction traces no longer record Space (or Enter in multi-line fields) typed into editable fields, which revealed word and line counts.
- Records returned by `onFeedbackCreate` are normalized like hydrated records. A host-assigned ID is adopted, local evidence is kept when the host omits `context`, and a malformed record keeps the local one instead of breaking the overlay.
- Changing `environment`, `enabled`, `allowedHosts`, `ignoredSelectors` or `styleNonce` after mount no longer clears markers supplied through `annotations`.
- A malformed `workflow.history` entry no longer hides the whole discussion; workflow history is capped at the newest 200 entries and pin history at 50.
- Comments without an author are no longer labeled "You" when no `reviewer` is set.
- Copied annotation links contain only the page path and the `threadmark` parameter, so other query parameters and fragments (such as share tokens) are not shared.
- Type definitions now match runtime values for `pin` (may be `null`), snapshot `capture.bounds` (optional) and `createFeedbackPayload`'s `buildId` (accepts `null`).
- Repinning a comment that covers several elements now says how many targets it has and that the pin moves to one element, instead of reducing the group silently.
- Deployment comparison scrolls the target into view and refuses to capture when it cannot be fully visible, so **Mark fix verified** never follows a blank or off-screen crop.
- Building a multi-selection no longer starts a full-page comment snapshot on every additive click; the snapshot is captured once when the composer opens.
- Saved targets with a recorded accessible name or visible text only re-anchor to an element whose name or text still matches; structural look-alikes now show **Target needs repair** instead of silently moving the comment.

## [0.1.0-beta.6] — 2026-09-01

### Added

- Version 1 provider-neutral hosted-service contract for future Jira, Linear, and additional issue-tracker adapters.
- Host-driven page version history with immutable same-route deployment navigation, per-build feedback counts, unavailable states, and explicit comment carry-forward callbacks.
- Framework-neutral, server-only Vercel deployment adapter with authenticated project resolution, safe response mapping, rate-limit/error handling, and persisted unavailable-history merging.

## [0.1.0-beta.5] — 2026-09-01

### Added

- Privacy-safe, in-page interaction trace recording and non-destructive timeline playback.
- Public `/about` explainer with integration guidance and a Jira/Linear connector roadmap.
- Open-source contribution and security guidance.

### Changed

- Split the SDK controller and rendered overlay into separate internal modules without changing the public API.
- Aligned screenshot attachment, thread deletion, interaction capture, and storage documentation with the implemented experience.
- Standardized the product prototype on Lucide icons and removed the Phosphor and React Icons dependencies.

## [0.1.0-beta.4] — 2026-08-28

### Added

- Threaded replies in the anchored annotation discussion.
- Impact-aware confirmation for deleting a reply or complete annotation.
- Browser coverage for reply, deletion, and persistence flows.

### Changed

- Preserved the original annotation author while recording the active editor.
- Refined the compact comment composer and selected-context disclosure.

## [0.1.0-beta.3] — 2026-08-26

### Changed

- Matched the comment popover to the refined Figma component states.
- Moved selected context into a closed-by-default disclosure.
- Tightened action, focus, spacing, and metadata styling.

## [0.1.0-beta.2] — 2026-08-19

### Added

- Reviewer attribution in feedback payloads.
- Author and last-editor metadata restoration.

## [0.1.0-beta.1] — 2026-08-17

### Added

- First public beta of `threadmark-react`.
- Element, text, grouped-target, region, and selected-area screenshot annotations.
- Client-side screenshot masking and in-page markup tools.
- Consumer-owned persistence callbacks, hydration, deep links, and conservative target restoration.
- Package, SSR, browser interaction, npm tarball, example application, and CI verification.

[Unreleased]: https://github.com/gtimeyin/threadmark-sdk/compare/v0.1.0-beta.9...HEAD
[0.1.0-beta.9]: https://github.com/gtimeyin/threadmark-sdk/tree/v0.1.0-beta.9
[0.1.0-beta.8]: https://github.com/gtimeyin/threadmark-sdk/tree/v0.1.0-beta.8
[0.1.0-beta.6]: https://www.npmjs.com/package/threadmark-react/v/0.1.0-beta.6
[0.1.0-beta.5]: https://www.npmjs.com/package/threadmark-react/v/0.1.0-beta.5
[0.1.0-beta.4]: https://www.npmjs.com/package/threadmark-react/v/0.1.0-beta.4
[0.1.0-beta.3]: https://www.npmjs.com/package/threadmark-react/v/0.1.0-beta.3
[0.1.0-beta.2]: https://www.npmjs.com/package/threadmark-react/v/0.1.0-beta.2
[0.1.0-beta.1]: https://www.npmjs.com/package/threadmark-react/v/0.1.0-beta.1
