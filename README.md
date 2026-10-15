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

The server expects Redis connection values in environment variables such as:

```bash
HOST=your-redis-host
PORT=6380
USERNAME=your-username
PASSWORD=your-password
```

If you are using a local Redis instance, you may need to adjust the connection setup for non-TLS mode. In this project, the Redis connection is currently configured with `tls: {}` in the server code, which is typical for managed Redis services.

## Run the app

Start the server:

```bash
cd apps/server
yarn dev
```

Start the web app:

```bash
cd apps/web
yarn dev
```

Then open:

```text
http://localhost:3000
```

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
