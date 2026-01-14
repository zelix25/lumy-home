import { apiService } from './api.service';

export interface UsbDevice {
  devices: string[];
}

export interface ConfigureZigbeeDto {
  port: string;
  adapter: string;
}

export interface ConfigureZigbeeResponse {
  success: boolean;
  message: string;
}

class SetupService {
  /**
   * Liste les périphériques USB disponibles
   */
  async getUsbDevices(): Promise<UsbDevice> {
    return apiService.get<UsbDevice>('/setup/usb-devices');
  }

  /**
   * Configure le coordinateur Zigbee
   */
  async configureZigbee(dto: ConfigureZigbeeDto): Promise<ConfigureZigbeeResponse> {
    return apiService.post<ConfigureZigbeeResponse>('/setup/configure-zigbee', dto);
  }
}

export const setupService = new SetupService();

