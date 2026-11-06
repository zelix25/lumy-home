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
  storeApiToken: string | null; // Clé API Lumy Store (lumy_...) — jamais exposée en clair côté UI

  @Column({ type: 'datetime', nullable: true })
  storeApiTokenGeneratedAt: Date | null; // Date d'enregistrement / validation de la clé

  @Column({ type: 'varchar', length: 255, nullable: true })
  storeEmail: string | null; // Email du compte store associé à la clé API

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

