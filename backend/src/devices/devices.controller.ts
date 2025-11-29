import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  Post,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { UpdateFriendlyNameDto } from './dto/update-friendly-name.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { SendCommandDto } from './dto/send-command.dto';
import { SendMqttMessageDto } from './dto/send-mqtt-message.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('devices')
@Public()
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

  @Post('refresh-states')
  @HttpCode(HttpStatus.OK)
  async refreshStates() {
    await this.devicesService.refreshDeviceStates();
    return {
      success: true,
      message: 'Rafraîchissement des états des appareils demandé',
    };
  }

  @Post('force-read/:ieeeAddress')
  @HttpCode(HttpStatus.OK)
  async forceReadDevice(@Param('ieeeAddress') ieeeAddress: string) {
    await this.devicesService.forceReadDeviceState(ieeeAddress);
    return {
      success: true,
      message: 'Lecture forcée de l\'appareil demandée',
    };
  }

  @Post('force-read-all')
  @HttpCode(HttpStatus.OK)
  async forceReadAllDevices() {
    await this.devicesService.forceReadAllDeviceStates();
    return {
      success: true,
      message: 'Lecture forcée de tous les appareils demandée',
    };
  }

  @Post('mqtt/send')
  @HttpCode(HttpStatus.OK)
  async sendMqttMessage(@Body() dto: SendMqttMessageDto) {
    await this.devicesService.sendMqttMessage(dto.topic, dto.payload || dto.payloadString);
    return {
      success: true,
      message: `Message MQTT envoyé sur ${dto.topic}`,
    };
  }

  @Get('mqtt/status')
  async getMqttStatus() {
    return this.devicesService.getMqttStatus();
  }

  @Post('mqtt/reconnect')
  @HttpCode(HttpStatus.OK)
  async reconnectMqtt() {
    await this.devicesService.reconnectMqtt();
    return {
      success: true,
      message: 'Réabonnement aux topics MQTT demandé',
    };
  }

  @Delete(':ieeeAddress')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('ieeeAddress') ieeeAddress: string) {
    await this.devicesService.remove(ieeeAddress);
  }
}

