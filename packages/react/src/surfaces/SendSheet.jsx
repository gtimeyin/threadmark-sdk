// Send it elsewhere (Feedback experience board 10). A comment goes to an issue tracker or a channel
// the project has connected; the host creates it and returns where it lives (23a-d). Connecting is
// the host's own flow (24a): Threadmark lists the places and hands Connect/Manage back to the host.
import { useEffect, useMemo, useRef, useState } from "react";
import { BranchIcon, ChecklistIcon, CommentIcon, ErrorIcon, IntegrationsIcon } from "../icons.jsx";
import { Key } from "../ui/primitives.jsx";

const KIND_ICONS = { github: BranchIcon, linear: ChecklistIcon, slack: CommentIcon };

export function DestinationMark({ destination, size = 16 }) {
  if (destination?.iconUrl) return <img className="tm-send__mark" src={destination.iconUrl} alt="" width={size} height={size} />;
  const Icon = KIND_ICONS[destination?.kind] || IntegrationsIcon;
  return <Icon size={size} className="tm-send__mark" aria-hidden="true" focusable="false" />;
}

/** What the issue will say: who, where, the words, and what comes with it (23b). */
export function sendSummary(annotation, targetName) {
  const payload = annotation?.payload || {};
  const who = payload.author?.displayName || "Someone";
  const where = [payload.route === "/" ? "Home" : payload.route, targetName].filter(Boolean).join(" · ");
  const words = String(payload.comment || "").trim();
  const extras = [payload.evidence?.some?.((item) => item.kind === "screenshot") || payload.captureKind === "screenshot" ? "Screenshot attached" : null, "link back to the comment"].filter(Boolean);
  return [`${who} on ${where}`, words ? `“${words}”` : null, extras.join(" · ")].filter(Boolean).join("\n");
}

export function defaultSendTitle(comment) {
  const line = String(comment || "").split("\n").map((part) => part.trim()).find(Boolean) || "Feedback";
  const trimmed = line.replace(/[.!]+$/, "");
  return trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed;
}

function useSheetFocus() {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return ref;
}

export function SendSheet({ destination, annotation, targetName, onSend, onClose }) {
  const targets = destination.targets || [];
  const [targetId, setTargetId] = useState(destination.defaultTargetId || targets[0]?.id || "");
  const [title, setTitle] = useState(() => defaultSendTitle(annotation?.payload?.comment));
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState(null);
  const ref = useSheetFocus();
  const summary = useMemo(() => sendSummary(annotation, targetName), [annotation, targetName]);
  const action = destination.actionLabel || (destination.kind === "slack" ? "Post" : "Create issue");
  const titled = destination.kind !== "slack";

  const send = async () => {
    if (sending || (titled && !title.trim())) return;
    setSending(true);
    setProblem(null);
    try {
      await onSend({ targetId: targetId || null, title: titled ? title.trim() : null, body: summary });
      onClose?.();
    } catch (error) {
      // 24c: said in the sheet, in plain words, with the fix next to it. Nothing is lost.
      setProblem({ message: error?.message || `Couldn’t send to ${destination.name}. Try again.`, fix: error?.fix || null });
      setSending(false);
    }
  };

  return (
    <div className="tm-sheet-layer" data-menu-open="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} className="tm-you tm-send" role="dialog" aria-modal="true" aria-labelledby="tm-send-title" tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); onClose?.(); }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send(); }
        }}>
        <header className="tm-you__header">
          <DestinationMark destination={destination} size={14} />
          <h2 id="tm-send-title">{destination.sheetTitle || (destination.kind === "slack" ? `Post to ${destination.name}` : `New ${destination.name} issue`)}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><Key>Esc</Key></button>
        </header>
        <div className="tm-you__body">
          {targets.length > 0 && (
            <label className="tm-send__field">
              <span>{destination.targetLabel || "Where"}</span>
              <span className={`tm-send__select${problem ? " is-error" : ""}`}>
                <select value={targetId} onChange={(event) => { setTargetId(event.target.value); setProblem(null); }}>
                  {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
                </select>
              </span>
            </label>
          )}
          {problem && (
            <div className="tm-send__problem" role="alert">
              <ErrorIcon size={14} aria-hidden="true" focusable="false" />
              <div>
                <p>{problem.message}</p>
                <div className="tm-send__fixes">
                  {problem.fix?.url && <a href={problem.fix.url} target="_blank" rel="noreferrer">{problem.fix.label || "Fix it"}</a>}
                  {targets.length > 1 && <button type="button" onClick={() => ref.current?.querySelector("select")?.focus()}>Pick another {String(destination.targetLabel || "place").toLowerCase()}</button>}
                </div>
              </div>
            </div>
          )}
          {!problem && titled && (
            <label className="tm-send__field">
              <span>Title</span>
              <input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
            </label>
          )}
          {!problem && (
            <div className="tm-send__field">
              <span id="tm-send-body">What goes in the {destination.kind === "slack" ? "message" : "issue"}</span>
              <pre aria-labelledby="tm-send-body">{summary}</pre>
            </div>
          )}
          <footer className="tm-you__footer">
            <span className="tm-send__note">{destination.note || ""}</span>
            <span className="tm-send__actions">
              <button type="button" className="tm-share__button tm-send__cancel" onClick={onClose}>Cancel <Key>Esc</Key></button>
              <button type="button" className="tm-send__go" onClick={send} disabled={sending || (titled && !title.trim())}>
                {sending ? "Sending…" : action} {!sending && <Key>↵</Key>}
              </button>
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}

/** 24a: where feedback can go, with Connect or Manage handed to the host. */
export function DestinationsSheet({ destinations, onConnect, onClose }) {
  const ref = useSheetFocus();
  return (
    <div className="tm-sheet-layer" data-menu-open="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} className="tm-you tm-send tm-send--list" role="dialog" aria-modal="true" aria-labelledby="tm-dest-title" tabIndex={-1}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose?.(); } }}>
        <header className="tm-you__header">
          <IntegrationsIcon size={14} aria-hidden="true" focusable="false" />
          <h2 id="tm-dest-title">Send feedback to</h2>
          <button type="button" onClick={onClose} aria-label="Close"><Key>Esc</Key></button>
        </header>
        <ul className="tm-send__places">
          {destinations.map((destination) => (
            <li key={destination.id}>
              <DestinationMark destination={destination} size={16} />
              <span><strong>{destination.name}</strong><small>{destination.detail || (destination.connected ? "Connected" : "Not connected")}</small></span>
              <button type="button" className="tm-share__button" onClick={() => onConnect(destination.id)}>{destination.connected ? "Manage" : "Connect"}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
