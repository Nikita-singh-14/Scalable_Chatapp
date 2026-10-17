# Scalable Chat App with Redis Pub/Sub

This project is a small real-time chat application built to help you understand how Redis pub/sub works in a real application.

The app uses:

- Next.js for the frontend
- Socket.IO for real-time client-server communication
- Redis Pub/Sub to broadcast messages between server instances or processes
- TypeScript for clean code
- Turborepo monorepo structure for splitting frontend and backend code

This repo is intentionally simple, so you can focus on the core pattern instead of a large production system.

## What this project demonstrates

The main learning goal is this flow:

1. A user sends a message from the browser
2. The frontend emits a Socket.IO event
3. The server receives that message
4. The server publishes the message to a Redis channel
5. Redis fans it out to all subscribers on that channel
6. Every connected server instance receives the message
7. The server broadcasts it back to connected clients

This is the same idea behind many real-time systems such as:

- chat apps
- live dashboards
- notifications
- event-driven microservices

## Architecture

```text
Browser Client 1            Browser Client 2
      |                           |
      |-- Socket.IO message ---->|
      |                           |
      v                           v
        Web app (Next.js)
             |
             | send via Socket.IO
             v
        Node.js server
             |
             | publish to Redis channel: MESSAGES
             v
        Redis Pub/Sub
             |
             | subscriber receives event
             v
        Node.js server
             |
             | emit to connected browser clients
             v
        Browser Client 1 / Client 2
```

## Important concept: Redis Pub/Sub

Redis Pub/Sub is a messaging pattern where:

- publishers send messages to a channel
- subscribers listen to that channel
- Redis immediately delivers the message to all subscribers

It is not persistent storage like a queue.

That means:

- if no subscriber is listening, the message is lost
- it is optimized for real-time broadcasting, not durable jobs

In this project, the channel name is:

```text
MESSAGES
```

The flow is:

```ts
await pub.publish("MESSAGES", JSON.stringify({ message }));
```

Then on the subscriber side:

```ts
sub.on("message", (channel, message) => {
  if (channel === "MESSAGES") {
    io.emit("message", message);
  }
});
```

This means the server publishes a message to Redis, and every active subscriber on that channel receives it.

## Project structure

```text
scalable-Chatapp/
├── apps/
│   ├── web/               # Next.js frontend
│   │   ├── app/
│   │   └── context/
│   └── server/            # Node.js + Socket.IO + Redis server
│       └── src/
├── packages/
│   ├── ui/
│   ├── eslint-config/
│   └── typescript-config/
├── package.json
├── turbo.json
├── README.md
└── .gitignore
```

## How the real-time chat works

### 1. Frontend: sending a message

In the web app, the client uses Socket.IO:

```ts
socket.emit("event:message", { message: msg });
```

This sends the message to the backend server.

### 2. Server: receive the message

The server listens for the event:

```ts
socket.on("event:message", async ({ message }) => {
  await pub.publish("MESSAGES", JSON.stringify({ message }));
});
```

The message is serialized as JSON and sent to Redis.

### 3. Redis: broadcast to subscribers

Redis receives the event on the `MESSAGES` channel and delivers it to all subscribers.

### 4. Server: fan out to all connected clients

The subscriber listens and then does:

```ts
io.emit("message", message);
```

This sends the message to every connected browser tab or client.

## Why not just use Socket.IO alone?

You can build a chat app using only Socket.IO, but Redis Pub/Sub becomes useful when:

- you have multiple server instances
- you need cross-instance communication
- you want to scale horizontally
- you want a lightweight event bus for real-time events

In other words, Socket.IO handles browser connections, while Redis Pub/Sub helps servers communicate with each other.

## Prerequisites

Before running this app, make sure you have:

- Node.js 18 or newer
- Yarn (this repo is configured for Yarn workspaces)
- A Redis instance available
- Basic familiarity with terminal commands

## Installation

From the project root:

```bash
yarn install
```

## Environment variables

Keep the HTTP server port and Redis port separate. The browser connects to the HTTP server; the server connects to Redis.

Create `apps/server/.env` for the backend:

```bash
API_PORT=8000
JWT_SECRET=replace-with-a-long-random-secret
REDIS_HOST=your-redis-host
REDIS_PORT=6380
REDIS_USERNAME=your-redis-username
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
```

Use the Redis endpoint's host, port, username, and password from your Redis provider. For a local Redis instance, use `REDIS_HOST=localhost`, `REDIS_PORT=6379`, omit `REDIS_USERNAME` and `REDIS_PASSWORD` if local Redis requires no authentication, and set `REDIS_TLS=false`.

Use the `REDIS_`-prefixed names exactly as shown. Generic environment names such as `USERNAME` can already be set by Windows and may override values in `.env`.

If the frontend and backend are not both running on localhost, set `NEXT_PUBLIC_API_URL` for the web app to the backend's base URL, for example `http://localhost:8000`. The browser uses this URL for both login requests and its Socket.IO connection. Restart the Next.js dev server after changing it.

The demo login endpoint currently accepts any non-empty username and password; it does not validate users against a database.

## Run the app

Start the server in one terminal:

```bash
yarn workspace server dev
```

Start the web app in a second terminal:

```bash
yarn workspace web dev
```

Confirm the backend is running by opening `http://localhost:8000/api/health`, then open the web app:

```text
http://localhost:3000
```

## Deploy to Vercel and Render

Deploy the `apps/web` Next.js app to Vercel and the `apps/server` Socket.IO server to Render. Both services should use the same external Redis instance so messages can be broadcast between server instances.

### Deploy the backend to Render

1. Create a **Web Service** in Render and connect this repository.
2. Set the **Root Directory** to the repository root (leave it blank if Render treats the repository root as the default).
3. Choose **Node** and set:
   - **Build Command:** `yarn install --frozen-lockfile && yarn workspace server build`
   - **Start Command:** `yarn workspace server start`
4. Add these environment variables in Render. Use the values from your Redis provider; do not commit credentials:
   - `JWT_SECRET`: a long, random secret
   - `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`: your Redis connection details
   - `REDIS_TLS`: `true` for TLS-enabled managed Redis
   - `NODE_VERSION`: `22`
5. Set the Render health check path to `/api/health`, deploy, and copy the service's public HTTPS URL (for example, `https://your-service.onrender.com`).

The server listens on Render's assigned `PORT` automatically. Do not set `PORT` to the Redis port.

### Deploy the frontend to Vercel

1. Import this repository in Vercel and select `apps/web` as the **Root Directory**. Keep the detected Next.js framework and default build settings.
2. Set the Node.js version to `22` in the project settings.
3. Add the environment variable `NEXT_PUBLIC_API_URL` with the Render service URL, without a trailing slash (for example, `https://your-service.onrender.com`).
4. Deploy or redeploy the frontend after setting the variable; `NEXT_PUBLIC_API_URL` is included in the client-side build.
5. Open the Vercel site, log in, and confirm Socket.IO connects. Check `https://your-service.onrender.com/api/health` if the backend does not respond.

Use the Render URL for `NEXT_PUBLIC_API_URL`, not `localhost`. Keep the Render service running while testing; on plans that spin down while idle, the first connection may take time while it starts.

## Learn by tracing one message

Try this simple exercise:

1. Open the app in two browser tabs
2. Send a message from tab 1
3. Watch the message appear in tab 2
4. Trace the flow:
   - browser -> Socket.IO
   - server -> Redis publish
   - Redis -> server subscriber
   - server -> browser

This is the exact pattern used in many real-time chat and notification systems.

## Real-world notes

This project is a teaching example, not a complete production chat service. A production app would usually also need:

- user authentication
- room-based chat channels
- message persistence in a database
- message history loading
- rate limiting and spam protection
- Redis Streams or database storage for durable messages
- proper error handling and reconnect logic

## Common Redis Pub/Sub ideas to learn

- Channel = topic or event stream
- Publisher = sender of data
- Subscriber = listener for updates
- Broadcast = Redis sends to all subscribers
- Decoupled architecture = producers and consumers do not need to know each other directly

## Useful learning links

- Redis Pub/Sub docs: https://redis.io/docs/latest/develop/use/pubsub/
- Socket.IO docs: https://socket.io/docs/v4/
- Next.js docs: https://nextjs.org/docs

## Summary

This project is a beginner-friendly example of how real-time communication can be built using:

- Socket.IO for browser communication
- Redis Pub/Sub for event broadcasting
- Node.js for the backend
- Next.js for the frontend

If you understand this project, you already understand the key idea behind many modern real-time apps.

## Next step ideas

Once you are comfortable, you can extend this app with:

- private rooms
- chat history storage
- typing indicators
- online user lists
- Redis Streams for durable message processing
- multiple microservice producers/consumers

If you want, I can also help you write:

- a beginner-friendly explanation of each file in this repo
- a step-by-step Redis Pub/Sub flow diagram
- a version of this app with local Redis setup for easier learning
