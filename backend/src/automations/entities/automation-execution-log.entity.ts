import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Automation } from '../../ai/entities/automation.entity';

@Entity('automation_execution_logs')
export class AutomationExecutionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Automation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'automationId' })
  automation: Automation;

  @Column()
  automationId: string;

  @Column({ type: 'boolean' })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'json', nullable: true })
  triggerData?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  actionResults?: Array<{
    actionType: string;
    deviceId: string;
    success: boolean;
    message?: string;
  }>;

  @CreateDateColumn()
  timestamp: Date;
}

