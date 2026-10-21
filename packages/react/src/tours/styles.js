// Player styles, adopted into the player's shadow root. Colours, radius, and font come from
// --tm-tour-* custom properties, which a host can set from its own CSS or the `theme` prop.
export const tourStyles = `
:host { all: initial; font-family: inherit; }
.tmt {
  --a: var(--tm-tour-accent, #1a1e1b);
  --at: var(--tm-tour-accent-text, #fff);
  --s: var(--tm-tour-surface, #fff);
  --t: var(--tm-tour-text, #1a1e1b);
  --m: var(--tm-tour-muted, #5f625b);
  --b: var(--tm-tour-border, #deddd7);
  --r: var(--tm-tour-radius, 12px);
  font: 14px/1.45 var(--tm-tour-font, inherit);
  color: var(--t);
  -webkit-font-smoothing: antialiased;
}
.tmt *, .tmt *::before, .tmt *::after { box-sizing: border-box; }
.tmt-spot {
  position: fixed; z-index: 2147483000; pointer-events: none; border-radius: 10px;
  box-shadow: 0 0 0 3px var(--a), 0 0 0 9999px rgba(17, 21, 19, .45);
  transition: left .25s ease, top .25s ease, width .25s ease, height .25s ease;
}
.tmt-spot[data-style="tooltip"] { box-shadow: 0 0 0 3px var(--a); }
.tmt-backdrop { position: fixed; inset: 0; z-index: 2147483000; background: rgba(17, 21, 19, .45); }
.tmt-card {
  position: fixed; z-index: 2147483001; width: min(340px, calc(100vw - 24px));
  display: flex; flex-direction: column; gap: 10px; padding: 16px;
  background: var(--s); color: var(--t); border: 1px solid var(--b); border-radius: var(--r);
  box-shadow: 0 16px 40px rgba(17, 21, 19, .22);
  animation: tmt-in .18s ease-out;
}
.tmt-card[data-mode="center"] { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100vw - 24px)); }
.tmt-card[data-mode="sheet"] {
  left: 0; right: 0; bottom: 0; width: auto; max-height: 70vh; overflow: auto;
  border-radius: var(--r) var(--r) 0 0; padding: 10px 18px calc(18px + env(safe-area-inset-bottom));
}
.tmt-card[data-mode="sheet"]::before { content: ""; align-self: center; width: 32px; height: 4px; border-radius: 2px; background: var(--b); }
.tmt-arrow { position: absolute; width: 12px; height: 12px; background: var(--s); border: 1px solid var(--b); transform: rotate(45deg); }
.tmt-arrow[data-side="bottom"] { top: -7px; border-right: 0; border-bottom: 0; }
.tmt-arrow[data-side="top"] { bottom: -7px; border-left: 0; border-top: 0; }
.tmt-arrow[data-side="right"] { left: -7px; border-top: 0; border-right: 0; }
.tmt-arrow[data-side="left"] { right: -7px; border-bottom: 0; border-left: 0; }
.tmt-count { font-size: 12px; font-weight: 600; letter-spacing: .02em; color: var(--m); }
.tmt-title { margin: 0; font-size: 16px; line-height: 1.3; font-weight: 600; outline: none; }
.tmt-title:focus-visible { outline: 2px solid var(--a); outline-offset: 3px; border-radius: 4px; }
.tmt-body { margin: 0; color: var(--m); }
.tmt-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.tmt-actions { display: flex; gap: 8px; margin-left: auto; }
.tmt button, .tmt textarea { font: inherit; color: inherit; }
.tmt-btn {
  min-height: 36px; padding: 0 14px; border-radius: 9px; cursor: pointer;
  border: 1px solid var(--b); background: transparent; font-weight: 500;
}
.tmt-btn[data-primary] { border-color: var(--a); background: var(--a); color: var(--at); font-weight: 600; }
.tmt-link { min-height: 36px; padding: 0 2px; border: 0; background: none; color: var(--m); cursor: pointer; font-weight: 500; }
.tmt button:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
.tmt-hint { margin: 0; font-size: 13px; font-weight: 500; color: var(--t); }
.tmt-note { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--b); }
.tmt-note textarea { width: 100%; min-height: 64px; padding: 8px 10px; border: 1px solid var(--b); border-radius: 8px; background: var(--s); resize: vertical; }
.tmt-bar {
  position: fixed; z-index: 2147483001; left: 16px; bottom: 16px; max-width: calc(100vw - 32px);
  display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 14px;
  background: var(--t); color: var(--s); border-radius: var(--r); box-shadow: 0 12px 30px rgba(17, 21, 19, .3);
}
.tmt-bar .tmt-btn { border-color: transparent; background: var(--s); color: var(--t); }
.tmt-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent; animation: tmt-spin .8s linear infinite; }
.tmt-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes tmt-in { from { opacity: 0; } }
@keyframes tmt-spin { to { transform: rotate(360deg); } }
@media (pointer: coarse) { .tmt-btn, .tmt-link { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) {
  .tmt-spot { transition: none; }
  .tmt-card, .tmt-spinner { animation: none; }
}
@media (forced-colors: active) {
  .tmt-spot { box-shadow: none; outline: 3px solid Highlight; }
  .tmt-card, .tmt-bar { border: 2px solid CanvasText; }
  .tmt-btn[data-primary] { forced-color-adjust: none; background: ButtonText; color: ButtonFace; }
}
`;
