// Composer extras that render without the video chunk: the playback attachment, the Comment /
// Question / Poll switch, the poll editor and posted polls. Moved out of videoStyles.js so they are
// styled the moment the composer opens, not only after a video feature has loaded.
export const composerExtrasStyles = `
  .tm-replay-attachment,
  .tm-replay-open {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 9px;
    border: 1px solid var(--tm-line);
    border-radius: var(--tm-radius-panel);
    padding: 9px 10px;
    background: var(--tm-raised);
    color: var(--tm-text-primary);
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-replay-attachment .tm-tool-icon,
  .tm-replay-open .tm-tool-icon { width: 16px; height: 16px; color: var(--tm-action-primary); }
  .tm-replay-attachment strong,
  .tm-replay-attachment span,
  .tm-replay-open strong,
  .tm-replay-open small { display: block; }
  .tm-replay-attachment strong,
  .tm-replay-open strong { font-size: 11px; line-height: 15px; }
  .tm-replay-attachment span,
  .tm-replay-open small { margin-top: 1px; color: var(--tm-text-secondary); font-size: 10px; line-height: 13px; }
  .tm-replay-attachment button {
    height: 28px;
    border: 0;
    border-radius: var(--tm-radius-button);
    padding: 0 9px;
    background: rgba(255,255,255,.08);
    color: var(--tm-text-primary);
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
  }
  .tm-replay-attachment button:hover { background: rgba(255,255,255,.14); }
  .tm-replay-attachment.is-removed .tm-tool-icon { color: var(--tm-text-secondary); }
  .tm-replay-attachment--pending {
    margin: 0;
    color: var(--tm-text-secondary);
    font-size: 10px;
  }
  .tm-replay-open {
    /* Stretch, don't size to 100%: in a saved thread the row also has side margins, and 100% plus those
       pushed it past the card's right edge. */
    width: auto;
    justify-self: stretch;
    min-width: 0;
    box-sizing: border-box;
    grid-template-columns: 18px minmax(0, 1fr);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--tm-motion-fast) ease, border-color var(--tm-motion-fast) ease;
  }
  .tm-replay-open:hover:not(:disabled) { border-color: var(--tm-line-strong); background: #24332d; }
  .tm-replay-open:disabled { cursor: default; opacity: .6; }

  /* Polls on a comment, and older question tags --------------------------------------------------------------------------- */
  .tm-poll-editor { display: grid; gap: 6px; margin: 8px 0 0; border: 0; padding: 0; min-width: 0; }
  .tm-poll-editor__row { display: flex; gap: 6px; }
  .tm-poll-editor__row input {
    flex: 1;
    min-width: 0;
    height: 30px;
    border: 1px solid var(--tm-line);
    border-radius: var(--tm-radius-button);
    padding: 0 9px;
    background: var(--tm-raised);
    color: var(--tm-text-primary);
    font: 12px/1.3 var(--tm-font);
  }
  .tm-poll-editor__row input:focus { outline: 2px solid var(--tm-focus); outline-offset: 1px; }
  .tm-poll-editor__row button,
  .tm-poll-editor__add {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    border: 0;
    border-radius: var(--tm-radius-button);
    padding: 0 8px;
    background: transparent;
    color: var(--tm-text-secondary);
    font: 600 11px/1 var(--tm-font);
    cursor: pointer;
  }
  .tm-poll-editor__row button:hover,
  .tm-poll-editor__add:hover { background: rgba(255,255,255,.06); color: var(--tm-text-primary); }
  .tm-poll-editor__footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }
  .tm-poll-editor__header { display: flex; align-items: center; gap: 6px; height: 24px; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-poll-editor__header > svg { flex: none; color: var(--tm-lime); }
  .tm-poll-editor__remove {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-left: auto;
    border: 0;
    border-radius: var(--tm-radius-button);
    padding: 0;
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
  }
  .tm-poll-editor__remove:hover { background: rgba(255,255,255,.06); color: var(--tm-text-primary); }
  .tm-poll-editor__multiple { display: inline-flex; align-items: center; gap: 6px; color: var(--tm-text-secondary); font-size: 11px; }
  .tm-ask-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0 2px 38px;
    color: var(--tm-action-primary);
    font-size: 11px;
    font-weight: 600;
  }
  .tm-poll {
    display: grid;
    gap: 6px;
    margin: 2px 0 4px 38px;
    border: 1px solid var(--tm-line);
    border-radius: var(--tm-radius-panel);
    padding: 9px;
    background: var(--tm-raised);
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-poll__header { display: flex; align-items: center; gap: 6px; color: var(--tm-text-secondary); font-size: 11px; }
  .tm-poll__header svg { color: var(--tm-action-primary); }
  .tm-poll__header strong { color: var(--tm-text-primary); }
  .tm-poll__total { margin-left: auto; }
  .tm-poll__options { display: grid; gap: 5px; }
  .tm-poll-option {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 32px;
    overflow: hidden;
    border: 1px solid var(--tm-line);
    border-radius: var(--tm-radius-button);
    padding: 0 9px;
    background: transparent;
    color: var(--tm-text-primary);
    font: 12px/1.3 var(--tm-font);
    text-align: left;
    cursor: pointer;
  }
  .tm-poll-option:hover:not(:disabled) { border-color: var(--tm-line-strong); }
  .tm-poll-option:disabled { cursor: default; }
  .tm-poll-option.is-chosen { border-color: var(--tm-action-primary); }
  .tm-poll-option__bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: color-mix(in srgb, var(--tm-action-primary) 18%, transparent);
    transition: width var(--tm-motion-standard) var(--tm-ease-standard);
  }
  .tm-poll-option__label,
  .tm-poll-option__count { position: relative; display: inline-flex; align-items: center; gap: 5px; }
  .tm-poll-option__label svg { color: var(--tm-action-primary); }
  .tm-poll-option__count { color: var(--tm-text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tm-poll__hint { color: var(--tm-text-soft); font-size: 10px; }
  @media (prefers-reduced-motion: reduce) {
    .tm-poll, .tm-poll-option__bar { animation: none; transition: none; }
  }

  /* A saved comment whose screenshot couldn't be taken: one quiet line, not an error box. */
  .tm-snapshot:has(.tm-snapshot__note) { border: 0; background: none; }
  .tm-snapshot__note { margin: 0; color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font); }
`;
