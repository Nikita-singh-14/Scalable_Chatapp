'use client';

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketProviderProps {
    children?: React.ReactNode;
}

export interface ChatMessage {
    username: string;
    message: string;
    sentAt: number;
}

interface ISocketContext {
    sendMessage: (msg: string) => void;
    messages: ChatMessage[];
    isAuthenticated: boolean;
    isConnected: boolean;
    username: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    error: string | null;
}

function parseChatMessage(value: unknown): ChatMessage | null {
    let payload = value;

    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch {
            payload = { message: payload };
        }
    }

    if (typeof payload !== 'object' || payload === null) return null;

    const message = payload as Record<string, unknown>;
    if (typeof message.message !== 'string') return null;

    return {
        username: typeof message.username === 'string' ? message.username : 'Unknown sender',
        message: message.message,
        sentAt: typeof message.sentAt === 'number' && Number.isFinite(message.sentAt)
            ? message.sentAt
            : Date.now(),
    };
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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
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
        setMessages([]);
        setIsConnected(false);
        setError(null);
        window.localStorage.removeItem('chat_token');
        window.localStorage.removeItem('chat_user');
        socket?.disconnect();
    }, [socket]);

    const sendMessage: ISocketContext['sendMessage'] = useCallback((msg) => {
        if (!msg.trim()) return;
        if (socket?.connected) {
            socket.emit('event:message', { message: msg });
        }
    }, [socket]);

    const onMessageRec = useCallback((incoming: unknown) => {
        const chatMessage = parseChatMessage(incoming);
        if (!chatMessage) return;
        setMessages((previous) => [...previous, chatMessage]);
    }, []);

    useEffect(() => {
        if (!token) {
            setSocket(undefined);
            setIsConnected(false);
            return;
        }

        const _socket = io(API_BASE_URL, {
            auth: {
                token,
            },
        });
        const onConnect = () => {
            setIsConnected(true);
            setError(null);
        };
        const onDisconnect = () => setIsConnected(false);
        const onConnectError = (err: Error) => {
            setIsConnected(false);
            setError(err.message);
        };

        _socket.on('message', onMessageRec);
        _socket.on('connect', onConnect);
        _socket.on('disconnect', onDisconnect);
        _socket.on('connect_error', onConnectError);
        setSocket(_socket);

        return () => {
            _socket.disconnect();
            _socket.off('message', onMessageRec);
            _socket.off('connect', onConnect);
            _socket.off('disconnect', onDisconnect);
            _socket.off('connect_error', onConnectError);
            setSocket(undefined);
        };
    }, [onMessageRec, token]);

    return (
        <SocketContext.Provider value={{
            sendMessage,
            messages,
            isAuthenticated: Boolean(token),
            isConnected,
            username,
            login,
            logout,
            error,
        }}>
            {children}
        </SocketContext.Provider>
    );
};