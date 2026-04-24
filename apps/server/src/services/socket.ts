import dotenv from "dotenv";
dotenv.config();
import { Server } from "socket.io";
import * as IORedis from "ioredis";


console.log(process.env.PORT);

const pub = new IORedis.Redis({
    host: process.env.HOST,
    port: Number(process.env.PORT),
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    tls: {}
});



const sub = new IORedis.Redis({
    host: process.env.HOST,
    port: Number(process.env.PORT),
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    tls: {}
});

class SocketService {
    private _io:Server;

    constructor() {
        console.log("Init Socket Service...");
        this._io = new Server({
                cors: {
                    allowedHeaders: ["*"],
                    origin: "*",
                },
            
        });
        sub.subscribe('MESSAGES');
    }

    public initListener(){
        const io = this.io;
        console.log("Init Socket Listeners...")
        io.on("connect", (socket) => {
            console.log(`New Socket Connected`, socket.id);

            socket.on('event:message' , async ({message}: {message: string}) => {
                console.log("New Message Rec.", message);
                //publish this message to redis
                await pub.publish("MESSAGES", JSON.stringify({ message }));
            });
        });
        sub.on('message', (channel: string, message: string) => {
            if (channel === 'MESSAGES'){
                console.log('new message from redis', message)
                io.emit('message', message);
            }
        })
        
    }

    get io() {
        return this._io;
    }
}

export default SocketService;