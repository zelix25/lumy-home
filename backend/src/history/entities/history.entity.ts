import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum HistoryEventType {
  MOTION_DETECTED = 'motion_detected',
  STATE_CHANGED = 'state_changed',
  AUTOMATION_EXECUTED = 'automation_executed',
  DEVICE_ONLINE = 'device_online',
  DEVICE_OFFLINE = 'device_offline',
  DEVICE_DISCOVERED = 'device_discovered',
  BUTTON_PRESSED = 'button_pressed',
  CONTACT_CHANGED = 'contact_changed',
  TEMPERATURE_CHANGED = 'temperature_changed',
}

@Entity('history')
@Index(['eventType', 'timestamp'])
@Index(['deviceId', 'timestamp'])
@Index(['automationId', 'timestamp'])
export class History {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  eventType: HistoryEventType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceId: string; // IEEE address du device concerné

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceName: string; // Nom friendly du device

  @Column({ type: 'varchar', length: 255, nullable: true })
  automationId: string; // ID de l'automatisation si applicable

  @Column({ type: 'varchar', length: 255, nullable: true })
  automationName: string; // Nom de l'automatisation

  @Column({ type: 'text', nullable: true })
  description: string; // Description lisible de l'événement

  @Column({ type: 'json', nullable: true })
  data: Record<string, any>; // Données supplémentaires (ancien état, nouveau état, etc.)

  @Column({ type: 'varchar', length: 100, nullable: true })
  room: string; // Pièce où l'événement s'est produit

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}

