import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AutomationTriggerType {
  MOTION = 'motion',
  CONTACT = 'contact',
  TEMPERATURE = 'temperature',
  BUTTON = 'button',
  VIBRATION = 'vibration',
  ILLUMINANCE = 'illuminance',
  HUMIDITY = 'humidity',
  WATER_LEAK = 'water_leak',
  SMOKE = 'smoke',
  GAS = 'gas',
  SUNRISE_SUNSET = 'sunrise_sunset',
  TIME = 'time',
  MANUAL = 'manual',
}

export enum AutomationActionType {
  TURN_ON = 'turn_on',
  TURN_OFF = 'turn_off',
  TOGGLE = 'toggle',
  SET_BRIGHTNESS = 'set_brightness',
  SET_COLOR = 'set_color',
  SET_COLOR_TEMP = 'set_color_temp',
  SET_THERMOSTAT = 'set_thermostat',
  OPEN_COVER = 'open_cover',
  CLOSE_COVER = 'close_cover',
  NOTIFY = 'notify',
}

export enum AutomationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

@Entity('automations')
export class Automation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  userQuery: string; // La phrase originale de l'utilisateur

  @Column({ type: 'json' })
  trigger: {
    type: AutomationTriggerType;
    deviceId?: string; // IEEE address du device déclencheur
    deviceName?: string; // Nom friendly du device
    condition?: Record<string, any>; // Conditions supplémentaires (ex: température > 20)
    additionalConditions?: Array<{
      type: AutomationTriggerType;
      deviceId?: string;
      deviceName?: string;
      condition?: Record<string, any>;
    }>; // Conditions supplémentaires avec opérateur logique
    logicOperator?: 'AND' | 'OR'; // Opérateur logique pour combiner les conditions (par défaut AND)
    sunriseSunsetType?: 'sunrise' | 'sunset'; // Pour SUNRISE_SUNSET : lever ou coucher
    offsetMinutes?: number; // Décalage en minutes par rapport au lever/coucher (peut être négatif)
  };

  @Column({ type: 'json' })
  actions: Array<{
    type: AutomationActionType;
    deviceId: string; // IEEE address du device cible
    deviceName?: string; // Nom friendly du device
    params?: Record<string, any>; // Paramètres de l'action (brightness, color, etc.)
  }>;

  @Column({ type: 'varchar', length: 50, default: AutomationStatus.ACTIVE })
  status: AutomationStatus;

  @Column({ type: 'json', nullable: true })
  executionLog: Array<{
    timestamp: Date;
    success: boolean;
    message: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

