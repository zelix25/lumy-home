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
import { PluginTestRun } from './plugin-test-run.entity';

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ERROR = 'error',
}

export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  FUNCTIONAL = 'functional',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  COMPATIBILITY = 'compatibility',
}

export enum TestSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Entity('plugin_tests')
@Index(['pluginId', 'createdAt'])
export class PluginTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string;

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 36, nullable: true })
  testRunId: string;

  @ManyToOne(() => PluginTestRun, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'testRunId' })
  testRun: PluginTestRun;

  @Column({ type: 'varchar', length: 255 })
  name: string; // Nom du test

  @Column({ type: 'text', nullable: true })
  description: string; // Description du test

  @Column({
    type: 'varchar',
    length: 50,
    enum: TestType,
    default: TestType.FUNCTIONAL,
  })
  type: TestType;

  @Column({
    type: 'varchar',
    length: 20,
    enum: TestStatus,
    default: TestStatus.PENDING,
  })
  status: TestStatus;

  @Column({
    type: 'varchar',
    length: 20,
    enum: TestSeverity,
    default: TestSeverity.MEDIUM,
  })
  severity: TestSeverity;

  @Column({ type: 'text', nullable: true })
  errorMessage: string; // Message d'erreur si le test échoue

  @Column({ type: 'text', nullable: true })
  stackTrace: string; // Stack trace en cas d'erreur

  @Column({ type: 'int', nullable: true })
  duration: number; // Durée d'exécution en millisecondes

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées (assertions, résultats, etc.)

  @Column({ type: 'json', nullable: true })
  expectedResult: Record<string, any>; // Résultat attendu

  @Column({ type: 'json', nullable: true })
  actualResult: Record<string, any>; // Résultat réel

  @Column({ type: 'boolean', default: false })
  required: boolean; // Si le test est requis pour la publication

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  executedAt: Date | null;
}

