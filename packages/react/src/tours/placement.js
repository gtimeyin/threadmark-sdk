// Where a step card goes. Pure geometry so it can be tested without a browser.

export const PHONE_MAX_WIDTH = 639;
const SIDE_ORDER = ["bottom", "top", "right", "left"];
const ARROW_INSET = 18;

function fits(side, target, card, viewport, gap, margin) {
  if (side === "bottom") return target.bottom + gap + card.height <= viewport.height - margin;
  if (side === "top") return target.top - gap - card.height >= margin;
  if (side === "right") return target.right + gap + card.width <= viewport.width - margin;
  return target.left - gap - card.width >= margin;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * @param target  the target's viewport rect, or null for a step with nothing to point at
 * @param card    the card's measured { width, height }
 * @param viewport { width, height }
 * @param placement "auto" | "top" | "bottom" | "left" | "right" | "sheet"
 * @returns { mode: "sheet" | "center" | "anchored", side?, left?, top?, arrowOffset? }
 */
export function placeCard({ target, card, viewport, placement = "auto", gap = 12, margin = 12 }) {
  if (placement === "sheet" || viewport.width <= PHONE_MAX_WIDTH) return { mode: "sheet" };
  if (!target) return { mode: "center" };

  const order = placement === "auto" ? SIDE_ORDER : [placement, ...SIDE_ORDER.filter((side) => side !== placement)];
  const side = order.find((candidate) => fits(candidate, target, card, viewport, gap, margin));
  if (!side) return { mode: "sheet" };

  const vertical = side === "top" || side === "bottom";
  const targetCenter = vertical ? (target.left + target.right) / 2 : (target.top + target.bottom) / 2;
  const size = vertical ? card.width : card.height;
  const limit = (vertical ? viewport.width : viewport.height) - margin - size;
  const start = clamp(targetCenter - size / 2, margin, limit);
  const arrowOffset = clamp(targetCenter - start, ARROW_INSET, size - ARROW_INSET);

  if (vertical) {
    return { mode: "anchored", side, left: start, top: side === "bottom" ? target.bottom + gap : target.top - gap - card.height, arrowOffset };
  }
  return { mode: "anchored", side, top: start, left: side === "right" ? target.right + gap : target.left - gap - card.width, arrowOffset };
}

/** How far to scroll so the target sits fully above a bottom sheet (and below the top edge). 0 when it already does. */
export function scrollForSheet({ target, sheetHeight, viewport, margin = 16 }) {
  if (!target) return 0;
  const visibleBottom = viewport.height - sheetHeight - margin;
  if (target.top >= margin && target.bottom <= visibleBottom) return 0;
  const room = visibleBottom - margin;
  const targetHeight = target.bottom - target.top;
  // Tall targets align their top; otherwise centre the target in the room above the sheet.
  const desiredTop = targetHeight >= room ? margin : margin + (room - targetHeight) / 2;
  return Math.round(target.top - desiredTop);
}
