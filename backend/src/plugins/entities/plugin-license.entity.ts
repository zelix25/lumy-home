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

export enum LicenseType {
  FREE = 'free',
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
  TRIAL = 'trial',
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
@Index(['pluginId'])
@Index(['userId'])
@Index(['status'])
@Index(['licenseKey'], { unique: true })
@Index(['pluginId', 'userId'])
export class PluginLicense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pluginId: string; // ID du plugin

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 36 })
  userId: string; // ID de l'utilisateur propriétaire de la licence

  @Column({
    type: 'varchar',
    length: 50,
    enum: LicenseType,
  })
  licenseType: LicenseType; // Type de licence (free, one_time, subscription, trial)

  @Column({
    type: 'varchar',
    length: 50,
    enum: LicenseStatus,
    default: LicenseStatus.PENDING,
  })
  status: LicenseStatus; // Statut de la licence

  @Column({ type: 'varchar', length: 255, unique: true })
  licenseKey: string; // Clé de licence unique

  @Column({ type: 'datetime', nullable: true })
  activatedAt: Date | null; // Date d'activation

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null; // Date d'expiration (null pour les licences permanentes)

  @Column({ type: 'datetime', nullable: true })
  trialEndsAt: Date | null; // Date de fin de période d'essai

  @Column({
    type: 'varchar',
    length: 50,
    enum: PaymentProvider,
    nullable: true,
  })
  paymentProvider: PaymentProvider | null; // Fournisseur de paiement (Stripe, PayPal, etc.)

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentId: string | null; // ID du paiement (Stripe PaymentIntent, PayPal Order, etc.)

  @Column({ type: 'varchar', length: 255, nullable: true })
  subscriptionId: string | null; // ID de l'abonnement (Stripe Subscription, PayPal Subscription, etc.)

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerId: string | null; // ID du client chez le fournisseur de paiement

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number | null; // Montant payé (en centimes pour Stripe, en unités pour PayPal)

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string | null; // Devise (EUR, USD, etc.)

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Métadonnées supplémentaires (plan, features, etc.)

  @Column({ type: 'text', nullable: true })
  notes: string | null; // Notes administratives

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

