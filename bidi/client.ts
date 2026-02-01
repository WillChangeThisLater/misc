import WebSocket from 'ws'; // make sure to import WebSocket if you're using npm
import * as fs from 'fs'

class BiDiClient {

    pending = new Map();
    id: number = 0;
    socket: WebSocket;

    public constructor(socket: WebSocket) {

        this.socket = socket

        // add an event listener on the socket
        // big assumption here is that the socket is open for business
        // bad things can happen if not
	this.socket.addEventListener("message", event => {
            const msg = JSON.parse(event.data)
            if (msg.id != null) {
                const resolve = this.pending.get(msg.id)
                if (resolve) {
                    this.pending.delete(msg.id)
                    resolve(msg)
                }
            }
        });
    }


    public send(method: string, params: any = {}): Promise<any> {
        this.id += 1;
        const id = this.id
        const payload = { id, method, params }
        this.socket.send(JSON.stringify(payload));
        return new Promise((resolver) => this.pending.set(this.id, resolver))
    }
}


// get client returns an anon object with a send() method: 
// Promise<{ send(method: string, params: any) => Promise<any> }>
async function getBiDiClient(scheme: string, host: string, port: number): Promise<BiDiClient> {

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

	const socket = new WebSocket(webSocketUrl);

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

	return new BiDiClient(socket);
}

async function main() {
    const client = await getBiDiClient("http", "localhost", 4444);

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
