import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoreAuthService } from './store-auth.service';
import { ConnectStoreDto } from './dto/connect-store.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('store/auth')
@UseGuards(JwtAuthGuard)
export class StoreAuthController {
  constructor(private readonly storeAuthService: StoreAuthService) {}

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connectStore(
    @CurrentUser() user: { id: string; email: string },
    @Body() connectDto: ConnectStoreDto,
  ) {
    return this.storeAuthService.connectStore(user.id, connectDto);
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectStore(@CurrentUser() user: { id: string; email: string }) {
    return this.storeAuthService.disconnectStore(user.id);
  }

  @Get('status')
  async getConnectionStatus(@CurrentUser() user: { id: string; email: string }) {
    const isConnected = await this.storeAuthService.isConnectedToStore(
      user.id,
    );
    const apiToken = await this.storeAuthService.getStoreApiToken(user.id);
    return {
      connected: isConnected,
      storeEmail: apiToken ? 'connected' : undefined, // Optionnel: on pourrait récupérer l'email du store
    };
  }
}

