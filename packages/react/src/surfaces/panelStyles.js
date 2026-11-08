// Side panel (Figma "Side panel" 264:1064, "Comment row" 264:846, "Inbox item" 359:935).
// A 380px dark panel docked on the right: tabs and actions in one 44px header, hairlines at 8%,
// flat 16px-inset rows. Loaded after the base overlay styles, so it replaces the light glass panel.
export const panelStyles = `
  .tm-comments-panel {
    top: 8px;
    right: 8px;
    bottom: 8px;
    width: min(380px, calc(100vw - 16px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 0;
    border-radius: var(--tm-radius-panel);
    background: var(--tm-ground);
    color: var(--tm-text-primary);
    box-shadow: 0 22px 60px rgba(0, 0, 0, .38), 0 0 0 1px rgba(251, 250, 246, .06);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .tm-comments-panel .tm-comments-header {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 44px;
    margin: 0;
    padding: 12px 14px 12px 16px;
    border-bottom: 1px solid rgba(251, 250, 246, .08);
    box-sizing: border-box;
  }

  .tm-comments-panel .tm-panel-tabs {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }
  .tm-comments-panel .tm-panel-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: auto;
    min-height: 20px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--tm-text-secondary);
    box-shadow: none;
    font: 600 13px/18px var(--tm-font);
    white-space: nowrap;
    cursor: pointer;
    flex: none;
    width: auto;
    min-width: 0;
  }
  .tm-comments-panel .tm-panel-tabs button:hover { color: var(--tm-text-primary); }
  .tm-comments-panel .tm-panel-tabs button[aria-selected="true"] { background: transparent; color: var(--tm-text-primary); box-shadow: none; }
  .tm-comments-panel .tm-panel-tabs button[aria-selected="true"] .tm-panel-tabs__icon { color: var(--tm-action-primary); }
  .tm-comments-panel .tm-panel-tabs__icon { width: 14px; height: 14px; flex: none; }
  .tm-comments-panel .tm-panel-tabs__badge {
    display: inline-grid;
    place-items: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 4px;
    background: var(--tm-action-primary);
    color: var(--tm-ground);
    font: 600 11px/14px var(--tm-font);
  }

  .tm-comments-panel .tm-comments-actions { display: flex; align-items: center; gap: 2px; margin-left: auto; }
  .tm-comments-panel .tm-comments-actions button {
    width: 28px;
    height: 28px;
    min-height: 28px;
    border: 0;
    border-radius: var(--tm-radius-button);
    background: transparent;
    color: var(--tm-text-secondary);
  }
  .tm-comments-panel .tm-comments-actions button:hover,
  .tm-comments-panel .tm-comments-actions button.is-active { background: rgba(251, 250, 246, .08); color: var(--tm-text-primary); }
  .tm-comments-panel .tm-comments-actions svg { width: 16px; height: 16px; }

  .tm-comments-panel .tm-comments-search { padding: 10px 16px 0; }
  .tm-comments-panel .tm-comments-search input {
    width: 100%;
    min-height: 34px;
    box-sizing: border-box;
    padding: 6px 10px;
    border: 1px solid rgba(251, 250, 246, .18);
    border-radius: var(--tm-radius-button);
    background: transparent;
    color: var(--tm-text-primary);
    font: 400 14px/20px var(--tm-font);
  }
  .tm-comments-panel .tm-comments-search input:focus { outline: none; border-color: rgba(224, 243, 84, .6); }
  .tm-comments-panel .tm-comments-search input::placeholder { color: var(--tm-text-secondary); }

  .tm-comments-panel .tm-comments-count {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    padding: 12px 16px 4px;
    color: var(--tm-text-secondary);
    font: 500 11px/14px var(--tm-font);
  }

  .tm-comments-panel .tm-comments-list { padding: 0; }
  /* Rows carry their own faint divider; the light theme's hairline between items is too bright on the dark panel. */
  .tm-comments-panel .tm-comments-list li + li { border-top: 0; }
  .tm-comments-panel .tm-comment-card {
    display: grid;
    gap: 4px;
    width: 100%;
    margin: 0;
    padding: 8px 16px 9px;
    border: 0;
    border-bottom: 1px solid rgba(251, 250, 246, .08);
    border-radius: 0;
    background: transparent;
    color: var(--tm-text-primary);
    box-shadow: none;
    text-align: left;
  }
  .tm-comments-panel .tm-comment-card:hover,
  .tm-comments-panel .tm-comment-card:focus-visible { background: rgba(251, 250, 246, .04); }
  .tm-comments-panel .tm-comment-author { display: flex; align-items: center; gap: 8px; min-height: 20px; }
  .tm-comments-panel .tm-comment-avatar {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    flex: none;
    border: 0;
    border-radius: 50%;
    background: var(--tm-sage);
    color: var(--tm-ground);
    font: 500 9px/12px var(--tm-font);
  }
  .tm-comments-panel .tm-comment-avatar { overflow: hidden; }
  .tm-comments-panel .tm-comment-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .tm-comments-panel .tm-comment-author strong { color: var(--tm-text-primary); font: 600 13px/18px var(--tm-font); }
  .tm-comments-panel .tm-comment-author time { color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-comments-panel .tm-comment-copy,
  .tm-comments-panel .tm-comment-target,
  .tm-comments-panel .tm-comment-meta,
  .tm-comments-panel .tm-comment-card > :not(.tm-comment-author) { margin-left: 28px; max-width: calc(100% - 28px); min-width: 0; }
  .tm-comments-panel .tm-comments-list { overflow-x: hidden; }
  .tm-comments-panel .tm-comment-copy { color: var(--tm-text-primary); font: 400 14px/20px var(--tm-font); }
  .tm-comments-panel .tm-comment-target { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font-mono); }
  .tm-comments-panel .tm-comment-meta { color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-comments-panel .tm-comment-repair { color: var(--tm-orange-on-dark); }

  .tm-comments-panel .tm-comments-empty { color: var(--tm-text-secondary); }
  .tm-comments-panel .tm-comments-empty p { color: var(--tm-text-secondary); }
  .tm-comments-panel .tm-comments-empty strong { color: var(--tm-text-primary); }
  .tm-comments-panel .tm-comments-empty svg { color: var(--tm-action-primary); }
  .tm-comments-panel .tm-comments-empty button { border: 1px solid rgba(251, 250, 246, .15); border-radius: var(--tm-radius-button); background: transparent; color: var(--tm-text-primary); }

  .tm-comments-panel .tm-comments-filter-menu {
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: var(--tm-radius-panel);
    background: var(--tm-surface);
    color: var(--tm-text-primary);
    box-shadow: 0 4px 16px rgba(0, 0, 0, .22), 0 22px 60px rgba(0, 0, 0, .38);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  .tm-comments-panel .tm-comments-filter-menu button { color: var(--tm-text-primary); }
  .tm-comments-panel .tm-comments-filter-menu button:hover { background: rgba(251, 250, 246, .06); }
  .tm-comments-panel .tm-comments-filter-menu select { border-color: rgba(251, 250, 246, .18); background: var(--tm-raised); color: var(--tm-text-primary); }

  /* Inbox rows. */
  .tm-inbox { list-style: none; margin: 0; padding: 0; overflow: auto; flex: 1; }
  .tm-inbox-item {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    border: 0;
    border-bottom: 1px solid rgba(251, 250, 246, .08);
    background: transparent;
    color: var(--tm-text-primary);
    text-align: left;
    cursor: pointer;
  }
  .tm-inbox-item:hover,
  .tm-inbox-item:focus-visible { background: rgba(251, 250, 246, .04); }
  .tm-inbox-item.is-unread { background: rgba(251, 250, 246, .03); }
  .tm-inbox-item__body { display: grid; gap: 4px; min-width: 0; }
  .tm-inbox-item__meta { display: flex; align-items: center; gap: 8px; min-height: 20px; }
  .tm-inbox-item__meta strong { font: 600 13px/18px var(--tm-font); }
  .tm-inbox-item__meta time { color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-inbox-item__dot { width: 6px; height: 6px; margin-left: auto; border-radius: 50%; background: var(--tm-action-primary); }
  .tm-inbox-item__text { font: 400 14px/20px var(--tm-font); }
  .tm-inbox-item__route { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font-mono); }

  /* Wide screens: the panel runs full height and the bar centres in the space that is left.
     Narrower screens: the panel stops above the bar so both stay usable. */
  @media (min-width: 1100px) {
    .tm-root:has(.tm-comments-panel:not([hidden])) .tm-modebar.tm-bar--at-bottom-center:not([style*="left"]) { right: 396px; }
  }
  @media (max-width: 1099px) {
    .tm-comments-panel { bottom: 76px; }
  }

  /* New reply / mention mood on the bar. */
  .tm-bar__dot--reply { background: var(--tm-action-primary); }

  @media (forced-colors: active) {
    .tm-comments-panel { border: 1px solid CanvasText; background: Canvas; color: CanvasText; box-shadow: none; }
  }

  /* Next steps (Figma "Next step"): a checkbox row, the step in 14px, mono meta; open rows show who
     asked for it. Progress is a thin Lime bar. */
  .tm-comments-panel .tm-next-steps { overflow: auto; flex: 1; }
  .tm-comments-panel .tm-next-steps__summary { padding: 12px 16px 8px; border-bottom: 1px solid rgba(251, 250, 246, .08); }
  .tm-comments-panel .tm-next-steps__progress { color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-comments-panel .tm-next-steps__progress strong { color: var(--tm-text-primary); }
  .tm-comments-panel .tm-next-steps__bar { height: 3px; border-radius: 2px; background: rgba(251, 250, 246, .12); }
  .tm-comments-panel .tm-next-steps__bar span { border-radius: 2px; background: var(--tm-action-primary); }
  .tm-comments-panel .tm-next-steps__list { margin: 0; padding: 0; }
  .tm-comments-panel .tm-next-step { border-bottom: 1px solid rgba(251, 250, 246, .08); }
  .tm-comments-panel .tm-next-step.is-open { background: rgba(251, 250, 246, .04); }
  .tm-comments-panel .tm-next-step__row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px 10px; }
  .tm-comments-panel .tm-next-step__check {
    appearance: none;
    -webkit-appearance: none;
    flex: none;
    width: 18px;
    height: 18px;
    margin: 1px 0 0;
    border: 1.5px solid rgba(251, 250, 246, .32);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  .tm-comments-panel .tm-next-step__check:checked {
    border-color: var(--tm-action-primary);
    background: var(--tm-action-primary) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230E1714' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5L10 17.5L19 7'/%3E%3C/svg%3E") center/12px no-repeat;
  }
  .tm-comments-panel .tm-next-step__check:disabled { cursor: default; opacity: .6; }
  .tm-comments-panel .tm-next-step__check:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  .tm-comments-panel .tm-next-step__summary { display: grid; gap: 4px; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
  .tm-comments-panel .tm-next-step__title { color: var(--tm-text-primary); font: 400 14px/20px var(--tm-font); }
  .tm-comments-panel .tm-next-step.is-done .tm-next-step__title { color: var(--tm-text-secondary); text-decoration: line-through; text-decoration-color: rgba(163, 173, 168, .5); }
  .tm-comments-panel .tm-next-step__meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font-mono); }
  .tm-comments-panel .tm-next-step__count { display: inline-flex; align-items: center; gap: 4px; }
  .tm-comments-panel .tm-step-tag { border-radius: 4px; padding: 0 5px; background: rgba(251, 250, 246, .10); color: var(--tm-text-secondary); font: 500 11px/16px var(--tm-font); }
  .tm-comments-panel .tm-next-step__details { display: grid; gap: 10px; padding: 0 16px 12px 44px; }
  .tm-comments-panel .tm-next-step__notes { margin: 0; padding: 10px 12px; border: 1px solid rgba(251, 250, 246, .14); border-radius: var(--tm-radius-button); color: var(--tm-text-primary); font: 400 13px/20px var(--tm-font-mono); }
  .tm-comments-panel .tm-next-step__sources { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .tm-comments-panel .tm-next-step__sources button { display: grid; gap: 2px; width: 100%; padding: 4px 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
  .tm-comments-panel .tm-next-step__source-who { display: flex; gap: 8px; align-items: baseline; font: 400 12px/16px var(--tm-font); color: var(--tm-text-secondary); }
  .tm-comments-panel .tm-next-step__source-who strong { color: var(--tm-text-primary); font: 600 13px/18px var(--tm-font); }
  .tm-comments-panel .tm-next-step__sources q { color: var(--tm-text-secondary); font: 400 13px/18px var(--tm-font); }
  .tm-comments-panel .tm-next-step__provenance { margin: 0; color: var(--tm-text-secondary); font: 400 11px/14px var(--tm-font); }
`;
