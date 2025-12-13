import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Plugin } from '../entities/plugin.entity';

export enum AnalyticsEventType {
  INSTALL = 'install',
  UNINSTALL = 'uninstall',
  ENABLE = 'enable',
  DISABLE = 'disable',
  USAGE = 'usage',
  ERROR = 'error',
  HOOK_EXECUTION = 'hook_execution',
  ACTION_EXECUTION = 'action_execution',
}

@Entity('plugin_analytics')
@Index(['pluginId', 'eventType', 'createdAt'])
@Index(['pluginId', 'createdAt'])
export class PluginAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string;

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({
    type: 'varchar',
    length: 50,
    enum: AnalyticsEventType,
  })
  eventType: AnalyticsEventType;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string; // ID de l'utilisateur (si disponible)

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées de l'événement (durée, taille, etc.)

  @Column({ type: 'int', nullable: true })
  duration: number; // Durée en millisecondes (pour les événements d'exécution)

  @Column({ type: 'boolean', default: true })
  success: boolean; // Si l'événement a réussi

  @CreateDateColumn()
  createdAt: Date;
}


