// Styles for the visitor survey card (Figma "Survey card", 265:977) and its placements. The card sits
// on the host page, so it uses the light surface: white, 8px, a 10% ink hairline, Forest actions.
export const surveyCardStyles = `
  .tms-card {
    --tms-ink: #14201c;
    --tms-stone: #5e6662;
    --tms-forest: #035d47;
    --tms-forest-deep: #024132;
    --tms-tint: #e1ece9;
    --tms-hairline: rgba(20, 32, 28, .10);
    box-sizing: border-box;
    width: min(340px, calc(100vw - 24px));
    display: grid;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--tms-hairline);
    border-radius: 8px;
    background: #fff;
    color: var(--tms-ink);
    box-shadow: 0 12px 32px rgba(14, 23, 20, .18);
    font: 400 14px/20px "Threadmark Geist", "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .tms-card * { box-sizing: border-box; }
  .tms-card button, .tms-card textarea, .tms-card input { font: inherit; }
  .tms-card__top { display: flex; align-items: center; gap: 8px; min-height: 14px; color: var(--tms-stone); font-size: 11px; font-weight: 500; line-height: 14px; }
  .tms-card__close { display: grid; place-items: center; width: 24px; height: 24px; margin: -5px -5px -5px auto; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--tms-stone); cursor: pointer; }
  .tms-card__close svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
  .tms-card__close:hover { background: rgba(20, 32, 28, .06); color: var(--tms-ink); }
  .tms-card__question { margin: 0; color: var(--tms-ink); font-size: 14px; line-height: 20px; }

  .tms-points { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; }
  .tms-points button {
    min-height: 36px;
    padding: 0;
    border: 1px solid var(--tms-hairline);
    border-radius: 6px;
    background: #fff;
    color: var(--tms-ink);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .tms-points button:hover { border-color: rgba(20, 32, 28, .24); }
  .tms-points button.is-selected { border-color: transparent; background: var(--tms-tint); color: var(--tms-forest); }
  .tms-points--stars button, .tms-points--faces button { border: 0; background: transparent; font-size: 20px; }
  .tms-points--stars svg { width: 24px; height: 24px; fill: none; stroke: var(--tms-stone); stroke-width: 1.5; stroke-linejoin: round; }
  .tms-points--stars svg.is-filled { fill: var(--tms-forest); stroke: var(--tms-forest); }
  .tms-points--faces button { filter: grayscale(1); opacity: .6; }
  .tms-points--faces button.is-selected, .tms-points--faces button:hover { filter: none; opacity: 1; background: var(--tms-tint); }

  .tms-slider { position: relative; padding-top: 26px; }
  .tms-slider__value { position: absolute; top: 0; transform: translateX(-50%); min-width: 20px; padding: 1px 5px; border-radius: 4px; background: var(--tms-forest); color: #fff; font-size: 11px; font-weight: 600; line-height: 16px; text-align: center; }
  .tms-slider input { width: 100%; margin: 0; appearance: none; -webkit-appearance: none; height: 20px; background: transparent; cursor: pointer; }
  .tms-slider input::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; background: linear-gradient(to right, var(--tms-forest) var(--tms-fill), rgba(20, 32, 28, .14) var(--tms-fill)); }
  .tms-slider input::-moz-range-track { height: 3px; border-radius: 2px; background: rgba(20, 32, 28, .14); }
  .tms-slider input::-moz-range-progress { height: 3px; border-radius: 2px; background: var(--tms-forest); }
  .tms-slider input::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; margin-top: -7.5px; border: 2px solid var(--tms-forest); border-radius: 50%; background: #fff; }
  .tms-slider input::-moz-range-thumb { width: 14px; height: 14px; border: 2px solid var(--tms-forest); border-radius: 50%; background: #fff; }

  .tms-card__ends { display: flex; justify-content: space-between; margin-top: -6px; color: var(--tms-stone); font-size: 11px; font-weight: 500; line-height: 14px; }

  .tms-options { display: grid; gap: 6px; }
  .tms-options button { min-height: 36px; padding: 7px 12px; border: 1px solid var(--tms-hairline); border-radius: 6px; background: #fff; color: var(--tms-ink); text-align: left; cursor: pointer; }
  .tms-options button:hover { border-color: rgba(20, 32, 28, .24); }
  .tms-options button.is-selected { border-color: transparent; background: var(--tms-tint); color: var(--tms-forest); font-weight: 600; }

  .tms-card__text { width: 100%; min-height: 72px; resize: vertical; padding: 9px 12px; border: 1px solid rgba(20, 32, 28, .15); border-radius: 6px; background: #fff; color: var(--tms-ink); line-height: 20px; }
  .tms-card__text:focus { outline: none; border-color: var(--tms-forest); }

  .tms-card__actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .tms-card__skip { min-height: 32px; padding: 0 4px; border: 0; background: transparent; color: var(--tms-stone); font-size: 13px; font-weight: 600; cursor: pointer; }
  .tms-card__skip:hover { color: var(--tms-ink); }
  .tms-card__next { min-height: 32px; padding: 7px 12px; border: 0; border-radius: 6px; background: var(--tms-forest); color: #fff; font-size: 13px; font-weight: 600; line-height: 18px; cursor: pointer; }
  .tms-card__next:hover:not(:disabled) { background: var(--tms-forest-deep); }
  .tms-card__next:disabled { opacity: .45; cursor: default; }

  .tms-card__done { display: flex; gap: 10px; align-items: flex-start; }
  .tms-card__done svg { width: 18px; height: 18px; flex: none; fill: none; stroke: var(--tms-forest); stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
  .tms-card__done div { display: grid; gap: 2px; }
  .tms-card__done strong { font-size: 13px; font-weight: 600; line-height: 18px; }
  .tms-card__done span { color: var(--tms-stone); font-size: 11px; font-weight: 500; line-height: 14px; }

  .tms-card button:focus-visible, .tms-card textarea:focus-visible, .tms-card input:focus-visible { outline: 2px solid #f15722; outline-offset: 2px; }
  @media (forced-colors: active) { .tms-card { border-color: CanvasText; } }
`;

export const surveyPlayerStyles = `
  :host { all: initial; }
  /* Just under the review overlay (2147483000), so the panel and sheets stay on top while you review. */
  .tms-layer { position: fixed; z-index: 2147482900; pointer-events: none; }
  .tms-layer > * { pointer-events: auto; }
  .tms-layer--corner { right: 20px; bottom: 20px; }
  .tms-layer--centre { inset: 0; display: grid; place-items: center; background: rgba(14, 23, 20, .28); pointer-events: auto; }
  .tms-layer--banner { left: 0; right: 0; bottom: 0; display: flex; justify-content: center; padding: 12px; }
  .tms-layer--banner .tms-card { width: min(720px, calc(100vw - 24px)); }
  .tms-layer--element { position: fixed; }
  .tms-enter { animation: tms-in 240ms cubic-bezier(.2, .8, .2, 1) both; }
  @keyframes tms-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (max-width: 480px) {
    .tms-layer--corner { left: 12px; right: 12px; bottom: 12px; }
    .tms-layer--corner .tms-card { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) { .tms-enter { animation: none; } }
${surveyCardStyles}
`;
