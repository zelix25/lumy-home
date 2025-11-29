import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
@Public()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): { message: string; version: string } {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }
}

