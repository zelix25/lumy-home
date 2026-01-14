import { Controller, Get, Post, Body } from '@nestjs/common';
import { SetupService } from './setup.service';
import { Public } from '../auth/decorators/public.decorator';
import { ConfigureZigbeeDto } from './dto/configure-zigbee.dto';

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  /**
   * Liste les périphériques USB disponibles
   */
  @Public()
  @Get('usb-devices')
  async getUsbDevices(): Promise<{ devices: string[] }> {
    return this.setupService.getUsbDevices();
  }

  /**
   * Configure le coordinateur Zigbee (port USB et type)
   */
  @Public()
  @Post('configure-zigbee')
  async configureZigbee(@Body() dto: ConfigureZigbeeDto): Promise<{ success: boolean; message: string }> {
    return this.setupService.configureZigbee(dto);
  }
}

