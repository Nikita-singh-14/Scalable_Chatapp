import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import * as IORedis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_USERNAME = process.env.REDIS_USERNAME;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

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

            socket.on("event:message", async ({ message }: { message: string }) => {
                if (!message || !String(message).trim()) {
                    return;
                }

                console.log("New Message Rec.", message);

                if (pub) {
                    try {
                        await pub.publish("MESSAGES", JSON.stringify({ message }));
                    } catch (error) {
                        console.warn("Redis message publish failed:", error instanceof Error ? error.message : "Unknown Redis error");
                    }
                } else {
                    io.emit("message", JSON.stringify({ message }));
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