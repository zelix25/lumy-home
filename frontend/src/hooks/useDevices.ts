import { useState, useEffect } from 'react';
import { devicesService, Device } from '../services/devices.service';
import { useWebSocket } from './useWebSocket';

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, socket } = useWebSocket();

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const data = await devicesService.getAllDevices();
      setDevices(data);
      setError(null);
    } catch (err) {
      setError('Impossible de charger les appareils');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // Écouter les mises à jour WebSocket
  useEffect(() => {
    if (!isConnected) return;

    const handleDevicesUpdated = (data: unknown) => {
      const eventData = data as { devices: Device[] };
      setDevices(eventData.devices);
    };

    const handleDeviceDiscovered = (_data: unknown) => {
      fetchDevices(); // Rafraîchir la liste
    };

    const handleDeviceUpdated = (data: unknown) => {
      const eventData = data as { device: Device; message?: string };
      console.log('📊 Device updated via WebSocket:', eventData.device.friendlyName, eventData.device.state);
      console.log('📊 Device state keys:', eventData.device.state ? Object.keys(eventData.device.state) : 'no state');
      setDevices((prev) => {
        const updated = prev.map((d) =>
          d.ieeeAddress === eventData.device.ieeeAddress ? eventData.device : d,
        );
        console.log('📊 Devices after update:', updated.find(d => d.ieeeAddress === eventData.device.ieeeAddress));
        return updated;
      });
    };

    const handleDeviceState = (data: unknown) => {
      const eventData = data as {
        ieeeAddress: string;
        friendlyName: string;
        state: Record<string, any>;
      };
      console.log('📊 Device state updated via WebSocket:', eventData.friendlyName, eventData.state);
      setDevices((prev) =>
        prev.map((d) =>
          d.ieeeAddress === eventData.ieeeAddress
            ? { ...d, state: eventData.state, status: 'online' }
            : d,
        ),
      );
    };

    const handleDeviceOffline = (data: unknown) => {
      const eventData = data as { device: Device };
      setDevices((prev) =>
        prev.map((d) =>
          d.ieeeAddress === eventData.device.ieeeAddress
            ? { ...d, status: 'offline' }
            : d,
        ),
      );
    };

    socket.on('devices:updated', handleDevicesUpdated);
    socket.on('device:discovered', handleDeviceDiscovered);
    socket.on('device:updated', handleDeviceUpdated);
    socket.on('device:state', handleDeviceState);
    socket.on('device:offline', handleDeviceOffline);

    return () => {
      socket.off('devices:updated', handleDevicesUpdated);
      socket.off('device:discovered', handleDeviceDiscovered);
      socket.off('device:updated', handleDeviceUpdated);
      socket.off('device:state', handleDeviceState);
      socket.off('device:offline', handleDeviceOffline);
    };
  }, [isConnected]);

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
  };
}

