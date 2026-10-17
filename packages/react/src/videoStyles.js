// Video feedback surfaces share the dark review chrome and motion tokens defined in overlayStyles.
export const videoStyles = `
  .tm-video-icon-button {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: transparent;
    color: var(--tm-text-soft);
    cursor: pointer;
    transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease;
  }
  .tm-video-icon-button:hover:not(:disabled) { background: var(--tm-overlay-subtle); color: var(--tm-text-primary); }
  .tm-video-icon-button:disabled { cursor: not-allowed; opacity: .45; }
  .tm-video-icon-button .tm-tool-icon { width: 15px; height: 15px; }
  .tm-video-icon-button:focus-visible,
  .tm-video-setup button:focus-visible,
  .tm-video-setup select:focus-visible,
  .tm-video-preview button:focus-visible,
  .tm-replay-bar button:focus-visible,
  .tm-video-recorder button:focus-visible {
    outline: 2px solid var(--tm-focus);
    outline-offset: 2px;
  }

  .tm-video-setup {
    position: fixed;
    z-index: 46;
    left: 50%;
    bottom: 24px;
    width: min(420px, calc(100vw - 24px));
    display: grid;
    gap: 12px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 14px;
    padding: 12px;
    background: rgba(26,31,28,.97);
    color: var(--tm-text-primary);
    box-shadow: 0 16px 50px rgba(0,0,0,.32);
    backdrop-filter: blur(14px);
    pointer-events: auto;
    transform: translateX(-50%);
    animation: tm-recorder-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-video-setup__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .tm-video-setup__header strong { font-size: 13px; font-weight: 600; line-height: 18px; }
  .tm-video-setup__modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    border-radius: 10px;
    padding: 3px;
    background: var(--tm-ground);
  }
  .tm-video-setup__modes button {
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease;
  }
  .tm-video-setup__modes button.is-active { background: var(--tm-raised); color: var(--tm-text-primary); }
  .tm-video-setup__modes button:disabled { cursor: not-allowed; opacity: .4; }
  .tm-video-setup__modes .tm-tool-icon { width: 14px; height: 14px; }
  .tm-video-setup__preview {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }
  .tm-video-setup__camera {
    width: 96px;
    height: 96px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 2px solid var(--tm-line-strong);
    border-radius: 50%;
    background: var(--tm-ground);
    object-fit: cover;
    transform: scaleX(-1);
  }
  .tm-video-setup__camera--off { transform: none; color: var(--tm-text-secondary); }
  .tm-video-setup__camera--off .tm-tool-icon { width: 22px; height: 22px; }
  .tm-video-setup__sources { display: grid; gap: 6px; min-width: 0; }
  .tm-video-setup__source { display: grid; gap: 4px; min-width: 0; }
  .tm-video-toggle {
    height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--tm-line);
    border-radius: 8px;
    padding: 0 10px;
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease, border-color var(--tm-motion-fast) ease;
  }
  .tm-video-toggle.is-on { border-color: var(--tm-deep-sage); background: var(--tm-deep-sage); color: var(--tm-text-primary); }
  .tm-video-toggle:disabled { cursor: not-allowed; opacity: .5; }
  .tm-video-toggle .tm-tool-icon { width: 14px; height: 14px; }
  .tm-video-setup__device select {
    width: 100%;
    height: 28px;
    border: 1px solid var(--tm-line);
    border-radius: 7px;
    padding: 0 8px;
    background: var(--tm-ground);
    color: var(--tm-text-soft);
    font-size: 11px;
  }
  .tm-video-setup__hint {
    margin: 0;
    color: var(--tm-text-secondary);
    font-size: 11px;
    line-height: 16px;
  }
  .tm-video-setup__hint.is-error { color: var(--tm-coral-dark); }
  .tm-video-setup__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .tm-video-start,
  .tm-video-danger {
    height: var(--tm-size-action);
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 0;
    border-radius: var(--tm-radius-9);
    padding: 0 14px;
    background: var(--tm-coral-dark);
    color: var(--tm-ground);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    transition: background-color var(--tm-motion-fast) ease, transform var(--tm-motion-fast) var(--tm-ease-standard);
  }
  .tm-video-start:hover:not(:disabled),
  .tm-video-danger:hover { background: #ffa090; }
  .tm-video-start:active:not(:disabled),
  .tm-video-danger:active { transform: scale(.97); }
  .tm-video-start:disabled { cursor: not-allowed; opacity: .5; }
  .tm-video-start .tm-tool-icon { width: 12px; height: 12px; fill: currentColor; }
  .tm-video-danger .tm-tool-icon { width: 13px; height: 13px; }

  .tm-video-recorder {
    position: fixed;
    z-index: 46;
    left: 50%;
    bottom: 24px;
    min-width: min(520px, calc(100vw - 24px));
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 13px;
    padding: 8px 9px 8px 12px;
    background: rgba(26,31,28,.97);
    color: var(--tm-text-primary);
    box-shadow: 0 16px 50px rgba(0,0,0,.32);
    backdrop-filter: blur(14px);
    pointer-events: auto;
    transform: translateX(-50%);
    animation: tm-recorder-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-video-recorder.is-paused .tm-recording-dot { background: var(--tm-orange-500); box-shadow: 0 0 0 4px var(--tm-orange-24); }
  .tm-video-recorder__copy { min-width: 0; flex: 1; }
  .tm-video-recorder__copy > strong,
  .tm-video-recorder__copy > span { display: block; }
  .tm-video-recorder__copy > strong { font-size: 12px; line-height: 16px; white-space: nowrap; }
  .tm-video-recorder__copy > span {
    margin-top: 1px;
    overflow: hidden;
    color: var(--tm-text-muted);
    font-size: 10px;
    line-height: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tm-video-recorder__clock { font-family: var(--tm-font-mono); font-variant-numeric: tabular-nums; }
  .tm-video-recorder__limit { color: var(--tm-text-secondary); font-family: var(--tm-font-mono); font-weight: 400; }
  .tm-video-recorder__count {
    color: var(--tm-text-soft);
    font-family: var(--tm-font-mono);
    font-size: 10px;
    white-space: nowrap;
  }
  .tm-video-recorder .tm-recording-stop:disabled { cursor: progress; opacity: .7; }

  .tm-camera-bubble {
    position: fixed;
    z-index: 44;
    left: 24px;
    bottom: 96px;
    width: 132px;
    height: 132px;
    overflow: hidden;
    border: 3px solid var(--tm-paper);
    border-radius: 50%;
    background: var(--tm-ground);
    box-shadow: 0 12px 36px rgba(0,0,0,.32);
    cursor: grab;
    pointer-events: auto;
    touch-action: none;
    animation: tm-camera-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-camera-bubble:active { cursor: grabbing; }
  .tm-camera-bubble__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
    pointer-events: none;
  }

  .tm-cursor-layer,
  .tm-replay-layer {
    position: fixed;
    inset: 0;
    z-index: 45;
    overflow: hidden;
    pointer-events: none;
  }
  .tm-cursor-halo {
    position: absolute;
    left: -18px;
    top: -18px;
    width: 36px;
    height: 36px;
    border: 2px solid rgba(229,72,60,.55);
    border-radius: 50%;
    background: rgba(229,72,60,.14);
    opacity: 0;
    will-change: transform;
  }
  .tm-click-ripple {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    border: 3px solid var(--tm-coral);
    border-radius: 50%;
    animation: tm-click-ripple 600ms var(--tm-ease-standard) both;
  }

  .tm-replay-cursor {
    position: absolute;
    left: 0;
    top: 0;
    opacity: 0;
    will-change: transform;
  }
  .tm-replay-cursor__arrow {
    width: 22px;
    height: 22px;
    color: var(--tm-ink);
    fill: var(--tm-paper);
    stroke-width: 1.6;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,.35));
  }
  .tm-replay-cursor__bubble {
    position: absolute;
    left: 18px;
    top: 18px;
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 3px solid var(--tm-paper);
    border-radius: 50%;
    background: var(--tm-forest);
    color: var(--tm-paper);
    box-shadow: 0 10px 28px rgba(0,0,0,.3);
    font-size: 20px;
    font-weight: 700;
  }
  .tm-replay-cursor__bubble video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
  }
  .tm-replay-bar {
    position: fixed;
    z-index: 46;
    left: 50%;
    bottom: 24px;
    min-width: min(440px, calc(100vw - 24px));
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 13px;
    padding: 8px 9px;
    background: rgba(26,31,28,.97);
    color: var(--tm-text-primary);
    box-shadow: 0 16px 50px rgba(0,0,0,.32);
    pointer-events: auto;
    transform: translateX(-50%);
    animation: tm-recorder-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-replay-bar__copy { min-width: 0; flex: 1; }
  .tm-replay-bar__copy strong,
  .tm-replay-bar__copy span { display: block; }
  .tm-replay-bar__copy strong { font-size: 12px; line-height: 16px; }
  .tm-replay-bar__copy span { color: var(--tm-text-muted); font-family: var(--tm-font-mono); font-size: 10px; line-height: 14px; }

  .tm-video-preview {
    overflow: hidden;
    border: 1px solid var(--tm-line);
    border-radius: 11px;
    background: var(--tm-raised);
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-video-preview__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 11px;
    border-bottom: 1px solid var(--tm-line);
  }
  .tm-video-preview__header strong,
  .tm-video-preview__header span { display: block; }
  .tm-video-preview__header strong { color: var(--tm-text-primary); font-size: 11px; line-height: 15px; }
  .tm-video-preview__header span { margin-top: 1px; color: var(--tm-text-secondary); font-family: var(--tm-font-mono); font-size: 9px; line-height: 13px; }
  .tm-video-preview__header button {
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
  .tm-video-preview__header button:hover { background: rgba(255,255,255,.14); }
  .tm-video-preview__header .tm-tool-icon { width: 13px; height: 13px; }
  .tm-video-preview__media {
    width: 100%;
    max-height: 220px;
    display: block;
    background: #000;
  }
  .tm-video-preview__media.is-camera { max-height: 180px; object-fit: contain; }
  .tm-video-preview__audio { width: calc(100% - 16px); display: block; margin: 8px; }
  .tm-video-preview__missing {
    margin: 0;
    padding: 18px 12px;
    color: var(--tm-text-secondary);
    font-size: 11px;
    text-align: center;
  }
  .tm-video-events { max-height: 140px; }
  .tm-video-events li { display: block; padding: 0; }
  .tm-video-events li button {
    width: 100%;
    min-height: 28px;
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    border: 0;
    border-radius: 7px;
    padding: 3px 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 10px;
    text-align: left;
  }
  .tm-video-events li button:hover:not(:disabled) { background: rgba(255,255,255,.06); }
  .tm-video-events li time { color: var(--tm-text-secondary); font-family: var(--tm-font-mono); font-size: 9px; }
  .tm-video-preview__note {
    margin: 0;
    padding: 8px 11px 10px;
    border-top: 1px solid var(--tm-line);
    color: var(--tm-text-secondary);
    font-size: 10px;
    line-height: 14px;
  }

  .tm-replay-attachment,
  .tm-replay-open {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 9px;
    border: 1px solid var(--tm-line);
    border-radius: 11px;
    padding: 9px 10px;
    background: var(--tm-raised);
    color: var(--tm-text-primary);
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-replay-attachment .tm-tool-icon,
  .tm-replay-open .tm-tool-icon { width: 16px; height: 16px; color: var(--tm-mint); }
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
    border-radius: 8px;
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
    width: 100%;
    grid-template-columns: 18px minmax(0, 1fr);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--tm-motion-fast) ease, border-color var(--tm-motion-fast) ease;
  }
  .tm-replay-open:hover:not(:disabled) { border-color: var(--tm-line-strong); background: #2b322d; }
  .tm-replay-open:disabled { cursor: default; opacity: .6; }
  .tm-replay-open:focus-visible,
  .tm-replay-attachment button:focus-visible,
  .tm-replay-dialog button:focus-visible,
  .tm-replay-dialog input:focus-visible {
    outline: 2px solid var(--tm-focus);
    outline-offset: 2px;
  }

  .tm-replay-dialog {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 24px;
    pointer-events: auto;
  }
  .tm-replay-dialog__scrim {
    position: absolute;
    inset: 0;
    background: rgba(17, 21, 19, .58);
    animation: tm-scrim-in var(--tm-motion-standard) ease both;
  }
  .tm-replay-dialog__panel {
    position: relative;
    width: min(1180px, 100%);
    height: min(720px, calc(100vh - 48px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 16px;
    background: var(--tm-surface);
    color: var(--tm-text-primary);
    box-shadow: 0 30px 80px rgba(0,0,0,.4);
    animation: tm-recorder-in-plain var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-replay-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px 12px 18px;
    border-bottom: 1px solid var(--tm-line);
  }
  .tm-replay-dialog__header strong,
  .tm-replay-dialog__header span { display: block; }
  .tm-replay-dialog__header strong { font-size: 14px; line-height: 19px; }
  .tm-replay-dialog__header span { color: var(--tm-text-secondary); font-size: 11px; }
  .tm-replay-dialog__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    min-height: 0;
  }
  .tm-replay-dialog__viewer {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    background: var(--tm-ground);
  }
  .tm-replay-dialog__stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  .tm-replay-dialog__stage .replayer-wrapper {
    position: absolute;
    transform-origin: top left;
    box-shadow: 0 0 0 1px var(--tm-line);
  }
  .tm-replay-dialog__stage iframe {
    display: block;
    border: 0;
    background: #fff;
    pointer-events: none;
  }
  .tm-replay-dialog__status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--tm-text-secondary);
    font-size: 12px;
  }
  .tm-replay-dialog__controls {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-top: 1px solid var(--tm-line);
  }
  .tm-replay-dialog__controls input { flex: 1; accent-color: var(--tm-coral-dark); }
  .tm-replay-dialog__time { color: var(--tm-text-soft); font-family: var(--tm-font-mono); font-size: 11px; white-space: nowrap; }
  .tm-replay-dialog__speed {
    min-width: 38px;
    height: 28px;
    border: 1px solid var(--tm-line);
    border-radius: 8px;
    background: transparent;
    color: var(--tm-text-primary);
    cursor: pointer;
    font-family: var(--tm-font-mono);
    font-size: 11px;
  }
  .tm-replay-dialog__side {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    border-left: 1px solid var(--tm-line);
  }
  .tm-replay-dialog__tabs {
    display: flex;
    gap: 2px;
    padding: 8px;
    border-bottom: 1px solid var(--tm-line);
  }
  .tm-replay-dialog__tabs button {
    flex: 1;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tm-text-secondary);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
  }
  .tm-replay-dialog__tabs button span {
    margin-left: 5px;
    color: var(--tm-text-muted);
    font-family: var(--tm-font-mono);
    font-size: 10px;
  }
  .tm-replay-dialog__tabs button.is-active { background: var(--tm-raised); color: var(--tm-text-primary); }
  .tm-replay-dialog__rows {
    min-height: 0;
    overflow-y: auto;
    margin: 0;
    padding: 6px;
    list-style: none;
  }
  .tm-replay-dialog__rows li button {
    width: 100%;
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 8px;
    border: 0;
    border-radius: 8px;
    padding: 7px 8px;
    background: transparent;
    color: var(--tm-text-soft);
    cursor: pointer;
    font-size: 11px;
    line-height: 15px;
    text-align: left;
  }
  .tm-replay-dialog__rows li button:hover { background: rgba(255,255,255,.05); }
  .tm-replay-dialog__rows li.is-active button { background: var(--tm-deep-sage); color: var(--tm-text-primary); }
  .tm-replay-dialog__rows time { color: var(--tm-text-secondary); font-family: var(--tm-font-mono); font-size: 10px; }
  .tm-replay-dialog__empty { padding: 14px 8px; color: var(--tm-text-secondary); font-size: 11px; }
  .tm-replay-row { min-width: 0; overflow-wrap: anywhere; }
  .tm-replay-row strong { font-family: var(--tm-font-mono); font-size: 10px; text-transform: uppercase; }
  .tm-replay-row small { display: block; margin-top: 2px; color: var(--tm-text-secondary); font-size: 10px; }
  .tm-replay-row--error strong { color: var(--tm-coral-dark); }
  .tm-replay-row--warn strong { color: #f0b35a; }
  .tm-replay-row--ok strong { color: var(--tm-mint); }

  @keyframes tm-recorder-in-plain {
    from { opacity: 0; transform: translateY(8px) scale(.99); }
    to { opacity: 1; transform: none; }
  }

  @keyframes tm-camera-in {
    from { opacity: 0; transform: translateY(6px) scale(.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  /* Full-width surfaces on narrow screens rise without the centring offset. */
  @keyframes tm-video-surface-in {
    from { opacity: 0; transform: translateY(8px) scale(.98); }
    to { opacity: 1; transform: none; }
  }
  @keyframes tm-click-ripple {
    from { opacity: .9; transform: scale(.35); }
    to { opacity: 0; transform: scale(1); }
  }

  @media (max-width: 760px) {
    .tm-video-recorder,
    .tm-replay-bar,
    .tm-video-setup {
      right: 12px;
      bottom: 12px;
      left: 12px;
      width: auto;
      min-width: 0;
      transform: none;
      animation-name: tm-video-surface-in;
    }
    .tm-video-recorder__count,
    .tm-video-recorder__copy > span { display: none; }
    .tm-camera-bubble { width: 96px; height: 96px; bottom: 76px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tm-click-ripple { opacity: .7; }
  }

  /* Questions and polls --------------------------------------------------------------------------- */
  .tm-ask-switch {
    display: inline-flex;
    gap: 2px;
    margin-bottom: 8px;
    border: 1px solid var(--tm-line);
    border-radius: 9px;
    padding: 2px;
  }
  .tm-ask-switch button {
    height: 24px;
    border: 0;
    border-radius: 7px;
    padding: 0 9px;
    background: transparent;
    color: var(--tm-text-secondary);
    font: 600 11px/1 var(--tm-font);
    cursor: pointer;
    transition: background var(--tm-motion-fast) var(--tm-ease-standard), color var(--tm-motion-fast) var(--tm-ease-standard);
  }
  .tm-ask-switch button:hover { color: var(--tm-text-primary); }
  .tm-ask-switch button.is-active { background: var(--tm-raised); color: var(--tm-text-primary); }
  .tm-poll-editor { display: grid; gap: 6px; margin: 8px 0 0; border: 0; padding: 0; min-width: 0; }
  .tm-poll-editor__row { display: flex; gap: 6px; }
  .tm-poll-editor__row input {
    flex: 1;
    min-width: 0;
    height: 30px;
    border: 1px solid var(--tm-line);
    border-radius: 8px;
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
    border-radius: 8px;
    padding: 0 8px;
    background: transparent;
    color: var(--tm-text-secondary);
    font: 600 11px/1 var(--tm-font);
    cursor: pointer;
  }
  .tm-poll-editor__row button:hover,
  .tm-poll-editor__add:hover { background: rgba(255,255,255,.06); color: var(--tm-text-primary); }
  .tm-poll-editor__footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }
  .tm-poll-editor__multiple { display: inline-flex; align-items: center; gap: 6px; color: var(--tm-text-secondary); font-size: 11px; }
  .tm-ask-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0 2px 38px;
    color: var(--tm-mint);
    font-size: 11px;
    font-weight: 600;
  }
  .tm-poll {
    display: grid;
    gap: 6px;
    margin: 2px 0 4px 38px;
    border: 1px solid var(--tm-line);
    border-radius: 11px;
    padding: 9px;
    background: var(--tm-raised);
    animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-poll__header { display: flex; align-items: center; gap: 6px; color: var(--tm-text-secondary); font-size: 11px; }
  .tm-poll__header svg { color: var(--tm-mint); }
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
    border-radius: 8px;
    padding: 0 9px;
    background: transparent;
    color: var(--tm-text-primary);
    font: 12px/1.3 var(--tm-font);
    text-align: left;
    cursor: pointer;
  }
  .tm-poll-option:hover:not(:disabled) { border-color: var(--tm-line-strong); }
  .tm-poll-option:disabled { cursor: default; }
  .tm-poll-option.is-chosen { border-color: var(--tm-mint); }
  .tm-poll-option__bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: color-mix(in srgb, var(--tm-mint) 18%, transparent);
    transition: width var(--tm-motion-standard) var(--tm-ease-standard);
  }
  .tm-poll-option__label,
  .tm-poll-option__count { position: relative; display: inline-flex; align-items: center; gap: 5px; }
  .tm-poll-option__label svg { color: var(--tm-mint); }
  .tm-poll-option__count { color: var(--tm-text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tm-poll__hint { color: var(--tm-text-soft); font-size: 10px; }
  @media (prefers-reduced-motion: reduce) {
    .tm-poll, .tm-poll-option__bar { animation: none; transition: none; }
  }
`;
