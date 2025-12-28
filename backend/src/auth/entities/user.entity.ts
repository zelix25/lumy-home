import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // Hash bcrypt

  @Column({ default: true })
  isLocalMode: boolean; // Mode local sans compte

  @Column({ type: 'varchar', length: 255, nullable: true })
  storeApiToken: string | null; // Token API pour communiquer avec le Lumy Store

  @Column({ type: 'datetime', nullable: true })
  storeApiTokenGeneratedAt: Date | null; // Date de génération du token

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

