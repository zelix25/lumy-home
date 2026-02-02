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

  @Column({ type: 'varchar', length: 255, nullable: true })
  chatId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  token_bot: string | null;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'varchar', length: 6, nullable: true })
  pin: string | null;

  /** Code langue du bot (fr, en). Null = fr par défaut. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
