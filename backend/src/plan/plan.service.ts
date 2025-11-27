import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { SavePlanDto } from './dto/save-plan.dto';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
    private logger: LoggerService,
  ) {}

  /**
   * Sauvegarde ou met à jour le plan
   */
  async savePlan(dto: SavePlanDto): Promise<Plan> {
    // Il n'y a qu'un seul plan pour l'instant
    const existingPlan = await this.planRepository.findOne({
      order: { updatedAt: 'DESC' },
    });

    if (existingPlan) {
      // Mettre à jour le plan existant
      existingPlan.rooms = dto.rooms;
      existingPlan.devicePositions = dto.devicePositions;
      const saved = await this.planRepository.save(existingPlan);
      this.logger.log(
        `Plan mis à jour: ${dto.rooms.length} pièces, ${dto.devicePositions.length} positions d'équipements`,
        'PlanService',
      );
      return saved;
    } else {
      // Créer un nouveau plan
      const newPlan = this.planRepository.create({
        rooms: dto.rooms,
        devicePositions: dto.devicePositions,
      });
      const saved = await this.planRepository.save(newPlan);
      this.logger.log(
        `Plan créé: ${dto.rooms.length} pièces, ${dto.devicePositions.length} positions d'équipements`,
        'PlanService',
      );
      return saved;
    }
  }

  /**
   * Récupère le plan actuel
   */
  async getPlan(): Promise<Plan | null> {
    const plan = await this.planRepository.findOne({
      order: { updatedAt: 'DESC' },
    });
    return plan;
  }
}

