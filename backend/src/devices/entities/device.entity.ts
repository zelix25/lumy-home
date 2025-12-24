import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DeviceType {
  LIGHT = 'light',
  SWITCH = 'switch',
  SENSOR = 'sensor',
  PLUG = 'plug',
  DOOR = 'door',
  WINDOW = 'window',
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  COVER = 'cover',
  MOTION = 'motion',
  BUTTON = 'button',
  ENERGY = 'energy',
  UNKNOWN = 'unknown',
  OTHER = 'other',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown',
}

@Entity('devices')
export class Device {
  @PrimaryColumn()
  ieeeAddress: string;

  @Column({ nullable: true })
  mqttName: string;

  @Column({ nullable: true })
  friendlyName: string;

  @Column({ type: 'varchar', length: 50 })
  type: DeviceType;

  @Column({ type: 'varchar', length: 50, default: DeviceStatus.UNKNOWN })
  status: DeviceStatus;

  @Column({ type: 'text', nullable: true })
  manufacturer: string;

  @Column({ type: 'text', nullable: true })
  model: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  room: string;

  @Column({ type: 'json', nullable: true })
  state: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  meta: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isSupported: boolean;

  @Column({ type: 'text', nullable: true })
  unsupportedReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

