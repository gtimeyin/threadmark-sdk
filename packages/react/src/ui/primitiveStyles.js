// Styles for src/ui/primitives.jsx, taken from the Figma UI Components page (sizes, padding,
// fills and type per variant). They assume the dark review chrome; .tm-ui-light flips a subtree to
// the light surface (paper, ink, hairline) for cards that sit on the host page.
export const primitiveStyles = `
  .tm-ui-button {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 32px; padding: 7px 12px; border: 1px solid transparent; border-radius: var(--tm-radius-button);
    font: 600 13px/18px var(--tm-font); letter-spacing: 0; white-space: nowrap; cursor: pointer;
    transition: background var(--tm-motion-fast) var(--tm-ease-standard), border-color var(--tm-motion-fast) var(--tm-ease-standard), color var(--tm-motion-fast) var(--tm-ease-standard);
  }
  .tm-ui-button--sm { min-height: 30px; padding: 6px 10px; }
  .tm-ui-button--mini { min-height: 28px; padding: 7px 12px; font-size: 11px; font-weight: 500; line-height: 14px; }
  .tm-ui-button__icon { width: 16px; height: 16px; flex: none; }
  .tm-ui-button--primary { background: var(--tm-action-primary); color: var(--tm-ground); }
  .tm-ui-button--primary:hover:not(:disabled) { background: var(--tm-action-primary-hover); }
  .tm-ui-button--secondary { background: rgba(251, 250, 246, .10); color: var(--tm-text-primary); }
  .tm-ui-button--secondary:hover:not(:disabled) { background: rgba(251, 250, 246, .16); }
  .tm-ui-button--forest { background: var(--tm-forest); color: #fff; }
  .tm-ui-button--forest:hover:not(:disabled) { background: var(--tm-forest-hover); }
  .tm-ui-button--record { background: var(--tm-orange); color: #fff; }
  .tm-ui-button--record:hover:not(:disabled) { background: #d9481a; }
  .tm-ui-button--outline { background: transparent; border-color: rgba(20, 32, 28, .15); color: var(--tm-ink); }
  .tm-ui-button--outline:hover:not(:disabled) { background: rgba(20, 32, 28, .05); }
  .tm-ui-button--outline-dark { background: transparent; border-color: rgba(251, 250, 246, .15); color: var(--tm-text-primary); }
  .tm-ui-button--outline-dark:hover:not(:disabled) { background: rgba(251, 250, 246, .06); }
  .tm-ui-button:disabled { opacity: .4; cursor: default; }
  .tm-ui-button .tm-ui-key { margin-left: 2px; }
  .tm-ui-button--primary .tm-ui-key { border-color: rgba(14, 23, 20, .22); color: rgba(14, 23, 20, .7); }

  .tm-ui-icon-button {
    display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; padding: 0;
    border: 1px solid transparent; border-radius: var(--tm-radius-button); background: transparent;
    color: var(--tm-text-secondary); cursor: pointer;
    transition: background var(--tm-motion-fast) var(--tm-ease-standard), color var(--tm-motion-fast) var(--tm-ease-standard);
  }
  .tm-ui-icon-button--28 { width: 28px; height: 28px; }
  .tm-ui-icon-button svg { width: 18px; height: 18px; }
  .tm-ui-icon-button--28 svg { width: 16px; height: 16px; }
  .tm-ui-icon-button--ghost:hover:not(:disabled), .tm-ui-icon-button--ghost[aria-pressed="true"] { background: rgba(251, 250, 246, .08); color: var(--tm-text-primary); }
  .tm-ui-icon-button--secondary { background: rgba(251, 250, 246, .10); color: var(--tm-text-primary); }
  .tm-ui-icon-button--primary { background: var(--tm-action-primary); color: var(--tm-ground); }
  .tm-ui-icon-button--record { background: var(--tm-orange); color: #fff; }
  .tm-ui-icon-button--forest { background: var(--tm-forest); color: #fff; }
  .tm-ui-icon-button--outline-dark { border-color: rgba(251, 250, 246, .15); color: var(--tm-text-primary); }
  .tm-ui-icon-button:disabled { opacity: .4; cursor: default; }

  .tm-ui-key {
    display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 1px 5px; box-sizing: border-box;
    border: 1px solid rgba(251, 250, 246, .18); border-radius: 4px;
    font: 400 12px/16px var(--tm-font); color: var(--tm-text-secondary); white-space: nowrap;
  }
  .tm-ui-tag {
    display: inline-flex; align-items: center; height: 16px; padding: 1px 6px; border-radius: 4px; box-sizing: border-box;
    background: rgba(251, 250, 246, .10); color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); white-space: nowrap;
  }
  .tm-ui-tag--lime { background: var(--tm-action-primary); color: var(--tm-ground); }
  .tm-ui-tag--orange { background: rgba(241, 87, 34, .16); color: var(--tm-orange-on-dark); }
  .tm-ui-chip {
    display: inline-flex; align-items: center; gap: 6px; min-height: 18px; padding: 2px 4px 2px 8px; border-radius: 4px;
    background: rgba(251, 250, 246, .10); color: var(--tm-text-primary); font: 500 11px/14px var(--tm-font);
  }
  .tm-ui-chip__remove { display: grid; place-items: center; width: 14px; height: 14px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--tm-text-secondary); cursor: pointer; }
  .tm-ui-chip__remove svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
  .tm-ui-chip__remove:hover { color: var(--tm-text-primary); background: rgba(251, 250, 246, .1); }

  .tm-ui-notice { display: grid; gap: 8px; padding: 10px 12px; border-radius: var(--tm-radius-button); color: var(--tm-text-primary); font: 500 12px/16px var(--tm-font); }
  .tm-ui-notice__row { display: flex; gap: 8px; align-items: flex-start; }
  .tm-ui-notice__icon { width: 16px; height: 16px; flex: none; margin-top: 0; }
  .tm-ui-notice__message { min-width: 0; }
  .tm-ui-notice__actions { display: flex; gap: 8px; flex-wrap: wrap; padding-left: 24px; }
  .tm-ui-notice--dark.tm-ui-notice--problem { background: rgba(241, 87, 34, .12); }
  .tm-ui-notice--dark.tm-ui-notice--problem .tm-ui-notice__icon { color: var(--tm-orange-on-dark); }
  .tm-ui-notice--dark.tm-ui-notice--info { background: rgba(251, 250, 246, .06); }
  .tm-ui-notice--dark.tm-ui-notice--info .tm-ui-notice__icon { color: var(--tm-text-secondary); }
  .tm-ui-notice--dark.tm-ui-notice--done { background: rgba(224, 243, 84, .12); }
  .tm-ui-notice--dark.tm-ui-notice--done .tm-ui-notice__icon { color: var(--tm-action-primary); }
  .tm-ui-notice--light { padding: 8px 10px; color: var(--tm-ink); }
  .tm-ui-notice--light.tm-ui-notice--problem { background: rgba(241, 87, 34, .08); }
  .tm-ui-notice--light.tm-ui-notice--problem .tm-ui-notice__icon { color: var(--tm-orange-text); }
  .tm-ui-notice--light.tm-ui-notice--info { background: rgba(20, 32, 28, .05); }
  .tm-ui-notice--light.tm-ui-notice--info .tm-ui-notice__icon { color: var(--tm-stone); }
  .tm-ui-notice--light.tm-ui-notice--done { background: rgba(3, 93, 71, .08); }
  .tm-ui-notice--light.tm-ui-notice--done .tm-ui-notice__icon { color: var(--tm-forest); }

  .tm-ui-toast {
    display: inline-flex; align-items: center; gap: 12px; min-height: 34px; padding: 8px 10px 8px 14px; box-sizing: border-box;
    border-radius: var(--tm-radius-panel); background: var(--tm-ground); color: var(--tm-text-primary);
    font: 600 13px/18px var(--tm-font); box-shadow: var(--tm-shadow-float);
  }
  .tm-ui-toast button { border: 0; background: none; padding: 0; color: var(--tm-action-primary); font: inherit; cursor: pointer; }

  .tm-ui-switch { display: flex; align-items: center; justify-content: space-between; gap: 16px; cursor: pointer; color: var(--tm-text-primary); font: 400 13px/18px var(--tm-font); }
  .tm-ui-switch.is-disabled { cursor: default; opacity: .5; }
  .tm-ui-switch__text { display: grid; gap: 2px; min-width: 0; }
  .tm-ui-switch__description { color: var(--tm-text-secondary); font-size: 12px; line-height: 16px; }
  .tm-ui-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
  .tm-ui-switch__track { position: relative; flex: none; width: 28px; height: 16px; border-radius: 8px; background: rgba(251, 250, 246, .16); transition: background var(--tm-motion-fast) var(--tm-ease-standard); }
  .tm-ui-switch__knob { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--tm-paper); transition: transform var(--tm-motion-fast) var(--tm-ease-standard); }
  .tm-ui-switch input:checked + .tm-ui-switch__track { background: var(--tm-action-primary); }
  .tm-ui-switch input:checked + .tm-ui-switch__track .tm-ui-switch__knob { transform: translateX(12px); background: var(--tm-ground); }
  .tm-ui-switch input:focus-visible + .tm-ui-switch__track { outline: 2px solid var(--tm-focus); outline-offset: 2px; }

  .tm-ui-field { display: grid; gap: 6px; }
  .tm-ui-field__label { color: var(--tm-text-secondary); font: 500 12px/16px var(--tm-font); }
  .tm-ui-field__hint { margin: 0; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-ui-field__hint.is-error { color: var(--tm-orange-on-dark); }
  .tm-ui-input {
    display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 9px 12px; box-sizing: border-box;
    border: 1px solid rgba(251, 250, 246, .18); border-radius: var(--tm-radius-button); background: transparent; color: var(--tm-text-primary);
    transition: border-color var(--tm-motion-fast) var(--tm-ease-standard);
  }
  .tm-ui-input--sm { min-height: 34px; padding: 6px 10px; gap: 6px; }
  .tm-ui-input:focus-within { border-color: rgba(224, 243, 84, .6); }
  .tm-ui-input.is-error { border-color: rgba(241, 87, 34, .8); }
  .tm-ui-input.is-readonly { background: var(--tm-surface); border-color: rgba(251, 250, 246, .10); font-size: 12px; }
  .tm-ui-input input { flex: 1; min-width: 0; border: 0; padding: 0; outline: none; background: transparent; color: inherit; font: 400 14px/20px var(--tm-font); }
  .tm-ui-input.is-readonly input { font: 400 12px/16px var(--tm-font-mono); }
  .tm-ui-input input::placeholder { color: var(--tm-text-secondary); }

  .tm-ui-segmented { display: flex; gap: 2px; padding: 2px; border-radius: var(--tm-radius-button); background: rgba(251, 250, 246, .06); }
  .tm-ui-segment {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 26px; padding: 4px 10px;
    border: 0; border-radius: 4px; background: transparent; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); cursor: pointer;
  }
  .tm-ui-segment svg { width: 14px; height: 14px; }
  .tm-ui-segment.is-selected { background: rgba(251, 250, 246, .10); color: var(--tm-text-primary); }

  .tm-ui-avatar {
    display: inline-grid; place-items: center; flex: none; width: 28px; height: 28px; overflow: hidden; border-radius: 50%;
    background: var(--tm-sage); color: var(--tm-forest); font: 500 11px/14px var(--tm-font); user-select: none;
  }
  .tm-ui-avatar--20 { width: 20px; height: 20px; color: var(--tm-ground); }
  .tm-ui-avatar--40 { width: 40px; height: 40px; font-size: 15px; }
  .tm-ui-avatar--face { background: var(--tm-raised); }
  .tm-ui-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }

  .tm-ui-empty { display: grid; justify-items: center; gap: 6px; padding: 32px 24px; text-align: center; color: var(--tm-text-secondary); font: 400 13px/18px var(--tm-font); }
  .tm-ui-empty__icon { display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 6px; border-radius: var(--tm-radius-panel); background: rgba(251, 250, 246, .06); color: var(--tm-action-primary); }
  .tm-ui-empty__icon svg { width: 20px; height: 20px; }
  .tm-ui-empty__title { margin: 0; color: var(--tm-text-primary); font-weight: 600; }
  .tm-ui-empty__body { margin: 0; max-width: 32ch; }
  .tm-ui-empty__actions { display: flex; gap: 8px; margin-top: 10px; }

  .tm-ui-light .tm-ui-tag { background: rgba(20, 32, 28, .06); color: var(--tm-stone); }
  .tm-ui-light .tm-ui-key { border-color: rgba(20, 32, 28, .18); color: var(--tm-stone); }
  .tm-ui-light .tm-ui-icon-button--ghost { color: var(--tm-stone); }
  .tm-ui-light .tm-ui-icon-button--ghost:hover:not(:disabled) { background: rgba(20, 32, 28, .06); color: var(--tm-ink); }

  @media (prefers-reduced-motion: reduce) {
    .tm-ui-button, .tm-ui-icon-button, .tm-ui-switch__track, .tm-ui-switch__knob, .tm-ui-input { transition: none; }
  }
`;
