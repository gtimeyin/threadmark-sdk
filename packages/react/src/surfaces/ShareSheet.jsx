// Share (Feedback experience board 04, 15a-f): the review link, who can open it, inviting people by
// name or email, and changing or removing someone's access. The host owns the people and the link;
// each part shows only when the host passes what it needs (`shareUrl`, `onInvite`, `onMemberChange`…).
import { useEffect, useRef, useState } from "react";
import { GlobeIcon, LinkIcon, ShareIcon } from "../icons.jsx";
import { Avatar, Key, Tag } from "../ui/primitives.jsx";

export const SHARE_ROLES = [
  { value: "edit", label: "Can edit", hint: "Comment, resolve and manage" },
  { value: "comment", label: "Can comment", hint: "Read and reply" },
  { value: "view", label: "Can view", hint: "Read only" },
];
const LINK_ACCESS = [
  { value: "comment", label: "can view and comment" },
  { value: "view", label: "can view" },
  { value: "off", label: "has no access" },
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits "kai@studio.co, Jo Bello" into entries; anything with an @ must be a real email. */
export function parseInviteEntries(value) {
  const entries = String(value || "").split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean);
  const invalid = entries.filter((entry) => entry.includes("@") && !EMAIL.test(entry));
  return { entries: [...new Set(entries)], invalid };
}

function RoleSelect({ value, onChange, label, allowRemove, disabled }) {
  return (
    <span className="tm-share__select">
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {SHARE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
        {allowRemove && <option value="remove">Remove access</option>}
      </select>
    </span>
  );
}

export function ShareSheet({
  projectName,
  shareUrl,
  linkAccess,
  members = [],
  onInvite,
  onMemberChange,
  onResendInvite,
  onLinkAccessChange,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState("comment");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setMessage({ tone: "error", text: "Couldn’t copy. Select the link and copy it yourself." });
    }
  };

  const invite = async (event) => {
    event.preventDefault();
    const { entries, invalid } = parseInviteEntries(draft);
    if (!entries.length) return;
    if (invalid.length) {
      setMessage({ tone: "error", text: `${invalid[0]} doesn’t look like an email.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await onInvite({ entries, role });
      setDraft("");
      setMessage({ tone: "done", text: entries.length === 1 ? `Invited ${entries[0]}.` : `Invited ${entries.length} people.` });
    } catch (error) {
      setMessage({ tone: "error", text: error?.message ? `Couldn’t invite: ${error.message}` : "Couldn’t send the invite. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const change = async (member, next) => {
    setMessage(null);
    try {
      await onMemberChange(member.id, next === "remove" ? { remove: true } : { role: next });
      if (next === "remove") setMessage({ tone: "done", text: `${member.displayName || member.email} can’t open this any more.` });
    } catch (error) {
      setMessage({ tone: "error", text: error?.message || "Couldn’t change access. Try again." });
    }
  };

  const resend = async (member) => {
    try {
      await onResendInvite(member.id);
      setMessage({ tone: "done", text: `Sent again to ${member.email || member.displayName}.` });
    } catch (error) {
      setMessage({ tone: "error", text: error?.message || "Couldn’t resend. Try again." });
    }
  };

  // Pending invites first, so you can see what you just sent (15c).
  const people = [...members].sort((a, b) => Number(Boolean(b.pending)) - Number(Boolean(a.pending)));

  return (
    <div className="tm-sheet-layer" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} className="tm-you tm-share" role="dialog" aria-modal="true" aria-labelledby="tm-share-title" tabIndex={-1}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose?.(); } }}>
        <header className="tm-you__header">
          <ShareIcon aria-hidden="true" focusable="false" />
          <h2 id="tm-share-title">Share {projectName || "this project"}</h2>
          <button type="button" onClick={onClose} aria-label="Close sharing"><Key>Esc</Key></button>
        </header>
        <div className="tm-you__body">
          {shareUrl && (
            <div className="tm-share__link">
              <span className="tm-share__url"><LinkIcon aria-hidden="true" focusable="false" /><input readOnly value={shareUrl} aria-label="Review link" onFocus={(event) => event.target.select()} /></span>
              <button type="button" className="tm-share__button" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
            </div>
          )}
          {linkAccess && (
            <div className="tm-share__access">
              <GlobeIcon aria-hidden="true" focusable="false" />
              <strong>Anyone with the link</strong>
              {onLinkAccessChange ? (
                <span className="tm-share__select tm-share__select--inline">
                  <select aria-label="What anyone with the link can do" value={linkAccess} onChange={(event) => onLinkAccessChange(event.target.value)}>
                    {LINK_ACCESS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </span>
              ) : <span>{LINK_ACCESS.find((item) => item.value === linkAccess)?.label}</span>}
            </div>
          )}
          {onInvite && (
            <form className="tm-share__invite" onSubmit={invite}>
              <span className="tm-share__field">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Name or email" aria-label="Name or email to invite" />
                <RoleSelect value={role} onChange={setRole} label="Access for people you invite" />
              </span>
              <button type="submit" className="tm-share__button" disabled={busy || !draft.trim()}>{busy ? "Inviting…" : "Invite"}</button>
            </form>
          )}
          {message && <p className={`tm-ui-field__hint tm-share__message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}
          {people.length > 0 && (
            <div className="tm-share__people">
              <p className="tm-share__count"><span>People with access</span><span>{people.length}</span></p>
              <ul>
                {people.map((member) => {
                  const name = member.displayName || member.email;
                  const sub = member.you ? "You"
                    : member.pending ? "Invited just now"
                      : member.guest ? `Guest${member.note ? ` · ${member.note}` : ""}`
                        : member.note || (member.displayName ? member.email : "");
                  return (
                    <li key={member.id}>
                      <Avatar name={name} src={member.avatarUrl} size={28} />
                      <span className="tm-share__who">
                        <span className="tm-share__name">{name}{member.pending && <Tag>Pending</Tag>}{member.guest && !member.pending && <Tag>Guest</Tag>}</span>
                        {sub && <small>{sub}</small>}
                      </span>
                      {member.role === "owner" ? <span className="tm-share__role">Owner</span>
                        : member.pending && onResendInvite ? <button type="button" className="tm-share__resend" onClick={() => resend(member)} aria-label={`Resend the invite to ${name}`}>Resend</button>
                          : onMemberChange && !member.you ? <RoleSelect value={member.role} label={`Access for ${name}`} allowRemove onChange={(next) => change(member, next)} />
                            : <span className="tm-share__role">{SHARE_ROLES.find((item) => item.value === member.role)?.label}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="tm-share__end" />
      </section>
    </div>
  );
}
