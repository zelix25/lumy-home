import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Plugin } from './plugin.entity';

export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  FUNCTIONAL = 'functional',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
}

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('plugin_tests')
@Index(['pluginId'])
@Index(['type'])
@Index(['pluginId', 'name'], { unique: true })
export class PluginTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string; // ID du plugin propriétaire

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 255 })
  name: string; // Nom unique du test

  @Column({ type: 'varchar', length: 255 })
  displayName: string; // Nom d'affichage

  @Column({ type: 'text', nullable: true })
  description: string | null; // Description du test

  @Column({
    type: 'varchar',
    length: 50,
    enum: TestType,
  })
  type: TestType; // Type de test

  @Column({ type: 'varchar', length: 500, nullable: true })
  testPath: string | null; // Chemin vers le fichier de test

  @Column({ type: 'varchar', length: 500, nullable: true })
  testCommand: string | null; // Commande pour exécuter le test

  @Column({ type: 'json', nullable: true })
  testConfig: Record<string, any> | null; // Configuration du test

  @Column({ type: 'boolean', default: true })
  enabled: boolean; // Si le test est activé

  @Column({ type: 'boolean', default: false })
  required: boolean; // Si le test est requis pour la publication

  @Column({ type: 'int', default: 0 })
  timeout: number; // Timeout en secondes (0 = pas de timeout)

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires

  @OneToMany('PluginTestRun', 'test')
  testRuns: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

