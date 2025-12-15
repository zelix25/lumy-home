import { useState, useCallback, useMemo, useEffect } from 'react';
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
  Slider,
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
    case AutomationActionType.OPEN_COVER:
      return <TurnOnIcon />; // Utilise l'icône TurnOn pour ouvrir
    case AutomationActionType.CLOSE_COVER:
      return <TurnOffIcon />; // Utilise l'icône TurnOff pour fermer
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
  sunriseSunsetType?: 'sunrise' | 'sunset';
  offsetMinutes?: number;
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
        p: 1.5,
        minWidth: 135,
        bgcolor: '#E3F2FD',
        border: '2px solid #2196F3',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: '#2196F3',
            color: 'white',
            '& svg': {
              fontSize: 16,
            },
          }}
        >
          {triggerIcon}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, fontSize: '0.875rem' }}>
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
        p: 1.5,
        minWidth: 135,
        bgcolor: '#F3E5F5',
        border: '2px solid #9C27B0',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: '#9C27B0',
            color: 'white',
            '& svg': {
              fontSize: 16,
            },
          }}
        >
          {actionIcon}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, fontSize: '0.875rem' }}>
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
        p: 1.5,
        minWidth: 113,
        bgcolor: '#FFF3E0',
        border: '2px solid #FF9800',
        borderRadius: 2,
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: '50%',
            bgcolor: '#FF9800',
            color: 'white',
            '& .MuiTypography-root': {
              fontSize: '1rem',
            },
          }}
        >
          {conditionIcon}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
          {data.label}
        </Typography>
        <Chip 
          label={data.condition} 
          size="small" 
          sx={{ mt: 0.5, fontSize: '0.7rem', height: 20 }} 
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
  nodeContextMenu,
  setNodeContextMenu,
  handleDeleteNode,
  edgeContextMenu,
  setEdgeContextMenu,
  handleDeleteEdge,
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
  nodeContextMenu: { x: number; y: number; nodeId: string } | null;
  setNodeContextMenu: (menu: { x: number; y: number; nodeId: string } | null) => void;
  handleDeleteNode: (nodeId: string) => void;
  edgeContextMenu: { x: number; y: number; edgeId: string } | null;
  setEdgeContextMenu: (menu: { x: number; y: number; edgeId: string } | null) => void;
  handleDeleteEdge: (edgeId: string) => void;
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

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    [setNodeContextMenu],
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setEdgeContextMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
      });
    },
    [setEdgeContextMenu],
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
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
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
      <Menu
        open={!!nodeContextMenu}
        onClose={() => setNodeContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={nodeContextMenu ? { top: nodeContextMenu.y, left: nodeContextMenu.x } : undefined}
      >
        <MenuItem
          onClick={() => {
            if (nodeContextMenu) {
              handleDeleteNode(nodeContextMenu.nodeId);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          {t('automations.nodeEditor.deleteNode')}
        </MenuItem>
      </Menu>
    </>
  );
}

export default function NodeEditorDialog({
  open,
  onClose,
  onSuccess,
  automation,
}: NodeEditorDialogProps) {
  const { t } = useTranslation();
  const { devices } = useDevices();
  const { addNotification } = useNotification();

  // Fonction helper pour obtenir le label d'un type de déclencheur
  const getTriggerTypeLabel = (type: AutomationTriggerType): string => {
    switch (type) {
      case AutomationTriggerType.MOTION:
        return t('automations.triggerMotion');
      case AutomationTriggerType.CONTACT:
        return t('automations.triggerContact');
      case AutomationTriggerType.TEMPERATURE:
        return t('automations.triggerTemperature');
      case AutomationTriggerType.BUTTON:
        return t('automations.triggerButton');
      case AutomationTriggerType.VIBRATION:
        return t('automations.triggerVibration');
      case AutomationTriggerType.ILLUMINANCE:
        return t('automations.triggerIlluminance');
      case AutomationTriggerType.HUMIDITY:
        return t('automations.triggerHumidity');
      case AutomationTriggerType.WATER_LEAK:
        return t('automations.triggerWaterLeak');
      case AutomationTriggerType.SMOKE:
        return t('automations.triggerSmoke');
      case AutomationTriggerType.GAS:
        return t('automations.triggerGas');
      case AutomationTriggerType.SUNRISE_SUNSET:
        return t('automations.triggerSunriseSunset');
      case AutomationTriggerType.TIME:
        return t('automations.triggerTime');
      case AutomationTriggerType.MANUAL:
        return t('automations.triggerManual');
      default:
        return type;
    }
  };
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  // Fonction pour convertir une automation en nodes et edges
  const convertAutomationToNodes = useCallback((automation: any): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let nodeIdCounter = 0;
    let xPosition = 100;
    const ySpacing = 150;
    const xSpacing = 300;

    // Vérifier si on a des conditions supplémentaires (nouvelle structure)
    const hasAdditionalConditions = automation.trigger?.additionalConditions && 
                                    Array.isArray(automation.trigger.additionalConditions) &&
                                    automation.trigger.additionalConditions.length > 0;

    // Vérifier si on a une condition combinée (ancienne structure - pour compatibilité)
    const hasCombinedCondition = automation.trigger?.condition?.logic && 
                                 automation.trigger?.condition?.triggers &&
                                 Array.isArray(automation.trigger.condition.triggers) &&
                                 automation.trigger.condition.triggers.length > 1;

    let triggerNodes: Node[] = [];
    let conditionNode: Node | null = null;

    if (hasAdditionalConditions) {
      // Cas : Nouvelle structure avec additionalConditions
      const mainTrigger = automation.trigger;
      const additionalConditions = automation.trigger.additionalConditions;
      const logicOperator = automation.trigger.logicOperator || 'AND';
      
      // Créer le trigger principal
      const mainTriggerNode: Node = {
        id: `trigger-${nodeIdCounter++}`,
        type: 'trigger',
        position: { x: xPosition, y: 100 },
        data: {
          label: mainTrigger.deviceName || getTriggerTypeLabel(mainTrigger.type),
          triggerType: mainTrigger.type,
          deviceId: mainTrigger.deviceId || '',
          deviceName: mainTrigger.deviceName || '',
          operator: mainTrigger.condition?.operator,
          value: mainTrigger.condition?.value,
          sunriseSunsetType: mainTrigger.sunriseSunsetType,
          offsetMinutes: mainTrigger.offsetMinutes,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
      triggerNodes.push(mainTriggerNode);
      nodes.push(mainTriggerNode);

      // Créer les triggers pour les conditions supplémentaires
      additionalConditions.forEach((condition: any, index: number) => {
        const conditionTriggerNode: Node = {
          id: `trigger-${nodeIdCounter++}`,
          type: 'trigger',
          position: { x: xPosition, y: 100 + (index + 1) * ySpacing },
          data: {
            label: condition.deviceName || getTriggerTypeLabel(condition.type),
            triggerType: condition.type,
            deviceId: condition.deviceId || '',
            deviceName: condition.deviceName || '',
            operator: condition.condition?.operator,
            value: condition.condition?.value,
            sunriseSunsetType: condition.sunriseSunsetType,
            offsetMinutes: condition.offsetMinutes,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };
        triggerNodes.push(conditionTriggerNode);
        nodes.push(conditionTriggerNode);
      });

      xPosition += xSpacing;

      // Créer le noeud condition
      conditionNode = {
        id: `condition-${nodeIdCounter++}`,
        type: 'condition',
        position: { x: xPosition, y: 100 + (additionalConditions.length * ySpacing) / 2 },
        data: {
          label: t('automations.nodeEditor.condition'),
          condition: logicOperator as 'AND' | 'OR',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
      nodes.push(conditionNode);

      // Créer les edges de tous les triggers vers la condition
      triggerNodes.forEach((triggerNode) => {
        edges.push({
          id: `edge-${edges.length}`,
          source: triggerNode.id,
          target: conditionNode!.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      });

      xPosition += xSpacing;
    } else if (hasCombinedCondition) {
      // Cas : Ancienne structure (pour compatibilité)
      const conditionData = automation.trigger.condition;
      const triggers = conditionData.triggers;
      
      // Créer tous les triggers
      triggers.forEach((trigger: any, index: number) => {
        const triggerNode: Node = {
          id: `trigger-${nodeIdCounter++}`,
          type: 'trigger',
          position: { x: xPosition, y: 100 + index * ySpacing },
          data: {
            label: trigger.deviceName || getTriggerTypeLabel(trigger.type),
            triggerType: trigger.type,
            deviceId: trigger.deviceId || '',
            deviceName: trigger.deviceName || '',
            operator: trigger.condition?.operator,
            value: trigger.condition?.value,
            sunriseSunsetType: trigger.sunriseSunsetType,
            offsetMinutes: trigger.offsetMinutes,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };
        triggerNodes.push(triggerNode);
        nodes.push(triggerNode);
      });

      xPosition += xSpacing;

      // Créer le noeud condition
      conditionNode = {
        id: `condition-${nodeIdCounter++}`,
        type: 'condition',
        position: { x: xPosition, y: 100 + ((triggers.length - 1) * ySpacing) / 2 },
        data: {
          label: t('automations.nodeEditor.condition'),
          condition: conditionData.logic as 'AND' | 'OR',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
      nodes.push(conditionNode);

      // Créer les edges des triggers vers la condition
      triggerNodes.forEach((triggerNode) => {
        edges.push({
          id: `edge-${edges.length}`,
          source: triggerNode.id,
          target: conditionNode!.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      });

      xPosition += xSpacing;
    } else {
      // Cas : Un seul trigger (avec ou sans condition simple)
      if (automation.trigger) {
        const triggerNode: Node = {
          id: `trigger-${nodeIdCounter++}`,
          type: 'trigger',
          position: { x: xPosition, y: 100 },
          data: {
            label: automation.trigger.deviceName || getTriggerTypeLabel(automation.trigger.type),
            triggerType: automation.trigger.type,
            deviceId: automation.trigger.deviceId || '',
            deviceName: automation.trigger.deviceName || '',
            operator: automation.trigger.condition?.operator,
            value: automation.trigger.condition?.value,
            sunriseSunsetType: automation.trigger.sunriseSunsetType,
            offsetMinutes: automation.trigger.offsetMinutes,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };
        triggerNodes.push(triggerNode);
        nodes.push(triggerNode);
        xPosition += xSpacing;
      }
    }

    // Créer les nodes actions
    const actionNodes: Node[] = [];
    automation.actions?.forEach((action: any, index: number) => {
      const actionNode: Node = {
        id: `action-${nodeIdCounter++}`,
        type: 'action',
        position: { x: xPosition, y: 100 + index * ySpacing },
        data: {
          label: action.deviceName || t(`automations.actionTypes.${action.type}`),
          actionType: action.type,
          deviceId: action.deviceId || '',
          deviceName: action.deviceName || '',
          params: action.params || {},
          duration: action.params?.duration,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
      actionNodes.push(actionNode);
      nodes.push(actionNode);
    });

    // Créer les edges : trigger(s) -> condition (si présent) -> action(s)
    if (conditionNode) {
      // Si on a une condition, connecter la condition aux actions
      actionNodes.forEach((actionNode) => {
        edges.push({
          id: `edge-${edges.length}`,
          source: conditionNode!.id,
          target: actionNode.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      });
    } else if (triggerNodes.length > 0) {
      // Sinon, connecter directement les triggers aux actions
      triggerNodes.forEach((triggerNode) => {
        actionNodes.forEach((actionNode) => {
          edges.push({
            id: `edge-${edges.length}`,
            source: triggerNode.id,
            target: actionNode.id,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
          });
        });
      });
    }

    return { nodes, edges };
  }, [t]);

  // Initialiser les noeuds à partir de l'automation si fournie
  const initialNodes: Node[] = useMemo(() => {
    if (automation) {
      const { nodes } = convertAutomationToNodes(automation);
      return nodes;
    }
    return [];
  }, [automation, convertAutomationToNodes]);

  const initialEdges: Edge[] = useMemo(() => {
    if (automation) {
      const { edges } = convertAutomationToNodes(automation);
      return edges;
    }
    return [];
  }, [automation, convertAutomationToNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  
  // Obtenir le node sélectionné depuis le tableau nodes
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Initialiser le nom et la description quand l'automation change
  useEffect(() => {
    if (automation) {
      setName(automation.name || '');
      setDescription(automation.description || '');
      const { nodes: convertedNodes, edges: convertedEdges } = convertAutomationToNodes(automation);
      setNodes(convertedNodes);
      setEdges(convertedEdges);
    } else {
      setName('');
      setDescription('');
      setNodes([]);
      setEdges([]);
    }
    setSelectedNodeId(null);
  }, [automation, convertAutomationToNodes]);

  // Fermer automatiquement le message d'aide après 5 secondes quand la modal s'ouvre
  useEffect(() => {
    if (open) {
      // Réinitialiser showHelp à true quand la modal s'ouvre
      setShowHelp(true);
      
      // Fermer automatiquement après 5 secondes
      const timer = setTimeout(() => {
        setShowHelp(false);
      }, 5000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [open]);

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
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      setNodeContextMenu(null);
    },
    [setNodes, setEdges, selectedNodeId],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
      setEdgeContextMenu(null);
    },
    [setEdges],
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

    // Analyser le graphe pour trouver la structure : triggers -> conditions -> actions
    // Trouver toutes les conditions dans le graphe
    const conditionNodes = nodes.filter((n) => n.type === 'condition');
    
    // Si des conditions existent, analyser la structure
    let mainTriggerNode = triggerNodes[0];
    let mainTriggerData = triggerNodes[0].data as TriggerNodeData;
    let additionalConditions: any[] | undefined = undefined;
    let logicOperator: 'AND' | 'OR' | undefined = undefined;

    if (conditionNodes.length > 0) {
      // Pour chaque condition, trouver les triggers qui s'y connectent (edges où target = condition)
      for (const conditionNode of conditionNodes) {
        const conditionData = conditionNode.data as ConditionNodeData;
        
        // Trouver tous les edges qui pointent vers cette condition
        const incomingEdges = edges.filter((e) => e.target === conditionNode.id);
        const connectedTriggerIds = incomingEdges.map((e) => e.source);
        const connectedTriggers = connectedTriggerIds
          .map(id => nodes.find(n => n.id === id))
          .filter(n => n?.type === 'trigger') as Node<TriggerNodeData>[];

        // Si plusieurs triggers se connectent à cette condition, le premier est le trigger principal,
        // les autres sont des conditions supplémentaires
        if (connectedTriggers.length > 1) {
          // Le trigger principal sera le premier
          mainTriggerNode = connectedTriggers[0];
          mainTriggerData = mainTriggerNode.data as TriggerNodeData;
          
          // Les autres triggers deviennent des conditions supplémentaires
          const otherTriggers = connectedTriggers.slice(1);
          additionalConditions = otherTriggers.map((trigger) => {
            const triggerData = trigger.data as TriggerNodeData;
            return {
              type: triggerData.triggerType,
              deviceId: triggerData.deviceId,
              deviceName: triggerData.deviceName,
              condition: triggerData.operator && triggerData.value !== undefined
                ? {
                    operator: triggerData.operator,
                    value: triggerData.value,
                  }
                : undefined,
            };
          });
          
          logicOperator = conditionData.condition === 'AND' ? 'AND' : 'OR';
          break; // Prendre la première condition avec plusieurs triggers
        } else if (connectedTriggers.length === 1) {
          // Un seul trigger avec une condition, utiliser le trigger principal
          mainTriggerNode = connectedTriggers[0];
          mainTriggerData = mainTriggerNode.data as TriggerNodeData;
        }
      }
    }

    // Fonction récursive pour trouver toutes les actions connectées
    // en suivant les connexions à travers les noeuds condition
    const findConnectedActions = (startNodeId: string, visited: Set<string> = new Set()): string[] => {
      // Éviter les boucles infinies
      if (visited.has(startNodeId)) {
        return [];
      }
      visited.add(startNodeId);

      const actionIds: string[] = [];
      
      // Trouver toutes les connexions sortantes depuis ce noeud
      const outgoingEdges = edges.filter((e) => e.source === startNodeId);
      
      for (const edge of outgoingEdges) {
        const targetNode = nodes.find((n) => n.id === edge.target);
        
        if (!targetNode) continue;
        
        if (targetNode.type === 'action') {
          // C'est une action, l'ajouter à la liste
          actionIds.push(targetNode.id);
        } else if (targetNode.type === 'condition') {
          // C'est une condition, continuer à suivre les connexions depuis ce noeud
          const actionsFromCondition = findConnectedActions(targetNode.id, visited);
          actionIds.push(...actionsFromCondition);
        }
        // Si c'est un trigger, on ignore (ne devrait pas arriver)
      }
      
      return actionIds;
    };

    // Trouver toutes les actions connectées au trigger principal (directement ou via des conditions)
    const finalActionIds = findConnectedActions(mainTriggerNode.id);
    
    // Si des conditions sont présentes, aussi chercher les actions depuis les conditions
    for (const conditionNode of conditionNodes) {
      const actionsFromCondition = findConnectedActions(conditionNode.id);
      finalActionIds.push(...actionsFromCondition);
    }
    
    // Dédupliquer les IDs d'actions
    const uniqueActionIds = Array.from(new Set(finalActionIds));

    if (uniqueActionIds.length === 0) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nodeEditor.noConnectedActions'),
      });
      return;
    }

    // Créer les actions
    const actions = uniqueActionIds.map((actionId) => {
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
      // Construire la condition du trigger principal
      let triggerCondition: any = undefined;
      if (mainTriggerData.operator && mainTriggerData.value !== undefined) {
        triggerCondition = {
          operator: mainTriggerData.operator,
          value: mainTriggerData.value,
        };
      }

      const createData: CreateAutomationDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger: {
          type: mainTriggerData.triggerType,
          deviceId: mainTriggerData.deviceId,
          deviceName: mainTriggerData.deviceName,
          condition: triggerCondition,
          ...(additionalConditions && additionalConditions.length > 0 && { additionalConditions }),
          ...(logicOperator && { logicOperator }),
          ...(mainTriggerData.triggerType === AutomationTriggerType.SUNRISE_SUNSET && {
            sunriseSunsetType: mainTriggerData.sunriseSunsetType || 'sunrise',
            offsetMinutes: mainTriggerData.offsetMinutes || 0,
          }),
        },
        actions,
      };

      if (automation?.id) {
        // Mise à jour d'une automation existante
        await simpleAutomationsService.update(automation.id, createData);
        addNotification({
          type: 'success',
          title: t('automations.updated'),
          message: t('automations.updatedMessage'),
        });
      } else {
        // Création d'une nouvelle automation
        await simpleAutomationsService.create(createData);
        addNotification({
          type: 'success',
          title: t('automations.created'),
          message: t('automations.createdMessage'),
        });
      }
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
                nodeContextMenu={nodeContextMenu}
                setNodeContextMenu={setNodeContextMenu}
                handleDeleteNode={handleDeleteNode}
                edgeContextMenu={edgeContextMenu}
                setEdgeContextMenu={setEdgeContextMenu}
                handleDeleteEdge={handleDeleteEdge}
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
                                    // Réinitialiser les paramètres sunrise/sunset si le type change
                                    sunriseSunsetType: triggerType === AutomationTriggerType.SUNRISE_SUNSET ? 'sunrise' : undefined,
                                    offsetMinutes: triggerType === AutomationTriggerType.SUNRISE_SUNSET ? 0 : undefined,
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
                {/* Options pour le déclencheur Lever/Coucher du soleil */}
                {(selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.SUNRISE_SUNSET && (
                  <Box sx={{ mt: 2 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>{t('automations.sunriseSunsetType')}</InputLabel>
                      <Select
                        value={(selectedNode?.data as TriggerNodeData)?.sunriseSunsetType || 'sunrise'}
                        label={t('automations.sunriseSunsetType')}
                        onChange={(e) => {
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === selectedNodeId
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      sunriseSunsetType: e.target.value as 'sunrise' | 'sunset',
                                    },
                                  }
                                : node,
                            ),
                          );
                        }}
                      >
                        <MenuItem value="sunrise">{t('automations.sunrise')}</MenuItem>
                        <MenuItem value="sunset">{t('automations.sunset')}</MenuItem>
                      </Select>
                    </FormControl>
                    <Box>
                      <Typography gutterBottom>
                        {t('automations.offsetMinutes')}: {((selectedNode?.data as TriggerNodeData)?.offsetMinutes || 0) > 0 ? '+' : ''}{(selectedNode?.data as TriggerNodeData)?.offsetMinutes || 0} {t('automations.minutes')}
                      </Typography>
                      <Slider
                        value={(selectedNode?.data as TriggerNodeData)?.offsetMinutes || 0}
                        onChange={(_, value) => {
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === selectedNodeId
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      offsetMinutes: value as number,
                                    },
                                  }
                                : node,
                            ),
                          );
                        }}
                        min={-120}
                        max={120}
                        step={5}
                        marks={[
                          { value: -120, label: '-120' },
                          { value: -60, label: '-60' },
                          { value: 0, label: '0' },
                          { value: 60, label: '+60' },
                          { value: 120, label: '+120' },
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value > 0 ? '+' : ''}${value}`}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {t('automations.offsetMinutesDescription')}
                      </Typography>
                    </Box>
                  </Box>
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
                          [AutomationActionType.OPEN_COVER]: t('automations.actionOpenCover'),
                          [AutomationActionType.CLOSE_COVER]: t('automations.actionCloseCover'),
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
                          [AutomationActionType.OPEN_COVER]: t('automations.actionOpenCover'),
                          [AutomationActionType.CLOSE_COVER]: t('automations.actionCloseCover'),
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

