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

export enum LicenseType {
  FREE = 'free',
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
  LIFETIME = 'lifetime',
}

export enum LicenseStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  MANUAL = 'manual',
}

@Entity('plugin_licenses')
@Index(['pluginId', 'userId'])
@Index(['userId', 'status'])
export class PluginLicense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string;

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 255 })
  userId: string; // ID de l'utilisateur

  @Column({
    type: 'varchar',
    length: 50,
    enum: LicenseType,
    default: LicenseType.FREE,
  })
  licenseType: LicenseType;

  @Column({
    type: 'varchar',
    length: 20,
    enum: LicenseStatus,
    default: LicenseStatus.PENDING,
  })
  status: LicenseStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number; // Prix payé

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string; // Devise (EUR, USD, etc.)

  @Column({
    type: 'varchar',
    length: 50,
    enum: PaymentProvider,
    nullable: true,
  })
  paymentProvider: PaymentProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentId: string; // ID de transaction du provider (Stripe, PayPal, etc.)

  @Column({ type: 'varchar', length: 255, nullable: true })
  subscriptionId: string; // ID d'abonnement (pour les abonnements récurrents)

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null; // Date d'expiration (null pour lifetime)

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date | null; // Date d'annulation

  @Column({ type: 'text', nullable: true })
  licenseKey: string; // Clé de licence unique

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Métadonnées (plan, features, etc.)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

