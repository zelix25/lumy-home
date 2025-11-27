import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { History, HistoryEventType } from './entities/history.entity';
import { HistoryResponseDto } from './dto/history-response.dto';
import { FilterHistoryDto } from './dto/filter-history.dto';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(History)
    private historyRepository: Repository<History>,
    private logger: LoggerService,
  ) {}

  /**
   * Enregistre un événement dans l'historique
   */
  async logEvent(
    eventType: HistoryEventType,
    options: {
      deviceId?: string;
      deviceName?: string;
      automationId?: string;
      automationName?: string;
      description: string;
      data?: Record<string, any>;
      room?: string;
    },
  ): Promise<History> {
    const history = this.historyRepository.create({
      eventType,
      deviceId: options.deviceId,
      deviceName: options.deviceName,
      automationId: options.automationId,
      automationName: options.automationName,
      description: options.description,
      data: options.data,
      room: options.room,
    });

    const saved = await this.historyRepository.save(history);
    this.logger.log(
      `📝 Événement enregistré: ${eventType} - ${options.description}`,
      'HistoryService',
    );

    return saved;
  }

  /**
   * Enregistre une détection de mouvement
   */
  async logMotionDetected(
    deviceId: string,
    deviceName: string,
    room?: string,
    data?: Record<string, any>,
  ): Promise<History> {
    return this.logEvent(HistoryEventType.MOTION_DETECTED, {
      deviceId,
      deviceName,
      description: `Mouvement détecté${deviceName ? ` par ${deviceName}` : ''}`,
      data,
      room,
    });
  }

  /**
   * Enregistre un changement d'état d'appareil
   */
  async logStateChanged(
    deviceId: string,
    deviceName: string,
    oldState: Record<string, any>,
    newState: Record<string, any>,
    room?: string,
  ): Promise<History> {
    // Détecter les changements significatifs
    const changes: string[] = [];
    
    if (oldState.state !== newState.state) {
      changes.push(`État: ${oldState.state || 'inconnu'} → ${newState.state || 'inconnu'}`);
    }
    
    if (oldState.brightness !== newState.brightness && newState.brightness !== undefined) {
      changes.push(`Luminosité: ${Math.round((newState.brightness / 255) * 100)}%`);
    }
    
    if (oldState.temperature !== newState.temperature && newState.temperature !== undefined) {
      changes.push(`Température: ${newState.temperature}°C`);
    }
    
    if (oldState.contact !== newState.contact && newState.contact !== undefined) {
      changes.push(`Contact: ${newState.contact ? 'Fermé' : 'Ouvert'}`);
    }

    const description = changes.length > 0
      ? `${deviceName}: ${changes.join(', ')}`
      : `Changement d'état pour ${deviceName}`;

    return this.logEvent(HistoryEventType.STATE_CHANGED, {
      deviceId,
      deviceName,
      description,
      data: {
        oldState,
        newState,
        changes,
      },
      room,
    });
  }

  /**
   * Enregistre l'exécution d'une automatisation
   */
  async logAutomationExecuted(
    automationId: string,
    automationName: string,
    success: boolean,
    message?: string,
    triggeredBy?: {
      deviceId?: string;
      deviceName?: string;
      eventType?: string;
    },
  ): Promise<History> {
    const description = success
      ? `Automatisation "${automationName}" exécutée avec succès`
      : `Échec de l'automatisation "${automationName}"`;

    return this.logEvent(HistoryEventType.AUTOMATION_EXECUTED, {
      automationId,
      automationName,
      description: message || description,
      data: {
        success,
        triggeredBy,
      },
    });
  }

  /**
   * Enregistre un appareil qui passe en ligne
   */
  async logDeviceOnline(
    deviceId: string,
    deviceName: string,
    room?: string,
  ): Promise<History> {
    return this.logEvent(HistoryEventType.DEVICE_ONLINE, {
      deviceId,
      deviceName,
      description: `${deviceName} est maintenant en ligne`,
      room,
    });
  }

  /**
   * Enregistre un appareil qui passe hors ligne
   */
  async logDeviceOffline(
    deviceId: string,
    deviceName: string,
    room?: string,
  ): Promise<History> {
    return this.logEvent(HistoryEventType.DEVICE_OFFLINE, {
      deviceId,
      deviceName,
      description: `${deviceName} est maintenant hors ligne`,
      room,
    });
  }

  /**
   * Enregistre la découverte d'un nouvel appareil
   */
  async logDeviceDiscovered(
    deviceId: string,
    deviceName: string,
    deviceType: string,
    room?: string,
  ): Promise<History> {
    return this.logEvent(HistoryEventType.DEVICE_DISCOVERED, {
      deviceId,
      deviceName,
      description: `Nouvel appareil découvert: ${deviceName} (${deviceType})`,
      data: {
        deviceType,
      },
      room,
    });
  }

  /**
   * Enregistre un appui sur un bouton
   */
  async logButtonPressed(
    deviceId: string,
    deviceName: string,
    action: string,
    room?: string,
  ): Promise<History> {
    return this.logEvent(HistoryEventType.BUTTON_PRESSED, {
      deviceId,
      deviceName,
      description: `Bouton "${deviceName}" pressé: ${action}`,
      data: {
        action,
      },
      room,
    });
  }

  /**
   * Enregistre un changement de contact (porte/fenêtre)
   */
  async logContactChanged(
    deviceId: string,
    deviceName: string,
    isOpen: boolean,
    room?: string,
  ): Promise<History> {
    return this.logEvent(HistoryEventType.CONTACT_CHANGED, {
      deviceId,
      deviceName,
      description: `${deviceName}: ${isOpen ? 'Ouvert' : 'Fermé'}`,
      data: {
        isOpen,
      },
      room,
    });
  }

  /**
   * Enregistre un changement de température significatif
   */
  async logTemperatureChanged(
    deviceId: string,
    deviceName: string,
    temperature: number,
    room?: string,
  ): Promise<History> {
    return this.logEvent(HistoryEventType.TEMPERATURE_CHANGED, {
      deviceId,
      deviceName,
      description: `${deviceName}: ${temperature}°C`,
      data: {
        temperature,
      },
      room,
    });
  }

  /**
   * Récupère l'historique avec filtres
   */
  async findAll(filters: FilterHistoryDto): Promise<{
    items: HistoryResponseDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const where: FindOptionsWhere<History> = {};

    if (filters.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters.deviceId) {
      where.deviceId = filters.deviceId;
    }

    if (filters.automationId) {
      where.automationId = filters.automationId;
    }

    if (filters.room) {
      where.room = filters.room;
    }

    const queryBuilder = this.historyRepository.createQueryBuilder('history');

    if (Object.keys(where).length > 0) {
      queryBuilder.where(where);
    }

    if (filters.startDate || filters.endDate) {
      if (filters.startDate && filters.endDate) {
        queryBuilder.andWhere('history.timestamp BETWEEN :startDate AND :endDate', {
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
      } else if (filters.startDate) {
        queryBuilder.andWhere('history.timestamp >= :startDate', {
          startDate: filters.startDate,
        });
      } else if (filters.endDate) {
        queryBuilder.andWhere('history.timestamp <= :endDate', {
          endDate: filters.endDate,
        });
      }
    }

    // Compter le total
    const total = await queryBuilder.getCount();

    // Appliquer pagination et tri
    const items = await queryBuilder
      .orderBy('history.timestamp', 'DESC')
      .limit(filters.limit || 50)
      .offset(filters.offset || 0)
      .getMany();

    return {
      items: items.map((item) => HistoryResponseDto.fromEntity(item)),
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    };
  }

  /**
   * Récupère les statistiques de l'historique
   */
  async getStats(): Promise<{
    total: number;
    byEventType: Record<string, number>;
    byDevice: Record<string, number>;
    recentActivity: number; // Événements des dernières 24h
  }> {
    const total = await this.historyRepository.count();

    // Compter par type d'événement
    const byEventType: Record<string, number> = {};
    const eventTypes = await this.historyRepository
      .createQueryBuilder('history')
      .select('history.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('history.eventType')
      .getRawMany();

    eventTypes.forEach((item) => {
      byEventType[item.eventType] = parseInt(item.count, 10);
    });

    // Compter par appareil
    const byDevice: Record<string, number> = {};
    const devices = await this.historyRepository
      .createQueryBuilder('history')
      .select('history.deviceName', 'deviceName')
      .addSelect('COUNT(*)', 'count')
      .where('history.deviceName IS NOT NULL')
      .groupBy('history.deviceName')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    devices.forEach((item) => {
      byDevice[item.deviceName] = parseInt(item.count, 10);
    });

    // Compter les événements des dernières 24h
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const recentActivity = await this.historyRepository.count({
      where: {
        timestamp: Between(yesterday, new Date()),
      },
    });

    return {
      total,
      byEventType,
      byDevice,
      recentActivity,
    };
  }

  /**
   * Supprime les événements plus anciens qu'une date donnée
   */
  async cleanOldEvents(olderThan: Date): Promise<number> {
    const result = await this.historyRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :olderThan', { olderThan })
      .execute();

    return result.affected || 0;
  }
}

