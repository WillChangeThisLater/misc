var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var ws = require('ws');
var fs = require('fs');
// get client returns an anon object with a send() method: 
// Promise<{ send(method: string, params: any) => Promise<any> }>
function getClient(scheme, host, port) {
    return __awaiter(this, void 0, void 0, function () {
        // we need to set up special send/recv handling
        // gpt-5.2 gave me this function. i stared at it for a while.
        // here is how it works:
        //
        //   1. A client calls client.send('browsingContext.getTree')
        //      That implicitly calls this function
        //   2. This function builds the appropriate request body and sends it
        //      to the listener. This request is 'sent into the void': we do
        //      not wait on it or anything
        //   3. We create a new Promise for the client. The Promise constructor
        //      expects a function (resolver, error). This function is called immedateily
        //      to 'build' the promise. In the MDN example, we see:
        //
        //      ```javascript
        //      const promise1 = new Promise((resolve, reject) => {
        //        setTimeout(() => {
        //          resolve("foo");
        //        }, 300);
        //      });
        //      ```
        //
        //      This is a level beyond that. Instead of waiting 300ms then resolving the
        //      promise, we just store a reference to the resolver function in the pending map
        //   4. At some point, the listener responds. We intercept that response in the 'message'
        //      event listener. This event listener reads the ID and matches it against the pending
        //      map. If a match is found, the listener calls the resolver function
        function send(method, params) {
            if (params === void 0) { params = {}; }
            id += 1;
            var payload = { id: id, method: method, params: params };
            ws.send(JSON.stringify(payload));
            return new Promise(function (resolver) { return pending.set(id, resolver); });
        }
        var pending, id, gecko_url, body, payload, response, json, webSocketUrl, socket;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pending = new Map();
                    id = 0;
                    gecko_url = "".concat(scheme, "://").concat(host, ":").concat(port, "/session");
                    body = { "capabilities": { "alwaysMatch": { "browserName": "firefox", "webSocketUrl": true } } };
                    payload = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
                    return [4 /*yield*/, fetch(gecko_url, payload)];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = _a.sent();
                    webSocketUrl = json.value.capabilities.webSocketUrl;
                    socket = new ws(webSocketUrl);
                    // wait for connection to be set up then add event listeners
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            socket.addEventListener("open", function (event) {
                                console.log("gecko connection established on ".concat(webSocketUrl));
                                resolve(socket); // Resolve the promise with the WebSocket instance
                            });
                            socket.addEventListener("error", function (event) {
                                console.error("WebSocket error: ".concat(event));
                                reject(new Error('WebSocket error occurred')); // Reject on error
                            });
                            socket.addEventListener("close", function (event) {
                                console.log("gecko connection closed on ".concat(webSocketUrl));
                                // You may want to handle websocket closure appropriately here
                            });
                            // debug logging for message send events from the web socker listener
                            socket.addEventListener("message", function (event) {
                                var msg = JSON.parse(event.data);
                                var pretty = JSON.stringify(msg);
                                console.log("message from ".concat(webSocketUrl, ":\n").concat(pretty));
                            });
                        })];
                case 3:
                    // wait for connection to be set up then add event listeners
                    _a.sent();
                    socket.addEventListener("message", function (event) {
                        var msg = JSON.parse(event.data);
                        if (msg.id != null) {
                            var resolve = pending.get(msg.id);
                            if (resolve) {
                                pending.delete(msg.id);
                                resolve(msg);
                            }
                        }
                    });
                    return [2 /*return*/, { send: send }];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var context, url, imgData, buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getClient("http", "localhost", 4444)];
                case 1:
                    client = _a.sent();
                    return [4 /*yield*/, client.send('browsingContext.getTree')];
                case 2:
                    // log out messages that are sent to use from listener
                    response = _a.sent();
                    context = response.result.contexts[0].context;
                    url = "https://news.ycombinator.com";
                    params = { "context": context, "url": url };
                    return [4 /*yield*/, client.send('browsingContext.navigate', params = params)];
                case 3:
                    response = _a.sent();
                    params = { "context": context, "format": { "type": "png" } };
                    return [4 /*yield*/, client.send('browsingContext.captureScreenshot', params = params)];
                case 4:
                    response = _a.sent();
                    imgData = response.result.data;
                    buffer = Buffer.from(imgData, 'base64');
                    fs.writeFile("/tmp/test.png", buffer, function (err) { if (err) {
                        console.log(err);
                    } });
                    return [2 /*return*/];
            }
        });
    });
}
main();
