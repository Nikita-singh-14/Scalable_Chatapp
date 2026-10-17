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

    socketService.io.attach(httpServer);
    socketService.initListener();

    httpServer.listen(PORT, () => {
        console.log(`HTTP Server started at PORT:${PORT}`);
    });
}

init();