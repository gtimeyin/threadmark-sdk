export const REACTIONS = [["👍", "Thumbs up"], ["❤️", "Heart"], ["🎉", "Celebrate"], ["👀", "Eyes"], ["✅", "Agree"]];
export function normalizeReactions(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 5000).flatMap((item) => {
    if (!REACTIONS.some(([emoji]) => emoji === item?.emoji) || typeof item?.reviewer?.id !== "string" || !item.reviewer.id || typeof item.reviewer.displayName !== "string") return [];
    const key = JSON.stringify([item.emoji, item.reviewer.id]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ emoji: item.emoji, reviewer: { id: item.reviewer.id.slice(0, 160), displayName: item.reviewer.displayName.slice(0, 120) } }];
  });
}
