import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('telegram')
export class Telegram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean', default: true })
  setup: boolean;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  uuid: string | null;

  @Column({ type: 'bigint', nullable: true })
  chatId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
