import { useCallback } from 'react';

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
}

const notifications: Notification[] = [];
const listeners: Set<(notifications: Notification[]) => void> = new Set();

export function useNotification() {
  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
    notifications.push(newNotification);
    listeners.forEach((listener) => listener([...notifications]));
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
      const index = notifications.findIndex((n) => n.id === newNotification.id);
      if (index > -1) {
        notifications.splice(index, 1);
        listeners.forEach((listener) => listener([...notifications]));
      }
    }, 6000);
  }, []);

  return { addNotification };
}

export function subscribeToNotifications(callback: (notifications: Notification[]) => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getNotifications(): Notification[] {
  return [...notifications];
}

