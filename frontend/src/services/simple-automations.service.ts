import { apiService } from './api.service';

export enum AutomationTriggerType {
  MOTION = 'motion',
  CONTACT = 'contact',
  TEMPERATURE = 'temperature',
  BUTTON = 'button',
  TIME = 'time',
  MANUAL = 'manual',
}

export enum AutomationActionType {
  TURN_ON = 'turn_on',
  TURN_OFF = 'turn_off',
  SET_BRIGHTNESS = 'set_brightness',
  SET_COLOR = 'set_color',
  NOTIFY = 'notify',
}

export enum AutomationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export interface AutomationTrigger {
  type: AutomationTriggerType;
  deviceId?: string;
  deviceName?: string;
  condition?: Record<string, any>;
}

export interface AutomationAction {
  type: AutomationActionType;
  deviceId: string;
  deviceName?: string;
  params?: Record<string, any>;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  userQuery?: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  status: AutomationStatus;
  executionLog?: Array<{
    timestamp: Date;
    success: boolean;
    message: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecutionLog {
  id: string;
  automationId: string;
  success: boolean;
  message?: string;
  triggerData?: Record<string, any>;
  actionResults?: Array<{
    actionType: string;
    deviceId: string;
    success: boolean;
    message?: string;
  }>;
  timestamp: Date;
}

export interface CreateAutomationDto {
  name: string;
  description?: string;
  userQuery?: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
}

export interface UpdateAutomationDto {
  name?: string;
  description?: string;
  userQuery?: string;
  trigger?: AutomationTrigger;
  actions?: AutomationAction[];
  status?: AutomationStatus;
}

class SimpleAutomationsService {
  async getAll(): Promise<Automation[]> {
    return apiService.get<Automation[]>('/automations');
  }

  async getOne(id: string): Promise<Automation> {
    return apiService.get<Automation>(`/automations/${id}`);
  }

  async create(automation: CreateAutomationDto): Promise<Automation> {
    return apiService.post<Automation>('/automations', automation);
  }

  async update(id: string, automation: UpdateAutomationDto): Promise<Automation> {
    return apiService.put<Automation>(`/automations/${id}`, automation);
  }

  async toggleStatus(id: string): Promise<Automation> {
    return apiService.patch<Automation>(`/automations/${id}/toggle`);
  }

  async delete(id: string): Promise<void> {
    return apiService.delete<void>(`/automations/${id}`);
  }

  async getExecutionLogs(id: string, limit: number = 50): Promise<AutomationExecutionLog[]> {
    return apiService.get<AutomationExecutionLog[]>(`/automations/${id}/logs?limit=${limit}`);
  }
}

export const simpleAutomationsService = new SimpleAutomationsService();

