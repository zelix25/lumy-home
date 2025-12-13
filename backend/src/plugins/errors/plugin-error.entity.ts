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

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorType {
  RUNTIME = 'runtime',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  MEMORY = 'memory',
  UNKNOWN = 'unknown',
}

@Entity('plugin_errors')
@Index(['pluginId', 'createdAt'])
export class PluginError {
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
    enum: ErrorType,
    default: ErrorType.UNKNOWN,
  })
  type: ErrorType;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ErrorSeverity,
    default: ErrorSeverity.MEDIUM,
  })
  severity: ErrorSeverity;

  @Column({ type: 'varchar', length: 255 })
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string; // Stack trace

  @Column({ type: 'text', nullable: true })
  context: string; // Contexte de l'erreur (hook, action, etc.)

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées supplémentaires

  @Column({ type: 'boolean', default: false })
  resolved: boolean; // Si l'erreur a été résolue

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}


