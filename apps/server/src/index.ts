import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import http from "http";
import jwt from "jsonwebtoken";
import SocketService from "./services/socket.js";

const JWT_SECRET = process.env.JWT_SECRET || "scalable-chat-secret";

async function init() {
    const app = express();
    const socketService = new SocketService(JWT_SECRET);
    const httpServer = http.createServer(app);
    const PORT = Number(process.env.PORT || process.env.API_PORT || 8000);

    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error("API_PORT must be a valid port number between 1 and 65535.");
    }

    app.use(cors());
    app.use(express.json());

    app.get("/api/health", (_req, res) => {
        res.json({ ok: true, message: "Chat server is healthy" });
    });

    app.post("/api/auth/login", (req, res) => {
        const { username, password } = req.body ?? {};

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required." });
        }

        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

        return res.json({
            token,
            user: {
                username,
            },
        });
    });

    app.get("/api/messages", async (req, res) => {
        const authorization = req.header("authorization");
        const token = authorization?.startsWith("Bearer ")
            ? authorization.slice("Bearer ".length)
            : "";

        if (!token) {
            return res.status(401).json({ message: "Authentication is required." });
        }

        let username: string;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (typeof decoded === "string" || typeof decoded.username !== "string") {
                return res.status(401).json({ message: "Invalid authentication token." });
            }
            username = decoded.username;
        } catch {
            return res.status(401).json({ message: "Invalid or expired authentication token." });
        }

        const requestedLimit = req.query.limit;
        const limit = requestedLimit === undefined ? 50 : Number(requestedLimit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({ message: "The message limit must be between 1 and 100." });
        }

        const before = req.query.before;
        if (before !== undefined && (typeof before !== "string" || !/^\d+-\d+$/.test(before))) {
            return res.status(400).json({ message: "The message cursor is invalid." });
        }

        try {
            const page = await socketService.getRecentMessages(limit, before);
            return res.json(page);
        } catch (error) {
            console.warn(`Message history request failed for ${username}:`, error instanceof Error ? error.message : "Unknown Redis error");
            return res.status(503).json({ message: "Message history is temporarily unavailable." });
        }
    });

    socketService.io.attach(httpServer);
    socketService.initListener();

    httpServer.listen(PORT, () => {
        console.log(`HTTP Server started at PORT:${PORT}`);
    });
}

init();