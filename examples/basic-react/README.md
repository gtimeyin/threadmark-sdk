# Basic React consumer fixture

This Vite app installs `threadmark-react` through a local file dependency and treats it like a normal third-party package. It is intentionally separate from Threadmark's prototype shell.

The page demonstrates:

- stable target IDs through `threadmarkTarget()`;
- gesture-first capture through element clicks, native text highlights, marquee selection, and additive <kbd>Command/Ctrl</kbd> + <kbd>Shift</kbd>-clicks;
- one universal comment field in a compact popover anchored to the current selection;
- host-supplied reviewer identity shown in the popover and persisted as feedback attribution;
- a privacy-filtered local snapshot preview when a drag ends over empty space;
- a Pencil action that lets the reviewer select a screenshot area before opening markup tools;
- a live `onFeedbackCreate` log for the top-level `comment`, inferred `captureKind`, `selectedText`, and approved Blob evidence sidecars;
- consumer-owned IndexedDB persistence wired through `annotations`, `onFeedbackCreate`, `onFeedbackDelete`, and `onFeedbackClear`;
- a host-supplied page-version picker with feedback counts, unavailable history, simulated version switching, and explicit comment carry-forward;
- controls excluded by Threadmark's built-in sensitive-field policy;
- regions excluded with `data-threadmark-sensitive` and `data-threadmark-ignore`; and
- a consumer-defined `.analytics-internal` ignored selector.

## Run locally

Build the package first, then install and start the fixture:

```bash
cd ../../packages/react
npm run build

cd ../../examples/basic-react
npm install
npm run dev
```

Open `http://localhost:4174` and select **Review page**. Click one element or highlight native text to open its anchored comment popover. Drag across eligible elements to create a group, or hold <kbd>Command/Ctrl</kbd> + <kbd>Shift</kbd> and click individual elements before choosing **Comment**. Drag across empty space to create a region and inspect its privacy-filtered local snapshot; masked snapshots attach automatically when the comment is submitted. Choose **Pencil** and drag around the exact screenshot area. Releasing the drag opens markup immediately; draw on the crop and choose **Use screenshot** to approve that exact marked crop for attachment before continuing to the universal comment. There is no second screenshot-approval checkbox. Every annotation submits the same top-level `comment`; text feedback uses `captureKind: "text"` with the quote in `target.selectedText`, while Pencil feedback uses `captureKind: "screenshot"`. Submitted metadata and approved evidence details appear at the bottom of the page.

The compact toolbar can be dragged by its grip. Its Pencil action opens screenshot markup, and its Feedback panel icon opens saved comments plus a Versions tab with the simulated deployments for this same route. Use <kbd>P</kbd> to pause or resume the page, <kbd>H</kbd> to hide or show markers, <kbd>C</kbd> to copy annotations, <kbd>X</kbd> to clear them, and <kbd>Escape</kbd> to cancel or exit. <kbd>Command/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> toggles Review mode.

Added annotations remain as numbered markers after reload. Click a marker to reopen its discussion, edit the original comment, reply, or choose the visible delete action. Deletion first replaces the normal actions with an impact summary and final confirmation, then updates the consumer-owned IndexedDB store. Approved selected screenshot-area Blobs and exact text ranges restore through the SDK's controlled `annotations` prop. Reopened annotations offer **Copy link**, which adds the saved feedback ID to the URL and opens that exact comment after reload. Sensitive and ignored regions are masked before editing, unmarked PII is not detected automatically, and only callback-approved evidence is persisted by this example.
