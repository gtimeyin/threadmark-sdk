// "You" (Feedback experience board 08): a menu under your face in the panel header (27a), a sheet to
// choose your face (27b), Your settings for name and notifications (28a), and leaving a project (28b).
// Each part shows only when the host can save it. Faces come from the host (`faces` prop), so the SDK
// never ships images; your initial is always the plain choice.
import { useEffect, useRef, useState } from "react";
import { EditIcon, LockIcon } from "../icons.jsx";
import { Avatar, Button, Input, Key, Segmented, Switch } from "../ui/primitives.jsx";

/** 27a: your face, name and email, then what you can do about yourself. */
export function YouMenu({ reviewer, email, onFace, onSettings, onShortcuts, onHide, onSignOut, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.querySelector('[role="menuitem"]')?.focus(); }, []);
  useEffect(() => {
    const onPointerDown = (event) => {
      if (!event.composedPath().includes(ref.current)) onClose?.();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);
  const items = [
    onFace && { key: "face", label: "Your face and name", run: onFace },
    onSettings && { key: "settings", label: "Notifications", run: onSettings },
    onShortcuts && { key: "shortcuts", label: "Keyboard shortcuts", keys: ["?"], run: onShortcuts },
    onHide && { key: "hide", label: "Hide on this page", keys: ["⌘⇧F"], run: onHide },
    onSignOut && { key: "signout", label: "Sign out", run: onSignOut },
  ].filter(Boolean);
  const move = (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const list = [...ref.current.querySelectorAll('[role="menuitem"]')];
    const index = list.indexOf(ref.current.getRootNode().activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? list.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
    list[next]?.focus();
  };
  return (
    <div ref={ref} className="tm-you-menu" role="menu" aria-label="You" data-menu-open="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose?.(); return; }
        move(event);
      }}>
      <div className="tm-you-menu__who">
        <Avatar name={reviewer?.displayName} src={reviewer?.avatarUrl} size={28} />
        <span><strong>{reviewer?.displayName || "You"}</strong>{email && <small>{email}</small>}</span>
      </div>
      {items.map((item) => (
        <button key={item.key} type="button" role="menuitem" onClick={() => { onClose?.(); item.run(); }}>
          <span>{item.label}</span>
          {item.keys && <span className="tm-you-menu__keys">{item.keys.map((key) => <Key key={key}>{key}</Key>)}</span>}
        </button>
      ))}
    </div>
  );
}

function SheetShell({ titleId, icon: Icon = EditIcon, title, onClose, onEnter, className = "", children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="tm-sheet-layer" data-menu-open="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} className={`tm-you ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); onClose?.(); }
          if (event.key === "Enter" && onEnter && !event.nativeEvent?.isComposing && !(event.target instanceof HTMLButtonElement && event.target.getAttribute("role") !== "radio")) {
            event.preventDefault();
            onEnter();
          }
        }}>
        <header className="tm-you__header">
          <Icon aria-hidden="true" focusable="false" />
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}><Key>Esc</Key></button>
        </header>
        {children}
      </section>
    </div>
  );
}

/** 27b: pick how you show up next to your comments. */
export function FaceSheet({ reviewer, faces = [], onReviewerChange, onDone, onClose }) {
  const [avatarUrl, setAvatarUrl] = useState(reviewer?.avatarUrl || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const use = async () => {
    if (saving) return;
    if (avatarUrl === (reviewer?.avatarUrl || null)) { onClose?.(); return; }
    setSaving(true);
    setError("");
    try {
      await onReviewerChange({ displayName: reviewer?.displayName, avatarUrl });
      onDone?.();
    } catch (saveError) {
      setError(saveError?.message ? `Couldn’t save: ${saveError.message}` : "Couldn’t save your face. Try again.");
      setSaving(false);
    }
  };
  return (
    <SheetShell titleId="tm-face-title" title="Your face" onClose={onClose} onEnter={use} className="tm-you--face">
      <div className="tm-you__body">
        <p className="tm-you__note">Pick how you show up next to your comments. You can change it any time.</p>
        <div role="radiogroup" aria-label="Your face" className="tm-you__face-grid">
          <button type="button" role="radio" aria-checked={!avatarUrl} aria-label={`Your initial, ${reviewer?.displayName || ""}`}
            className={!avatarUrl ? "is-selected" : undefined} onClick={() => setAvatarUrl(null)}>
            <Avatar name={reviewer?.displayName} size={40} />
          </button>
          {faces.map((face) => (
            <button key={face.id || face.url} type="button" role="radio" aria-checked={avatarUrl === face.url} aria-label={face.name || "Face"}
              className={avatarUrl === face.url ? "is-selected" : undefined} onClick={() => setAvatarUrl(face.url)}>
              <Avatar name={face.name} src={face.url} size={40} />
            </button>
          ))}
        </div>
        {error && <p className="tm-ui-field__hint is-error" role="alert">{error}</p>}
        <footer className="tm-you__footer">
          <span className="tm-you__note">Seen by everyone on your projects</span>
          <Button variant="primary" size="sm" kbd="↵" onClick={use} disabled={saving}>{saving ? "Saving…" : "Use this face"}</Button>
        </footer>
      </div>
    </SheetShell>
  );
}

/** 28a: name, email and notifications; Leave sits at the bottom. */
export function YouSheet({
  reviewer,
  notificationSettings,
  projectName,
  onReviewerChange,
  onNotificationSettingsChange,
  onLeave,
  onClose,
}) {
  const [name, setName] = useState(reviewer?.displayName || "");
  const [settings, setSettings] = useState(() => ({ myPages: false, digest: "daily", ...(notificationSettings || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (onReviewerChange && name.trim() && name.trim() !== reviewer?.displayName) {
        await onReviewerChange({ displayName: name.trim(), avatarUrl: reviewer?.avatarUrl || null });
      }
      if (onNotificationSettingsChange) await onNotificationSettingsChange({ mentionsAndReplies: true, ...settings });
      onClose?.();
    } catch (saveError) {
      setError(saveError?.message ? `Couldn’t save: ${saveError.message}` : "Couldn’t save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetShell titleId="tm-you-title" title="Your settings" onClose={onClose} onEnter={save}>
      <div className="tm-you__body">
        {onReviewerChange && (
          <Input label="Name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        )}
        {reviewer?.email && <Input label="Email" value={reviewer.email} readOnly className="tm-you__email" />}
        {onNotificationSettingsChange && (
          <div className="tm-you__settings">
            <Switch label="Mentions and replies" description="Always on. People need to reach you." checked disabled onChange={() => {}} />
            <Switch label="New comments on my pages" description="Pages you’ve commented on before"
              checked={settings.myPages} onChange={(myPages) => setSettings((current) => ({ ...current, myPages }))} />
            <div className="tm-you__digest">
              <span><strong>Email digest</strong><small>One email with what you missed</small></span>
              <Segmented label="Email digest" value={settings.digest}
                onChange={(digest) => setSettings((current) => ({ ...current, digest }))}
                options={[{ value: "off", label: "Off" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
            </div>
          </div>
        )}
        {error && <p className="tm-ui-field__hint is-error" role="alert">{error}</p>}
        <footer className="tm-you__footer">
          {onLeave ? <Button variant="outline-dark" size="sm" onClick={onLeave}>Leave {projectName || "project"}</Button> : <span />}
          {(onReviewerChange || onNotificationSettingsChange) && (
            <Button variant="primary" size="sm" kbd="↵" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          )}
        </footer>
      </div>
    </SheetShell>
  );
}

/** 28b: leaving asks once. Your comments stay; you stop hearing from the project. */
export function LeaveSheet({ projectName, onLeaveProject, onDone, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const stayRef = useRef(null);
  useEffect(() => { stayRef.current?.focus(); }, []);
  const leave = async () => {
    setLeaving(true);
    setError("");
    try {
      await onLeaveProject?.();
      onDone?.();
    } catch (leaveError) {
      setError(leaveError?.message || "Couldn’t leave the project. Try again.");
      setLeaving(false);
    }
  };
  const name = projectName || "this project";
  return (
    <div className="tm-sheet-layer" data-menu-open="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="tm-you tm-you--leave" role="alertdialog" aria-modal="true" aria-labelledby="tm-leave-title" aria-describedby="tm-leave-text"
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose?.(); } }}>
        <header className="tm-you__header">
          <LockIcon aria-hidden="true" focusable="false" />
          <h2 id="tm-leave-title">Leave {name}?</h2>
          <button type="button" onClick={onClose} aria-label="Close"><Key>Esc</Key></button>
        </header>
        <div className="tm-you__body">
          <p id="tm-leave-text" className="tm-you__lead">
            You’ll lose access to its comments and stop getting notifications. Your comments stay, with your name on them, and you can be invited back.
          </p>
          {error && <p className="tm-ui-field__hint is-error" role="alert">{error}</p>}
          <footer className="tm-you__footer tm-you__footer--end">
            <button ref={stayRef} type="button" className="tm-you__stay" onClick={onClose}>Stay <Key>Esc</Key></button>
            <Button variant="record" size="sm" onClick={leave} disabled={leaving}>{leaving ? "Leaving…" : "Leave"}</Button>
          </footer>
        </div>
      </section>
    </div>
  );
}
