import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { History, SensorType } from './entities/history.entity';
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
   * Enregistre une valeur de capteur dans l'historique
   */
  async logSensorValue(
    deviceId: string,
    sensorType: SensorType,
    value: number,
  ): Promise<History> {
    const history = this.historyRepository.create({
      deviceId,
      sensorType,
      value,
    });

    const saved = await this.historyRepository.save(history);
    this.logger.debug(
      `📊 Donnée capteur enregistrée: ${deviceId} - ${sensorType} = ${value}`,
      'HistoryService',
    );

    return saved;
  }

  /**
   * Enregistre plusieurs valeurs de capteurs en une seule transaction
   */
  async logSensorValues(
    deviceId: string,
    values: Array<{ sensorType: SensorType; value: number }>,
  ): Promise<History[]> {
    const histories = values.map((v) =>
      this.historyRepository.create({
        deviceId,
        sensorType: v.sensorType,
        value: v.value,
      }),
    );

    const saved = await this.historyRepository.save(histories);
    this.logger.debug(
      `📊 ${values.length} données capteurs enregistrées pour ${deviceId}`,
      'HistoryService',
    );

    return saved;
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
    const queryBuilder = this.historyRepository.createQueryBuilder('history');

    // Appliquer les filtres
    if (filters.deviceId) {
      queryBuilder.andWhere('history.deviceId = :deviceId', { deviceId: filters.deviceId });
    }

    if (filters.sensorType) {
      queryBuilder.andWhere('history.sensorType = :sensorType', { sensorType: filters.sensorType });
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

    // Compter le total (avant pagination)
    const total = await queryBuilder.getCount();

    // Appliquer pagination et tri
    const items = await queryBuilder
      .orderBy('history.timestamp', 'ASC') // Tri chronologique pour les graphiques
      .limit(filters.limit || 1000)
      .offset(filters.offset || 0)
      .getMany();

    return {
      items: items.map((item) => HistoryResponseDto.fromEntity(item)),
      total,
      limit: filters.limit || 1000,
      offset: filters.offset || 0,
    };
  }

  /**
   * Récupère les dernières valeurs pour un appareil et un type de capteur
   */
  async getLatestValue(
    deviceId: string,
    sensorType: SensorType,
  ): Promise<HistoryResponseDto | null> {
    const history = await this.historyRepository.findOne({
      where: { deviceId, sensorType },
      order: { timestamp: 'DESC' },
    });

    return history ? HistoryResponseDto.fromEntity(history) : null;
  }

  /**
   * Récupère les statistiques de l'historique
   */
  async getStats(): Promise<{
    total: number;
    bySensorType: Record<string, number>;
    byDevice: Record<string, number>;
    recentData: number; // Données des dernières 24h
  }> {
    const total = await this.historyRepository.count();

    // Compter par type de capteur
    const bySensorType: Record<string, number> = {};
    const sensorTypes = await this.historyRepository
      .createQueryBuilder('history')
      .select('history.sensorType', 'sensorType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('history.sensorType')
      .getRawMany();

    sensorTypes.forEach((item) => {
      bySensorType[item.sensorType] = parseInt(item.count, 10);
    });

    // Compter par appareil
    const byDevice: Record<string, number> = {};
    const devices = await this.historyRepository
      .createQueryBuilder('history')
      .select('history.deviceId', 'deviceId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('history.deviceId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    devices.forEach((item) => {
      byDevice[item.deviceId] = parseInt(item.count, 10);
    });

    // Compter les données des dernières 24h
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const recentData = await this.historyRepository.count({
      where: {
        timestamp: Between(yesterday, new Date()),
      },
    });

    return {
      total,
      bySensorType,
      byDevice,
      recentData,
    };
  }

  /**
   * Supprime les données plus anciennes qu'une date donnée
   */
  async cleanOldData(olderThan: Date): Promise<number> {
    const result = await this.historyRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :olderThan', { olderThan })
      .execute();

    return result.affected || 0;
  }
}


