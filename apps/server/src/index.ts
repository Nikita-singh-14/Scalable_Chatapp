import express from "express";
import http from "http";
import SocketService from "./services/socket.js";

async function init() {
    const app = express();
    const socketService = new SocketService();
    const httpServer = http.createServer();
    const PORT = process.env.PORT ? process.env.PORT : 8000;

    socketService.io.attach(httpServer);
    httpServer.listen(PORT, () => {
        console.log(`HTTP Server started at PORT:${PORT}`)
    })
    socketService.initListener();


}
init();