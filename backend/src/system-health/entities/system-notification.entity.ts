import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum SystemNotificationType {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  SUCCESS = 'success',
}

export enum SystemNotificationCategory {
  DOCKER = 'docker',
  SYSTEM = 'system',
  SERVICE = 'service',
}

@Entity('system_notifications')
export class SystemNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: SystemNotificationType;

  @Column({ type: 'varchar' })
  category: SystemNotificationCategory;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'varchar', nullable: true })
  containerName: string | null;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

