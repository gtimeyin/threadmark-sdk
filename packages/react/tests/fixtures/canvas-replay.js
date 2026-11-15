// Records a page with canvases through the real recorder, then plays the capture back with rrweb's
// Replayer and Threadmark's canvas painter, so a test can read the replayed canvases' pixels.
import { Replayer } from "rrweb";
import { createCanvasPainter } from "../../src/canvasReplay.js";
import { decodeReplayEvents, startSessionReplay } from "../../src/sessionReplay.js";

window.startCanvasReplay = async (canvas) => {
  window.__session = await startSessionReplay({ canvas });
};

window.captureCanvasReplay = async () => {
  const capture = await window.__session.capture();
  window.__session.stop();
  return decodeReplayEvents(capture.blob);
};

window.playCanvasReplay = async (events) => {
  const root = document.createElement("div");
  document.body.append(root);
  const replayer = new Replayer(events, { root, UNSAFE_replayCanvas: false, showWarning: false });
  const painter = createCanvasPainter(events);
  replayer.on("fullsnapshot-rebuilded", () => painter.reset());
  const end = events.at(-1).timestamp - events[0].timestamp;
  replayer.pause(end);
  for (let index = 0; index < 20; index += 1) {
    painter.paint(replayer);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const doc = root.querySelector("iframe").contentDocument;
  const pixel = (id) => {
    const node = doc.getElementById(id);
    if (!node) return null;
    const probe = document.createElement("canvas");
    probe.width = node.width;
    probe.height = node.height;
    probe.getContext("2d").drawImage(node, 0, 0);
    return Array.from(probe.getContext("2d").getImageData(Math.floor(node.width / 2), Math.floor(node.height / 2), 1, 1).data);
  };
  return {
    scripts: root.querySelector("iframe").getAttribute("sandbox"),
    chart: pixel("chart"),
    privateChart: pixel("private-chart"),
    privateTag: doc.getElementById("private-chart")?.tagName ?? null,
  };
};
