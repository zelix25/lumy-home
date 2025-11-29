import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { PlanService } from './plan.service';
import { SavePlanDto } from './dto/save-plan.dto';
import { Plan } from './entities/plan.entity';
import { Public } from '../auth/decorators/public.decorator';

@Controller('plan')
@Public()
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  /**
   * Récupère le plan actuel
   */
  @Get()
  async getPlan(): Promise<Plan | null> {
    return this.planService.getPlan();
  }

  /**
   * Sauvegarde le plan
   */
  @Post()
  async savePlan(@Body() dto: SavePlanDto): Promise<Plan> {
    return this.planService.savePlan(dto);
  }

  /**
   * Supprime tous les plans
   */
  @Delete()
  async deleteAllPlans(): Promise<{ message: string }> {
    await this.planService.deleteAllPlans();
    return { message: 'Tous les plans ont été supprimés' };
  }
}

