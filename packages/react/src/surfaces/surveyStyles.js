// Survey builder sheet (dark, 360px), the dashed placement ghost, and the results in the side panel.
import { surveyCardStyles } from "../surveys/styles.js";

export const surveyStyles = `
  .tm-survey-builder {
    position: fixed;
    z-index: 48;
    left: 0;
    right: 0;
    bottom: 76px;
    width: min(360px, calc(100vw - 24px));
    max-height: calc(100vh - 100px);
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-radius: var(--tm-radius-panel);
    background: var(--tm-ground);
    color: var(--tm-text-primary);
    box-shadow: 0 22px 60px rgba(0, 0, 0, .38), 0 0 0 1px rgba(251, 250, 246, .08);
    font: 400 13px/18px var(--tm-font);
    pointer-events: auto;
    animation: tm-popover-in-below var(--tm-motion-surface) var(--tm-ease-emphasized) both;
  }
  .tm-survey-builder__header { display: flex; align-items: center; gap: 8px; padding: 14px 14px 0 16px; }
  .tm-survey-builder__mark { width: 16px; height: 16px; color: var(--tm-action-primary); }
  .tm-survey-builder__header h2 { flex: 1; margin: 0; font: 600 13px/18px var(--tm-font); }
  .tm-survey-builder__esc { padding: 0; border: 0; background: none; cursor: pointer; }

  .tm-survey-steps { display: flex; align-items: center; gap: 8px; margin: 0; padding: 12px 16px; list-style: none; border-bottom: 1px solid rgba(251, 250, 246, .08); color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-survey-steps li { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .tm-survey-steps li + li::before { content: ""; width: 14px; height: 1px; background: rgba(251, 250, 246, .18); }
  .tm-survey-steps__dot { display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid rgba(251, 250, 246, .3); border-radius: 50%; font-size: 10px; }
  .tm-survey-steps li.is-current { color: var(--tm-text-primary); }
  .tm-survey-steps li.is-current .tm-survey-steps__dot { border-color: var(--tm-action-primary); background: var(--tm-action-primary); color: var(--tm-ground); }
  .tm-survey-steps li.is-done .tm-survey-steps__dot { border-color: var(--tm-action-primary); color: var(--tm-action-primary); }

  .tm-survey-builder__body { display: grid; gap: 14px; padding: 14px 16px; overflow-x: hidden; overflow-y: auto; }
  .tm-survey-builder__body > * { min-width: 0; }
  .tm-survey-row { display: grid; gap: 6px; }
  .tm-survey-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .tm-survey-options { display: grid; gap: 6px; margin: 0; padding: 0; border: 0; min-width: 0; }
  .tm-survey-option {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 6px 0 10px;
    border: 1px solid rgba(251, 250, 246, .14);
    border-radius: var(--tm-radius-button);
    background: transparent;
    color: var(--tm-text-primary);
  }
  .tm-survey-option > svg { width: 14px; height: 14px; flex: none; color: var(--tm-text-secondary); }
  .tm-survey-option input { flex: 1; min-width: 0; border: 0; padding: 0; outline: none; background: transparent; color: inherit; font: 400 14px/20px var(--tm-font); }
  .tm-survey-option input::placeholder { color: var(--tm-text-secondary); }
  .tm-survey-option:focus-within { border-color: rgba(224, 243, 84, .6); }
  .tm-survey-option button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--tm-text-secondary); cursor: pointer; }
  .tm-survey-option button svg { width: 14px; height: 14px; }
  .tm-survey-option button:disabled { opacity: .3; cursor: default; }
  .tm-survey-option--add { border-style: dashed; color: var(--tm-text-secondary); font: 400 14px/20px var(--tm-font); cursor: pointer; }
  .tm-survey-option--add:hover { color: var(--tm-text-primary); }

  .tm-survey-preview { display: grid; gap: 6px; }
  .tm-survey-preview .tms-card.tm-survey-preview__scale { width: 100%; padding: 12px; }
  .tm-survey-preview .tms-card.tm-survey-preview__card { width: 100%; pointer-events: none; box-shadow: none; }

  .tm-survey-pages ul { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; padding: 0; list-style: none; }
  .tm-survey-pages li { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 8px; border-radius: 4px; background: rgba(251, 250, 246, .10); }
  .tm-survey-pages code { font: 400 12px/16px var(--tm-font-mono); }
  .tm-survey-pages li button { display: grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 0; background: none; color: var(--tm-text-secondary); cursor: pointer; }
  .tm-survey-pages li button svg { width: 12px; height: 12px; }
  .tm-survey-pages__add { display: flex; gap: 6px; }
  .tm-survey-pages__add input { flex: 1; min-width: 0; min-height: 30px; padding: 4px 10px; border: 1px solid rgba(251, 250, 246, .18); border-radius: var(--tm-radius-button); background: transparent; color: var(--tm-text-primary); font: 400 12px/16px var(--tm-font-mono); }
  .tm-survey-pages__add button { display: inline-flex; align-items: center; gap: 4px; min-height: 30px; padding: 0 8px; border: 0; border-radius: var(--tm-radius-button); background: rgba(251, 250, 246, .10); color: var(--tm-text-primary); font: 500 12px/16px var(--tm-font); cursor: pointer; }
  .tm-survey-pages__add button svg { width: 12px; height: 12px; }

  .tm-survey-settings { display: grid; gap: 0; margin: 0; }
  .tm-survey-settings > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; border-bottom: 1px solid rgba(251, 250, 246, .06); }
  .tm-survey-settings dt { color: var(--tm-text-primary); font: 400 13px/18px var(--tm-font); }
  .tm-survey-settings dd { margin: 0; }
  .tm-survey-settings select { border: 0; background: transparent; color: var(--tm-text-secondary); font: 400 13px/18px var(--tm-font); text-align: right; cursor: pointer; }
  .tm-survey-settings select option { background: var(--tm-surface); color: var(--tm-text-primary); }

  .tm-survey-builder__footer { display: flex; align-items: center; gap: 10px; padding: 12px 16px 14px; border-top: 1px solid rgba(251, 250, 246, .08); }
  .tm-survey-builder__live { flex: 1; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); text-align: right; }

  /* Where it will sit: a dashed Lime ghost of the card (board 03, 10c). */
  .tm-survey-ghost { position: fixed; z-index: 47; pointer-events: none; }
  .tm-survey-ghost--corner { right: 20px; bottom: 20px; }
  .tm-survey-ghost--centre { inset: 0; display: grid; place-items: center; }
  .tm-survey-ghost--banner { left: 12px; right: 12px; bottom: 12px; display: flex; justify-content: center; }
  .tm-survey-ghost__card { display: grid; gap: 4px; width: min(340px, calc(100vw - 24px)); padding: 14px 16px; border: 2px dashed var(--tm-action-primary); border-radius: 8px; background: rgba(255, 255, 255, .92); color: #14201c; font: 400 13px/18px var(--tm-font); }
  .tm-survey-ghost--banner .tm-survey-ghost__card { width: min(720px, 100%); }
  .tm-survey-ghost__card span { color: #5e6662; font-size: 11px; }

  /* Questions in the side panel. */
  .tm-survey-list ul { margin: 0; padding: 0; list-style: none; }
  .tm-survey-list__item { display: grid; gap: 4px; width: 100%; padding: 8px 16px 10px; border: 0; border-bottom: 1px solid rgba(251, 250, 246, .08); background: transparent; color: var(--tm-text-primary); text-align: left; cursor: pointer; }
  .tm-survey-list__item:hover { background: rgba(251, 250, 246, .04); }
  .tm-survey-list__question { font: 400 14px/20px var(--tm-font); }
  .tm-survey-list__meta { color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font-mono); }
  .tm-survey-status { display: inline-flex; align-items: center; gap: 6px; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-survey-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: rgba(163, 173, 168, .6); }
  .tm-survey-status--live { color: var(--tm-action-primary); }
  .tm-survey-status--live::before { background: var(--tm-action-primary); }

  .tm-survey-results { display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow: auto; padding: 12px 16px 0; }
  .tm-survey-results__nav { display: flex; align-items: center; justify-content: space-between; }
  .tm-survey-results__nav button { display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); cursor: pointer; }
  .tm-survey-results__nav button svg { width: 12px; height: 12px; }
  .tm-survey-results__question { margin: 0; font: 600 14px/20px var(--tm-font); }
  .tm-survey-results__score { margin: -4px 0 0; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-survey-results__score strong { color: var(--tm-text-primary); font-size: 13px; }
  .tm-survey-bars { display: grid; gap: 8px; margin: 0; padding: 0 0 12px; list-style: none; border-bottom: 1px solid rgba(251, 250, 246, .08); }
  .tm-survey-bars li { display: grid; grid-template-columns: minmax(14px, auto) 1fr 36px; align-items: center; gap: 10px; color: var(--tm-text-secondary); font: 400 12px/16px var(--tm-font); }
  .tm-survey-bars__label { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tm-survey-bars__track { height: 4px; border-radius: 2px; background: rgba(251, 250, 246, .08); }
  .tm-survey-bars__track span { display: block; height: 100%; border-radius: 2px; background: rgba(163, 173, 168, .6); }
  .tm-survey-bars li.is-leading .tm-survey-bars__track span { background: var(--tm-action-primary); }
  .tm-survey-bars__share { text-align: right; font-family: var(--tm-font-mono); }
  .tm-survey-results__summary { display: flex; gap: 8px; margin: 0; font: 600 12px/16px var(--tm-font); }
  .tm-survey-results__summary svg { width: 14px; height: 14px; flex: none; color: var(--tm-action-primary); }
  .tm-survey-results__texts { display: grid; gap: 10px; }
  .tm-survey-results__texts-label { margin: 0; color: var(--tm-text-secondary); font: 500 11px/14px var(--tm-font); }
  .tm-survey-results__texts blockquote { margin: 0; font: 400 14px/20px var(--tm-font); }
  .tm-survey-results__empty { margin: 0; color: var(--tm-text-secondary); }
  .tm-survey-results__footer { position: sticky; bottom: 0; display: flex; align-items: center; gap: 16px; margin: auto -16px 0; padding: 12px 16px; border-top: 1px solid rgba(251, 250, 246, .08); background: var(--tm-ground); }
  .tm-survey-results__footer button { padding: 0; border: 0; background: none; color: var(--tm-text-secondary); font: 600 12px/16px var(--tm-font); cursor: pointer; }
  .tm-survey-results__footer button:hover { color: var(--tm-text-primary); }
  .tm-survey-results__footer button:disabled { opacity: .45; cursor: default; }
  .tm-survey-results__end { margin-left: auto; color: var(--tm-text-primary) !important; }

  @media (prefers-reduced-motion: reduce) { .tm-survey-builder { animation: none; } }
${surveyCardStyles}
`;
