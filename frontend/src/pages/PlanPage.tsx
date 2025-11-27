import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  Stack,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  EditOff as EditOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDevices } from '../hooks/useDevices';
import { devicesService } from '../services/devices.service';
import { planService } from '../services/plan.service';

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface DevicePosition {
  deviceId: string;
  roomId: string;
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const MIN_ROOM_SIZE = 100;

export default function PlanPage() {
  const { t } = useTranslation();
  const { devices, refetch } = useDevices();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devicePositions, setDevicePositions] = useState<DevicePosition[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomColor, setNewRoomColor] = useState('#86A6A0');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draggedDevice, setDraggedDevice] = useState<string | null>(null);
  const [isMovingRoom, setIsMovingRoom] = useState(false);
  const [movingRoomId, setMovingRoomId] = useState<string | null>(null);
  const [moveStart, setMoveStart] = useState<{ x: number; y: number; roomX: number; roomY: number } | null>(null);
  const [isResizingRoom, setIsResizingRoom] = useState(false);
  const [resizingRoomId, setResizingRoomId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; roomX: number; roomY: number; roomWidth: number; roomHeight: number } | null>(null);
  const [isMovingDevice, setIsMovingDevice] = useState(false);
  const [movingDeviceId, setMovingDeviceId] = useState<string | null>(null);
  const [moveDeviceStart, setMoveDeviceStart] = useState<{ x: number; y: number; deviceX: number; deviceY: number; roomId: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Charger le plan depuis la base de données
  useEffect(() => {
    const loadPlan = async () => {
      try {
        const plan = await planService.getPlan();
        if (plan) {
          setRooms(plan.rooms);
          setDevicePositions(plan.devicePositions);
        } else {
          // Fallback sur localStorage si pas de plan en DB
          const savedRooms = localStorage.getItem('homehub-rooms');
          const savedPositions = localStorage.getItem('homehub-device-positions');
          
          if (savedRooms) {
            setRooms(JSON.parse(savedRooms));
          }
          if (savedPositions) {
            setDevicePositions(JSON.parse(savedPositions));
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement du plan:', error);
        // Fallback sur localStorage en cas d'erreur
        const savedRooms = localStorage.getItem('homehub-rooms');
        const savedPositions = localStorage.getItem('homehub-device-positions');
        
        if (savedRooms) {
          setRooms(JSON.parse(savedRooms));
        }
        if (savedPositions) {
          setDevicePositions(JSON.parse(savedPositions));
        }
      }
    };
    
    loadPlan();
  }, []);

  // Sauvegarder dans le localStorage (backup)
  useEffect(() => {
    if (rooms.length > 0) {
      localStorage.setItem('homehub-rooms', JSON.stringify(rooms));
    }
  }, [rooms]);

  useEffect(() => {
    if (devicePositions.length > 0) {
      localStorage.setItem('homehub-device-positions', JSON.stringify(devicePositions));
    }
  }, [devicePositions]);

  // Sauvegarder en base de données quand on quitte le mode édition
  useEffect(() => {
    if (!isEditMode && rooms.length > 0) {
      const savePlan = async () => {
        try {
          await planService.savePlan(rooms, devicePositions);
        } catch (error) {
          console.error('Erreur lors de la sauvegarde du plan:', error);
        }
      };
      savePlan();
    }
  }, [isEditMode, rooms, devicePositions]);

  const handleCreateRoom = () => {
    if (!isEditMode) return;
    setIsCreatingRoom(true);
    setSelectedRoom(null);
  };

  const handleResetPlan = () => {
    setConfirmDialogConfig({
      title: t('plan.resetPlan'),
      message: t('plan.confirmReset'),
      onConfirm: () => {
        setRooms([]);
        setDevicePositions([]);
        setSelectedRoom(null);
        setIsCreatingRoom(false);
        localStorage.removeItem('homehub-rooms');
        localStorage.removeItem('homehub-device-positions');
        setConfirmDialogOpen(false);
        setConfirmDialogConfig(null);
      },
    });
    setConfirmDialogOpen(true);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ne pas interférer si on clique sur une pièce, un handle ou un équipement
    if (
      (e.target as HTMLElement).closest('[data-room]') ||
      (e.target as HTMLElement).closest('[data-resize-handle]') ||
      (e.target as HTMLElement).closest('[data-device]')
    ) {
      return;
    }

    // Désélectionner la pièce si on clique dans une zone vide
    if (!isCreatingRoom) {
      setSelectedRoom(null);
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;

    // Créer une pièce temporaire
    const tempRoomId = `temp-room-${Date.now()}`;
    const tempRoom: Room = {
      id: tempRoomId,
      name: '',
      x,
      y,
      width: MIN_ROOM_SIZE,
      height: MIN_ROOM_SIZE,
      color: newRoomColor,
    };
    setRooms((prev) => [...prev, tempRoom]);
    setSelectedRoom(tempRoomId);
    setDragStart({ x, y });
    setIsDragging(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const currentY = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;

    // Déplacement d'équipement
    if (isMovingDevice && moveDeviceStart && movingDeviceId) {
      const deltaX = currentX - moveDeviceStart.x;
      const deltaY = currentY - moveDeviceStart.y;

      const newX = moveDeviceStart.deviceX + deltaX;
      const newY = moveDeviceStart.deviceY + deltaY;

      // Mettre à jour la position de l'équipement
      setDevicePositions((prev) =>
        prev.map((p) =>
          p.deviceId === movingDeviceId
            ? { ...p, x: newX, y: newY }
            : p
        )
      );
      return;
    }

    // Redimensionnement
    if (isResizingRoom && resizeStart && resizingRoomId && resizeHandle) {
      const deltaX = currentX - resizeStart.x;
      const deltaY = currentY - resizeStart.y;

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== resizingRoomId) return room;

          let newX = resizeStart.roomX;
          let newY = resizeStart.roomY;
          let newWidth = resizeStart.roomWidth;
          let newHeight = resizeStart.roomHeight;

          // Gérer les différents handles
          if (resizeHandle.includes('n')) {
            newHeight = Math.max(MIN_ROOM_SIZE, resizeStart.roomHeight - deltaY);
            newY = resizeStart.roomY + (resizeStart.roomHeight - newHeight);
          }
          if (resizeHandle.includes('s')) {
            newHeight = Math.max(MIN_ROOM_SIZE, resizeStart.roomHeight + deltaY);
          }
          if (resizeHandle.includes('w')) {
            newWidth = Math.max(MIN_ROOM_SIZE, resizeStart.roomWidth - deltaX);
            newX = resizeStart.roomX + (resizeStart.roomWidth - newWidth);
          }
          if (resizeHandle.includes('e')) {
            newWidth = Math.max(MIN_ROOM_SIZE, resizeStart.roomWidth + deltaX);
          }

          return { ...room, x: newX, y: newY, width: newWidth, height: newHeight };
        })
      );
      return;
    }

    // Déplacement
    if (isMovingRoom && moveStart && movingRoomId) {
      const deltaX = currentX - moveStart.x;
      const deltaY = currentY - moveStart.y;

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== movingRoomId) return room;
          return {
            ...room,
            x: Math.max(0, moveStart.roomX + deltaX),
            y: Math.max(0, moveStart.roomY + deltaY),
          };
        })
      );
      return;
    }

    // Création
    if (!isDragging || !dragStart || !isCreatingRoom || !selectedRoom) return;

    const width = Math.max(MIN_ROOM_SIZE, Math.abs(currentX - dragStart.x));
    const height = Math.max(MIN_ROOM_SIZE, Math.abs(currentY - dragStart.y));
    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);

    // Mettre à jour la pièce temporaire
    setRooms((prev) =>
      prev.map((room) =>
        room.id === selectedRoom
          ? { ...room, x, y, width, height }
          : room
      )
    );
  };

  const handleCanvasMouseUp = () => {
    // Déplacement d'équipement
    if (isMovingDevice) {
      setIsMovingDevice(false);
      setMovingDeviceId(null);
      setMoveDeviceStart(null);
      return;
    }

    // Redimensionnement
    if (isResizingRoom) {
      setIsResizingRoom(false);
      setResizingRoomId(null);
      setResizeHandle(null);
      setResizeStart(null);
      return;
    }

    // Déplacement
    if (isMovingRoom) {
      setIsMovingRoom(false);
      setMovingRoomId(null);
      setMoveStart(null);
      return;
    }

    // Création
    if (!isDragging || !dragStart || !isCreatingRoom || !selectedRoom) return;

    const room = rooms.find((r) => r.id === selectedRoom);
    if (room && room.width >= MIN_ROOM_SIZE && room.height >= MIN_ROOM_SIZE) {
      setIsDragging(false);
      setIsCreatingRoom(false);
      setRoomDialogOpen(true);
    } else {
      // Supprimer la pièce si elle est trop petite
      setRooms((prev) => prev.filter((r) => r.id !== selectedRoom));
      setSelectedRoom(null);
      setIsDragging(false);
      setIsCreatingRoom(false);
    }
  };

  const handleRoomMouseDown = (e: React.MouseEvent, room: Room) => {
    e.stopPropagation();
    if (isCreatingRoom || !isEditMode) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;

    setSelectedRoom(room.id);
    setIsMovingRoom(true);
    setMovingRoomId(room.id);
    setMoveStart({ x, y, roomX: room.x, roomY: room.y });
  };

  const handleResizeHandleMouseDown = (e: React.MouseEvent, room: Room, handle: string) => {
    e.stopPropagation();
    if (isCreatingRoom || !isEditMode) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;

    setSelectedRoom(room.id);
    setIsResizingRoom(true);
    setResizingRoomId(room.id);
    setResizeHandle(handle);
    setResizeStart({ x, y, roomX: room.x, roomY: room.y, roomWidth: room.width, roomHeight: room.height });
  };

  const handleDeviceMouseDown = (e: React.MouseEvent, deviceId: string, roomId: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    if (isCreatingRoom || !isEditMode) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;

    setIsMovingDevice(true);
    setMovingDeviceId(deviceId);
    setMoveDeviceStart({ x, y, deviceX: currentX, deviceY: currentY, roomId });
  };

  const handleSaveRoom = () => {
    if (!selectedRoom || !newRoomName.trim()) return;

    const room = rooms.find((r) => r.id === selectedRoom);
    if (room) {
      // Mettre à jour la pièce existante
      if (room.id.startsWith('temp-room-')) {
        // Renommer la pièce temporaire
        setRooms((prev) =>
          prev.map((r) =>
            r.id === selectedRoom
              ? { ...r, id: `room-${Date.now()}`, name: newRoomName, color: newRoomColor }
              : r
          )
        );
      } else {
        // Mettre à jour une pièce existante
        setRooms((prev) =>
          prev.map((r) =>
            r.id === selectedRoom
              ? { ...r, name: newRoomName, color: newRoomColor }
              : r
          )
        );
      }
    }

    setRoomDialogOpen(false);
    setNewRoomName('');
    setEditingRoom(null);
    setSelectedRoom(null);
  };

  const handleCancelRoom = () => {
    if (selectedRoom) {
      const room = rooms.find((r) => r.id === selectedRoom);
      if (room && (!room.name || room.id.startsWith('temp-room-'))) {
        // Supprimer la pièce non nommée ou temporaire
        setRooms((prev) => prev.filter((r) => r.id !== selectedRoom));
      }
    }
    setSelectedRoom(null);
    setIsCreatingRoom(false);
    setRoomDialogOpen(false);
    setNewRoomName('');
    setEditingRoom(null);
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setSelectedRoom(room.id);
    setNewRoomName(room.name);
    setNewRoomColor(room.color);
    setRoomDialogOpen(true);
  };

  const handleDeleteRoom = (roomId: string) => {
    setConfirmDialogConfig({
      title: t('plan.deleteRoom'),
      message: t('plan.confirmDeleteRoom'),
      onConfirm: () => {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        setDevicePositions((prev) => prev.filter((p) => p.roomId !== roomId));
        setConfirmDialogOpen(false);
        setConfirmDialogConfig(null);
      },
    });
    setConfirmDialogOpen(true);
  };

  const handleDeviceDragStart = (e: React.DragEvent, deviceId: string) => {
    setDraggedDevice(deviceId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedDevice) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Trouver la pièce dans laquelle l'équipement est déposé
    const room = rooms.find(
      (r) =>
        x >= r.x &&
        x <= r.x + r.width &&
        y >= r.y &&
        y <= r.y + r.height
    );

    if (room) {
      const device = devices.find((d) => d.ieeeAddress === draggedDevice);
      if (device) {
        // Mettre à jour la pièce de l'équipement
        devicesService.updateRoom(draggedDevice, room.name);
        refetch();

        // Sauvegarder la position
        setDevicePositions((prev) => {
          const existing = prev.find((p) => p.deviceId === draggedDevice);
          if (existing) {
            return prev.map((p) =>
              p.deviceId === draggedDevice
                ? { ...p, roomId: room.id, x, y }
                : p
            );
          }
          return [...prev, { deviceId: draggedDevice, roomId: room.id, x, y }];
        });
      }
    }

    setDraggedDevice(null);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'light':
        return '💡';
      case 'switch':
        return '🔌';
      case 'sensor':
        return '📡';
      case 'motion':
        return '👁️';
      case 'temperature':
        return '🌡️';
      case 'door':
        return '🚪';
      case 'window':
        return '🪟';
      case 'plug':
        return '🔌';
      default:
        return '📱';
    }
  };

  const getDevicesInRoom = (roomId: string) => {
    return devicePositions
      .filter((p) => p.roomId === roomId)
      .map((p) => {
        const device = devices.find((d) => d.ieeeAddress === p.deviceId);
        return { ...p, device };
      })
      .filter((item) => item.device);
  };

  const getDevicesWithoutRoom = () => {
    return devices.filter(
      (device) =>
        !devicePositions.some((p) => p.deviceId === device.ieeeAddress) &&
        device.friendlyName?.toLowerCase() !== 'coordinator' &&
        device.type !== 'unknown'
    );
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
            {t('plan.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('plan.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant={isEditMode ? 'contained' : 'outlined'}
            startIcon={isEditMode ? <EditOffIcon /> : <EditIcon />}
            onClick={() => {
              setIsEditMode(!isEditMode);
              setIsCreatingRoom(false);
              setSelectedRoom(null);
            }}
          >
            {isEditMode ? t('plan.disableEdit') : t('plan.enableEdit')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<RefreshIcon />}
            onClick={handleResetPlan}
            disabled={!isEditMode}
          >
            {t('plan.resetPlan')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateRoom}
            disabled={isCreatingRoom || !isEditMode}
          >
            {t('plan.addRoom')}
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={9}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '600px',
                  backgroundColor: '#F5F5F5',
                  backgroundImage: `
                    linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 2,
                  overflow: 'auto',
                  cursor: isCreatingRoom ? 'crosshair' : 'default',
                }}
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  // Arrêter les opérations si la souris quitte le canvas
                  if (isDragging || isMovingRoom || isResizingRoom || isMovingDevice) {
                    handleCanvasMouseUp();
                  }
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
              >
                {/* Pièces */}
                {rooms.map((room) => {
                  const devicesInRoom = getDevicesInRoom(room.id);
                  const isSelected = selectedRoom === room.id;
                  return (
                    <Box
                      key={room.id}
                      data-room={room.id}
                      sx={{
                        position: 'absolute',
                        left: room.x,
                        top: room.y,
                        width: room.width,
                        height: room.height,
                        backgroundColor: room.color,
                        border: '2px solid',
                        borderColor: isSelected ? '#86A6A0' : 'rgba(0,0,0,0.2)',
                        borderRadius: 0,
                        cursor: isCreatingRoom || !isEditMode ? 'default' : 'move',
                        opacity: 0.7,
                        '&:hover': {
                          opacity: 0.9,
                          borderColor: '#86A6A0',
                        },
                      }}
                      onMouseDown={(e) => handleRoomMouseDown(e, room)}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          right: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 500,
                            color: '#1E1E1E',
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          {room.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          {isEditMode && (
                            <>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditRoom(room);
                                }}
                                sx={{
                                  backgroundColor: 'rgba(255,255,255,0.9)',
                                  '&:hover': { backgroundColor: 'rgba(255,255,255,1)' },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoom(room.id);
                                }}
                                sx={{
                                  backgroundColor: 'rgba(255,255,255,0.9)',
                                  '&:hover': { backgroundColor: 'rgba(255,255,255,1)' },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Stack>
                      </Box>

                      {/* Équipements dans la pièce */}
                      {devicesInRoom.map((item) => {
                        const device = item.device;
                        if (!device) return null;

                        const relativeX = item.x - room.x;
                        const relativeY = item.y - room.y;
                        const isMoving = isMovingDevice && movingDeviceId === item.deviceId;

                        return (
                          <Tooltip key={item.deviceId} title={device.friendlyName || device.ieeeAddress}>
                            <Box
                              data-device={item.deviceId}
                              sx={{
                                position: 'absolute',
                                left: relativeX,
                                top: relativeY,
                                width: 40,
                                height: 40,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                border: '2px solid',
                                borderColor: device.status === 'online' ? '#2e7d32' : '#d32f2f',
                                borderRadius: '50%',
                                fontSize: '20px',
                                cursor: isEditMode ? 'grab' : 'default',
                                boxShadow: isMoving ? '0 4px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                                transition: isMoving ? 'none' : 'all 0.2s ease',
                                zIndex: isMoving ? 100 : 10,
                                '&:hover': {
                                  transform: isMoving ? 'none' : 'scale(1.1)',
                                  zIndex: 10,
                                },
                                '&:active': {
                                  cursor: 'grabbing',
                                },
                              }}
                              onMouseDown={(e) => handleDeviceMouseDown(e, item.deviceId, room.id, item.x, item.y)}
                            >
                              {getDeviceIcon(device.type)}
                            </Box>
                          </Tooltip>
                        );
                      })}

                      {/* Handles de redimensionnement */}
                      {isSelected && !isCreatingRoom && isEditMode && (
                        <>
                          {/* Coin nord-ouest */}
                          <Box
                            data-resize-handle="nw"
                            sx={{
                              position: 'absolute',
                              left: -6,
                              top: -6,
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'nwse-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 'nw')}
                          />
                          {/* Coin nord-est */}
                          <Box
                            data-resize-handle="ne"
                            sx={{
                              position: 'absolute',
                              right: -6,
                              top: -6,
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'nesw-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 'ne')}
                          />
                          {/* Coin sud-ouest */}
                          <Box
                            data-resize-handle="sw"
                            sx={{
                              position: 'absolute',
                              left: -6,
                              bottom: -6,
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'nesw-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 'sw')}
                          />
                          {/* Coin sud-est */}
                          <Box
                            data-resize-handle="se"
                            sx={{
                              position: 'absolute',
                              right: -6,
                              bottom: -6,
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'nwse-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 'se')}
                          />
                          {/* Bord nord */}
                          <Box
                            data-resize-handle="n"
                            sx={{
                              position: 'absolute',
                              left: '50%',
                              top: -6,
                              transform: 'translateX(-50%)',
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'ns-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 'n')}
                          />
                          {/* Bord sud */}
                          <Box
                            data-resize-handle="s"
                            sx={{
                              position: 'absolute',
                              left: '50%',
                              bottom: -6,
                              transform: 'translateX(-50%)',
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'ns-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 's')}
                          />
                          {/* Bord ouest */}
                          <Box
                            data-resize-handle="w"
                            sx={{
                              position: 'absolute',
                              left: -6,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'ew-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 'w')}
                          />
                          {/* Bord est */}
                          <Box
                            data-resize-handle="e"
                            sx={{
                              position: 'absolute',
                              right: -6,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 12,
                              height: 12,
                              backgroundColor: '#86A6A0',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'ew-resize',
                              zIndex: 20,
                            }}
                            onMouseDown={(e) => handleResizeHandleMouseDown(e, room, 'e')}
                          />
                        </>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
                {t('plan.devices')}
              </Typography>
              <Box sx={{ maxHeight: '500px', overflowY: 'auto' }}>
                {getDevicesWithoutRoom().map((device) => (
                  <Paper
                    key={device.ieeeAddress}
                    draggable
                    onDragStart={(e) => handleDeviceDragStart(e, device.ieeeAddress)}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      cursor: 'grab',
                      backgroundColor: 'rgba(134, 166, 160, 0.05)',
                      border: '1px solid rgba(134, 166, 160, 0.2)',
                      borderRadius: 2,
                      '&:hover': {
                        backgroundColor: 'rgba(134, 166, 160, 0.1)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      },
                      '&:active': {
                        cursor: 'grabbing',
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ fontSize: '24px' }}>{getDeviceIcon(device.type)}</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {device.friendlyName || device.ieeeAddress}
                        </Typography>
                        <Chip
                          label={device.status === 'online' ? t('common.online') : t('common.offline')}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.7rem',
                            backgroundColor:
                              device.status === 'online'
                                ? 'rgba(46, 125, 50, 0.1)'
                                : 'rgba(211, 47, 47, 0.1)',
                            color: device.status === 'online' ? '#2e7d32' : '#d32f2f',
                            mt: 0.5,
                          }}
                        />
                      </Box>
                    </Stack>
                  </Paper>
                ))}
                {getDevicesWithoutRoom().length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    {t('plan.allDevicesPlaced')}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog pour créer/éditer une pièce */}
      <Dialog open={roomDialogOpen} onClose={handleCancelRoom}>
        <DialogTitle>
          {editingRoom ? t('plan.editRoom') : t('plan.createRoom')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('plan.roomName')}
            fullWidth
            variant="outlined"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('plan.roomColor')}
            type="color"
            fullWidth
            variant="outlined"
            value={newRoomColor}
            onChange={(e) => setNewRoomColor(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRoom}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveRoom} variant="contained" disabled={!newRoomName.trim()}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>{confirmDialogConfig?.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialogConfig?.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={() => {
              confirmDialogConfig?.onConfirm();
            }}
            variant="contained"
            color="error"
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

