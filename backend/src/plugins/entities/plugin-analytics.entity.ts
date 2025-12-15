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

export enum AnalyticsEventType {
  INSTALL = 'install',
  UNINSTALL = 'uninstall',
  ENABLE = 'enable',
  DISABLE = 'disable',
  ERROR = 'error',
  HOOK_EXECUTED = 'hook_executed',
  NOTIFICATION_SENT = 'notification_sent',
  STORAGE_ACCESS = 'storage_access',
  API_CALL = 'api_call',
}

@Entity('plugin_analytics')
@Index(['pluginId'])
@Index(['eventType'])
@Index(['timestamp'])
@Index(['pluginId', 'timestamp'])
export class PluginAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string; // ID du plugin

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({
    type: 'varchar',
    length: 50,
    enum: AnalyticsEventType,
  })
  eventType: AnalyticsEventType; // Type d'événement

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null; // ID de l'utilisateur (si applicable)

  @Column({ type: 'datetime' })
  timestamp: Date; // Date et heure de l'événement

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires (durée, taille, etc.)

  @Column({ type: 'varchar', length: 255, nullable: true })
  context: string | null; // Contexte de l'événement (hook name, API endpoint, etc.)

  @CreateDateColumn()
  createdAt: Date;
}

