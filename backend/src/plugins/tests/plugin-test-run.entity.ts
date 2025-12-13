import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Plugin } from '../entities/plugin.entity';
import { PluginTest } from './plugin-test.entity';

export enum TestRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  PARTIAL = 'partial', // Certains tests ont échoué
  ERROR = 'error',
}

@Entity('plugin_test_runs')
@Index(['pluginId', 'createdAt'])
export class PluginTestRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string;

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({
    type: 'varchar',
    length: 20,
    enum: TestRunStatus,
    default: TestRunStatus.PENDING,
  })
  status: TestRunStatus;

  @Column({ type: 'int', default: 0 })
  totalTests: number; // Nombre total de tests

  @Column({ type: 'int', default: 0 })
  passedTests: number; // Nombre de tests réussis

  @Column({ type: 'int', default: 0 })
  failedTests: number; // Nombre de tests échoués

  @Column({ type: 'int', default: 0 })
  skippedTests: number; // Nombre de tests ignorés

  @Column({ type: 'int', nullable: true })
  duration: number; // Durée totale en millisecondes

  @Column({ type: 'text', nullable: true })
  errorMessage: string; // Message d'erreur global

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées (environnement, version, etc.)

  @OneToMany(() => PluginTest, (test) => test.testRun, { cascade: true })
  tests: PluginTest[];

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;
}

