'use client';

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketProviderProps {
    children?: React.ReactNode;
}

interface ISocketContext {
    sendMessage: (msg: string) => void;
    messages: string[];
    isAuthenticated: boolean;
    username: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    error: string | null;
}

const SocketContext = React.createContext<ISocketContext | null>(null);

export const useSocket = () => {
    const state = useContext(SocketContext);
    if (!state) throw new Error('state is undefined');
    return state;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const [socket, setSocket] = useState<Socket>();
    const [messages, setMessages] = useState<string[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const savedToken = window.localStorage.getItem('chat_token');
        const savedUser = window.localStorage.getItem('chat_user');

        if (savedToken) {
            setToken(savedToken);
        }

        if (savedUser) {
            setUsername(savedUser);
        }
    }, []);

    const login = useCallback(async (userName: string, password: string) => {
        let response: Response;
        try {
            response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: userName, password }),
            });
        } catch {
            throw new Error(`Cannot reach the chat server at ${API_BASE_URL}. Start the server and check NEXT_PUBLIC_API_URL.`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        window.localStorage.setItem('chat_token', data.token);
        window.localStorage.setItem('chat_user', data.user.username);
        setToken(data.token);
        setUsername(data.user.username);
        setError(null);
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUsername(null);
        setError(null);
        window.localStorage.removeItem('chat_token');
        window.localStorage.removeItem('chat_user');
        socket?.disconnect();
    }, [socket]);

    const sendMessage: ISocketContext['sendMessage'] = useCallback((msg) => {
        if (!msg.trim()) return;
        if (socket) {
            socket.emit('event:message', { message: msg });
        }
    }, [socket]);

    const onMessageRec = useCallback((msg: string) => {
        try {
            const payload = JSON.parse(msg) as { message: string };
            setMessages((prev) => [...prev, payload.message]);
        } catch {
            setMessages((prev) => [...prev, msg]);
        }
    }, []);

    useEffect(() => {
        if (!token) {
            setSocket(undefined);
            return;
        }

        const _socket = io(API_BASE_URL, {
            auth: {
                token,
            },
        });

        _socket.on('message', onMessageRec);
        _socket.on('connect_error', (err) => {
            setError(err.message);
        });
        setSocket(_socket);

        return () => {
            _socket.disconnect();
            _socket.off('message', onMessageRec);
            _socket.off('connect_error');
            setSocket(undefined);
        };
    }, [onMessageRec, token]);

    return (
        <SocketContext.Provider value={{
            sendMessage,
            messages,
            isAuthenticated: Boolean(token),
            username,
            login,
            logout,
            error,
        }}>
            {children}
        </SocketContext.Provider>
    );
};