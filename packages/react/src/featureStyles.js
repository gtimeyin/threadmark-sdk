const installed = new WeakMap();

/** Add optional styles to the same ShadowRoot and CSP path as the base overlay. */
export function installFeatureStyles(root, css) {
  if (!root?.host) return;
  let styles = installed.get(root);
  if (!styles) { styles = new Set(); installed.set(root, styles); }
  if (styles.has(css)) return;
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
    try {
      const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      styles.add(css); return;
    } catch { /* Use the same nonce-bearing fallback as the base sheet. */ }
  }
  const style = root.ownerDocument.createElement('style');
  const nonce = root.querySelector('style[nonce]')?.nonce;
  if (nonce) style.nonce = nonce;
  style.textContent = css; root.append(style); styles.add(css);
}
