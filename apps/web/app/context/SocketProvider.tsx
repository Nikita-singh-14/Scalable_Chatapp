'use client';

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketProviderProps {
    children?: React.ReactNode;
}

export interface ChatMessage {
    id: string;
    username: string;
    message: string;
    sentAt: number;
}

interface ChatMessagePage {
    messages: ChatMessage[];
    hasMore: boolean;
}

interface ISocketContext {
    sendMessage: (msg: string) => void;
    messages: ChatMessage[];
    hasOlderMessages: boolean;
    isLoadingHistory: boolean;
    historyError: string | null;
    loadOlderMessages: () => Promise<void>;
    isAuthenticated: boolean;
    isConnected: boolean;
    username: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    error: string | null;
    messageError: string | null;
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

    const sentAt = typeof message.sentAt === 'number' && Number.isFinite(message.sentAt)
        ? message.sentAt
        : Date.now();

    return {
        id: typeof message.id === 'string'
            ? message.id
            : `legacy-${sentAt}-${Math.random().toString(36).slice(2)}`,
        username: typeof message.username === 'string' ? message.username : 'Unknown sender',
        message: message.message,
        sentAt,
    };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
    const messagesById = new Map(current.map((message) => [message.id, message]));
    for (const message of incoming) {
        messagesById.set(message.id, message);
    }
    return Array.from(messagesById.values()).sort((left, right) => {
        const leftId = /^(\d+)-(\d+)$/.exec(left.id);
        const rightId = /^(\d+)-(\d+)$/.exec(right.id);
        if (leftId && rightId) {
            const timeDifference = Number(leftId[1]) - Number(rightId[1]);
            return timeDifference || Number(leftId[2]) - Number(rightId[2]);
        }
        return left.sentAt - right.sentAt || left.id.localeCompare(right.id);
    });
}

async function fetchMessagePage(
    token: string,
    before?: string,
    signal?: AbortSignal
): Promise<ChatMessagePage> {
    const query = new URLSearchParams({ limit: '50' });
    if (before) query.set('before', before);

    const response = await fetch(`${API_BASE_URL}/api/messages?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
    });
    const data: unknown = await response.json();

    if (!response.ok) {
        const errorMessage = typeof data === 'object' && data !== null && 'message' in data &&
            typeof data.message === 'string'
            ? data.message
            : 'Unable to load chat history.';
        throw new Error(errorMessage);
    }

    if (typeof data !== 'object' || data === null || !('messages' in data) ||
        !Array.isArray(data.messages) || !('hasMore' in data) || typeof data.hasMore !== 'boolean') {
        throw new Error('The server returned an invalid chat history response.');
    }

    const messages = data.messages.map(parseChatMessage);
    if (messages.some((message) => message === null)) {
        throw new Error('The server returned an invalid chat message.');
    }

    return {
        messages: messages.filter((message): message is ChatMessage => message !== null),
        hasMore: data.hasMore,
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
    const [hasOlderMessages, setHasOlderMessages] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messageError, setMessageError] = useState<string | null>(null);

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
        setHasOlderMessages(false);
        setIsLoadingHistory(false);
        setHistoryError(null);
        setIsConnected(false);
        setError(null);
        setMessageError(null);
        window.localStorage.removeItem('chat_token');
        window.localStorage.removeItem('chat_user');
        socket?.disconnect();
    }, [socket]);

    const sendMessage: ISocketContext['sendMessage'] = useCallback((msg) => {
        if (!msg.trim()) return;
        if (socket?.connected) {
            setMessageError(null);
            socket.emit('event:message', { message: msg });
        }
    }, [socket]);

    const onMessageRec = useCallback((incoming: unknown) => {
        const chatMessage = parseChatMessage(incoming);
        if (!chatMessage) return;
        setMessages((previous) => mergeMessages(previous, [chatMessage]));
    }, []);

    const loadOlderMessages = useCallback(async () => {
        if (!token || isLoadingHistory) return;

        setIsLoadingHistory(true);
        setHistoryError(null);
        try {
            const page = await fetchMessagePage(token, messages[0]?.id);
            setMessages((previous) => mergeMessages(previous, page.messages));
            setHasOlderMessages(page.hasMore);
        } catch (loadError) {
            setHistoryError(loadError instanceof Error ? loadError.message : 'Unable to load chat history.');
        } finally {
            setIsLoadingHistory(false);
        }
    }, [isLoadingHistory, messages, token]);

    useEffect(() => {
        if (!token) {
            setSocket(undefined);
            setIsConnected(false);
            setIsLoadingHistory(false);
            return;
        }

        const controller = new AbortController();
        setIsLoadingHistory(true);
        setHistoryError(null);
        setHasOlderMessages(false);
        fetchMessagePage(token, undefined, controller.signal)
            .then((page) => {
                setMessages((previous) => mergeMessages(previous, page.messages));
                setHasOlderMessages(page.hasMore);
            })
            .catch((loadError: unknown) => {
                if (!controller.signal.aborted) {
                    setHistoryError(loadError instanceof Error ? loadError.message : 'Unable to load chat history.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setIsLoadingHistory(false);
                }
            });

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
        const onMessageError = (messageError: string) => {
            setMessageError(messageError);
        };

        _socket.on('message', onMessageRec);
        _socket.on('message:error', onMessageError);
        _socket.on('connect', onConnect);
        _socket.on('disconnect', onDisconnect);
        _socket.on('connect_error', onConnectError);
        setSocket(_socket);

        return () => {
            _socket.disconnect();
            _socket.off('message', onMessageRec);
            _socket.off('message:error', onMessageError);
            _socket.off('connect', onConnect);
            _socket.off('disconnect', onDisconnect);
            _socket.off('connect_error', onConnectError);
            controller.abort();
            setSocket(undefined);
        };
    }, [onMessageRec, token]);

    return (
        <SocketContext.Provider value={{
            sendMessage,
            messages,
            hasOlderMessages,
            isLoadingHistory,
            historyError,
            loadOlderMessages,
            isAuthenticated: Boolean(token),
            isConnected,
            username,
            login,
            logout,
            error,
            messageError,
        }}>
            {children}
        </SocketContext.Provider>
    );
};