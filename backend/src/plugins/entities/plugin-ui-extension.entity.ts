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

export enum UIExtensionType {
  PAGE = 'page',
  COMPONENT = 'component',
  WIDGET = 'widget',
  MENU_ITEM = 'menu_item',
}

@Entity('plugin_ui_extensions')
@Index(['pluginId'])
@Index(['type'])
@Index(['pluginId', 'name'], { unique: true })
export class PluginUIExtension {
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
    enum: UIExtensionType,
  })
  type: UIExtensionType; // Type d'extension (page, component, widget, menu_item)

  @Column({ type: 'varchar', length: 255 })
  name: string; // Nom unique de l'extension (slug)

  @Column({ type: 'varchar', length: 255 })
  displayName: string; // Nom d'affichage

  @Column({ type: 'text', nullable: true })
  description: string | null; // Description de l'extension

  @Column({ type: 'varchar', length: 500, nullable: true })
  route: string | null; // Route pour les pages (ex: /plugins/my-plugin/page1)

  @Column({ type: 'varchar', length: 500, nullable: true })
  componentPath: string | null; // Chemin vers le composant React (ex: ./components/MyComponent)

  @Column({ type: 'varchar', length: 500, nullable: true })
  icon: string | null; // Icône pour les éléments de menu

  @Column({ type: 'varchar', length: 500, nullable: true })
  menuPath: string | null; // Chemin dans le menu (ex: /plugins/my-plugin)

  @Column({ type: 'int', nullable: true })
  menuOrder: number | null; // Ordre d'affichage dans le menu

  @Column({ type: 'json', nullable: true })
  props: Record<string, any> | null; // Propriétés par défaut pour le composant

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires

  @Column({ type: 'boolean', default: true })
  enabled: boolean; // Si l'extension est activée

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

