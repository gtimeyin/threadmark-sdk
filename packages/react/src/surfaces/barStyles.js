// The Bar (Figma "Bar" component): a dark 8px-radius bar centred at the bottom of the page.
// Idle it says what is waiting; in comment mode it carries the hint and the review tools.
// Loaded after overlayStyles, so these rules replace the older launcher and toolbar look.
export const barStyles = `
  .tm-bar,
  .tm-modebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 20px;
    width: max-content;
    max-width: calc(100vw - 24px);
    margin-inline: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    box-sizing: border-box;
    padding: 6px 12px 6px 6px;
    border: 0;
    border-radius: var(--tm-radius-panel);
    background: var(--tm-ground);
    color: var(--tm-text-primary);
    box-shadow: 0 12px 32px rgba(14, 23, 20, .18), 0 0 0 1px rgba(251, 250, 246, .06);
    font: 600 13px/18px var(--tm-font);
    pointer-events: auto;
    user-select: none;
    z-index: 30;
  }
  .tm-bar { animation: tm-launcher-in var(--tm-motion-surface) var(--tm-ease-emphasized) both; }
  .tm-bar--nothing { padding: 6px 8px 6px 6px; }
  .tm-modebar { gap: 2px; padding: 6px; }

  .tm-bar__divider,
  .tm-modebar .tm-toolbar-divider {
    flex: none;
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: rgba(251, 250, 246, .12);
  }

  .tm-bar__tools {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--tm-radius-button);
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
  }
  .tm-bar__tools svg { width: 16px; height: 16px; }
  .tm-bar__tools:hover { background: rgba(251, 250, 246, .08); color: var(--tm-text-primary); }
  /* The idle Bar wears the comment-mode Bar's controls (2026-11-15), so the two read as one bar. */
  .tm-bar--idle { gap: 2px; padding: 6px; }
  .tm-bar--idle button { position: relative; display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--tm-radius-button); background: transparent; color: var(--tm-text-secondary); cursor: pointer; font: inherit; }
  .tm-bar--idle button:hover { background: rgba(251, 250, 246, .08); color: var(--tm-text-primary); }
  .tm-bar--idle button:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  .tm-bar--idle button svg { width: 18px; height: 18px; }
  .tm-bar--idle .tm-drag-handle { width: 20px !important; color: rgba(163, 173, 168, .6) !important; }
  .tm-bar--idle .tm-tool-switch { display: inline-flex; align-items: center; width: auto; gap: 3px; padding: 0 6px 0 8px; }
  .tm-bar--idle .tm-tool-switch .tm-tool-switch__chevron { width: 13px; height: 13px; }
  .tm-bar--idle .tm-toolbar-divider { flex: none; width: 1px; height: 18px; margin: 0 4px; background: rgba(251, 250, 246, .12); }
  .tm-bar--idle .tm-bar__shrink { width: 20px; margin-right: 0; }
  .tm-bar .tm-count-badge { top: -4px; right: -5px; min-width: 16px; height: 16px; padding: 0 4px; border: 2px solid var(--tm-ground); background: var(--tm-orange); color: #fff; font: 600 10px/12px var(--tm-font); }
  .tm-bar .tm-all-comments-trigger.is-waiting .tm-count-badge { background: var(--tm-action-primary); color: var(--tm-ground); }
  .tm-bar .tm-bar__icon-dot { position: absolute; top: 5px; right: 5px; }

  .tm-bar .tm-launcher {
    position: static;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    margin: 0;
    padding: 0 0 0 6px;
    border: 0;
    border-radius: var(--tm-radius-button);
    background: transparent;
    color: var(--tm-text-primary);
    box-shadow: none;
    font: inherit;
    animation: none;
    cursor: pointer;
    transform: none;
  }
  .tm-bar--nothing .tm-launcher { padding: 0 4px 0 8px; }
  .tm-bar .tm-launcher:hover { background: transparent; transform: none; }
  .tm-bar .tm-launcher:hover .tm-bar__primary { color: #fff; }
  .tm-bar .tm-launcher:active { transform: none; }
  .tm-bar .tm-launcher:focus-visible,
  .tm-bar__tools:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }

  .tm-bar__lead-icon { width: 16px; height: 16px; flex: none; color: var(--tm-text-secondary); }
  .tm-bar__lead-icon--lime { color: var(--tm-action-primary); }
  .tm-bar__dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--tm-action-primary); }
  .tm-bar__dot--offline { background: var(--tm-orange); }
  .tm-bar__primary { color: var(--tm-text-primary); white-space: nowrap; }
  .tm-bar__sep { color: var(--tm-text-secondary); font-size: 11px; font-weight: 500; }
  .tm-bar__secondary { color: var(--tm-text-secondary); white-space: nowrap; }
  .tm-bar .tm-ui-key,
  .tm-bar__hint .tm-ui-key { margin-left: 2px; }

  .tm-bar__hint {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 6px 0 8px;
    max-width: 320px;
    overflow: hidden;
  }
  .tm-bar__hint .tm-bar__primary { overflow: hidden; text-overflow: ellipsis; }

  .tm-modebar button {
    width: 32px;
    height: 32px;
    min-height: 32px;
    color: var(--tm-text-secondary);
    font-weight: 600;
  }
  .tm-modebar button:hover { background: rgba(251, 250, 246, .08); color: var(--tm-text-primary); transform: none; }
  .tm-modebar button:active { transform: none; }
  .tm-modebar .tm-drag-handle { width: 20px; color: rgba(163, 173, 168, .6); }
  .tm-modebar .tm-tool-switch.is-open { background: var(--tm-action-primary); color: var(--tm-ground); }
  .tm-modebar .tm-all-comments-trigger.is-active { background: rgba(251, 250, 246, .10); color: var(--tm-text-primary); }
  .tm-modebar .tm-button--primary { width: auto; padding: 0 12px; background: var(--tm-action-primary); color: var(--tm-ground); }
  .tm-modebar .tm-count-badge { background: var(--tm-orange); color: #fff; border-color: var(--tm-ground); }

  /* The hint now lives inside the bar. */
  .tm-gesture-hint { display: none; }

  @media (max-width: 600px) {
    .tm-bar, .tm-modebar { bottom: 12px; }
    .tm-bar__hint { max-width: 180px; }
    .tm-bar__secondary, .tm-bar__sep { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tm-bar { animation: none; }
  }

  /* Page pins (Figma "Pin", 62:35): a 28px Orange drop with a point at the bottom left, a 2px white
     edge and a soft shadow. Active = ink edge; Grouped = Forest; Resolved = tint with a check;
     Suggested / needs repair = white with a dashed Orange edge; Ghost = Stone. */
  .tm-marker {
    width: 28px;
    height: 28px;
    border: 2px solid #fff;
    border-radius: 14px 14px 14px 3px;
    background: var(--tm-orange);
    color: #fff;
    box-shadow: 0 12px 32px rgba(14, 23, 20, .24), 0 1px 3px rgba(14, 23, 20, .18);
    font: 500 11px/14px var(--tm-font);
    transform: translate(-4px, -50%);
  }
  .tm-marker::before { content: ""; position: absolute; inset: -8px; }
  .tm-marker:hover { transform: translate(-4px, -50%) scale(1.06); }
  .tm-marker--active { border-color: var(--tm-ink); }
  .tm-marker--grouped { border-radius: 14px 14px 14px 3px; background: var(--tm-forest); }
  .tm-marker--resolved { background: var(--tm-sage); color: var(--tm-forest); }
  .tm-marker__check { width: 14px; height: 14px; }
  .tm-marker--warning,
  .tm-marker--suggested {
    border: 1.5px dashed var(--tm-orange);
    background: #fff;
    color: var(--tm-orange);
    box-shadow: 0 12px 32px rgba(14, 23, 20, .18);
  }
  .tm-marker--ghost {
    opacity: 1;
    border: 2px solid #fff;
    background: var(--tm-stone);
    color: #fff;
    box-shadow: 0 12px 32px rgba(14, 23, 20, .18);
  }

  /* Recording bars (Bar, Mood=Recording): the same dark bar with an Orange dot and an Orange Stop. */
  .tm-interaction-recorder {
    min-height: 44px;
    box-sizing: border-box;
    border: 0;
    border-radius: var(--tm-radius-panel);
    padding: 6px 6px 6px 12px;
    background: var(--tm-ground);
    box-shadow: 0 12px 32px rgba(14, 23, 20, .18), 0 0 0 1px rgba(251, 250, 246, .06);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  .tm-recording-dot { width: 6px; height: 6px; background: var(--tm-orange); box-shadow: none; }
  .tm-recording-stop {
    min-height: 32px;
    border: 0;
    border-radius: var(--tm-radius-button);
    background: var(--tm-orange);
    color: #fff;
    font: 600 13px/18px var(--tm-font);
  }
  .tm-recording-stop:hover:not(:disabled) { background: #d9481a; }

  /* Six places the bar can sit (board 09, 29a), and the soft outlines shown while dragging. */
  .tm-bar.tm-bar--at-top-left, .tm-modebar.tm-bar--at-top-left,
  .tm-bar.tm-bar--at-top-center, .tm-modebar.tm-bar--at-top-center,
  .tm-bar.tm-bar--at-top-right, .tm-modebar.tm-bar--at-top-right { top: 20px; bottom: auto; }
  .tm-bar.tm-bar--at-top-left, .tm-modebar.tm-bar--at-top-left,
  .tm-bar.tm-bar--at-bottom-left, .tm-modebar.tm-bar--at-bottom-left { left: 20px; right: auto; margin: 0; }
  .tm-bar.tm-bar--at-top-right, .tm-modebar.tm-bar--at-top-right,
  .tm-bar.tm-bar--at-bottom-right, .tm-modebar.tm-bar--at-bottom-right { left: auto; right: 20px; margin: 0; }
  .tm-bar-spots { position: fixed; inset: 0; z-index: 29; pointer-events: none; }
  .tm-bar-spot { position: fixed; left: 0; right: 0; bottom: 20px; width: 240px; height: 44px; margin-inline: auto; border: 1.5px dashed rgba(94, 102, 98, .5); border-radius: var(--tm-radius-panel); background: rgba(251, 250, 246, .35); }
  .tm-bar-spot.tm-bar--at-top-left, .tm-bar-spot.tm-bar--at-top-center, .tm-bar-spot.tm-bar--at-top-right { top: 20px; bottom: auto; }
  .tm-bar-spot.tm-bar--at-top-left, .tm-bar-spot.tm-bar--at-bottom-left { left: 20px; right: auto; margin: 0; }
  .tm-bar-spot.tm-bar--at-top-right, .tm-bar-spot.tm-bar--at-bottom-right { left: auto; right: 20px; margin: 0; }

  /* Shrunk to a dot, with its count. */
  .tm-bar.tm-bar--shrunk { min-height: 32px; padding: 4px 10px 4px 6px; gap: 6px; }
  .tm-bar--shrunk .tm-launcher { padding: 0 2px 0 4px; min-height: 24px; }
  .tm-bar__dot--quiet { background: rgba(163, 173, 168, .6); }
  .tm-bar__shrink { display: grid; place-items: center; width: 20px; height: 32px; margin-right: -6px; padding: 0; border: 0; background: transparent; cursor: pointer; }
  .tm-bar__shrink span { width: 6px; height: 6px; border-radius: 50%; background: rgba(163, 173, 168, .45); transition: background var(--tm-motion-fast) var(--tm-ease-standard); }
  .tm-bar__shrink:hover span { background: var(--tm-text-primary); }
  .tm-bar__shrink:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; border-radius: 4px; }
  .tm-menu-dot { display: block; width: 6px; height: 6px; margin: 5px; border-radius: 50%; background: currentColor; }

  /* The shortcut sheet. */
  .tm-sheet-layer { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 16px; background: rgba(14, 23, 20, .18); pointer-events: auto; }
  .tm-shortcuts { width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: var(--tm-radius-panel); background: var(--tm-ground); color: var(--tm-text-primary); box-shadow: 0 22px 60px rgba(0, 0, 0, .38), 0 0 0 1px rgba(251, 250, 246, .08); font: 400 13px/18px var(--tm-font); outline: none; animation: tm-popover-in-below var(--tm-motion-surface) var(--tm-ease-emphasized) both; }
  .tm-shortcuts header { display: flex; align-items: center; gap: 8px; padding: 14px 14px 6px 16px; }
  .tm-shortcuts header svg { width: 16px; height: 16px; color: var(--tm-action-primary); }
  .tm-shortcuts h2 { flex: 1; margin: 0; font: 600 13px/18px var(--tm-font); }
  .tm-shortcuts header button { padding: 0; border: 0; background: none; cursor: pointer; }
  .tm-shortcuts__columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 8px 16px 16px; }
  .tm-shortcuts h3 { margin: 0 0 6px; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); letter-spacing: .04em; text-transform: uppercase; }
  .tm-shortcuts dl { display: grid; gap: 2px; margin: 0; }
  .tm-shortcuts dl > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 26px; }
  .tm-shortcuts dt { color: var(--tm-text-primary); }
  .tm-shortcuts dd { display: flex; gap: 4px; margin: 0; }
  @media (max-width: 600px) { .tm-shortcuts__columns { grid-template-columns: 1fr; } }

  /* On a dark page the bar and panel get a faint paper edge so they never melt into it (board 09, 32). */
  .tm-root.tm-root--dark-page .tm-bar,
  .tm-root.tm-root--dark-page .tm-modebar,
  .tm-root.tm-root--dark-page .tm-comments-panel,
  .tm-root.tm-root--dark-page .tm-popover { box-shadow: 0 0 0 1px rgba(251, 250, 246, .18), 0 12px 32px rgba(0, 0, 0, .4); }
  @media (prefers-reduced-motion: reduce) { .tm-shortcuts { animation: none; } }

  /* Your settings (board 08). */
  .tm-you { width: min(400px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: var(--tm-radius-panel); background: var(--tm-ground); color: var(--tm-text-primary); box-shadow: 0 22px 60px rgba(0, 0, 0, .38), 0 0 0 1px rgba(251, 250, 246, .08); font: 400 13px/18px var(--tm-font); outline: none; animation: tm-popover-in-below var(--tm-motion-surface) var(--tm-ease-emphasized) both; }
  .tm-you__header { display: flex; align-items: center; gap: 8px; padding: 14px 14px 4px 16px; }
  .tm-you__header svg { width: 14px; height: 14px; color: var(--tm-action-primary); }
  .tm-you__header h2 { flex: 1; margin: 0; font: 600 13px/18px var(--tm-font); }
  .tm-you__header button { padding: 0; border: 0; background: none; cursor: pointer; }
  .tm-you__body { display: grid; gap: 14px; padding: 10px 16px 0; }
  .tm-you__lead { margin: 0; font-size: 14px; }
  .tm-you__note { margin: 2px 0 0; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-you__faces { margin: 0; padding: 0; border: 0; min-width: 0; }
  .tm-you__face-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .tm-you__face-grid button { padding: 2px; border: 2px solid transparent; border-radius: 50%; background: none; cursor: pointer; }
  .tm-you__face-grid button.is-selected { border-color: var(--tm-action-primary); }
  .tm-you__face-grid button:hover:not(.is-selected) { border-color: rgba(251, 250, 246, .2); }
  .tm-you__settings { display: grid; gap: 12px; }
  .tm-you__digest { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .tm-you__digest span { display: grid; }
  .tm-you__digest strong { font: 400 13px/18px var(--tm-font); }
  .tm-you__digest small { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-you__digest .tm-ui-segmented { width: 170px; }
  .tm-you__footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 -16px; padding: 12px 16px 14px; border-top: 1px solid rgba(251, 250, 246, .08); }
  /* Share (board 04, 15a-f) */
  .tm-share { width: min(460px, 100%); }
  .tm-share .tm-you__body { gap: 12px; }
  .tm-share__link, .tm-share__invite { display: flex; gap: 8px; }
  .tm-share__url, .tm-share__field { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px; border: 1px solid rgba(251, 250, 246, .12); border-radius: var(--tm-radius-button); background: var(--tm-surface); }
  .tm-share__url svg { flex: none; width: 14px; height: 14px; color: var(--tm-text-secondary); }
  .tm-share__url input, .tm-share__field input { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; background: none; color: var(--tm-text-primary); font: 400 13px/18px var(--tm-font); outline: none; }
  .tm-share__url input { font-family: var(--tm-font-mono); font-size: 12px; }
  .tm-share__field:focus-within { border-color: rgba(251, 250, 246, .3); }
  .tm-share__field input::placeholder { color: var(--tm-text-secondary); }
  .tm-share__button { flex: none; height: 34px; padding: 0 12px; border: 0; border-radius: var(--tm-radius-button); background: var(--tm-raised); color: var(--tm-text-primary); font: 600 13px/18px var(--tm-font); cursor: pointer; }
  .tm-share__button:hover:not(:disabled) { background: rgba(251, 250, 246, .14); }
  .tm-share__button:disabled { opacity: .5; cursor: default; }
  .tm-share__access { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid rgba(251, 250, 246, .08); font-size: 12px; color: var(--tm-text-secondary); }
  .tm-share__access svg { width: 14px; height: 14px; }
  .tm-share__access strong { color: var(--tm-text-primary); font-weight: 500; }
  .tm-share__select { position: relative; display: inline-flex; align-items: center; flex: none; }
  .tm-share__select::after { content: ""; position: absolute; right: 2px; top: 50%; border: 3px solid transparent; border-top-color: currentColor; margin-top: -1px; pointer-events: none; color: var(--tm-text-secondary); }
  .tm-share__select select { appearance: none; -webkit-appearance: none; padding: 2px 12px 2px 4px; border: 0; border-radius: 4px; background: none; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); cursor: pointer; }
  .tm-share__select select:hover { color: var(--tm-text-primary); }
  .tm-share__select select option { background: var(--tm-ground); color: var(--tm-text-primary); }
  .tm-share__message { margin: 0; }
  .tm-share__message.is-done { color: var(--tm-lime); }
  .tm-share__count { display: flex; justify-content: space-between; margin: 0 0 4px; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-share__people ul { display: grid; gap: 2px; margin: 0 -8px; padding: 0; list-style: none; }
  .tm-share__people li { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: var(--tm-radius-button); }
  .tm-share__people li:hover { background: var(--tm-surface); }
  .tm-share__who { flex: 1; min-width: 0; display: grid; }
  .tm-share__name { display: flex; align-items: center; gap: 8px; overflow: hidden; font: 400 14px/20px var(--tm-font); white-space: nowrap; text-overflow: ellipsis; }
  .tm-share__who small { overflow: hidden; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); white-space: nowrap; text-overflow: ellipsis; }
  .tm-share__role { flex: none; color: var(--tm-text-secondary); font-size: 12px; }
  .tm-share__resend { flex: none; padding: 2px 4px; border: 0; background: none; color: var(--tm-lime); font: 500 12px/16px var(--tm-font); cursor: pointer; }
  .tm-share__resend:hover { text-decoration: underline; }
  .tm-share__end { height: 14px; }
  /* Board 02, 6a-6c: capture. A slight dim, a crosshair hint, a dashed box with its size, and one Capture bar. */
  .tm-capture-surface { background: rgba(14, 23, 20, .12); }
  .tm-capture-hint { position: fixed; z-index: 3; padding: 3px 8px; border-radius: var(--tm-radius-button); background: var(--tm-ground); color: var(--tm-text-primary); font: 500 12px/16px var(--tm-font); pointer-events: none; white-space: nowrap; }
  .tm-capture-selection, .tm-markup-canvas { border: 1.5px dashed var(--tm-ground) !important; outline: 1px solid rgba(255, 255, 255, .9); outline-offset: 0; border-radius: 0 !important; box-shadow: 0 0 0 9999px rgba(14, 23, 20, .18) !important; background: transparent; }
  .tm-markup-canvas { background: var(--tm-paper, #fbfaf6); }
  .tm-capture-selection > span, .tm-markup-canvas__dimensions {
    position: absolute; left: -2px !important; right: auto !important; top: -28px !important; bottom: auto !important; min-height: 22px; display: grid; place-items: center;
    padding: 0 7px; border-radius: 4px; background: var(--tm-ground); color: var(--tm-text-primary); font: 400 12px/16px var(--tm-font-mono);
  }
  .tm-capture-selection::before, .tm-capture-selection::after { content: ""; position: absolute; width: 7px; height: 7px; border: 1px solid var(--tm-ground); background: #fff; }
  .tm-capture-selection::before { left: -5px; top: -5px; }
  .tm-capture-selection::after { right: -5px; bottom: -5px; }
  .tm-markup-canvas { overflow: visible !important; }
  .tm-markup-canvas > img, .tm-markup-canvas > svg { overflow: hidden; }
  .tm-markup-canvas.is-adjusting > img, .tm-markup-canvas.is-adjusting > svg { opacity: .35; }
  .tm-markup-canvas__dimensions.is-movable { cursor: move; pointer-events: auto; }
  .tm-markup-handle { position: absolute; z-index: 3; width: 9px; height: 9px; border: 1px solid var(--tm-ground); background: #fff; pointer-events: auto; }
  .tm-markup-handle--nw { left: -6px; top: -6px; cursor: nwse-resize; }
  .tm-markup-handle--ne { right: -6px; top: -6px; cursor: nesw-resize; }
  .tm-markup-handle--sw { left: -6px; bottom: -6px; cursor: nesw-resize; }
  .tm-markup-handle--se { right: -6px; bottom: -6px; cursor: nwse-resize; }
  .tm-capture-bar { z-index: 61; gap: 2px; padding: 6px; font: 500 12px/16px var(--tm-font); }
  .tm-markup-overlay .tm-capture-bar, .tm-capture-surface .tm-capture-bar { position: fixed; }
  .tm-capture-bar__label { display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; color: var(--tm-text-muted); }
  .tm-capture-bar__label svg { width: 14px; height: 14px; }
  .tm-capture-bar__rule { width: 1px; height: 20px; margin: 0 2px; background: var(--tm-line); }
  .tm-modebar.tm-capture-bar button { width: auto; min-width: 0; flex: none; white-space: nowrap; }
  .tm-modebar.tm-capture-bar button svg { display: block; flex: none; }
  .tm-capture-bar button { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-muted); cursor: pointer; font: inherit; }
  .tm-capture-bar button svg { width: 14px; height: 14px; }
  .tm-capture-bar button:hover:not(:disabled) { color: var(--tm-text-primary); }
  .tm-capture-bar button.is-active { background: var(--tm-raised); color: var(--tm-text-primary); }
  .tm-capture-bar button.is-active svg { color: var(--tm-lime); }
  .tm-capture-bar button:disabled { opacity: .45; cursor: default; }
  .tm-capture-bar .tm-ui-key { color: var(--tm-text-muted); }
  .tm-capture-bar__colors { display: inline-flex; align-items: center; gap: 2px; margin-left: 6px; }
  .tm-modebar.tm-capture-bar .tm-capture-bar__colors button { min-height: 0; min-width: 0; width: 22px; height: 22px; padding: 0; justify-content: center; border-radius: 50%; }
  .tm-capture-bar__colors button span { width: 12px; height: 12px; border-radius: 50%; }
  .tm-capture-bar__colors button.is-selected { box-shadow: inset 0 0 0 1.5px var(--tm-text-primary); }
  .tm-capture-bar__esc { padding: 0 4px !important; }
  .tm-capture-bar .tm-capture-bar__done { margin-left: 4px; padding: 0 10px; background: var(--tm-lime); color: var(--tm-ground); font-weight: 600; }
  .tm-capture-bar .tm-capture-bar__done:hover:not(:disabled) { background: #eaf77f; color: var(--tm-ground); }
  .tm-capture-bar .tm-capture-bar__done .tm-ui-key { border-color: rgba(14, 23, 20, .2); background: transparent; color: rgba(14, 23, 20, .6); }
  .tm-capture-bar button:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }

  /* Board 06, 20d and 12, 37c: a bar that says what is happening, with a Lime Stop and Esc. */
  .tm-bar-status { z-index: 60; gap: 8px; padding: 6px 8px 6px 14px; font: 600 13px/18px var(--tm-font); }
  .tm-bar-status__icon { flex: none; width: 14px; height: 14px; color: var(--tm-lime); }
  .tm-bar-status__detail { color: var(--tm-text-muted); font-weight: 500; }
  .tm-bar-status__detail::before { content: "·"; margin-right: 8px; }
  .tm-bar-status__stop { height: 28px; padding: 0 4px; border: 0; background: none; color: var(--tm-lime); cursor: pointer; font: 600 13px/18px var(--tm-font); }
  .tm-bar-status__stop:hover { text-decoration: underline; }
  .tm-bar-status__stop:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }

  /* Board 04, 15b and 15f: invite chips, suggestions, a note, and one role menu per person. */
  .tm-share__invite { display: grid; gap: 8px; }
  .tm-share__invite-row { display: flex; gap: 8px; }
  .tm-share .tm-share__field { height: auto; min-height: 34px; align-items: flex-start; padding: 3px 4px 3px 10px; cursor: text; }
  .tm-share__field .tm-share__role-menu { margin-top: 1px; }
  .tm-share__field.is-active { border-color: rgba(224, 243, 84, .5); }
  .tm-share__chips { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .tm-share__chips input { flex: 1 0 80px; height: 26px; }
  .tm-share__chip { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 4px 0 8px; border-radius: 4px; background: var(--tm-raised); color: var(--tm-text-primary); font: 400 12px/16px var(--tm-font); }
  .tm-share__chip button { width: 16px; height: 16px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 3px; background: none; color: var(--tm-text-muted); cursor: pointer; }
  .tm-share__chip button:hover { background: rgba(251, 250, 246, .1); color: var(--tm-text-primary); }
  .tm-share__button.is-primary { background: var(--tm-lime); color: var(--tm-ground); }
  .tm-share__button.is-primary:hover:not(:disabled) { background: #eaf77f; }
  .tm-share__suggestions { display: grid; gap: 2px; margin: 0; padding: 4px; list-style: none; border: 1px solid rgba(251, 250, 246, .1); border-radius: var(--tm-radius-panel); background: var(--tm-surface); }
  .tm-share__suggestions li { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: var(--tm-radius-button); cursor: pointer; }
  .tm-share__suggestions li.is-active { background: var(--tm-raised); }
  .tm-share__suggestions li > span { display: grid; min-width: 0; }
  .tm-share__suggestions strong { font: 400 14px/20px var(--tm-font); }
  .tm-share__suggestions small { overflow: hidden; color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font); text-overflow: ellipsis; white-space: nowrap; }
  .tm-share__note { height: 38px; padding: 0 12px; border: 1px solid rgba(251, 250, 246, .12); border-radius: var(--tm-radius-button); background: var(--tm-surface); color: var(--tm-text-primary); font: 400 13px/18px var(--tm-font); outline: none; }
  .tm-share__note:focus { border-color: rgba(251, 250, 246, .3); }
  .tm-share__note::placeholder { color: var(--tm-text-secondary); }
  .tm-share__role-menu { position: relative; flex: none; display: inline-flex; }
  .tm-share__role-button { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 6px; border: 0; border-radius: 4px; background: none; color: var(--tm-text-secondary); cursor: pointer; font: 400 12px/16px var(--tm-font); white-space: nowrap; }
  .tm-share__role-button:hover, .tm-share__role-button[aria-expanded="true"] { background: rgba(251, 250, 246, .06); color: var(--tm-text-primary); }
  .tm-share__role-button svg { width: 10px; height: 10px; }
  .tm-share__menu { position: fixed; z-index: 80; width: 220px; display: grid; gap: 2px; padding: 6px; border-radius: var(--tm-radius-panel); background: var(--tm-surface); box-shadow: 0 14px 36px rgba(0, 0, 0, .4), 0 0 0 1px rgba(251, 250, 246, .1); }
  .tm-share__menu button { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 8px; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-primary); cursor: pointer; text-align: left; }
  .tm-share__menu button:hover, .tm-share__menu button:focus-visible, .tm-share__menu button[aria-checked="true"] { background: var(--tm-raised); outline: none; }
  .tm-share__menu button > span { display: grid; }
  .tm-share__menu strong { font: 400 14px/20px var(--tm-font); }
  .tm-share__menu small { color: var(--tm-text-muted); font: 400 11px/14px var(--tm-font); }
  .tm-share__menu svg { width: 14px; height: 14px; color: var(--tm-lime); }
  .tm-share__menu-rule { height: 1px; margin: 2px 4px; background: rgba(251, 250, 246, .08); }
  .tm-share__menu .tm-share__remove { color: #ff8f66; font: 400 14px/20px var(--tm-font); }
  .tm-share__people li.tm-share__confirm { background: var(--tm-surface); }
  .tm-share__confirm > span { flex: 1; min-width: 0; display: grid; }
  .tm-share__confirm small { color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font); }
  .tm-share__confirm .tm-share__button { height: 30px; }
  .tm-share__button--danger { background: var(--tm-orange); color: #fff; }
  .tm-share__button--danger:hover:not(:disabled) { background: #d9481a; }
  .tm-share button:focus-visible, .tm-share input:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  .tm-share__chips input:focus-visible { outline: none; }

  /* Board 08, 27a: the You menu under your face in the panel header. */
  .tm-comments-you-wrap { position: relative; display: inline-flex; }
  .tm-you-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; width: 248px; display: grid; gap: 2px; padding: 6px; border-radius: var(--tm-radius-panel); background: var(--tm-surface); box-shadow: 0 14px 36px rgba(0, 0, 0, .4), 0 0 0 1px rgba(251, 250, 246, .1); color: var(--tm-text-primary); }
  .tm-you-menu__who { display: flex; align-items: center; gap: 10px; padding: 6px 8px 8px; }
  .tm-you-menu__who > span { display: grid; min-width: 0; }
  .tm-you-menu__who strong { font: 500 14px/20px var(--tm-font); }
  .tm-you-menu__who small { overflow: hidden; color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font); text-overflow: ellipsis; white-space: nowrap; }
  .tm-you-menu button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; height: 34px; padding: 0 10px; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-primary); cursor: pointer; font: 500 13px/18px var(--tm-font); text-align: left; }
  .tm-you-menu button:hover, .tm-you-menu button:focus-visible { background: var(--tm-raised); outline: none; }
  .tm-you-menu__keys { display: inline-flex; gap: 4px; }
  /* 27b, 28b: a narrower face sheet, and a small leave confirm with Stay and an Orange Leave. */
  .tm-you--face { width: min(420px, 100%); }
  .tm-you--face .tm-you__face-grid { margin-top: 0; }
  .tm-you--leave { width: min(420px, 100%); }
  .tm-you__footer--end { justify-content: flex-end; }
  .tm-you__stay { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border: 1px solid rgba(251, 250, 246, .16); border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-primary); cursor: pointer; font: 600 13px/18px var(--tm-font); }
  .tm-you__stay:hover { background: rgba(251, 250, 246, .06); }
  .tm-you__email input { font-family: var(--tm-font-mono); font-size: 12px; }
  /* Tour Save to code (board 06, 20e) */
  .tm-tour-save { width: min(480px, 100%); }
  .tm-tour-save .tm-tool-icon { width: 14px; height: 14px; flex: none; }
  .tm-tour-save__file { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--tm-text-secondary); }
  .tm-tour-save__file code { color: var(--tm-text-primary); font: 400 12px/16px var(--tm-font-mono); }
  .tm-tour-save__code { max-height: 220px; margin: 0; padding: 10px 12px; overflow: auto; border: 1px solid rgba(251, 250, 246, .08); border-radius: var(--tm-radius-button); background: var(--tm-surface); color: var(--tm-text-primary); font: 400 12px/18px var(--tm-font-mono); white-space: pre-wrap; overflow-wrap: anywhere; }
  .tm-tour-save__tip { display: flex; gap: 8px; margin: 0; padding: 8px 10px; border-radius: var(--tm-radius-button); background: var(--tm-surface); color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-tour-save__tip code { color: var(--tm-text-primary); font-family: var(--tm-font-mono); }
  .tm-tour-save__ai { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-tour-save__ai span:nth-child(2) { flex: 1; }
  .tm-tour-save__ai.is-connected span:nth-child(2) { color: var(--tm-text-primary); }
  .tm-tour-save__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tm-text-secondary); }
  .tm-tour-save__ai.is-connected .tm-tour-save__dot { background: var(--tm-lime); }
  .tm-tour-save__ai button { padding: 0; border: 0; background: none; color: var(--tm-lime); font: 500 12px/16px var(--tm-font); cursor: pointer; }
  /* Send it elsewhere (board 10) */
  .tm-send { width: min(440px, 100%); }
  .tm-send__mark { flex: none; width: 14px; height: 14px; color: var(--tm-lime); }
  img.tm-send__mark { object-fit: contain; }
  .tm-send__field { display: grid; gap: 6px; }
  .tm-send__field > span:first-child { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-send__field input, .tm-send__select select { width: 100%; height: 36px; padding: 0 12px; border: 1px solid rgba(251, 250, 246, .12); border-radius: var(--tm-radius-button); background: var(--tm-surface); color: var(--tm-text-primary); font: 400 13px/18px var(--tm-font); outline: none; }
  .tm-send__field input:focus, .tm-send__select select:focus { border-color: rgba(251, 250, 246, .3); }
  .tm-send__select { position: relative; display: block; }
  .tm-send__select select { appearance: none; -webkit-appearance: none; padding-right: 28px; cursor: pointer; }
  .tm-send__select select option { background: var(--tm-ground); }
  .tm-send__select::after { content: ""; position: absolute; right: 12px; top: 50%; margin-top: -1px; border: 3px solid transparent; border-top-color: var(--tm-text-secondary); pointer-events: none; }
  .tm-send__select.is-error select { border-color: var(--tm-orange); }
  .tm-send__field pre { margin: 0; padding: 10px 12px; border: 1px solid rgba(251, 250, 246, .08); border-radius: var(--tm-radius-button); background: var(--tm-surface); color: var(--tm-text-primary); font: 400 12px/20px var(--tm-font-mono); white-space: pre-wrap; overflow-wrap: anywhere; }
  .tm-send__problem { display: flex; gap: 8px; padding: 10px 12px; border-radius: var(--tm-radius-button); background: rgba(241, 87, 34, .12); }
  .tm-send__problem svg { flex: none; width: 14px; height: 14px; margin-top: 2px; color: var(--tm-orange-on-dark); }
  .tm-send__problem p { margin: 0 0 8px; font: 400 12px/16px var(--tm-font); }
  .tm-send__fixes { display: flex; gap: 14px; }
  .tm-send__fixes a, .tm-send__fixes button { padding: 0; border: 0; background: none; color: var(--tm-text-primary); font: 600 12px/16px var(--tm-font); text-decoration: none; cursor: pointer; }
  .tm-send__fixes button { color: var(--tm-text-secondary); font-weight: 500; }
  .tm-send__fixes a:hover, .tm-send__fixes button:hover { text-decoration: underline; }
  .tm-send__note { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-send__actions { display: flex; gap: 8px; }
  .tm-send__cancel, .tm-send__go { display: inline-flex; align-items: center; gap: 8px; }
  .tm-send__go { height: 34px; padding: 0 12px; border: 0; border-radius: var(--tm-radius-button); background: var(--tm-lime); color: var(--tm-ground); font: 600 13px/18px var(--tm-font); cursor: pointer; }
  .tm-send__go:disabled { opacity: .5; cursor: default; }
  .tm-send__go .tm-ui-key { background: rgba(14, 23, 20, .1); color: var(--tm-ground); border-color: transparent; }
  .tm-send__places { display: grid; margin: 0; padding: 8px 8px 10px; list-style: none; }
  .tm-send__places li { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: var(--tm-radius-button); }
  .tm-send__places li + li { border-top: 1px solid rgba(251, 250, 246, .06); }
  .tm-send__places li > span { flex: 1; display: grid; min-width: 0; }
  .tm-send__places strong { font: 500 13px/18px var(--tm-font); }
  .tm-send__places small { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-send__places .tm-share__button { height: 28px; font-size: 12px; }
  .tm-comment-links { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 2px 0 4px; font: 500 12px/16px var(--tm-font); }
  .tm-comment-link { color: var(--tm-lime); }
  .tm-comment-link a { color: inherit; text-decoration: none; }
  .tm-comment-link a:hover { text-decoration: underline; }
  .tm-comment-link.is-closed { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font-mono); }
  .tm-comment-link__status { color: var(--tm-text-secondary); font-weight: 400; }
  .tm-comments-panel .tm-comments-actions .tm-comments-you { padding: 0; }
  .tm-comments-you .tm-ui-avatar { width: 20px; height: 20px; }
`;
