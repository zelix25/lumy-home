import { useEffect, useState } from 'react';
import { websocketService } from '../services/websocket.service';

export interface MqttMessage {
  topic: string;
  payload: unknown;
  timestamp: string;
}

export function useMqttMessages() {
  const [messages, setMessages] = useState<MqttMessage[]>([]);

  useEffect(() => {
    const handleMessage = (data: unknown) => {
      const message = data as MqttMessage;
      setMessages((prev) => [message, ...prev].slice(0, 100)); // Garder les 100 derniers messages
    };

    websocketService.on('mqtt:message', handleMessage);

    return () => {
      websocketService.off('mqtt:message', handleMessage);
    };
  }, []);

  return messages;
}

