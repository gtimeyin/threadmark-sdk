// Threadmark's brand faces ship inside the package (latin subsets, inlined at build time) so the
// overlay never requests fonts from a third party. @font-face rules do not apply inside a shadow
// root, so the faces are registered on the document under prefixed names that cannot collide with
// the host application's own fonts. Faces are handed over as bytes, not data: URLs, so a strict
// font-src policy (common on production sites reviewed through the extension) cannot block them.
import geist400 from "@fontsource/geist/files/geist-latin-400-normal.woff2?inline";
import geist500 from "@fontsource/geist/files/geist-latin-500-normal.woff2?inline";
import geist600 from "@fontsource/geist/files/geist-latin-600-normal.woff2?inline";
import geist700 from "@fontsource/geist/files/geist-latin-700-normal.woff2?inline";
import geistMono400 from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?inline";
import bricolage600 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff2?inline";

const FACES = [
  ["Threadmark Geist", geist400, "400"],
  ["Threadmark Geist", geist500, "500"],
  ["Threadmark Geist", geist600, "600"],
  ["Threadmark Geist", geist700, "700"],
  ["Threadmark Geist Mono", geistMono400, "400"],
  ["Threadmark Bricolage", bricolage600, "600"],
];

let registered = false;

function bytesOf(dataUrl) {
  const binary = atob(String(dataUrl).slice(String(dataUrl).indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function registerThreadmarkFonts() {
  if (registered || typeof document === "undefined" || !document.fonts || typeof FontFace === "undefined") return;
  registered = true;
  for (const [family, source, weight] of FACES) {
    try {
      document.fonts.add(new FontFace(family, bytesOf(source), { weight, style: "normal", display: "swap" }));
    } catch {
      // A rejected face falls back to the system stack in --tm-font.
    }
  }
}
