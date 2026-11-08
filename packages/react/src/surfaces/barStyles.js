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
  .tm-comments-panel .tm-comments-actions .tm-comments-you { padding: 0; }
  .tm-comments-you .tm-ui-avatar { width: 20px; height: 20px; }
`;
