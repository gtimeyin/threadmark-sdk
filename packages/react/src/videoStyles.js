// Video feedback surfaces share the dark review chrome and motion tokens defined in overlayStyles.
export const videoStyles = `
  .tm-video-icon-button {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    border: 0;
    border-radius: var(--tm-radius-button);
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

  /* Figma "Record a video" (board 02, 13a, 16a-b): dark card, two mode tiles, source rows with switches,
     one notice line, then the limit and an Orange Start recording. */
  .tm-video-setup {
    position: fixed;
    z-index: 46;
    left: 50%;
    bottom: 24px;
    width: min(420px, calc(100vw - 24px));
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    border-radius: var(--tm-radius-panel);
    padding: 14px 16px 16px;
    background: var(--tm-ground);
    color: var(--tm-text-primary);
    box-shadow: 0 22px 60px rgba(0, 0, 0, .38), 0 0 0 1px rgba(251, 250, 246, .08);
    font: 400 13px/18px var(--tm-font);
    pointer-events: auto;
    transform: translateX(-50%);
    animation: tm-recorder-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-video-setup *, .tm-video-setup *::before, .tm-video-setup *::after { box-sizing: border-box; }
  .tm-video-setup__header { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tm-video-setup__header strong { flex: 1; font: 600 13px/18px var(--tm-font); }
  .tm-video-setup__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tm-orange); box-shadow: 0 0 0 3px rgba(241, 87, 34, .2); }
  .tm-video-setup__esc { padding: 0; border: 0; background: none; cursor: pointer; }
  .tm-video-setup__modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; min-width: 0; }
  .tm-video-setup__modes button {
    min-width: 0; height: 64px; display: grid; justify-items: center; align-content: center; gap: 6px;
    border: 1px solid rgba(251, 250, 246, .1); border-radius: var(--tm-radius-button); padding: 0 8px;
    background: transparent; color: var(--tm-text-secondary); cursor: pointer; font: 500 12px/16px var(--tm-font);
    transition: background-color var(--tm-motion-fast) ease, color var(--tm-motion-fast) ease, border-color var(--tm-motion-fast) ease;
  }
  .tm-video-setup__modes button:hover:not(:disabled):not(.is-active) { background: rgba(251, 250, 246, .04); color: var(--tm-text-primary); }
  .tm-video-setup__modes button.is-active { border-color: rgba(251, 250, 246, .24); background: var(--tm-raised); color: var(--tm-text-primary); }
  .tm-video-setup__modes button:disabled { cursor: not-allowed; opacity: .4; }
  .tm-video-setup__modes .tm-tool-icon { width: 18px; height: 18px; }
  .tm-video-setup__sources { display: grid; gap: 10px; min-width: 0; }
  .tm-video-source { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .tm-video-source__icon { flex: none; width: 24px; height: 24px; display: grid; place-items: center; color: var(--tm-text-secondary); }
  .tm-video-source__icon .tm-tool-icon { width: 16px; height: 16px; }
  .tm-video-setup__camera { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; transform: scaleX(-1); background: var(--tm-surface); }
  .tm-video-source__text { flex: 1; min-width: 0; display: grid; }
  .tm-video-source__text label { font: 500 14px/20px var(--tm-font); }
  .tm-video-source__text small { overflow: hidden; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); white-space: nowrap; text-overflow: ellipsis; }
  .tm-video-source__text small.is-problem { color: var(--tm-orange-on-dark); }
  .tm-video-source__text select {
    justify-self: start; max-width: 100%; height: 22px; margin-left: -4px; padding: 0 16px 0 4px; border: 0; border-radius: 4px;
    appearance: none; -webkit-appearance: none; background: none;
    color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); cursor: pointer;
  }
  .tm-video-source__select { position: relative; justify-self: start; max-width: 100%; }
  .tm-video-source__select::after { content: ""; position: absolute; right: 5px; top: 50%; margin-top: -1px; border: 3px solid transparent; border-top-color: var(--tm-text-secondary); pointer-events: none; }
  .tm-video-source__text select option { background: var(--tm-ground); color: var(--tm-text-primary); }
  .tm-video-switch { flex: none; position: relative; width: 32px; height: 18px; padding: 0; border: 0; border-radius: 9px; background: rgba(251, 250, 246, .2); cursor: pointer; transition: background-color var(--tm-motion-fast) ease; }
  .tm-video-switch span { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--tm-paper, #fbfaf6); transition: transform var(--tm-motion-fast) ease; }
  .tm-video-switch.is-on { background: var(--tm-lime); }
  .tm-video-switch.is-on span { transform: translateX(14px); background: var(--tm-ground); }
  .tm-video-switch:disabled { opacity: .5; cursor: not-allowed; }
  .tm-video-setup__hint { display: flex; align-items: flex-start; gap: 8px; min-width: 0; padding: 8px 10px; border-radius: var(--tm-radius-button); background: var(--tm-surface); color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-video-setup__hint p { flex: 1; min-width: 0; margin: 0; }
  .tm-video-setup__hint .tm-tool-icon { flex: none; width: 14px; height: 14px; margin-top: 1px; }
  .tm-video-setup__hint.is-error { background: rgba(241, 87, 34, .12); color: var(--tm-text-primary); }
  .tm-video-setup__hint.is-error .tm-tool-icon { color: var(--tm-orange-on-dark); }
  .tm-video-setup__blur { flex: none; padding: 0; border: 0; background: none; color: var(--tm-text-primary); font: 500 12px/16px var(--tm-font); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  .tm-video-setup__blur:disabled { opacity: .5; cursor: not-allowed; }
  .tm-video-setup__actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 2px; }
  .tm-video-setup__limit { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-video-setup .tm-video-start { border-radius: var(--tm-radius-button); background: var(--tm-orange); color: #fff; font: 600 13px/18px var(--tm-font); white-space: nowrap; }
  .tm-video-setup .tm-video-start:hover:not(:disabled) { background: #d9481a; }
  .tm-video-setup .tm-video-start .tm-ui-key { border-color: rgba(255, 255, 255, .35); background: rgba(255, 255, 255, .14); color: #fff; }
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
  .tm-video-danger:hover { background: #ff8f66; }
  .tm-video-start:active:not(:disabled),
  .tm-video-danger:active { transform: scale(.97); }
  .tm-video-start:disabled { cursor: not-allowed; opacity: .5; }
  .tm-video-start .tm-tool-icon { width: 12px; height: 12px; fill: currentColor; }
  .tm-video-danger .tm-tool-icon { width: 13px; height: 13px; }

  /* Board 02, 7d and 8a-8b: one dark bar — state and clock, then the sources, Moment, tools, pause and an
     Orange stop. An Orange frame around the page means live; a quiet dashed one means paused. */
  .tm-video-recorder {
    position: fixed;
    /* Above the blur picker (47), so Draw and Stop stay usable while choosing what to blur. */
    z-index: 50;
    left: 50%;
    bottom: 24px;
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 44px;
    box-sizing: border-box;
    border-radius: var(--tm-radius-panel);
    padding: 6px;
    background: var(--tm-ground);
    color: var(--tm-text-primary);
    box-shadow: 0 12px 32px rgba(14, 23, 20, .18), 0 0 0 1px rgba(251, 250, 246, .06);
    pointer-events: auto;
    transform: translateX(-50%);
    animation: tm-recorder-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-video-recorder__state { display: inline-flex; align-items: center; gap: 8px; padding: 0 8px 0 6px; white-space: nowrap; }
  .tm-video-recorder__state strong { font: 600 13px/18px var(--tm-font); }
  .tm-video-recorder .tm-recording-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tm-orange); animation: tm-rec-pulse 1.6s ease-in-out infinite; }
  .tm-video-recorder.is-paused .tm-recording-dot { background: var(--tm-text-muted); box-shadow: none; animation: none; }
  .tm-video-recorder__clock { color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font-mono); font-variant-numeric: tabular-nums; }
  .tm-video-recorder.is-near-limit .tm-video-recorder__clock { color: #ff8f66; }
  .tm-video-recorder__rule { width: 1px; height: 20px; margin: 0 4px; background: var(--tm-line); }
  .tm-video-icon-button.is-off { color: var(--tm-text-muted); }
  .tm-video-icon-button.is-off::after { content: ""; position: absolute; width: 18px; height: 1.5px; background: currentColor; transform: rotate(-45deg); }
  .tm-video-icon-button { position: relative; }
  .tm-video-moment { width: auto; min-width: 32px; gap: 6px; padding: 0 8px; grid-auto-flow: column; font: 500 12px/16px var(--tm-font); }
  .tm-video-moment span { display: inline-flex; align-items: center; gap: 6px; }
  .tm-video-icon-button.tm-video-resume { background: var(--tm-lime); color: var(--tm-ground); }
  .tm-video-icon-button.tm-video-resume:hover:not(:disabled) { background: #eaf77f; color: var(--tm-ground); }
  .tm-video-recorder .tm-recording-stop {
    width: 32px; height: 32px; min-height: 32px; margin-left: 2px; display: inline-grid; place-items: center; padding: 0;
    border: 0; border-radius: var(--tm-radius-button); background: var(--tm-orange); color: #fff; cursor: pointer;
  }
  .tm-video-recorder .tm-recording-stop .tm-tool-icon { width: 14px; height: 14px; fill: none; }
  .tm-video-recorder .tm-recording-stop:hover:not(:disabled) { background: #d9481a; }
  .tm-video-recorder .tm-recording-stop:disabled { cursor: progress; opacity: .7; }
  .tm-video-recorder__note {
    position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
    display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 5px 10px;
    border-radius: var(--tm-radius-button); background: var(--tm-ground); color: var(--tm-text-primary);
    box-shadow: 0 6px 18px rgba(14, 23, 20, .18), 0 0 0 1px rgba(251, 250, 246, .06);
    font: 500 12px/16px var(--tm-font); white-space: nowrap; animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both;
  }
  .tm-video-recorder__note .tm-tool-icon { width: 13px; height: 13px; color: var(--tm-lime); }
  .tm-video-recorder.is-near-limit .tm-video-recorder__note .tm-tool-icon { color: #ff8f66; }
  @keyframes tm-rec-pulse { 50% { opacity: .35; } }

  .tm-video-frame {
    position: fixed; inset: 0; z-index: 46; pointer-events: none;
    border: 3px solid var(--tm-orange); border-radius: 4px;
    transition: border-color var(--tm-motion-standard) ease;
  }
  .tm-video-frame.is-paused { border: 2px dashed rgba(94, 102, 98, .7); }

  /* 7c: the count sits over a lightly dimmed page; the page is already shared. */
  .tm-video-countdown {
    position: fixed; inset: 0; z-index: 60; display: grid; place-content: center; justify-items: center; gap: 20px;
    background: rgba(14, 23, 20, .16); pointer-events: auto;
  }
  .tm-video-countdown__number {
    width: 120px; height: 120px; display: grid; place-items: center; border-radius: 50%;
    background: var(--tm-ground); color: #fff; box-shadow: 0 18px 48px rgba(14, 23, 20, .3);
    font: 600 56px/1 var(--tm-font); font-variant-numeric: tabular-nums;
    animation: tm-count-in 1s var(--tm-ease-emphasized) both;
  }
  .tm-video-countdown__cancel {
    display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border: 0;
    border-radius: var(--tm-radius-button); background: var(--tm-ground); color: var(--tm-text-muted); cursor: pointer;
    font: 400 12px/16px var(--tm-font);
  }
  .tm-video-countdown__cancel strong { color: var(--tm-text-primary); font-weight: 600; }
  .tm-video-countdown__cancel:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  @keyframes tm-count-in { from { transform: scale(.92); opacity: .4; } 30% { transform: scale(1); opacity: 1; } }

  /* 7e: review before posting. Dark card, the recording, a Lime trim bar with moment ticks, where it posts,
     then Retake / Delete and a Lime Post video. */
  .tm-video-review {
    width: min(600px, 100%); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box;
    display: grid; grid-auto-rows: max-content; gap: 12px; padding: 16px 18px;
    border-radius: var(--tm-radius-panel); background: var(--tm-ground); color: var(--tm-text-primary);
    box-shadow: 0 22px 60px rgba(0, 0, 0, .38), 0 0 0 1px rgba(251, 250, 246, .08);
    font: 400 13px/18px var(--tm-font); outline: none;
    animation: tm-popover-in-below var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-video-review__header { display: flex; align-items: center; gap: 10px; min-height: 28px; }
  .tm-video-review__title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; padding: 2px 4px; margin-left: -4px; border: 0; border-radius: var(--tm-radius-button); background: none; color: inherit; cursor: text; text-align: left; }
  .tm-video-review__title strong { overflow: hidden; font: 600 13px/18px var(--tm-font); text-overflow: ellipsis; white-space: nowrap; }
  .tm-video-review__title .tm-tool-icon { flex: none; width: 13px; height: 13px; color: var(--tm-text-muted); }
  .tm-video-review__title:hover { background: rgba(251, 250, 246, .06); }
  .tm-video-review__title-input { flex: 1; min-width: 0; height: 28px; box-sizing: border-box; padding: 0 8px; border: 1px solid var(--tm-line); border-radius: var(--tm-radius-button); background: var(--tm-surface); color: inherit; font: 600 13px/18px var(--tm-font); }
  .tm-video-review__length { margin-left: auto; color: var(--tm-text-muted); font: 400 12px/16px var(--tm-font-mono); }
  .tm-video-review__close { width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tm-radius-button); background: none; color: var(--tm-text-muted); cursor: pointer; }
  .tm-video-review__close:hover { background: rgba(251, 250, 246, .06); color: var(--tm-text-primary); }
  .tm-video-review__close .tm-tool-icon { width: 14px; height: 14px; }

  .tm-video-review__player,
  .tm-video-preview__player {
    position: relative; overflow: hidden; display: grid; place-items: center;
    aspect-ratio: 16 / 9; border-radius: var(--tm-radius-button); background: #000;
  }
  /* On short windows the player gives up height first, so the trim bar and Post stay in view. */
  .tm-video-review__player { aspect-ratio: auto; height: clamp(120px, calc(100vh - 290px), 316px); }
  .tm-video-review__player video { position: absolute; inset: 0; }
  .tm-video-review__player.is-audio,
  .tm-video-preview__player.is-audio { aspect-ratio: auto; min-height: 120px; background: var(--tm-surface); }
  .tm-video-review__player video,
  .tm-video-preview__player video { width: 100%; height: 100%; display: block; object-fit: contain; cursor: pointer; }
  .tm-video-review__player audio,
  .tm-video-preview__player audio { display: none; }
  .tm-video-review__wave { width: 40px; height: 40px; color: var(--tm-text-muted); }
  .tm-video-play {
    position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; display: grid; place-items: center;
    padding: 0; border: 0; border-radius: 50%; background: var(--tm-lime); color: var(--tm-ground); cursor: pointer;
    box-shadow: 0 6px 18px rgba(14, 23, 20, .3); transform: translate(-50%, -50%);
    transition: opacity var(--tm-motion-standard) ease, transform var(--tm-motion-fast) var(--tm-ease-standard);
  }
  .tm-video-play .tm-tool-icon { width: 18px; height: 18px; }
  .tm-video-play:active { transform: translate(-50%, -50%) scale(.96); }
  .tm-video-play.is-playing { opacity: 0; }
  .tm-video-review__player:hover .tm-video-play.is-playing,
  .tm-video-preview__player:hover .tm-video-play.is-playing,
  .tm-video-play.is-playing:focus-visible { opacity: 1; }
  .tm-video-play:disabled { opacity: .4; cursor: default; }

  .tm-video-trim { position: relative; height: 20px; }
  .tm-video-trim__track { position: absolute; left: 0; right: 0; top: 6px; height: 8px; border-radius: 2px; background: var(--tm-surface); }
  .tm-video-trim__kept { position: absolute; top: 0; bottom: 0; background: rgba(224, 243, 84, .32); }
  .tm-video-trim__moment { position: absolute; top: -2px; bottom: -2px; width: 1.5px; margin-left: -.75px; background: rgba(251, 250, 246, .55); }
  .tm-video-trim__handle {
    position: absolute; inset: 0; width: 100%; height: 20px; margin: 0; background: none; pointer-events: none;
    -webkit-appearance: none; appearance: none;
  }
  .tm-video-trim__handle::-webkit-slider-runnable-track { height: 20px; background: none; }
  .tm-video-trim__handle::-moz-range-track { height: 20px; background: none; }
  .tm-video-trim__handle::-webkit-slider-thumb {
    -webkit-appearance: none; width: 8px; height: 20px; border: 0; border-radius: 3px; background: var(--tm-lime); cursor: ew-resize; pointer-events: auto;
  }
  .tm-video-trim__handle::-moz-range-thumb { width: 8px; height: 20px; border: 0; border-radius: 3px; background: var(--tm-lime); cursor: ew-resize; pointer-events: auto; }
  .tm-video-trim__handle:focus-visible { outline: none; }
  .tm-video-trim__handle:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  .tm-video-trim__handle:focus-visible::-moz-range-thumb { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  .tm-video-trim__labels { display: flex; justify-content: space-between; margin: -4px 0 0; color: var(--tm-text-muted); font: 400 11px/14px var(--tm-font); }
  .tm-video-trim__labels span:first-child,
  .tm-video-trim__labels span:last-child { font-family: var(--tm-font-mono); }
  .tm-video-review__place { display: flex; align-items: center; gap: 6px; margin: 0; padding-bottom: 12px; border-bottom: 1px solid var(--tm-line); color: var(--tm-text-muted); font-size: 12px; line-height: 16px; }
  .tm-video-review__place strong { color: var(--tm-text-primary); font-weight: 500; }
  .tm-video-review__place .tm-tool-icon { width: 13px; height: 13px; }
  .tm-video-review__footer { display: flex; align-items: center; gap: 8px; }
  .tm-video-review__footer.is-confirming > span { flex: 1; min-width: 0; color: var(--tm-text-muted); font-size: 12px; line-height: 16px; }
  .tm-video-review__footer.is-confirming strong { color: var(--tm-text-primary); }
  .tm-video-review__secondary {
    height: 34px; padding: 0 12px; border: 1px solid rgba(251, 250, 246, .16); border-radius: var(--tm-radius-button);
    background: transparent; color: var(--tm-text-primary); cursor: pointer; font: 600 13px/18px var(--tm-font);
  }
  .tm-video-review__secondary:hover:not(:disabled) { background: rgba(251, 250, 246, .06); }
  .tm-video-review__text { height: 34px; padding: 0 6px; border: 0; background: none; color: var(--tm-text-muted); cursor: pointer; font: 500 13px/18px var(--tm-font); }
  .tm-video-review__text:hover:not(:disabled) { color: var(--tm-text-primary); }
  .tm-video-post {
    height: 34px; margin-left: auto; display: inline-flex; align-items: center; gap: 10px; padding: 0 12px; border: 0;
    border-radius: var(--tm-radius-button); background: var(--tm-lime); color: var(--tm-ground); cursor: pointer; font: 600 13px/18px var(--tm-font);
  }
  .tm-video-post:hover:not(:disabled) { background: #eaf77f; }
  .tm-video-post:disabled { cursor: progress; opacity: .7; }
  .tm-video-post .tm-ui-key { border-color: rgba(14, 23, 20, .2); background: transparent; color: rgba(14, 23, 20, .6); }
  .tm-video-review .tm-video-danger { height: 34px; border-radius: var(--tm-radius-button); }
  .tm-video-review button:focus-visible,
  .tm-video-review input[type="text"]:focus-visible,
  .tm-video-review__title-input:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }

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
    border: 2px solid rgba(241, 87, 34,.55);
    border-radius: 50%;
    background: rgba(241, 87, 34,.14);
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

  /* 7f-7g: a posted video. The recording with a Lime play button and a thin progress line, then Summary,
     Transcript and Chapters as timestamped lines, and the steps. */
  .tm-video-preview { display: grid; gap: 10px; min-width: 0; padding: 0 12px 12px; animation: tm-state-in var(--tm-motion-standard) var(--tm-ease-standard) both; }
  .tm-video-preview__player.is-camera video { object-fit: contain; }
  .tm-video-preview__time {
    position: absolute; left: 8px; bottom: 12px; padding: 2px 6px; border-radius: 4px;
    background: rgba(14, 23, 20, .82); color: #fff; font: 400 11px/15px var(--tm-font-mono); pointer-events: none;
  }
  .tm-video-preview__seek {
    position: absolute; left: 8px; right: 8px; bottom: 4px; width: calc(100% - 16px); height: 8px; margin: 0;
    -webkit-appearance: none; appearance: none; background: none; cursor: pointer;
  }
  .tm-video-preview__seek::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; background: linear-gradient(to right, var(--tm-lime) var(--tm-seek, 0%), rgba(251, 250, 246, .3) var(--tm-seek, 0%)); }
  .tm-video-preview__seek::-moz-range-track { height: 3px; border-radius: 2px; background: rgba(251, 250, 246, .3); }
  .tm-video-preview__seek::-moz-range-progress { height: 3px; border-radius: 2px; background: var(--tm-lime); }
  .tm-video-preview__seek::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; margin-top: -3.5px; border-radius: 50%; background: var(--tm-lime); opacity: 0; }
  .tm-video-preview__seek::-moz-range-thumb { width: 10px; height: 10px; border: 0; border-radius: 50%; background: var(--tm-lime); opacity: 0; }
  .tm-video-preview__player:hover .tm-video-preview__seek::-webkit-slider-thumb,
  .tm-video-preview__seek:focus-visible::-webkit-slider-thumb { opacity: 1; }
  .tm-video-preview__player:hover .tm-video-preview__seek::-moz-range-thumb,
  .tm-video-preview__seek:focus-visible::-moz-range-thumb { opacity: 1; }
  .tm-video-preview__seek:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  .tm-video-preview__missing { margin: 0; padding: 18px 12px; border-radius: var(--tm-radius-button); background: var(--tm-surface); color: var(--tm-text-secondary); font-size: 12px; text-align: center; }
  .tm-video-preview__replay {
    justify-self: start; height: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px;
    border: 1px solid rgba(251, 250, 246, .16); border-radius: var(--tm-radius-button); background: transparent;
    color: var(--tm-text-primary); cursor: pointer; font: 500 12px/16px var(--tm-font);
  }
  .tm-video-preview__replay:hover { background: rgba(251, 250, 246, .06); }
  .tm-video-preview__replay .tm-tool-icon { width: 13px; height: 13px; }
  .tm-video-tabs { display: flex; gap: 16px; }
  .tm-video-tabs button { padding: 2px 0; border: 0; background: none; color: var(--tm-text-muted); cursor: pointer; font: 500 13px/18px var(--tm-font); }
  .tm-video-tabs button.is-active { color: var(--tm-text-primary); font-weight: 600; }
  .tm-video-tabs button:hover { color: var(--tm-text-primary); }
  .tm-video-tabpanel { min-width: 0; }
  .tm-video-notes { display: grid; gap: 2px; max-height: 200px; overflow: auto; margin: 0; padding: 0; list-style: none; }
  .tm-video-notes li button {
    width: 100%; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 8px; padding: 4px 0; border: 0;
    background: none; color: var(--tm-text-muted); cursor: pointer; font: 400 13px/18px var(--tm-font); text-align: left;
  }
  .tm-video-notes li button:hover:not(:disabled) { color: var(--tm-text-primary); }
  .tm-video-notes time { padding-top: 1px; color: var(--tm-text-muted); font: 400 11px/17px var(--tm-font-mono); }
  .tm-video-notes li.is-active button { color: var(--tm-text-primary); }
  .tm-video-notes li.is-active time { color: var(--tm-lime); }
  .tm-video-notes__lead { padding: 2px 0 6px; color: var(--tm-text-muted); font-size: 12px; line-height: 16px; }
  .tm-video-notes.is-processing { display: grid; gap: 8px; }
  .tm-video-notes.is-processing p { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--tm-text-muted); font-size: 12px; line-height: 16px; }
  .tm-video-notes.is-processing p .tm-tool-icon { width: 13px; height: 13px; color: var(--tm-lime); }
  .tm-video-notes.is-processing span { height: 8px; border-radius: 4px; background: var(--tm-surface); animation: tm-rec-pulse 1.6s ease-in-out infinite; }
  .tm-video-notes.is-processing span:nth-of-type(1) { width: 86%; }
  .tm-video-notes.is-processing span:nth-of-type(2) { width: 74%; }
  .tm-video-notes.is-processing span:nth-of-type(3) { width: 80%; }
  .tm-video-events { max-height: 160px; }
  .tm-video-events li { display: block; padding: 0; }
  .tm-video-events li button {
    width: 100%; min-height: 28px; display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 8px;
    border: 0; border-radius: var(--tm-radius-button); padding: 3px 0; background: transparent; color: var(--tm-text-muted);
    cursor: pointer; font-size: 12px; text-align: left;
  }
  .tm-video-events li button:hover:not(:disabled) { color: var(--tm-text-primary); }
  .tm-video-events li.is-active button { color: var(--tm-text-primary); }
  .tm-video-events li time { color: var(--tm-text-muted); font-family: var(--tm-font-mono); font-size: 11px; }
  .tm-video-events li.is-active time { color: var(--tm-lime); }
  .tm-video-preview__note { margin: 0; color: var(--tm-text-secondary); font-size: 11px; line-height: 15px; }
  .tm-video-tabs button:focus-visible,
  .tm-video-notes button:focus-visible,
  .tm-video-events button:focus-visible { outline: 2px solid var(--tm-focus); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .tm-video-recorder .tm-recording-dot, .tm-video-countdown__number, .tm-video-notes.is-processing span { animation: none; }
  }

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
    background: rgba(14, 23, 20, .58);
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
    border-radius: var(--tm-radius-popover);
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
    border-radius: var(--tm-radius-button);
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
    border-radius: var(--tm-radius-button);
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
    border-radius: var(--tm-radius-button);
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

  /* Blurring and drawing while a tab is recorded. Both live in Threadmark's layer, so tab capture records them
     and the page itself never changes. */
  .tm-blur-layer {
    position: fixed;
    inset: 0;
    z-index: 42;
    overflow: hidden;
    pointer-events: none;
  }
  .tm-blur-box {
    position: absolute;
    left: 0;
    top: 0;
    border-radius: 6px;
    background: rgba(26,31,28,.18);
    -webkit-backdrop-filter: blur(16px) saturate(.6);
    backdrop-filter: blur(16px) saturate(.6);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .tm-blur-box { background: var(--tm-ground); }
  }
  .tm-blur-picker {
    position: fixed;
    inset: 0;
    z-index: 47;
    cursor: crosshair;
    pointer-events: auto;
  }
  .tm-blur-picker__outline {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 48;
    border: 2px dashed var(--tm-coral);
    border-radius: 6px;
    pointer-events: none;
  }
  .tm-blur-picker__outline.is-blurred { border-style: solid; border-color: var(--tm-mint); }
  .tm-blur-card {
    position: fixed;
    z-index: 49;
    left: 50%;
    top: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: calc(100vw - 24px);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 13px;
    padding: 9px 9px 9px 14px;
    background: rgba(26,31,28,.97);
    color: var(--tm-text-primary);
    box-shadow: 0 16px 50px rgba(0,0,0,.32);
    pointer-events: auto;
    transform: translateX(-50%);
    animation: tm-recorder-in var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-blur-card > div { min-width: 0; }
  .tm-blur-card strong,
  .tm-blur-card span { display: block; }
  .tm-blur-card strong { font-size: 12px; line-height: 16px; }
  .tm-blur-card span { color: var(--tm-text-muted); font-size: 10px; line-height: 14px; }
  .tm-video-icon-button.is-active { background: var(--tm-mint); color: var(--tm-ground); }
  /* Done is an action on the dark chrome: Lime, like every other one. */
  .tm-blur-card .tm-video-start { border-radius: var(--tm-radius-button); background: var(--tm-lime); color: var(--tm-ground); }
  .tm-blur-card .tm-video-start:hover:not(:disabled) { background: var(--tm-action-primary-hover, #d2e53f); }
  .tm-draw-layer {
    position: fixed;
    inset: 0;
    z-index: 43;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
  }
  .tm-draw-layer.is-active { cursor: crosshair; pointer-events: auto; touch-action: none; }
  @media (forced-colors: active) {
    .tm-blur-box { background: Canvas; }
  }
`;
