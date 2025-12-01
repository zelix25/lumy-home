import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SensorType {
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  PRESSURE = 'pressure',
  ILLUMINANCE = 'illuminance',
  BATTERY = 'battery',
  VOLTAGE = 'voltage',
  LINKQUALITY = 'linkquality',
}

@Entity('history')
@Index(['deviceId', 'sensorType', 'timestamp'])
@Index(['deviceId', 'timestamp'])
@Index(['timestamp'])
export class History {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  deviceId: string; // IEEE address du device

  @Column({ type: 'varchar', length: 50 })
  sensorType: SensorType; // Type de capteur

  @Column({ type: 'real' })
  value: number; // Valeur du capteur

  @CreateDateColumn()
  timestamp: Date;
}
