This project implements a BiDi WebDriver client from scratch. The client I built is quite simple. All it does is navigate to hackernews and take a screenshot. There's a good bit of logic behind it though.

I worked with some unfamiliar tech:

  * The WebDriver BiDi standard. This was established by W3C as a browser automation protocol. The spec is [quite long](https://w3c.github.io/webdriver-bidi/#cddl-type-browsingcontextimageformat) and can do way more than just taking screenshots
  * Javascript Promises. Promises are a low level primitive that enables async communication
  * NodeJS and the NodeJS debugger. I had heard a ton about NodeJS over the years but hadn't worked with it until today
  * Websockets. Websockets allow you to create persistent, long lived bi-directional connections between machines. Another technology I had heard a ton about but never used.


Braindump:

  * Debugging Node projects was weird, at least compared to python. I was hoping node had some debugging primitives like python:

    ```python
    print("hello, world!")
    breakpoint() # puts you straight in PDB
    ```

    The setup with Node is ever so slightly more complicated. Node _does_ have a `debugger` command.

    ```javascript
    console.log("hello, world!");
    debugger;
    ```

    But you have to run your javascript with a special `inspect` option

    ```bash
    node inspect main.js
    ```

    When you do, you'll land in a REPL

    ```bash
        paul-MS-7E16% node inspect test.js
        < Debugger listening on ws://127.0.0.1:9229/c3a19a05-d42d-462f-a74d-715fe03c5bfe
        < For help, see: https://nodejs.org/en/docs/inspector
        <
        connecting to 127.0.0.1:9229 ... ok
        < Debugger attached.
        <
        Break on start in test.js:1
        > 1 console.log("hello");
          2 debugger;
          3 console.log("goodbye");
    ```



  * Creating a websocket really was not too bad. The core piece is an initial HTTP POST requset which establishes the session and suggests to the driver client to switch over communication to websockets. The driver responds with a websocket URI the client can connect to for 'talking websocket'

  * Websocket is funky. Working with websockets gave me a really nice taste of what async programming is like in javascript. The really interesting thing here (and the meat of the problem) is the async communication that happens between the websockets. This works via event listeners, which listen for particular events to pass through the socket. The key ones are:

    * open
    * close
    * error
    * message

    The tricky thing about async is... everything is async! One early bug I ran into was: 

    ```javascript
    // this was before i modified the function to take in (scheme, host, port) instead
    async function createClient(webSocketUrl) {
        const ws = new WebSocket(webSocketUrl);

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

        return ws;
    }

    // create the client
    ws = createClient("ws://127.0.0.1:19156/12319a05-d42d-462f-a74d-715fe03c5bfe");
    ws.send("ping");
    ```

    on the surface, this looked right to me: we are creating a new web socket and adding event listeners, returning the newly created client, then sending some message to it. but it doesn't work! the reason why is because we never actually wait for the socket to formally open; we just establish listeners on everything and go on our merry way. the fix is:

    ```javascript
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
    ```

  * i hit another bit of trickiness setting up the client. in my initial implementation i was returning the raw websocket and sending messages to it directly. this is great for sending messages, but does not actually go through any work receiving them! the async part of this is tricky. what we want to is:

    ```javascript
    response = await client.send(payload)
    ```

    but this actually requires us to both send the message AND recieve the response back from the webdriver! fortunatley, the BiDi protocol enforces a unique `id` on every request, which it returns on every response. so it _is_ possible to associate responses with their corresponding requests. but how do we fit that into the response above? `ws.send` [doesn't even return anything](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send)...

    turns out the solution is promises. gpt-5.2 gave me this example to mull over:

    ```javascript
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
    
            function send(method, params = {}) {
                id += 1;
                const payload = { id, method, params }
                ws.send(JSON.stringify(payload));
                return new Promise((resolver) => pending.set(id, resolver))
            }
    
    
        // anon object - you can call '.send()' on the return value and it just works
    	return { send }
    }
    ```

    the bit that really surprised me is the 'send' method that we expose in the return value. this implements the behavior that we want: you can run `response = await ws.send(...)` and it'll do the right thing.

    the big mechanic here has to do with promise resolution. when you create a promise, you have to provide it with a instantiation function, which it calls immediately. the example on the MDN docs was pretty straightforward:

    ```javascript
    const promise1 = new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve("foo");
      }, 300);
    });
    ```

    this creates a promise that resolves in 300ms, returning 'foo'. our example is one leg up though - instead of resolving the promise in the constructor, we actually save a reference to the resolve function in our mapping! this is important - we create the promise in send(), but we actually have to wait until the event listener has a corresponding message on the reading end to get our result.

    speaking of the reading end: the logic here is pretty simple. whenever a message comes in from the driver, the message listener unpacks it to find the message id. it searches for said message id in the mapping and calls the relevant resolver function with the result. 


ok i ended up going a little farther and moving this to typescript. typescript is honestly really nice to use, it feels like python a little bit. i have a strong preference for type hints and i generally like the look of typescript way more than javascript.

the main extensions are pretty straightforward. similar to python, you can add types on arguments. so this:

```javascript
function add(a, b) { return a + b }
```

becomes this:

```typescript
function add(a: number, b: number): number {
    return a + b
}
```

the most difficult type i had to maneuver was `getClient(scheme: string, host: string, port: number): ???`
i started by asking chatgpt, which give me the right answer:

```typescript
async function getClient(scheme: string, host: string, port: number): Promise<{ send: (method: string, params?: any = {}) => Promise<any> }> {
}
```

* the thing that it returns is an object

    ```typescript
    {}
    ```

* that object has one function on it, 'send'

    ```typescript
    { send }

    ```
* that 'send' function takes in a method and an optional params. that params can be anything but defaults to {}

    ```typescript
    { send: (method: string, params?: any = {}) }

* send returns a promise. the promise will return a result. we will be lazy and just say 'any'

    ```typescript
    { send: (method: string, params?: any = {}) => Promise<any> }

* getClient is an async function, so it always returns a promise. the promise's type is what we just said above ^

    ```typescript
    Promise<{ send: (method: string, params?: any = {}) => Promise<any> }>
    ```

reading types does not "come naturally to me" - i had to sound this one out a couple times to really wrap my head around it

the way you import modules is a little different. i let chatgpt handle that for now. newer versions of node can run typescript
directly, so i was able to run `node client.ts` to run the client with no issues. the `node` repl is just pure javascript though.
apparently there _are_ typescript based REPLs, but the one i tried to use was broken. i didn't prod further.


