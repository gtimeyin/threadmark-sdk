# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Selected direction

- Preserve the approved warm editorial canvas, forest-green controls, coral element marker, persistent right-hand discussion thread, and before/after content treatment.

## Brand system (updated 2026-11-08)

- Source of truth: the Threadmark brand book in Figma (file `u7Xb91nRDDSy5sfPgvgiBQ`): UI Components page (145:1322) and the Feedback experience boards 00–12 (page 431:5845). Tokens are mirrored in `brand-assets/tokens/threadmark.css` (outside this repo) and in the `--tm-*` block of `packages/react/src/overlayStyles.js`.
- Colour: Forest `#035D47`, Orange `#F15722` (pins, recording, focus ring; `#C1461B` when it carries text on light, `#FF8F66` on dark), Lime `#E0F354` (the action colour on the dark chrome, never on Paper), Paper `#FBFAF6`, Ink `#14201C`, Stone `#5E6662`, Hairline `#E9E8E3`. Dark chrome: ground `#0E1714`, surface `#16221E`, raised `#1E2B26`, hairline `#2A3833`, muted text `#A3ADA8`.
- Type: Geist for all product UI and Geist Mono for code and metadata. Geist Serif is for marketing headlines only, never inside the SDK. Bricolage is retired.
- Shape: buttons, fields and chips 6px; panels and the Bar 8px; popovers 16px. Flat buttons with a hairline alpha border; never pills.
- Focus: a 2px Orange ring with a 2px gap.
- The SDK overlay is dark chrome (Bar, panel, composer, threads) over the host page. Marks on the page stay Orange for pins and selections.
- Fonts are bundled from Fontsource (`src/fonts.js`) and registered as `Threadmark Geist` and `Threadmark Geist Mono`; never load fonts from a CDN in the SDK.
- The mock Northstar customer site (and the explainer's demo customer copy) keeps Newsreader, so the reviewed site stays visually distinct from Threadmark's own UI.
- The product should support exact-element feedback across content, visual design, and expected-versus-observed interaction behavior.

## SDK boundary

- Treat the npm SDK and hosted collaboration platform as separate products with independent milestones. The hosted product definition and internal planning are maintained in the separate private Cloud repository; Cloud capabilities must not be presented as shipped SDK features.
- Keep Cloud connectivity explicit and optional. SDK installation or upgrades must not introduce mandatory Cloud accounts, uploads, or telemetry. Consumer-managed backends remain possible without a supported self-hosted Cloud promise.

- Customer applications install the review surface as the dev dependency `threadmark-react` and mount one `<Threadmark />` component near the app root.
- The SDK owns explicit environment/hostname activation, privacy-safe DOM targeting, an isolated Shadow DOM overlay, structured feedback capture, and lifecycle callbacks.
- Stable element anchors use `data-threadmark-id` through the exported `threadmarkTarget()` helper; ordinary semantic elements remain selectable without manual tagging.
- Production activation fails closed in the first release. Local review is enabled by default; preview or staging hosts require both `enabled={true}` and an explicit hostname allowlist.
- The npm package does not own sessions, authentication, collaboration, persistence, or agent dispatch. Those belong to the hosted review service and integrate through SDK callbacks until a server API is added.
- The SDK accepts stored evidence as `{ id, url }` as well as `{ id, blob }`, displays the URL, and passes it back unchanged on later saves. It never uploads or fetches on its own.
- Session replay (decided 2026-10-16): `sessionReplay` keeps a rolling rrweb buffer (30 seconds by default) and attaches it to new comments as `replay` evidence with a `feedback.replay` summary of console errors, failed requests, and actions. It is off by default. Every form value is masked, sensitive and ignored regions and Threadmark's own UI are blocked, request URLs keep only query names, and bodies and headers are never captured. Console messages and error stacks are scrubbed before they are buffered or summarised (`scrubConsoleText`: JWTs, bearer credentials, API-key shapes, `password=`-style values, emails, long hex or base64 runs, URL query values). Reviewers can remove the playback before posting. rrweb stays an exact-pinned dependency so the documented CSP patch keeps matching.
- Questions and polls (decided 2026-10-17): the new-comment composer offers **Comment / Question / Poll** only when the host supplies `onPollVote`. A question is answered with replies. A poll has 2–8 answers with stable ids, optionally several per person, and resolving it closes it. A posted `ask` can't be rewritten. Votes are host-owned: `onPollVote` returns the results and the host supplies them back as `context.poll`.
- The SDK may accept authoritative `{ feedback, context }` records through its controlled `annotations` prop and emit create/delete/clear lifecycle callbacks. Storage remains consumer-owned; the basic React fixture uses IndexedDB only as a hosted-service stand-in so reload behavior can be exercised locally.
- Hydrated annotations resolve stable IDs first, validate DOM paths, and only use a unique conservative fingerprint fallback. Never silently attach a missing or ambiguous annotation to a guessed target; preserve its comment/evidence and expose the **Target needs repair** state. Multi-target records never shrink silently.
- Annotation deep links use the non-secret `threadmark` query parameter and open only after the consumer supplies an authorized record for the active project and route.
- Keep the root prototype as the hosted product-shell reference. Validate SDK changes in `examples/basic-react` and do not import the prototype's global styles or branded demo data into the package.

## Visual implementation preferences

- Use the Threadmark brand icon set (`packages/react/src/icons.jsx`, generated by `scripts/build-icons.mjs` from `brand-assets/icons`) for every functional icon. Do not mix in other icon families.
- Keep screenshot markup in context on the page: the selected crop becomes the drawing surface and compact tools float nearby. Do not move markup into a centered modal editor.
- Do not add a separate **Capture area** confirmation after a Pencil drag. Releasing a valid crop opens the in-page markup tools immediately.
- Defer reviewer-facing crop adjustment and Privacy controls. Keep automatic snapshot masking in the capture pipeline, but do not expose either feature in the current Pencil UI.
- Use purposeful motion to explain state changes: fast feedback for controls, a standard transition for composer and toolbar states, and a slightly slower entrance for anchored surfaces. Keep movement within 4–8px, avoid ornamental looping motion, and remove all nonessential animation when `prefers-reduced-motion` is enabled.
- Interaction annotations use an in-page, maximum 15-second structured trace rather than operating-system screen recording. Keep the host application usable while recording; capture code-searchable clicks, safe input-change markers, command keys, scrolls, submissions, and same-document navigation. Never capture input values or printable keystrokes, and replay the trace as a non-destructive timeline instead of re-executing host actions.
- Video feedback (decided 2026-10-16) is Loom-style: an in-page setup card, then current-tab capture with microphone and a draggable camera bubble, or voice (and camera) plus a pointer track when tab capture is unavailable or declined. Tab videos are deliberately not masked. The step timeline attached to a video follows the interaction-trace rules above (no input values, no printable keys). Show a cursor halo and click ripples while recording, replay voice recordings as a ghost cursor carrying the reviewer's camera or initials over the live page without changing it, default to a 5-minute limit, and require a second step before restarting or discarding. Keep all media access in `packages/react/src/videoRecording.js`; upload, transcription, and summaries belong to the host's storage or review service.

## Project explainer page

- Preserve the interactive review prototype at `/`; the public project explainer lives at `/about`.
- The explainer uses Threadmark's warm paper canvas, Bricolage Grotesque display type, Geist interface type, the open-pin logo, forest-green surfaces, and coral annotation accents.
- Lead with a recognizable in-context review preview, then progressively disclose capabilities, use cases, integration, privacy, Vercel workflow, current capabilities, roadmap, and open-source information.
- Present interaction recording as a first-class shipped capture capability. Keep lifecycle status, mentions, notifications, official storage adapters, real-time collaboration, and advanced anchor repair clearly labeled as planned.
- Present Jira and Linear integrations as a near-term hosted-service roadmap item. Keep vendor adapters outside `threadmark-react`; require an explicit reviewed handoff, preserve the Threadmark deep link and evidence references, and store the external issue key/URL without making the issue tracker the annotation source of truth.
- Use the Threadmark brand icon set for all functional icons on the explainer page.

## Collaboration identity and visibility

- Private beta uses authenticated, named workspace members; public or anonymous feedback is not presented as available.
- Every annotation and reply visibly identifies its author. Use the member's server-authoritative identity in the hosted service; never trust an author name supplied by the capture client.
- Local drafts and unapproved evidence remain visible only to their author. Once posted, feedback, replies, and approved evidence are visible to every invited member of that review session, but never to another session, project, or workspace.
- Keep authorship scannable with an avatar, full name, role, timestamp, a **You** indicator for the current member, and a reviewer filter in aggregate feedback views.
- Sharing language must say that the session is private and accessible only to invited members. A copied session link does not bypass authentication or membership authorization.
- Saved annotations open as discussion threads. Reviewers can respond to the original comment or a previous reply without overwriting it.
- Deleting a reply removes only that reply. Deleting an annotation removes its original comment, every reply, and attached evidence. Both actions require an impact-aware confirmation state that replaces the popover action toolbar before the final delete.

## Comment evidence and repinning

- Every new comment always attaches its automatically masked screenshot (ordinary element/text comments and region drags). Do not show an approval checkbox or explanatory text; ordinary comments do not show a preview in the composer at all, and region drags keep their preview because it is the subject. Capture failures must not block text feedback.
- Repinning keeps the same discussion and original target/build/evidence, records the current pin separately with location history, and requires a new-target preview plus confirmation. Cancelled or failed saves preserve the previous location.
- Comments stay visible across deployments and page updates. An exact match restores normally. When the exact target no longer matches but one likely element exists (same tag and role, similar text or the same DOM position), show a dashed "element changed" suggestion; it attaches only after the reviewer chooses **Confirm location**, which is saved as a repin with history, or **Choose another**. When nothing matches, show a faded ghost marker and outline at the last known page position, labelled as removed with its original build, and offer Repin. Region and Pencil pins from a different build use the same ghost treatment. Comments saved before page positions were recorded fall back to the repair list.
- Keep saved discussions accessible from the **Feedback** panel, opened by a single icon button in its own divided section at the end of the SDK toolbar (just before Close) with a coral comment-count badge. The idle **Review page** launcher carries the same badge. Screenshot previews show only the image, not size/byte/redaction metadata. Keep the panel listing comments with missing targets. Show the current-page scope, reviewer identity, screenshot, reply count, search, reviewer filter, and repair filter; opening a discussion must provide a way back to the list.
- Saved threads follow a Figma-style comment treatment: a **Comment** header whose **⋯** opens a compact dropdown (Repin comment, Copy link, Carry forward, Compare with current page, Activity history — no All comments link), a **✓** resolve toggle, and close; flat messages (avatar, name, relative time) with a per-message **⋯** menu (Reply, Edit on the original comment, Delete) that appears on hover or focus and stays visible on touch devices; editing replaces the message with one outlined box containing the text plus **Cancel**/**Save**; replies use an avatar plus rounded **Reply** field with a round send button. Do not add assignee or mention pickers: reviewers are mentioned inline with `@`. Saved screenshots open when the image is clicked; no separate link.
- Deployment comparison is its own view: a large before/after dialog above the page, never a section inside the comment discussion. Recording **Mark fix verified** or **Still needs work** closes it. Feedback panel list items are flat with dividers between them and only gain a white surface on hover.
- The **Feedback** panel holds both **Comments** and **Versions** (page deployments) as tabs; do not add separate toolbar buttons for comment lists or version history. Keep the Comments tab compressed by default. Search expands an inline search field, while filtering opens a compact floating dropdown below its icon with checkmarked options, not an expanding panel section. Keep detailed filters under **More filters** in that dropdown. Applied queries and filters remain active when their controls are closed.
- Give the shared Comments/Versions side panel a translucent, lightly blurred glass surface so the host page stays visible behind it. Keep text and controls readable, with a solid fallback for reduced transparency, forced colors, or browsers without backdrop filtering.
- Keep saved comment popovers compact below the Reply field; empty action footers must not reserve extra bottom space.

## Repository organization

- This repository owns the MIT React SDK, examples, integrations, and reference prototype. The marketing website and hosted Cloud service have separate repositories and release lifecycles.
- Keep internal strategy, Cloud delivery planning, local QA screenshots, and creative explorations outside this public source tree. Existing historical documents require review before making the repository public.
- Preserve explicit optional Cloud connectivity through public SDK callbacks; do not import Cloud server code or website code into the SDK.

## Icon system (updated 2026-11-08)

- Functional icons come from the Threadmark brand set: 24px grid, 1.5px round stroke, drawn in `currentColor`. Regenerate `packages/react/src/icons.jsx` with `node scripts/build-icons.mjs <brand-assets/icons>`. Strokes thin out as icons shrink (24px 1.5, 18–22px 1.25, 16px 1.125, 12–14px 1). Keep the open-pin logo as a separate brand asset.

- Saved discussion design (2026-11-03): follow the supplied clean thread reference: dark surface, subtle border/shadow, relaxed message spacing, readable author/body text, compact filled reaction chips and an icon-only smile-plus reaction trigger. Use the Lime action and the dark chrome. The reference guides spacing and simplicity, not its light colour scheme. Avoid outlined reaction buttons and verbose “React” labels.

- The Bar (2026-11-08): the idle launcher and the review toolbar are one dark bar centred at the bottom of the page (Figma "Bar"). Idle it says what is waiting: "Leave feedback", new questions or comments, "All caught up", or "Offline", with the ⌘⇧F key. In comment mode it shows "Click anything, or select text · Esc" followed by the tools, the panel button and Close.

- Send it elsewhere (2026-11-08, board 10): a comment's ⋯ menu lists **Send to <name>** for each connected `destinations` entry when the host passes `onSendTo`. The host creates the issue or message and returns `{ label, url, status }`; Threadmark stores it on the comment as `feedback.links` and shows it on the thread and panel row ("GitHub #482 · Open", "closed in GitHub #482"). Failures are shown in the sheet in plain words, with the host's `fix` link. Connecting a destination is the host's own flow (`onConnectDestination`).
- Tours (2026-11-08, board 06): the player card shows "<Tour name> · 1 of 3", a close button, progress dots and **Something unclear here?**; the default accent is Forest. Tour mode is the dark panel with Lime step numbers and a "Who and when" sentence. **Save to code** opens a sheet with the file, the `npx threadmark tours check` tip, **Copy file**, **Save to project** and, only when the host connects one, **Send to <AI>**. Don't show `threadmark init --ai` or `threadmark mcp` until those commands ship.
