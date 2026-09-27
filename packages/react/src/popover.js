function normalizeRect(rect = {}) {
  const left = Number(rect.left) || 0;
  const top = Number(rect.top) || 0;
  const width = Math.max(0, Number(rect.width) || 0);
  const height = Math.max(0, Number(rect.height) || 0);
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function visibleArea(candidate, popover, viewport, margin) {
  const left = Math.max(candidate.left, margin);
  const top = Math.max(candidate.top, margin);
  const right = Math.min(candidate.left + popover.width, viewport.width - margin);
  const bottom = Math.min(candidate.top + popover.height, viewport.height - margin);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

export function computePopoverPosition({ anchor, popover, viewport, margin = 12, gap = 8 }) {
  const target = normalizeRect(anchor);
  const surface = normalizeRect(popover);
  const frame = {
    width: Math.max(0, Number(viewport?.width) || 0),
    height: Math.max(0, Number(viewport?.height) || 0),
  };
  const candidates = [
    {
      side: "below",
      left: target.left + (target.width - surface.width) / 2,
      top: target.bottom + gap,
    },
    {
      side: "above",
      left: target.left + (target.width - surface.width) / 2,
      top: target.top - surface.height - gap,
    },
    {
      side: "right",
      left: target.right + gap,
      top: target.top + (target.height - surface.height) / 2,
    },
    {
      side: "left",
      left: target.left - surface.width - gap,
      top: target.top + (target.height - surface.height) / 2,
    },
  ];
  const fits = (candidate) => candidate.left >= margin
    && candidate.top >= margin
    && candidate.left + surface.width <= frame.width - margin
    && candidate.top + surface.height <= frame.height - margin;
  const preferred = candidates.find(fits)
    || candidates.reduce((best, candidate) => (
      visibleArea(candidate, surface, frame, margin) > visibleArea(best, surface, frame, margin)
        ? candidate
        : best
    ));

  return {
    left: Math.floor(clamp(preferred.left, margin, frame.width - surface.width - margin)),
    top: Math.floor(clamp(preferred.top, margin, frame.height - surface.height - margin)),
    side: preferred.side,
  };
}
