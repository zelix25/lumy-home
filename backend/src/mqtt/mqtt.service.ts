import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import * as mqtt from 'mqtt';
import { Subject, Observable } from 'rxjs';

export interface MqttMessage {
  topic: string;
  payload: any;
  timestamp: Date;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient | null = null;
  private messageSubject = new Subject<MqttMessage>();
  public message$: Observable<MqttMessage> = this.messageSubject.asObservable();

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const mqttConfig = this.config.mqtt;

    try {
      const options: mqtt.IClientOptions = {
        clientId: mqttConfig.clientId,
        reconnectPeriod: mqttConfig.reconnectPeriod,
        connectTimeout: 10000,
        keepalive: 60,
      };

      if (mqttConfig.username) {
        options.username = mqttConfig.username;
        options.password = mqttConfig.password;
      }

      this.client = mqtt.connect(mqttConfig.brokerUrl, options);

      this.client.on('connect', () => {
        this.logger.log(
          `Connecté au broker MQTT: ${mqttConfig.brokerUrl}`,
          'MqttService',
        );
        this.subscribeToZigbeeTopics();
      });

      this.client.on('error', (error) => {
        this.logger.error(
          `Erreur MQTT: ${error.message}`,
          error.stack,
          'MqttService',
        );
      });

      this.client.on('reconnect', () => {
        this.logger.warn('Reconnexion au broker MQTT...', 'MqttService');
      });

      this.client.on('close', () => {
        this.logger.warn('Connexion MQTT fermée', 'MqttService');
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.messageSubject.next({
            topic,
            payload,
            timestamp: new Date(),
          });
          this.logger.debug(
            `Message reçu [${topic}]: ${JSON.stringify(payload)}`,
            'MqttService',
          );
        } catch (error) {
          this.logger.error(
            `Erreur parsing message MQTT: ${error.message}`,
            error.stack,
            'MqttService',
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `Erreur connexion MQTT: ${error.message}`,
        error.stack,
        'MqttService',
      );
    }
  }

  private subscribeToZigbeeTopics(): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    const topics = [
      'zigbee2mqtt/bridge/devices', // Liste des appareils
      'zigbee2mqtt/+/state', // États des appareils
      'zigbee2mqtt/bridge/event', // Événements du bridge
    ];

    topics.forEach((topic) => {
      this.client?.subscribe(topic, (err) => {
        if (err) {
          this.logger.error(
            `Erreur abonnement topic ${topic}: ${err.message}`,
            err.stack,
            'MqttService',
          );
        } else {
          this.logger.log(`Abonné au topic: ${topic}`, 'MqttService');
        }
      });
    });
  }

  public publish(topic: string, message: any): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn(
        'Tentative de publication alors que MQTT n\'est pas connecté',
        'MqttService',
      );
      return;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.client.publish(topic, payload, (error) => {
      if (error) {
        this.logger.error(
          `Erreur publication MQTT: ${error.message}`,
          error.stack,
          'MqttService',
        );
      } else {
        this.logger.debug(`Message publié [${topic}]: ${payload}`, 'MqttService');
      }
    });
  }

  public subscribe(topic: string): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn(
        'Tentative d\'abonnement alors que MQTT n\'est pas connecté',
        'MqttService',
      );
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        this.logger.error(
          `Erreur abonnement topic ${topic}: ${err.message}`,
          err.stack,
          'MqttService',
        );
      } else {
        this.logger.log(`Abonné au topic: ${topic}`, 'MqttService');
      }
    });
  }

  public unsubscribe(topic: string): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        this.logger.error(
          `Erreur désabonnement topic ${topic}: ${err.message}`,
          err.stack,
          'MqttService',
        );
      } else {
        this.logger.log(`Désabonné du topic: ${topic}`, 'MqttService');
      }
    });
  }

  public isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.logger.log('Déconnecté du broker MQTT', 'MqttService');
    }
  }
}

