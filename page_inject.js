// page_inject.js

(function () {
  function sendLog(source, message) {
    window.postMessage(
      {
        type: "XHR_FETCH_LOG",
        source,
        payload: message
      },
      "*"
    );
  }

  function override_xhr(window) {
        const _open = window.XMLHttpRequest.prototype.open;
        const _setRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;

        window.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
            if (!this["chromane_request_headers"]) {
                this["chromane_request_headers"] = {};
            }
            this["chromane_request_headers"][name] = value;
            return _setRequestHeader.apply(this, arguments);
        };

        window.XMLHttpRequest.prototype.open = function (_method, request_url) {
            this.addEventListener("load", (_event) => {
                // text / default responses
                if (
                    (this.readyState === 4 && this.status === 200 && this.responseType === "text")
                    || this.responseType === ""
                ) {
                const message = {
                    name: "xhr_response_captured",
                    data: {
                    status: this.status,
                    response_text: this.responseText,
                    request_url: request_url,
                    response_url: this.responseURL,
                    request_headers: this["chromane_request_headers"]
                    }
                };
                sendLog("xhr", message);
            }

            // blob responses
            if (this.responseType === "blob") {
            const blob = this.response;
            const reader = new FileReader();

            reader.onload = (event) => {
                const response = event.target && event.target.result;
                const message = {
                name: "xhr_response_captured",
                data: {
                    status: this.status,
                    response_text: response,
                    request_url: request_url,
                    response_url: this.responseURL,
                    request_headers: this["chromane_request_headers"]
                }
                };
                sendLog("xhr", message);
            };

            reader.readAsText(blob);
            }
        });

        return _open.apply(this, arguments);
        };
    }

function override_fetch(window) {
    const _fetch = window.fetch;

    window.fetch = async function (input, init) {
        let request = null;
        let url = null;

        // Normalize input + URL
        if (input instanceof Request) {
            request = input;
            url = input.url; // this is already a string
        } else {
            url = input;
        }

        // Ensure URL is a string (avoid passing URL objects to postMessage)
        if (url instanceof URL) {
            url = url.toString();
        } else if (typeof url !== "string") {
            url = String(url);
        }

        // Try to get request body as text for logging
        let request_text = "";
        try {
            if (request instanceof Request) {
                const request_clone = request.clone();
                request_text = await request_clone.text();
            } else if (init && init.body != null) {
                const body = init.body;
                if (typeof body === "string") {
                    request_text = body;
                } else if (body instanceof URLSearchParams) {
                    request_text = body.toString();
                } else if (body instanceof FormData) {
                    const formEntries = [];
                    for (const [key, value] of body.entries()) {
                        formEntries.push([key, value instanceof File ? value.name : String(value)]);
                    }
                request_text = JSON.stringify(formEntries);
                } else {
                    // fallback – try JSON stringify, but don't crash if it fails
                    try {
                        request_text = JSON.stringify(body);
                    } catch {
                        request_text = "";
                    }
                }
            }
        } catch (e) {
            request_text = "";
        }

        // Perform the real fetch
        const response = await _fetch.call(window, input, init);
        const response_clone = response.clone();

        let response_text = "";
        try {
            response_text = await response_clone.text();
        } catch (e) {
            response_text = "";
        }

        // Normalize headers to a plain object
        const response_headers = {};
        try {
            response_clone.headers.forEach((value, key) => {
                response_headers[key] = value;
            });
        } catch (e) {
        // ignore header errors, keep empty object
        }

        const message = {
            name: "fetch_response_captured",
            data: {
                status: response_clone.status,
                response_text,
                response_url: response_clone.url || url,
                request_url: url,
                request_text,
                response_headers
                // no raw body or non-cloneable objects here
            }
        };

        // This should now be fully structured-cloneable
        sendLog("fetch", message);

        return response;
    };
}

    override_fetch(window);
    override_xhr(window);
})();
