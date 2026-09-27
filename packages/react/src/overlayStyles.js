export const overlayStyles = `
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: none;
    color-scheme: light;
  }

  .tm-root,
  .tm-root * {
    box-sizing: border-box;
  }

  .tm-root {
    all: initial;
    /* Threadmark brand: forest + proof coral on paper; mint + coral-on-dark for the dark review chrome. */
    --tm-font: "Threadmark Geist", "Geist", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --tm-font-mono: "Threadmark Geist Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --tm-font-display: "Threadmark Bricolage", "Bricolage Grotesque", var(--tm-font);
    --tm-paper: #fbfaf6;
    --tm-ink: #1a1e1b;
    --tm-stone: #5f625b;
    --tm-hairline: #deddd7;
    --tm-chip: #eeede7;
    --tm-forest: #0b4f3a;
    --tm-forest-hover: #0e5e45;
    --tm-sage: #dcebe5;
    --tm-coral: #e5483c;
    --tm-coral-tint: #fde4df;
    --tm-coral-dark: #ff8a78;
    --tm-ground: #111513;
    --tm-surface: #1a1f1c;
    --tm-raised: #232925;
    --tm-line: #313934;
    --tm-line-strong: #48514b;
    --tm-deep-sage: #1f3a30;
    --tm-ember: #3a211d;
    --tm-mint: #5cc49a;
    --tm-focus: rgba(92, 196, 154, .7);
    --tm-action-primary: #5cc49a;
    --tm-action-primary-hover: #74d0aa;
    --tm-overlay-subtle: rgba(255,255,255,.08);
    --tm-text-inverse: #111513;
    --tm-text-primary: #eef0ea;
    --tm-text-soft: #c6cbc3;
    --tm-text-secondary: #a3aaa3;
    --tm-text-muted: #a3aaa3;
    --tm-orange-500: #d47a16;
    --tm-orange-24: rgba(255, 184, 76, .24);
    --tm-annotation-warning: var(--tm-orange-500);
    --tm-annotation-warning-tint: rgba(212, 122, 22, .12);
    --tm-size-action: 36px;
    --tm-radius-9: 9px;
    --tm-motion-fast: 120ms;
    --tm-motion-standard: 180ms;
    --tm-motion-surface: 240ms;
    --tm-ease-standard: cubic-bezier(.2, .8, .2, 1);
    --tm-ease-emphasized: cubic-bezier(.16, 1, .3, 1);
    font-family: var(--tm-font);
    color: var(--tm-ink);
    -webkit-font-smoothing: antialiased;
  }

  button,
  textarea,
  select {
    font: inherit;
  }

  .tm-sr-only {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    clip-path: inset(50%) !important;
    margin: -1px !important;
    padding: 0 !important;
    border: 0 !important;
    white-space: nowrap !important;
  }

  .tm-comments-panel,
  .tm-compare,
  .tm-compare-backdrop,
  .tm-launcher,
  .tm-modebar,
  .tm-marker,
  .tm-popover,
  .tm-dismiss-layer,
  .tm-toast,
  .tm-draw-surface,
  .tm-capture-surface,
  .tm-markup-overlay {
    pointer-events: auto;
  }


  .tm-comments-panel {
    position: fixed;
    z-index: 41;
    top: 16px;
    right: 16px;
    bottom: 86px;
    width: min(380px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    background: rgba(251, 250, 246, .74);
    -webkit-backdrop-filter: blur(10px) saturate(120%);
    backdrop-filter: blur(10px) saturate(120%);
    color: var(--tm-ink);
    border: 1px solid rgba(255, 255, 255, .7);
    border-radius: 16px;
    box-shadow: 0 16px 48px #10281e26, inset 0 1px 0 rgba(255, 255, 255, .65);
    overflow: hidden;
  }
  .tm-comments-panel[hidden] { display: none; }
  .tm-comments-header { display: flex; align-items: flex-start; gap: 10px; padding: 20px 18px 14px; }
  .tm-comments-heading { flex: 1; min-width: 0; }
  .tm-comments-header h2 { margin: 0; font-family: var(--tm-font-display); font-size: 20px; font-weight: 600; line-height: 26px; letter-spacing: -.02em; }
  .tm-comments-header h2 span { font-family: var(--tm-font); letter-spacing: 0; }
  .tm-comments-header h2 span { font-size: 12px; background: var(--tm-chip); padding: 3px 7px; border-radius: 12px; vertical-align: middle; }
  .tm-comments-header p { margin: 5px 0 0; font-size: 12px; color: var(--tm-stone); overflow-wrap: anywhere; }
  .tm-comments-actions { display: flex; align-items: center; gap: 4px; }
  .tm-comments-header button { position: relative; width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 1px solid var(--tm-hairline); border-radius: 8px; color: inherit; background: #fff; cursor: pointer; transition: border-color var(--tm-motion-fast) ease, background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease; }
  .tm-comments-header button:hover { border-color: #8fb3a4; background: #fff; }
  .tm-comments-header button.is-active { border-color: var(--tm-forest); background: var(--tm-sage); color: var(--tm-forest); }
  .tm-comments-actions > button:last-child { border-color: transparent; background: transparent; }
  .tm-comments-filter-count { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; display: grid; place-items: center; border: 2px solid var(--tm-paper); border-radius: 999px; padding: 0 3px; background: var(--tm-forest); color: #fff; font-size: 9px; line-height: 1; }
  .tm-comments-search { padding: 0 18px; animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both; }
  .tm-comments-search input,
  .tm-comments-filters select { font: inherit; font-size: 12px; min-width: 0; width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--tm-hairline); background: #fff; color: var(--tm-ink); }
  .tm-comments-filter-anchor { position: relative; }
  .tm-comments-filter-menu {
    position: absolute;
    z-index: 5;
    top: calc(100% + 8px);
    right: 0;
    width: min(280px, calc(100vw - 96px));
    max-height: calc(100dvh - 180px);
    overflow: auto;
    overscroll-behavior: contain;
    padding: 6px;
    border: 1px solid var(--tm-line-strong);
    border-radius: 16px;
    background: var(--tm-surface);
    color: var(--tm-text-primary);
    color-scheme: dark;
    box-shadow: 0 14px 40px rgba(0,0,0,.3), 0 3px 8px rgba(0,0,0,.16);
    animation: tm-state-in var(--tm-motion-fast) var(--tm-ease-standard) both;
  }
  .tm-comments-header .tm-comments-filter-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: auto;
    min-height: 36px;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tm-text-primary);
    text-align: left;
    font-size: 13px;
    line-height: 1.4;
    font-weight: 500;
  }
  .tm-comments-header .tm-comments-filter-menu button:hover:not(:disabled) { background: var(--tm-overlay-subtle); }
  .tm-comments-filter-menu button:disabled { opacity: .45; cursor: not-allowed; }
  .tm-comments-filter-menu button svg { flex: none; }
  .tm-comments-filter-options button[aria-pressed="false"] svg { visibility: hidden; }
  .tm-comments-filter-more { margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--tm-line); }
  .tm-comments-filter-more button[aria-expanded="true"] svg { transform: rotate(180deg); }
  .tm-comments-filters { display: grid; gap: 10px; padding: 8px 10px 10px; }
  .tm-comments-filters label { display: grid; gap: 4px; color: var(--tm-text-soft); font-size: 11px; }
  .tm-comments-filter-menu .tm-comments-filters select { border-color: var(--tm-line-strong); padding: 8px; background: var(--tm-raised); color: var(--tm-text-primary); }
  .tm-comments-header .tm-comments-filter-menu .tm-comments-filter-reset { margin-top: 5px; border-top: 1px solid var(--tm-line); border-radius: 0 0 8px 8px; color: var(--tm-text-soft); }
  .tm-comments-count { padding: 0 18px; margin: 12px 0; font-size: 11px; color: var(--tm-stone); }
  .tm-comments-list { list-style: none; margin: 0; padding: 0 12px 12px; overflow: auto; overscroll-behavior: contain; min-height: 0; }
  .tm-comments-list li + li { border-top: 1px solid var(--tm-hairline); }
  .tm-comment-card { display: flex; flex-direction: column; gap: 10px; width: 100%; text-align: left; border: 0; border-radius: 11px; margin: 4px 0; padding: 12px; background: transparent; color: var(--tm-ink); cursor: pointer; transition: background-color var(--tm-motion-fast) ease; }
  .tm-comment-card:hover { background: #fff; }
  .tm-comments-panel :focus-visible, .tm-all-comments-trigger:focus-visible { outline: 2px solid var(--tm-forest); outline-offset: 2px; }
  .tm-comments-filter-menu :focus-visible { outline: 2px solid var(--tm-mint); outline-offset: -2px; }
  .tm-comment-author { display: flex; align-items: center; gap: 7px; width: 100%; font-size: 11px; }
  .tm-comment-author strong { flex: 1; overflow-wrap: anywhere; }
  .tm-comment-avatar { display: grid; place-items: center; width: 25px; height: 25px; border-radius: 50%; background: var(--tm-chip); font-size: 10px; flex-shrink: 0; }
  .tm-comment-author time { color: var(--tm-stone); white-space: nowrap; }
  .tm-comment-copy { font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .tm-comment-thumbnail { width: 100%; height: 88px; object-fit: cover; object-position: center; border-radius: 6px; background: var(--tm-chip); }
  .tm-comment-target { font-size: 11px; color: var(--tm-stone); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .tm-comment-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; color: var(--tm-stone); }
  .tm-comment-repair { display: inline-flex; align-items: center; gap: 4px; color: #b3362b; }
  .tm-comments-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 30px 24px; font-size: 13px; }
  .tm-comments-empty p { margin: 0; color: var(--tm-stone); line-height: 1.5; }
  .tm-comments-empty button { border: 1px solid var(--tm-hairline); color: var(--tm-ink); background: #fff; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
  @media (max-width: 600px) { .tm-comments-panel { top: 12px; right: 12px; bottom: 76px; } }
  .tm-panel-tabs { display: flex; gap: 4px; margin: 0 18px 4px; padding: 3px; border-radius: 10px; background: rgba(222, 221, 215, .55); }
  .tm-panel-tabs button { flex: 1; min-height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 8px; background: transparent; color: var(--tm-stone); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease; }
  .tm-panel-tabs button:hover { color: var(--tm-ink); }
  .tm-panel-tabs button[aria-selected="true"] { background: #fff; color: var(--tm-ink); box-shadow: 0 1px 2px #10281e1f; }
  .tm-panel-tabs span { font-size: 10px; font-variant-numeric: tabular-nums; color: var(--tm-stone); }
  /* Page versions reuse the dark popover rows; inside the light Feedback panel they take the panel's palette. */
  .tm-version-tab { display: flex; flex-direction: column; min-height: 0; flex: 1; padding-top: 8px; }
  .tm-comments-panel .tm-version-list { max-height: none; flex: 1; padding: 0 12px 12px; }
  .tm-comments-panel .tm-version-row { background: transparent; border: 0; }
  .tm-comments-panel .tm-version-row + .tm-version-row { border-top: 1px solid var(--tm-hairline); border-radius: 0; }
  .tm-comments-panel .tm-version-row:hover { background: #fff; }
  .tm-comments-panel .tm-version-row__title strong { color: var(--tm-ink); }
  .tm-comments-panel .tm-version-row__meta, .tm-comments-panel .tm-version-row time, .tm-comments-panel .tm-version-feedback { color: var(--tm-stone); }
  .tm-comments-panel .tm-version-open { background: var(--tm-sage); color: var(--tm-forest); }
  .tm-comments-panel .tm-version-open:hover { background: #cfe3da; }
  .tm-comments-panel .tm-version-state { background: var(--tm-chip); color: var(--tm-stone); }
  .tm-comments-panel .tm-version-state--current { background: var(--tm-sage); color: var(--tm-forest); }
  .tm-comments-panel .tm-version-state--failed, .tm-comments-panel .tm-version-state--unavailable { background: var(--tm-coral-tint); color: #b3362b; }
  .tm-comments-panel .tm-version-state--building { background: #fbf1dc; color: #8a5a12; }
  .tm-comments-panel .tm-version-panel__note { border-top: 1px solid var(--tm-hairline); padding: 10px 18px 14px; color: var(--tm-stone); font-size: 11px; line-height: 1.45; }

  /* Keep small text legible even when dark page content shows through the glass. */
  .tm-comments-header p,
  .tm-comments-count,
  .tm-comment-author time,
  .tm-comment-target,
  .tm-comment-meta,
  .tm-comments-empty p,
  .tm-panel-tabs button,
  .tm-panel-tabs span,
  .tm-comments-panel .tm-version-row__meta,
  .tm-comments-panel .tm-version-row time,
  .tm-comments-panel .tm-version-feedback,
  .tm-comments-panel .tm-version-panel__note { color: var(--tm-ink); }

  /* Without background blur, or when transparency is unwanted, use a solid surface. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .tm-comments-panel { background: var(--tm-paper); }
  }
  @media (prefers-reduced-transparency: reduce) {
    .tm-comments-panel { background: var(--tm-paper); -webkit-backdrop-filter: none; backdrop-filter: none; }
  }
  @media (forced-colors: active) {
    .tm-comments-panel { background: Canvas; color: CanvasText; border-color: CanvasText; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
  }

  .tm-workflow { display: flex; flex-direction: column; gap: 8px; color: var(--tm-text-primary); font-size: 11px; }
  .tm-workflow select, .tm-workflow button { min-height: 26px; background: transparent; border: 1px solid transparent; border-radius: 7px; color: var(--tm-text-soft); padding: 0 6px; max-width: none; font: inherit; font-weight: 600; cursor: pointer; transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease; }
  .tm-workflow select:hover, .tm-workflow button:hover { background: rgba(255,255,255,.07); color: var(--tm-text-primary); }
  .tm-workflow button { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .tm-workflow button .tm-tool-icon { width: 13px; height: 13px; }

  /* Saved-thread header: title with thread options, resolve, and close, divided from the discussion. */
  .tm-popover .tm-popover__header--thread { align-items: center; margin: 0 -8px; padding: 0 6px 8px 16px; border-bottom: 1px solid var(--tm-line); }
  .tm-popover .tm-popover__header--thread + .tm-form { gap: 14px; padding: 12px 8px 6px; }
  .tm-popover__header--thread h2 { margin: 0; color: var(--tm-text-primary); font-size: 13px; font-weight: 700; }
  .tm-thread-header-actions { display: flex; align-items: center; gap: 2px; }
  .tm-popover .tm-thread-header-actions button { width: 30px; height: 30px; border-radius: 8px; }
  .tm-thread-header-actions .tm-tool-icon { width: 17px; height: 17px; }
  .tm-popover .tm-thread-header-actions button.is-active { background: rgba(255,255,255,.08); color: #fff; }
  .tm-popover .tm-thread-header-actions button[aria-label="Reopen comment"] { color: var(--tm-mint); }


  /* Thread options open as a floating menu under the header's ⋯ button. */
  .tm-menu { position: absolute; z-index: 5; top: 44px; right: 8px; min-width: 212px; display: grid; gap: 1px; padding: 4px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: var(--tm-ground); box-shadow: 0 16px 40px rgba(0,0,0,.45); animation: tm-state-in var(--tm-motion-fast) var(--tm-ease-standard) both; }
  .tm-menu button { min-height: 32px; display: flex; align-items: center; gap: 9px; border: 0; border-radius: 8px; padding: 0 10px; background: transparent; color: var(--tm-text-primary); font: inherit; font-size: 12px; font-weight: 500; text-align: left; cursor: pointer; transition: background-color var(--tm-motion-fast) ease; }
  .tm-menu button:hover:not(:disabled), .tm-menu button:focus-visible { background: rgba(255,255,255,.08); }
  .tm-menu button:disabled { opacity: .45; cursor: not-allowed; }
  .tm-menu svg { flex: none; color: var(--tm-text-secondary); }

  /* Results of a thread option (comparison, activity) show as a small section above the discussion. */
  .tm-thread-panel { display: grid; gap: 6px; padding: 8px 10px 10px; border: 1px solid var(--tm-line); border-radius: 12px; background: var(--tm-raised); color: var(--tm-text-primary); font-size: 11px; animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both; }
  .tm-thread-panel p { margin: 0; font-size: 11px; line-height: 1.5; color: var(--tm-text-soft); }
  .tm-thread-panel__header { display: flex; align-items: center; gap: 4px; min-height: 26px; }
  .tm-thread-panel__header strong { margin-right: auto; font-size: 11.5px; font-weight: 700; }
  .tm-thread-panel__header button { min-height: 24px; display: inline-flex; align-items: center; gap: 4px; border: 0; border-radius: 7px; padding: 0 6px; background: transparent; color: var(--tm-text-secondary); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
  .tm-thread-panel__header button:hover { background: rgba(255,255,255,.08); color: #fff; }
  .tm-thread-panel > button { justify-self: start; min-height: 26px; border: 1px solid var(--tm-line); border-radius: 7px; padding: 0 8px; background: transparent; color: var(--tm-text-soft); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }

  /* Inline @mention suggestions float above the field being typed in. */
  .tm-reply__box, .tm-inline-edit, .tm-field { position: relative; }
  .tm-inline-edit { overflow: visible; }
  .tm-mention-list { position: absolute; z-index: 4; left: 8px; bottom: calc(100% + 6px); min-width: 180px; margin: 0; padding: 4px; list-style: none; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: var(--tm-ground); box-shadow: 0 12px 32px rgba(0,0,0,.4); animation: tm-state-in var(--tm-motion-fast) var(--tm-ease-standard) both; }
  .tm-mention-list li { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 8px; border-radius: 8px; color: var(--tm-text-primary); font-size: 12px; cursor: pointer; }
  .tm-mention-list li[aria-selected="true"], .tm-mention-list li:hover { background: rgba(92,196,154,.16); }
  .tm-mention-list__avatar { width: 20px; height: 20px; display: grid; place-items: center; overflow: hidden; border-radius: 50%; background: var(--tm-deep-sage); color: var(--tm-text-primary); font-size: 8px; font-weight: 700; }
  .tm-mention-list__avatar img { width: 100%; height: 100%; object-fit: cover; }

  /* Replies are written in a rounded field beside the reviewer's avatar, with a round send button inside it. */
  .tm-reply { display: grid; gap: 6px; }
  .tm-reply__row { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; align-items: center; }
  .tm-reply__box { display: flex; align-items: flex-end; gap: 6px; min-height: 40px; border: 1px solid transparent; border-radius: 14px; padding: 5px 5px 5px 12px; background: var(--tm-raised); transition: border-color var(--tm-motion-fast) ease; }
  .tm-reply__box:focus-within { border-color: var(--tm-mint); }
  .tm-reply__box textarea { flex: 1; min-width: 0; min-height: 28px; max-height: 8lh; field-sizing: content; resize: none; border: 0; padding: 5px 0; background: transparent; color: var(--tm-text-primary); font: inherit; font-size: 12.5px; line-height: 1.45; }
  .tm-reply__box textarea::placeholder { color: var(--tm-text-secondary); }
  .tm-popover .tm-reply__box textarea:focus,
  .tm-popover .tm-reply__box textarea:focus-visible { outline: none; }
  .tm-popover .tm-reply__send { width: 28px; height: 28px; min-height: 28px; flex: none; border-radius: 50%; padding: 0; }
  .tm-reply__send .tm-tool-icon { width: 15px; height: 15px; }
  .tm-popover .tm-reply__send:disabled { background: var(--tm-line-strong); color: var(--tm-ground); opacity: 1; }
  .tm-workflow details p { font-size: 11px; line-height: 1.5; color: var(--tm-text-soft); }

  /* Deployment comparison: its own view above the page, separate from the comment discussion. */
  .tm-compare-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(8, 12, 10, .55); animation: tm-state-in var(--tm-motion-standard) ease both; }
  .tm-compare { position: fixed; z-index: 61; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(960px, calc(100vw - 32px)); max-height: calc(100vh - 32px); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; border: 1px solid rgba(255,255,255,.1); border-radius: 18px; background: var(--tm-surface); color: var(--tm-text-primary); box-shadow: 0 30px 80px rgba(0,0,0,.5); font-family: var(--tm-font); }
  .tm-compare__header { display: flex; align-items: center; gap: 6px; padding: 14px 14px 14px 20px; border-bottom: 1px solid var(--tm-line); }
  .tm-compare__header > div { min-width: 0; margin-right: auto; }
  .tm-compare__header strong { display: block; font-size: 14px; }
  .tm-compare__header span { display: block; overflow: hidden; margin-top: 2px; color: var(--tm-text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .tm-compare__header button { min-height: 32px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 9px; padding: 0 10px; background: transparent; color: var(--tm-text-soft); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  .tm-compare__header button:hover:not(:disabled) { background: rgba(255,255,255,.08); color: #fff; }
  .tm-compare__header button:disabled { opacity: .45; cursor: not-allowed; }
  .tm-compare__images { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-height: 0; overflow: auto; padding: 18px 20px; }
  .tm-compare__images figure { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; min-width: 0; margin: 0; }
  .tm-compare__images figcaption { overflow: hidden; color: var(--tm-text-secondary); font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .tm-compare__images img, .tm-compare__empty { width: 100%; aspect-ratio: 16 / 10; box-sizing: border-box; border-radius: 10px; background: var(--tm-chip); object-fit: contain; }
  .tm-compare__empty { display: grid; place-items: center; margin: 0; padding: 12px; background: var(--tm-raised); color: var(--tm-text-secondary); font-size: 12px; text-align: center; }
  .tm-compare__footer { display: flex; align-items: center; gap: 8px; padding: 12px 14px 14px 20px; border-top: 1px solid var(--tm-line); }
  .tm-compare__footer p { margin: 0 auto 0 0; color: var(--tm-text-secondary); font-size: 11px; line-height: 1.45; }
  @media (max-width: 640px) {
    .tm-compare__images { grid-template-columns: 1fr; }
    .tm-compare__footer { flex-wrap: wrap; }
    .tm-compare__footer p { flex-basis: 100%; }
  }
  .tm-launcher {
    position: fixed;
    right: 20px;
    bottom: 20px;
    min-height: 44px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 10px;
    padding: 0 16px;
    background: var(--tm-forest);
    color: #fff;
    box-shadow: 0 12px 32px rgba(15, 34, 27, .24);
    cursor: pointer;
    font-family: var(--tm-font);
    font-size: 14px;
    font-weight: 600;
    animation: tm-launcher-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
    transition: background-color var(--tm-motion-fast) ease, transform var(--tm-motion-fast) var(--tm-ease-standard), box-shadow var(--tm-motion-standard) ease;
  }

  .tm-launcher__count {
    position: absolute;
    top: -6px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    padding: 0 5px;
    border: 2px solid var(--tm-paper);
    border-radius: 999px;
    background: var(--tm-coral);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .tm-launcher:hover { background: var(--tm-forest-hover); transform: translateY(-1px); }
  .tm-launcher:active { transform: translateY(0) scale(.98); }
  .tm-launcher:focus-visible,
  .tm-popover button:focus-visible,
  .tm-popover textarea:focus-visible {
    outline: 3px solid var(--tm-focus);
    outline-offset: 2px;
  }

  .tm-modebar {
    position: fixed;
    right: 20px;
    bottom: 22px;
    display: flex;
    align-items: center;
    z-index: 30;
    gap: 3px;
    min-height: 46px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 14px;
    padding: 5px;
    background: var(--tm-surface);
    color: #fff;
    box-shadow: 0 12px 36px rgba(0,0,0,.3);
    font-size: 13px;
    user-select: none;
    animation: tm-toolbar-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }

  .tm-modebar button {
    width: 34px;
    height: 34px;
    min-height: 34px;
    display: inline-grid;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 9px;
    padding: 0;
    background: transparent;
    color: var(--tm-text-primary);
    cursor: pointer;
    font-weight: 700;
    transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease, opacity var(--tm-motion-fast) ease, transform var(--tm-motion-fast) var(--tm-ease-standard);
  }

  .tm-modebar button:hover { background: rgba(255,255,255,.1); transform: translateY(-1px); }
  .tm-modebar button:active { transform: translateY(0) scale(.94); }
  .tm-modebar button:focus-visible {
    outline: 3px solid var(--tm-focus);
    outline-offset: 2px;
  }
  .tm-modebar button:disabled { cursor: not-allowed; opacity: .4; }

  .tm-carry-forward__header button {
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
  }
  .tm-carry-forward__header button:hover { background: rgba(255,255,255,.08); color: #fff; }

  .tm-version-list {
    max-height: min(430px, calc(100vh - 180px));
    overflow-y: auto;
    padding: 6px;
  }
  .tm-version-row {
    min-height: 72px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    border-radius: 10px;
    padding: 9px;
    transition: background-color var(--tm-motion-fast) ease;
  }
  .tm-version-row + .tm-version-row { border-top: 1px solid rgba(255,255,255,.055); }
  .tm-version-row:hover { background: rgba(255,255,255,.045); }
  .tm-version-row__body { min-width: 0; }
  .tm-version-row__title { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .tm-version-row__title strong {
    overflow: hidden;
    font-size: 11px;
    line-height: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-version-row__meta,
  .tm-version-row time {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    overflow: hidden;
    color: var(--tm-text-secondary);
    font-family: var(--tm-font-mono);
    font-size: 9px;
    line-height: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-version-row__meta .tm-tool-icon { width: 11px; height: 11px; }
  .tm-version-row__actions { display: flex; align-items: center; gap: 6px; }
  .tm-version-feedback {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--tm-text-secondary);
    font-size: 10px;
    font-weight: 700;
  }
  .tm-version-feedback .tm-tool-icon { width: 12px; height: 12px; }
  .tm-version-open {
    height: 30px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 0;
    border-radius: 8px;
    padding: 0 9px;
    background: rgba(255,255,255,.09);
    color: var(--tm-text-primary);
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
  }
  .tm-version-open:hover { background: rgba(255,255,255,.15); }
  .tm-version-open .tm-tool-icon { width: 12px; height: 12px; }
  .tm-version-state {
    flex: 0 0 auto;
    border-radius: 999px;
    padding: 2px 6px;
    color: var(--tm-text-soft);
    background: rgba(255,255,255,.08);
    font-size: 8px;
    font-weight: 700;
    line-height: 12px;
    text-transform: capitalize;
  }
  .tm-version-state--current { color: var(--tm-mint); background: rgba(92,196,154,.14); }
  .tm-version-state--failed,
  .tm-version-state--unavailable { color: var(--tm-coral-dark); background: rgba(255,138,120,.12); }
  .tm-version-state--building { color: #f2cc8c; background: rgba(255,184,76,.12); }
  .tm-version-panel__note {
    margin: 0;
    border-top: 1px solid var(--tm-line);
    padding: 8px 12px 10px;
    color: var(--tm-text-secondary);
    font-size: 9px;
    line-height: 13px;
  }

  .tm-tool-group {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .tm-tool-group button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .tm-tool-icon {
    width: 17px;
    height: 17px;
    flex: 0 0 auto;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tm-tool-group button.is-active {
    background: var(--tm-mint);
    color: var(--tm-ground);
  }

  .tm-modebar .tm-button--primary {
    width: auto;
    min-width: 88px;
    padding-inline: 12px;
    background: var(--tm-mint);
    color: var(--tm-ground);
  }

  .tm-drag-handle {
    width: 24px !important;
    cursor: grab !important;
    color: var(--tm-text-secondary) !important;
    touch-action: none;
  }
  .tm-drag-handle:active { cursor: grabbing !important; }

  .tm-toolbar-divider {
    width: 1px;
    height: 23px;
    margin-inline: 2px;
    background: rgba(255,255,255,.13);
  }

  .tm-all-comments-trigger { position: relative; }
  .tm-count-badge {
    position: absolute;
    top: -4px;
    right: -5px;
    min-width: 17px;
    height: 17px;
    display: grid;
    place-items: center;
    padding: 0 4px;
    border: 2px solid var(--tm-surface);
    border-radius: 999px;
    background: var(--tm-coral);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .tm-gesture-hint {
    position: fixed;
    right: 20px;
    bottom: 79px;
    z-index: 29;
    max-width: min(300px, calc(100vw - 40px));
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 999px;
    padding: 7px 11px;
    background: rgba(26,31,28,.94);
    color: var(--tm-text-primary);
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    font-size: 11px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  .tm-outline {
    position: fixed;
    z-index: 20;
    border: 2px solid var(--tm-coral);
    border-radius: 3px;
    box-shadow: 0 0 0 1px rgba(255,255,255,.85), 0 4px 18px rgba(229,72,60,.18);
    pointer-events: none;
  }

  .tm-outline--hover {
    border-color: var(--tm-forest);
    box-shadow: 0 0 0 1px rgba(255,255,255,.9), 0 4px 18px rgba(11,79,58,.2);
  }

  .tm-outline--region {
    border-style: dashed;
    background: rgba(229,72,60,.06);
  }

  .tm-outline--grouped {
    border-color: var(--tm-forest);
    box-shadow: 0 0 0 1px rgba(255,255,255,.85), 0 4px 18px rgba(11,79,58,.2);
  }

  /* A suggested new home awaiting confirmation, and a removed element's last known position. */
  .tm-outline--suggested {
    border-style: dashed;
    border-color: var(--tm-annotation-warning);
    box-shadow: 0 0 0 1px rgba(255,255,255,.85);
  }
  .tm-outline--ghost {
    border-style: dashed;
    border-color: rgba(120, 120, 120, .7);
    background: rgba(120, 120, 120, .06);
    box-shadow: none;
  }

  .tm-outline--text {
    border-style: dashed;
    background: rgba(229,72,60, .055);
  }

  .tm-badge {
    position: absolute;
    right: -15px;
    top: 50%;
    width: 30px;
    height: 30px;
    transform: translate(100%, -50%);
    display: grid;
    place-items: center;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--tm-coral);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
  }

  .tm-outline--grouped .tm-badge { background: var(--tm-forest); }

  .tm-marker {
    position: fixed;
    z-index: 26;
    width: 28px;
    height: 28px;
    transform: translate(-4px, -50%);
    display: grid;
    place-items: center;
    border: 2px solid #fff;
    border-radius: 50%;
    padding: 0;
    background: var(--tm-coral);
    color: #fff;
    box-shadow: 0 4px 15px rgba(27, 35, 31, .28);
    cursor: pointer;
    font: 700 12px/1 var(--tm-font);
    animation: tm-marker-in var(--tm-motion-standard) var(--tm-ease-emphasized) both;
    transition: transform var(--tm-motion-fast) var(--tm-ease-standard), background-color var(--tm-motion-standard) ease, border-radius var(--tm-motion-standard) var(--tm-ease-standard), box-shadow var(--tm-motion-standard) ease;
  }

  .tm-marker:hover { transform: translate(-4px, -50%) scale(1.08); }
  .tm-marker--grouped {
    border-radius: 8px;
    background: var(--tm-forest);
  }
  .tm-marker--warning {
    background: var(--tm-annotation-warning);
    box-shadow: 0 0 0 3px var(--tm-orange-24), 0 4px 15px rgba(27, 35, 31, .28);
  }
  .tm-marker--suggested {
    border-style: dashed;
  }
  .tm-marker--ghost {
    opacity: .62;
    background: #7c837f;
    box-shadow: 0 0 0 3px rgba(124, 131, 127, .24);
  }
  .tm-marker--ghost:hover { opacity: 1; }
  .tm-marker:focus-visible {
    outline: 3px solid var(--tm-focus);
    outline-offset: 2px;
  }

  .tm-dismiss-layer {
    position: fixed;
    inset: 0;
    z-index: 35;
    background: transparent;
  }

  .tm-popover {
    position: fixed;
    z-index: 40;
    width: min(360px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 18px;
    padding: 8px;
    background: var(--tm-surface);
    color: var(--tm-text-primary);
    box-shadow: 0 22px 60px rgba(0,0,0,.38), 0 4px 16px rgba(0,0,0,.22);
    overscroll-behavior: contain;
    transform-origin: 50% 0;
    animation: tm-popover-in-below var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }

  .tm-popover[data-placement="above"] {
    transform-origin: 50% 100%;
    animation-name: tm-popover-in-above;
  }

  .tm-popover__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    overflow: hidden;
    padding: 0 4px;
  }

  .tm-context-disclosure {
    min-width: 0;
    flex: 1;
  }

  .tm-context-disclosure summary {
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    border-radius: 8px;
    padding: 0;
    color: var(--tm-text-soft);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    list-style: none;
  }

  .tm-context-disclosure summary::-webkit-details-marker { display: none; }
  .tm-context-disclosure summary:hover { background: rgba(255,255,255,.06); color: var(--tm-text-primary); }
  .tm-context-disclosure summary:focus-visible {
    outline: 3px solid var(--tm-focus);
    outline-offset: 1px;
  }

  .tm-disclosure-icon {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    transition: transform 140ms ease;
  }

  .tm-context-disclosure[open] .tm-disclosure-icon { transform: rotate(180deg); }

  .tm-context-disclosure__content {
    min-width: 0;
    padding: 6px 0 11px 20px;
  }

  .tm-context-disclosure__content strong {
    display: block;
    overflow: hidden;
    color: var(--tm-text-primary);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tm-context-tag {
    display: block;
    margin-top: 2px;
    color: var(--tm-text-secondary);
    font-family: var(--tm-font-mono);
    font-size: 10px;
    letter-spacing: .01em;
  }

  .tm-popover__header button {
    width: 24px;
    height: 24px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
  }
  .tm-popover__header button:hover { background: rgba(255,255,255,.08); color: #fff; }
  .tm-close-icon {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tm-form {
    display: grid;
    gap: 11px;
    padding: 0;
  }

  .tm-thread {
    display: grid;
    gap: 14px;
    padding: 2px 0;
  }

  .tm-thread-message {
    position: relative;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 10px;
  }

  .tm-thread-message--reply {
    animation: tm-message-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }

  .tm-thread-message__avatar {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 50%;
    background: var(--tm-deep-sage);
    color: var(--tm-text-primary);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .02em;
  }

  .tm-thread-message__avatar img { width: 100%; height: 100%; object-fit: cover; }
  .tm-thread-message__body { min-width: 0; }

  .tm-thread-message__meta {
    min-height: 24px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tm-thread-message__meta strong {
    overflow: hidden;
    color: var(--tm-text-primary);
    font-size: 12px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tm-thread-message__meta time {
    flex: none;
    color: var(--tm-text-secondary);
    font-size: 11px;
  }

  .tm-thread-message__you {
    border-radius: 999px;
    padding: 1px 5px;
    background: var(--tm-deep-sage);
    color: var(--tm-mint);
    font-size: 9px;
    font-weight: 700;
  }

  .tm-thread-message p {
    margin: 2px 0 0;
    color: var(--tm-text-soft);
    font-size: 12.5px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  /* The per-message menu toggle stays out of the way until the reviewer points at or tabs into a message. Touch screens always show it. */
  .tm-popover .tm-thread-message__menu-toggle {
    width: 26px;
    height: 24px;
    flex: none;
    display: grid;
    place-items: center;
    margin-left: auto;
    border: 0;
    border-radius: 7px;
    padding: 0;
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--tm-motion-fast) ease, background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease;
  }
  .tm-thread-message__menu-toggle .tm-tool-icon { width: 16px; height: 16px; }
  .tm-thread-message:hover .tm-thread-message__menu-toggle,
  .tm-thread-message:focus-within .tm-thread-message__menu-toggle,
  .tm-thread-message.has-menu .tm-thread-message__menu-toggle { opacity: 1; }
  .tm-popover .tm-thread-message__menu-toggle:hover,
  .tm-popover .tm-thread-message__menu-toggle[aria-expanded="true"] { background: rgba(92,196,154,.16); color: var(--tm-mint); }
  @media (hover: none) {
    .tm-popover .tm-thread-message__menu-toggle { opacity: 1; }
  }

  .tm-thread-message__actions {
    position: absolute;
    z-index: 3;
    top: 28px;
    right: 0;
    min-width: 132px;
    display: grid;
    gap: 1px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px;
    padding: 4px;
    background: var(--tm-ground);
    box-shadow: 0 12px 32px rgba(0,0,0,.4);
    animation: tm-state-in var(--tm-motion-fast) var(--tm-ease-standard) both;
  }
  .tm-thread-message__actions[hidden] { display: none; }
  .tm-thread-message__actions button {
    min-height: 30px;
    border: 0;
    border-radius: 8px;
    padding: 0 10px;
    background: transparent;
    color: var(--tm-text-primary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    transition: background-color var(--tm-motion-fast) ease;
  }
  .tm-thread-message__actions button:hover { background: rgba(255,255,255,.08); }
  .tm-thread-message__actions .tm-thread-message__delete { color: var(--tm-coral-dark); }

  /* Editing swaps the message for one outlined box that holds the text and its own Cancel and Save. */
  .tm-inline-edit {
    display: grid;
    border: 1px solid var(--tm-mint);
    border-radius: 12px;
    background: var(--tm-raised);
    overflow: hidden;
  }
  .tm-inline-edit textarea {
    width: 100%;
    min-height: 3lh;
    field-sizing: content;
    resize: none;
    box-sizing: border-box;
    border: 0;
    padding: 10px 12px;
    background: transparent;
    color: var(--tm-text-primary);
    font: inherit;
    font-size: 12.5px;
    line-height: 1.5;
  }
  .tm-popover .tm-inline-edit textarea:focus,
  .tm-popover .tm-inline-edit textarea:focus-visible { outline: none; }
  .tm-inline-edit__actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    border-top: 1px solid var(--tm-line);
    padding: 7px 8px;
  }
  .tm-inline-edit__actions .tm-cancel,
  .tm-inline-edit__actions .tm-submit { height: 28px; min-height: 28px; border-radius: 8px; padding: 0 11px; font-size: 11px; }
  .tm-inline-edit__actions .tm-cancel { border: 1px solid var(--tm-line-strong); }

  .tm-composer-mode {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 2px;
    color: var(--tm-text-secondary);
    font-size: 10px;
    font-weight: 600;
  }

  .tm-composer-mode button {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--tm-mint);
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
  }

  .tm-field {
    display: grid;
    gap: 6px;
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }

  .tm-field label,
  .tm-field__label {
    color: var(--tm-text-soft);
    font-size: 12px;
    font-weight: 600;
  }

  .tm-field textarea {
    width: 100%;
    border: 1px solid var(--tm-line);
    border-radius: var(--tm-radius-9);
    background: var(--tm-raised);
    color: var(--tm-text-primary);
    padding: 11px 12px;
    font-size: 14px;
    line-height: 1.45;
  }

  .tm-field textarea::placeholder { color: var(--tm-text-secondary); }
  .tm-field textarea:hover { border-color: var(--tm-line-strong); }
  .tm-field textarea:focus {
    border: 2px solid var(--tm-mint);
    outline: 0;
  }

  .tm-field textarea {
    min-height: 84px;
    max-height: 220px;
    resize: vertical;
  }

  .tm-field__limit {
    justify-self: end;
    color: var(--tm-text-secondary);
    font-size: 10px;
    line-height: 1.2;
  }

  .tm-draft-region {
    position: fixed;
    z-index: 24;
    border: 2px dashed var(--tm-coral);
    border-radius: 4px;
    background: rgba(229, 72, 60, .08);
    box-shadow: 0 0 0 1px rgba(255,255,255,.85);
    pointer-events: none;
  }

  .tm-draft-region span {
    position: absolute;
    right: 0;
    bottom: -29px;
    padding: 4px 7px;
    border-radius: 5px;
    background: var(--tm-ink);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
  }

  .tm-snapshot {
    overflow: hidden;
    border: 1px solid var(--tm-line);
    border-radius: 12px;
    background: var(--tm-raised);
  }

  .tm-snapshot__open { display: block; cursor: zoom-in; }
  .tm-snapshot__open img { transition: opacity var(--tm-motion-fast) ease; }
  .tm-snapshot__open:hover img { opacity: .88; }
  .tm-snapshot img {
    width: 100%;
    max-height: 150px;
    display: block;
    object-fit: contain;
    background: var(--tm-ground);
  }

  .tm-snapshot__approval {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 10px 11px 12px;
    border-top: 1px solid var(--tm-line);
    color: var(--tm-text-soft);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
  }

  .tm-snapshot__approval input {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    margin: 0;
    accent-color: var(--tm-mint);
  }

  .tm-snapshot__state {
    min-height: 116px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 18px;
    border-top: 1px solid var(--tm-line);
    background: var(--tm-raised);
    color: var(--tm-text-secondary);
    font-size: 12px;
    text-align: center;
  }

  .tm-snapshot__state--error {
    flex-direction: column;
    color: var(--tm-coral-dark);
  }

  .tm-snapshot__state button {
    height: var(--tm-size-action);
    border: 0;
    border-radius: var(--tm-radius-9);
    padding: 0 14px;
    background: var(--tm-overlay-subtle);
    color: var(--tm-text-primary);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }

  .tm-snapshot__state button:hover { background: rgba(255,255,255,.14); }

  .tm-interaction-recorder {
    position: fixed;
    z-index: 46;
    left: 50%;
    bottom: 24px;
    min-width: min(620px, calc(100vw - 24px));
    display: flex;
    align-items: center;
    gap: 11px;
    transform: translateX(-50%);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 13px;
    padding: 9px 10px 9px 12px;
    background: rgba(26,31,28,.97);
    color: var(--tm-text-primary);
    box-shadow: 0 16px 50px rgba(0,0,0,.32);
    backdrop-filter: blur(14px);
    animation: tm-recorder-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }

  .tm-recording-dot {
    width: 9px;
    height: 9px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--tm-coral-dark);
    box-shadow: 0 0 0 4px rgba(255,138,120,.14);
  }

  .tm-interaction-recorder__copy {
    min-width: 0;
    flex: 1;
  }
  .tm-interaction-recorder__copy strong,
  .tm-interaction-recorder__copy span { display: block; }
  .tm-interaction-recorder__copy strong { font-size: 12px; line-height: 16px; }
  .tm-interaction-recorder__copy span {
    margin-top: 1px;
    overflow: hidden;
    color: var(--tm-text-muted);
    font-size: 10px;
    line-height: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-interaction-recorder__count {
    color: var(--tm-text-soft);
    font-family: var(--tm-font-mono);
    font-size: 10px;
    white-space: nowrap;
  }
  .tm-recording-stop {
    height: var(--tm-size-action);
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 0;
    border-radius: var(--tm-radius-9);
    padding: 0 13px;
    background: var(--tm-coral-dark);
    color: var(--tm-ground);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    transition: background-color var(--tm-motion-fast) ease, transform var(--tm-motion-fast) var(--tm-ease-standard);
  }
  .tm-recording-stop:hover { background: #ffa090; }
  .tm-recording-stop:active { transform: scale(.97); }
  .tm-recording-stop .tm-tool-icon { width: 12px; height: 12px; fill: currentColor; }

  .tm-interaction-preview {
    overflow: hidden;
    border: 1px solid var(--tm-line);
    border-radius: 11px;
    background: var(--tm-raised);
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-interaction-preview__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 11px;
    border-bottom: 1px solid var(--tm-line);
  }
  .tm-interaction-preview__header strong,
  .tm-interaction-preview__header span { display: block; }
  .tm-interaction-preview__header strong { color: var(--tm-text-primary); font-size: 11px; line-height: 15px; }
  .tm-interaction-preview__header span { margin-top: 1px; color: var(--tm-text-secondary); font-size: 9px; line-height: 13px; }
  .tm-interaction-preview__header button {
    height: 30px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 8px;
    padding: 0 10px;
    background: rgba(255,255,255,.08);
    color: var(--tm-text-primary);
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
  }
  .tm-interaction-preview__header button:hover:not(:disabled) { background: rgba(255,255,255,.14); }
  .tm-interaction-preview__header button:disabled { cursor: not-allowed; opacity: .45; }
  .tm-interaction-preview__header .tm-tool-icon { width: 13px; height: 13px; }
  .tm-interaction-events {
    max-height: 164px;
    display: grid;
    gap: 2px;
    overflow-y: auto;
    margin: 0;
    padding: 7px;
    list-style: none;
  }
  .tm-interaction-events li {
    min-height: 30px;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    border-radius: 7px;
    padding: 3px 6px 3px 3px;
    color: var(--tm-text-soft);
    font-size: 10px;
    transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease;
  }
  .tm-interaction-events li.is-active { background: rgba(92,196,154,.16); color: var(--tm-text-primary); }
  .tm-interaction-event__index {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border: 1px solid var(--tm-line-strong);
    border-radius: 6px;
    color: var(--tm-text-secondary);
    font-family: var(--tm-font-mono);
    font-size: 9px;
  }
  .tm-interaction-event__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tm-interaction-events time {
    color: var(--tm-text-secondary);
    font-family: var(--tm-font-mono);
    font-size: 9px;
  }
  .tm-interaction-privacy {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 8px 10px;
    border-top: 1px solid var(--tm-line);
    color: var(--tm-text-secondary);
    font-size: 9px;
    line-height: 13px;
  }
  .tm-interaction-privacy .tm-tool-icon { width: 13px; height: 13px; color: var(--tm-mint); }

  .tm-spinner {
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255,255,255,.18);
    border-top-color: var(--tm-mint);
    border-radius: 50%;
    animation: tm-spin .75s linear infinite;
  }

  @keyframes tm-spin { to { transform: rotate(360deg); } }

  @keyframes tm-launcher-in {
    from { opacity: 0; transform: translateY(8px) scale(.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes tm-toolbar-in {
    from { opacity: 0; transform: translateY(8px) scale(.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes tm-recorder-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.98); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  @keyframes tm-marker-in {
    from { opacity: 0; transform: translate(-4px, -50%) scale(.78); }
    to { opacity: 1; transform: translate(-4px, -50%) scale(1); }
  }

  @keyframes tm-popover-in-below {
    from { opacity: 0; transform: translateY(-6px) scale(.975); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes tm-popover-in-above {
    from { opacity: 0; transform: translateY(6px) scale(.975); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes tm-message-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes tm-state-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes tm-danger-in {
    from { opacity: 0; transform: translateY(4px) scale(.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .tm-form__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 7px;
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }

  .tm-form__footer {
    min-width: 0;
  }

  /* Saved threads use inline actions; an empty footer must not add a grid gap below Reply. */
  .tm-form__footer:empty { display: none; }

  .tm-form__footer .tm-form__actions {
    align-self: flex-end;
    margin-left: auto;
  }

  .tm-delete-confirm {
    min-height: 82px;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto auto;
    align-items: start;
    gap: 8px;
    border: 1px solid rgba(255,138,120,.28);
    border-radius: 11px;
    padding: 8px;
    background: var(--tm-ember);
    transform-origin: 50% 100%;
    animation: tm-danger-in var(--tm-motion-standard) var(--tm-ease-emphasized) both;
  }

  .tm-delete-confirm > .tm-tool-icon { margin-top: 1px; color: var(--tm-coral-dark); }
  .tm-delete-confirm__impact { min-width: 0; grid-column: 2 / -1; }
  .tm-delete-confirm__impact strong,
  .tm-delete-confirm__impact span { display: block; }
  .tm-delete-confirm__impact strong { color: #ffe9e5; font-size: 11px; line-height: 15px; }
  .tm-delete-confirm__impact span { margin-top: 1px; color: #d9b3ac; font-size: 9px; line-height: 13px; }

  .tm-delete-final {
    height: var(--tm-size-action);
    border: 0;
    border-radius: var(--tm-radius-9);
    padding: 0 12px;
    background: var(--tm-coral-dark);
    color: var(--tm-ground);
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    transition: background-color var(--tm-motion-fast) ease, transform var(--tm-motion-fast) var(--tm-ease-standard), opacity var(--tm-motion-fast) ease;
  }
  .tm-delete-confirm > .tm-cancel { grid-column: 3; }
  .tm-delete-confirm > .tm-delete-final { grid-column: 4; }
  .tm-delete-final:hover:not(:disabled) { background: #ffa090; }
  .tm-delete-final:active:not(:disabled) { transform: scale(.97); }
  .tm-delete-final:disabled { cursor: not-allowed; opacity: .5; }

  .tm-repair-state {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    align-items: start;
    gap: 9px;
    margin: 0 0 12px;
    border: 1px solid rgba(255, 184, 76, .26);
    border-radius: 10px;
    padding: 10px;
    background: var(--tm-annotation-warning-tint);
    color: #f7d8aa;
  }
  .tm-repair-state .tm-tool-icon { margin-top: 1px; color: #ffb84c; }
  .tm-repair-state strong {
    display: block;
    color: #fff2df;
    font-size: 12px;
    line-height: 16px;
  }
  .tm-repair-state span {
    display: block;
    margin-top: 2px;
    color: #cbb9a2;
    font-size: 11px;
    line-height: 15px;
  }
  .tm-repair-actions {
    display: grid;
    gap: 6px;
  }
  .tm-repair-state button,
  .tm-link-action {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    border-radius: 8px;
    padding: 0 9px;
    background: rgba(255,255,255,.08);
    color: var(--tm-text-primary);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
  }
  .tm-repair-state button:hover,
  .tm-link-action:hover:not(:disabled) { background: rgba(255,255,255,.14); }
  .tm-link-action { margin-right: auto; }
  .tm-link-action .tm-tool-icon { width: 14px; height: 14px; }

  .tm-form__secondary-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin-right: auto;
  }
  .tm-form__secondary-actions .tm-link-action { margin-right: 0; }

  .tm-carry-forward {
    overflow: hidden;
    border: 1px solid var(--tm-line);
    border-radius: 11px;
    background: var(--tm-raised);
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-carry-forward__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 9px 8px 11px;
    border-bottom: 1px solid var(--tm-line);
  }
  .tm-carry-forward__header strong,
  .tm-carry-forward__header span { display: block; }
  .tm-carry-forward__header strong { color: var(--tm-text-primary); font-size: 11px; line-height: 15px; }
  .tm-carry-forward__header span { margin-top: 1px; color: var(--tm-text-secondary); font-size: 9px; line-height: 13px; }
  .tm-carry-forward__list {
    max-height: 168px;
    display: grid;
    gap: 2px;
    overflow-y: auto;
    padding: 5px;
  }
  .tm-carry-forward__list > button {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border: 0;
    border-radius: 8px;
    padding: 6px 8px;
    background: transparent;
    color: var(--tm-text-primary);
    cursor: pointer;
    text-align: left;
  }
  .tm-carry-forward__list > button:hover:not(:disabled) { background: rgba(255,255,255,.07); }
  .tm-carry-forward__list > button:disabled { cursor: wait; opacity: .55; }
  .tm-carry-forward__list > button > span:first-child { min-width: 0; }
  .tm-carry-forward__list strong,
  .tm-carry-forward__list small { display: block; }
  .tm-carry-forward__list strong {
    overflow: hidden;
    font-size: 10px;
    line-height: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-carry-forward__list small {
    margin-top: 1px;
    overflow: hidden;
    color: var(--tm-text-secondary);
    font-family: var(--tm-font-mono);
    font-size: 8px;
    line-height: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-carry-forward__list > button > span:last-child {
    flex: 0 0 auto;
    color: var(--tm-mint);
    font-size: 9px;
    font-weight: 700;
  }

  .tm-cancel,
  .tm-submit,
  .tm-capture-instruction button,
  .tm-markup-cancel,
  .tm-markup-confirm {
    height: var(--tm-size-action);
    min-height: var(--tm-size-action);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--tm-radius-9);
    padding: 0 14px;
    cursor: pointer;
    font-family: var(--tm-font);
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
    white-space: nowrap;
    transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease, opacity var(--tm-motion-fast) ease, transform var(--tm-motion-fast) var(--tm-ease-standard);
  }

  .tm-cancel {
    background: transparent;
    color: var(--tm-text-secondary);
  }
  .tm-cancel:hover:not(:disabled) { background: var(--tm-overlay-subtle); color: var(--tm-text-primary); }
  .tm-cancel:active:not(:disabled),
  .tm-submit:active:not(:disabled),
  .tm-markup-cancel:active:not(:disabled),
  .tm-markup-confirm:active:not(:disabled) { transform: scale(.97); }

  .tm-submit {
    background: var(--tm-action-primary);
    color: var(--tm-text-inverse);
  }
  .tm-submit:hover:not(:disabled) { background: var(--tm-action-primary-hover); }

  .tm-submit:disabled,
  .tm-markup-confirm:disabled {
    cursor: not-allowed;
    opacity: .45;
  }

  .tm-cancel:disabled,
  .tm-markup-cancel:disabled {
    cursor: not-allowed;
    opacity: .4;
  }

  .tm-capture-surface {
    position: fixed;
    inset: 0;
    z-index: 60;
    overflow: hidden;
    background: rgba(8, 10, 9, .2);
    cursor: crosshair;
    touch-action: none;
    user-select: none;
    overscroll-behavior: contain;
  }

  .tm-capture-instruction {
    position: fixed;
    left: 50%;
    top: 20px;
    z-index: 3;
    width: min(680px, calc(100vw - 24px));
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    transform: translateX(-50%);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 14px;
    padding: 9px 9px 9px 14px;
    background: var(--tm-surface);
    color: var(--tm-text-primary);
    box-shadow: 0 18px 50px rgba(0,0,0,.4);
    cursor: default;
  }

  .tm-capture-instruction__copy {
    min-width: 170px;
    flex: 1 1 auto;
  }

  .tm-capture-instruction__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }

  .tm-capture-instruction strong,
  .tm-capture-instruction span { display: block; }
  .tm-capture-instruction strong {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -.01em;
  }
  .tm-capture-instruction span {
    margin-top: 2px;
    color: var(--tm-text-secondary);
    font-size: 11px;
  }
  .tm-capture-instruction button {
    flex: 0 0 auto;
    gap: 6px;
    background: transparent;
    color: var(--tm-text-secondary);
  }
  .tm-capture-instruction button:hover {
    background: var(--tm-overlay-subtle);
    color: var(--tm-text-primary);
  }
  .tm-capture-instruction button:focus-visible {
    outline: 3px solid var(--tm-focus);
    outline-offset: 2px;
  }

  .tm-capture-selection {
    position: fixed;
    z-index: 2;
    border: 2px solid var(--tm-mint);
    background: rgba(92,196,154,.08);
    box-shadow: 0 0 0 9999px rgba(8, 10, 9, .58);
    pointer-events: none;
    animation: tm-scrim-in var(--tm-motion-standard) ease both;
  }

  .tm-capture-selection > span {
    position: absolute;
    right: -2px;
    bottom: -28px;
    min-height: 24px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    padding: 0 7px;
    background: var(--tm-mint);
    color: var(--tm-ground);
    font-size: 10px;
    font-weight: 700;
    pointer-events: none;
  }

  .tm-capture-error {
    position: fixed;
    left: 50%;
    bottom: 22px;
    z-index: 3;
    transform: translateX(-50%);
    border-radius: 999px;
    padding: 8px 12px;
    background: var(--tm-surface);
    color: var(--tm-coral-dark);
    box-shadow: 0 10px 30px rgba(0,0,0,.3);
    font-size: 11px;
  }

  @media (max-width: 760px) {
    .tm-capture-instruction {
      left: 50%;
      right: auto;
      width: min(390px, calc(100vw - 24px));
      align-items: flex-start;
      flex-wrap: wrap;
      transform: translateX(-50%);
    }

    .tm-capture-instruction__copy {
      min-width: 100%;
    }

    .tm-capture-instruction__actions {
      width: 100%;
      overflow-x: auto;
    }

  }

  .tm-markup-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    overflow: hidden;
    color: var(--tm-text-primary);
    overscroll-behavior: contain;
    touch-action: none;
  }

  .tm-markup-dock {
    position: fixed;
    z-index: 3;
    left: 50%;
    bottom: 18px;
    width: max-content;
    max-width: calc(100vw - 24px);
    min-height: 54px;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    transform: translateX(-50%);
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 14px;
    padding: 6px;
    background: var(--tm-surface);
    box-shadow: 0 18px 42px rgba(0,0,0,.38), 0 4px 12px rgba(0,0,0,.22);
    scrollbar-width: none;
  }

  .tm-markup-dock::-webkit-scrollbar { display: none; }

  .tm-markup-dock__context {
    min-width: 88px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 8px;
    white-space: nowrap;
  }

  .tm-markup-dock__context strong {
    color: var(--tm-text-primary);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -.01em;
  }

  .tm-markup-dock__context span {
    margin-top: 2px;
    color: var(--tm-text-secondary);
    font-size: 10px;
  }

  .tm-markup-tools {
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }

  .tm-markup-tools__label {
    margin-right: 2px;
    color: var(--tm-text-secondary);
    font-size: 11px;
    font-weight: 600;
  }

  .tm-color-tools {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .tm-color-tools button {
    width: 29px;
    height: 29px;
    display: grid;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0;
    background: transparent;
    cursor: pointer;
  }

  .tm-color-tools button:hover { background: rgba(255,255,255,.08); }
  .tm-color-tools button.is-selected {
    border-color: rgba(255,255,255,.42);
    background: rgba(255,255,255,.11);
  }

  .tm-color-tools button > span {
    width: 15px;
    height: 15px;
    display: block;
    border: 2px solid rgba(255,255,255,.5);
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,.35);
  }

  .tm-markup-divider {
    width: 1px;
    height: 24px;
    margin-inline: 2px;
    background: rgba(255,255,255,.11);
  }

  .tm-size-tools {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .tm-size-tools button {
    width: 29px;
    height: 29px;
    display: grid;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0;
    background: transparent;
    cursor: pointer;
  }
  .tm-size-tools button:hover { background: rgba(255,255,255,.08); }
  .tm-size-tools button.is-selected {
    border-color: rgba(255,255,255,.35);
    background: rgba(255,255,255,.11);
  }
  .tm-size-tools button > span {
    display: block;
    border-radius: 50%;
    background: var(--tm-text-soft);
  }

  .tm-markup-tools__spacer { width: 2px; flex: 0 0 auto; }

  .tm-markup-action {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 8px;
    padding: 0 9px;
    background: transparent;
    color: var(--tm-text-soft);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
  }

  .tm-markup-action:hover:not(:disabled) { background: rgba(255,255,255,.08); color: #fff; }
  .tm-markup-action:disabled,
  .tm-color-tools button:disabled,
  .tm-size-tools button:disabled { cursor: not-allowed; opacity: .4; }

  .tm-markup-canvas {
    position: fixed;
    z-index: 2;
    overflow: hidden;
    border: 2px solid var(--tm-mint);
    border-radius: 4px;
    background: var(--tm-ground);
    box-shadow: 0 0 0 9999px rgba(8,10,9,.56), 0 16px 42px rgba(0,0,0,.34);
  }

  .tm-markup-canvas img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
  }

  .tm-markup-canvas svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: crosshair;
    touch-action: none;
  }

  .tm-markup-canvas__dimensions {
    position: absolute;
    right: 6px;
    bottom: 6px;
    z-index: 2;
    min-height: 24px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    padding: 0 7px;
    background: var(--tm-mint);
    color: var(--tm-ground);
    font-size: 10px;
    font-weight: 700;
    pointer-events: none;
  }

  .tm-markup-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px;
    background: var(--tm-surface);
    color: var(--tm-text-soft);
    font-size: 12px;
    text-align: center;
  }

  .tm-markup-loading--error { color: var(--tm-coral-dark); }

  .tm-markup-dock__actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .tm-markup-cancel,
  .tm-markup-confirm {
    flex: 0 0 auto;
  }

  .tm-markup-cancel {
    background: transparent;
    color: var(--tm-text-secondary);
  }
  .tm-markup-cancel:hover:not(:disabled) { background: var(--tm-overlay-subtle); color: var(--tm-text-primary); }

  .tm-markup-confirm {
    background: var(--tm-action-primary);
    color: var(--tm-text-inverse);
  }
  .tm-markup-confirm:hover:not(:disabled) { background: var(--tm-action-primary-hover); }

  .tm-markup-overlay button:focus-visible,
  .tm-markup-overlay svg:focus-visible {
    outline: 3px solid var(--tm-focus);
    outline-offset: 2px;
  }

  .tm-markup-note {
    position: fixed;
    z-index: 3;
    left: 50%;
    bottom: 82px;
    max-width: calc(100vw - 24px);
    margin: 0;
    transform: translateX(-50%);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    padding: 6px 9px;
    background: rgba(26,31,28,.94);
    color: var(--tm-text-soft);
    box-shadow: 0 8px 22px rgba(0,0,0,.22);
    font-size: 10px;
    white-space: nowrap;
    animation: tm-toast-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }

  .tm-toast {
    position: fixed;
    z-index: 50;
    left: 50%;
    bottom: 84px;
    transform: translateX(-50%);
    border-radius: 999px;
    padding: 11px 16px;
    background: var(--tm-ink);
    color: #fff;
    box-shadow: 0 10px 30px rgba(0,0,0,.24);
    font-size: 13px;
    font-weight: 700;
    animation: tm-toast-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }

  @keyframes tm-scrim-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes tm-toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.98); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      scroll-behavior: auto !important;
      transition: none !important;
      animation: none !important;
    }
  }

  @media (max-width: 760px) {
    .tm-modebar {
      right: 12px;
      bottom: 12px;
      max-width: calc(100vw - 24px);
      box-sizing: border-box;
      overflow: visible;
    }
    .tm-modebar > .tm-toolbar-tools {
      flex: 0 1 auto;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--tm-text-secondary) transparent;
    }
    .tm-gesture-hint { right: 12px; bottom: 69px; }
    .tm-interaction-recorder {
      right: 12px;
      bottom: 12px;
      left: 12px;
      min-width: 0;
      transform: none;
    }
    .tm-interaction-recorder__copy span,
    .tm-interaction-recorder__count { display: none; }
    .tm-toolbar-divider { flex: 0 0 auto; }
    .tm-modebar button,
    .tm-tool-group { flex: 0 0 auto; }
    .tm-markup-dock {
      right: 12px;
      bottom: 10px;
      left: 12px;
      width: auto;
      max-width: none;
      transform: none;
    }
    .tm-markup-dock__context { display: none; }
    .tm-markup-tools {
      min-height: 40px;
    }
    .tm-markup-tools__label { display: none; }
    .tm-markup-note {
      bottom: 76px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;
