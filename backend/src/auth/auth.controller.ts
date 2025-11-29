import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Enregistre un nouvel utilisateur
   */
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  /**
   * Authentifie un utilisateur
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  /**
   * Récupère le profil de l'utilisateur actuel
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  /**
   * Vérifie si le mode local est disponible
   */
  @Public()
  @Get('local-mode')
  async checkLocalMode() {
    const canUseLocal = await this.authService.canUseLocalMode();
    return {
      available: canUseLocal,
      message: canUseLocal
        ? 'Le mode local est disponible. Vous pouvez utiliser l\'application sans compte.'
        : 'Le mode local n\'est pas disponible. Veuillez créer un compte.',
    };
  }
}

