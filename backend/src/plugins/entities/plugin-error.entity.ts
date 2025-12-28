import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Plugin } from './plugin.entity';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

@Entity('plugin_errors')
@Index(['pluginId'])
@Index(['severity'])
@Index(['status'])
@Index(['createdAt'])
@Index(['pluginId', 'createdAt'])
export class PluginError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string; // ID du plugin qui a généré l'erreur

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 255 })
  errorType: string; // Type d'erreur (ex: TypeError, ReferenceError, etc.)

  @Column({ type: 'text' })
  message: string; // Message d'erreur

  @Column({ type: 'text', nullable: true })
  stack: string | null; // Stack trace

  @Column({ type: 'text', nullable: true })
  context: string | null; // Contexte de l'erreur (fonction, hook, etc.)

  @Column({
    type: 'varchar',
    length: 50,
    enum: ErrorSeverity,
    default: ErrorSeverity.MEDIUM,
  })
  severity: ErrorSeverity; // Sévérité de l'erreur

  @Column({
    type: 'varchar',
    length: 50,
    enum: ErrorStatus,
    default: ErrorStatus.NEW,
  })
  status: ErrorStatus; // Statut de l'erreur

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires

  @Column({ type: 'int', default: 1 })
  occurrenceCount: number; // Nombre d'occurrences de cette erreur

  @Column({ type: 'datetime', nullable: true })
  lastOccurredAt: Date | null; // Date de la dernière occurrence

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null; // Date de résolution

  @CreateDateColumn()
  createdAt: Date;
}

