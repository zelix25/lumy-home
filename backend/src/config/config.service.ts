import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  get<T = any>(key: string, defaultValue?: T): T {
    const value = this.nestConfigService.get<T>(key);
    return value !== undefined ? value : (defaultValue as T);
  }

  get mqtt() {
    return {
      brokerUrl: this.get('MQTT_BROKER_URL', 'mqtt://localhost:1883'),
      username: this.get('MQTT_USERNAME'),
      password: this.get('MQTT_PASSWORD'),
      clientId: this.get('MQTT_CLIENT_ID', 'homehub-backend'),
      reconnectPeriod: this.get('MQTT_RECONNECT_PERIOD', 5000),
    };
  }

  get database() {
    return {
      path: this.get('DATABASE_PATH', 'data/homehub.db'),
    };
  }

  get websocket() {
    return {
      cors: {
        origin: this.get('FRONTEND_URL', 'http://localhost:5173'),
        credentials: true,
      },
    };
  }
}

