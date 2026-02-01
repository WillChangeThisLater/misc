const WebSocket = require('ws');
const fs = require('fs');


async function getClient(scheme, host, port) {

        const pending = new Map();
        let id = 0;

	// send POST request to gecko driver
	// this establishes the websocket we will communicate over
	gecko_url = `${scheme}://${host}:${port}/session`
	const body = {"capabilities": {"alwaysMatch": {"browserName": "firefox", "webSocketUrl": true}}}
	const payload = {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)}
	const response = await fetch(gecko_url, payload)
	const json = await response.json()
	const webSocketUrl = json.value.capabilities.webSocketUrl

	const ws = new WebSocket(webSocketUrl);

	// wait for connection to be set up then add event listeners
        await new Promise((resolve, reject) => {
            ws.addEventListener("open", event => {
                console.log(`gecko connection established on ${webSocketUrl}`);
                resolve(ws); // Resolve the promise with the WebSocket instance
            });
            ws.addEventListener("error", event => {
                console.error(`WebSocket error: ${event}`);
                reject(new Error('WebSocket error occurred')); // Reject on error
            });
            ws.addEventListener("close", event => {
                console.log(`gecko connection closed on ${webSocketUrl}`);
                // You may want to handle websocket closure appropriately here
            });
            // debug logging for message send events from the web socker listener
            ws.addEventListener("message", event => {
                const msg = JSON.parse(event.data);
                const pretty = JSON.stringify(msg);
                console.log(`message from ${webSocketUrl}:\n${pretty}`);
            });
        });

	ws.addEventListener("message", event => {
            const msg = JSON.parse(event.data)
            if (msg.id != null) {
                const resolve = pending.get(msg.id)
                if (resolve) {
                    pending.delete(msg.id)
                    resolve(msg)
                }
            }
        });

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
        function send(method, params = {}) {
            id += 1;
            const payload = { id, method, params }
            ws.send(JSON.stringify(payload));
            return new Promise((resolver) => pending.set(id, resolver))
        }


	return { send }
}

async function main() {
    client = await getClient("http", "localhost", 4444);

    // log out messages that are sent to use from listener
    response = await client.send('browsingContext.getTree');
    const context = response.result.contexts[0].context

    const url = "https://news.ycombinator.com"
    params = { "context": context, "url": url}
    response = await client.send('browsingContext.navigate', params = params);

    params = { "context": context, "format": { "type": "png"}}
    response = await client.send('browsingContext.captureScreenshot', params = params);

    // write out the image
    const imgData = response.result.data
    const buffer = Buffer.from(imgData, 'base64');
    fs.writeFile("/tmp/test.png", buffer, function(err) { if (err) {console.log(err)}});

}

main();
