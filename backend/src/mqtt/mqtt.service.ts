import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import * as mqtt from 'mqtt';
import { Subject, Observable } from 'rxjs';

export interface MqttMessage {
  topic: string;
  payload: any;
  timestamp: Date;
  direction?: 'incoming' | 'outgoing';
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient | null = null;
  private messageSubject = new Subject<MqttMessage>();
  public message$: Observable<MqttMessage> = this.messageSubject.asObservable();
  
  // Statistiques
  private messagesReceived = 0;
  private messagesSent = 0;
  private lastMessageReceived?: Date;
  private lastMessageSent?: Date;
  private subscribedTopics: string[] = [];

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

      this.client.on('connect', (packet) => {
        this.logger.log(
          `✅ Connecté au broker MQTT: ${mqttConfig.brokerUrl} (session: ${packet.sessionPresent ? 'présente' : 'nouvelle'})`,
          'MqttService',
        );
        this.logger.log(
          `📡 Configuration MQTT - Broker: ${mqttConfig.brokerUrl}, Client ID: ${mqttConfig.clientId}`,
          'MqttService',
        );
        // Réinitialiser la liste des topics abonnés
        this.subscribedTopics = [];
        // S'abonner aux topics après la connexion
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
        // Réinitialiser la liste car on va se réabonner
        this.subscribedTopics = [];
      });

      this.client.on('close', () => {
        this.logger.warn('Connexion MQTT fermée', 'MqttService');
      });

      this.client.on('message', (topic, message) => {
        try {
          const messageStr = message.toString();
          
          // Gérer les messages vides ou non-JSON
          let payload: any;
          if (messageStr.trim() === '' || messageStr.trim() === '""') {
            payload = '';
          } else {
            try {
              payload = JSON.parse(messageStr);
            } catch {
              // Si ce n'est pas du JSON, garder comme string
              payload = messageStr;
            }
          }
          
          this.messagesReceived++;
          this.lastMessageReceived = new Date();
          this.messageSubject.next({
            topic,
            payload,
            timestamp: new Date(),
            direction: 'incoming',
          });
          
          // Logger tous les messages MQTT reçus
          if (payload !== '' && payload !== '""') {
            const payloadStr = typeof payload === 'object' 
              ? JSON.stringify(payload) 
              : String(payload);
            this.logger.log(
              `📨 MQTT IN [${topic}]: ${payloadStr.substring(0, 300)}${payloadStr.length > 300 ? '...' : ''}`,
              'MqttService',
            );
          } else {
            this.logger.debug(
              `📨 MQTT IN [${topic}]: (payload vide)`,
              'MqttService',
            );
          }
        } catch (error) {
          this.logger.error(
            `Erreur traitement message MQTT: ${error.message}`,
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
      this.logger.warn(
        'Impossible de s\'abonner aux topics: client MQTT non connecté',
        'MqttService',
      );
      return;
    }

    const topics = [
      'zigbee2mqtt/#', // Wildcard pour recevoir TOUTES les données (capteurs, appareils, bridge, etc.)
    ];

    this.logger.log(
      `Abonnement à ${topics.length} topics Zigbee2MQTT...`,
      'MqttService',
    );

    topics.forEach((topic) => {
      this.client?.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          this.logger.error(
            `Erreur abonnement topic ${topic}: ${err.message}`,
            err.stack,
            'MqttService',
          );
        } else {
          // Ajouter le topic à la liste des topics abonnés
          if (!this.subscribedTopics.includes(topic)) {
            this.subscribedTopics.push(topic);
          }
          this.logger.log(`✅ Abonné au topic: ${topic}`, 'MqttService');
        }
      });
    });

    // Vérifier après un court délai que les abonnements sont bien effectués
    setTimeout(() => {
      this.logger.log(
        `Topics abonnés: ${this.subscribedTopics.length}/${topics.length}`,
        'MqttService',
      );
      if (this.subscribedTopics.length === 0) {
        this.logger.error(
          '⚠️ Aucun topic n\'a été abonné avec succès!',
          undefined,
          'MqttService',
        );
      }
    }, 1000);
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
        const payloadStr = typeof message === 'string' ? message : JSON.stringify(message);
        this.logger.log(
          `📤 MQTT OUT [${topic}]: ${payloadStr.substring(0, 300)}${payloadStr.length > 300 ? '...' : ''}`,
          'MqttService',
        );
        // Diffuser aussi les messages publiés pour le debug
        this.messagesSent++;
        this.lastMessageSent = new Date();
        try {
          let parsedPayload: any;
          if (typeof message === 'string') {
            // Si c'est une chaîne vide, ne pas essayer de parser
            if (message.trim() === '' || message.trim() === '""') {
              parsedPayload = '';
            } else {
              try {
                parsedPayload = JSON.parse(message);
              } catch {
                // Si le parsing échoue, garder comme string
                parsedPayload = message;
              }
            }
          } else {
            parsedPayload = message;
          }
          this.messageSubject.next({
            topic,
            payload: parsedPayload,
            timestamp: new Date(),
            direction: 'outgoing',
          });
        } catch (error) {
          // Si le parsing échoue, envoyer tel quel
          this.logger.debug(
            `Erreur parsing payload publié: ${error.message}`,
            'MqttService',
          );
          this.messageSubject.next({
            topic,
            payload: message,
            timestamp: new Date(),
            direction: 'outgoing',
          });
        }
      }
    });
  }

  public subscribe(topic: string, options?: mqtt.IClientSubscribeOptions): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn(
        'Tentative d\'abonnement alors que MQTT n\'est pas connecté',
        'MqttService',
      );
      return;
    }

    this.client.subscribe(topic, options || { qos: 0 }, (err) => {
      if (err) {
        this.logger.error(
          `Erreur abonnement topic ${topic}: ${err.message}`,
          err.stack,
          'MqttService',
        );
      } else {
        if (!this.subscribedTopics.includes(topic)) {
          this.subscribedTopics.push(topic);
        }
        this.logger.log(`✅ Abonné au topic: ${topic}`, 'MqttService');
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
        // Retirer le topic de la liste
        this.subscribedTopics = this.subscribedTopics.filter((t) => t !== topic);
        this.logger.log(`Désabonné du topic: ${topic}`, 'MqttService');
      }
    });
  }

  public isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  public getStatus() {
    return {
      connected: this.isConnected(),
      brokerUrl: this.config.mqtt.brokerUrl,
      clientId: this.config.mqtt.clientId,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      lastMessageReceived: this.lastMessageReceived,
      lastMessageSent: this.lastMessageSent,
      subscribedTopics: [...this.subscribedTopics],
    };
  }

  public reconnect(): void {
    if (this.client && this.client.connected) {
      this.logger.log('Réabonnement aux topics Zigbee2MQTT...', 'MqttService');
      this.subscribedTopics = [];
      this.subscribeToZigbeeTopics();
    } else {
      this.logger.warn(
        'Impossible de se réabonner: client MQTT non connecté',
        'MqttService',
      );
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.logger.log('Déconnecté du broker MQTT', 'MqttService');
    }
  }
}

