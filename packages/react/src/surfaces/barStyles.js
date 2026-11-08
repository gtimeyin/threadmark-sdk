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
`;
