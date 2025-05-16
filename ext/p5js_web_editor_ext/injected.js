const WS_URL = "ws://localhost:8080";
let ws = new WebSocket(WS_URL);

(function waitForCodeMirror() {
  const check = () => {
    const cmEl = document.querySelector(".CodeMirror");
    if (cmEl && cmEl.CodeMirror) {
      hookSaveEvents(cmEl.CodeMirror);
    } else {
      setTimeout(check, 1000);
    }
  };
  check();
})();

function hookSaveEvents(cm) {
  console.log("[content.js] Hooking into save events");

  cm.addKeyMap({
    "Ctrl-S": () => sendCode(cm),
    "Cmd-S": () => sendCode(cm)
  });

  const saveButton = Array.from(document.querySelectorAll('button[role="menuitem"]'))
    .find(btn => btn.textContent.trim().startsWith('保存'));
  if (saveButton) {
    saveButton.addEventListener("click", () => sendCode(cm));
  }
}

function sendCode(cm) {
  const code = cm.getValue();
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "p5.js", nowProgram: code }));
    console.log("[content.js] Code sent to WebSocket.");
  } else {
    console.warn("[content.js] WebSocket not open. Reconnecting...");
    ws = new WebSocket(WS_URL);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "p5.js", nowProgram: code }));
      console.log("[content.js] Code sent after reconnect.");
    });
  }
}
