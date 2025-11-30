import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Paper, Chip, Stack, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { planService, Room, Floor } from '../services/plan.service';
import { Device } from '../services/devices.service';
import i18n from '@/i18n';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import LightModeIcon from '@mui/icons-material/LightMode';
import PersonIcon from '@mui/icons-material/Person';

interface PlanViewModeProps {
  devices: Device[];
}

interface RoomStats {
  temperature: number | null;
  illuminance: number | null;
  presence: boolean;
  deviceCount: number;
}

export default function PlanViewMode({ devices }: PlanViewModeProps) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger le plan
  useEffect(() => {
    const loadPlan = async () => {
      try {
        const plan = await planService.getPlan();
        if (plan) {
          setFloors(plan.floors || []);
          setRooms(plan.rooms || []);
          if (plan.floors && plan.floors.length > 0) {
            setSelectedFloorId(plan.floors[0].id);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement du plan:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, []);

  // Filtrer les pièces par étage sélectionné
  const filteredRooms = useMemo(() => {
    if (!selectedFloorId) return [];
    return rooms.filter((room) => room.floorId === selectedFloorId);
  }, [rooms, selectedFloorId]);

  // Calculer les statistiques pour chaque pièce
  const getRoomStats = (room: Room): RoomStats => {
    // Filtrer les appareils de cette pièce
    const roomDevices = devices.filter(
      (device) =>
        device.room?.toLowerCase() === room.name.toLowerCase() ||
        device.room === room.name
    );

    // Filtrer le coordinateur
    const validDevices = roomDevices.filter((device) => {
      const isCoordinator =
        device.type === 'Coordinator' ||
        (device.friendlyName && device.friendlyName.toLowerCase() === 'coordinator') ||
        (device.meta?.originalType && device.meta.originalType.toLowerCase() === 'coordinator') ||
        device.ieeeAddress === '0x0000000000000000';
      return !isCoordinator && device.status === 'online';
    });

    // Calculer la température moyenne
    const tempDevices = validDevices.filter((d) => d.state?.temperature !== undefined);
    const avgTemperature =
      tempDevices.length > 0
        ? tempDevices.reduce(
            (sum, d) =>
              sum + (typeof d.state?.temperature === 'number' ? d.state.temperature : 0),
            0
          ) / tempDevices.length
        : null;

    // Calculer la luminosité moyenne
    const illuminanceDevices = validDevices.filter((d) => d.state?.illuminance !== undefined);
    const avgIlluminance =
      illuminanceDevices.length > 0
        ? illuminanceDevices.reduce(
            (sum, d) =>
              sum +
              (typeof d.state?.illuminance === 'number' ? d.state.illuminance : 0),
            0
          ) / illuminanceDevices.length
        : null;

    // Vérifier la présence
    const hasPresence = validDevices.some(
      (d) => d.state?.presence === true || d.state?.occupancy === true
    );

    return {
      temperature: avgTemperature,
      illuminance: avgIlluminance,
      presence: hasPresence,
      deviceCount: validDevices.length,
    };
  };

  // Calculer les dimensions du plan
  const planDimensions = useMemo(() => {
    if (filteredRooms.length === 0) return { width: 800, height: 600 };
    const maxX = Math.max(...filteredRooms.map((r) => r.x + r.width));
    const maxY = Math.max(...filteredRooms.map((r) => r.y + r.height));
    return {
      width: Math.max(800, maxX + 100),
      height: Math.max(600, maxY + 100),
    };
  }, [filteredRooms]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>{i18n.t('common.loading')}</Typography>
      </Box>
    );
  }

  if (floors.length === 0 || rooms.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {i18n.t('home.noPlanAvailable')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Sélecteur d'étage */}
      {floors.length > 1 && (
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ maxWidth: 300 }}>
            <InputLabel>{i18n.t('plan.selectFloor')}</InputLabel>
            <Select
              value={selectedFloorId || ''}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              label={i18n.t('plan.selectFloor')}
            >
              {floors.map((floor) => (
                <MenuItem key={floor.id} value={floor.id}>
                  {floor.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Plan */}
      <Paper
        sx={{
          position: 'relative',
          width: '100%',
          height: planDimensions.height,
          minHeight: 600,
          backgroundColor: '#F7F7F5',
          border: '1px solid #E0E0E0',
          borderRadius: 1,
          overflow: 'auto',
        }}
      >
        {filteredRooms.map((room) => {
          const stats = getRoomStats(room);
          return (
            <Box
              key={room.id}
              sx={{
                position: 'absolute',
                left: room.x,
                top: room.y,
                width: room.width,
                height: room.height,
                border: `2px solid ${room.color}`,
                borderRadius: 1,
                backgroundColor: 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: `${room.color}10`,
                  boxShadow: `0 0 0 2px ${room.color}40`,
                },
              }}
            >
              {/* Nom de la pièce */}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: room.color,
                  mb: 0.5,
                  textAlign: 'center',
                }}
              >
                {room.name}
              </Typography>

              {/* Statistiques */}
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: 0.5,
                  maxWidth: '100%',
                }}
              >
                {stats.temperature !== null && (
                  <Chip
                    icon={<ThermostatIcon sx={{ fontSize: 14 }} />}
                    label={`${stats.temperature.toFixed(1)}°C`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '10px',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                      },
                    }}
                  />
                )}
                {stats.illuminance !== null && (
                  <Chip
                    icon={<LightModeIcon sx={{ fontSize: 14 }} />}
                    label={`${Math.round(stats.illuminance)} lux`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '10px',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                      },
                    }}
                  />
                )}
                {stats.presence && (
                  <Chip
                    icon={<PersonIcon sx={{ fontSize: 14 }} />}
                    label={i18n.t('devices.presence')}
                    size="small"
                    color="success"
                    sx={{
                      height: 20,
                      fontSize: '10px',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                      },
                    }}
                  />
                )}
              </Stack>

            </Box>
          );
        })}
      </Paper>
    </Box>
  );
}

