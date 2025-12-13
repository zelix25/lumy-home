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

export enum UIExtensionType {
  PAGE = 'page',
  COMPONENT = 'component',
  WIDGET = 'widget',
  MENU_ITEM = 'menu_item',
}

export enum UIComponentType {
  REACT = 'react',
  VUE = 'vue',
  HTML = 'html',
  IFRAME = 'iframe',
}

@Entity('plugin_ui_extensions')
export class PluginUIExtension {
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
    enum: UIExtensionType,
  })
  type: UIExtensionType;

  @Column({ type: 'varchar', length: 100 })
  name: string; // Nom unique de l'extension (ex: "weather-dashboard")

  @Column({ type: 'varchar', length: 255 })
  displayName: string; // Nom d'affichage (ex: "Tableau de bord météo")

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  route: string; // Route pour les pages (ex: "/plugins/weather")

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string; // Icône pour les menus

  @Column({
    type: 'varchar',
    length: 20,
    enum: UIComponentType,
    default: UIComponentType.REACT,
  })
  componentType: UIComponentType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  componentPath: string; // Chemin vers le composant (ex: "components/WeatherDashboard.jsx")

  @Column({ type: 'varchar', length: 500, nullable: true })
  iframeUrl: string; // URL pour les composants iframe

  @Column({ type: 'json', nullable: true })
  props: Record<string, any>; // Props par défaut pour le composant

  @Column({ type: 'json', nullable: true })
  permissions: string[]; // Permissions requises pour accéder à cette extension

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées supplémentaires (position, taille, etc.)

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 0 })
  order: number; // Ordre d'affichage (pour les menus)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

