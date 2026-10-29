import { captureRegionSnapshot } from '../../src/snapshot.js';
import { captureRegionSnapshot as capturePrevious } from 'beta12-snapshot';

window.captureBenchmark = async (previous, region) => {
  const canvases = [], create = document.createElement.bind(document);
  document.createElement = function (name, ...args) {
    const element = create(name, ...args);
    if (String(name).toLowerCase() === 'canvas') canvases.push(element);
    return element;
  };
  const start = performance.now();
  let result;
  try { result = await (previous ? capturePrevious : captureRegionSnapshot)({ id: 'benchmark', region }); }
  finally { document.createElement = create; }
  const duration = performance.now() - start;
  const bitmap = await createImageBitmap(result.blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
  const pixels = [...ctx.getImageData(0, 0, bitmap.width, bitmap.height).data];
  bitmap.close();
  return { duration, width: canvas.width, height: canvas.height, pixels, metadata: result.metadata,
    maxCanvasPixels: Math.max(...canvases.map(item => item.width * item.height)),
    canvasPixels: canvases.reduce((sum, item) => sum + item.width * item.height, 0) };
};
