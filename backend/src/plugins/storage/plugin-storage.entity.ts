import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Plugin } from '../entities/plugin.entity';

@Entity('plugin_storage')
@Index(['pluginId', 'key'], { unique: true })
export class PluginStorage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string;

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 255 })
  key: string; // Clé unique pour ce plugin

  @Column({ type: 'text', nullable: true })
  value: string; // Valeur (peut être JSON stringifié)

  @Column({ type: 'varchar', length: 50, default: 'string' })
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'; // Type de la valeur

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées (tags, description, etc.)

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null; // Date d'expiration (pour cache temporaire)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

