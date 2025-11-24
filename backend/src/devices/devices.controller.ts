import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { UpdateFriendlyNameDto } from './dto/update-friendly-name.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { SendCommandDto } from './dto/send-command.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async findAll() {
    return this.devicesService.findAll();
  }

  @Get('stats')
  async getStats() {
    return this.devicesService.getDeviceStats();
  }

  @Get('type/:type')
  async findByType(@Param('type') type: string) {
    return this.devicesService.findByType(type);
  }

  @Get(':ieeeAddress')
  async findOne(@Param('ieeeAddress') ieeeAddress: string) {
    return this.devicesService.findOne(ieeeAddress);
  }

  @Put(':ieeeAddress/friendly-name')
  async updateFriendlyName(
    @Param('ieeeAddress') ieeeAddress: string,
    @Body() dto: UpdateFriendlyNameDto,
  ) {
    return this.devicesService.updateFriendlyName(ieeeAddress, dto.friendlyName);
  }

  @Put(':ieeeAddress/room')
  async updateRoom(
    @Param('ieeeAddress') ieeeAddress: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.devicesService.updateRoom(ieeeAddress, dto.room);
  }

  @Post(':ieeeAddress/command')
  @HttpCode(HttpStatus.OK)
  async sendCommand(
    @Param('ieeeAddress') ieeeAddress: string,
    @Body() dto: SendCommandDto,
  ) {
    await this.devicesService.sendCommand(ieeeAddress, dto.command);
    return { success: true, message: 'Commande envoyée avec succès' };
  }

  @Post('discovery/start')
  @HttpCode(HttpStatus.OK)
  async startDiscovery(@Body() body?: { duration?: number }) {
    const duration = body?.duration || 254; // 254 secondes par défaut (maximum Zigbee2MQTT)
    await this.devicesService.startDeviceDiscovery(duration);
    return {
      success: true,
      message: `Détection d'appareils activée pour ${duration} secondes (${Math.round(duration / 60)} minutes)`,
      duration,
    };
  }

  @Post('discovery/stop')
  @HttpCode(HttpStatus.OK)
  async stopDiscovery() {
    await this.devicesService.stopDeviceDiscovery();
    return {
      success: true,
      message: 'Détection d\'appareils désactivée',
    };
  }
}

