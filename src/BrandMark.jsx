// Threadmark brand mark: an open comment pin (forest outline) holding the coral "mark".
// This is a brand asset, not a functional icon, so it is authored here rather than taken from Lucide.
export function BrandMark({ size = 24, line = "var(--green)", dot = "var(--coral)" }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M9.5 38.5V22A12.5 12.5 0 0 1 22 9.5h4A12.5 12.5 0 0 1 38.5 22v4A12.5 12.5 0 0 1 26 38.5Z"
        fill="none"
        stroke={line}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="5" fill={dot} />
    </svg>
  );
}

export function Wordmark({ size = 24 }) {
  return (
    <>
      <BrandMark size={size} />
      <span>threadmark</span>
    </>
  );
}
