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

        window.fetch = async function () {
            let request, url;

            if (arguments[0] instanceof Request) {
                request = arguments[0];
                url = request.url;
            } else {
                request = arguments[1];
                url = arguments[0];
            }

            let request_text = "";
            if (request instanceof Request) {
                try {
                    const request_clone = request.clone();
                    request_text = await request_clone.text();
                } catch (e) {
                    request_text = "";
                }
            }

            const response = await _fetch.apply(window, arguments);
            const response_clone = response.clone();
            const response_text = await response_clone.text();

            const message = {
                name: "fetch_response_captured",
                data: {
                    status: response_clone.status,
                    response_text,
                    response_url: url,
                    request_url: url,
                    request_text,
                    response_headers: {},
                    response_body: {}
                }
            };

            if (arguments[1] && arguments[1].headers) {
                if (arguments[1].headers instanceof Headers) {
                    message.data.response_headers = {};
                    for (const pair of arguments[1].headers.entries()) {
                        message.data.response_headers[pair[0]] = pair[1];
                    }
                } else {
                    message.data.response_headers = arguments[1].headers;
                }
            }

            if (arguments[1] && arguments[1].body) {
                message.data.response_body = arguments[1].body;
            }

            sendLog("fetch", message);
            return response;
        };
    }

    override_fetch(window);
    override_xhr(window);
})();
