import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../logger/logger.service';
import { MqttService } from '../mqtt/mqtt.service';
import { ConfigService } from '../config/config.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/',
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, Socket>();

  constructor(
    private readonly logger: LoggerService,
    private readonly mqttService: MqttService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialisé', 'WebsocketGateway');

    // Écouter les messages MQTT et les diffuser aux clients WebSocket
    this.mqttService.message$.subscribe((message) => {
      this.broadcastMqttMessage(message);
    });
  }

  handleConnection(client: Socket) {
    const clientId = client.id;
    const ip = client.handshake.address;
    this.connectedClients.set(clientId, client);
    this.logger.log(
      `🔌 WebSocket connecté: ${clientId} - IP: ${ip} - Total: ${this.connectedClients.size}`,
      'WebsocketGateway',
    );

    // Envoyer un message de bienvenue
    client.emit('connected', {
      message: 'Connecté à HomeHub IA',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    this.connectedClients.delete(clientId);
    this.logger.log(
      `🔌 WebSocket déconnecté: ${clientId} - Total: ${this.connectedClients.size}`,
      'WebsocketGateway',
    );
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    this.logger.debug(`📡 WebSocket ping reçu de ${client.id}`, 'WebsocketGateway');
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { topic: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `📡 WebSocket abonnement [${client.id}]: ${data.topic}`,
      'WebsocketGateway',
    );
    // Ici on pourrait gérer des abonnements spécifiques par client
    client.emit('subscribed', { topic: data.topic });
  }

  private broadcastMqttMessage(message: any) {
    // Diffuser à tous les clients connectés
    this.server.emit('mqtt:message', {
      topic: message.topic,
      payload: message.payload,
      timestamp: message.timestamp || new Date().toISOString(),
      direction: message.direction || 'incoming',
    });
  }

  public broadcast(event: string, data: any) {
    this.logger.debug(
      `📡 WebSocket broadcast [${event}] à ${this.connectedClients.size} client(s)`,
      'WebsocketGateway',
    );
    this.server.emit(event, data);
  }

  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}

