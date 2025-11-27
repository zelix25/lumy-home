import { Controller, Get, Post, Body } from '@nestjs/common';
import { PlanService } from './plan.service';
import { SavePlanDto } from './dto/save-plan.dto';
import { Plan } from './entities/plan.entity';

@Controller('plan')
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
}

