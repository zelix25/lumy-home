import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plugin } from '../entities/plugin.entity';

export enum ExtensionType {
  TRIGGER = 'trigger',
  ACTION = 'action',
}

@Entity('plugin_automation_extensions')
export class PluginAutomationExtension {
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
    enum: ExtensionType,
  })
  type: ExtensionType;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string; // Nom unique de l'extension (ex: "custom_weather_trigger")

  @Column({ type: 'varchar', length: 255 })
  displayName: string; // Nom d'affichage (ex: "Condition météo")

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json' })
  configSchema: any; // Schéma JSON Schema pour la configuration

  @Column({ type: 'varchar', length: 255, nullable: true })
  handlerPath: string; // Chemin vers le handler (ex: "handlers/weather-trigger.js")

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées supplémentaires (icône, catégorie, etc.)

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

