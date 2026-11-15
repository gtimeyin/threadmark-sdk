// AI review (board 12): setup, the reading band, draft pins, the review panel and the Ask AI card.
export const aiStyles = `
  .tm-ai-sheet { width: min(420px, 100%); }
  .tm-ai-sheet .tm-you__header svg { color: var(--tm-lime); }
  .tm-ai-setup { gap: 16px; }
  .tm-ai-setup .tm-you__footer { margin-top: 2px; }
  .tm-ai-note { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-ai-note button { padding: 0; border: 0; background: none; color: var(--tm-text-primary); font: inherit; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  .tm-ai-eyebrow { margin: 0; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); letter-spacing: .04em; text-transform: uppercase; }
  .tm-ai-looks ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
  .tm-ai-looks li { display: flex; gap: 10px; font: 400 14px/20px var(--tm-font); }
  .tm-ai-looks li svg { flex: none; width: 16px; height: 16px; margin-top: 2px; color: var(--tm-lime); }
  .tm-ai-looks ul.is-never li { color: var(--tm-text-secondary); }
  .tm-ai-looks ul.is-never li svg { color: var(--tm-text-secondary); }

  .tm-ai-band { position: fixed; z-index: 20; left: 0; right: 0; height: 120px; pointer-events: none;
    background: linear-gradient(to bottom, rgba(224, 243, 84, 0), rgba(224, 243, 84, .16) 70%, rgba(224, 243, 84, .32));
    border-bottom: 1px solid rgba(224, 243, 84, .7); animation: tm-ai-read 3.2s var(--tm-ease-standard, ease-in-out) infinite; }
  @keyframes tm-ai-read { from { top: -120px; } to { top: 100vh; } }
  /* 27c: while AI reads the page, its status takes the bar's place. */
  .tm-root:has(.tm-bar-status) .tm-modebar:not(.tm-bar-status), .tm-root:has(.tm-bar-status) .tm-bar { visibility: hidden; }
  .tm-ai-panel__header h2:focus { outline: none; }
  .tm-ai-setup .tm-send__go { flex: none; white-space: nowrap; }

  .tm-ai-pin { position: fixed; z-index: 25; width: 22px; height: 22px; display: grid; place-items: center; padding: 0;
    border: 1.5px solid var(--tm-lime); border-radius: 11px 11px 11px 3px; background: var(--tm-ground); color: var(--tm-lime);
    font: 600 11px/1 var(--tm-font); cursor: pointer; pointer-events: auto; box-shadow: 0 2px 8px rgba(14, 23, 20, .3); }
  .tm-ai-pin.is-active { background: var(--tm-lime); color: var(--tm-ground); }

  .tm-ai-panel { display: flex; flex-direction: column; overflow: hidden; }
  .tm-ai-panel__header { display: flex; align-items: center; gap: 8px; padding: 12px 12px 10px; }
  .tm-ai-panel__header h2 { margin: 0; font: 600 13px/18px var(--tm-font); }
  .tm-ai-panel__header span { flex: 1; min-width: 0; overflow: hidden; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); white-space: nowrap; text-overflow: ellipsis; }
  .tm-ai-panel__header button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-secondary); cursor: pointer; }
  .tm-ai-panel__header button:hover { background: rgba(251, 250, 246, .08); color: var(--tm-text-primary); }
  .tm-ai-panel__icon { color: var(--tm-lime); }
  .tm-ai-panel__body { flex: 1; min-height: 0; overflow: auto; }
  .tm-ai-summary { padding: 0 16px 12px; border-bottom: 1px solid rgba(251, 250, 246, .08); }
  .tm-ai-summary p { margin: 0 0 4px; font: 400 15px/21px var(--tm-font); }
  .tm-ai-summary small { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-ai-pad { padding: 12px 16px 0; }
  .tm-ai-stopped { margin: 0 12px 4px; }
  .tm-ai-findings { margin: 0; padding: 0; list-style: none; }
  .tm-ai-findings li { display: flex; gap: 10px; padding: 14px 16px; border-bottom: 1px solid rgba(251, 250, 246, .08); }
  .tm-ai-findings li.is-active { background: var(--tm-surface); }
  .tm-ai-findings li > div { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .tm-ai-findings strong { font: 600 14px/20px var(--tm-font); }
  .tm-ai-findings li > div > p:not(.tm-ai-eyebrow):not(.tm-ai-posted) { margin: 0; color: var(--tm-text-secondary); font: 400 12px/17px var(--tm-font); }
  .tm-ai-findings code { color: var(--tm-text-secondary); font: 400 11px/16px var(--tm-font-mono); }
  .tm-ai-number { flex: none; width: 20px; height: 20px; display: grid; place-items: center; border: 1.5px solid var(--tm-lime); border-radius: 10px 10px 10px 3px; color: var(--tm-lime); font: 600 11px/1 var(--tm-font); }
  .tm-ai-actions { position: relative; display: flex; align-items: center; gap: 10px; margin-top: 6px; }
  .tm-ai-actions .tm-share__button { height: 30px; font-size: 12px; font-weight: 500; }
  .tm-ai-link { padding: 0 2px; border: 0; background: none; color: var(--tm-text-secondary); font: 500 12px/16px var(--tm-font); cursor: pointer; }
  .tm-ai-link:hover { color: var(--tm-text-primary); }
  .tm-ai-posted { margin: 4px 0 0; color: var(--tm-lime); font: 500 12px/16px var(--tm-font); }
  .tm-ai-dismiss { position: absolute; z-index: 3; top: 34px; left: 90px; min-width: 200px; display: grid; padding: 6px; border-radius: var(--tm-radius-panel);
    background: var(--tm-ground); box-shadow: 0 12px 30px rgba(0, 0, 0, .35), 0 0 0 1px rgba(251, 250, 246, .1); }
  .tm-ai-dismiss .tm-ai-eyebrow { padding: 6px 8px 4px; }
  .tm-ai-dismiss button { padding: 8px; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-primary); font: 500 13px/18px var(--tm-font); text-align: left; cursor: pointer; }
  .tm-ai-dismiss button:hover, .tm-ai-dismiss button:focus-visible { background: var(--tm-surface); }
  .tm-ai-empty { display: grid; justify-items: center; gap: 8px; padding: 48px 24px; text-align: center; }
  .tm-ai-empty svg { color: var(--tm-text-secondary); }
  .tm-ai-empty p { margin: 0 0 6px; color: var(--tm-text-secondary); font: 400 12px/17px var(--tm-font); }
  .tm-ai-panel__footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 16px 12px; border-top: 1px solid rgba(251, 250, 246, .08); color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }

  .tm-ask-ai { display: inline-flex !important; width: auto !important; align-items: center; gap: 6px; padding: 0 8px !important; color: var(--tm-lime) !important; font: 500 12px/16px var(--tm-font); }
  .tm-ai-card { position: fixed; z-index: 70; display: grid; gap: 10px; padding: 12px 14px 14px; border-radius: var(--tm-radius-popover, 16px); background: var(--tm-ground);
    color: var(--tm-text-primary); box-shadow: 0 22px 60px rgba(0, 0, 0, .38), 0 0 0 1px rgba(251, 250, 246, .08); font: 400 13px/18px var(--tm-font); outline: none; pointer-events: auto;
    animation: tm-popover-in-below var(--tm-motion-surface) var(--tm-ease-emphasized) both; }
  .tm-ai-card header { display: flex; align-items: center; gap: 8px; }
  .tm-ai-card header > svg { color: var(--tm-lime); }
  .tm-ai-card header h2 { flex: 1; min-width: 0; margin: 0; overflow: hidden; font: 600 13px/18px var(--tm-font); white-space: nowrap; text-overflow: ellipsis; }
  .tm-ai-card header button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-secondary); cursor: pointer; }
  .tm-ai-card__body { display: grid; gap: 10px; max-height: 50vh; overflow: auto; }
  .tm-ai-turn { display: grid; gap: 10px; }
  .tm-ai-turn ol { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .tm-ai-turn li { display: flex; gap: 10px; font: 400 14px/20px var(--tm-font); }
  .tm-ai-turn li span { flex: none; color: var(--tm-lime); font-weight: 600; }
  .tm-ai-question { justify-self: end; margin: 0; padding: 6px 10px; border-radius: var(--tm-radius-button); background: var(--tm-raised); }
  .tm-ai-fix { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid rgba(251, 250, 246, .08); border-radius: var(--tm-radius-button); background: var(--tm-surface); }
  .tm-ai-fix p:last-child { margin: 0; font: 400 12px/18px var(--tm-font-mono); }
  .tm-ai-quiet { margin: 0; color: var(--tm-text-secondary); }
  .tm-ai-thinking::after { content: ""; display: inline-block; width: 6px; height: 6px; margin-left: 6px; border-radius: 50%; background: var(--tm-lime); animation: tm-ai-pulse 1s ease-in-out infinite alternate; }
  @keyframes tm-ai-pulse { from { opacity: .3; } }
  .tm-ai-card__actions { display: flex; gap: 8px; }
  .tm-ai-card__actions .tm-share__button { height: 34px; }
  .tm-ai-follow { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 8px 0 12px; border: 1px solid rgba(251, 250, 246, .12); border-radius: var(--tm-radius-button); background: var(--tm-surface); }
  .tm-ai-follow input { flex: 1; min-width: 0; padding: 0; border: 0; background: none; color: var(--tm-text-primary); font: inherit; outline: none; }
  .tm-ai-follow input::placeholder { color: var(--tm-text-secondary); }
  .tm-from-ai { display: inline-flex; align-items: center; gap: 4px; color: var(--tm-lime); font: 500 11px/16px var(--tm-font); }
  .tm-from-ai svg { width: 12px; height: 12px; }

  @media (prefers-reduced-motion: reduce) {
    .tm-ai-band { animation: none; top: auto; bottom: 0; height: 4px; }
    .tm-ai-thinking::after, .tm-ai-card { animation: none; }
  }
  @media (forced-colors: active) {
    .tm-ai-pin, .tm-ai-number { forced-color-adjust: none; border-color: Highlight; color: Highlight; background: Canvas; }
    .tm-ai-band { display: none; }
  }
`;
