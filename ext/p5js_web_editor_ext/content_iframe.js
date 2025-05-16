
// inject the page script
/*console.log("[content_iframe.js] Injecting injected_iframe.js into the page");

const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected_iframe.js");
(document.head || document.documentElement).appendChild(script);*/

const WS_URL = "ws://localhost:8080";
let ws = new WebSocket(WS_URL);

function sendCanvasCapture() {
  let canvas = window.document.body.querySelector('iframe').contentDocument.body.querySelector('canvas');

  if (!canvas) {
    return;
  }
  canvas.toBlob(blob => {
    if (!blob) {
      console.warn("[content.js] Failed to capture canvas.");
      return;
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "p5.js canvas" }));
      ws.send(blob);
      console.log("[content.js] Canvas capture (blob) sent.");
    }
  }, 'image/png');
}

setInterval(sendCanvasCapture, 2000);


