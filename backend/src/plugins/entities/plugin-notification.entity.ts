import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Plugin } from './plugin.entity';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  READ = 'read',
  EXPIRED = 'expired',
}

@Entity('plugin_notifications')
@Index(['pluginId'])
@Index(['status'])
@Index(['userId'])
@Index(['createdAt'])
export class PluginNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string; // ID du plugin qui a envoyé la notification

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null; // ID de l'utilisateur destinataire (null = tous les utilisateurs)

  @Column({ type: 'varchar', length: 255 })
  title: string; // Titre de la notification

  @Column({ type: 'text' })
  message: string; // Message de la notification

  @Column({
    type: 'varchar',
    length: 50,
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType; // Type de notification (info, success, warning, error)

  @Column({
    type: 'varchar',
    length: 50,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus; // Statut de la notification

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires (actions, liens, etc.)

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null; // Date d'expiration de la notification

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null; // Date de lecture de la notification

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

