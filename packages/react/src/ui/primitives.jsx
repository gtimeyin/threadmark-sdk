// Threadmark UI primitives. Each mirrors a component in the Figma brand book's UI Components page
// (file u7Xb91nRDDSy5sfPgvgiBQ, page 145:1322) so surfaces are assembled from the same parts the
// designs use. Styles live in ./primitiveStyles.js and are scoped under the overlay's shadow root.
import { forwardRef, useId } from "react";
import { InfoIcon, SuccessIcon, WarningIcon } from "../icons.jsx";

const cx = (...names) => names.filter(Boolean).join(" ");

/** Button: Primary (Lime) / Secondary / Forest / Record / Outline / Outline dark × Medium / Small / Mini. */
export const Button = forwardRef(function Button(
  { variant = "primary", size = "md", icon: Icon, kbd, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx("tm-ui-button", `tm-ui-button--${variant}`, `tm-ui-button--${size}`, className)} {...rest}>
      {Icon ? <Icon aria-hidden="true" focusable="false" className="tm-ui-button__icon" /> : null}
      {children != null ? <span className="tm-ui-button__label">{children}</span> : null}
      {kbd ? <Key>{kbd}</Key> : null}
    </button>
  );
});

/** Icon button: Ghost / Secondary / Primary / Record / Forest / Outline dark × 32 / 28. Always labelled. */
export const IconButton = forwardRef(function IconButton(
  { label, icon: Icon, variant = "ghost", size = 32, pressed, className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      aria-pressed={pressed}
      className={cx("tm-ui-icon-button", `tm-ui-icon-button--${variant}`, `tm-ui-icon-button--${size}`, className)}
      {...rest}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
      {children}
    </button>
  );
});

/** Key: a keyboard shortcut cap, e.g. ⌘⇧F or Esc. */
export function Key({ children, className }) {
  return <kbd className={cx("tm-ui-key", className)}>{children}</kbd>;
}

/** Tag: a small neutral label such as "Guest" or "Soon". */
export function Tag({ children, tone, className }) {
  return <span className={cx("tm-ui-tag", tone && `tm-ui-tag--${tone}`, className)}>{children}</span>;
}

/** Chip: a removable token, e.g. an invited email address. */
export function Chip({ children, onRemove, removeLabel = "Remove", className }) {
  return (
    <span className={cx("tm-ui-chip", className)}>
      <span>{children}</span>
      {onRemove ? (
        <button type="button" className="tm-ui-chip__remove" aria-label={`${removeLabel} ${typeof children === "string" ? children : ""}`.trim()} onClick={onRemove}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7L7 17" /></svg>
        </button>
      ) : null}
    </span>
  );
}

const NOTICE_ICONS = { problem: WarningIcon, info: InfoIcon, done: SuccessIcon };

/** Notice: Problem / Info / Done, on dark or light surfaces, with up to two actions. */
export function Notice({ tone = "info", surface = "dark", children, action, secondaryAction, role, className }) {
  const Icon = NOTICE_ICONS[tone] || InfoIcon;
  return (
    <div className={cx("tm-ui-notice", `tm-ui-notice--${tone}`, `tm-ui-notice--${surface}`, className)} role={role ?? (tone === "problem" ? "alert" : "status")}>
      <div className="tm-ui-notice__row">
        <Icon aria-hidden="true" focusable="false" className="tm-ui-notice__icon" />
        <div className="tm-ui-notice__message">{children}</div>
      </div>
      {action || secondaryAction ? <div className="tm-ui-notice__actions">{action}{secondaryAction}</div> : null}
    </div>
  );
}

/** Toast: a short confirmation with an optional action ("Undo"). */
export function Toast({ children, action, className, ...rest }) {
  return (
    <div className={cx("tm-ui-toast", className)} role="status" aria-live="polite" {...rest}>
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Switch: On / Off, rendered as a real checkbox so it works with keyboards and screen readers. */
export function Switch({ checked, onChange, label, description, disabled, className }) {
  const id = useId();
  return (
    <label className={cx("tm-ui-switch", disabled && "is-disabled", className)} htmlFor={id}>
      <span className="tm-ui-switch__text">
        <span className="tm-ui-switch__label">{label}</span>
        {description ? <span className="tm-ui-switch__description">{description}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={!!checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} />
      <span className="tm-ui-switch__track" aria-hidden="true"><span className="tm-ui-switch__knob" /></span>
    </label>
  );
}

/** Input: Medium / Small, with error and read-only states and optional leading and trailing parts. */
export const Input = forwardRef(function Input(
  { label, hint, error, size = "md", leading, trailing, readOnly, className, id: givenId, ...rest },
  ref,
) {
  const autoId = useId();
  const id = givenId || autoId;
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={cx("tm-ui-field", className)}>
      {label ? <label className="tm-ui-field__label" htmlFor={id}>{label}</label> : null}
      <div className={cx("tm-ui-input", `tm-ui-input--${size}`, error && "is-error", readOnly && "is-readonly")}>
        {leading}
        <input ref={ref} id={id} readOnly={readOnly} aria-invalid={error ? true : undefined} aria-describedby={hintId} {...rest} />
        {trailing}
      </div>
      {error || hint ? <p id={hintId} className={cx("tm-ui-field__hint", error && "is-error")}>{error || hint}</p> : null}
    </div>
  );
});

/** Segmented: a set of mutually exclusive choices. */
export function Segmented({ label, options, value, onChange, className }) {
  return (
    <div className={cx("tm-ui-segmented", className)} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cx("tm-ui-segment", selected && "is-selected")}
            onClick={() => onChange?.(option.value)}
          >
            {option.icon ? <option.icon aria-hidden="true" focusable="false" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const initialsOf = (name = "") => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[words.length - 1][0]).toUpperCase();
};

/** Avatar: a face when the reviewer has one, otherwise their initials. 20 / 28 / 40px. */
export function Avatar({ name, src, size = 28, className, decorative = true }) {
  return (
    <span
      className={cx("tm-ui-avatar", `tm-ui-avatar--${size}`, src && "tm-ui-avatar--face", className)}
      aria-hidden={decorative ? "true" : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
    >
      {src ? <img src={src} alt="" draggable="false" /> : initialsOf(name)}
    </span>
  );
}

/** Empty state: an icon, a one-line title, a sentence and optional actions. */
export function EmptyState({ icon: Icon, title, children, actions, className }) {
  return (
    <div className={cx("tm-ui-empty", className)}>
      {Icon ? <span className="tm-ui-empty__icon"><Icon aria-hidden="true" focusable="false" /></span> : null}
      {title ? <p className="tm-ui-empty__title">{title}</p> : null}
      {children ? <p className="tm-ui-empty__body">{children}</p> : null}
      {actions ? <div className="tm-ui-empty__actions">{actions}</div> : null}
    </div>
  );
}
