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

export enum AutomationExtensionType {
  TRIGGER = 'trigger',
  CONDITION = 'condition',
  ACTION = 'action',
}

@Entity('plugin_automation_extensions')
@Index(['pluginId'])
@Index(['type'])
@Index(['pluginId', 'name'], { unique: true })
export class PluginAutomationExtension {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string; // ID du plugin propriétaire

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({
    type: 'varchar',
    length: 50,
    enum: AutomationExtensionType,
  })
  type: AutomationExtensionType; // Type d'extension (trigger, condition, action)

  @Column({ type: 'varchar', length: 255 })
  name: string; // Nom unique de l'extension (slug)

  @Column({ type: 'varchar', length: 255 })
  displayName: string; // Nom d'affichage

  @Column({ type: 'text', nullable: true })
  description: string | null; // Description de l'extension

  @Column({ type: 'varchar', length: 500, nullable: true })
  handlerPath: string | null; // Chemin vers le handler (ex: ./handlers/myTrigger.js)

  @Column({ type: 'json', nullable: true })
  configSchema: Record<string, any> | null; // Schéma JSON Schema pour la configuration

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires

  @Column({ type: 'boolean', default: true })
  enabled: boolean; // Si l'extension est activée

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

