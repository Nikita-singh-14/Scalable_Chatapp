"use client";
import { useState } from 'react';
import { useSocket } from './context/SocketProvider';
import classes from './page.module.css'
export default function Page() {

    const { sendMessage, messages } = useSocket();
    const [message, setMessage] = useState("")

    const handleSend = (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        sendMessage(message);
        setMessage("");
    };
    return (
        <div className={classes["first-class"]}>
            <form onSubmit={handleSend} className={classes["main-class"]}>
                <input value={message} onChange={(e) => setMessage(e.target.value)} className={classes["chat-input"]} placeholder="Message..." />
                <button type='submit' className={classes["button"]}>Send</button>
            </form>

            <ul>
                {messages.map((msg, index) => (
                    <li key={index}>{msg}</li>
                ))}
            </ul>
        </div>
    )
}