import { io, type Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL ?? '', {
      autoConnect: false,
      auth: (cb: (data: { token: string | null }) => void) => cb({ token: getToken() }),
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
    });
  }
  return socket;
}

export function ensureConnected(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
