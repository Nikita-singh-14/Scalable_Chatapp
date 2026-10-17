import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import * as IORedis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_USERNAME = process.env.REDIS_USERNAME;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const MESSAGE_STREAM = "CHAT_MESSAGES";
const MAX_STORED_MESSAGES = 10_000;

const redisOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    lazyConnect: true,
    tls: process.env.REDIS_TLS === "false" ? undefined : {},
};

const pub = (() => {
    try {
        return new IORedis.Redis(redisOptions as any);
    } catch (error) {
        console.warn("Redis publish client failed to initialize:", error instanceof Error ? error.message : "Unknown Redis error");
        return null;
    }
})();

const sub = (() => {
    try {
        return new IORedis.Redis(redisOptions as any);
    } catch (error) {
        console.warn("Redis subscribe client failed to initialize:", error instanceof Error ? error.message : "Unknown Redis error");
        return null;
    }
})();

export interface ChatMessage {
    id: string;
    username: string;
    message: string;
    sentAt: number;
}

export interface ChatMessagePage {
    messages: ChatMessage[];
    hasMore: boolean;
}

pub?.on("error", (error) => {
    console.warn("Redis publish client error:", error.message);
});

sub?.on("error", (error) => {
    console.warn("Redis subscribe client error:", error.message);
});

class SocketService {
    private _io: Server;
    private readonly jwtSecret: string;

    constructor(jwtSecret: string) {
        console.log("Init Socket Service...");
        this.jwtSecret = jwtSecret;
        this._io = new Server({
            cors: {
                allowedHeaders: ["*"],
                origin: "*",
            },
        });

        if (sub) {
            sub.subscribe("MESSAGES").catch((error) => {
                console.warn("Redis subscription failed:", error instanceof Error ? error.message : "Unknown Redis error");
            });
        } else {
            console.warn("Redis is disabled. Real-time message broadcasting will not work until Redis is configured.");
        }
    }

    public async getRecentMessages(limit: number, before?: string): Promise<ChatMessagePage> {
        if (!pub) {
            throw new Error("Redis is not configured.");
        }

        const entries = before
            ? await pub.xrevrange(MESSAGE_STREAM, `(${before}`, "-", "COUNT", limit + 1)
            : await pub.xrevrange(MESSAGE_STREAM, "+", "-", "COUNT", limit + 1);
        const hasMore = entries.length > limit;
        const messages = entries
            .slice(0, limit)
            .reverse()
            .map(([id, fields]) => {
                const values = new Map<string, string>();
                for (let index = 0; index < fields.length; index += 2) {
                    const key = fields[index];
                    const value = fields[index + 1];
                    if (key !== undefined && value !== undefined) {
                        values.set(key, value);
                    }
                }

                return {
                    id,
                    username: values.get("username") ?? "Unknown sender",
                    message: values.get("message") ?? "",
                    sentAt: Number(values.get("sentAt")),
                };
            })
            .filter((message) =>
                message.message.length > 0 &&
                Number.isFinite(message.sentAt)
            );

        return { messages, hasMore };
    }

    public initListener() {
        const io = this.io;
        console.log("Init Socket Listeners...");

        io.use((socket, next) => {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error("Authentication token is required."));
            }

            try {
                const decoded = jwt.verify(token, this.jwtSecret) as { username: string };
                socket.data.user = decoded.username;
                return next();
            } catch {
                return next(new Error("Invalid or expired token."));
            }
        });

        io.on("connect", (socket) => {
            console.log(`New Socket Connected`, socket.id, "user:", socket.data.user);

            socket.on("event:message", async (payload: { message?: unknown } | null) => {
                const message = payload?.message;
                if (typeof message !== "string" || !message.trim()) {
                    return;
                }

                if (!pub) {
                    socket.emit("message:error", "Chat history is unavailable because Redis is not configured.");
                    return;
                }

                const sentAt = Date.now();
                let id: string;
                try {
                    const messageId = await pub.xadd(
                        MESSAGE_STREAM,
                        "MAXLEN",
                        String(MAX_STORED_MESSAGES),
                        "*",
                        "username",
                        socket.data.user,
                        "message",
                        message.trim(),
                        "sentAt",
                        String(sentAt)
                    );
                    if (!messageId) {
                        throw new Error("Redis did not return a message ID.");
                    }
                    id = messageId;
                } catch (error) {
                    console.warn("Redis message persistence failed:", error instanceof Error ? error.message : "Unknown Redis error");
                    socket.emit("message:error", "Your message could not be saved. Please try again.");
                    return;
                }

                const chatMessage: ChatMessage = {
                    id,
                    username: socket.data.user,
                    message: message.trim(),
                    sentAt,
                };
                try {
                    await pub.publish("MESSAGES", JSON.stringify(chatMessage));
                    console.log("New Message Rec.", id, "user:", socket.data.user);
                } catch (error) {
                    console.warn("Redis message publish failed:", error instanceof Error ? error.message : "Unknown Redis error");
                    io.emit("message", JSON.stringify(chatMessage));
                    socket.emit("message:error", "Your message was saved, but live delivery may be delayed.");
                }
            });
        });

        if (sub) {
            sub.on("message", (channel: string, message: string) => {
                if (channel === "MESSAGES") {
                    console.log("new message from redis", message);
                    io.emit("message", message);
                }
            });
        }
    }

    get io() {
        return this._io;
    }
}

export default SocketService;