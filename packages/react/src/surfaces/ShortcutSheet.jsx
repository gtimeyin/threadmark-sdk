// The shortcut sheet (board 09, 30a): two columns, plain words, keys exactly as they appear on the
// bar and in menus. Lists only shortcuts Threadmark really handles.
import { useEffect, useRef } from "react";
import { InfoIcon } from "../icons.jsx";
import { Key } from "../ui/primitives.jsx";

const mac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

export function ShortcutSheet({ videoEnabled = false, aiEnabled = false, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const cmd = mac() ? "⌘" : "Ctrl";
  const anywhere = [
    ["Show or hide Threadmark", [`${cmd}⇧F`]],
    ["Shrink to a dot", [`${cmd}.`]],
    ["This sheet", ["?"]],
    ["Close or go back", ["Esc"]],
    aiEnabled && ["Ask AI about what you picked", [`${cmd}K`]],
  ].filter(Boolean);
  const leaving = [
    ["Add a comment", ["C"]],
    ["Sketch on a screenshot", ["S"]],
    ["Record an interaction", ["R"]],
    videoEnabled && ["Record a video", ["V"]],
    ["Send", ["↵"]],
    ["New line", ["⇧", "↵"]],
    ["Pause animations", ["P"]],
    ["Hide comment pins", ["H"]],
    ["Copy as Markdown", ["⇧", "C"]],
    ["Clear all comments", ["X"]],
  ].filter(Boolean);
  const column = (title, rows) => (
    <section>
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, keys]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{keys.map((key) => <Key key={key}>{key}</Key>)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  return (
    <div className="tm-sheet-layer" data-menu-open="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} className="tm-shortcuts" role="dialog" aria-modal="true" aria-labelledby="tm-shortcuts-title" tabIndex={-1}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose?.(); } }}>
        <header>
          <InfoIcon aria-hidden="true" focusable="false" />
          <h2 id="tm-shortcuts-title">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close keyboard shortcuts"><Key>Esc</Key></button>
        </header>
        <div className="tm-shortcuts__columns">
          {column("Anywhere", anywhere)}
          {column("Leaving feedback", leaving)}
        </div>
      </section>
    </div>
  );
}
