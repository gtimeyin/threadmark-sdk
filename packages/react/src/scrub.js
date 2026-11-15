// Scrubbing for anything Threadmark keeps from a page: URLs lose credentials and query values, and credentials,
// key-shaped strings, emails, and card numbers are replaced. Used by session replay (console text, request URLs
// and bodies) and by app context (`metadata`).

const MAX_URL_LENGTH = 300;

/** Keeps origin and path; drops credentials, fragments, and every query value. */
export function sanitizeReplayUrl(raw, base = globalThis.location?.href || "https://threadmark.invalid/") {
  try {
    const url = new URL(String(raw), base);
    if (!/^(?:https?|wss?):$/.test(url.protocol)) return url.protocol.replace(":", "") + ":";
    const keys = [...new Set([...url.searchParams.keys()])].slice(0, 10);
    const query = keys.length ? `?${keys.map((key) => `${encodeURIComponent(key)}=…`).join("&")}` : "";
    return `${url.origin}${url.pathname}${query}`.slice(0, MAX_URL_LENGTH);
  } catch {
    return "";
  }
}

const REDACTED = "[redacted]";
// Well-known credential shapes: OpenAI/Stripe/Anthropic-style keys, Supabase, Slack, GitHub, GitLab, npm,
// AWS, Google, Resend, and Threadmark's own agent tokens.
const KEY_PATTERNS = [
  /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant|svcacct)?[-_]?[A-Za-z0-9_-]{12,}/g,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{8,}/g,
  /\bxapp-[A-Za-z0-9-]{8,}/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\bnpm_[A-Za-z0-9]{20,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bre_[A-Za-z0-9_]{16,}/g,
  /\btmk_[A-Za-z0-9_-]{10,}/g,
];
const SECRET_NAMES = "password|passwd|pwd|secret|client[_-]?secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|apikey|auth|authorization|session(?:[_-]?id)?|cookie|set-cookie|signature|otp";
const NAMED_SECRET = new RegExp(`(["']?\\b(?:${SECRET_NAMES})\\b["']?\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;&}\\]]+)`, "gi");
// Values that say nothing secret (`token: null`, `auth: true`) and auth schemes handled above stay.
const HARMLESS_VALUE = /^(?:\[redacted\]|…|true|false|null|undefined|\d{1,6}|Bearer|Basic|Token|Digest)$/i;

function looksSecret(run) {
  return /[0-9]/.test(run) && /[a-z]/.test(run) && /[A-Z]/.test(run);
}

/** True for a run of 13–19 digits that passes the card-number checksum (Luhn). */
function isCardNumber(digits) {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Replaces card numbers (13–19 digits, spaces or dashes allowed, checksum valid); other long numbers stay. */
export function scrubCardNumbers(text) {
  return String(text ?? "").replace(/\b\d(?:[ -]?\d){12,18}\b/g, (run) => (isCardNumber(run.replace(/\D/g, "")) ? "[card]" : run));
}

/** Replaces only unmistakable credentials: JWTs, auth headers, well-known key formats, and `password=…` pairs. */
export function scrubCredentials(text) {
  let value = String(text ?? "");
  value = value.replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*/g, "[redacted JWT]");
  value = value.replace(/\b(Bearer|Basic|Token|Digest)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`);
  for (const pattern of KEY_PATTERNS) value = value.replace(pattern, REDACTED);
  return value.replace(NAMED_SECRET, (match, name, secret) => (HARMLESS_VALUE.test(secret) ? match : `${name}${REDACTED}`));
}

const SECRET_WORDS = new Set([
  "password", "passwd", "pwd", "passphrase", "secret", "secrets", "cookie", "cookies", "authorization",
  "credential", "credentials", "signature", "otp", "jwt", "bearer", "apikey", "privatekey", "secretkey",
  "accesskey", "sessionid", "ssn", "cvv", "cvc", "csc", "cardnumber", "iban",
]);

/**
 * True for an object key that names a credential (`password`, `apiKey`, `csrf_token`, `Authorization`, `cvc`),
 * but not for ordinary keys that only mention one (`maxTokens`, `tokenCount`, `keyboardLayout`).
 */
export function isSecretName(key) {
  const words = String(key ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (!words.length) return false;
  const last = words[words.length - 1];
  if (words.some((word) => SECRET_WORDS.has(word)) || SECRET_WORDS.has(words.join(""))) return true;
  if (last === "token" || (words.length === 1 && last === "auth")) return true;
  if (last === "number" && words[words.length - 2] === "card") return true;
  return last === "key" && ["api", "secret", "private", "access", "signing", "encryption", "license"].includes(words[words.length - 2]);
}

/**
 * Console text as it may be stored: URLs keep their origin, path, and query names; credentials, key-looking
 * strings, JWTs, emails, card numbers, and long hex or base64 runs are replaced.
 */
export function scrubConsoleText(text, base = globalThis.location?.href || "https://threadmark.invalid/") {
  let value = String(text ?? "");
  value = value.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>()[\]{}`]+/gi, (url) => {
    if (!/^https?:/i.test(url)) return url.replace(/[?#].*$/, "");
    return sanitizeReplayUrl(url, base) || REDACTED;
  });
  value = scrubCredentials(value);
  value = value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, "[email]");
  value = scrubCardNumbers(value);
  value = value.replace(/\b[0-9a-f]{32,}\b/gi, REDACTED);
  value = value.replace(/[A-Za-z0-9_-]{32,}/g, (run) => (looksSecret(run) ? REDACTED : run));
  value = value.replace(/[A-Za-z0-9+/]{40,}={0,2}/g, (run) => (looksSecret(run) ? REDACTED : run));
  return value;
}
