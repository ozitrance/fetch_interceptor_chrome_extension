const INTERCEPTOR_URL = "http://localhost:42777/log"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "XHR_FETCH_LOG") {
        const tabUrl = sender.tab?.url || null;
        const payload = {
            tabUrl,
            source: message.source,
            ...message.payload
        };
        console.log(payload)
        fetch(INTERCEPTOR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch((err) => {
            console.error("Failed to send to local logger:", err);
        });
    }
});
