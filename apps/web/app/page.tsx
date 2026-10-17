'use client';

import { FormEvent, useState } from 'react';
import { useSocket } from './context/SocketProvider';
import classes from './page.module.css';

export default function Page() {
    const { sendMessage, messages, isAuthenticated, login, logout, username, error } = useSocket();
    const [message, setMessage] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSend = (e: FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        sendMessage(message);
        setMessage('');
    };

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        if (!userName.trim() || !password.trim()) {
            setLoginError('Username and password are required.');
            return;
        }

        setIsSubmitting(true);
        setLoginError(null);

        try {
            await login(userName.trim(), password);
            setUserName('');
            setPassword('');
        } catch (loginErr) {
            setLoginError(loginErr instanceof Error ? loginErr.message : 'Login failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className={classes['first-class']}>
                <h2>Login to join the chat</h2>
                <form onSubmit={handleLogin} className={classes['main-class']}>
                    <input
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className={classes['chat-input']}
                        placeholder="Username"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={classes['chat-input']}
                        placeholder="Password"
                    />
                    <button type="submit" className={classes['button']} disabled={isSubmitting}>
                        {isSubmitting ? 'Loading...' : 'Login'}
                    </button>
                </form>
                {(loginError || error) && <p>{loginError || error}</p>}
            </div>
        );
    }

    return (
        <div className={classes['first-class']}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Welcome, {username}</h2>
                <button type="button" className={classes['button']} onClick={logout}>Logout</button>
            </div>

            <form onSubmit={handleSend} className={classes['main-class']}>
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={classes['chat-input']}
                    placeholder="Message..."
                />
                <button type="submit" className={classes['button']}>Send</button>
            </form>

            {error && <p>{error}</p>}

            <ul>
                {messages.map((msg, index) => (
                    <li key={`${msg}-${index}`}>{msg}</li>
                ))}
            </ul>
        </div>
    );
}