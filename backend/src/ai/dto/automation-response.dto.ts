import { Automation, AutomationStatus } from '../entities/automation.entity';

export class AutomationResponseDto {
  id: string;
  name: string;
  description: string;
  userQuery: string;
  trigger: {
    type: string;
    deviceName?: string;
    condition?: Record<string, any>;
  };
  actions: Array<{
    type: string;
    deviceName?: string;
    params?: Record<string, any>;
  }>;
  status: AutomationStatus;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(automation: Automation): AutomationResponseDto {
    return {
      id: automation.id,
      name: automation.name,
      description: automation.description,
      userQuery: automation.userQuery,
      trigger: {
        type: automation.trigger.type,
        deviceName: automation.trigger.deviceName,
        condition: automation.trigger.condition,
      },
      actions: automation.actions.map((action) => ({
        type: action.type,
        deviceName: action.deviceName,
        params: action.params,
      })),
      status: automation.status,
      createdAt: automation.createdAt,
      updatedAt: automation.updatedAt,
    };
  }
}

