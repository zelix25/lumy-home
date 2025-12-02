import { io, Socket } from 'socket.io-client';

// Utiliser un chemin relatif pour passer par le proxy nginx
// En développement local, utilise VITE_WS_URL si défini
// En production Docker, nginx fait le proxy de /socket.io vers backend:3000
// Si VITE_WS_URL n'est pas défini, socket.io utilisera l'origine actuelle (chemin relatif)
const WS_URL = import.meta.env.VITE_WS_URL || '';

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    // Si WS_URL est vide, socket.io utilisera l'origine actuelle (chemin relatif)
    // Cela permet de passer par le proxy nginx configuré pour /socket.io
    const socketUrl = WS_URL || window.location.origin;
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // Si on utilise un chemin relatif, socket.io doit utiliser le path /socket.io
      path: WS_URL ? undefined : '/socket.io',
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connecté');
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket déconnecté');
    });

    this.socket.on('mqtt:message', (data: unknown) => {
      this.notifyListeners('mqtt:message', data);
    });

    // Réabonner tous les listeners existants
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event, callback);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: unknown) => void): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    } else {
      this.listeners.delete(event);
      this.socket?.off(event);
    }
  }

  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private notifyListeners(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }
}

export const websocketService = new WebSocketService();

