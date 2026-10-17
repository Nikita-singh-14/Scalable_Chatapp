'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSocket } from './context/SocketProvider';
import classes from './page.module.css';

function BrandMark() {
    return (
        <span className={classes.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M4.5 5.75A2.75 2.75 0 0 1 7.25 3h9.5a2.75 2.75 0 0 1 2.75 2.75v6.5A2.75 2.75 0 0 1 16.75 15h-5.8l-4.7 3.55V15a2.75 2.75 0 0 1-1.75-2.75v-6.5Z" />
                <path d="M8 8h8M8 11h5" />
            </svg>
        </span>
    );
}

function SendIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m21 3-7.2 18-3.7-7.1L3 10.2 21 3Z" />
            <path d="M10.1 13.9 15 9" />
        </svg>
    );
}

function getInitials(name: string) {
    return name
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function formatTime(timestamp: number) {
    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(timestamp);
}

export default function Page() {
    const {
        sendMessage,
        messages,
        hasOlderMessages,
        isLoadingHistory,
        historyError,
        loadOlderMessages,
        isAuthenticated,
        login,
        logout,
        username,
        error,
        messageError,
        isConnected,
    } = useSocket();
    const [message, setMessage] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const displayName = username || 'You';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages]);

    const handleSend = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!message.trim() || !isConnected) return;
        sendMessage(message.trim());
        setMessage('');
    };

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!userName.trim() || !password.trim()) {
            setLoginError('Enter your username and password to continue.');
            return;
        }

        setIsSubmitting(true);
        setLoginError(null);

        try {
            await login(userName.trim(), password);
            setUserName('');
            setPassword('');
        } catch (loginErr) {
            setLoginError(loginErr instanceof Error ? loginErr.message : 'Unable to sign in. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <main className={classes.loginPage}>
                <section className={classes.loginCard}>
                    <div className={classes.loginWelcome}>
                        <div className={classes.loginBrand}>
                            <BrandMark />
                            <span>together</span>
                        </div>
                        <div className={classes.welcomeCopy}>
                            <span className={classes.eyebrow}>YOUR SPACE TO CONNECT</span>
                            <h1>Good conversations start here.</h1>
                            <p>A simple place to catch up, share a thought, and feel a little closer.</p>
                        </div>
                        <div className={classes.welcomeDecoration} aria-hidden="true">
                            <span className={classes.decorBubbleOne}>hey there 👋</span>
                            <span className={classes.decorBubbleTwo}>Nice to see you!</span>
                            <span className={classes.decorDotOne} />
                            <span className={classes.decorDotTwo} />
                        </div>
                        <p className={classes.loginFootnote}>A little more connected, every day.</p>
                    </div>

                    <div className={classes.loginFormSide}>
                        <form className={classes.loginForm} onSubmit={handleLogin}>
                            <div className={classes.mobileBrand}>
                                <BrandMark />
                                <span>together</span>
                            </div>
                            <span className={classes.eyebrow}>WELCOME BACK</span>
                            <h2>Sign in to chat</h2>
                            <p className={classes.formIntro}>Pick up where the conversation left off.</p>

                            <label className={classes.fieldLabel} htmlFor="username">Username</label>
                            <input
                                id="username"
                                autoComplete="username"
                                value={userName}
                                onChange={(event) => setUserName(event.target.value)}
                                className={classes.textInput}
                                placeholder="Your username"
                                required
                            />

                            <label className={classes.fieldLabel} htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className={classes.textInput}
                                placeholder="Your password"
                                required
                            />

                            {(loginError || error) && (
                                <p className={classes.errorMessage} role="alert">{loginError || error}</p>
                            )}

                            <button type="submit" className={classes.loginButton} disabled={isSubmitting}>
                                {isSubmitting ? 'Signing in…' : 'Enter the chat'}
                                <span aria-hidden="true">→</span>
                            </button>
                            <p className={classes.loginHint}>New around here? Choose a username and password to join.</p>
                        </form>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className={classes.appShell}>
            <aside className={classes.sidebar}>
                <Link className={classes.brand} href="/" aria-label="Together home">
                    <BrandMark />
                    <span>together</span>
                </Link>

                <div className={classes.sidebarSection}>
                    <span className={classes.sidebarLabel}>YOUR SPACE</span>
                    <div className={classes.roomItem} aria-current="page">
                        <span className={classes.roomIcon} aria-hidden="true">#</span>
                        <span className={classes.roomText}>
                            <strong>Global chat</strong>
                            <small>Everyone is welcome</small>
                        </span>
                        <span className={classes.roomIndicator} aria-label={isConnected ? 'Connected' : 'Connecting'} />
                    </div>
                </div>

                <div className={classes.sidebarNote}>
                    <span className={classes.noteIcon} aria-hidden="true">✳</span>
                    <strong>A little reminder</strong>
                    <p>Good conversations make any day better.</p>
                </div>

                <div className={classes.sidebarProfile}>
                    <span className={classes.avatar}>{getInitials(displayName) || 'Y'}</span>
                    <span className={classes.profileText}>
                        <strong>{displayName}</strong>
                        <small><span className={classes.onlineDot} /> Available</small>
                    </span>
                    <button type="button" className={classes.logoutButton} onClick={logout} aria-label="Log out" title="Log out">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M10 17l5-5-5-5M15 12H3m9-8h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                        </svg>
                    </button>
                </div>
            </aside>

            <section className={classes.chatPanel} aria-label="Global chat">
                <header className={classes.chatHeader}>
                    <div className={classes.roomHeading}>
                        <span className={classes.headerRoomIcon} aria-hidden="true">#</span>
                        <div>
                            <h1>Global chat</h1>
                            <p>A friendly corner of the internet</p>
                        </div>
                    </div>
                    <div className={classes.connectionStatus}>
                        <span className={`${classes.connectionDot} ${isConnected ? classes.isOnline : ''}`} />
                        <span>{isConnected ? 'Live' : 'Connecting'}</span>
                    </div>
                </header>

                <div className={classes.messageArea} aria-live="polite" aria-relevant="additions">
                    {error && (
                        <div className={classes.connectionNotice} role="status">
                            <span>We’re having trouble connecting. Trying again…</span>
                        </div>
                    )}

                    {historyError && (
                        <div className={classes.historyError} role="alert">
                            <span>{historyError}</span>
                            <button type="button" onClick={() => void loadOlderMessages()} disabled={isLoadingHistory}>
                                {isLoadingHistory ? 'Loading…' : 'Try again'}
                            </button>
                        </div>
                    )}

                    {hasOlderMessages && (
                        <button
                            type="button"
                            className={classes.loadOlderButton}
                            onClick={() => void loadOlderMessages()}
                            disabled={isLoadingHistory}
                        >
                            {isLoadingHistory ? 'Loading earlier messages…' : 'Load earlier messages'}
                        </button>
                    )}

                    {messages.length === 0 && isLoadingHistory ? (
                        <p className={classes.historyLoading}>Loading your conversation…</p>
                    ) : messages.length === 0 && !historyError ? (
                        <div className={classes.emptyState}>
                            <div className={classes.emptyIllustration} aria-hidden="true">
                                <span className={classes.emptyBubble}>Hello!</span>
                                <span className={classes.emptyBubbleDot}>•••</span>
                                <span className={classes.emptySparkle}>✦</span>
                            </div>
                            <span className={classes.eyebrow}>YOU MADE IT</span>
                            <h2>Every good chat starts with hello.</h2>
                            <p>Say hi to everyone in the room and get the conversation going.</p>
                        </div>
                    ) : (
                        <div className={classes.messageList}>
                            <div className={classes.dayDivider}><span>THE CONVERSATION</span></div>
                            {messages.map((chatMessage, index) => {
                                const isMine = chatMessage.username === username;
                                const sender = chatMessage.username || 'Unknown sender';

                                return (
                                    <article
                                        key={chatMessage.id || `${chatMessage.sentAt}-${index}`}
                                        className={`${classes.messageRow} ${isMine ? classes.ownMessage : ''}`}
                                    >
                                        {!isMine && (
                                            <span className={`${classes.avatar} ${classes.messageAvatar}`}>
                                                {getInitials(sender) || '?'}
                                            </span>
                                        )}
                                        <div className={classes.messageContent}>
                                            <div className={classes.messageMeta}>
                                                <strong>{sender}</strong>
                                                <time dateTime={new Date(chatMessage.sentAt).toISOString()}>
                                                    {formatTime(chatMessage.sentAt)}
                                                </time>
                                            </div>
                                            <p className={classes.messageBubble}>{chatMessage.message}</p>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className={classes.composerWrap}>
                    {messageError && <p className={classes.messageError} role="alert">{messageError}</p>}
                    <form className={classes.composer} onSubmit={handleSend}>
                        <input
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            className={classes.messageInput}
                            placeholder={isConnected ? 'Write a message…' : 'Connecting to chat…'}
                            aria-label="Write a message"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            className={classes.sendButton}
                            disabled={!message.trim() || !isConnected}
                            aria-label="Send message"
                            title="Send message"
                        >
                            <SendIcon />
                        </button>
                    </form>
                    <p className={classes.composerHint}>Be kind. Good vibes only.</p>
                </div>
            </section>
        </main>
    );
}
