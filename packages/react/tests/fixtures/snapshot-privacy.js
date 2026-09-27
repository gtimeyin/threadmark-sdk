import { captureRegionSnapshot } from "../../src/snapshot.js";
import snapshotFont from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff2?inline";

const fontStyle = document.createElement("style");
fontStyle.textContent = `@font-face { font-family: "Snapshot Brand"; src: url("${snapshotFont}") format("woff2"); font-weight: 600; }`;
document.head.appendChild(fontStyle);

const nativeFetch = window.fetch.bind(window);
window.__threadmarkFetches = [];
window.fetch = (...args) => {
  window.__threadmarkFetches.push(String(args[0]));
  return nativeFetch(...args);
};

const canvas = document.querySelector("#painted");
const canvasContext = canvas.getContext("2d");
canvasContext.fillStyle = "rgb(153, 51, 255)";
canvasContext.fillRect(0, 0, canvas.width, canvas.height);

const shadowRoot = document.querySelector("#shadow-host").attachShadow({ mode: "open" });
shadowRoot.innerHTML = `
  <style>:host { display: block; } div { width: 100px; height: 40px; background: rgb(255, 64, 64); }</style>
  <div data-threadmark-sensitive>PRIVATE SHADOW TEXT</div>
`;

function pixelAt(context, x, y) {
  return [...context.getImageData(x, y, 1, 1).data];
}

window.runPrivacyCapture = async () => {
  const result = await captureRegionSnapshot({
    id: "privacy-fixture",
    region: { left: 0, top: 0, width: 500, height: 240 },
    ignoredSelectors: [".consumer-secret"],
  });
  const bitmap = await createImageBitmap(result.blob);
  const output = document.createElement("canvas");
  output.width = bitmap.width;
  output.height = bitmap.height;
  const context = output.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0);

  const scaleX = bitmap.width / 500;
  const scaleY = bitmap.height / 240;
  const sample = (x, y) => pixelAt(context, Math.round(x * scaleX), Math.round(y * scaleY));
  const response = {
    metadata: result.metadata,
    fetches: [...window.__threadmarkFetches],
    pixels: {
      public: sample(70, 40),
      input: sample(70, 100),
      sensitive: sample(190, 100),
      ignored: sample(310, 100),
      iframe: sample(70, 160),
      canvas: sample(190, 160),
      shadow: sample(310, 160),
      crossOrigin: sample(430, 100),
    },
  };
  bitmap.close();
  return response;
};

window.runOffsetCapture = async () => {
  window.scrollTo(0, 620);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const target = document.querySelector("#offset-target");
  const rect = target.getBoundingClientRect();
  const result = await captureRegionSnapshot({
    id: "offset-fixture",
    region: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
  });
  const bitmap = await createImageBitmap(result.blob);
  const output = document.createElement("canvas");
  output.width = bitmap.width;
  output.height = bitmap.height;
  const context = output.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0);
  const pixel = pixelAt(context, Math.round(bitmap.width / 2), Math.round(bitmap.height / 2));
  bitmap.close();
  return { pixel, rect, scrollY: window.scrollY };
};

window.runFontCapture = async () => {
  await document.fonts.load('600 48px "Snapshot Brand"');
  const rect = document.querySelector("#font-sample").getBoundingClientRect();
  const result = await captureRegionSnapshot({
    id: "font-fixture",
    region: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
  });
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(result.blob);
  });
};
