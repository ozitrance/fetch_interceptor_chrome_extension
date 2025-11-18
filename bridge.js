
const script = document.createElement("script");
script.src = chrome.runtime.getURL("page_inject.js");
script.async = false;
(document.documentElement || document.head).appendChild(script);
script.remove();

// Listen for messages from page_inject.js and forward them to background.js
window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.type !== "XHR_FETCH_LOG") return;

    // Forward to the extension background
    chrome.runtime.sendMessage(msg);
});
