// inject the page script
const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected.js");
document.getElementsByTagName("body")[0].appendChild(script);
