import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PluginStatus {
  INSTALLED = 'installed',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
}

@Entity('plugins')
export class Plugin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string; // Nom unique du plugin (ex: "weather-forecast")

  @Column({ type: 'varchar', length: 255 })
  displayName: string; // Nom d'affichage (ex: "Weather Forecast")

  @Column({ type: 'varchar', length: 50 })
  version: string; // Version du plugin (ex: "1.0.0")

  @Column({ type: 'text', nullable: true })
  description: string; // Description du plugin

  @Column({ type: 'varchar', length: 255, nullable: true })
  author: string; // Auteur du plugin

  @Column({ type: 'varchar', length: 500, nullable: true })
  icon: string; // URL ou chemin vers l'icône

  @Column({ type: 'varchar', length: 500, nullable: true })
  repository: string; // URL du repository (GitHub, GitLab, etc.)

  @Column({ type: 'varchar', length: 50, default: PluginStatus.INSTALLED })
  status: PluginStatus; // Statut du plugin

  @Column({ type: 'json', nullable: true })
  config: Record<string, any>; // Configuration du plugin

  @Column({ type: 'json', nullable: true })
  permissions: string[]; // Permissions demandées par le plugin

  @Column({ type: 'varchar', length: 255, nullable: true })
  installPath: string; // Chemin d'installation du plugin

  @Column({ type: 'varchar', length: 50, nullable: true })
  lumyVersion: string; // Version minimale de Lumy Home requise

  @Column({ type: 'json', nullable: true })
  dependencies: Record<string, string>; // Dépendances (autres plugins)

  @Column({ type: 'text', nullable: true })
  error: string | null; // Message d'erreur si le plugin est en erreur

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées supplémentaires (catégorie, tags, etc.)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

