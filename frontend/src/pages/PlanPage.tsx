import { useState, useRef, useEffect, useCallback } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  EditOff as EditOffIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Layers as LayersIcon,
  CropFree as CropFreeIcon,
} from '@mui/icons-material';
import PolylineIcon from '@mui/icons-material/Polyline';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useTranslation } from 'react-i18next';
import { useDevices } from '../hooks/useDevices';
import { devicesService } from '../services/devices.service';
import { planService } from '../services/plan.service';
import { roomsService, Room as RoomEntity } from '../services/rooms.service';
import { useNotification } from '../hooks/useNotification';
import { translateRoomName } from '../utils/roomTranslations';

interface Floor {
  id: string;
  name: string;
  order: number;
}

interface Point {
  x: number;
  y: number;
}

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  floorId: string;
  points?: Point[]; // Pour les polylignes (polygones)
  isPolyline?: boolean; // Indique si c'est une polyligne ou un rectangle
}

interface DevicePosition {
  deviceId: string;
  roomId: string;
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const MIN_ROOM_SIZE = 40;

export default function PlanPage() {
  const { t } = useTranslation();
  const { devices, refetch } = useDevices();
  const { addNotification } = useNotification();
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devicePositions, setDevicePositions] = useState<DevicePosition[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomMode, setRoomMode] = useState<'rectangle' | 'polyline'>('rectangle');
  const [polylinePoints, setPolylinePoints] = useState<Point[]>([]);
  const [isDrawingPolyline, setIsDrawingPolyline] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomColor, setNewRoomColor] = useState('#86A6A0');
  const [availableRooms, setAvailableRooms] = useState<RoomEntity[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [useCustomRoomName, setUseCustomRoomName] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draggedDevice, setDraggedDevice] = useState<string | null>(null);
  const [isMovingRoom, setIsMovingRoom] = useState(false);
  const [movingRoomId, setMovingRoomId] = useState<string | null>(null);
  const [moveStart, setMoveStart] = useState<{ x: number; y: number; roomX: number; roomY: number; initialPoints?: Point[] } | null>(null);
  const [isResizingRoom, setIsResizingRoom] = useState(false);
  const [resizingRoomId, setResizingRoomId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; roomX: number; roomY: number; roomWidth: number; roomHeight: number } | null>(null);
  const [isMovingDevice, setIsMovingDevice] = useState(false);
  const [movingDeviceId, setMovingDeviceId] = useState<string | null>(null);
  const [moveDeviceStart, setMoveDeviceStart] = useState<{ x: number; y: number; deviceX: number; deviceY: number; roomId: string } | null>(null);
  const [isMovingPolylinePoint, setIsMovingPolylinePoint] = useState(false);
  const [movingPointIndex, setMovingPointIndex] = useState<number | null>(null);
  const [movingPointRoomId, setMovingPointRoomId] = useState<string | null>(null);
  const [movePointStart, setMovePointStart] = useState<{ x: number; y: number; pointX: number; pointY: number } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const syncLocalPlanToServer = useCallback(
    async (floorsData: Floor[], roomsData: Room[], devicePositionsData: DevicePosition[], showNotification = false) => {
      if (
        (!floorsData || floorsData.length === 0) &&
        (!roomsData || roomsData.length === 0) &&
        (!devicePositionsData || devicePositionsData.length === 0)
      ) {
        return;
      }
      try {
        await planService.savePlan(floorsData || [], roomsData || [], devicePositionsData || []);
        if (showNotification) {
          addNotification({
            type: 'success',
            title: t('plan.saved'),
            message: t('plan.savedMessage'),
          });
        }
      } catch (error) {
        console.error('Erreur lors de la synchronisation du plan local vers le serveur:', error);
        if (showNotification) {
          addNotification({
            type: 'error',
            title: t('plan.saveError'),
            message: t('plan.saveErrorMessage'),
          });
        }
      }
    },
    [addNotification, t],
  );

  // Charger le plan depuis la base de données
  useEffect(() => {
    const loadPlan = async () => {
      try {
        const plan = await planService.getPlan();
        if (plan) {
          setFloors(plan.floors || []);
          setRooms(plan.rooms || []);
          setDevicePositions(plan.devicePositions || []);
          
          // Sélectionner le premier étage par défaut
          if (plan.floors && plan.floors.length > 0 && !selectedFloorId) {
            setSelectedFloorId(plan.floors[0].id);
          }
          return;
        }

        // Fallback sur localStorage si pas de plan en DB
        const savedFloors = localStorage.getItem('lumy-floors');
        const savedRooms = localStorage.getItem('lumy-rooms');
        const savedPositions = localStorage.getItem('lumy-device-positions');
        const floorsFromLocal: Floor[] = savedFloors ? JSON.parse(savedFloors) : [];
        const roomsFromLocal: Room[] = savedRooms ? JSON.parse(savedRooms) : [];
        const positionsFromLocal: DevicePosition[] = savedPositions ? JSON.parse(savedPositions) : [];

        setFloors(floorsFromLocal);
        setRooms(roomsFromLocal);
        setDevicePositions(positionsFromLocal);
        
        if (floorsFromLocal.length > 0 && !selectedFloorId) {
          setSelectedFloorId(floorsFromLocal[0].id);
        }
        
        await syncLocalPlanToServer(floorsFromLocal, roomsFromLocal, positionsFromLocal, false);
      } catch (error) {
        console.error('Erreur lors du chargement du plan:', error);
        const savedFloors = localStorage.getItem('lumy-floors');
        const savedRooms = localStorage.getItem('lumy-rooms');
        const savedPositions = localStorage.getItem('lumy-device-positions');
        const floorsFromLocal: Floor[] = savedFloors ? JSON.parse(savedFloors) : [];
        const roomsFromLocal: Room[] = savedRooms ? JSON.parse(savedRooms) : [];
        const positionsFromLocal: DevicePosition[] = savedPositions ? JSON.parse(savedPositions) : [];

        setFloors(floorsFromLocal);
        setRooms(roomsFromLocal);
        setDevicePositions(positionsFromLocal);
        
        if (floorsFromLocal.length > 0 && !selectedFloorId) {
          setSelectedFloorId(floorsFromLocal[0].id);
        }
        
        await syncLocalPlanToServer(floorsFromLocal, roomsFromLocal, positionsFromLocal, false);
      }
    };

    loadPlan();
  }, [syncLocalPlanToServer]);

  // Charger les pièces disponibles
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoadingRooms(true);
        const roomsData = await roomsService.getAllRooms();
        setAvailableRooms(roomsData);
      } catch (error) {
        console.error('Erreur lors du chargement des pièces:', error);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, []);

  // Sauvegarder dans le localStorage (backup)
  useEffect(() => {
    if (floors.length > 0) {
      localStorage.setItem('lumy-floors', JSON.stringify(floors));
    }
  }, [floors]);

  useEffect(() => {
    if (rooms.length > 0) {
      localStorage.setItem('lumy-rooms', JSON.stringify(rooms));
    }
  }, [rooms]);

  useEffect(() => {
    if (devicePositions.length > 0) {
      localStorage.setItem('lumy-device-positions', JSON.stringify(devicePositions));
    }
  }, [devicePositions]);

  // Fonction de sauvegarde manuelle
  const handleSavePlan = async () => {
    try {
      await planService.savePlan(floors, rooms, devicePositions);
      addNotification({
        type: 'success',
        title: t('plan.saved'),
        message: t('plan.savedMessage'),
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du plan:', error);
      addNotification({
        type: 'error',
        title: t('plan.saveError'),
        message: t('plan.saveErrorMessage'),
      });
    }
  };

  // Fonction pour créer un nouvel étage
  const handleCreateFloor = () => {
    if (!newFloorName.trim()) return;
    
    const newFloor: Floor = {
      id: `floor-${Date.now()}`,
      name: newFloorName.trim(),
      order: floors.length,
    };
    
    setFloors((prev) => [...prev, newFloor]);
    setSelectedFloorId(newFloor.id);
    setNewFloorName('');
    setFloorDialogOpen(false);
  };

  const handleCreateRoom = () => {
    if (!isEditMode || !selectedFloorId) {
      if (!selectedFloorId) {
        addNotification({
          type: 'warning',
          title: t('plan.noFloorSelected'),
          message: t('plan.selectFloorFirst'),
        });
      }
      return;
    }
    setIsCreatingRoom(true);
    setSelectedRoom(null);
    if (roomMode === 'polyline') {
      setIsDrawingPolyline(true);
      setPolylinePoints([]);
    }
  };

  const handleResetPlan = () => {
    setFloors([]);
    setSelectedFloorId(null);
    setConfirmDialogConfig({
      title: t('plan.resetPlan'),
      message: t('plan.confirmReset'),
      onConfirm: () => {
        setRooms([]);
        setDevicePositions([]);
        setSelectedRoom(null);
        setIsCreatingRoom(false);
        localStorage.removeItem('lumy-rooms');
        localStorage.removeItem('lumy-device-positions');
        setConfirmDialogOpen(false);
        setConfirmDialogConfig(null);
      },
    });
    setConfirmDialogOpen(true);
  };

  const handleDeleteAllPlans = async () => {
    setConfirmDialogConfig({
      title: t('plan.deleteAllPlans'),
      message: t('plan.confirmDeleteAll'),
      onConfirm: async () => {
        try {
          await planService.deleteAllPlans();
          setFloors([]);
          setSelectedFloorId(null);
          setRooms([]);
          setDevicePositions([]);
          setSelectedRoom(null);
          setIsCreatingRoom(false);
          localStorage.removeItem('lumy-rooms');
          localStorage.removeItem('lumy-device-positions');
          localStorage.removeItem('lumy-floors');
          addNotification({
            type: 'success',
            title: t('plan.deleted'),
            message: t('plan.allPlansDeleted'),
          });
          setConfirmDialogOpen(false);
          setConfirmDialogConfig(null);
        } catch (error) {
          console.error('Erreur lors de la suppression des plans:', error);
          addNotification({
            type: 'error',
            title: t('plan.deleteError'),
            message: t('plan.deleteErrorMessage'),
          });
          setConfirmDialogOpen(false);
          setConfirmDialogConfig(null);
        }
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

    // Mode polyligne
    if (roomMode === 'polyline' && isDrawingPolyline) {
      // Double-clic pour terminer la polyligne
      if (e.detail === 2 && polylinePoints.length >= 3) {
        finishPolyline();
        return;
      }

      // Vérifier si on clique sur le point de départ pour fermer la polyligne
      if (polylinePoints.length >= 3) {
        const firstPoint = polylinePoints[0];
        // Utiliser une tolérance relative à la grille (1.5x la taille de la grille)
        const CLOSE_THRESHOLD = GRID_SIZE * 1.5; // 30 pixels avec GRID_SIZE = 20
        const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
        
        // Debug: afficher dans la console pour vérifier
        console.log('Clic détecté:', { x, y, firstPoint, distance, threshold: CLOSE_THRESHOLD, canClose: distance < CLOSE_THRESHOLD });
        
        if (distance < CLOSE_THRESHOLD) {
          console.log('Fermeture de la polyligne...');
          // Fermer la polyligne en ajoutant le premier point à la fin
          const closedPoints = [...polylinePoints, { x: firstPoint.x, y: firstPoint.y }];
          setPolylinePoints(closedPoints);
          
          // Mettre à jour la pièce avec les points fermés
          const xs = closedPoints.map(p => p.x);
          const ys = closedPoints.map(p => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);
          
          setRooms((prev) =>
            prev.map((room) =>
              room.id === selectedRoom
                ? {
                    ...room,
                    points: closedPoints,
                    x: minX,
                    y: minY,
                    width: maxX - minX || 1,
                    height: maxY - minY || 1,
                  }
                : room
            )
          );
          
          // Terminer la polyligne et ouvrir la fenêtre de nommage
          finishPolyline();
          return;
        }
      }

      // Ajouter un point
      const newPoints = [...polylinePoints, { x, y }];
      setPolylinePoints(newPoints);

      // Si c'est le premier point, créer la pièce temporaire
      if (polylinePoints.length === 0) {
        const tempRoomId = `temp-room-${Date.now()}`;
        const tempRoom: Room = {
          id: tempRoomId,
          name: '',
          x,
          y,
          width: 0,
          height: 0,
          color: newRoomColor,
          floorId: selectedFloorId || '',
          points: newPoints,
          isPolyline: true,
        };
        setSelectedRoom(tempRoomId);
        setRooms((prev) => [...prev, tempRoom]);
      } else {
        // Mettre à jour les points de la pièce et recalculer les bounds
        const xs = newPoints.map(p => p.x);
        const ys = newPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        
        setRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom
              ? {
                  ...room,
                  points: newPoints,
                  x: minX,
                  y: minY,
                  width: maxX - minX || 1,
                  height: maxY - minY || 1,
                }
              : room
          )
        );
      }
      return;
    }

    // Mode rectangle (code existant)
    const tempRoomId = `temp-room-${Date.now()}`;
    const tempRoom: Room = {
      id: tempRoomId,
      name: '',
      x,
      y,
      width: MIN_ROOM_SIZE,
      height: MIN_ROOM_SIZE,
      color: newRoomColor,
      floorId: selectedFloorId || '',
      isPolyline: false,
    };
    setRooms((prev) => [...prev, tempRoom]);
    setSelectedRoom(tempRoomId);
    setDragStart({ x, y });
    setIsDragging(true);
  };

  const finishPolyline = () => {
    if (!selectedRoom || polylinePoints.length < 3) {
      // Supprimer la pièce si elle n'a pas assez de points
      if (selectedRoom) {
        setRooms((prev) => prev.filter((r) => r.id !== selectedRoom));
      }
      setSelectedRoom(null);
      setIsDrawingPolyline(false);
      setPolylinePoints([]);
      return;
    }

    // Calculer les bounds pour x, y, width, height
    const xs = polylinePoints.map((p) => p.x);
    const ys = polylinePoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    setRooms((prev) =>
      prev.map((room) =>
        room.id === selectedRoom
          ? {
              ...room,
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
              points: polylinePoints,
            }
          : room
      )
    );

    setIsDrawingPolyline(false);
    setIsCreatingRoom(false);
    setPolylinePoints([]);
    // Initialiser le nom de la pièce si elle existe déjà dans la liste
    const room = rooms.find((r) => r.id === selectedRoom);
    if (room && !room.name) {
      setNewRoomName('');
    }
    setRoomDialogOpen(true);
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

    // Déplacement d'un point de polyligne
    if (isMovingPolylinePoint && movePointStart && movingPointRoomId !== null && movingPointIndex !== null) {
      const deltaX = currentX - movePointStart.x;
      const deltaY = currentY - movePointStart.y;

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== movingPointRoomId || !room.points) return room;

          const newPoints = room.points.map((p, idx) =>
            idx === movingPointIndex
              ? {
                  x: Math.max(0, movePointStart.pointX + deltaX),
                  y: Math.max(0, movePointStart.pointY + deltaY),
                }
              : p
          );

          // Recalculer les bounds de la pièce après le déplacement du point
          const xs = newPoints.map((p) => p.x);
          const ys = newPoints.map((p) => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);

          return {
            ...room,
            points: newPoints,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };
        })
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
          
          // Si c'est une polyligne, déplacer tous les points à partir des positions initiales
          if (room.isPolyline && room.points && moveStart.initialPoints) {
            const newPoints = moveStart.initialPoints.map((point) => ({
              x: Math.max(0, point.x + deltaX),
              y: Math.max(0, point.y + deltaY),
            }));
            
            // Recalculer les bounds
            const xs = newPoints.map((p) => p.x);
            const ys = newPoints.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            
            return {
              ...room,
              points: newPoints,
              x: minX,
              y: minY,
              width: maxX - minX || 1,
              height: maxY - minY || 1,
            };
          }
          
          // Pour les rectangles, déplacer normalement
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

    // Déplacement d'un point de polyligne
    if (isMovingPolylinePoint) {
      setIsMovingPolylinePoint(false);
      setMovingPointIndex(null);
      setMovingPointRoomId(null);
      setMovePointStart(null);
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

  const handlePolylinePointMouseDown = (e: React.MouseEvent, room: Room, pointIndex: number, point: Point) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Permettre le déplacement des points même si on est en train de créer une autre pièce
    // On vérifie seulement que c'est une pièce existante (pas une pièce temporaire en cours de création)
    if (!isEditMode || !room.points) {
      console.log('Déplacement de point bloqué:', { isEditMode, hasPoints: !!room.points });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;

    console.log('Début du déplacement du point:', { room: room.id, index: pointIndex, point, x, y });
    
    setSelectedRoom(room.id);
    setIsMovingPolylinePoint(true);
    setMovingPointIndex(pointIndex);
    setMovingPointRoomId(room.id);
    setMovePointStart({ x, y, pointX: point.x, pointY: point.y });
  };

  const handleRoomMouseDown = (e: React.MouseEvent, room: Room) => {
    e.stopPropagation();
    if (isCreatingRoom || !isEditMode) return;

    // Si c'est une polyligne, ne pas déplacer toute la pièce par défaut
    // (on peut le faire en cliquant ailleurs que sur les points)
    if (room.isPolyline && room.points) {
      setSelectedRoom(room.id);
      return;
    }

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


  const handleSaveRoom = async () => {
    if (!selectedRoom) return;
    
    // Utiliser customRoomName si newRoomName est vide
    const roomNameToUse = newRoomName.trim() || customRoomName.trim();
    if (!roomNameToUse) return;

    const room = rooms.find((r) => r.id === selectedRoom);
    if (room) {
      // Si le nom n'existe pas dans la liste des pièces disponibles, créer une nouvelle pièce
      const roomExists = availableRooms.find(r => r.name === roomNameToUse);
      if (!roomExists && !room.name) {
        try {
          await roomsService.createRoom(roomNameToUse);
          const updatedRooms = await roomsService.getAllRooms();
          setAvailableRooms(updatedRooms.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err: any) {
          console.error('Erreur lors de la création de la pièce:', err);
          // Continuer quand même avec la sauvegarde du plan
        }
      }

      // Mettre à jour la pièce existante
      if (room.id.startsWith('temp-room-')) {
        // Renommer la pièce temporaire
        setRooms((prev) =>
          prev.map((r) =>
            r.id === selectedRoom
              ? { ...r, id: `room-${Date.now()}`, name: roomNameToUse, color: newRoomColor }
              : r
          )
        );
      } else {
        // Mettre à jour une pièce existante
        setRooms((prev) =>
          prev.map((r) =>
            r.id === selectedRoom
              ? { ...r, name: roomNameToUse, color: newRoomColor }
              : r
          )
        );
      }
    }

    setRoomDialogOpen(false);
    setNewRoomName('');
    setCustomRoomName('');
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
    setCustomRoomName('');
    setUseCustomRoomName(false);
    setEditingRoom(null);
  };

  const handleCreateNewRoom = async () => {
    if (!customRoomName.trim()) return;
    try {
      const newRoom = await roomsService.createRoom(customRoomName.trim());
      setAvailableRooms((prev) => [...prev, newRoom].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRoomName(newRoom.name);
      setCustomRoomName('');
      setUseCustomRoomName(false);
      addNotification({
        type: 'success',
        title: t('plan.roomCreated'),
        message: t('plan.roomCreatedMessage', { room: newRoom.name }),
      });
    } catch (err: any) {
      console.error('Erreur lors de la création de la pièce:', err);
      addNotification({
        type: 'error',
        title: t('plan.roomCreateError'),
        message: err.message || t('plan.roomCreateErrorMessage'),
      });
    }
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


  const getDevicesWithoutRoom = () => {
    // Récupérer les IDs des pièces existantes
    const existingRoomIds = new Set(rooms.map((r) => r.id));
    
    return devices.filter(
      (device) => {
        // Vérifier si l'appareil est positionné dans une pièce existante
        const position = devicePositions.find((p) => p.deviceId === device.ieeeAddress);
        const isPositionedInValidRoom = position && existingRoomIds.has(position.roomId);
        
        // L'appareil est disponible s'il n'est pas positionné OU s'il est positionné dans une pièce qui n'existe plus
        return (
          !isPositionedInValidRoom &&
          device.friendlyName?.toLowerCase() !== 'coordinator' &&
          device.type !== 'unknown'
        );
      }
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
          {floors.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Chip
                label={selectedFloorId ? floors.find(f => f.id === selectedFloorId)?.name || t('plan.selectFloor') : t('plan.selectFloor')}
                variant="outlined"
                sx={{ mr: 1 }}
              />
              {floors.map((floor) => (
                <Chip
                  key={floor.id}
                  label={floor.name}
                  onClick={() => setSelectedFloorId(floor.id)}
                  color={selectedFloorId === floor.id ? 'primary' : 'default'}
                  variant={selectedFloorId === floor.id ? 'filled' : 'outlined'}
                  sx={{ mr: 1, mt: 1 }}
                />
              ))}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
          <Stack direction="row" spacing={1} alignItems="center">
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
            {isEditMode && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSavePlan}
                disabled={floors.length === 0 && rooms.length === 0 && devicePositions.length === 0}
              >
                {t('plan.save')}
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              startIcon={<RefreshIcon />}
              onClick={handleResetPlan}
              disabled={!isEditMode}
            >
              {t('plan.resetPlan')}
            </Button>
            {!isEditMode && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteAllPlans}
              >
                {t('plan.deleteAllPlans')}
              </Button>
            )}
          </Stack>
          {isEditMode && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                startIcon={<LayersIcon />}
                onClick={() => setFloorDialogOpen(true)}
              >
                {t('plan.addFloor')}
              </Button>
              <Button
                variant={roomMode === 'rectangle' ? 'contained' : 'outlined'}
                startIcon={<CropFreeIcon />}
                onClick={() => {
                  setRoomMode('rectangle');
                  setIsDrawingPolyline(false);
                  setPolylinePoints([]);
                }}
                disabled={!selectedFloorId}
              >
                {t('plan.rectangleMode')}
              </Button>
              <Button
                variant={roomMode === 'polyline' ? 'contained' : 'outlined'}
                startIcon={<PolylineIcon />}
                onClick={() => {
                  setRoomMode('polyline');
                  setIsDrawingPolyline(false);
                  setPolylinePoints([]);
                }}
                disabled={!selectedFloorId}
              >
                {t('plan.polylineMode')}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateRoom}
                disabled={isCreatingRoom || !selectedFloorId}
              >
                {t('plan.addRoom')}
              </Button>
            </Stack>
          )}
        </Box>
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
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  // Arrêter les opérations si la souris quitte le canvas
                  if (isDragging || isMovingRoom || isResizingRoom || isMovingDevice || isMovingPolylinePoint) {
                    handleCanvasMouseUp();
                  }
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
              >
                {/* Polyligne en cours de dessin */}
                {isDrawingPolyline && selectedRoom && polylinePoints.length > 0 && (
                  <>
                    {polylinePoints.length > 1 && (
                      <svg
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none',
                          zIndex: 10,
                        }}
                      >
                        {polylinePoints.map((point, index) => {
                          if (index === 0) return null;
                          const prevPoint = polylinePoints[index - 1];
                          return (
                            <line
                              key={`line-${index}`}
                              x1={prevPoint.x}
                              y1={prevPoint.y}
                              x2={point.x}
                              y2={point.y}
                              stroke="#86A6A0"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          );
                        })}
                        {/* Ligne de prévisualisation pour fermer la polyligne si on a au moins 3 points */}
                        {polylinePoints.length >= 3 && (
                          <line
                            x1={polylinePoints[polylinePoints.length - 1].x}
                            y1={polylinePoints[polylinePoints.length - 1].y}
                            x2={polylinePoints[0].x}
                            y2={polylinePoints[0].y}
                            stroke="#4CAF50"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                            opacity="0.5"
                          />
                        )}
                      </svg>
                    )}
                    {polylinePoints.map((point, index) => {
                      const isFirstPoint = index === 0;
                      const canClose = polylinePoints.length >= 3 && isFirstPoint;
                      return (
                        <Box
                          key={`point-${index}`}
                          onClick={(e) => {
                            if (canClose) {
                              e.stopPropagation();
                              console.log('Clic sur le premier point pour fermer la polyligne');
                              // Fermer la polyligne en ajoutant le premier point à la fin
                              const closedPoints = [...polylinePoints, { x: point.x, y: point.y }];
                              setPolylinePoints(closedPoints);
                              
                              // Mettre à jour la pièce avec les points fermés
                              const xs = closedPoints.map(p => p.x);
                              const ys = closedPoints.map(p => p.y);
                              const minX = Math.min(...xs);
                              const minY = Math.min(...ys);
                              const maxX = Math.max(...xs);
                              const maxY = Math.max(...ys);
                              
                              setRooms((prev) =>
                                prev.map((room) =>
                                  room.id === selectedRoom
                                    ? {
                                        ...room,
                                        points: closedPoints,
                                        x: minX,
                                        y: minY,
                                        width: maxX - minX || 1,
                                        height: maxY - minY || 1,
                                      }
                                    : room
                                )
                              );
                              
                              // Terminer la polyligne et ouvrir la fenêtre de nommage
                              finishPolyline();
                            }
                          }}
                          sx={{
                            position: 'absolute',
                            left: point.x - (isFirstPoint && canClose ? 8 : 6),
                            top: point.y - (isFirstPoint && canClose ? 8 : 6),
                            width: isFirstPoint && canClose ? 16 : 12,
                            height: isFirstPoint && canClose ? 16 : 12,
                            borderRadius: '50%',
                            backgroundColor: canClose ? '#4CAF50' : '#86A6A0',
                            border: '2px solid white',
                            boxShadow: canClose ? '0 0 8px rgba(76, 175, 80, 0.6)' : '0 2px 4px rgba(0,0,0,0.2)',
                            pointerEvents: canClose ? 'auto' : 'none',
                            cursor: canClose ? 'pointer' : 'default',
                            zIndex: 11,
                            animation: canClose ? 'pulse 2s infinite' : 'none',
                            '@keyframes pulse': {
                              '0%, 100%': {
                                transform: 'scale(1)',
                                opacity: 1,
                              },
                              '50%': {
                                transform: 'scale(1.2)',
                                opacity: 0.8,
                              },
                            },
                            '&:hover': canClose ? {
                              transform: 'scale(1.3)',
                              boxShadow: '0 0 12px rgba(76, 175, 80, 0.8)',
                            } : {},
                          }}
                        />
                      );
                    })}
                  </>
                )}

                {/* Pièces - rendues en premier avec z-index bas */}
                {rooms.filter(room => !selectedFloorId || room.floorId === selectedFloorId).map((room) => {
                  const isSelected = selectedRoom === room.id;
                  
                  // Si c'est une polyligne, utiliser SVG
                  if (room.isPolyline && room.points && room.points.length >= 2) {
                    // Calculer les bounds pour l'affichage
                    const xs = room.points.map(p => p.x);
                    const ys = room.points.map(p => p.y);
                    const minX = Math.min(...xs);
                    const minY = Math.min(...ys);
                    const maxX = Math.max(...xs);
                    const maxY = Math.max(...ys);
                    const svgWidth = maxX - minX || 100;
                    const svgHeight = maxY - minY || 100;
                    
                    // Convertir les points en coordonnées relatives au SVG
                    const pointsString = room.points.map(p => `${p.x - minX},${p.y - minY}`).join(' ');
                    
                    return (
                      <Box
                        key={room.id}
                        data-room={room.id}
                        sx={{
                          position: 'absolute',
                          left: minX,
                          top: minY,
                          width: svgWidth,
                          height: svgHeight,
                          cursor: isCreatingRoom || !isEditMode ? 'default' : 'move',
                          opacity: 0.7,
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          zIndex: 1,
                          '&:hover': {
                            opacity: 0.9,
                          },
                        }}
                        onMouseDown={(e) => {
                          // Si on clique sur la surface (pas sur un point), permettre de déplacer toute la polyligne
                          // Ignorer si on a cliqué sur un point (les points gèrent leur propre événement)
                          if ((e.target as HTMLElement).closest('[data-room-point]')) {
                            return;
                          }
                          
                          if (isEditMode && !isCreatingRoom) {
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (rect) {
                              const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
                              const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;
                              // Vérifier si on a cliqué sur un point (avec une tolérance de 15px pour être sûr)
                              const clickedOnPoint = room.points?.some((p) => {
                                const pointX = p.x;
                                const pointY = p.y;
                                const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2));
                                return distance < 15;
                              });
                              
                              if (!clickedOnPoint) {
                                setSelectedRoom(room.id);
                                setIsMovingRoom(true);
                                setMovingRoomId(room.id);
                                // Pour les polylignes, stocker les points initiaux
                                setMoveStart({ 
                                  x, 
                                  y, 
                                  roomX: minX, 
                                  roomY: minY,
                                  initialPoints: room.points ? [...room.points] : undefined
                                });
                              }
                            }
                          }
                        }}
                      >
                        <svg
                          width={svgWidth}
                          height={svgHeight}
                          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}
                        >
                          {room.points.length >= 3 ? (
                            <polygon
                              points={pointsString}
                              fill={room.color}
                              stroke={isSelected ? '#86A6A0' : 'rgba(0,0,0,0.2)'}
                              strokeWidth="2"
                            />
                          ) : (
                            <polyline
                              points={pointsString}
                              fill="none"
                              stroke={newRoomColor}
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          )}
                        </svg>
                        {/* Afficher les points de la polyligne */}
                        {isEditMode && room.points.map((point, index) => (
                          <Box
                            key={`room-point-${index}`}
                            data-room-point={room.id}
                            data-point-index={index}
                            sx={{
                              position: 'absolute',
                              left: point.x - minX - 8,
                              top: point.y - minY - 8,
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              backgroundColor: isSelected ? '#86A6A0' : '#86A6A0',
                              border: '2px solid white',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                              cursor: 'grab',
                              zIndex: 25,
                              pointerEvents: 'auto',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                backgroundColor: '#4CAF50',
                                transform: 'scale(1.3)',
                                boxShadow: '0 4px 12px rgba(76, 175, 80, 0.6)',
                                zIndex: 26,
                              },
                              '&:active': {
                                cursor: 'grabbing',
                                transform: 'scale(1.1)',
                              },
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              console.log('Clic sur point de polyligne:', { room: room.id, index, point, isEditMode, isCreatingRoom });
                              handlePolylinePointMouseDown(e, room, index, point);
                            }}
                          />
                        ))}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            right: 8,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            pointerEvents: 'none',
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
                              userSelect: 'none',
                              WebkitUserSelect: 'none',
                            }}
                          >
                            {room.name}
                          </Typography>
                          <Stack direction="row" spacing={0.5} sx={{ pointerEvents: 'auto' }}>
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
                      </Box>
                    );
                  }
                  
                  // Rectangle classique
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
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        zIndex: 1,
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
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
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
                
                {/* Tous les appareils rendus après les pièces pour garantir qu'ils sont au-dessus */}
                {devicePositions.map((position) => {
                  const device = devices.find((d) => d.ieeeAddress === position.deviceId);
                  if (!device) return null;
                  
                  // Vérifier que la pièce existe toujours
                  const room = rooms.find((r) => r.id === position.roomId);
                  if (!room) return null;
                  
                  const isMoving = isMovingDevice && movingDeviceId === position.deviceId;
                  
                  // Les positions dans devicePositions sont déjà absolues (coordonnées sur le canvas)
                  return (
                    <Tooltip key={position.deviceId} title={device.friendlyName || device.ieeeAddress}>
                      <Box
                        data-device={position.deviceId}
                        sx={{
                          position: 'absolute',
                          left: position.x,
                          top: position.y,
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
                          zIndex: isMoving ? 100 : 50,
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          '&:hover': {
                            transform: isMoving ? 'none' : 'scale(1.1)',
                            zIndex: 50,
                          },
                          '&:active': {
                            cursor: 'grabbing',
                          },
                        }}
                        onMouseDown={(e) => {
                          if (isEditMode) {
                            e.stopPropagation();
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
                            const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;
                            setIsMovingDevice(true);
                            setMovingDeviceId(position.deviceId);
                            setMoveDeviceStart({ x, y, deviceX: position.x, deviceY: position.y, roomId: position.roomId });
                          }
                        }}
                      >
                        {getDeviceIcon(device.type)}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>
                  {t('plan.devices')}
                </Typography>
                {devicePositions.length > 0 && (
                  <Tooltip title={t('plan.removeAllDevices')}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setConfirmDialogConfig({
                          title: t('plan.removeAllDevices'),
                          message: t('plan.confirmRemoveAllDevices'),
                          onConfirm: () => {
                            setDevicePositions([]);
                            setConfirmDialogOpen(false);
                            setConfirmDialogConfig(null);
                            addNotification({
                              message: t('plan.allDevicesRemoved'),
                              type: 'success',
                            });
                          },
                        });
                        setConfirmDialogOpen(true);
                      }}
                      sx={{
                        color: 'error.main',
                        '&:hover': {
                          backgroundColor: 'error.light',
                          color: 'error.dark',
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
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
          {!useCustomRoomName ? (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="room-select-label">{t('plan.roomName')}</InputLabel>
                <Select
                  labelId="room-select-label"
                  value={newRoomName}
                  label={t('plan.roomName')}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  disabled={loadingRooms}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>{t('plan.selectOrCreateRoom')}</em>
                  </MenuItem>
                  {availableRooms.map((room) => (
                    <MenuItem key={room.id} value={room.name}>
                      {translateRoomName(room.name)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <Divider sx={{ flex: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  {t('plan.or')}
                </Typography>
                <Divider sx={{ flex: 1 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  label={t('plan.newRoomName')}
                  value={customRoomName}
                  onChange={(e) => {
                    setCustomRoomName(e.target.value);
                    // Mettre à jour aussi newRoomName pour permettre la sauvegarde directe
                    if (e.target.value.trim()) {
                      setNewRoomName(e.target.value.trim());
                    }
                  }}
                  placeholder={t('plan.newRoomNamePlaceholder')}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateNewRoom();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<AddCircleIcon />}
                  onClick={handleCreateNewRoom}
                  disabled={!customRoomName.trim()}
                  sx={{ minWidth: 'auto' }}
                >
                  {t('plan.addRoom')}
                </Button>
              </Box>
            </>
          ) : (
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
          )}
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
          <Button 
            onClick={handleSaveRoom} 
            variant="contained" 
            disabled={!newRoomName.trim() && !customRoomName.trim()}
          >
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

      {/* Dialog pour créer un étage */}
      <Dialog open={floorDialogOpen} onClose={() => setFloorDialogOpen(false)}>
        <DialogTitle>{t('plan.createFloor')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('plan.floorName')}
            fullWidth
            variant="outlined"
            value={newFloorName}
            onChange={(e) => setNewFloorName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFloor();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFloorDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateFloor} variant="contained" disabled={!newFloorName.trim()}>
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

