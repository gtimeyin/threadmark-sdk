// "You" (Feedback experience board 08): your face, name and notifications, and leaving a project.
// Each part shows only when the host can save it. Faces come from the host (`faces` prop), so the
// SDK never ships images; your initial is always the plain choice.
import { useEffect, useRef, useState } from "react";
import { EditIcon } from "../icons.jsx";
import { Avatar, Button, Input, Key, Segmented, Switch } from "../ui/primitives.jsx";

export function YouSheet({
  reviewer,
  faces = [],
  notificationSettings,
  projectName,
  onReviewerChange,
  onNotificationSettingsChange,
  onLeaveProject,
  onClose,
}) {
  const [avatarUrl, setAvatarUrl] = useState(reviewer?.avatarUrl || null);
  const [name, setName] = useState(reviewer?.displayName || "");
  const [settings, setSettings] = useState(() => ({ myPages: false, digest: "daily", ...(notificationSettings || {}) }));
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (onReviewerChange && (name.trim() !== reviewer?.displayName || avatarUrl !== (reviewer?.avatarUrl || null))) {
        await onReviewerChange({ displayName: name.trim() || reviewer?.displayName, avatarUrl });
      }
      if (onNotificationSettingsChange) await onNotificationSettingsChange({ mentionsAndReplies: true, ...settings });
      onClose?.();
    } catch (saveError) {
      setError(saveError?.message ? `Couldn’t save: ${saveError.message}` : "Couldn’t save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    setSaving(true);
    try {
      await onLeaveProject?.();
      onClose?.();
    } catch (leaveError) {
      setError(leaveError?.message || "Couldn’t leave the project. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="tm-sheet-layer" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} className="tm-you" role="dialog" aria-modal="true" aria-labelledby="tm-you-title" tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); onClose?.(); }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); save(); }
        }}>
        <header className="tm-you__header">
          <EditIcon aria-hidden="true" focusable="false" />
          <h2 id="tm-you-title">Your settings</h2>
          <button type="button" onClick={onClose} aria-label="Close your settings"><Key>Esc</Key></button>
        </header>

        {confirmLeave ? (
          <div className="tm-you__body">
            <p className="tm-you__lead"><strong>Leave {projectName || "this project"}?</strong></p>
            <p className="tm-you__note">Your comments stay, with your name on them. You stop getting anything from this project.</p>
            {error && <p className="tm-ui-field__hint is-error" role="alert">{error}</p>}
            <footer className="tm-you__footer">
              <Button variant="secondary" size="sm" onClick={() => setConfirmLeave(false)}>Stay</Button>
              <Button variant="record" size="sm" onClick={leave} disabled={saving}>{saving ? "Leaving…" : `Leave ${projectName || "project"}`}</Button>
            </footer>
          </div>
        ) : (
          <div className="tm-you__body">
            {onReviewerChange && (
              <fieldset className="tm-you__faces">
                <legend className="tm-ui-field__label">Your face</legend>
                <p className="tm-you__note">How you show up next to your comments. You can change it any time.</p>
                <div role="radiogroup" aria-label="Your face" className="tm-you__face-grid">
                  <button type="button" role="radio" aria-checked={!avatarUrl} aria-label={`Your initial, ${name || reviewer?.displayName || ""}`}
                    className={!avatarUrl ? "is-selected" : undefined} onClick={() => setAvatarUrl(null)}>
                    <Avatar name={name || reviewer?.displayName} size={40} />
                  </button>
                  {faces.map((face) => (
                    <button key={face.id || face.url} type="button" role="radio" aria-checked={avatarUrl === face.url} aria-label={face.name || "Face"}
                      className={avatarUrl === face.url ? "is-selected" : undefined} onClick={() => setAvatarUrl(face.url)}>
                      <Avatar name={face.name} src={face.url} size={40} />
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {onReviewerChange && (
              <Input label="Name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
            )}
            {reviewer?.email && <Input label="Email" value={reviewer.email} readOnly />}
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
              {onLeaveProject ? <Button variant="outline-dark" size="sm" onClick={() => setConfirmLeave(true)}>Leave {projectName || "project"}</Button> : <span />}
              <Button variant="primary" size="sm" kbd="↵" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
