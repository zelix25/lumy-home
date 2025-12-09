import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('weather')
@Index(['latitude', 'longitude', 'date'], { unique: true })
export class Weather {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time', nullable: true })
  sunrise: string | null;

  @Column({ type: 'time', nullable: true })
  sunset: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  temperature_2m: number | null;

  @Column({ type: 'integer', nullable: true })
  relative_humidity_2m: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  wind_speed_10m: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  precipitation: number | null;

  @Column({ type: 'integer', nullable: true })
  weather_code: number | null;

  @Column({ type: 'text', nullable: true })
  raw_data: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

