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
    private readonly planRepository: Repository<Plan>,
    private readonly logger: LoggerService,
  ) {}

  async savePlan(dto: SavePlanDto): Promise<Plan> {
    const [existingPlan] = await this.planRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    if (existingPlan) {
      existingPlan.floors = dto.floors || existingPlan.floors || [];
      existingPlan.rooms = dto.rooms;
      existingPlan.devicePositions = dto.devicePositions;
      const saved = await this.planRepository.save(existingPlan);
      this.logger.log(
        `Plan mis à jour: ${(existingPlan.floors || []).length} étages, ${dto.rooms.length} pièces, ${dto.devicePositions.length} positions d'équipements`,
        'PlanService',
      );
      return saved;
    }

    const newPlan = this.planRepository.create({
      floors: dto.floors || [],
      rooms: dto.rooms,
      devicePositions: dto.devicePositions,
    });
    const saved = await this.planRepository.save(newPlan);
    this.logger.log(
      `Plan créé: ${dto.floors?.length || 0} étages, ${dto.rooms.length} pièces, ${dto.devicePositions.length} positions d'équipements`,
      'PlanService',
    );
    return saved;
  }

  async getPlan(): Promise<Plan | null> {
    const [plan] = await this.planRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    if (plan && !plan.floors) {
      plan.floors = [];
    }
    return plan || null;
  }

  async deleteAllPlans(): Promise<void> {
    await this.planRepository.clear();
    this.logger.log('Tous les plans ont été supprimés', 'PlanService');
  }
}

