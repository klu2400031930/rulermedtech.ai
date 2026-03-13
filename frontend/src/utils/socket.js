import { io } from 'socket.io-client';

const SOCKET_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : window.location.origin;

let socket = null;

export function getSocket() {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
        });

        socket.on('connect', () => {
            console.log('Socket.IO connected:', socket.id);
        });

        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
        });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
