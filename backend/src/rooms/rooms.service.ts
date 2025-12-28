import { Injectable, Logger, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';

// Les pièces par défaut sont triées par ordre alphabétique (à traduire avec i18n)
const DEFAULT_ROOMS = [
  'Sous-Sol',
  'Garage',
  'Buanderie',
  'Entrée',
  'Couloir',
  'Chambre',
  'Salle de Bain',
  'Salon',
  'Salle à manger',
  'Cuisine',
  'Toilette',
  'Séjour',
  'Veranda',
  'Bureau'
];

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultRooms();
  }

  private async initializeDefaultRooms() {
    try {
      const existingRooms = await this.roomRepository.find();
      const existingRoomNames = new Set(existingRooms.map((room) => room.name));

      const roomsToCreate = DEFAULT_ROOMS.filter(
        (roomName) => !existingRoomNames.has(roomName),
      );

      if (roomsToCreate.length > 0) {
        const newRooms = roomsToCreate.map((name) =>
          this.roomRepository.create({ name }),
        );
        await this.roomRepository.save(newRooms);
        this.logger.log(
          `🏠 ${newRooms.length} pièce(s) par défaut créée(s): ${roomsToCreate.join(', ')}`,
        );
      } else {
        this.logger.log('🏠 Toutes les pièces par défaut existent déjà');
      }
    } catch (error) {
      this.logger.error('Erreur lors de l\'initialisation des pièces par défaut:', error);
    }
  }

  async findAll(): Promise<Room[]> {
    return this.roomRepository.find({
      order: { name: 'ASC' },
    });
  }

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    // Vérifier si la pièce existe déjà
    const existingRoom = await this.roomRepository.findOne({
      where: { name: createRoomDto.name },
    });

    if (existingRoom) {
      throw new ConflictException(`La pièce "${createRoomDto.name}" existe déjà`);
    }

    const room = this.roomRepository.create(createRoomDto);
    const savedRoom = await this.roomRepository.save(room);
    this.logger.log(`🏠 Pièce créée: ${savedRoom.name}`);
    return savedRoom;
  }

  async findOneByName(name: string): Promise<Room | null> {
    return this.roomRepository.findOne({
      where: { name },
    });
  }
}

