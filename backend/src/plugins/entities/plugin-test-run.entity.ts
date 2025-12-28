import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { PluginTest, TestStatus } from './plugin-test.entity';

@Entity('plugin_test_runs')
@Index(['testId'])
@Index(['status'])
@Index(['startedAt'])
@Index(['testId', 'startedAt'])
export class PluginTestRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  testId: string; // ID du test

  @ManyToOne(() => PluginTest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'testId' })
  test: PluginTest;

  @Column({
    type: 'varchar',
    length: 50,
    enum: TestStatus,
    default: TestStatus.PENDING,
  })
  status: TestStatus; // Statut de l'exécution

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null; // Date de début d'exécution

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null; // Date de fin d'exécution

  @Column({ type: 'int', nullable: true })
  duration: number | null; // Durée en millisecondes

  @Column({ type: 'text', nullable: true })
  output: string | null; // Sortie du test (stdout/stderr)

  @Column({ type: 'text', nullable: true })
  error: string | null; // Message d'erreur si échec

  @Column({ type: 'json', nullable: true })
  results: Record<string, any> | null; // Résultats détaillés (assertions, métriques, etc.)

  @Column({ type: 'int', default: 0 })
  assertionsPassed: number; // Nombre d'assertions réussies

  @Column({ type: 'int', default: 0 })
  assertionsFailed: number; // Nombre d'assertions échouées

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires

  @CreateDateColumn()
  createdAt: Date;
}

