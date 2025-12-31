import { SystemNotificationType, SystemNotificationCategory } from '../entities/system-notification.entity';

export class SystemNotificationResponseDto {
  id: string;
  type: SystemNotificationType;
  category: SystemNotificationCategory;
  title: string;
  message: string;
  instructions: string | null;
  containerName: string | null;
  resolved: boolean;
  createdAt: Date;
}

