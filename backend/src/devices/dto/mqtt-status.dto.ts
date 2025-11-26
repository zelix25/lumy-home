export interface MqttStatusDto {
  connected: boolean;
  brokerUrl: string;
  clientId: string;
  messagesReceived: number;
  messagesSent: number;
  lastMessageReceived?: Date;
  lastMessageSent?: Date;
  subscribedTopics: string[];
}

