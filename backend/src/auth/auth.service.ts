import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private logger: LoggerService,
  ) {}

  /**
   * Enregistre un nouvel utilisateur
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const enableLocalMode = this.configService.get<boolean>(
      'ENABLE_LOCAL_MODE',
      true,
    );

    // Vérifier si un utilisateur existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Vérifier si on peut créer un compte (si le mode local est désactivé et qu'il y a déjà un utilisateur)
    if (!enableLocalMode) {
      const userCount = await this.userRepository.count();
      if (userCount > 0) {
        throw new BadRequestException(
          'Le mode local est désactivé. Contactez un administrateur.',
        );
      }
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Créer l'utilisateur
    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      isLocalMode: enableLocalMode,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(
      `Nouvel utilisateur créé: ${savedUser.email}`,
      'AuthService',
    );

    // Générer le token JWT
    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        isLocalMode: savedUser.isLocalMode,
      },
    };
  }

  /**
   * Authentifie un utilisateur
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const access_token = this.jwtService.sign(payload);

    this.logger.log(`Utilisateur connecté: ${user.email}`, 'AuthService');

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        isLocalMode: user.isLocalMode,
      },
    };
  }

  /**
   * Valide un utilisateur avec email et mot de passe
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Récupère le profil de l'utilisateur actuel
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'isLocalMode', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return user;
  }

  /**
   * Vérifie si le mode local est activé et s'il n'y a pas encore d'utilisateur
   */
  async canUseLocalMode(): Promise<boolean> {
    const enableLocalMode = this.configService.get<boolean>(
      'ENABLE_LOCAL_MODE',
      true,
    );

    if (!enableLocalMode) {
      return false;
    }

    const userCount = await this.userRepository.count();
    return userCount === 0;
  }

  /**
   * Crée un utilisateur local automatique si le mode local est activé
   */
  async createLocalUserIfNeeded(): Promise<User | null> {
    const canUseLocal = await this.canUseLocalMode();

    if (!canUseLocal) {
      return null;
    }

    // Créer un utilisateur local automatique
    const localUser = this.userRepository.create({
      email: 'local@homehub.local',
      password: await bcrypt.hash('local', 10), // Mot de passe par défaut
      isLocalMode: true,
    });

    const savedUser = await this.userRepository.save(localUser);
    this.logger.log(
      'Utilisateur local créé automatiquement',
      'AuthService',
    );

    return savedUser;
  }
}

