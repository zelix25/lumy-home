import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Collapse,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  HelpOutline as HelpOutlineIcon,
  Lightbulb as LightbulbIcon,
  DirectionsRun as MotionIcon,
  Lock as ContactIcon,
  Thermostat as TemperatureIcon,
  TouchApp as ButtonIcon,
  Vibration as VibrationIcon,
  WbSunny as IlluminanceIcon,
  WaterDrop as HumidityIcon,
  LeakAdd as WaterLeakIcon,
  LocalFireDepartment as SmokeIcon,
  GasMeter as GasIcon,
  WbTwilight as SunriseSunsetIcon,
  AccessTime as TimeIcon,
  Settings as ManualIcon,
  PowerSettingsNew as TurnOnIcon,
  PowerOff as TurnOffIcon,
  SwapHoriz as ToggleIcon,
  Brightness6 as BrightnessIcon,
  Palette as ColorIcon,
  WbIncandescent as ColorTempIcon,
  AcUnit as ThermostatIcon,
  Notifications as NotifyIcon,
} from '@mui/icons-material';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  BackgroundVariant,
  Position,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  ConnectionLineType,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTranslation } from 'react-i18next';
import { useDevices } from '../hooks/useDevices';
import {
  AutomationTriggerType,
  AutomationActionType,
  CreateAutomationDto,
  simpleAutomationsService,
} from '../services/simple-automations.service';
import { useNotification } from '../hooks/useNotification';
import {
  getCompatibleDevicesForTrigger,
  getCompatibleDevicesForAction,
  getTriggerDescription,
} from '../utils/deviceFilter';
import { Info as InfoIcon } from '@mui/icons-material';

// Fonction pour obtenir l'icône selon le type de déclencheur
const getTriggerIcon = (triggerType: AutomationTriggerType) => {
  switch (triggerType) {
    case AutomationTriggerType.MOTION:
      return <MotionIcon />;
    case AutomationTriggerType.CONTACT:
      return <ContactIcon />;
    case AutomationTriggerType.TEMPERATURE:
      return <TemperatureIcon />;
    case AutomationTriggerType.BUTTON:
      return <ButtonIcon />;
    case AutomationTriggerType.VIBRATION:
      return <VibrationIcon />;
    case AutomationTriggerType.ILLUMINANCE:
      return <IlluminanceIcon />;
    case AutomationTriggerType.HUMIDITY:
      return <HumidityIcon />;
    case AutomationTriggerType.WATER_LEAK:
      return <WaterLeakIcon />;
    case AutomationTriggerType.SMOKE:
      return <SmokeIcon />;
    case AutomationTriggerType.GAS:
      return <GasIcon />;
    case AutomationTriggerType.SUNRISE_SUNSET:
      return <SunriseSunsetIcon />;
    case AutomationTriggerType.TIME:
      return <TimeIcon />;
    case AutomationTriggerType.MANUAL:
      return <ManualIcon />;
    default:
      return <HelpOutlineIcon />;
  }
};

// Fonction pour obtenir l'icône selon le type d'action
const getActionIcon = (actionType: AutomationActionType) => {
  switch (actionType) {
    case AutomationActionType.TURN_ON:
      return <TurnOnIcon />;
    case AutomationActionType.TURN_OFF:
      return <TurnOffIcon />;
    case AutomationActionType.TOGGLE:
      return <ToggleIcon />;
    case AutomationActionType.SET_BRIGHTNESS:
      return <BrightnessIcon />;
    case AutomationActionType.SET_COLOR:
      return <ColorIcon />;
    case AutomationActionType.SET_COLOR_TEMP:
      return <ColorTempIcon />;
    case AutomationActionType.SET_THERMOSTAT:
      return <ThermostatIcon />;
    case AutomationActionType.NOTIFY:
      return <NotifyIcon />;
    default:
      return <HelpOutlineIcon />;
  }
};

interface NodeEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  automation?: any;
}

// Types de noeuds personnalisés
interface TriggerNodeData {
  label: string;
  triggerType: AutomationTriggerType;
  deviceId?: string;
  deviceName?: string;
  operator?: '>' | '<' | '>=' | '<=' | '=';
  value?: number;
}

interface ActionNodeData {
  label: string;
  actionType: AutomationActionType;
  deviceId?: string;
  deviceName?: string;
  params?: Record<string, any>;
  duration?: number; // Durée en secondes pour l'action TURN_ON (0 = infini)
}

interface ConditionNodeData {
  label: string;
  condition: 'AND' | 'OR';
}

// Composants de noeuds personnalisés
const TriggerNode = ({ data }: { data: TriggerNodeData }) => {
  const triggerIcon = getTriggerIcon(data.triggerType);
  
  return (
    <Paper
      sx={{
        p: 2,
        minWidth: 180,
        bgcolor: '#E3F2FD',
        border: '2px solid #2196F3',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: '#2196F3',
            color: 'white',
          }}
        >
          {triggerIcon}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          {data.label}
        </Typography>
      </Box>
      {data.deviceName && (
        <Chip 
          label={data.deviceName} 
          size="small" 
          sx={{ mt: 0.5, width: '100%' }}
          color="primary"
          variant="outlined"
        />
      )}
      {/* Handle de sortie à droite */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#2196F3',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
    </Paper>
  );
};

const ActionNode = ({ data }: { data: ActionNodeData }) => {
  const actionIcon = getActionIcon(data.actionType);
  
  return (
    <Paper
      sx={{
        p: 2,
        minWidth: 180,
        bgcolor: '#F3E5F5',
        border: '2px solid #9C27B0',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: '#9C27B0',
            color: 'white',
          }}
        >
          {actionIcon}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          {data.label}
        </Typography>
      </Box>
      {data.deviceName && (
        <Chip 
          label={data.deviceName} 
          size="small" 
          sx={{ mt: 0.5, width: '100%' }}
          color="secondary"
          variant="outlined"
        />
      )}
      {/* Handle d'entrée à gauche */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#9C27B0',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
      {/* Handle de sortie à droite (pour chaîner les actions) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#9C27B0',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
    </Paper>
  );
};

const ConditionNode = ({ data }: { data: ConditionNodeData }) => {
  const conditionIcon = data.condition === 'AND' ? (
    <Typography variant="h6" sx={{ fontWeight: 700 }}>&&</Typography>
  ) : (
    <Typography variant="h6" sx={{ fontWeight: 700 }}>||</Typography>
  );
  
  return (
    <Paper
      sx={{
        p: 2,
        minWidth: 150,
        bgcolor: '#FFF3E0',
        border: '2px solid #FF9800',
        borderRadius: 2,
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: '#FF9800',
            color: 'white',
          }}
        >
          {conditionIcon}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {data.label}
        </Typography>
        <Chip 
          label={data.condition} 
          size="small" 
          sx={{ mt: 0.5 }} 
          color="warning" 
        />
      </Box>
      {/* Handle d'entrée à gauche */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#FF9800',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
      {/* Handle de sortie à droite */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#FF9800',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
    </Paper>
  );
};

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

// Composant interne pour gérer l'ajout de noeuds avec conversion de coordonnées
function FlowContent({
  nodes,
  setNodes,
  edges,
  setEdges,
  onNodesChange,
  onEdgesChange,
  handleConnect,
  menuPosition,
  setMenuPosition,
  selectedNodeId,
  setSelectedNodeId,
  devices,
  t,
  defaultEdgeOptions,
}: {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: any[];
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  onNodesChange: any;
  onEdgesChange: any;
  handleConnect: (params: Connection) => void;
  menuPosition: { x: number; y: number } | null;
  setMenuPosition: (pos: { x: number; y: number } | null) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  devices: any[];
  t: (key: string) => string;
  defaultEdgeOptions: any;
}) {
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = useCallback(
    (type: 'trigger' | 'action' | 'condition', screenPosition: { x: number; y: number }) => {
      // Convertir les coordonnées de l'écran en coordonnées du flow
      const flowPosition = screenToFlowPosition({ x: screenPosition.x, y: screenPosition.y });
      const newNodeId = `${type}-${Date.now()}`;
      let newNode: Node;

      if (type === 'trigger') {
        newNode = {
          id: newNodeId,
          type: 'trigger',
          position: flowPosition,
          data: {
            label: t('automations.triggerMotion'),
            triggerType: AutomationTriggerType.MOTION,
          },
          sourcePosition: Position.Right,
        };
      } else if (type === 'action') {
        newNode = {
          id: newNodeId,
          type: 'action',
          position: flowPosition,
          data: {
            label: t('automations.actionTurnOn'),
            actionType: AutomationActionType.TURN_ON,
          },
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        };
      } else {
        newNode = {
          id: newNodeId,
          type: 'condition',
          position: flowPosition,
          data: {
            label: t('automations.nodeEditor.condition'),
            condition: 'AND' as const,
          },
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        };
      }

      setNodes((nds) => [...nds, newNode]);
      setMenuPosition(null);
    },
    [t, setNodes, screenToFlowPosition],
  );

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setMenuPosition({ x: event.clientX, y: event.clientY });
    },
    [setMenuPosition],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      <Menu
        open={!!menuPosition}
        onClose={() => setMenuPosition(null)}
        anchorReference="anchorPosition"
        anchorPosition={menuPosition ? { top: menuPosition.y, left: menuPosition.x } : undefined}
      >
        <MenuItem
          onClick={() => {
            if (menuPosition) {
              handleAddNode('trigger', menuPosition);
            }
          }}
        >
          {t('automations.nodeEditor.addTrigger')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuPosition) {
              handleAddNode('action', menuPosition);
            }
          }}
        >
          {t('automations.nodeEditor.addAction')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuPosition) {
              handleAddNode('condition', menuPosition);
            }
          }}
        >
          {t('automations.nodeEditor.addCondition')}
        </MenuItem>
      </Menu>
    </>
  );
}

export default function NodeEditorDialog({
  open,
  onClose,
  onSuccess,
}: NodeEditorDialogProps) {
  const { t } = useTranslation();
  const { devices } = useDevices();
  const { addNotification } = useNotification();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  // Initialiser les noeuds sans déclencheur par défaut
  const initialNodes: Node[] = useMemo(
    () => [],
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  
  // Obtenir le node sélectionné depuis le tableau nodes
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Calculer les valeurs pour le trigger sélectionné
  const triggerSettings = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'trigger') return null;
    const triggerData = selectedNode.data as TriggerNodeData;
    const compatibleDevices = getCompatibleDevicesForTrigger(devices, triggerData.triggerType);
    const needsDevice = 
      triggerData.triggerType !== AutomationTriggerType.SUNRISE_SUNSET &&
      triggerData.triggerType !== AutomationTriggerType.TIME &&
      triggerData.triggerType !== AutomationTriggerType.MANUAL;
    const description = getTriggerDescription(triggerData.triggerType);
    return { triggerData, compatibleDevices, needsDevice, description };
  }, [selectedNode, devices]);

  // Calculer les valeurs pour l'action sélectionnée
  const actionSettings = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'action') return null;
    const actionData = selectedNode.data as ActionNodeData;
    const compatibleDevices = getCompatibleDevicesForAction(devices, actionData.actionType);
    const needsDevice = actionData.actionType !== AutomationActionType.NOTIFY;
    return { actionData, compatibleDevices, needsDevice };
  }, [selectedNode, devices]);

  // Styles personnalisés pour les edges (connexions)
  const defaultEdgeOptions = useMemo(
    () => ({
      style: {
        strokeWidth: 2,
        stroke: '#6366f1',
      },
      type: 'smoothstep' as ConnectionLineType,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
      },
    }),
    [],
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      // Créer un edge avec les options par défaut
      const newEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        type: defaultEdgeOptions.type,
        animated: defaultEdgeOptions.animated,
        style: defaultEdgeOptions.style,
        markerEnd: defaultEdgeOptions.markerEnd,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, defaultEdgeOptions],
  );


  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges],
  );

  const handleSave = async () => {
    if (!name.trim()) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nameRequired'),
      });
      return;
    }

    // Convertir le flux de noeuds en automation
    const triggerNodes = nodes.filter((n) => n.type === 'trigger');
    const actionNodes = nodes.filter((n) => n.type === 'action');

    if (triggerNodes.length === 0) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nodeEditor.noTriggerNode'),
      });
      return;
    }

    if (actionNodes.length === 0) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nodeEditor.noActionNode'),
      });
      return;
    }

    // Prendre le premier noeud trigger (on peut améliorer pour supporter plusieurs triggers)
    const triggerNode = triggerNodes[0];
    const triggerData = triggerNode.data as TriggerNodeData;

    // Trouver les actions connectées au trigger
    const connectedActionIds = edges
      .filter((e) => e.source === triggerNode.id)
      .map((e) => e.target);

    // Si des conditions sont présentes, suivre les connexions
    const finalActionIds = connectedActionIds.filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node?.type === 'action';
    });

    if (finalActionIds.length === 0) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nodeEditor.noConnectedActions'),
      });
      return;
    }

    // Créer les actions
    const actions = finalActionIds.map((actionId) => {
      const actionNode = nodes.find((n) => n.id === actionId);
      const actionData = actionNode?.data as ActionNodeData;
      const params = { ...actionData.params };
      
      // Ajouter la durée pour l'action TURN_ON
      if (actionData.actionType === AutomationActionType.TURN_ON && actionData.duration !== undefined) {
        params.duration = actionData.duration;
      }
      
      return {
        type: actionData.actionType,
        deviceId: actionData.deviceId || '',
        deviceName: actionData.deviceName,
        params: Object.keys(params).length > 0 ? params : undefined,
      };
    });

    try {
      const createData: CreateAutomationDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger: {
          type: triggerData.triggerType,
          deviceId: triggerData.deviceId,
          deviceName: triggerData.deviceName,
          condition: triggerData.operator && triggerData.value !== undefined
            ? {
                operator: triggerData.operator,
                value: triggerData.value,
              }
            : undefined,
        },
        actions,
      };

      await simpleAutomationsService.create(createData);
      addNotification({
        type: 'success',
        title: t('automations.created'),
        message: t('automations.createdMessage'),
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: error.message || t('automations.createError'),
      });
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setNodes(initialNodes);
    setEdges([]);
    setSelectedNodeId(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{t('automations.nodeEditor.title')}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton size="small" onClick={() => {/* Zoom in */}}>
              <ZoomInIcon />
            </IconButton>
            <IconButton size="small" onClick={() => {/* Zoom out */}}>
              <ZoomOutIcon />
            </IconButton>
            <IconButton size="small" onClick={() => {/* Fit screen */}}>
              <FitScreenIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Bannière d'aide */}
        <Alert 
          severity="info" 
          icon={<HelpOutlineIcon />}
          sx={{ mb: 2 }}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setShowHelp(!showHelp)}
            >
              {showHelp ? '▼' : '▲'}
            </IconButton>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {t('automations.nodeEditor.helpTitle')}
          </Typography>
          <Collapse in={showHelp}>
            <List dense sx={{ py: 0 }}>
              <ListItem sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography variant="body2" color="text.secondary">1.</Typography>
                </ListItemIcon>
                <ListItemText 
                  primary={t('automations.nodeEditor.helpStep1')}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography variant="body2" color="text.secondary">2.</Typography>
                </ListItemIcon>
                <ListItemText 
                  primary={t('automations.nodeEditor.helpStep2')}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography variant="body2" color="text.secondary">3.</Typography>
                </ListItemIcon>
                <ListItemText 
                  primary={t('automations.nodeEditor.helpStep3')}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography variant="body2" color="text.secondary">4.</Typography>
                </ListItemIcon>
                <ListItemText 
                  primary={t('automations.nodeEditor.helpStep4')}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography variant="body2" color="text.secondary">5.</Typography>
                </ListItemIcon>
                <ListItemText 
                  primary={t('automations.nodeEditor.helpStep5')}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LightbulbIcon sx={{ fontSize: 16, color: 'warning.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('automations.nodeEditor.helpTip')}
              </Typography>
            </Box>
          </Collapse>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <TextField
            label={t('automations.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
            helperText={t('automations.name') + ' ' + t('automations.nodeEditor.helpStep5')}
          />
          <TextField
            label={t('automations.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            helperText={t('automations.description') + ' (optionnel)'}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, height: 600 }}>
          {/* Zone d'édition ReactFlow */}
          <Box sx={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: 1, position: 'relative' }}>
            {nodes.length === 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10,
                  textAlign: 'center',
                  pointerEvents: 'none',
                  width: '80%',
                  maxWidth: 500,
                }}
              >
                <Paper
                  sx={{
                    p: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    boxShadow: 4,
                    borderRadius: 2,
                  }}
                >
                  <HelpOutlineIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                    {t('automations.nodeEditor.emptyState')}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    {t('automations.nodeEditor.helpStep1')}
                  </Typography>
                  <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">
                      💡 {t('automations.nodeEditor.helpTip')}
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}
            <ReactFlowProvider>
              <FlowContent
                nodes={nodes}
                setNodes={setNodes}
                edges={edges}
                setEdges={setEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                handleConnect={handleConnect}
                menuPosition={menuPosition}
                setMenuPosition={setMenuPosition}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
                devices={devices}
                t={t}
                defaultEdgeOptions={defaultEdgeOptions}
              />
            </ReactFlowProvider>
          </Box>

          {/* Panneau de paramètres à droite */}
          <Paper 
            sx={{ 
              width: 350,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              maxHeight: '100%',
            }}
            elevation={3}
          >
            {selectedNode ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {t('automations.nodeEditor.nodeSettings')}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => selectedNodeId && handleDeleteNode(selectedNodeId)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
            {triggerSettings && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                      {t('automations.nodeEditor.triggerType')}
                    </Typography>
                    <Tooltip title={t('automations.nodeEditor.helpStep4')} arrow>
                      <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                  <Select
                    value={triggerSettings.triggerData.triggerType}
                    label={t('automations.nodeEditor.triggerType')}
                    displayEmpty
                    onChange={(e) => {
                        const triggerType = e.target.value as AutomationTriggerType;
                        const triggerLabels: Record<AutomationTriggerType, string> = {
                          [AutomationTriggerType.MOTION]: t('automations.triggerMotion'),
                          [AutomationTriggerType.CONTACT]: t('automations.triggerContact'),
                          [AutomationTriggerType.TEMPERATURE]: t('automations.triggerTemperature'),
                          [AutomationTriggerType.BUTTON]: t('automations.triggerButton'),
                          [AutomationTriggerType.VIBRATION]: t('automations.triggerVibration'),
                          [AutomationTriggerType.ILLUMINANCE]: t('automations.triggerIlluminance'),
                          [AutomationTriggerType.HUMIDITY]: t('automations.triggerHumidity'),
                          [AutomationTriggerType.WATER_LEAK]: t('automations.triggerWaterLeak'),
                          [AutomationTriggerType.SMOKE]: t('automations.triggerSmoke'),
                          [AutomationTriggerType.GAS]: t('automations.triggerGas'),
                          [AutomationTriggerType.SUNRISE_SUNSET]: t('automations.triggerSunriseSunset'),
                          [AutomationTriggerType.TIME]: t('automations.triggerTime'),
                          [AutomationTriggerType.MANUAL]: t('automations.triggerManual'),
                        };
                        setNodes((nds) =>
                          nds.map((node) =>
                            node.id === selectedNodeId
                              ? {
                                  ...node,
                                  data: {
                                    ...node.data,
                                    triggerType,
                                    label: triggerLabels[triggerType] || triggerType,
                                    // Réinitialiser l'appareil si le type change
                                    deviceId: undefined,
                                    deviceName: undefined,
                                  },
                                }
                              : node,
                          ),
                        );
                      }}
                    >
                      {Object.values(AutomationTriggerType).map((type) => {
                        const triggerLabels: Record<AutomationTriggerType, string> = {
                          [AutomationTriggerType.MOTION]: t('automations.triggerMotion'),
                          [AutomationTriggerType.CONTACT]: t('automations.triggerContact'),
                          [AutomationTriggerType.TEMPERATURE]: t('automations.triggerTemperature'),
                          [AutomationTriggerType.BUTTON]: t('automations.triggerButton'),
                          [AutomationTriggerType.VIBRATION]: t('automations.triggerVibration'),
                          [AutomationTriggerType.ILLUMINANCE]: t('automations.triggerIlluminance'),
                          [AutomationTriggerType.HUMIDITY]: t('automations.triggerHumidity'),
                          [AutomationTriggerType.WATER_LEAK]: t('automations.triggerWaterLeak'),
                          [AutomationTriggerType.SMOKE]: t('automations.triggerSmoke'),
                          [AutomationTriggerType.GAS]: t('automations.triggerGas'),
                          [AutomationTriggerType.SUNRISE_SUNSET]: t('automations.triggerSunriseSunset'),
                          [AutomationTriggerType.TIME]: t('automations.triggerTime'),
                          [AutomationTriggerType.MANUAL]: t('automations.triggerManual'),
                        };
                        return (
                          <MenuItem key={type} value={type}>
                            {triggerLabels[type] || type}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>

                  {/* Description du déclencheur */}
                  {triggerSettings.description && (
                    <Alert 
                      severity="info" 
                      icon={<InfoIcon />}
                      sx={{ 
                        '& .MuiAlert-message': { 
                          fontSize: '0.875rem',
                          lineHeight: 1.5,
                        } 
                      }}
                    >
                      {triggerSettings.description}
                    </Alert>
                  )}

                  {/* Sélection de l'appareil (uniquement si nécessaire) */}
                  {triggerSettings.needsDevice && (
                    <FormControl fullWidth>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                          {t('automations.selectTriggerDevice')}
                        </Typography>
                        <Tooltip title={t('automations.nodeEditor.selectDeviceHelp')} arrow>
                          <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                      </Box>
                      <Select
                        value={triggerSettings.triggerData.deviceId || ''}
                        displayEmpty
                        onChange={(e) => {
                          const device = devices.find((d) => d.ieeeAddress === e.target.value);
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === selectedNodeId
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      deviceId: e.target.value,
                                      deviceName: device?.friendlyName,
                                    },
                                  }
                                : node,
                            ),
                          );
                        }}
                      >
                        <MenuItem value="">
                          <em>{t('common.none')}</em>
                        </MenuItem>
                        {triggerSettings.compatibleDevices.length === 0 ? (
                          <MenuItem disabled>
                            {t('automations.nodeEditor.noCompatibleDevices')}
                          </MenuItem>
                        ) : (
                          triggerSettings.compatibleDevices.map((device) => (
                            <MenuItem key={device.ieeeAddress} value={device.ieeeAddress}>
                              {device.friendlyName || device.ieeeAddress}
                              {device.room && (
                                <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                  ({device.room})
                                </Typography>
                              )}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                      {triggerSettings.compatibleDevices.length === 0 && triggerSettings.needsDevice && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          {t('automations.nodeEditor.noCompatibleDevicesWarning')}
                        </Alert>
                      )}
                    </FormControl>
                  )}
                {/* Inputs pour les valeurs (température, luminosité, humidité) */}
                {(selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.TEMPERATURE ||
                (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.ILLUMINANCE ||
                (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.HUMIDITY ? (
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl sx={{ minWidth: 100 }}>
                      <InputLabel>{t('automations.operator')}</InputLabel>
                      <Select
                        value={(selectedNode?.data as TriggerNodeData)?.operator || '>'}
                        label={t('automations.operator')}
                        onChange={(e) => {
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === selectedNodeId
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      operator: e.target.value as '>' | '<' | '>=' | '<=' | '=',
                                    },
                                  }
                                : node,
                            ),
                          );
                        }}
                      >
                        <MenuItem value=">">{'>'}</MenuItem>
                        <MenuItem value="<">{'<'}</MenuItem>
                        <MenuItem value=">=">{'>='}</MenuItem>
                        <MenuItem value="<=">{'<='}</MenuItem>
                        <MenuItem value="=">{'='}</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      type="number"
                      label={
                        (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.TEMPERATURE
                          ? t('automations.value') + ' (°C)'
                          : (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.ILLUMINANCE
                          ? t('automations.value') + ' (lux)'
                          : t('automations.value') + ' (%)'
                      }
                      value={(selectedNode?.data as TriggerNodeData)?.value || ''}
                      onChange={(e) => {
                        const numValue = e.target.value ? parseFloat(e.target.value) : undefined;
                        setNodes((nds) =>
                          nds.map((node) =>
                            node.id === selectedNodeId
                              ? {
                                  ...node,
                                  data: {
                                    ...node.data,
                                    value: numValue,
                                  },
                                }
                              : node,
                          ),
                        );
                      }}
                      sx={{ flex: 1 }}
                      inputProps={{ step: '0.1' }}
                    />
                  </Box>
                ) : null}
              </Stack>
            )}
            {actionSettings && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                      {t('automations.nodeEditor.actionType')}
                    </Typography>
                    <Tooltip title={t('automations.nodeEditor.helpStep4')} arrow>
                      <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                  <Select
                    value={actionSettings.actionData.actionType}
                    displayEmpty
                    onChange={(e) => {
                        const actionType = e.target.value as AutomationActionType;
                        const actionLabels: Record<AutomationActionType, string> = {
                          [AutomationActionType.TURN_ON]: t('automations.actionTurnOn'),
                          [AutomationActionType.TURN_OFF]: t('automations.actionTurnOff'),
                          [AutomationActionType.TOGGLE]: t('automations.actionToggle'),
                          [AutomationActionType.SET_BRIGHTNESS]: t('automations.actionSetBrightness'),
                          [AutomationActionType.SET_COLOR]: t('automations.actionSetColor'),
                          [AutomationActionType.SET_COLOR_TEMP]: t('automations.actionSetColorTemp'),
                          [AutomationActionType.SET_THERMOSTAT]: t('automations.actionSetThermostat'),
                          [AutomationActionType.NOTIFY]: t('automations.actionNotify'),
                        };
                        setNodes((nds) =>
                          nds.map((node) =>
                            node.id === selectedNodeId
                              ? {
                                  ...node,
                                  data: {
                                    ...node.data,
                                    actionType,
                                    label: actionLabels[actionType] || actionType,
                                    // Réinitialiser l'appareil si le type change
                                    deviceId: undefined,
                                    deviceName: undefined,
                                    // Réinitialiser la durée si ce n'est plus TURN_ON
                                    duration: actionType === AutomationActionType.TURN_ON ? (node.data as ActionNodeData).duration : undefined,
                                  },
                                }
                              : node,
                          ),
                        );
                      }}
                    >
                      {Object.values(AutomationActionType).map((type) => {
                        const actionLabels: Record<AutomationActionType, string> = {
                          [AutomationActionType.TURN_ON]: t('automations.actionTurnOn'),
                          [AutomationActionType.TURN_OFF]: t('automations.actionTurnOff'),
                          [AutomationActionType.TOGGLE]: t('automations.actionToggle'),
                          [AutomationActionType.SET_BRIGHTNESS]: t('automations.actionSetBrightness'),
                          [AutomationActionType.SET_COLOR]: t('automations.actionSetColor'),
                          [AutomationActionType.SET_COLOR_TEMP]: t('automations.actionSetColorTemp'),
                          [AutomationActionType.SET_THERMOSTAT]: t('automations.actionSetThermostat'),
                          [AutomationActionType.NOTIFY]: t('automations.actionNotify'),
                        };
                        return (
                          <MenuItem key={type} value={type}>
                            {actionLabels[type] || type}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>

                  {/* Champ durée pour l'action TURN_ON */}
                  {actionSettings.actionData.actionType === AutomationActionType.TURN_ON && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('automations.nodeEditor.duration')}
                        </Typography>
                        <Tooltip title={t('automations.nodeEditor.durationHelp')} arrow>
                          <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                      </Box>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        value={actionSettings.actionData.duration ?? 0}
                        onChange={(e) => {
                          const duration = e.target.value ? parseInt(e.target.value, 10) : 0;
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === selectedNodeId
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      duration: duration >= 0 ? duration : 0,
                                    },
                                  }
                                : node,
                            ),
                          );
                        }}
                        inputProps={{ 
                          min: 0,
                          step: 1,
                        }}
                        helperText={
                          (actionSettings.actionData.duration ?? 0) === 0
                            ? t('automations.nodeEditor.durationInfinite')
                            : t('automations.nodeEditor.durationSeconds', { seconds: actionSettings.actionData.duration })
                        }
                      />
                    </Box>
                  )}

                  {/* Sélection de l'appareil (uniquement si nécessaire) */}
                  {actionSettings.needsDevice && (
                    <FormControl fullWidth>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                          {t('automations.selectActionDevice')}
                        </Typography>
                        <Tooltip title={t('automations.nodeEditor.selectActionDeviceHelp')} arrow>
                          <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                      </Box>
                      <Select
                        value={actionSettings.actionData.deviceId || ''}
                        displayEmpty
                        onChange={(e) => {
                          const device = devices.find((d) => d.ieeeAddress === e.target.value);
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === selectedNodeId
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      deviceId: e.target.value,
                                      deviceName: device?.friendlyName,
                                    },
                                  }
                                : node,
                            ),
                          );
                        }}
                      >
                        <MenuItem value="">
                          <em>{t('common.none')}</em>
                        </MenuItem>
                        {actionSettings.compatibleDevices.length === 0 ? (
                          <MenuItem disabled>
                            {t('automations.nodeEditor.noCompatibleDevices')}
                          </MenuItem>
                        ) : (
                          actionSettings.compatibleDevices.map((device) => (
                            <MenuItem key={device.ieeeAddress} value={device.ieeeAddress}>
                              {device.friendlyName || device.ieeeAddress}
                              {device.room && (
                                <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                  ({device.room})
                                </Typography>
                              )}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                      {actionSettings.compatibleDevices.length === 0 && actionSettings.needsDevice && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          {t('automations.nodeEditor.noCompatibleDevicesWarning')}
                        </Alert>
                      )}
                    </FormControl>
                  )}
              </Stack>
            )}
            {selectedNode && selectedNode.type === 'condition' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>{t('automations.nodeEditor.condition')}</InputLabel>
                  <Select
                    value={(selectedNode.data as ConditionNodeData).condition}
                    label={t('automations.nodeEditor.condition')}
                    onChange={(e) => {
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === selectedNodeId
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  condition: e.target.value as 'AND' | 'OR',
                                },
                              }
                            : node,
                        ),
                      );
                    }}
                  >
                    <MenuItem value="AND">AND</MenuItem>
                    <MenuItem value="OR">OR</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <HelpOutlineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  {t('automations.nodeEditor.selectNodeToConfigure')}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleSave} startIcon={<SaveIcon />}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

