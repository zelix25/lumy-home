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

export enum CertificationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVOKED = 'revoked',
}

export enum ReviewPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('plugin_certifications')
export class PluginCertification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  pluginName: string;

  @Column({ type: 'varchar', length: 50 })
  pluginVersion: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: CertificationStatus,
    default: CertificationStatus.PENDING,
  })
  status: CertificationStatus;

  @Column({ type: 'text', nullable: true })
  reviewerNotes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  rejectionReason: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ReviewPriority,
    default: ReviewPriority.NORMAL,
  })
  priority: ReviewPriority;

  @Column({ type: 'text', nullable: true })
  signature: string;

  @Column({ type: 'text', nullable: true })
  signatureKey: string;

  @Column({ type: 'boolean', default: false })
  isSigned: boolean;

  @Column({ type: 'text', nullable: true })
  checksum: string;

  @Column({ type: 'json', nullable: true })
  securityScan: any;

  @Column({ type: 'json', nullable: true })
  qualityScore: any;

  @Column({ type: 'json', nullable: true })
  reviewChecklist: any;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  certificateUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relation optionnelle vers le plugin installé
  @ManyToOne(() => Plugin, { nullable: true })
  @JoinColumn({ name: 'pluginId' })
  plugin: Plugin;

  @Column({ type: 'varchar', length: 36, nullable: true })
  pluginId: string;
}

