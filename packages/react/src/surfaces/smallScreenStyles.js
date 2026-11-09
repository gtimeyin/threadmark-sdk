// Phones and tablets (Feedback experience board 11). The same bar, made for thumbs: on phones the bar
// stays at the bottom and everything else rises as a bottom sheet; tablets keep the desktop layout with
// touch sizes, and in portrait the panel is a drawer. Loaded last so it can override placement.
export const smallScreenStyles = `
  .tm-sheet-handle, .tm-panel-scrim { display: none; }

  /* Touch: no keyboard hints, and every target at least 44px. */
  @media (hover: none) and (pointer: coarse) {
    .tm-bar .tm-ui-key, .tm-modebar .tm-ui-key, .tm-toolbar-menu kbd, .tm-bar-status .tm-ui-key,
    .tm-you__header .tm-ui-key, .tm-ui-button .tm-ui-key, .tm-send__go .tm-ui-key, .tm-send__cancel .tm-ui-key, .tm-ai-follow .tm-ui-key { display: none; }
    .tm-bar button, .tm-modebar button, .tm-bar .tm-bar__main, .tm-bar .tm-launcher { min-height: 44px; }
    .tm-bar__tools, .tm-bar__shrink, .tm-modebar .tm-toolbar-tools > button { min-width: 44px; }
    .tm-toolbar-menu [role^="menuitem"] { min-height: 48px; }
    .tm-comments-panel .tm-comments-actions button, .tm-comments-panel .tm-panel-tabs button { min-height: 44px; }
    .tm-share__button, .tm-send__go, .tm-tour-primary, .tm-tour-secondary { min-height: 44px; }
    .tm-ai-actions .tm-share__button { height: 44px; }
    .tm-marker { min-width: 28px; min-height: 28px; }
  }

  /* Tablets in portrait: the panel is a 380px drawer from the right over a dimmed page (36b). */
  @media (min-width: 600px) and (max-width: 1023px) and (pointer: coarse) {
    .tm-panel-scrim { display: block; position: fixed; inset: 0; z-index: 45; background: rgba(14, 23, 20, .32); pointer-events: auto;
      animation: tm-scrim-in var(--tm-motion-surface, 240ms) ease both; }
    .tm-comments-panel:not(.tm-ai-panel) { z-index: 46; top: 0 !important; right: 0 !important; bottom: 0 !important; width: min(380px, 100vw) !important;
      max-height: none !important; border-radius: var(--tm-radius-panel) 0 0 var(--tm-radius-panel);
      animation: tm-drawer-in var(--tm-motion-surface, 240ms) var(--tm-ease-emphasized, ease-out) both; }
  }
  @keyframes tm-scrim-in { from { opacity: 0; } }
  @keyframes tm-drawer-in { from { transform: translateX(24px); opacity: 0; } }

  /* Phones. */
  @media (max-width: 599px) {
    /* 35a: same bar, same words; it steps away while you scroll down. */
    .tm-bar:not([class*="tm-bar--at-top"]), .tm-modebar:not([class*="tm-bar--at-top"]) { bottom: calc(12px + env(safe-area-inset-bottom)); }
    .tm-bar--idle { transition: transform var(--tm-motion-standard, 180ms) ease, opacity var(--tm-motion-standard, 180ms) ease; }
    .tm-bar--idle.is-away:not(:focus-within) { transform: translateY(calc(100% + 24px)); opacity: 0; pointer-events: none; animation: none; }
    .tm-bar--idle.is-away.tm-bar--at-top-left:not(:focus-within), .tm-bar--idle.is-away.tm-bar--at-top-center:not(:focus-within),
    .tm-bar--idle.is-away.tm-bar--at-top-right:not(:focus-within) { transform: translateY(calc(-100% - 24px)); }

    /* 35b-c: threads and the composer rise as bottom sheets; the page stays visible above. */
    .tm-popover { position: fixed !important; left: 0 !important; right: 0 !important; top: auto !important; bottom: 0 !important;
      width: auto !important; max-width: none !important; max-height: min(72vh, 72dvh); overflow: auto; overscroll-behavior: contain;
      border-radius: var(--tm-radius-popover, 16px) var(--tm-radius-popover, 16px) 0 0 !important;
      padding-bottom: env(safe-area-inset-bottom); transform: none !important; animation: tm-sheet-up var(--tm-motion-surface, 240ms) var(--tm-ease-emphasized, ease-out) both !important; }
    .tm-popover::before { content: ""; display: block; width: 36px; height: 4px; margin: 8px auto 2px; border-radius: 2px; background: rgba(251, 250, 246, .24); }
    .tm-root:has(.tm-popover) .tm-modebar, .tm-root:has(.tm-popover) .tm-bar { visibility: hidden; }
    .tm-popover textarea, .tm-popover input { font-size: 16px; } /* no zoom-on-focus in iOS Safari */

    /* 35d: the panel is a tall sheet; the handle drops it to half height. */
    .tm-comments-panel { left: 0 !important; right: 0 !important; bottom: 0 !important; top: max(48px, 8vh) !important; width: auto !important; max-height: none !important;
      border-radius: var(--tm-radius-popover, 16px) var(--tm-radius-popover, 16px) 0 0 !important; padding-bottom: env(safe-area-inset-bottom);
      transition: top var(--tm-motion-surface, 240ms) var(--tm-ease-emphasized, ease-out); animation: tm-sheet-up var(--tm-motion-surface, 240ms) var(--tm-ease-emphasized, ease-out) both; }
    .tm-comments-panel.is-half { top: 50vh !important; top: 50dvh !important; }
    .tm-sheet-handle { display: block; flex: none; width: 100%; height: 20px; margin: 0; padding: 0; border: 0; background: none; cursor: grab; }
    .tm-sheet-handle::after { content: ""; display: block; width: 36px; height: 4px; margin: 8px auto; border-radius: 2px; background: rgba(251, 250, 246, .24); }
    .tm-root:has(.tm-comments-panel:not([hidden])) .tm-modebar { visibility: hidden; }
    .tm-agent { bottom: calc(76px + env(safe-area-inset-bottom)); right: 12px; }

    /* Sheets (settings, share, send, tours, AI) and the Ask AI card come up from the bottom. */
    .tm-sheet-layer { align-items: flex-end !important; padding: 0 !important; }
    .tm-sheet-layer > .tm-you, .tm-sheet-layer > .tm-shortcuts { width: 100% !important; max-height: 88vh; max-height: 88dvh;
      border-radius: var(--tm-radius-popover, 16px) var(--tm-radius-popover, 16px) 0 0; padding-bottom: env(safe-area-inset-bottom);
      animation: tm-sheet-up var(--tm-motion-surface, 240ms) var(--tm-ease-emphasized, ease-out) both; }
    .tm-you__footer { flex-wrap: wrap; }
    .tm-ai-card { left: 0 !important; right: 0 !important; top: auto !important; bottom: 0 !important; width: auto !important;
      border-radius: var(--tm-radius-popover, 16px) var(--tm-radius-popover, 16px) 0 0; padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
    .tm-bar-status { max-width: calc(100vw - 24px); }
    .tm-bar-status__detail { display: none; }
    .tm-send__link, .tm-share__invite { flex-wrap: wrap; }
  }
  @keyframes tm-sheet-up { from { transform: translateY(24px); opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .tm-popover, .tm-comments-panel, .tm-sheet-layer > .tm-you, .tm-panel-scrim { animation: none !important; transition: none !important; }
    .tm-bar--idle { transition: none; }
  }
`;
