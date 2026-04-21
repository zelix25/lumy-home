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
import { SystemService } from '../system/system.service';

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
  private logStreamUnsubscribers = new Map<string, Map<string, () => void>>();

  constructor(
    private readonly logger: LoggerService,
    private readonly mqttService: MqttService,
    private readonly config: ConfigService,
    private readonly systemService: SystemService,
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
      message: 'Connecté à Lumy Home',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    const unsubByContainer = this.logStreamUnsubscribers.get(clientId);
    if (unsubByContainer) {
      for (const [, unsubscribe] of unsubByContainer) {
        try {
          unsubscribe();
        } catch {
          // no-op
        }
      }
      this.logStreamUnsubscribers.delete(clientId);
    }
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

  @SubscribeMessage('system:logs:subscribe')
  async handleSystemLogsSubscribe(
    @MessageBody() data: { containerName: string; tail?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const containerName = (data?.containerName || '').trim();
    const tail = typeof data?.tail === 'number' ? data.tail : 200;
    if (!containerName) {
      client.emit('system:logs:error', {
        containerName,
        message: 'containerName est requis',
      });
      return;
    }

    let byContainer = this.logStreamUnsubscribers.get(client.id);
    if (!byContainer) {
      byContainer = new Map<string, () => void>();
      this.logStreamUnsubscribers.set(client.id, byContainer);
    }

    const existing = byContainer.get(containerName);
    if (existing) {
      try {
        existing();
      } catch {
        // no-op
      }
      byContainer.delete(containerName);
    }

    try {
      const unsubscribe = await this.systemService.streamContainerLogs(containerName, tail, {
        onData: (chunk) => {
          client.emit('system:logs:data', { containerName, chunk });
        },
        onError: (error) => {
          client.emit('system:logs:error', { containerName, message: error.message });
        },
        onEnd: () => {
          client.emit('system:logs:end', { containerName });
        },
      });
      byContainer.set(containerName, unsubscribe);
      client.emit('system:logs:subscribed', { containerName, tail });
    } catch (error: any) {
      client.emit('system:logs:error', {
        containerName,
        message: error?.message || 'Impossible de démarrer le stream de logs',
      });
    }
  }

  @SubscribeMessage('system:logs:unsubscribe')
  handleSystemLogsUnsubscribe(
    @MessageBody() data: { containerName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const containerName = (data?.containerName || '').trim();
    const byContainer = this.logStreamUnsubscribers.get(client.id);
    if (!byContainer || !containerName) return;
    const unsubscribe = byContainer.get(containerName);
    if (!unsubscribe) return;
    try {
      unsubscribe();
    } catch {
      // no-op
    }
    byContainer.delete(containerName);
    client.emit('system:logs:unsubscribed', { containerName });
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

