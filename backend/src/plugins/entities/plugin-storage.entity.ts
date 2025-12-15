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

@Entity('plugin_storage')
@Index(['pluginId'])
@Index(['pluginId', 'key'], { unique: true })
@Index(['expiresAt'])
export class PluginStorage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string; // ID du plugin propriétaire

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 255 })
  key: string; // Clé unique pour ce plugin

  @Column({ type: 'text' })
  value: string; // Valeur stockée (JSON stringifié)

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string | null; // Type de la valeur (string, number, boolean, object, array)

  @Column({ type: 'int', nullable: true })
  size: number | null; // Taille en octets de la valeur

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null; // Date d'expiration (null = pas d'expiration)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

