// Share (Feedback experience board 04, 15a-f): the review link, who can open it, inviting people by
// name or email, and changing or removing someone's access. The host owns the people and the link;
// each part shows only when the host passes what it needs (`shareUrl`, `onInvite`, `onMemberChange`…).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon, CloseIcon, LinkIcon, LockIcon, ShareIcon } from "../icons.jsx";
import { Avatar, Key, Tag } from "../ui/primitives.jsx";

export const SHARE_ROLES = [
  { value: "edit", label: "Can edit", hint: "Comment, resolve and manage" },
  { value: "comment", label: "Can comment", hint: "Comment, reply, react" },
  { value: "view", label: "Can view", hint: "Read only" },
];
const OWNER_ROLE = { value: "owner", label: "Make owner", hint: "Manage access and settings" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits "kai@studio.co, Jo Bello" into entries; anything with an @ must be a real email. */
export function parseInviteEntries(value) {
  const entries = String(value || "").split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean);
  const invalid = entries.filter((entry) => entry.includes("@") && !EMAIL.test(entry));
  return { entries: [...new Set(entries)], invalid };
}

/** People to suggest for a typed name or email (15b): workspace people first, then a new email. */
export function inviteMatches(query, suggestions = [], exclude = []) {
  const typed = String(query || "").trim().toLowerCase();
  if (!typed) return [];
  const taken = new Set(exclude.map((value) => String(value).toLowerCase()));
  const found = suggestions
    .filter((person) => !taken.has(String(person.email || "").toLowerCase()) && !taken.has(String(person.displayName || "").toLowerCase()))
    .filter((person) => [person.displayName, person.email].some((value) => String(value || "").toLowerCase().includes(typed)))
    .slice(0, 5)
    .map((person) => ({ ...person, value: person.email || person.displayName }));
  if (EMAIL.test(typed) && !found.some((person) => String(person.email || "").toLowerCase() === typed) && !taken.has(typed)) {
    found.push({ id: `new:${typed}`, displayName: query.trim(), email: query.trim(), note: "new", value: query.trim(), isNew: true });
  }
  return found;
}

/** 15f: one menu per person — the roles with what each can do, then an Orange Remove that asks once. */
function RoleMenu({ value, label, roles, onChange, allowRemove, onRemove, disabled, inline }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  // The sheet scrolls, so the menu is placed against the window: below the button, or above when it won't fit.
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const box = ref.current?.getBoundingClientRect();
    if (box) {
      const height = 56 * roles.length + (allowRemove ? 48 : 0) + 12;
      const below = window.innerHeight - box.bottom > height + 8;
      setPlace({ right: Math.max(8, window.innerWidth - box.right), ...(below ? { top: box.bottom + 4 } : { bottom: window.innerHeight - box.top + 4 }) });
    }
    setOpen(true);
  };
  const current = [...roles, OWNER_ROLE].find((role) => role.value === value) || SHARE_ROLES.find((role) => role.value === value);
  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitemradio"][aria-checked="true"], [role="menuitemradio"]')?.focus();
    const onPointerDown = (event) => {
      const path = event.composedPath();
      if (!path.includes(ref.current) && !path.includes(menuRef.current)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);
  const close = () => { setOpen(false); requestAnimationFrame(() => ref.current?.querySelector("button")?.focus()); };
  return (
    <span ref={ref} className={`tm-share__role-menu${inline ? " is-inline" : ""}`} data-menu-open={open ? "true" : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
        if (open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          const items = [...(menuRef.current?.querySelectorAll('[role^="menuitem"]') || [])];
          const index = items.indexOf(ref.current.getRootNode().activeElement);
          items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
        }
      }}>
      <button type="button" className="tm-share__role-button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId : undefined} disabled={disabled} onClick={toggle}>
        {current?.value === "owner" ? "Owner" : current?.label || "Choose"}<ChevronDownIcon size={12} aria-hidden="true" focusable="false" />
      </button>
      {open && createPortal(
        <span ref={menuRef} id={menuId} className="tm-share__menu" role="menu" aria-label={label} style={place || undefined}>
          {roles.map((role) => (
            <button key={role.value} type="button" role="menuitemradio" aria-checked={role.value === value}
              onClick={() => { close(); if (role.value !== value) onChange(role.value); }}>
              <span><strong>{role.label}</strong><small>{role.hint}</small></span>
              {role.value === value && <CheckIcon size={14} aria-hidden="true" focusable="false" />}
            </button>
          ))}
          {allowRemove && <>
            <span className="tm-share__menu-rule" role="separator" />
            <button type="button" role="menuitem" className="tm-share__remove" onClick={() => { close(); onRemove?.(); }}>Remove access</button>
          </>}
        </span>,
        // Rendered on the sheet's layer: the sheet itself scrolls and is transformed while it animates in.
        ref.current?.closest(".tm-sheet-layer") || ref.current,
      )}
    </span>
  );
}

export function ShareSheet({
  projectName,
  shareUrl,
  members = [],
  inviteSuggestions = [],
  onInvite,
  onMemberChange,
  onResendInvite,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const [chips, setChips] = useState([]);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("comment");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [removing, setRemoving] = useState(null);
  const ref = useRef(null);
  const fieldRef = useRef(null);
  const listId = useId();
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const memberKeys = useMemo(() => members.flatMap((member) => [member.email, member.displayName].filter(Boolean)), [members]);
  const matches = useMemo(() => inviteMatches(draft, inviteSuggestions, [...memberKeys, ...chips.map((chip) => chip.value)]),
    [draft, inviteSuggestions, memberKeys, chips]);
  useEffect(() => { setActive(0); }, [draft]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setMessage({ tone: "error", text: "Couldn’t copy. Select the link and copy it yourself." });
    }
  };

  const addChip = (person) => {
    setChips((current) => (current.some((chip) => chip.value === person.value) ? current : [...current, person]));
    setDraft("");
    setMessage(null);
    fieldRef.current?.focus();
  };
  // Typed text becomes a chip on "," or ↵ when nothing is suggested; an @ must be a real email.
  const commitDraft = (value = draft) => {
    const { entries, invalid } = parseInviteEntries(value);
    if (invalid.length) { setMessage({ tone: "error", text: `${invalid[0]} doesn’t look like an email.` }); return false; }
    for (const entry of entries) addChip({ id: `typed:${entry}`, displayName: entry, value: entry });
    return entries.length > 0;
  };

  const invite = async (event) => {
    event?.preventDefault();
    if (busy) return;
    const { entries: typed, invalid } = parseInviteEntries(draft);
    if (invalid.length) { setMessage({ tone: "error", text: `${invalid[0]} doesn’t look like an email.` }); return; }
    const entries = [...new Set([...chips.map((chip) => chip.value), ...typed])];
    if (!entries.length) return;
    setBusy(true);
    setMessage(null);
    try {
      await onInvite({ entries, role, ...(note.trim() ? { message: note.trim() } : {}) });
      setChips([]);
      setDraft("");
      setNote("");
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
      await onMemberChange(member.id, { role: next });
    } catch (error) {
      setMessage({ tone: "error", text: error?.message || "Couldn’t change access. Try again." });
    }
  };
  const remove = async (member) => {
    setMessage(null);
    try {
      await onMemberChange(member.id, { remove: true });
      setRemoving(null);
      setMessage({ tone: "done", text: `${member.displayName || member.email} can’t open this any more.` });
    } catch (error) {
      setMessage({ tone: "error", text: error?.message || "Couldn’t remove them. Try again." });
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
  const youOwn = members.some((member) => member.you && member.role === "owner");
  const memberRoles = (member) => [
    ...SHARE_ROLES,
    ...(youOwn ? [OWNER_ROLE] : []),
  ];
  const inviting = chips.length > 0 || draft.trim().length > 0;
  const suggesting = matches.length > 0;

  return (
    <div className="tm-sheet-layer" data-menu-open="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} className="tm-you tm-share" role="dialog" aria-modal="true" aria-labelledby="tm-share-title" tabIndex={-1}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (removing) setRemoving(null); else onClose?.(); } }}>
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
          {shareUrl && (
            // Reviews are private (decided 2026-10): the link only works for people who were invited and sign in.
            <div className="tm-share__access">
              <LockIcon aria-hidden="true" focusable="false" />
              <span>Only people you invite can open this link, after signing in.</span>
            </div>
          )}
          {onInvite && (
            <form className="tm-share__invite" onSubmit={invite}>
              <div className="tm-share__invite-row">
                <span className={`tm-share__field${inviting ? " is-active" : ""}`} onClick={() => fieldRef.current?.focus()}>
                  <span className="tm-share__chips">
                    {chips.map((chip) => (
                      <span key={chip.value} className="tm-share__chip">
                        {chip.value}
                        <button type="button" aria-label={`Remove ${chip.value}`} onClick={(event) => { event.stopPropagation(); setChips((current) => current.filter((item) => item.value !== chip.value)); fieldRef.current?.focus(); }}>
                          <CloseIcon size={10} aria-hidden="true" focusable="false" />
                        </button>
                      </span>
                    ))}
                    <input ref={fieldRef} value={draft} placeholder={chips.length ? "" : "Name or email"} aria-label="Name or email to invite"
                      role="combobox" aria-expanded={suggesting} aria-controls={suggesting ? listId : undefined} aria-autocomplete="list"
                      aria-activedescendant={suggesting ? `${listId}-${active}` : undefined}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (/[,;]/.test(value)) { if (!commitDraft(value)) setDraft(value.replace(/[,;]+/g, "")); return; }
                        setDraft(value);
                      }}
                      onKeyDown={(event) => {
                        if (suggesting && ["ArrowDown", "ArrowUp"].includes(event.key)) {
                          event.preventDefault();
                          setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
                        } else if (event.key === "Enter" && draft.trim()) {
                          event.preventDefault();
                          if (suggesting) addChip(matches[Math.min(active, matches.length - 1)]);
                          else commitDraft();
                        } else if (event.key === "Backspace" && !draft && chips.length) {
                          setChips((current) => current.slice(0, -1));
                        } else if (event.key === "Escape" && draft) {
                          event.stopPropagation();
                          setDraft("");
                        }
                      }} />
                  </span>
                  <RoleMenu value={role} label="Access for people you invite" inline
                    roles={SHARE_ROLES} onChange={setRole} />
                </span>
                <button type="submit" className={`tm-share__button${inviting ? " is-primary" : ""}`} disabled={busy || !inviting}>{busy ? "Inviting…" : "Invite"}</button>
              </div>
              {suggesting && (
                <ul id={listId} className="tm-share__suggestions" role="listbox" aria-label="Suggestions">
                  {matches.map((person, index) => (
                    <li key={person.id || person.value} id={`${listId}-${index}`} role="option" aria-selected={index === active}
                      className={index === active ? "is-active" : undefined}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => { event.preventDefault(); addChip(person); }}>
                      <Avatar name={person.displayName || person.email} src={person.avatarUrl} size={24} />
                      <span><strong>{person.displayName || person.email}</strong>
                        <small>{[person.displayName && person.email !== person.displayName ? person.email : null, person.note].filter(Boolean).join(" · ")}</small></span>
                    </li>
                  ))}
                </ul>
              )}
              {chips.length > 0 && (
                <input className="tm-share__note" value={note} maxLength={500} placeholder="Add a short note (optional)" aria-label="Note for the invite"
                  onChange={(event) => setNote(event.target.value)} />
              )}
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
                  if (removing === member.id) {
                    return (
                      <li key={member.id} className="tm-share__confirm" role="alert">
                        <span><strong>Remove {name}?</strong><small>They can’t open this any more. You can invite them again.</small></span>
                        <button type="button" className="tm-share__button" autoFocus onClick={() => setRemoving(null)}>Keep</button>
                        <button type="button" className="tm-share__button tm-share__button--danger" onClick={() => remove(member)}>Remove</button>
                      </li>
                    );
                  }
                  return (
                    <li key={member.id}>
                      <Avatar name={name} src={member.avatarUrl} size={28} />
                      <span className="tm-share__who">
                        <span className="tm-share__name">{name}{member.pending && <Tag>Pending</Tag>}{member.guest && !member.pending && <Tag>Guest</Tag>}</span>
                        {sub && <small>{sub}</small>}
                      </span>
                      {member.role === "owner" ? <span className="tm-share__role">Owner</span>
                        : member.pending && onResendInvite ? <button type="button" className="tm-share__resend" onClick={() => resend(member)} aria-label={`Resend the invite to ${name}`}>Resend</button>
                          : onMemberChange && !member.you ? <RoleMenu value={member.role} label={`Access for ${name}`} roles={memberRoles(member)}
                            allowRemove onRemove={() => setRemoving(member.id)} onChange={(next) => change(member, next)} />
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
