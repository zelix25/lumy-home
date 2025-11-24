import { useEffect, useState } from 'react';
import { websocketService } from '../services/websocket.service';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    websocketService.connect();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    websocketService.on('connect', handleConnect);
    websocketService.on('disconnect', handleDisconnect);

    setIsConnected(websocketService.isConnected());

    return () => {
      websocketService.off('connect', handleConnect);
      websocketService.off('disconnect', handleDisconnect);
    };
  }, []);

  return {
    isConnected,
    socket: websocketService,
  };
}

