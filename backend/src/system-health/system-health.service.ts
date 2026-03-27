import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
const Docker = require('dockerode');
import {
  SystemNotification,
  SystemNotificationType,
  SystemNotificationCategory,
} from './entities/system-notification.entity';
import { WebsocketGateway } from '../websocket/websocket.gateway';

interface ContainerStatus {
  name: string;
  status: string;
  state: 'running' | 'exited' | 'restarting' | 'paused' | 'dead' | 'not_found';
  health?: string;
}

@Injectable()
export class SystemHealthService implements OnModuleInit {
  private readonly logger = new Logger(SystemHealthService.name);
  private readonly containersToCheck = ['zigbee2mqtt', 'mosquitto'];
  private docker: any;

  constructor(
    @InjectRepository(SystemNotification)
    private readonly notificationRepository: Repository<SystemNotification>,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    // Initialiser Docker avec le socket par défaut
    // En production Docker, le socket est monté à /var/run/docker.sock
    // En développement local, utiliser le socket local
    const socketPath = process.platform === 'win32' 
      ? '//./pipe/docker_engine' 
      : '/var/run/docker.sock';
    
    this.docker = new Docker({ socketPath });
  }

  onModuleInit() {
    // Tester la connexion Docker au démarrage
    this.docker.ping()
      .then(() => {
        this.logger.log('Connexion Docker établie avec succès');
      })
      .catch((error: any) => {
        this.logger.warn('Impossible de se connecter à Docker:', error.message);
        this.logger.warn('Les vérifications de santé Docker seront désactivées');
      });
  }

  /**
   * Vérifie l'état de santé du système toutes les 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSystemHealth() {
    this.logger.log('Vérification de l\'état de santé du système...');
    
    try {
      await this.checkDockerContainers();
    } catch (error) {
      this.logger.error('Erreur lors de la vérification de santé:', error);
    }
  }

  /**
   * Vérifie l'état des containers Docker
   */
  async checkDockerContainers(): Promise<void> {
    // Vérifier que Docker est disponible
    try {
      await this.docker.ping();
    } catch (error) {
      this.logger.warn('Docker n\'est pas disponible, vérification des containers ignorée');
      return;
    }

    for (const containerName of this.containersToCheck) {
      try {
        const status = await this.getContainerStatus(containerName);
        
        if (status.state === 'not_found') {
          await this.createNotification(
            SystemNotificationType.ERROR,
            SystemNotificationCategory.DOCKER,
            `Container ${containerName} introuvable`,
            `Le container Docker "${containerName}" n'a pas été trouvé.`,
            this.getContainerNotFoundInstructions(containerName),
            containerName,
          );
        } else if (status.state !== 'running') {
          await this.createNotification(
            SystemNotificationType.ERROR,
            SystemNotificationCategory.DOCKER,
            `Container ${containerName} arrêté`,
            `Le container Docker "${containerName}" n'est pas en cours d'exécution. État: ${status.state}`,
            this.getContainerStoppedInstructions(containerName),
            containerName,
          );
        } else if (status.health === 'unhealthy') {
          await this.createNotification(
            SystemNotificationType.WARNING,
            SystemNotificationCategory.DOCKER,
            `Container ${containerName} en mauvaise santé`,
            `Le container Docker "${containerName}" est en cours d'exécution mais signale un problème de santé.`,
            this.getContainerUnhealthyInstructions(containerName),
            containerName,
          );
        } else {
          // Container est en bonne santé, marquer les notifications existantes comme résolues
          await this.resolveNotificationsForContainer(containerName);
        }
      } catch (error) {
        this.logger.error(`Erreur lors de la vérification du container ${containerName}:`, error);
        await this.createNotification(
          SystemNotificationType.ERROR,
          SystemNotificationCategory.DOCKER,
          `Erreur de vérification pour ${containerName}`,
          `Impossible de vérifier l'état du container "${containerName}". Erreur: ${error.message}`,
          'Vérifiez que Docker est installé et que vous avez les permissions nécessaires.',
          containerName,
        );
      }
    }
  }

  /**
   * Récupère le statut de tous les services Docker
   */
  async getAllServicesStatus(): Promise<Array<{ name: string; status: ContainerStatus['state']; image?: string }>> {
    const services: Array<{ name: string; status: ContainerStatus['state']; image?: string }> = [];
    
    // Vérifier que Docker est disponible
    try {
      await this.docker.ping();
    } catch (error) {
      this.logger.warn('Docker n\'est pas disponible, impossible de récupérer le statut des services');
      return services;
    }

    // Liste des services à vérifier (tous les services Lumy)
    const allServices = [
      'lumy-backend',
      'lumy-frontend',
      'zigbee2mqtt',
      'mosquitto',
      'lumy-updater',
      'lumy-agent',
    ];
    
    for (const serviceName of allServices) {
      try {
        const status = await this.getContainerStatus(serviceName);
        let image: string | undefined;
        
        // Si le container existe, récupérer l'image
        if (status.state !== 'not_found') {
          try {
            const container = this.docker.getContainer(serviceName);
            const inspect = await container.inspect();
            image = inspect?.Config?.Image || undefined;
          } catch (inspectError: any) {
            // Ignorer les erreurs d'inspection
            this.logger.debug(`Impossible d'inspecter le container ${serviceName}:`, inspectError.message);
          }
        }
        
        services.push({
          name: serviceName,
          status: status.state,
          image,
        });
      } catch (error: any) {
        // Si le container n'existe pas, l'ajouter avec le statut not_found
        if (error.statusCode === 404 || error.message?.includes('No such container')) {
          services.push({
            name: serviceName,
            status: 'not_found',
          });
        } else {
          this.logger.error(`Erreur lors de la récupération du statut de ${serviceName}:`, error);
          // Ajouter quand même avec un statut d'erreur
          services.push({
            name: serviceName,
            status: 'not_found',
          });
        }
      }
    }

    return services;
  }

  /**
   * Récupère le statut d'un container Docker
   */
  private async getContainerStatus(containerName: string): Promise<ContainerStatus> {
    try {
      const container = this.docker.getContainer(containerName);
      const inspect = await container.inspect();
      
      const state = inspect.State?.Status || 'unknown';
      const health = inspect.State?.Health?.Status;
      
      return {
        name: containerName,
        status: state,
        state: this.mapDockerStateToStatus(state),
        health: health || undefined,
      };
    } catch (error: any) {
      // Si le container n'existe pas, dockerode lance une erreur avec statusCode 404
      if (error.statusCode === 404 || error.message?.includes('No such container')) {
        return {
          name: containerName,
          status: 'not found',
          state: 'not_found',
        };
      }
      throw error;
    }
  }

  /**
   * Mappe l'état Docker vers notre enum
   */
  private mapDockerStateToStatus(state: string): ContainerStatus['state'] {
    const normalizedState = state.toLowerCase();
    if (normalizedState === 'running') return 'running';
    if (normalizedState === 'exited') return 'exited';
    if (normalizedState === 'restarting') return 'restarting';
    if (normalizedState === 'paused') return 'paused';
    if (normalizedState === 'dead') return 'dead';
    return 'not_found';
  }

  /**
   * Crée une notification système
   */
  private async createNotification(
    type: SystemNotificationType,
    category: SystemNotificationCategory,
    title: string,
    message: string,
    instructions: string | null,
    containerName: string | null,
  ): Promise<void> {
    // Vérifier si une notification similaire non résolue existe déjà
    const whereCondition: any = {
      type,
      category,
      resolved: false,
      title,
    };
    
    // Gérer le cas où containerName peut être null
    if (containerName === null) {
      whereCondition.containerName = IsNull();
    } else {
      whereCondition.containerName = containerName;
    }
    
    const existing = await this.notificationRepository.findOne({
      where: whereCondition,
    });

    if (existing) {
      // Mettre à jour la date de création pour la remettre en haut de la liste
      existing.createdAt = new Date();
      await this.notificationRepository.save(existing);
      return;
    }

    const notification = this.notificationRepository.create({
      type,
      category,
      title,
      message,
      instructions,
      containerName,
      resolved: false,
    });

    const saved = await this.notificationRepository.save(notification);

    // Envoyer via WebSocket
    this.websocketGateway.server.emit('system:notification', {
      id: saved.id,
      type: saved.type,
      category: saved.category,
      title: saved.title,
      message: saved.message,
      instructions: saved.instructions,
      containerName: saved.containerName,
      createdAt: saved.createdAt,
    });

    this.logger.warn(`Notification système créée: ${title}`);
  }

  /**
   * Marque les notifications d'un container comme résolues
   */
  private async resolveNotificationsForContainer(containerName: string): Promise<void> {
    const unresolved = await this.notificationRepository.find({
      where: {
        containerName,
        resolved: false,
      },
    });

    if (unresolved.length > 0) {
      unresolved.forEach((n) => {
        n.resolved = true;
      });
      await this.notificationRepository.save(unresolved);
      this.logger.log(`Notifications résolues pour le container ${containerName}`);
    }
  }

  /**
   * Récupère toutes les notifications non résolues
   */
  async getUnresolvedNotifications() {
    return this.notificationRepository.find({
      where: { resolved: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Récupère toutes les notifications
   */
  async getAllNotifications(limit: number = 50) {
    return this.notificationRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Marque une notification comme résolue
   */
  async markAsResolved(id: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (notification) {
      notification.resolved = true;
      await this.notificationRepository.save(notification);
    }
  }

  /**
   * Instructions pour un container introuvable
   */
  private getContainerNotFoundInstructions(containerName: string): string {
    if (containerName === 'zigbee2mqtt') {
      return `1. Vérifiez que le container est défini dans docker-compose.yml
2. Exécutez: docker-compose up -d zigbee2mqtt
3. Vérifiez les logs: docker logs zigbee2mqtt`;
    } else if (containerName === 'lumy-mosquitto') {
      return `1. Vérifiez que le container est défini dans docker-compose.yml
2. Exécutez: docker-compose up -d mosquitto
3. Vérifiez les logs: docker logs lumy-mosquitto`;
    }
    return `1. Vérifiez que le container est défini dans docker-compose.yml
2. Exécutez: docker-compose up -d ${containerName}
3. Vérifiez les logs: docker logs ${containerName}`;
  }

  /**
   * Instructions pour un container arrêté
   */
  private getContainerStoppedInstructions(containerName: string): string {
    if (containerName === 'zigbee2mqtt') {
      return `1. Redémarrez le container: docker restart zigbee2mqtt
2. Vérifiez les logs: docker logs zigbee2mqtt
3. Vérifiez la configuration dans data/zigbee2mqtt/configuration.yaml
4. Vérifiez que le périphérique USB est connecté: ls -l /dev/ttyUSB*`;
    } else if (containerName === 'lumy-mosquitto') {
      return `1. Redémarrez le container: docker restart lumy-mosquitto
2. Vérifiez les logs: docker logs lumy-mosquitto
3. Vérifiez la configuration dans data/mosquitto/config/mosquitto.conf
4. Vérifiez les permissions des volumes`;
    }
    return `1. Redémarrez le container: docker restart ${containerName}
2. Vérifiez les logs: docker logs ${containerName}
3. Vérifiez la configuration du container`;
  }

  /**
   * Instructions pour un container en mauvaise santé
   */
  private getContainerUnhealthyInstructions(containerName: string): string {
    if (containerName === 'zigbee2mqtt') {
      return `1. Vérifiez les logs: docker logs zigbee2mqtt
2. Vérifiez la connexion au broker MQTT (Mosquitto)
3. Vérifiez que le coordinateur Zigbee est correctement connecté
4. Redémarrez si nécessaire: docker restart zigbee2mqtt`;
    } else if (containerName === 'lumy-mosquitto') {
      return `1. Vérifiez les logs: docker logs lumy-mosquitto
2. Vérifiez la configuration MQTT dans data/mosquitto/config/mosquitto.conf
3. Vérifiez les permissions des volumes
4. Redémarrez si nécessaire: docker restart lumy-mosquitto`;
    }
    return `1. Vérifiez les logs: docker logs ${containerName}
2. Vérifiez la configuration du container
3. Redémarrez si nécessaire: docker restart ${containerName}`;
  }
}

