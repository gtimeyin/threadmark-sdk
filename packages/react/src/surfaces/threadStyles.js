// Composer and Thread (Figma "Composer" 64:10, "Thread" 64:54, "Comment row" 264:846, "Reaction").
// Both are a 360px dark card (surface, 8px radius, 4px inset) with a mono context strip on top and a
// sunken inner panel (24% black, 8% hairline, 6px radius). Loaded after the base overlay styles.
export const threadStyles = `
  .tm-popover,
  .tm-popover.tm-popover--thread {
    width: min(360px, calc(100vw - 24px));
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: var(--tm-radius-panel);
    background: var(--tm-surface);
    box-shadow: 0 4px 16px rgba(0, 0, 0, .22), 0 22px 60px rgba(0, 0, 0, .38);
  }

  /* Context strip: "#1 · Button · Start free" or the picked element, in mono. */
  .tm-popover .tm-popover__header,
  .tm-popover.tm-popover--thread .tm-popover__header--thread {
    min-height: 24px;
    margin: 0;
    padding: 0 4px 0 8px;
    align-items: center;
    gap: 8px;
  }
  .tm-popover .tm-popover__header h2,
  .tm-popover.tm-popover--thread .tm-popover__header--thread h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--tm-text-secondary);
    font: 400 12px/16px var(--tm-font-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-popover .tm-context-disclosure { flex: 1; min-width: 0; }
  .tm-popover .tm-context-disclosure summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
    color: var(--tm-text-secondary);
    font: 400 12px/16px var(--tm-font-mono);
    cursor: pointer;
  }
  .tm-popover .tm-context-disclosure summary > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tm-popover .tm-popover__header > button,
  .tm-popover .tm-thread-header-actions button {
    width: 24px;
    height: 24px;
    min-height: 24px;
    border-radius: var(--tm-radius-button);
    color: var(--tm-text-secondary);
  }
  .tm-popover .tm-thread-header-actions { gap: 0; }
  .tm-popover .tm-thread-header-actions button[aria-label="Reopen comment"] { color: var(--tm-action-primary); }
  .tm-popover .tm-thread-header-actions .tm-tool-icon,
  .tm-popover .tm-popover__header > button svg { width: 16px; height: 16px; }

  /* The inner panel. */
  .tm-popover .tm-form,
  .tm-popover.tm-popover--thread .tm-popover__header--thread + .tm-form {
    margin-top: 4px;
    gap: 12px;
    padding: 12px 10px 10px 12px;
    border: 1px solid rgba(255, 255, 255, .08);
    border-radius: var(--tm-radius-button);
    background: rgba(0, 0, 0, .24);
  }
  .tm-popover.tm-popover--thread .tm-form,
  .tm-popover.tm-popover--thread .tm-popover__header--thread + .tm-form { gap: 0; padding: 0; }
  .tm-popover.tm-popover--thread .tm-form > :not(.tm-thread):not(.tm-reply):not(.tm-form__footer) { margin: 12px; }
  .tm-popover .tm-form__footer:empty { display: none; }

  /* New comment field. */
  .tm-popover .tm-field textarea {
    min-height: 40px;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--tm-text-primary);
    font: 400 14px/20px var(--tm-font);
    box-shadow: none;
  }
  .tm-popover .tm-field textarea:focus,
  .tm-popover .tm-field textarea:focus-visible { outline: none; box-shadow: none; }
  .tm-popover .tm-field textarea::placeholder { color: var(--tm-text-secondary); }
  .tm-popover .tm-form__actions { gap: 4px; }
  .tm-popover .tm-submit {
    min-height: 32px;
    padding: 0 14px;
    border: 1px solid rgba(20, 32, 28, .2);
    border-radius: var(--tm-radius-button);
    background: var(--tm-action-primary);
    color: var(--tm-forest);
    font: 600 13px/18px var(--tm-font);
  }
  .tm-popover .tm-submit:hover:not(:disabled) { background: var(--tm-action-primary-hover); }
  .tm-popover .tm-submit:disabled { background: rgba(251, 250, 246, .1); color: var(--tm-text-secondary); border-color: transparent; }
  .tm-popover .tm-cancel { min-height: 32px; padding: 0 10px; border-radius: var(--tm-radius-button); font: 600 13px/18px var(--tm-font); }

  /* Thread messages: avatar, name and time, the text, then reactions. */
  .tm-popover.tm-popover--thread .tm-thread { gap: 0; padding: 0; }
  .tm-popover.tm-popover--thread .tm-thread-message {
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 10px;
    padding: 12px;
  }
  .tm-popover.tm-popover--thread .tm-thread-message + .tm-thread-message,
  .tm-popover.tm-popover--thread .tm-thread-message--root + * { border-top: 1px solid rgba(255, 255, 255, .12); }
  .tm-popover.tm-popover--thread .tm-thread-message--root { padding-bottom: 12px; border-bottom: 0; }
  .tm-popover .tm-thread-message__avatar {
    width: 28px;
    height: 28px;
    border: 0;
    background: var(--tm-sage);
    color: var(--tm-forest);
    font: 500 11px/14px var(--tm-font);
  }
  .tm-popover.tm-popover--thread .tm-thread-message__meta { min-height: 18px; gap: 8px; }
  .tm-popover.tm-popover--thread .tm-thread-message__meta strong { color: var(--tm-text-primary); font: 600 13px/18px var(--tm-font); }
  .tm-popover.tm-popover--thread .tm-thread-message__meta time { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-popover.tm-popover--thread .tm-thread-message p { margin-top: 4px; color: var(--tm-text-primary); font: 400 14px/20px var(--tm-font); }

  /* Reactions: compact chips; yours are Lime. */
  .tm-popover.tm-popover--thread .tm-reactions { gap: 4px; margin-top: 6px; }
  .tm-popover.tm-popover--thread .tm-reactions button {
    min-height: 24px;
    padding: 2px 8px;
    gap: 4px;
    border: 1px solid transparent;
    border-radius: var(--tm-radius-button);
    background: rgba(255, 255, 255, .07);
    color: var(--tm-text-secondary);
    font: 500 12px/16px var(--tm-font);
  }
  .tm-popover.tm-popover--thread .tm-reactions button[aria-pressed="true"] {
    border-color: rgba(224, 243, 84, .45);
    background: rgba(224, 243, 84, .12);
    color: var(--tm-action-primary);
  }
  .tm-popover.tm-popover--thread .tm-reactions button:hover:not(:disabled) { background: rgba(255, 255, 255, .12); }
  .tm-popover.tm-popover--thread .tm-reactions .tm-reaction-trigger { width: 24px; padding: 2px; }

  /* Reply row along the bottom of the panel. */
  .tm-popover.tm-popover--thread .tm-reply { padding: 8px 8px 8px 12px; border-top: 1px solid rgba(255, 255, 255, .12); }
  .tm-popover.tm-popover--thread .tm-reply__row { display: block; }
  .tm-popover.tm-popover--thread .tm-reply__row > .tm-thread-message__avatar { display: none; }
  .tm-popover.tm-popover--thread .tm-reply__box {
    min-height: 28px;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .tm-popover.tm-popover--thread .tm-reply__box textarea { padding: 4px 0; font: 400 14px/20px var(--tm-font); }
  .tm-popover .tm-reply__send,
  .tm-popover.tm-popover--thread .tm-reply__send {
    width: 28px;
    height: 28px;
    min-height: 28px;
    padding: 0;
    border: 1px solid rgba(20, 32, 28, .14);
    border-radius: var(--tm-radius-button);
    background: var(--tm-action-primary);
    color: var(--tm-ground);
  }
  .tm-popover .tm-reply__send .tm-tool-icon { width: 16px; height: 16px; }
  .tm-popover.tm-popover--thread .tm-reply__send:disabled { background: rgba(251, 250, 246, .1); color: var(--tm-text-secondary); border-color: transparent; }

  /* Comment / Question / Poll uses the brand Segmented control. */

  /* Attachments sit in the panel as small rows, like the design's Screenshot chip. */
  .tm-popover .tm-replay-attachment,
  .tm-popover .tm-replay-open { border: 0; border-radius: var(--tm-radius-button); padding: 6px 8px; background: rgba(255, 255, 255, .07); }
  .tm-popover .tm-replay-attachment strong,
  .tm-popover .tm-replay-open strong { font: 500 11px/14px var(--tm-font); }
  .tm-popover .tm-replay-attachment button { height: 26px; padding: 0 8px; background: rgba(251, 250, 246, .10); font: 600 11px/14px var(--tm-font); }

  /* Polls (Figma "Poll option" and "Poll result"): numbered rows until you vote, then results with a
     thin bar under each answer; the leader is Lime, your pick is ticked. */
  .tm-popover .tm-poll,
  .tm-popover.tm-popover--thread .tm-form > .tm-poll { margin: 0 12px 12px 50px; padding: 0; border: 0; background: transparent; gap: 8px; }
  .tm-popover { overflow-x: hidden; }
  .tm-popover .tm-poll__header { font: 500 11px/14px var(--tm-font); }
  .tm-popover .tm-poll-editor__multiple { margin: 0; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-popover .tm-poll-editor__multiple input { width: 13px; height: 13px; margin: 0; accent-color: var(--tm-lime); }
  .tm-popover .tm-poll__options { gap: 6px; }
  .tm-popover .tm-poll-option {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 0 12px 0 10px;
    border: 1px solid rgba(255, 255, 255, .10);
    border-radius: var(--tm-radius-button);
    background: rgba(255, 255, 255, .03);
    font: 400 14px/20px var(--tm-font);
  }
  .tm-popover .tm-poll-option:hover:not(:disabled) { border-color: rgba(255, 255, 255, .22); background: rgba(255, 255, 255, .05); }
  .tm-popover .tm-poll-option__key {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1px solid rgba(251, 250, 246, .18);
    border-radius: 4px;
    color: var(--tm-text-secondary);
    font: 400 12px/16px var(--tm-font);
  }
  .tm-popover .tm-poll-option__label { gap: 6px; min-width: 0; }
  .tm-popover .tm-poll-option__label svg { color: var(--tm-action-primary); flex: none; }
  .tm-popover .tm-poll-option__votes { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .tm-popover .tm-poll-option__count { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-popover .tm-poll:not(.tm-poll--results) .tm-poll-option__bar { display: none; }
  .tm-popover .tm-poll--results .tm-poll-option {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 34px;
    padding: 0 0 8px;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .tm-popover .tm-poll--results .tm-poll-option__key { display: none; }
  .tm-popover .tm-poll--results .tm-poll-option:not(.is-chosen):not(.is-leading) .tm-poll-option__label { color: var(--tm-text-secondary); }
  .tm-popover .tm-poll--results .tm-poll-option__bar {
    inset: auto auto 0 0;
    height: 3px;
    border-radius: 2px;
    background: rgba(251, 250, 246, .22);
  }
  .tm-popover .tm-poll--results .tm-poll-option.is-leading .tm-poll-option__bar { background: var(--tm-action-primary); }
  .tm-popover .tm-poll--results .tm-poll-option.is-chosen { border: 0; }
  .tm-popover .tm-poll__hint { color: var(--tm-text-secondary); font: 400 11px/14px var(--tm-font); }

  /* Board 01, 2c: the composer is one quiet card — what you picked, the words, then Esc, @, + and a Lime send.
     No inner frame. */
  .tm-popover.tm-popover--compose { width: min(320px, calc(100vw - 24px)); padding: 12px 12px 8px; border-radius: var(--tm-radius-panel); background: var(--tm-ground); }
  .tm-popover--compose .tm-composer__header { align-items: center; gap: 8px; min-height: 20px; margin-bottom: 8px; }
  .tm-composer__target { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; margin: 0; color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font-mono); }
  .tm-composer__target > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tm-composer__target svg { flex: none; width: 13px; height: 13px; color: var(--tm-lime); }
  .tm-popover.tm-popover--compose .tm-form,
  .tm-popover.tm-popover--compose .tm-popover__header + .tm-form { margin: 0; gap: 10px; padding: 0; border: 0; border-radius: 0; background: none; }
  .tm-popover--compose .tm-field textarea { min-height: 40px; resize: none; font: 400 14px/20px var(--tm-font); }
  .tm-composer__actions { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 4px; }
  .tm-popover .tm-composer__esc { min-height: 28px; padding: 0; border: 0; background: none; cursor: pointer; }
  .tm-popover .tm-composer__esc .tm-ui-key { color: var(--tm-text-muted); }
  .tm-composer__esc:hover .tm-ui-key { color: var(--tm-text-primary); }
  .tm-composer__tools { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; }
  .tm-composer__tool { width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-muted); cursor: pointer; }
  .tm-composer__tool:hover:not(:disabled), .tm-composer__tool.is-active { background: rgba(251, 250, 246, .08); color: var(--tm-text-primary); }
  .tm-composer__tool svg { width: 16px; height: 16px; }
  .tm-popover .tm-submit.tm-composer__send { width: 28px; min-height: 28px; height: 28px; margin-left: 4px; display: grid; place-items: center; padding: 0; border: 0; background: var(--tm-lime); color: var(--tm-ground); }
  .tm-popover .tm-submit.tm-composer__send:disabled { background: rgba(251, 250, 246, .1); color: var(--tm-text-secondary); }
  .tm-composer__send .tm-tool-icon { width: 15px; height: 15px; }
  .tm-composer__send .tm-spin { animation: tm-spin 900ms linear infinite; }
  .tm-popover--compose .tm-composer__actions button:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }

  /* 6d: the sketch rides along as a small chip; Esc goes back to drawing. */
  .tm-composer__sketch { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: var(--tm-radius-button); background: var(--tm-surface); }
  .tm-composer__sketch img { flex: none; width: 56px; height: 36px; object-fit: cover; border-radius: 4px; background: var(--tm-raised); }
  .tm-composer__sketch > span { flex: 1; min-width: 0; display: grid; }
  .tm-composer__sketch strong { overflow: hidden; font: 600 13px/18px var(--tm-font); text-overflow: ellipsis; white-space: nowrap; }
  .tm-composer__sketch small { color: var(--tm-text-muted); font: 400 11px/14px var(--tm-font); }
  .tm-composer__sketch button { flex: none; width: 24px; height: 24px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-muted); cursor: pointer; }
  .tm-composer__sketch button:hover { color: var(--tm-text-primary); background: rgba(251, 250, 246, .06); }
  .tm-composer__sketch button svg { width: 14px; height: 14px; }
  .tm-popover .tm-composer__esc--back { display: inline-flex; align-items: center; gap: 8px; color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font); }
  .tm-popover--compose .tm-composer__header:has(.tm-composer__sketch) { margin-bottom: 10px; }

  /* 7g: what was on screen at a timestamp, outlined in Lime for a moment. */
  .tm-video-moment-mark { position: fixed; z-index: 35; border: 2px solid var(--tm-lime); border-radius: var(--tm-radius-panel); background: rgba(224, 243, 84, .08); pointer-events: none; animation: tm-moment-mark 2.4s var(--tm-ease-standard, ease) both; }
  @keyframes tm-moment-mark { 0% { opacity: 0; } 10%, 75% { opacity: 1; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .tm-video-moment-mark { animation: none; } }

  /* 2c: the bar stays visible while you write. */
  .tm-modebar.tm-modebar--writing { pointer-events: none; padding: 8px 10px; }

  /* Board 05, 18c: a thread opened while the panel is open takes the panel's place, with a way back. */
  @media (min-width: 600px) {
    .tm-popover.tm-popover--docked {
      top: 8px; right: 8px; bottom: 8px; left: auto; width: min(380px, calc(100vw - 16px)); max-height: none;
      display: flex; flex-direction: column; padding: 0 8px 8px; border-radius: var(--tm-radius-panel); background: var(--tm-ground); animation: none;
    }
    .tm-popover.tm-popover--docked > * { flex: none; }
    .tm-popover.tm-popover--docked .tm-popover__header--thread { border-bottom: 0; padding-bottom: 4px; }
    .tm-popover.tm-popover--docked .tm-popover__header--thread + .tm-form {
      flex: 1 1 auto; display: flex; flex-direction: column; margin: 0;
    }
    .tm-popover.tm-popover--docked .tm-reply { margin-top: auto; }
  }
  .tm-thread-back { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 -8px 4px; padding: 10px 16px; border-bottom: 1px solid var(--tm-line); }
  .tm-thread-back button { display: inline-flex; align-items: center; gap: 6px; padding: 2px 4px; margin-left: -4px; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-muted); cursor: pointer; font: 500 12px/16px var(--tm-font); }
  .tm-thread-back button:hover { color: var(--tm-text-primary); }
  .tm-thread-back button:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  .tm-thread-back > span { min-width: 0; overflow: hidden; color: var(--tm-text-muted); font: 400 11px/16px var(--tm-font-mono); text-overflow: ellipsis; white-space: nowrap; }
`;
