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

    const handleDevicesUpdated = (data: { devices: Device[] }) => {
      setDevices(data.devices);
    };

    const handleDeviceDiscovered = (data: { device: Device; message: string }) => {
      fetchDevices(); // Rafraîchir la liste
    };

    const handleDeviceUpdated = (data: { device: Device; message?: string }) => {
      console.log('📊 Device updated via WebSocket:', data.device.friendlyName, data.device.state);
      console.log('📊 Device state keys:', data.device.state ? Object.keys(data.device.state) : 'no state');
      setDevices((prev) => {
        const updated = prev.map((d) =>
          d.ieeeAddress === data.device.ieeeAddress ? data.device : d,
        );
        console.log('📊 Devices after update:', updated.find(d => d.ieeeAddress === data.device.ieeeAddress));
        return updated;
      });
    };

    const handleDeviceState = (data: {
      ieeeAddress: string;
      friendlyName: string;
      state: Record<string, any>;
    }) => {
      console.log('📊 Device state updated via WebSocket:', data.friendlyName, data.state);
      setDevices((prev) =>
        prev.map((d) =>
          d.ieeeAddress === data.ieeeAddress
            ? { ...d, state: data.state, status: 'online' }
            : d,
        ),
      );
    };

    const handleDeviceOffline = (data: { device: Device }) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.ieeeAddress === data.device.ieeeAddress
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

