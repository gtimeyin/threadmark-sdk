const BUILT_IN_REDACTION_SELECTOR = [
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable]:not([contenteditable='false'])",
  "[data-threadmark-sensitive]",
  "[data-threadmark-ignore]",
  "iframe",
  "video",
  "object",
  "embed",
  "canvas",
].join(",");

const MAX_PIXEL_AREA = 4_000_000;
const MAX_BLOB_BYTES = 2_000_000;
const MAX_SNAPSHOT_DOCUMENT_NODES = 20_000;
const MAX_SNAPSHOT_PAGE_DIMENSION = 50_000;
const MAX_SNAPSHOT_PAGE_AREA = 100_000_000;
const SNAPSHOT_MIME_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cloneValidPoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = finiteNumber(point.x);
  const y = finiteNumber(point.y);
  return x == null || y == null ? null : { x, y };
}

export function mapMarkupPoint(point, displayRect, bitmapSize) {
  const displayWidth = finiteNumber(displayRect?.width);
  const displayHeight = finiteNumber(displayRect?.height);
  const bitmapWidth = finiteNumber(bitmapSize?.width);
  const bitmapHeight = finiteNumber(bitmapSize?.height);
  const pointX = finiteNumber(point?.x);
  const pointY = finiteNumber(point?.y);
  const displayLeft = finiteNumber(displayRect?.left) ?? 0;
  const displayTop = finiteNumber(displayRect?.top) ?? 0;

  if (
    displayWidth == null
    || displayHeight == null
    || bitmapWidth == null
    || bitmapHeight == null
    || pointX == null
    || pointY == null
    || displayWidth <= 0
    || displayHeight <= 0
    || bitmapWidth <= 0
    || bitmapHeight <= 0
  ) {
    return { x: 0, y: 0 };
  }

  const clamp = (value, maximum) => Math.min(Math.max(value, 0), maximum);
  return {
    x: clamp(((pointX - displayLeft) / displayWidth) * bitmapWidth, bitmapWidth),
    y: clamp(((pointY - displayTop) / displayHeight) * bitmapHeight, bitmapHeight),
  };
}

export function simplifyMarkupPoints(points, minDistance = 0) {
  const validPoints = (Array.isArray(points) ? points : [])
    .map(cloneValidPoint)
    .filter(Boolean);
  if (validPoints.length <= 1) return validPoints;

  const requestedDistance = finiteNumber(minDistance);
  const threshold = Math.max(0, requestedDistance ?? 0);
  const simplified = [validPoints[0]];

  for (let index = 1; index < validPoints.length - 1; index += 1) {
    const point = validPoints[index];
    const previous = simplified[simplified.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= threshold) {
      simplified.push(point);
    }
  }

  const last = validPoints[validPoints.length - 1];
  const previous = simplified[simplified.length - 1];
  if (last.x !== previous.x || last.y !== previous.y) simplified.push(last);
  return simplified;
}

export function addMarkupStroke(strokes, stroke) {
  const current = Array.isArray(strokes) ? strokes.slice() : [];
  const points = simplifyMarkupPoints(stroke?.points, 0);
  if (!stroke || typeof stroke !== "object" || points.length < 2) return current;
  return [...current, { ...stroke, points }];
}

export function undoMarkupStroke(strokes) {
  const current = Array.isArray(strokes) ? strokes : [];
  return current.slice(0, Math.max(0, current.length - 1));
}

export function clearMarkupStrokes() {
  return [];
}

function intersects(left, top, width, height, region) {
  return left < region.left + region.width
    && left + width > region.left
    && top < region.top + region.height
    && top + height > region.top;
}

function elementRect(element) {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function matchesAny(element, selectors) {
  return selectors.some((selector) => element.matches?.(selector));
}

function snapshotSelectors(ignoredSelectors) {
  return [BUILT_IN_REDACTION_SELECTOR, ...(ignoredSelectors || [])];
}

function isExcludedNode(node, selectors) {
  if (node.nodeType !== 1) return false;
  const element = node;
  if (element.hasAttribute?.("data-threadmark-root")) return true;
  return matchesAny(element, selectors);
}

function collectRedactionRects(documentRef, region, selectors) {
  const elements = new Set();
  for (const selector of selectors) {
    for (const element of documentRef.querySelectorAll(selector)) elements.add(element);
  }

  return [...elements]
    .map(elementRect)
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .filter((rect) => intersects(rect.left, rect.top, rect.width, rect.height, region));
}

function isCrossOriginUrl(rawUrl, windowRef) {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl, windowRef.location.href);
    return ["http:", "https:"].includes(url.protocol) && url.origin !== windowRef.location.origin;
  } catch {
    return true;
  }
}

function hasCrossOriginImage(documentRef, windowRef, region) {
  return [...documentRef.querySelectorAll("img,svg image")].some((element) => {
    const rect = elementRect(element);
    const source = element.currentSrc || element.src || element.getAttribute("href") || element.getAttribute("xlink:href");
    return intersects(rect.left, rect.top, rect.width, rect.height, region)
      && isCrossOriginUrl(source, windowRef);
  });
}

function canvasToBlob(canvas, type = "image/webp", quality = 0.82) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the snapshot."));
    }, type, quality);
  });
}

function downscaleCanvas(source, factor) {
  const canvas = source.ownerDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * factor));
  canvas.height = Math.max(1, Math.round(source.height * factor));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("The browser could not create a snapshot canvas.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function captureBackground(documentRef, windowRef) {
  for (const element of [documentRef.body, documentRef.documentElement]) {
    if (!element) continue;
    const color = windowRef.getComputedStyle(element).backgroundColor;
    if (color && !["transparent", "rgba(0, 0, 0, 0)"].includes(color)) return color;
  }
  return "#ffffff";
}

async function waitForPageFonts(documentRef, windowRef, signal) {
  if (!documentRef.fonts?.ready) return;
  let timer;
  try {
    await Promise.race([
      documentRef.fonts.ready,
      new Promise((resolve) => { timer = windowRef.setTimeout(resolve, 2_000); }),
    ]);
  } catch {
    // Font loading can fail independently of feedback capture.
  } finally {
    windowRef.clearTimeout(timer);
  }
  if (signal?.aborted) throw new DOMException("Snapshot cancelled", "AbortError");
}

function childElements(node) {
  return node?.children ? [...node.children] : [];
}

export function snapshotDocumentBudget(
  documentRef,
  windowRef,
  {
    maxNodes = MAX_SNAPSHOT_DOCUMENT_NODES,
    maxPageDimension = MAX_SNAPSHOT_PAGE_DIMENSION,
    maxPageArea = MAX_SNAPSHOT_PAGE_AREA,
  } = {},
) {
  const root = documentRef?.documentElement;
  if (!root) return { allowed: false, reason: "missing_document", nodeCount: 0, pageWidth: 0, pageHeight: 0 };

  const viewportWidth = Math.max(1, Number(windowRef?.innerWidth) || 1);
  const viewportHeight = Math.max(1, Number(windowRef?.innerHeight) || 1);
  const pageWidth = Math.max(root.scrollWidth || 0, documentRef.body?.scrollWidth || 0, viewportWidth);
  const pageHeight = Math.max(root.scrollHeight || 0, documentRef.body?.scrollHeight || 0, viewportHeight);
  const stack = [root];
  const visited = new Set();
  let nodeCount = 0;

  while (stack.length) {
    const element = stack.pop();
    if (!element || visited.has(element)) continue;
    visited.add(element);
    nodeCount += 1;
    if (nodeCount > maxNodes) {
      return { allowed: false, reason: "document_too_complex", nodeCount, pageWidth, pageHeight };
    }
    stack.push(...childElements(element));
    if (element.shadowRoot) stack.push(...childElements(element.shadowRoot));
  }

  if (
    pageWidth > maxPageDimension
    || pageHeight > maxPageDimension
    || pageWidth * pageHeight > maxPageArea
  ) {
    return { allowed: false, reason: "document_too_large", nodeCount, pageWidth, pageHeight };
  }

  return { allowed: true, reason: null, nodeCount, pageWidth, pageHeight };
}

async function encodeWithinLimit(initialCanvas, type = "image/webp", quality = 0.82) {
  let canvas = initialCanvas;
  let reduced = false;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const blob = await canvasToBlob(canvas, type, quality);
    if (blob.size <= MAX_BLOB_BYTES) return { blob, canvas, reduced };
    canvas = downscaleCanvas(canvas, 0.72);
    reduced = true;
  }

  throw new Error("The snapshot was too large to attach safely.");
}

export function normalizeDrawRect(start, end, viewport) {
  const clampX = (value) => Math.min(Math.max(value, 0), viewport.width);
  const clampY = (value) => Math.min(Math.max(value, 0), viewport.height);
  const startX = clampX(start.x);
  const startY = clampY(start.y);
  const endX = clampX(end.x);
  const endY = clampY(end.y);

  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export function snapshotScale(region, devicePixelRatio = 1) {
  const area = Math.max(1, region.width * region.height);
  return Math.max(0.1, Math.min(
    Number(devicePixelRatio) || 1,
    2,
    Math.sqrt(MAX_PIXEL_AREA / area),
  ));
}

export async function captureRegionSnapshot({
  id,
  region,
  ignoredSelectors = [],
  documentRef = document,
  windowRef = window,
  signal,
}) {
  if (signal?.aborted) throw new DOMException("Snapshot cancelled", "AbortError");

  const selectors = snapshotSelectors(ignoredSelectors);
  const redactions = collectRedactionRects(documentRef, region, selectors);
  const embeddedContentWasMasked = [...documentRef.querySelectorAll("iframe,video,object,embed,canvas")]
    .map(elementRect)
    .some((rect) => intersects(rect.left, rect.top, rect.width, rect.height, region));
  let crossOriginAssetWasOmitted = hasCrossOriginImage(documentRef, windowRef, region);
  const viewportWidth = windowRef.innerWidth;
  const viewportHeight = windowRef.innerHeight;
  const captureScrollX = windowRef.scrollX;
  const captureScrollY = windowRef.scrollY;
  const root = documentRef.documentElement;
  const budget = snapshotDocumentBudget(documentRef, windowRef);
  if (!budget.allowed) {
    throw new Error(`Threadmark snapshot blocked: ${budget.reason}.`);
  }
  const scale = snapshotScale(region, windowRef.devicePixelRatio);
  const backgroundColor = captureBackground(documentRef, windowRef);
  const { domToCanvas } = await import("modern-screenshot");
  await waitForPageFonts(documentRef, windowRef, signal);

  if (signal?.aborted) throw new DOMException("Snapshot cancelled", "AbortError");
  if (windowRef.scrollX !== captureScrollX || windowRef.scrollY !== captureScrollY) {
    throw new Error("The page moved while Threadmark prepared the snapshot.");
  }

  const viewportCanvas = await domToCanvas(root, {
    width: viewportWidth,
    height: viewportHeight,
    scale,
    backgroundColor,
    filter: (node) => !isExcludedNode(node, selectors),
    fetchFn: async (rawUrl) => {
      if (!isCrossOriginUrl(rawUrl, windowRef)) return false;
      crossOriginAssetWasOmitted = true;
      return TRANSPARENT_PIXEL;
    },
    fetch: {
      requestInit: {
        mode: "same-origin",
        redirect: "error",
        credentials: "same-origin",
        referrerPolicy: "no-referrer",
        signal,
      },
      placeholderImage: TRANSPARENT_PIXEL,
    },
    // Embed the host's available web fonts into the isolated SVG rasterization.
    // The fetch options above prevent cross-origin asset requests.
    font: {},
    timeout: 8_000,
    maximumCanvasSize: 8_192,
    features: { restoreScrollPosition: true },
    style: {
      width: `${budget.pageWidth}px`,
      height: `${budget.pageHeight}px`,
      maxWidth: "none",
      maxHeight: "none",
      overflow: "visible",
    },
  });

  if (signal?.aborted) throw new DOMException("Snapshot cancelled", "AbortError");
  if (windowRef.scrollX !== captureScrollX || windowRef.scrollY !== captureScrollY) {
    throw new Error("The page moved while Threadmark captured the snapshot.");
  }

  const output = documentRef.createElement("canvas");
  output.width = Math.max(1, Math.round(region.width * scale));
  output.height = Math.max(1, Math.round(region.height * scale));
  const context = output.getContext("2d", { alpha: false });
  if (!context) throw new Error("The browser could not create a snapshot canvas.");

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, output.width, output.height);

  context.drawImage(
    viewportCanvas,
    Math.round(region.left * scale),
    Math.round(region.top * scale),
    Math.round(region.width * scale),
    Math.round(region.height * scale),
    0,
    0,
    output.width,
    output.height,
  );

  context.fillStyle = "#202722";
  for (const rect of redactions) {
    const left = Math.max(rect.left, region.left) - region.left;
    const top = Math.max(rect.top, region.top) - region.top;
    const right = Math.min(rect.left + rect.width, region.left + region.width) - region.left;
    const bottom = Math.min(rect.top + rect.height, region.top + region.height) - region.top;
    context.fillRect(
      Math.max(0, Math.floor(left * scale) - 2),
      Math.max(0, Math.floor(top * scale) - 2),
      Math.ceil((right - left) * scale) + 4,
      Math.ceil((bottom - top) * scale) + 4,
    );
  }

  const encoded = await encodeWithinLimit(output);
  const warnings = [];
  if (embeddedContentWasMasked) warnings.push("embedded_content_masked");
  if (crossOriginAssetWasOmitted) warnings.push("cross_origin_asset_omitted");
  if (encoded.reduced) warnings.push("size_reduced");

  return {
    blob: encoded.blob,
    metadata: {
      id,
      kind: "snapshot",
      source: "dom-renderer",
      quality: warnings.length ? "degraded" : "captured",
      mimeType: encoded.blob.type || "image/webp",
      byteSize: encoded.blob.size,
      pixelSize: {
        width: encoded.canvas.width,
        height: encoded.canvas.height,
      },
      redactionCount: redactions.length,
      warnings,
    },
  };
}

function validMarkupColor(value, windowRef) {
  const color = typeof value === "string" ? value.trim().slice(0, 64) : "";
  if (!color || color.toLowerCase() === "transparent") return null;
  if (typeof windowRef?.CSS?.supports === "function") {
    return windowRef.CSS.supports("color", color) ? color : null;
  }
  return /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([^)]{1,56}\)|[a-z]{1,32})$/i.test(color)
    ? color
    : null;
}

async function decodeSnapshotBlob(blob, documentRef, windowRef) {
  const createBitmap = windowRef?.createImageBitmap || globalThis.createImageBitmap;
  if (typeof createBitmap === "function") return createBitmap.call(windowRef, blob);

  const image = documentRef?.createElement?.("img");
  const urlApi = windowRef?.URL || globalThis.URL;
  if (!image || typeof urlApi?.createObjectURL !== "function") {
    throw new Error("The browser could not decode the snapshot for markup.");
  }

  const url = urlApi.createObjectURL(blob);
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The browser could not decode the snapshot for markup."));
      image.src = url;
    });
    return image;
  } catch (error) {
    urlApi.revokeObjectURL(url);
    throw error;
  }
}

export async function composeMarkupSnapshot({
  blob,
  metadata,
  strokes,
  documentRef = document,
  windowRef = window,
} = {}) {
  if (!blob || typeof blob !== "object") {
    throw new TypeError("Threadmark markup requires a snapshot Blob.");
  }

  const decoded = await decodeSnapshotBlob(blob, documentRef, windowRef);
  let decodedObjectUrl = null;
  if (decoded?.tagName?.toLowerCase?.() === "img") decodedObjectUrl = decoded.src;

  try {
    const width = Math.max(1, Math.round(
      finiteNumber(decoded?.width)
      ?? finiteNumber(decoded?.naturalWidth)
      ?? finiteNumber(metadata?.pixelSize?.width)
      ?? 1,
    ));
    const height = Math.max(1, Math.round(
      finiteNumber(decoded?.height)
      ?? finiteNumber(decoded?.naturalHeight)
      ?? finiteNumber(metadata?.pixelSize?.height)
      ?? 1,
    ));
    const canvas = documentRef?.createElement?.("canvas");
    if (!canvas) throw new Error("The browser could not create a markup canvas.");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext?.("2d", { alpha: false });
    if (!context) throw new Error("The browser could not create a markup canvas.");

    context.drawImage(decoded, 0, 0, width, height);

    for (const stroke of Array.isArray(strokes) ? strokes : []) {
      const points = simplifyMarkupPoints(stroke?.points, 0);
      const color = validMarkupColor(stroke?.color, windowRef);
      const requestedWidth = finiteNumber(stroke?.width);
      if (points.length < 2 || !color || requestedWidth == null || requestedWidth <= 0) continue;

      context.beginPath();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = color;
      context.lineWidth = Math.min(requestedWidth, 64);
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }

    const mimeType = SNAPSHOT_MIME_TYPES.has(blob.type)
      ? blob.type
      : SNAPSHOT_MIME_TYPES.has(metadata?.mimeType) ? metadata.mimeType : "image/webp";
    const encoded = await encodeWithinLimit(canvas, mimeType);
    const composedBlob = encoded.blob;
    const { strokes: _discardedStrokes, ...safeMetadata } = metadata && typeof metadata === "object"
      ? metadata
      : {};
    const warnings = Array.isArray(safeMetadata.warnings) ? [...safeMetadata.warnings] : [];
    if (encoded.reduced && !warnings.includes("size_reduced")) warnings.push("size_reduced");

    return {
      blob: composedBlob,
      metadata: {
        ...safeMetadata,
        kind: "snapshot",
        source: "dom-renderer",
        mimeType: composedBlob.type || mimeType,
        byteSize: composedBlob.size,
        pixelSize: { width: encoded.canvas.width, height: encoded.canvas.height },
        warnings,
      },
    };
  } finally {
    decoded?.close?.();
    if (decodedObjectUrl) {
      const urlApi = windowRef?.URL || globalThis.URL;
      urlApi?.revokeObjectURL?.(decodedObjectUrl);
    }
  }
}
