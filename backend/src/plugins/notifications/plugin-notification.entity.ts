import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plugin } from '../entities/plugin.entity';

export enum NotificationLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  READ = 'read',
  ARCHIVED = 'archived',
}

@Entity('plugin_notifications')
export class PluginNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string;

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: NotificationLevel,
    default: NotificationLevel.INFO,
  })
  level: NotificationLevel;

  @Column({
    type: 'varchar',
    length: 20,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ type: 'json', nullable: true })
  actions: Array<{
    label: string;
    action: string;
    data?: Record<string, any>;
  }>;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées supplémentaires (icône, son, etc.)

  @Column({ type: 'int', default: 0 })
  priority: number; // Priorité (0 = normal, plus élevé = plus important)

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null; // Date d'expiration de la notification

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

