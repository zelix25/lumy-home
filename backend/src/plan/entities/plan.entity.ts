import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'json' })
  rooms: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;

  @Column({ type: 'json' })
  devicePositions: Array<{
    deviceId: string;
    roomId: string;
    x: number;
    y: number;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

