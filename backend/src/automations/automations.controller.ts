import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  async findAll() {
    return this.automationsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.automationsService.findOne(id);
  }

  @Post()
  async create(@Body() createDto: CreateAutomationDto) {
    return this.automationsService.create(createDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateAutomationDto) {
    return this.automationsService.update(id, updateDto);
  }

  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleStatus(@Param('id') id: string) {
    return this.automationsService.toggleStatus(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.automationsService.remove(id);
  }

  @Get(':id/logs')
  async getExecutionLogs(@Param('id') id: string) {
    return this.automationsService.getExecutionLogs(id);
  }
}

