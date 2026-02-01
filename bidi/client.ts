const ws = require('ws');
const fs = require('fs');


// get client returns an anon object with a send() method: 
// Promise<{ send(method: string, params: any) => Promise<any> }>
async function getClient(scheme: string, host: string, port: number): Promise<{ send: (method: string, params?: any) => Promise<any>}> {

        const pending = new Map();
        let id = 0;

	// send POST request to gecko driver
	// this establishes the websocket we will communicate over
	const gecko_url = `${scheme}://${host}:${port}/session`
	const body = {"capabilities": {"alwaysMatch": {"browserName": "firefox", "webSocketUrl": true}}}
	const payload = {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)}
	const response = await fetch(gecko_url, payload)

        if (!response.ok) {
            const errorBody = await response.json();
            console.error(`Error creating session: ${JSON.stringify(errorBody)}`);
            process.exit(1);
        }

	const json = await response.json()
	const webSocketUrl = json.value?.capabilities?.webSocketUrl

	const socket = new ws(webSocketUrl);

	// wait for connection to be set up then add event listeners
        await new Promise((resolve, reject) => {
            socket.addEventListener("open", event => {
                console.log(`gecko connection established on ${webSocketUrl}`);
                resolve(socket); // Resolve the promise with the WebSocket instance
            });
            socket.addEventListener("error", event => {
                console.error(`WebSocket error: ${event}`);
                reject(new Error('WebSocket error occurred')); // Reject on error
            });
            socket.addEventListener("close", event => {
                console.log(`gecko connection closed on ${webSocketUrl}`);
                // You may want to handle websocket closure appropriately here
            });
            // debug logging for message send events from the web socker listener
            socket.addEventListener("message", event => {
                const msg = JSON.parse(event.data);
                const pretty = JSON.stringify(msg);
                console.log(`message from ${webSocketUrl}:\n${pretty}`);
            });
        });

	socket.addEventListener("message", event => {
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
        function send(method: string, params: any = {}) {
            id += 1;
            const payload = { id, method, params }
            socket.send(JSON.stringify(payload));
            return new Promise((resolver) => pending.set(id, resolver))
        }


	return { send }
}

async function main() {
    const client = await getClient("http", "localhost", 4444);

    // log out messages that are sent to use from listener
    const get_tree_response = await client.send('browsingContext.getTree');
    const context = get_tree_response.result.contexts[0].context

    const url = "https://news.ycombinator.com"
    const params_1 = { "context": context, "url": url}
    // assume we made it (this is a bad assumption but i am lazy!)
    await client.send('browsingContext.navigate', params_1);

    const params_2 = { "context": context, "format": { "type": "png"}}
    const ss_response = await client.send('browsingContext.captureScreenshot', params_2);

    // write out the image
    const imgData = ss_response.result.data
    const buffer = Buffer.from(imgData, 'base64');
    fs.writeFile("/tmp/test.png", buffer, function(err) { if (err) {console.log(err)}});
}

main();
